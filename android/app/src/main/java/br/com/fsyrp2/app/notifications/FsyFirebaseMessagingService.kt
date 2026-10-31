package br.com.fsyrp2.app.notifications

import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.security.KeystoreSessionStore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Serviço nativo de recebimento FCM HTTP v1 (somente mensagens `data`).
 *
 * REGRAS DE SEGURANÇA:
 * 1. Valida `targetUserId == activeUserId`, `deviceId == boundDeviceId` e `bindingGeneration == boundGeneration`
 *    no `KeystoreSessionStore` antes de qualquer ação, descartando mensagens atrasadas após logout ou troca de conta.
 * 2. Nunca exibe títulos arbitrários vindos do payload sem antes buscar os dados autenticados em `GET /api/announcements`.
 * 3. Na tela bloqueada (`VISIBILITY_PRIVATE`), sempre exibe o texto estático `"FSY RP2: novo aviso"`.
 */
class FsyFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val appContext = applicationContext
        serviceScope.launch {
            val keyStore = KeystoreSessionStore(appContext)
            val session = keyStore.loadSession() ?: return@launch
            val apiClient = PortalApiClient()
            PushTokenManager.syncDeviceRegistration(
                context = appContext,
                session = session,
                apiClient = apiClient,
                keyStore = keyStore,
                explicitToken = token
            )
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        if (data.isEmpty()) return
        if (data["type"] != "fsy_announcement") return

        val announcementId = data["announcementId"]?.trim().orEmpty()
        if (announcementId.isBlank()) return

        val targetUserId = data["targetUserId"]?.trim()
        val deviceId = data["deviceId"]?.trim()
        val bindingGeneration = data["bindingGeneration"]?.trim()

        val appContext = applicationContext
        val keyStore = KeystoreSessionStore(appContext)
        if (!keyStore.isValidIncomingFcmBinding(targetUserId, deviceId, bindingGeneration)) {
            return
        }

        val session = keyStore.loadSession() ?: return
        val prefs = keyStore.loadNotificationPreferences(session.userId)
        if (!prefs.announcementsEnabled) return

        val priority = data["priority"]?.trim()?.lowercase() ?: "normal"
        val isUrgent = priority == "urgent"
        if (prefs.urgentOnly && !isUrgent) return

        if (!isUrgent && EventCalendar.isWithinQuietHours(
                quietStart = prefs.quietHoursStart,
                quietEnd = prefs.quietHoursEnd
            )
        ) {
            return
        }

        val rawDeepLink = data["deepLink"]
        val genericBody = data["genericBody"] ?: NotificationHelper.STATIC_LOCKSCREEN_BODY

        serviceScope.launch {
            // Revalida vínculo antes e depois do fetch autenticado
            if (!keyStore.isValidIncomingFcmBinding(targetUserId, deviceId, bindingGeneration)) {
                return@launch
            }
            val apiClient = PortalApiClient()
            val matched = try {
                apiClient.fetchAnnouncements(session).firstOrNull { it.id == announcementId }
            } catch (_: Exception) {
                null
            }

            if (!keyStore.isValidIncomingFcmBinding(targetUserId, deviceId, bindingGeneration)) {
                return@launch
            }

            val resolvedTitle = matched?.title ?: NotificationHelper.STATIC_LOCKSCREEN_TITLE
            val resolvedBody = matched?.content ?: genericBody

            NotificationHelper.showAnnouncementNotification(
                context = appContext,
                announcementId = announcementId,
                title = resolvedTitle,
                body = resolvedBody,
                isUrgent = isUrgent || (matched?.isUrgent == true),
                rawDeepLink = rawDeepLink
            )
        }
    }

    override fun onDestroy() {
        serviceScope.cancel()
        super.onDestroy()
    }
}
