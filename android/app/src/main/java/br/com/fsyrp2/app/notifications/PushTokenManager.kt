package br.com.fsyrp2.app.notifications

import android.content.Context
import br.com.fsyrp2.app.BuildConfig
import br.com.fsyrp2.app.model.NotificationChannelPreferencesDto
import br.com.fsyrp2.app.model.RegisteredPushDeviceSummaryDto
import br.com.fsyrp2.app.model.UserSession
import br.com.fsyrp2.app.network.ApiException
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.security.KeystoreSessionStore
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

object PushTokenManager {

    suspend fun syncDeviceRegistration(
        context: Context,
        session: UserSession,
        apiClient: PortalApiClient,
        keyStore: KeystoreSessionStore,
        explicitToken: String? = null
    ): RegisteredPushDeviceSummaryDto? = withContext(Dispatchers.IO) {
        val validSession = runCatching { br.com.fsyrp2.app.security.SessionTokens.valid(keyStore, apiClient, session.userId) }.getOrNull() ?: return@withContext null
        NotificationHelper.ensureChannelsCreated(context)
        val token = explicitToken?.takeIf { it.isNotBlank() } ?: fetchFcmTokenSafely() ?: return@withContext null
        val prefs = keyStore.loadNotificationPreferences(session.userId)
        val initialDeviceId = keyStore.getOrCreateDeviceId(session.userId)

        try {
            val summary = apiClient.registerPushDevice(
                session = validSession,
                deviceId = initialDeviceId,
                fcmToken = token,
                appVersion = BuildConfig.VERSION_NAME,
                preferences = prefs
            )
            if (summary != null) {
                keyStore.savePushBinding(
                    userId = session.userId,
                    deviceId = summary.deviceId,
                    bindingGeneration = summary.bindingGeneration
                )
                keyStore.saveNotificationPreferences(session.userId, summary.preferences)
            }
            summary
        } catch (err: ApiException) {
            // Tratamento de 409 (TOKEN_BOUND_TO_OTHER_ACCOUNT) com rotação única sem loop
            if (err.statusCode == 409) {
                val rotatedToken = rotateFcmTokenSafely() ?: return@withContext null
                val rotatedDeviceId = keyStore.rotateDeviceId(session.userId)
                return@withContext try {
                    val retried = apiClient.registerPushDevice(
                        session = validSession,
                        deviceId = rotatedDeviceId,
                        fcmToken = rotatedToken,
                        appVersion = BuildConfig.VERSION_NAME,
                        preferences = prefs
                    )
                    if (retried != null) {
                        keyStore.savePushBinding(
                            userId = session.userId,
                            deviceId = retried.deviceId,
                            bindingGeneration = retried.bindingGeneration
                        )
                        keyStore.saveNotificationPreferences(session.userId, retried.preferences)
                    }
                    retried
                } catch (_: Exception) {
                    null
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }

    suspend fun updatePreferences(
        session: UserSession,
        preferences: NotificationChannelPreferencesDto,
        apiClient: PortalApiClient,
        keyStore: KeystoreSessionStore
    ): NotificationChannelPreferencesDto = withContext(Dispatchers.IO) {
        val validSession = runCatching { br.com.fsyrp2.app.security.SessionTokens.valid(keyStore, apiClient, session.userId) }.getOrNull() ?: return@withContext preferences
        keyStore.saveNotificationPreferences(session.userId, preferences)
        val deviceId = keyStore.loadBoundDeviceId(session.userId) ?: keyStore.getOrCreateDeviceId(session.userId)
        try {
            val updated = apiClient.updatePushPreferences(validSession, deviceId, preferences)
            if (updated != null) {
                keyStore.saveNotificationPreferences(session.userId, updated.preferences)
                return@withContext updated.preferences
            }
        } catch (_: Exception) {
            // Preferências locais permanecem salvas mesmo offline
        }
        preferences
    }

    suspend fun cleanupOnLogoutOrAccountSwitch(
        context: Context,
        previousSession: UserSession?,
        apiClient: PortalApiClient,
        keyStore: KeystoreSessionStore,
        explicitDeviceId: String? = null,
        revokeAllDevices: Boolean = false
    ) = withContext(Dispatchers.IO) {
        NotificationHelper.cancelAllNotifications(context)
        if (previousSession != null) {
            val deviceId = explicitDeviceId?.takeIf { it.isNotBlank() }
                ?: keyStore.loadBoundDeviceId(previousSession.userId)
                ?: keyStore.getOrCreateDeviceId(previousSession.userId)
            try {
                apiClient.revokePushDevice(
                    session = previousSession,
                    deviceId = deviceId,
                    revokeAll = revokeAllDevices
                )
            } catch (_: Exception) {
                // Continua limpeza local mesmo sem rede
            }
        }
        deleteLocalFcmTokenSafely()
    }

    private fun fetchFcmTokenSafely(): String? {
        return try {
            Tasks.await(FirebaseMessaging.getInstance().token, 10, TimeUnit.SECONDS)
                ?.trim()
                ?.takeIf { it.length >= 20 }
        } catch (_: Exception) {
            null
        }
    }

    private fun rotateFcmTokenSafely(): String? {
        return try {
            Tasks.await(FirebaseMessaging.getInstance().deleteToken(), 10, TimeUnit.SECONDS)
            Tasks.await(FirebaseMessaging.getInstance().token, 10, TimeUnit.SECONDS)
                ?.trim()
                ?.takeIf { it.length >= 20 }
        } catch (_: Exception) {
            null
        }
    }

    private fun deleteLocalFcmTokenSafely() {
        try {
            Tasks.await(FirebaseMessaging.getInstance().deleteToken(), 8, TimeUnit.SECONDS)
        } catch (_: Exception) {
            // Ignora falha caso Play Services esteja indisponível ou sem rede
        }
    }
}
