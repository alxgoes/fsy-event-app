package br.com.fsyrp2.app.notifications

import android.content.Context
import androidx.work.*
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.security.KeystoreSessionStore
import br.com.fsyrp2.app.security.SessionTokens
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** O trabalho persiste no sistema após a destruição do serviço FCM. */
class FsyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        WorkManager.getInstance(applicationContext).enqueue(
            OneTimeWorkRequestBuilder<FsyPushWorker>()
                .setInputData(workDataOf("register" to true))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
        )
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (data["type"] != "fsy_announcement" || data["announcementId"].isNullOrBlank()) return
        val store = KeystoreSessionStore(applicationContext)
        if (!store.isValidIncomingFcmBinding(data["targetUserId"], data["deviceId"], data["bindingGeneration"])) return
        WorkManager.getInstance(applicationContext).enqueue(
            OneTimeWorkRequestBuilder<FsyPushWorker>()
                .setInputData(workDataOf(
                    "announcementId" to data["announcementId"], "targetUserId" to data["targetUserId"],
                    "deviceId" to data["deviceId"], "bindingGeneration" to data["bindingGeneration"],
                ))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
        )
    }
}

class FsyPushWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val store = KeystoreSessionStore(applicationContext)
        val stored = store.loadSession() ?: return Result.success()
        val api = PortalApiClient()
        fun validBinding() = store.isValidIncomingFcmBinding(
            inputData.getString("targetUserId"), inputData.getString("deviceId"), inputData.getString("bindingGeneration")
        )
        return try {
            if (!inputData.getBoolean("register", false) && !validBinding()) return Result.success()
            val session = SessionTokens.valid(store, api, stored.userId)
            if (inputData.getBoolean("register", false)) {
                PushTokenManager.syncDeviceRegistration(applicationContext, session, api, store)
                return Result.success()
            }
            val id = inputData.getString("announcementId") ?: return Result.success()
            val announcement = api.fetchAnnouncements(session).firstOrNull { it.id == id } ?: return Result.success()
            if (!validBinding()) return Result.success()
            val prefs = store.loadNotificationPreferences(session.userId)
            if (!prefs.announcementsEnabled || (prefs.urgentOnly && !announcement.isUrgent)) return Result.success()
            if (!announcement.isUrgent && EventCalendar.isWithinQuietHours(
                    quietStart = prefs.quietHoursStart, quietEnd = prefs.quietHoursEnd
                )) return Result.success()
            NotificationHelper.showAnnouncementNotification(
                applicationContext, id, announcement.title, announcement.content, announcement.isUrgent,
                rawDeepLink = "fsyrp2://avisos?item=$id",
            )
            Result.success()
        } catch (_: SessionTokens.SessionEndedException) {
            Result.success()
        } catch (_: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }
}
