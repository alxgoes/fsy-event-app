package br.com.fsyrp2.app.state

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import br.com.fsyrp2.app.BuildConfig
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.ApiException
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.notifications.PushTokenManager
import br.com.fsyrp2.app.notifications.ScheduleReminderScheduler
import br.com.fsyrp2.app.security.DeepLinkParser
import br.com.fsyrp2.app.security.DeepLinkTarget
import br.com.fsyrp2.app.security.KeystoreSessionStore
import br.com.fsyrp2.app.security.PkceAuthHelper
import br.com.fsyrp2.app.widget.FsyWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

enum class MainTab(val key: String, val label: String) {
    HOME("inicio", "Início"),
    AGENDA("agenda", "Agenda"),
    ANNOUNCEMENTS("avisos", "Avisos"),
    PROFILE("perfil", "Perfil")
}

sealed interface OverlayDestination {
    data object None : OverlayDestination
    data object Gallery : OverlayDestination
    data object CounselorPanel : OverlayDestination
    data class AdminHub(val initialModule: AdminModule? = null) : OverlayDestination
}

class FsyAppState(
    private val appContext: Context,
    val apiClient: PortalApiClient = PortalApiClient(),
    val keyStore: KeystoreSessionStore = KeystoreSessionStore(appContext)
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val refreshMutex = Mutex()
    private var activeDataJob: Job? = null

    var session by mutableStateOf<UserSession?>(null)
        private set

    var sessionGeneration by mutableLongStateOf(keyStore.loadLocalSessionGeneration())
        private set

    var profile by mutableStateOf<Profile?>(null)
        private set

    var company by mutableStateOf<Company?>(null)
        private set

    var companyYouth by mutableStateOf<List<Profile>>(emptyList())
        private set

    var scheduleItems by mutableStateOf<List<ScheduleItem>>(emptyList())
        private set

    var announcements by mutableStateOf<List<Announcement>>(emptyList())
        private set

    var instagramPosts by mutableStateOf<List<InstagramPost>>(emptyList())
        private set

    var instagramProfileUrl by mutableStateOf("https://www.instagram.com/fsybrasiloficial/")
        private set

    var publicMediaPhotos by mutableStateOf<List<MediaPhoto>>(emptyList())
        private set

    var personalReminderIds by mutableStateOf<Set<String>>(emptySet())
        private set

    var notificationPreferences by mutableStateOf(NotificationChannelPreferencesDto())
        private set

    var selectedTab by mutableStateOf(MainTab.HOME)
    var overlayDestination by mutableStateOf<OverlayDestination>(OverlayDestination.None)
    var focusedAnnouncementId by mutableStateOf<String?>(null)

    var isBootstrapping by mutableStateOf(true)
        private set

    var isLoading by mutableStateOf(false)
        private set

    var isAuthenticating by mutableStateOf(false)
        private set

    var authError by mutableStateOf<String?>(null)
    var authInfoMessage by mutableStateOf<String?>(null)
    var globalBannerError by mutableStateOf<String?>(null)
    var globalBannerSuccess by mutableStateOf<String?>(null)

    var isOnline by mutableStateOf(true)
        private set

    var lastSyncedAtLabel by mutableStateOf<String?>(null)
        private set

    private val cardOrderCache = mutableStateMapOf<String, List<String>>()

    init {
        NotificationHelper.ensureChannelsCreated(appContext)
        observeConnectivity()
        bootstrapFromKeystore()
    }

    private fun bootstrapFromKeystore() {
        val stored = keyStore.loadSession()
        if (stored == null) {
            isBootstrapping = false
            return
        }
        session = stored
        sessionGeneration = keyStore.loadLocalSessionGeneration()
        personalReminderIds = keyStore.loadPersonalReminderIds(stored.userId)
        notificationPreferences = keyStore.loadNotificationPreferences(stored.userId)
        loadCardOrdersForUser(stored.userId)
        isBootstrapping = false
        refreshCoreData()
    }

    private fun loadCardOrdersForUser(userId: String) {
        cardOrderCache.clear()
        for (pageKey in CardOrderManager.PAGE_DEFAULT_IDS.keys) {
            cardOrderCache[pageKey] = keyStore.loadCardOrder(userId, pageKey)
        }
    }

    fun cardOrderFor(pageKey: String): List<String> {
        val defaults = CardOrderManager.PAGE_DEFAULT_IDS[pageKey] ?: emptyList()
        return cardOrderCache[pageKey] ?: defaults
    }

    fun updateCardOrder(pageKey: String, newOrder: List<String>) {
        val currentSession = session ?: return
        val defaults = CardOrderManager.PAGE_DEFAULT_IDS[pageKey] ?: emptyList()
        val resolved = CardOrderManager.resolveOrder(defaults, newOrder)
        cardOrderCache[pageKey] = resolved
        keyStore.saveCardOrder(currentSession.userId, pageKey, resolved)
    }

    suspend fun withValidSession(): UserSession {
        return refreshMutex.withLock {
            val current = session ?: throw ApiException(401, "Sessão encerrada. Faça login novamente.")
            val nowSec = System.currentTimeMillis() / 1000L
            if (current.expiresAtEpochSeconds > 0L && current.expiresAtEpochSeconds - nowSec < 90L && current.refreshToken.isNotBlank()) {
                try {
                    val refreshed = apiClient.refreshSession(current.refreshToken)
                    if (refreshed.userId != current.userId) {
                        throw ApiException(401, "Conflito de titularidade na renovação da sessão.")
                    }
                    keyStore.saveSession(refreshed)
                    session = refreshed
                    refreshed
                } catch (e: ApiException) {
                    if (e.statusCode in listOf(400, 401, 403)) {
                        performImmediateLogoutCleanup(previousSession = current, revokeAllPush = false)
                    }
                    throw e
                }
            } else {
                current
            }
        }
    }

    fun signIn(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            authError = "Informe seu e-mail e sua senha para entrar."
            return
        }
        isAuthenticating = true
        authError = null
        authInfoMessage = null
        scope.launch {
            try {
                val newSession = apiClient.signInWithPassword(email, password)
                applyNewAuthenticatedSession(newSession)
            } catch (e: ApiException) {
                authError = when (e.statusCode) {
                    400, 401 -> "E-mail ou senha incorretos."
                    403 -> e.message
                    else -> e.message
                }
            } catch (_: Exception) {
                authError = "Sem conexão com o servidor. Verifique sua internet e tente novamente."
            } finally {
                isAuthenticating = false
            }
        }
    }

    fun signUp(email: String, password: String, fullName: String, unit: String) {
        if (fullName.trim().length < 3) {
            authError = "Informe seu nome completo."
            return
        }
        if (email.isBlank() || !email.contains("@")) {
            authError = "Informe um e-mail válido."
            return
        }
        if (password.length < 6) {
            authError = "A senha deve ter pelo menos 6 caracteres."
            return
        }
        isAuthenticating = true
        authError = null
        authInfoMessage = null
        scope.launch {
            try {
                val result = apiClient.signUpWithPassword(email, password, fullName, unit)
                if (result.session != null) {
                    applyNewAuthenticatedSession(result.session)
                } else {
                    authInfoMessage = "Cadastro registrado! Verifique seu e-mail para confirmar a conta antes de entrar."
                }
            } catch (e: ApiException) {
                authError = e.message
            } catch (_: Exception) {
                authError = "Não foi possível concluir o cadastro. Verifique sua conexão."
            } finally {
                isAuthenticating = false
            }
        }
    }

    fun requestPasswordRecovery(email: String) {
        if (email.isBlank() || !email.contains("@")) {
            authError = "Informe o e-mail da sua conta para receber o link de recuperação."
            return
        }
        isAuthenticating = true
        authError = null
        authInfoMessage = null
        scope.launch {
            try {
                val msg = apiClient.requestPasswordRecovery(email)
                authInfoMessage = msg
            } catch (e: ApiException) {
                authError = e.message
            } catch (_: Exception) {
                authError = "Não foi possível solicitar a recuperação agora. Verifique sua conexão."
            } finally {
                isAuthenticating = false
            }
        }
    }

    fun buildGoogleOAuthUri(): Uri? {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        if (base.isBlank()) {
            authError = "Configuração de autenticação OAuth indisponível nesta compilação."
            return null
        }
        val verifier = PkceAuthHelper.generateCodeVerifier()
        val challenge = PkceAuthHelper.computeCodeChallengeS256(verifier)
        val state = PkceAuthHelper.generateStateNonce()
        keyStore.savePkceState(verifier, state)

        // Usa exatamente `fsyrp2://auth-callback` cadastrado na Redirect URL allowlist do Supabase (CONTRATO-WEB.md §1)
        val callback = Uri.encode("fsyrp2://auth-callback")
        val url = "$base/auth/v1/authorize?provider=google&redirect_to=$callback&code_challenge=$challenge&code_challenge_method=s256"
        return Uri.parse(url)
    }

    fun handleIncomingDeepLink(rawUri: String?) {
        val target = DeepLinkParser.parse(rawUri) ?: return
        when (target) {
            is DeepLinkTarget.AuthCallback -> {
                if (!target.error.isNullOrBlank()) {
                    authError = "O Google não concluiu a entrada: ${target.error}"
                    return
                }
                val code = target.code?.takeIf { it.isNotBlank() } ?: run {
                    authError = "O Google não devolveu um código de acesso válido."
                    return
                }
                val verifier = keyStore.consumePkceVerifier(target.state)
                if (verifier == null) {
                    authError = "Validação de segurança OAuth expirada ou inválida. Tente entrar novamente."
                    return
                }
                isAuthenticating = true
                authError = null
                scope.launch {
                    try {
                        val newSession = apiClient.exchangePkceCode(code, verifier)
                        applyNewAuthenticatedSession(newSession)
                    } catch (e: ApiException) {
                        authError = e.message
                    } catch (_: Exception) {
                        authError = "Não foi possível concluir o login com Google."
                    } finally {
                        isAuthenticating = false
                    }
                }
            }

            is DeepLinkTarget.Navigation -> {
                overlayDestination = OverlayDestination.None
                selectedTab = when (target.tab) {
                    AppTab.INICIO -> MainTab.HOME
                    AppTab.AGENDA -> MainTab.AGENDA
                    AppTab.AVISOS -> MainTab.ANNOUNCEMENTS
                    AppTab.PERFIL -> MainTab.PROFILE
                }
                if (target.tab == AppTab.AVISOS && !target.itemId.isNullOrBlank()) {
                    focusedAnnouncementId = target.itemId
                }
            }
        }
    }

    private fun applyNewAuthenticatedSession(newSession: UserSession) {
        activeDataJob?.cancel()
        val previous = session
        val previousBoundDeviceId = previous?.let { keyStore.loadBoundDeviceId(it.userId) }
        if (previous != null && previous.userId != newSession.userId) {
            ScheduleReminderScheduler.cancelAllReminders(appContext)
            NotificationHelper.cancelAllNotifications(appContext)
            scope.launch {
                PushTokenManager.cleanupOnLogoutOrAccountSwitch(
                    context = appContext,
                    previousSession = previous,
                    apiClient = apiClient,
                    keyStore = keyStore,
                    explicitDeviceId = previousBoundDeviceId
                )
            }
        }
        keyStore.saveSession(newSession)
        session = newSession
        sessionGeneration = keyStore.loadLocalSessionGeneration()
        profile = null
        company = null
        companyYouth = emptyList()
        scheduleItems = emptyList()
        announcements = emptyList()
        personalReminderIds = keyStore.loadPersonalReminderIds(newSession.userId)
        notificationPreferences = keyStore.loadNotificationPreferences(newSession.userId)
        loadCardOrdersForUser(newSession.userId)
        selectedTab = MainTab.HOME
        overlayDestination = OverlayDestination.None
        FsyWidgetManager.schedulePeriodicSync(appContext)
        refreshCoreData()
    }

    fun refreshCoreData() {
        val currentSession = session ?: return
        val expectedGen = sessionGeneration
        val expectedUserId = currentSession.userId

        activeDataJob?.cancel()
        activeDataJob = scope.launch {
            isLoading = true
            globalBannerError = null
            try {
                val validSession = withValidSession()
                if (sessionGeneration != expectedGen || session?.userId != expectedUserId) return@launch

                coroutineScope {
                    val profileDeferred = async { apiClient.fetchCurrentProfile(validSession) }
                    val scheduleDeferred = async { runCatching { apiClient.fetchSchedule(validSession) }.getOrDefault(emptyList()) }
                    val announcementsDeferred = async { runCatching { apiClient.fetchAnnouncements(validSession) }.getOrDefault(emptyList()) }
                    val instagramDeferred = async { runCatching { apiClient.fetchInstagramFeed() }.getOrNull() }
                    val mediaDeferred = async { runCatching { apiClient.fetchPublicMedia(validSession) }.getOrDefault(emptyList()) }

                    val loadedProfile = profileDeferred.await()
                    val loadedSchedule = scheduleDeferred.await()
                    val loadedAnnouncements = announcementsDeferred.await()
                    val loadedInsta = instagramDeferred.await()
                    val loadedMedia = mediaDeferred.await()

                    val loadedCompany = if (!loadedProfile.companyId.isNullOrBlank()) {
                        runCatching { apiClient.fetchCompany(validSession, loadedProfile.companyId) }.getOrNull()
                    } else null

                    val loadedCompanyYouth = if (!loadedProfile.companyId.isNullOrBlank() &&
                        (loadedProfile.roleEnum == UserRole.CONSULTOR || loadedProfile.roleEnum.isManager)
                    ) {
                        runCatching { apiClient.fetchCompanyYouth(validSession, loadedProfile.companyId) }.getOrDefault(emptyList())
                    } else emptyList()

                    if (sessionGeneration != expectedGen || session?.userId != expectedUserId) return@coroutineScope

                    profile = loadedProfile
                    company = loadedCompany
                    companyYouth = loadedCompanyYouth
                    scheduleItems = loadedSchedule
                    announcements = loadedAnnouncements
                    if (loadedInsta != null) {
                        instagramPosts = loadedInsta.posts
                        instagramProfileUrl = loadedInsta.profileUrl
                    }
                    publicMediaPhotos = loadedMedia

                    val nowZoned = ZonedDateTime.now(EventCalendar.EVENT_ZONE)
                    lastSyncedAtLabel = nowZoned.format(DateTimeFormatter.ofPattern("HH:mm"))

                    // Atualiza snapshot público seguro do widget e replaneja lembretes locais
                    val snapshot = WidgetSnapshotDto(
                        userId = validSession.userId,
                        companyName = loadedCompany?.name,
                        updatedAtEpochMs = System.currentTimeMillis(),
                        activities = loadedSchedule
                            .filter { it.dayKey != "dia0" }
                            .map {
                                WidgetActivitySummaryDto(
                                    id = it.id,
                                    dayKey = it.dayKey,
                                    startTime = it.startTime,
                                    endTime = it.endTime,
                                    title = it.title,
                                    location = it.location
                                )
                            }
                    )
                    keyStore.saveWidgetSnapshot(snapshot)
                    ScheduleReminderScheduler.replanAllReminders(
                        context = appContext,
                        scheduleItems = loadedSchedule,
                        personalReminderIds = personalReminderIds,
                        scheduleRemindersEnabled = notificationPreferences.scheduleRemindersEnabled,
                        personalRemindersEnabled = notificationPreferences.personalRemindersEnabled
                    )
                    FsyWidgetManager.updateAllWidgets(appContext)
                    FsyWidgetManager.schedulePeriodicSync(appContext)

                    // Sincroniza registro do dispositivo push em background
                    launch {
                        val summary = PushTokenManager.syncDeviceRegistration(
                            context = appContext,
                            session = validSession,
                            apiClient = apiClient,
                            keyStore = keyStore
                        )
                        if (summary != null && sessionGeneration == expectedGen && session?.userId == expectedUserId) {
                            notificationPreferences = summary.preferences
                        }
                    }
                }
            } catch (e: ApiException) {
                if (e.statusCode in listOf(401, 403)) {
                    authError = e.message
                    signOut()
                } else {
                    globalBannerError = e.message
                }
            } catch (_: Exception) {
                globalBannerError = "Modo offline: não foi possível atualizar todos os dados agora."
            } finally {
                if (sessionGeneration == expectedGen) {
                    isLoading = false
                }
            }
        }
    }

    fun togglePersonalReminder(activityId: String) {
        val currentSession = session ?: return
        val updated = if (personalReminderIds.contains(activityId)) {
            personalReminderIds - activityId
        } else {
            personalReminderIds + activityId
        }
        personalReminderIds = updated
        keyStore.savePersonalReminderIds(currentSession.userId, updated)
        ScheduleReminderScheduler.replanAllReminders(
            context = appContext,
            scheduleItems = scheduleItems,
            personalReminderIds = updated,
            scheduleRemindersEnabled = notificationPreferences.scheduleRemindersEnabled,
            personalRemindersEnabled = notificationPreferences.personalRemindersEnabled
        )
    }

    fun toggleAnnouncementLike(announcementId: String) {
        val expectedGen = sessionGeneration
        // Atualização otimista imediata
        val previousList = announcements
        announcements = announcements.map { item ->
            if (item.id == announcementId) {
                val nextLiked = !item.likedByMe
                val nextCount = (item.likesCount + if (nextLiked) 1 else -1).coerceAtLeast(0)
                item.copy(likedByMe = nextLiked, likesCount = nextCount)
            } else item
        }
        scope.launch {
            try {
                val validSession = withValidSession()
                val res = apiClient.toggleAnnouncementLike(validSession, announcementId)
                if (sessionGeneration != expectedGen) return@launch
                announcements = announcements.map { item ->
                    if (item.id == announcementId) {
                        item.copy(likedByMe = res.liked, likesCount = res.likesCount)
                    } else item
                }
            } catch (_: Exception) {
                if (sessionGeneration == expectedGen) {
                    announcements = previousList
                    globalBannerError = "Não foi possível registrar sua curtida agora."
                }
            }
        }
    }

    fun updateNotificationPreferences(newPrefs: NotificationChannelPreferencesDto) {
        val currentSession = session ?: return
        val expectedGen = sessionGeneration
        notificationPreferences = newPrefs
        keyStore.saveNotificationPreferences(currentSession.userId, newPrefs)
        ScheduleReminderScheduler.replanAllReminders(
            context = appContext,
            scheduleItems = scheduleItems,
            personalReminderIds = personalReminderIds,
            scheduleRemindersEnabled = newPrefs.scheduleRemindersEnabled,
            personalRemindersEnabled = newPrefs.personalRemindersEnabled
        )
        scope.launch {
            val validSession = runCatching { withValidSession() }.getOrDefault(currentSession)
            val synced = PushTokenManager.updatePreferences(
                session = validSession,
                preferences = newPrefs,
                apiClient = apiClient,
                keyStore = keyStore
            )
            if (sessionGeneration == expectedGen) {
                notificationPreferences = synced
            }
        }
    }

    fun signOut(revokeAllPushDevices: Boolean = false) {
        val previousSession = session
        performImmediateLogoutCleanup(previousSession, revokeAllPushDevices)
    }

    private fun performImmediateLogoutCleanup(
        previousSession: UserSession?,
        revokeAllPush: Boolean
    ) {
        activeDataJob?.cancel()
        val capturedDeviceId = previousSession?.let { keyStore.loadBoundDeviceId(it.userId) }
        keyStore.clearSession()
        sessionGeneration = keyStore.loadLocalSessionGeneration()
        session = null
        profile = null
        company = null
        companyYouth = emptyList()
        scheduleItems = emptyList()
        announcements = emptyList()
        publicMediaPhotos = emptyList()
        personalReminderIds = emptySet()
        notificationPreferences = NotificationChannelPreferencesDto()
        cardOrderCache.clear()
        overlayDestination = OverlayDestination.None
        selectedTab = MainTab.HOME
        focusedAnnouncementId = null
        lastSyncedAtLabel = null

        ScheduleReminderScheduler.cancelAllReminders(appContext)
        FsyWidgetManager.cancelPeriodicSync(appContext)
        NotificationHelper.cancelAllNotifications(appContext)

        scope.launch {
            FsyWidgetManager.updateAllWidgets(appContext)
            PushTokenManager.cleanupOnLogoutOrAccountSwitch(
                context = appContext,
                previousSession = previousSession,
                apiClient = apiClient,
                keyStore = keyStore,
                explicitDeviceId = capturedDeviceId,
                revokeAllDevices = revokeAllPush
            )
            if (previousSession != null) {
                apiClient.signOut(previousSession)
            }
        }
    }

    private fun observeConnectivity() {
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val activeNet = cm.activeNetwork
        val caps = activeNet?.let { cm.getNetworkCapabilities(it) }
        isOnline = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true

        runCatching {
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    val wasOffline = !isOnline
                    isOnline = true
                    if (wasOffline && session != null) {
                        scope.launch { refreshCoreData() }
                    }
                }

                override fun onLost(network: Network) {
                    isOnline = false
                }
            })
        }
    }
}
