package br.com.fsyrp2.app.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.fsyrp2.app.MainActivity
import br.com.fsyrp2.app.R
import br.com.fsyrp2.app.security.DeepLinkParser
import br.com.fsyrp2.app.security.DeepLinkTarget

object NotificationHelper {
    const val CHANNEL_URGENT = "fsy_announcements_urgent"
    const val CHANNEL_ANNOUNCEMENTS = "fsy_announcements"
    const val CHANNEL_SCHEDULE_REMINDERS = "fsy_schedule_reminders"
    const val CHANNEL_PERSONAL_REMINDERS = "fsy_personal_reminders"

    const val STATIC_LOCKSCREEN_TITLE = "FSY RP2: novo aviso"
    const val STATIC_LOCKSCREEN_BODY = "Abra o aplicativo FSY para ler o comunicado."

    fun ensureChannelsCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val urgentChannel = NotificationChannel(
            CHANNEL_URGENT,
            "Avisos urgentes da coordenação",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alertas imediatos de segurança, transporte ou mudança crítica de programação."
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
        }

        val regularChannel = NotificationChannel(
            CHANNEL_ANNOUNCEMENTS,
            "Comunicados da sessão e companhia",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Avisos gerais da sessão e recados dos conselheiros da sua companhia."
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
        }

        val scheduleChannel = NotificationChannel(
            CHANNEL_SCHEDULE_REMINDERS,
            "Próxima atividade da agenda",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Lembrete local 10 minutos antes das atividades oficiais de 06 a 10/02/2027."
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
        }

        val personalChannel = NotificationChannel(
            CHANNEL_PERSONAL_REMINDERS,
            "Meus lembretes",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Atividades que você marcou com 'Lembrar-me 10 min antes'."
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
        }

        manager.createNotificationChannels(
            listOf(urgentChannel, regularChannel, scheduleChannel, personalChannel)
        )
    }

    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }

    fun showAnnouncementNotification(
        context: Context,
        announcementId: String,
        title: String,
        body: String,
        isUrgent: Boolean,
        rawDeepLink: String?
    ) {
        if (!hasNotificationPermission(context)) return
        ensureChannelsCreated(context)

        val channelId = if (isUrgent) CHANNEL_URGENT else CHANNEL_ANNOUNCEMENTS
        val safeUri = sanitizeDeepLinkUri(rawDeepLink, fallback = "fsyrp2://portal/announcements/$announcementId")
        val pendingIntent = buildDeepLinkPendingIntent(context, safeUri, announcementId.hashCode())

        val publicNotification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(STATIC_LOCKSCREEN_TITLE)
            .setContentText(STATIC_LOCKSCREEN_BODY)
            .setPriority(if (isUrgent) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title.ifBlank { STATIC_LOCKSCREEN_TITLE })
            .setContentText(body.ifBlank { STATIC_LOCKSCREEN_BODY })
            .setStyle(NotificationCompat.BigTextStyle().bigText(body.ifBlank { STATIC_LOCKSCREEN_BODY }))
            .setPriority(if (isUrgent) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicNotification)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(
                ("ann_$announcementId").hashCode(),
                notification
            )
        } catch (_: SecurityException) {
            // Permissão revogada entre a checagem e o disparo
        }
    }

    fun showScheduleReminderNotification(
        context: Context,
        activityId: String,
        startTime: String,
        title: String,
        location: String?,
        isPersonalReminder: Boolean
    ) {
        if (!hasNotificationPermission(context)) return
        ensureChannelsCreated(context)

        val channelId = if (isPersonalReminder) CHANNEL_PERSONAL_REMINDERS else CHANNEL_SCHEDULE_REMINDERS
        val pendingIntent = buildDeepLinkPendingIntent(
            context,
            Uri.parse("fsyrp2://agenda"),
            ("sched_$activityId").hashCode()
        )

        val publicNotification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("FSY RP2: próxima atividade em 10 min")
            .setContentText("Toque para abrir a agenda oficial da sessão.")
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        val subtitle = buildString {
            append("Início às ")
            append(startTime.take(5))
            if (!location.isNullOrBlank()) {
                append(" • ")
                append(location)
            }
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicNotification)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(
                ("sched_$activityId").hashCode(),
                notification
            )
        } catch (_: SecurityException) {
            // Permissão revogada
        }
    }

    fun cancelAllNotifications(context: Context) {
        try {
            NotificationManagerCompat.from(context).cancelAll()
        } catch (_: Exception) {
            // Ignora falhas de serviço do sistema
        }
    }

    private fun sanitizeDeepLinkUri(rawDeepLink: String?, fallback: String): Uri {
        val candidate = rawDeepLink?.trim().orEmpty()
        val parsed = DeepLinkParser.parse(candidate)
        return if (parsed is DeepLinkTarget.Navigation) {
            Uri.parse(candidate)
        } else {
            Uri.parse(fallback)
        }
    }

    private fun buildDeepLinkPendingIntent(
        context: Context,
        uri: Uri,
        requestCode: Int
    ): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = uri
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
