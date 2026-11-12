package br.com.fsyrp2.app.state

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import br.com.fsyrp2.app.BuildConfig
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.OfflineCache
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.network.ApiException
import br.com.fsyrp2.app.network.FriendlyErrors
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.notifications.PushTokenManager
import br.com.fsyrp2.app.notifications.ScheduleReminderScheduler
import br.com.fsyrp2.app.security.DeepLinkParser
import br.com.fsyrp2.app.security.DeepLinkTarget
import br.com.fsyrp2.app.security.KeystoreSessionStore
import br.com.fsyrp2.app.security.PkceAuthHelper
import br.com.fsyrp2.app.security.SessionTokens
import br.com.fsyrp2.app.widget.FsyWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import java.io.IOException
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

enum class MainTab(val key: String, val label: String) {
    HOME("inicio", "Início"),
    AGENDA("agenda", "Agenda"),
    ANNOUNCEMENTS("avisos", "Avisos"),
    MORE("mais", "Mais")
}

/** Telas empilhadas sobre as abas (entram deslizando; o voltar do sistema retorna). */
sealed interface OverlayDestination {
    data object None : OverlayDestination
    data object Gallery : OverlayDestination
    data object NotificationSettings : OverlayDestination
    data object AboutApp : OverlayDestination
    data object CounselorPanel : OverlayDestination
    data class AdminHub(val initialModule: AdminModule? = null) : OverlayDestination
}

/** Rascunho sensível retido só em RAM, fora do Bundle, da cópia offline e do disco. */
data class RegistrationAuthorizationEditorState(
    val record: RegistrationRecordDto,
    val draft: Map<String, String> = record.authorizationValues()
)

/** Mantém o estado do app vivo em rotação, troca de tema e tamanho de fonte. */
class FsyAppViewModel(application: Application) : AndroidViewModel(application) {
    val state = FsyAppState(application.applicationContext)
    override fun onCleared() {
        state.dispose()
        super.onCleared()
    }
}

class FsyAppState(
    private val appContext: Context,
    val apiClient: PortalApiClient = PortalApiClient(),
    val keyStore: KeystoreSessionStore = KeystoreSessionStore(appContext)
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val offlineCache = OfflineCache(appContext)
    private var activeDataJob: Job? = null
    private val profileAccessMutex = Mutex()
    private var profileAccessRevision = 0L
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

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

    /** Agenda completa como veio do servidor (equipe inclusa). Use [scheduleItems] nas telas. */
    var rawScheduleItems by mutableStateOf<List<ScheduleItem>>(emptyList())
        private set

    /** Agenda que esta pessoa pode ver: jovem (ou papel desconhecido) não vê Dia Zero nem "Equipe". */
    val scheduleItems: List<ScheduleItem>
        get() = ScheduleVisibility.visibleTo(rawScheduleItems, profile?.roleEnum)

    var announcements by mutableStateOf<List<Announcement>>(emptyList())
        private set

    var instagramPosts by mutableStateOf<List<InstagramPost>>(emptyList())
        private set

    var instagramProfileUrl by mutableStateOf(InstagramPost.OFFICIAL_URL)
        private set

    var publicMediaPhotos by mutableStateOf<List<MediaPhoto>>(emptyList())
        private set

    var personalReminderIds by mutableStateOf<Set<String>>(emptySet())
        private set

    var notificationPreferences by mutableStateOf(NotificationChannelPreferencesDto())
        private set

    /** Avisos já vistos (selo "não lidos" da aba Avisos). */
    var readAnnouncementIds by mutableStateOf<Set<String>>(emptySet())
        private set

    var profilePhoto by mutableStateOf(ProfilePhotoState())
        private set

    var photoReviews by mutableStateOf<List<ProfilePhotoReview>>(emptyList())
        private set

    var companyProfilePhotos by mutableStateOf<Map<String, String>>(emptyMap())
        private set

    var companyWhatsapp by mutableStateOf<CompanyWhatsappLink?>(null)
        private set

    var allCompaniesWhatsapp by mutableStateOf<List<CompanyWhatsappLink>>(emptyList())

    var isCompanyWhatsappBusy by mutableStateOf(false)
        private set

    var companyWhatsappError by mutableStateOf<String?>(null)
        private set

    var companyWhatsappFeedback by mutableStateOf<String?>(null)
        private set

    private var photoUrlErrorRetryUsed = false
    private var companyPhotosErrorRetryUsed = false
    private var photoReviewsErrorRetryUsed = false

    var profilePhotoFetchCount by mutableStateOf(0)
        private set

    var registrationAuthorizationEditor by mutableStateOf<RegistrationAuthorizationEditorState?>(null)
        private set

    var isPhotoBusy by mutableStateOf(false)
        private set

    var photoError by mutableStateOf<String?>(null)

    var photoSuccessMessage by mutableStateOf<String?>(null)
        private set

    var selectedTab by mutableStateOf(MainTab.HOME)
    var overlayDestination by mutableStateOf<OverlayDestination>(OverlayDestination.None)
        private set
    var focusedAnnouncementId by mutableStateOf<String?>(null)
    var focusedScheduleItemId by mutableStateOf<String?>(null)

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

    // --- Papéis: sem perfil carregado, a pessoa é tratada como jovem (nada de equipe aparece).
    val effectiveRole: UserRole get() = profile?.roleEnum ?: UserRole.JOVEM
    val canOpenCounselorPanel: Boolean get() = profile != null && effectiveRole.canAccessCounselorPanel
    val adminModules: List<AdminModule>
        get() = if (profile == null || effectiveRole == UserRole.JOVEM) emptyList() else AdminModule.availableFor(effectiveRole)
    val canOpenAdmin: Boolean get() = adminModules.isNotEmpty()
    val canPublishAnnouncements: Boolean get() = profile != null && effectiveRole.canPublishAnnouncements
    val canReviewPhotos: Boolean get() = canOpenCounselorPanel

    val unreadAnnouncementCount: Int
        get() = announcements.count { it.id !in readAnnouncementIds }

    /** Primeira carga ainda sem nenhum dado (nem da cópia local). */
    val isInitialLoading: Boolean get() = isLoading && lastSyncedAtLabel == null

    init {
        br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.purgeExpiredPrivateDocuments(appContext)
        NotificationHelper.ensureChannelsCreated(appContext)
        observeConnectivity()
        bootstrapFromKeystore()
    }

    // --- Atualização automática do app ------------------------------------------------------

    private val updatePrefs = br.com.fsyrp2.app.update.AppUpdatePreferences(appContext)
    var updateUiState by mutableStateOf<br.com.fsyrp2.app.update.AppUpdateUiState>(br.com.fsyrp2.app.update.AppUpdateUiState.Idle)
        private set
    var postUpdateNotice by mutableStateOf(updatePrefs.peekPostUpdateNotice())
        private set
    var autoUpdateEnabled by mutableStateOf(updatePrefs.autoUpdateEnabled)
        private set
    var lastUpdateCheckLabel by mutableStateOf(formatUpdateCheck(updatePrefs.lastCheckEpochMs))
        private set
    private var updateJob: kotlinx.coroutines.Job? = null
    /** Pedido de confirmação do Android para a tela aberta exibir (ver MainActivity). */
    var pendingInstallConfirmation by mutableStateOf<android.content.Intent?>(null)
        private set
    /** Último APK baixado e conferido, para tentar de novo sem baixar outra vez. */
    private var lastVerifiedApk: Pair<br.com.fsyrp2.app.update.AvailableAppUpdate, String>? = null

    fun consumeInstallConfirmation() { pendingInstallConfirmation = null }

    private fun formatUpdateCheck(epochMs: Long): String? {
        if (epochMs <= 0L) return null
        return java.time.Instant.ofEpochMilli(epochMs)
            .atZone(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM 'às' HH:mm"))
    }

    /** Ao abrir/voltar ao app (no máximo a cada 6 h) e pelo botão "Verificar atualização". */
    fun checkForAppUpdate(force: Boolean = false) {
        // Build de teste ("FSY (teste)") só verifica quando a pessoa pede.
        if (br.com.fsyrp2.app.BuildConfig.DEBUG && !force) return
        val current = updateUiState
        if (current is br.com.fsyrp2.app.update.AppUpdateUiState.Downloading || current is br.com.fsyrp2.app.update.AppUpdateUiState.Installing || current is br.com.fsyrp2.app.update.AppUpdateUiState.Checking) return
        val now = System.currentTimeMillis()
        if (!force && !br.com.fsyrp2.app.update.AppUpdateValidator.shouldRunAutomaticCheck(updatePrefs.lastCheckEpochMs, now)) return
        updatePrefs.consumePendingInstallError()?.let { msg -> updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Error(msg) }
        if (force) updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Checking
        updateJob = scope.launch {
            try {
                val manifest = apiClient.fetchAppReleaseManifest()
                updatePrefs.lastCheckEpochMs = now
                lastUpdateCheckLabel = formatUpdateCheck(now)
                val available = br.com.fsyrp2.app.update.AppUpdateValidator.evaluateManifest(manifest)
                if (available == null) {
                    updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.UpToDate(lastUpdateCheckLabel)
                    return@launch
                }
                updatePrefs.saveUpcomingReleaseNotes(available.versionCode, available.versionName, available.releaseNotesPtBr)
                updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Available(available)
                if (autoUpdateEnabled || available.isMandatory) startUpdateDownload(allowMetered = false)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                updateUiState = if (force) {
                    br.com.fsyrp2.app.update.AppUpdateUiState.Error("Não foi possível verificar atualizações agora. Confira a internet e tente de novo.")
                } else br.com.fsyrp2.app.update.AppUpdateUiState.Idle
            }
        }
    }

    fun startUpdateDownload(allowMetered: Boolean) {
        val update = updateUiState.activeUpdate ?: return
        if (updateUiState is br.com.fsyrp2.app.update.AppUpdateUiState.Downloading) return
        if (!allowMetered && br.com.fsyrp2.app.update.AppUpdateInstaller.isNetworkMetered(appContext)) {
            updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.AwaitingMeteredConfirmation(update)
            return
        }
        updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Downloading(update)
        updateJob?.cancel()
        updateJob = scope.launch {
            try {
                val file = br.com.fsyrp2.app.update.AppUpdateInstaller.downloadAndVerifyApk(appContext, update) { bytes, fraction ->
                    scope.launch {
                        if (updateUiState is br.com.fsyrp2.app.update.AppUpdateUiState.Downloading) updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Downloading(update, fraction, bytes)
                    }
                }
                lastVerifiedApk = update to file.absolutePath
                if (br.com.fsyrp2.app.update.AppUpdateInstaller.canRequestPackageInstalls(appContext)) {
                    updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.ReadyToInstall(update, file.absolutePath)
                    if ((autoUpdateEnabled || update.isMandatory) && installedBySelf()) triggerUpdateInstall(appContext)
                } else {
                    updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.NeedsInstallPermission(update, file.absolutePath)
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: br.com.fsyrp2.app.update.UpdateDownloadException) {
                updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Error(e.messagePtBr, update)
            } catch (e: Exception) {
                updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Error("Não foi possível baixar a atualização. Confira a internet e tente de novo.", update)
            }
        }
    }

    /**
     * A atualização sem toque (Android 12+) só é aceita quando a versão atual foi instalada pelo
     * próprio app. Instalada pelo navegador, a sessão silenciosa é cancelada: mostra "Instalar".
     */
    private fun installedBySelf(): Boolean = runCatching {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.S) return false
        appContext.packageManager.getInstallSourceInfo(appContext.packageName).installingPackageName == appContext.packageName
    }.getOrDefault(false)

    fun cancelMeteredDownloadPrompt() {
        val update = updateUiState.activeUpdate ?: return
        updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Available(update)
    }

    fun triggerUpdateInstall(context: Context) {
        val (update, path) = when (val current = updateUiState) {
            is br.com.fsyrp2.app.update.AppUpdateUiState.ReadyToInstall -> current.update to current.apkFilePath
            is br.com.fsyrp2.app.update.AppUpdateUiState.NeedsInstallPermission -> current.update to current.apkFilePath
            else -> return
        }
        if (!br.com.fsyrp2.app.update.AppUpdateInstaller.canRequestPackageInstalls(context)) {
            updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.NeedsInstallPermission(update, path)
            return
        }
        // Toque da pessoa (tela aberta): instalador padrão do Android, que mostra a confirmação
        // de forma confiável. A sessão silenciosa fica para a instalação automática.
        if (context is android.app.Activity) {
            if (br.com.fsyrp2.app.update.AppUpdateInstaller.openSystemInstaller(context, java.io.File(path))) {
                updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.ReadyToInstall(update, path)
                return
            }
        }
        updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Installing(update)
        br.com.fsyrp2.app.update.AppUpdateInstallReceiver.listener = { status, message, confirmIntent ->
            scope.launch {
                when {
                    confirmIntent != null -> pendingInstallConfirmation = confirmIntent
                    status != android.content.pm.PackageInstaller.STATUS_SUCCESS -> {
                        // "Tentar de novo" leva direto a "Instalar" com o arquivo já conferido (instalador padrão).
                        updatePrefs.consumePendingInstallError()
                        updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Error(message ?: "Toque em Instalar para abrir o instalador do Android.", update)
                    }
                }
            }
        }
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    br.com.fsyrp2.app.update.AppUpdateInstaller.startPackageInstallerSession(context, java.io.File(path), update)
                }
            }.onFailure {
                updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Error("Não foi possível iniciar a instalação. Tente de novo.", update)
            }
        }
    }

    fun openInstallPermissionSettings(context: Context) {
        if (!br.com.fsyrp2.app.update.AppUpdateInstaller.openUnknownSourcesSettings(context)) {
            updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Error(
                "Abra Configurações › Apps › FSY e permita instalar apps desta fonte.",
                updateUiState.activeUpdate,
            )
        }
    }

    /** Ao voltar das configurações de permissão: se já pode instalar, segue sozinho. */
    fun resumeUpdateAfterPermission() {
        val current = updateUiState
        if (current is br.com.fsyrp2.app.update.AppUpdateUiState.NeedsInstallPermission && br.com.fsyrp2.app.update.AppUpdateInstaller.canRequestPackageInstalls(appContext)) {
            updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.ReadyToInstall(current.update, current.apkFilePath)
            triggerUpdateInstall(appContext)
        }
    }

    fun retryUpdateAction() {
        val update = updateUiState.activeUpdate
        val saved = lastVerifiedApk
        if (update != null && saved != null && saved.first.versionCode == update.versionCode && java.io.File(saved.second).exists()) {
            // Arquivo já baixado e conferido: vai direto para "Instalar".
            updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.ReadyToInstall(update, saved.second)
            return
        }
        if (update == null) {
            checkForAppUpdate(force = true)
        } else {
            updateUiState = br.com.fsyrp2.app.update.AppUpdateUiState.Available(update)
            startUpdateDownload(allowMetered = false)
        }
    }

    fun dismissPostUpdateNotice() {
        updatePrefs.markPostUpdateNoticeDismissed()
        postUpdateNotice = null
    }

    fun updateAutoUpdatePreference(enabled: Boolean) {
        updatePrefs.autoUpdateEnabled = enabled
        autoUpdateEnabled = enabled
    }

    fun dispose() {
        closeRegistrationAuthorizationEditor()
        networkCallback?.let { cb ->
            val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            runCatching { cm?.unregisterNetworkCallback(cb) }
        }
        networkCallback = null
        scope.cancel()
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
        readAnnouncementIds = keyStore.loadReadAnnouncementIds(stored.userId).orEmpty()
        restoreOfflineSnapshot(stored.userId)
        isBootstrapping = false
        refreshCoreData()
    }

    private fun restoreOfflineSnapshot(userId: String) {
        val snap = offlineCache.load(userId) ?: return
        // O papel salvo não concede acesso: precisa ser confirmado nesta sessão pelo servidor.
        profile = snap.profile?.copy(role = "jovem")
        company = snap.company
        companyWhatsapp = snap.companyWhatsapp?.takeIf { snap.company != null || !snap.profile?.companyId.isNullOrBlank() }
        rawScheduleItems = snap.scheduleItems
        announcements = snap.announcements
        if (snap.savedAtEpochMs > 0L) lastSyncedAtLabel = syncLabel(Instant.ofEpochMilli(snap.savedAtEpochMs))
    }

    private fun syncLabel(at: Instant): String {
        val zoned = at.atZone(EventCalendar.EVENT_ZONE)
        val today = ZonedDateTime.now(EventCalendar.EVENT_ZONE).toLocalDate()
        return if (zoned.toLocalDate() == today) zoned.format(DateTimeFormatter.ofPattern("HH:mm"))
        else zoned.format(DateTimeFormatter.ofPattern("dd/MM 'às' HH:mm"))
    }

    // --- Navegação ---------------------------------------------------------------------------

    /** Abre uma tela empilhada respeitando o papel. Destinos de equipe nunca abrem para jovem. */
    fun open(destination: OverlayDestination) {
        val allowed = when (destination) {
            is OverlayDestination.CounselorPanel -> canOpenCounselorPanel
            is OverlayDestination.AdminHub -> canOpenAdmin &&
                (destination.initialModule == null || destination.initialModule in adminModules)
            else -> true
        }
        if (allowed) {
            overlayDestination = destination
        } else {
            overlayDestination = OverlayDestination.None
            selectedTab = MainTab.HOME
        }
    }

    fun closeOverlay() {
        closeRegistrationAuthorizationEditor()
        if (overlayDestination != OverlayDestination.None) selectedTab = MainTab.MORE
        overlayDestination = OverlayDestination.None
    }

    fun openProfile() {
        closeRegistrationAuthorizationEditor()
        overlayDestination = OverlayDestination.None
        selectedTab = MainTab.MORE
    }

    /** Abre a Agenda já no dia e na atividade tocada no Início. */
    fun openAgendaAt(itemId: String?) {
        focusedScheduleItemId = itemId
        overlayDestination = OverlayDestination.None
        selectedTab = MainTab.AGENDA
    }

    fun openAnnouncement(id: String?) {
        focusedAnnouncementId = id
        overlayDestination = OverlayDestination.None
        selectedTab = MainTab.ANNOUNCEMENTS
    }

    fun consumeFocusedAnnouncement() {
        focusedAnnouncementId = null
    }

    fun consumeFocusedScheduleItem() {
        focusedScheduleItemId = null
    }

    fun editRegistrationAuthorization(record: RegistrationRecordDto) {
        if (profile == null || profile?.isSuspended == true || !effectiveRole.canManageRegistrations) return
        registrationAuthorizationEditor = RegistrationAuthorizationEditorState(record)
    }

    fun updateRegistrationAuthorizationField(key: String, value: String) {
        val editor = registrationAuthorizationEditor ?: return
        if (profile == null || profile?.isSuspended == true || !effectiveRole.canManageRegistrations) {
            closeRegistrationAuthorizationEditor()
            return
        }
        if (key in editor.draft && value.length <= 2000) {
            registrationAuthorizationEditor = editor.copy(draft = editor.draft + (key to value))
        }
    }

    fun acceptSavedRegistrationAuthorization(record: RegistrationRecordDto) {
        if (registrationAuthorizationEditor?.record?.id != record.id) return
        if (profile == null || profile?.isSuspended == true || !effectiveRole.canManageRegistrations) {
            closeRegistrationAuthorizationEditor()
            return
        }
        registrationAuthorizationEditor = RegistrationAuthorizationEditorState(record)
    }

    fun closeRegistrationAuthorizationEditor() {
        registrationAuthorizationEditor = null
    }

    fun markAnnouncementsRead(ids: Collection<String>) {
        val current = session ?: return
        val updated = readAnnouncementIds + ids
        if (updated.size == readAnnouncementIds.size) return
        readAnnouncementIds = updated
        keyStore.saveReadAnnouncementIds(current.userId, updated)
    }

    // --- Sessão ------------------------------------------------------------------------------

    suspend fun withValidSession(): UserSession {
        val current = session ?: throw ApiException(401, "Sua sessão terminou. Entre novamente.")
        val expectedGeneration = sessionGeneration
        if (!SessionTokens.needsRefresh(current)) return current
        return try {
            val refreshed = SessionTokens.valid(keyStore, apiClient, current.userId)
            if (session?.userId == refreshed.userId) session = refreshed
            refreshed
        } catch (e: SessionTokens.SessionEndedException) {
            if (sessionGeneration == expectedGeneration && session?.userId == current.userId) {
                authError = "Sua sessão terminou. Entre novamente."
                performImmediateLogoutCleanup(previousSession = current, revokeAllPush = false)
            }
            throw ApiException(401, "Sua sessão terminou. Entre novamente.")
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
                authError = if (e.statusCode == 400 || e.statusCode == 401) {
                    if (e.message.contains("Confirme", ignoreCase = true) || e.message.contains("Muitas", ignoreCase = true)) e.message
                    else "E-mail ou senha incorretos."
                } else e.message
            } catch (_: Exception) {
                authError = "Sem conexão com o servidor. Verifique sua internet e tente novamente."
            } finally {
                isAuthenticating = false
            }
        }
    }

    fun signUp(email: String, password: String, fullName: String, stake: String) {
        if (fullName.trim().length < 3) {
            authError = "Informe seu nome completo."
            return
        }
        if (email.isBlank() || !email.contains("@")) {
            authError = "Informe um e-mail válido."
            return
        }
        PasswordPolicy.validate(password)?.let {
            authError = it
            return
        }
        isAuthenticating = true
        authError = null
        authInfoMessage = null
        scope.launch {
            try {
                val result = apiClient.signUpWithPassword(email, password, fullName, stake)
                if (result.session != null) {
                    applyNewAuthenticatedSession(result.session)
                } else {
                    authInfoMessage = "Cadastro feito! Confirme pelo link que enviamos ao seu e-mail e depois entre."
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
                authInfoMessage = apiClient.requestPasswordRecovery(email)
            } catch (e: ApiException) {
                authError = e.message
            } catch (_: Exception) {
                authError = "Não foi possível pedir o link agora. Verifique sua conexão."
            } finally {
                isAuthenticating = false
            }
        }
    }

    fun buildGoogleOAuthUri(): Uri? {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        if (base.isBlank()) {
            authError = "A entrada com Google não está disponível nesta versão."
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
                    authError = "A entrada com Google foi cancelada ou não terminou. Tente de novo."
                    return
                }
                val code = target.code?.takeIf { it.isNotBlank() } ?: run {
                    authError = "A entrada com Google não terminou. Tente de novo."
                    return
                }
                val verifier = keyStore.consumePkceVerifier(target.state)
                if (verifier == null) {
                    authError = "O pedido de entrada expirou. Toque em Entrar com Google de novo."
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
                        authError = "Não foi possível concluir a entrada com Google."
                    } finally {
                        isAuthenticating = false
                    }
                }
            }

            is DeepLinkTarget.Navigation -> {
                overlayDestination = OverlayDestination.None
                when (target.tab) {
                    AppTab.INICIO -> selectedTab = MainTab.HOME
                    AppTab.AGENDA -> openAgendaAt(target.itemId)
                    AppTab.AVISOS -> openAnnouncement(target.itemId?.takeIf { it.isNotBlank() })
                    AppTab.PERFIL -> selectedTab = MainTab.MORE
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
            offlineCache.clearAll()
            br.com.fsyrp2.app.ui.components.RemoteImageMemory.clear()
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
        closeRegistrationAuthorizationEditor()
        br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.clearPrivateDocuments(appContext)
        company = null
        companyYouth = emptyList()
        rawScheduleItems = emptyList()
        announcements = emptyList()
        profilePhoto = ProfilePhotoState()
        photoError = null
        photoSuccessMessage = null
        isPhotoBusy = false
        photoReviews = emptyList()
        companyProfilePhotos = emptyMap()
        companyWhatsapp = null
        allCompaniesWhatsapp = emptyList()
        isCompanyWhatsappBusy = false
        companyWhatsappError = null
        companyWhatsappFeedback = null
        photoUrlErrorRetryUsed = false
        companyPhotosErrorRetryUsed = false
        photoReviewsErrorRetryUsed = false
        lastSyncedAtLabel = null
        personalReminderIds = keyStore.loadPersonalReminderIds(newSession.userId)
        notificationPreferences = keyStore.loadNotificationPreferences(newSession.userId)
        readAnnouncementIds = keyStore.loadReadAnnouncementIds(newSession.userId).orEmpty()
        restoreOfflineSnapshot(newSession.userId)
        selectedTab = MainTab.HOME
        overlayDestination = OverlayDestination.None
        FsyWidgetManager.schedulePeriodicSync(appContext)
        refreshCoreData()
    }

    /**
     * Revalida só o perfil, sem apagar formulários ou acionar a carga completa a cada minuto.
     * A leitura é do perfil protegido no servidor; metadados do token não concedem cargos.
     */
    suspend fun refreshProfileAccess() {
        if (isBootstrapping || (isLoading && profile == null) || !profileAccessMutex.tryLock()) return
        try {
            val current = session ?: return
            val expectedGeneration = sessionGeneration
            val expectedUserId = current.userId
            try {
                val validSession = withValidSession()
                val loaded = apiClient.fetchCurrentProfile(validSession)
                currentCoroutineContext().ensureActive()
                if (sessionGeneration != expectedGeneration || session?.userId != expectedUserId || loaded.id != expectedUserId) return
                val previous = profile
                val accessChanged = previous?.role != loaded.role || previous?.companyId != loaded.companyId
                if (accessChanged) {
                    // Impede que respostas iniciadas com a permissão anterior restaurem dados sensíveis.
                    profileAccessRevision += 1
                    activeDataJob?.cancel()
                    companyYouth = emptyList()
                    photoReviews = emptyList()
                    companyProfilePhotos = emptyMap()
                    closeRegistrationAuthorizationEditor()
                    photoSuccessMessage = null
                    br.com.fsyrp2.app.ui.components.RemoteImageMemory.clear()
                    br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.clearPrivateDocuments(appContext)
                    if (previous?.companyId != loaded.companyId) {
                        company = null
                        companyWhatsapp = null
                    }
                    if (!loaded.roleEnum.isStaff) {
                        allCompaniesWhatsapp = emptyList()
                    }
                    announcements = emptyList()
                }
                profile = loaded
                if (accessChanged) {
                    if (!loaded.roleEnum.isStaff) {
                        rawScheduleItems = ScheduleVisibility.visibleTo(rawScheduleItems, loaded.roleEnum)
                        personalReminderIds = personalReminderIds.intersect(rawScheduleItems.map { it.id }.toSet())
                        keyStore.savePersonalReminderIds(expectedUserId, personalReminderIds)
                    }
                    // Reaplica o portão de navegação imediatamente, antes de outra resposta de rede.
                    open(overlayDestination)
                    NotificationHelper.cancelAllNotifications(appContext)
                    offlineCache.save(OfflineSnapshot(
                        userId = expectedUserId,
                        savedAtEpochMs = Instant.now().toEpochMilli(),
                        profile = loaded.copy(role = "jovem"),
                        company = company,
                        scheduleItems = scheduleItems,
                        announcements = announcements,
                        companyWhatsapp = companyWhatsapp,
                    ))
                    try {
                        updateWidgetsAndReminders(validSession, scheduleItems, announcements, company)
                    } catch (e: kotlinx.coroutines.CancellationException) {
                        throw e
                    } catch (_: Exception) {
                        // O estado de acesso já foi atualizado; falha do launcher não impede recarregar o app.
                    }
                    if (sessionGeneration == expectedGeneration && session?.userId == expectedUserId) refreshCoreData()
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (sessionGeneration == expectedGeneration && session?.userId == expectedUserId && e.statusCode in listOf(401, 403)) {
                    authError = e.message
                    signOut()
                }
                // Falhas transitórias preservam a tela e os dados já conhecidos.
            } catch (_: Exception) {
                // A próxima retomada ou verificação periódica tenta novamente, sem interromper a tela.
            }
        } finally { profileAccessMutex.unlock() }
    }

    /**
     * Atualiza tudo em paralelo. Cada parte é independente: se o perfil falhar, a agenda e os
     * avisos que chegaram continuam valendo, e o que já estava na tela (ou na cópia local) fica.
     */
    fun refreshCoreData() {
        val currentSession = session ?: return
        val expectedGen = sessionGeneration
        val expectedUserId = currentSession.userId
        val expectedAccessRevision = profileAccessRevision

        activeDataJob?.cancel()
        activeDataJob = scope.launch {
            isLoading = true
            globalBannerError = null
            try {
                val validSession = withValidSession()
                if (sessionGeneration != expectedGen || session?.userId != expectedUserId) return@launch

                coroutineScope {
                    val profileD = async { runCatching { apiClient.fetchCurrentProfile(validSession) } }
                    val scheduleD = async { runCatching { apiClient.fetchSchedule(validSession) } }
                    val announcementsD = async { runCatching { apiClient.fetchAnnouncements(validSession) } }
                    val instagramD = async { runCatching { apiClient.fetchInstagramFeed() }.getOrNull() }
                    val mediaD = async { runCatching { apiClient.fetchPublicMedia(validSession) }.getOrNull() }
                    val photoD = async { runCatching { apiClient.fetchProfilePhoto(validSession) } }
                    val whatsappD = async { runCatching { apiClient.fetchCompanyWhatsapp(validSession) }.getOrNull() }

                    val profileRes = profileD.await()
                    val scheduleRes = scheduleD.await()
                    val announcementsRes = announcementsD.await()
                    val loadedInsta = instagramD.await()
                    val loadedMedia = mediaD.await()
                    val photoRes = photoD.await()
                    val loadedWhatsappList = whatsappD.await()

                    currentCoroutineContext().ensureActive()
                    if (sessionGeneration != expectedGen || session?.userId != expectedUserId || profileAccessRevision != expectedAccessRevision) return@coroutineScope

                    // Conta suspensa ou sessão recusada: aí sim encerra.
                    val profileError = profileRes.exceptionOrNull()
                    if (profileError is ApiException && profileError.statusCode in listOf(401, 403)) {
                        authError = profileError.message
                        signOut()
                        return@coroutineScope
                    }

                    val loadedProfile = profileRes.getOrNull() ?: profile
                    val companyId = loadedProfile?.companyId?.takeIf { it.isNotBlank() }
                    val loadedCompany = if (companyId != null) {
                        runCatching { apiClient.fetchCompany(validSession, companyId) }
                            .getOrElse { company?.takeIf { it.id == companyId } }
                    } else null
                    val staffRole = loadedProfile?.roleEnum?.canAccessCounselorPanel == true
                    val loadedYouth = if (companyId != null && staffRole) {
                        runCatching { apiClient.fetchCompanyYouth(validSession, companyId) }.getOrElse { companyYouth }
                    } else emptyList()
                    val loadedReviews = if (staffRole) {
                        runCatching { apiClient.fetchPhotoReviews(validSession) }.getOrElse { photoReviews }
                    } else emptyList()
                    val approvedPhotos = if (staffRole) {
                        runCatching { apiClient.fetchCompanyProfilePhotos(validSession) }.getOrElse { companyProfilePhotos }
                    } else emptyMap()

                    currentCoroutineContext().ensureActive()
                    if (sessionGeneration != expectedGen || session?.userId != expectedUserId || profileAccessRevision != expectedAccessRevision) return@coroutineScope

                    profile = loadedProfile
                    if (loadedProfile == null || loadedProfile.isSuspended || !loadedProfile.roleEnum.canManageRegistrations) {
                        closeRegistrationAuthorizationEditor()
                        br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.clearPrivateDocuments(appContext)
                    }
                    company = loadedCompany
                    if (companyId != null) {
                        val matchedWhatsapp = loadedWhatsappList?.firstOrNull { it.companyId == companyId }
                            ?: loadedWhatsappList?.firstOrNull()
                        companyWhatsapp = matchedWhatsapp ?: companyWhatsapp?.takeIf { it.companyId == companyId }
                    } else {
                        companyWhatsapp = null
                    }
                    if (loadedWhatsappList != null) {
                        allCompaniesWhatsapp = loadedWhatsappList
                    }
                    companyYouth = loadedYouth
                    photoReviews = loadedReviews
                    companyProfilePhotos = approvedPhotos
                    scheduleRes.getOrNull()?.let { rawScheduleItems = it }
                    announcementsRes.getOrNull()?.let { list ->
                        if (keyStore.loadReadAnnouncementIds(validSession.userId) == null) {
                            // Primeiro uso nesta conta: o que já existia não vira "novo".
                            markAnnouncementsRead(list.map { it.id })
                        }
                        announcements = list
                    }
                    if (loadedInsta != null && loadedInsta.posts.isNotEmpty()) {
                        instagramPosts = loadedInsta.posts
                        instagramProfileUrl = loadedInsta.profileUrl
                    }
                    loadedMedia?.let { publicMediaPhotos = it }
                    photoRes.onSuccess {
                        profilePhoto = it
                        photoUrlErrorRetryUsed = false
                        if (it.approvedUrl != null) {
                            profile = profile?.copy(avatarUrl = it.approvedUrl)
                        }
                    }
                    photoRes.onFailure { err ->
                        if (err is ApiException && err.statusCode in listOf(401, 403)) {
                            photoError = FriendlyErrors.of(err)
                        }
                    }

                    val failures = listOfNotNull(profileError, scheduleRes.exceptionOrNull(), announcementsRes.exceptionOrNull())
                    val anyCoreSuccess = profileRes.isSuccess || scheduleRes.isSuccess || announcementsRes.isSuccess
                    if (anyCoreSuccess) {
                        val nowInstant = Instant.now()
                        lastSyncedAtLabel = syncLabel(nowInstant)
                        offlineCache.save(
                            OfflineSnapshot(
                                userId = validSession.userId,
                                savedAtEpochMs = nowInstant.toEpochMilli(),
                                profile = profile?.copy(role = "jovem"),
                                company = company,
                                scheduleItems = rawScheduleItems,
                                announcements = announcements,
                                companyWhatsapp = companyWhatsapp,
                            )
                        )
                    }
                    if (failures.isNotEmpty()) {
                        globalBannerError = bannerFor(failures)
                    }

                    if (scheduleRes.isSuccess) {
                        updateWidgetsAndReminders(validSession, scheduleItems, announcementsRes.getOrNull(), loadedCompany)
                    }

                    // Registro do aparelho para notificações, em segundo plano.
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
                if (e.statusCode == 401 && session == null) {
                    // Sessão já encerrada por withValidSession.
                } else {
                    globalBannerError = e.message
                }
            } catch (_: kotlinx.coroutines.CancellationException) {
                // Nova atualização começou.
            } catch (_: Exception) {
                globalBannerError = if (isOnline) "Não foi possível atualizar agora." else null
            } finally {
                if (sessionGeneration == expectedGen && activeDataJob == coroutineContext[Job]) {
                    isLoading = false
                }
            }
        }
    }

    /** Sem rede: a faixa "Sem conexão" já explica; outros erros viram uma frase só. */
    private fun bannerFor(failures: List<Throwable>): String? {
        if (failures.all { it is IOException }) {
            return if (isOnline) "Não foi possível atualizar tudo agora. Mostrando o que já estava salvo." else null
        }
        val api = failures.firstOrNull { it is ApiException } as? ApiException
        return api?.message ?: "Não foi possível atualizar tudo agora."
    }

    private suspend fun updateWidgetsAndReminders(
        validSession: UserSession,
        schedule: List<ScheduleItem>,
        loadedAnnouncements: List<Announcement>?,
        loadedCompany: Company?,
    ) {
        val snapshot = WidgetSnapshotDto(
            userId = validSession.userId,
            companyName = loadedCompany?.name,
            updatedAtEpochMs = System.currentTimeMillis(),
            visibleAnnouncementCount = loadedAnnouncements?.size,
            urgentAnnouncementCount = loadedAnnouncements?.count { it.isUrgent },
            isStaff = effectiveRole.isStaff,
            activities = schedule
                .map {
                    WidgetActivitySummaryDto(
                        id = it.id,
                        dayKey = it.dayKey,
                        startTime = it.startTime,
                        endTime = it.endTime,
                        title = it.title,
                        location = it.location,
                        category = it.normalizedCategory,
                    )
                }
        )
        keyStore.saveWidgetSnapshot(snapshot)
        replanReminders()
        FsyWidgetManager.updateAllWidgets(appContext)
        FsyWidgetManager.schedulePeriodicSync(appContext)
    }

    private fun replanReminders(
        reminderIds: Set<String> = personalReminderIds,
        prefs: NotificationChannelPreferencesDto = notificationPreferences,
    ) {
        ScheduleReminderScheduler.replanAllReminders(
            context = appContext,
            scheduleItems = scheduleItems,
            personalReminderIds = reminderIds,
            scheduleRemindersEnabled = prefs.scheduleRemindersEnabled,
            personalRemindersEnabled = prefs.personalRemindersEnabled
        )
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
        replanReminders(reminderIds = updated)
    }

    fun toggleAnnouncementLike(announcementId: String) {
        val expectedGen = sessionGeneration
        val previousList = announcements
        announcements = announcements.map { item ->
            if (item.id == announcementId) {
                val nextLiked = !item.isLikedEffective
                val nextCount = (item.likesCount + if (nextLiked) 1 else -1).coerceAtLeast(0)
                item.copy(likedByMe = nextLiked, isLiked = nextLiked, likesCount = nextCount)
            } else item
        }
        scope.launch {
            try {
                val validSession = withValidSession()
                val res = apiClient.toggleAnnouncementLike(validSession, announcementId)
                if (sessionGeneration != expectedGen) return@launch
                announcements = announcements.map { item ->
                    if (item.id == announcementId) {
                        item.copy(likedByMe = res.liked, isLiked = res.liked, likesCount = res.likesCount)
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
        replanReminders(prefs = newPrefs)
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

    // --- Foto de perfil -----------------------------------------------------------------------

    /** Recorte e envio pertencem ao ViewModel, para sobreviver à rotação. */
    fun submitProfilePhoto(uri: Uri) {
        if (isPhotoBusy) return
        val expectedGen = sessionGeneration
        isPhotoBusy = true
        photoError = null
        photoSuccessMessage = null
        scope.launch {
            try {
                val bytes = withContext(Dispatchers.IO) {
                    br.com.fsyrp2.app.data.PhotoProcessor.squareJpeg(appContext, uri)
                } ?: throw IllegalArgumentException("Imagem inválida")
                if (sessionGeneration != expectedGen) return@launch
                val result = apiClient.uploadProfilePhoto(withValidSession(), bytes)
                if (sessionGeneration == expectedGen) {
                    profilePhoto = result
                    photoUrlErrorRetryUsed = false
                    if (result.approvedUrl != null) {
                        profile = profile?.copy(avatarUrl = result.approvedUrl)
                        session?.userId?.let { uid ->
                            if (canReviewPhotos) companyProfilePhotos = companyProfilePhotos + (uid to result.approvedUrl)
                        }
                    }
                    photoSuccessMessage = result.uploadMessageFor(effectiveRole)
                }
            } catch (e: Exception) {
                if (sessionGeneration == expectedGen) photoError = FriendlyErrors.of(e, "Não foi possível usar essa foto. Tente outra imagem.")
            } finally {
                if (sessionGeneration == expectedGen) isPhotoBusy = false
            }
        }
    }

    fun refreshProfilePhoto(fromImageError: Boolean = false) {
        if (session == null) return
        if (fromImageError) {
            if (photoUrlErrorRetryUsed) return
            photoUrlErrorRetryUsed = true
        } else {
            photoUrlErrorRetryUsed = false
        }
        val expectedGen = sessionGeneration
        scope.launch {
            runCatching { apiClient.fetchProfilePhoto(withValidSession()) }
                .onSuccess {
                    if (sessionGeneration == expectedGen) {
                        profilePhoto = it
                        if (it.approvedUrl != null) {
                            profile = profile?.copy(avatarUrl = it.approvedUrl)
                        }
                    }
                }
                .onFailure { err ->
                    if (sessionGeneration == expectedGen && err is ApiException && err.statusCode in listOf(401, 403)) {
                        photoError = FriendlyErrors.of(err)
                    }
                }
            profilePhotoFetchCount += 1
        }
    }

    fun uploadProfilePhoto(jpegBytes: ByteArray) {
        val expectedGen = sessionGeneration
        isPhotoBusy = true
        photoError = null
        photoSuccessMessage = null
        scope.launch {
            try {
                val result = apiClient.uploadProfilePhoto(withValidSession(), jpegBytes)
                if (sessionGeneration == expectedGen) {
                    profilePhoto = result
                    photoUrlErrorRetryUsed = false
                    if (result.approvedUrl != null) {
                        profile = profile?.copy(avatarUrl = result.approvedUrl)
                        session?.userId?.let { uid ->
                            if (canReviewPhotos) companyProfilePhotos = companyProfilePhotos + (uid to result.approvedUrl)
                        }
                    }
                    photoSuccessMessage = result.uploadMessageFor(effectiveRole)
                }
            } catch (e: Exception) {
                if (sessionGeneration == expectedGen) photoError = FriendlyErrors.of(e, "Não foi possível enviar a foto agora.")
            } finally {
                isPhotoBusy = false
            }
        }
    }

    fun removeProfilePhoto(scopeName: String) {
        val expectedGen = sessionGeneration
        isPhotoBusy = true
        photoError = null
        photoSuccessMessage = null
        scope.launch {
            try {
                val result = apiClient.deleteProfilePhoto(withValidSession(), scopeName)
                if (sessionGeneration == expectedGen) {
                    profilePhoto = result
                    photoUrlErrorRetryUsed = false
                    if (scopeName == "approved" || result.approvedUrl == null) {
                        profile = profile?.copy(avatarUrl = result.approvedUrl)
                    }
                    photoSuccessMessage = if (scopeName == "pending") "Envio cancelado." else "Foto removida."
                }
            } catch (e: Exception) {
                if (sessionGeneration == expectedGen) photoError = FriendlyErrors.of(e)
            } finally {
                isPhotoBusy = false
            }
        }
    }

    fun reportPhotoError(message: String) {
        photoError = message
    }

    fun refreshPhotoReviews(fromImageError: Boolean = false) {
        if (!canReviewPhotos) return
        if (fromImageError) {
            if (photoReviewsErrorRetryUsed) return
            photoReviewsErrorRetryUsed = true
        } else {
            photoReviewsErrorRetryUsed = false
        }
        val expectedGen = sessionGeneration
        val expectedAccessRevision = profileAccessRevision
        scope.launch {
            runCatching { apiClient.fetchPhotoReviews(withValidSession()) }
                .onSuccess { if (sessionGeneration == expectedGen && profileAccessRevision == expectedAccessRevision && canReviewPhotos) photoReviews = it }
                .onFailure { err ->
                    if (sessionGeneration == expectedGen && err is ApiException && err.statusCode in listOf(401, 403)) {
                        photoError = FriendlyErrors.of(err)
                    }
                }
        }
    }

    fun refreshCompanyProfilePhotos(fromImageError: Boolean = false) {
        if (!canReviewPhotos) return
        if (fromImageError) {
            if (companyPhotosErrorRetryUsed) return
            companyPhotosErrorRetryUsed = true
        } else {
            companyPhotosErrorRetryUsed = false
        }
        val expectedGen = sessionGeneration
        val expectedAccessRevision = profileAccessRevision
        scope.launch {
            runCatching { apiClient.fetchCompanyProfilePhotos(withValidSession()) }
                .onSuccess { if (sessionGeneration == expectedGen && profileAccessRevision == expectedAccessRevision && canReviewPhotos) companyProfilePhotos = it }
                .onFailure { err ->
                    if (sessionGeneration == expectedGen && err is ApiException && err.statusCode in listOf(401, 403)) {
                        photoError = FriendlyErrors.of(err)
                    }
                }
        }
    }

    /** Aprova ou recusa uma foto. [onDone] recebe null em sucesso ou a mensagem de erro. */
    fun reviewPhoto(userId: String, approve: Boolean, note: String?, onDone: (String?) -> Unit) {
        if (!canReviewPhotos) {
            onDone("Você não tem acesso a esta ação.")
            return
        }
        val expectedGen = sessionGeneration
        scope.launch {
            try {
                apiClient.reviewProfilePhoto(withValidSession(), userId, approve, note)
                if (sessionGeneration == expectedGen) {
                    photoReviews = photoReviews.filterNot { it.userId == userId }
                }
                onDone(null)
                refreshPhotoReviews()
                refreshCompanyProfilePhotos()
            } catch (e: Exception) {
                onDone(FriendlyErrors.of(e))
            }
        }
    }

    // --- Link do Grupo de WhatsApp da Companhia -----------------------------------------------

    fun clearCompanyWhatsappMessages() {
        companyWhatsappError = null
        companyWhatsappFeedback = null
    }

    fun refreshCompanyWhatsapp() {
        if (session == null) return
        val expectedGen = sessionGeneration
        val expectedAccessRevision = profileAccessRevision
        scope.launch {
            runCatching { apiClient.fetchCompanyWhatsapp(withValidSession()) }
                .onSuccess { list ->
                    if (sessionGeneration == expectedGen && profileAccessRevision == expectedAccessRevision) {
                        allCompaniesWhatsapp = list
                        val companyId = profile?.companyId?.takeIf { it.isNotBlank() } ?: company?.id
                        companyWhatsapp = if (companyId != null) {
                            list.firstOrNull { it.companyId == companyId } ?: list.firstOrNull()
                        } else null
                    }
                }
                .onFailure { err ->
                    if (sessionGeneration == expectedGen && err is ApiException && err.statusCode in listOf(401, 403)) {
                        companyWhatsappError = FriendlyErrors.of(err)
                    }
                }
        }
    }

    fun saveCompanyWhatsappLink(
        companyId: String,
        rawInviteUrl: String?,
        onDone: ((String?) -> Unit)? = null,
    ) {
        val trimmed = rawInviteUrl?.trim().orEmpty()
        val normalized: String? = if (trimmed.isEmpty()) {
            null
        } else {
            WhatsappInviteValidator.normalizeWhatsappInvite(trimmed) ?: run {
                val msg = "Informe um link válido do WhatsApp (https://chat.whatsapp.com/...)."
                companyWhatsappError = msg
                onDone?.invoke(msg)
                return
            }
        }
        val expectedGen = sessionGeneration
        isCompanyWhatsappBusy = true
        companyWhatsappError = null
        companyWhatsappFeedback = null
        scope.launch {
            try {
                val validSession = withValidSession()
                val updated = apiClient.saveCompanyWhatsapp(validSession, companyId, normalized)
                if (sessionGeneration == expectedGen) {
                    val myCompanyId = profile?.companyId?.takeIf { it.isNotBlank() } ?: company?.id
                    if (myCompanyId == companyId) {
                        companyWhatsapp = updated
                        offlineCache.save(
                            OfflineSnapshot(
                                userId = validSession.userId,
                                savedAtEpochMs = Instant.now().toEpochMilli(),
                                profile = profile?.copy(role = "jovem"),
                                company = company,
                                scheduleItems = rawScheduleItems,
                                announcements = announcements,
                                companyWhatsapp = updated,
                            )
                        )
                    }
                    allCompaniesWhatsapp = if (allCompaniesWhatsapp.any { it.companyId == companyId }) {
                        allCompaniesWhatsapp.map { if (it.companyId == companyId) updated else it }
                    } else {
                        allCompaniesWhatsapp + updated
                    }
                    companyWhatsappFeedback = if (normalized == null) "Link do grupo removido." else "Link do grupo salvo."
                    onDone?.invoke(null)
                }
            } catch (e: Exception) {
                val errText = FriendlyErrors.of(e, "Não foi possível salvar o link do grupo agora.")
                if (sessionGeneration == expectedGen) {
                    companyWhatsappError = errText
                    onDone?.invoke(errText)
                }
            } finally {
                if (sessionGeneration == expectedGen) isCompanyWhatsappBusy = false
            }
        }
    }

    // --- Saída ---------------------------------------------------------------------------------

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
        offlineCache.clearAll()
        br.com.fsyrp2.app.ui.components.RemoteImageMemory.clear()
        sessionGeneration = keyStore.loadLocalSessionGeneration()
        session = null
        profile = null
        closeRegistrationAuthorizationEditor()
        br.com.fsyrp2.app.ui.components.ExternalUrlLauncher.clearPrivateDocuments(appContext)
        company = null
        companyYouth = emptyList()
        rawScheduleItems = emptyList()
        announcements = emptyList()
        publicMediaPhotos = emptyList()
        personalReminderIds = emptySet()
        readAnnouncementIds = emptySet()
        profilePhoto = ProfilePhotoState()
        isPhotoBusy = false
        photoReviews = emptyList()
        companyProfilePhotos = emptyMap()
        photoError = null
        photoSuccessMessage = null
        companyWhatsapp = null
        allCompaniesWhatsapp = emptyList()
        isCompanyWhatsappBusy = false
        companyWhatsappError = null
        companyWhatsappFeedback = null
        photoUrlErrorRetryUsed = false
        companyPhotosErrorRetryUsed = false
        photoReviewsErrorRetryUsed = false
        notificationPreferences = NotificationChannelPreferencesDto()
        overlayDestination = OverlayDestination.None
        selectedTab = MainTab.HOME
        focusedAnnouncementId = null
        focusedScheduleItemId = null
        lastSyncedAtLabel = null
        globalBannerError = null

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

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                scope.launch {
                    val wasOffline = !isOnline
                    isOnline = true
                    if (wasOffline && session != null) refreshCoreData()
                }
            }

            override fun onLost(network: Network) {
                scope.launch { isOnline = false }
            }
        }
        runCatching {
            cm.registerDefaultNetworkCallback(callback)
            networkCallback = callback
        }
    }
}
