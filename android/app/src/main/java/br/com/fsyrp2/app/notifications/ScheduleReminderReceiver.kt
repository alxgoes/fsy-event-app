package br.com.fsyrp2.app.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.security.KeystoreSessionStore

class ScheduleReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> {
                ScheduleReminderScheduler.replanFromCachedSnapshot(context)
            }

            ACTION_FIRE_REMINDER -> {
                val keyStore = KeystoreSessionStore(context)
                val session = keyStore.loadSession() ?: return
                val prefs = keyStore.loadNotificationPreferences(session.userId)
                if (!intent.getBooleanExtra(EXTRA_IS_PERSONAL, false) && EventCalendar.isWithinQuietHours(
                        quietStart = prefs.quietHoursStart,
                        quietEnd = prefs.quietHoursEnd
                    )
                ) {
                    return
                }

                val activityId = intent.getStringExtra(EXTRA_ACTIVITY_ID) ?: return
                // Revalida o item contra a ?ltima agenda filtrada da conta.
                val snapshot = keyStore.loadWidgetSnapshot()?.takeIf { it.userId == session.userId } ?: return
                if (snapshot.activities.none { it.id == activityId }) return
                val startTime = intent.getStringExtra(EXTRA_START_TIME).orEmpty()
                val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
                val location = intent.getStringExtra(EXTRA_LOCATION)
                val isPersonal = intent.getBooleanExtra(EXTRA_IS_PERSONAL, false)

                if (isPersonal && !prefs.personalRemindersEnabled) return
                if (!isPersonal && !prefs.scheduleRemindersEnabled) return

                NotificationHelper.showScheduleReminderNotification(
                    context = context,
                    activityId = activityId,
                    startTime = startTime,
                    title = title.ifBlank { "Próxima atividade da agenda FSY" },
                    location = location,
                    isPersonalReminder = isPersonal
                )
            }
        }
    }

    companion object {
        const val ACTION_FIRE_REMINDER = "br.com.fsyrp2.app.ACTION_FIRE_REMINDER"
        const val EXTRA_ACTIVITY_ID = "extra_activity_id"
        const val EXTRA_START_TIME = "extra_start_time"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_LOCATION = "extra_location"
        const val EXTRA_IS_PERSONAL = "extra_is_personal"
    }
}
