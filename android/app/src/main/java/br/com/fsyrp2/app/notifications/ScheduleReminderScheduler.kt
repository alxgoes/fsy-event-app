package br.com.fsyrp2.app.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.ScheduleItem
import br.com.fsyrp2.app.security.KeystoreSessionStore
import java.time.Instant
import java.time.LocalDateTime

object ScheduleReminderScheduler {
    private const val PREFS_ALARM_KEYS = "fsy_rp2_scheduled_alarms"
    private const val KEY_ACTIVE_ALARM_IDS = "active_alarm_ids"
    private const val REMINDER_LEAD_MINUTES = 10L
    private const val WINDOW_LENGTH_MS = 3 * 60 * 1000L // Janela de 3 minutos sem exigir exact alarm

    fun replanAllReminders(
        context: Context,
        scheduleItems: List<ScheduleItem>,
        personalReminderIds: Set<String>,
        scheduleRemindersEnabled: Boolean,
        personalRemindersEnabled: Boolean
    ) {
        cancelAllReminders(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val nowEpochMs = System.currentTimeMillis()
        val scheduledIds = mutableSetOf<String>()

        for (item in scheduleItems) {
            val isPersonal = personalReminderIds.contains(item.id)
            val shouldSchedule = (isPersonal && personalRemindersEnabled) ||
                (!isPersonal && scheduleRemindersEnabled && item.dayKey != "dia0")
            if (!shouldSchedule) continue

            val eventDate = EventCalendar.DAY_DATES[item.dayKey] ?: continue
            val startTime = EventCalendar.parseTime(item.startTime) ?: continue
            val triggerZoned = LocalDateTime.of(eventDate, startTime)
                .atZone(EventCalendar.EVENT_ZONE)
                .minusMinutes(REMINDER_LEAD_MINUTES)
            val triggerEpochMs = triggerZoned.toInstant().toEpochMilli()

            // Agenda apenas lembretes futuros
            if (triggerEpochMs <= nowEpochMs) continue

            val pendingIntent = buildReminderPendingIntent(
                context = context,
                activityId = item.id,
                startTime = item.startTime,
                title = item.title,
                location = item.location,
                isPersonal = isPersonal,
                flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            ) ?: continue

            alarmManager.setWindow(
                AlarmManager.RTC_WAKEUP,
                triggerEpochMs,
                WINDOW_LENGTH_MS,
                pendingIntent
            )
            scheduledIds.add(item.id)
        }

        context.getSharedPreferences(PREFS_ALARM_KEYS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_ACTIVE_ALARM_IDS, scheduledIds)
            .apply()
    }

    fun cancelAllReminders(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        val prefs = context.getSharedPreferences(PREFS_ALARM_KEYS, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet(KEY_ACTIVE_ALARM_IDS, emptySet()).orEmpty()
        for (id in ids) {
            val pi = buildReminderPendingIntent(
                context = context,
                activityId = id,
                startTime = "",
                title = "",
                location = null,
                isPersonal = false,
                flags = PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pi != null) {
                alarmManager?.cancel(pi)
                pi.cancel()
            }
        }
        prefs.edit().remove(KEY_ACTIVE_ALARM_IDS).apply()
    }

    fun replanFromCachedSnapshot(context: Context) {
        val keyStore = KeystoreSessionStore(context)
        val session = keyStore.loadSession() ?: run {
            cancelAllReminders(context)
            return
        }
        val snapshot = keyStore.loadWidgetSnapshot() ?: return
        val prefs = keyStore.loadNotificationPreferences(session.userId)
        val personalIds = keyStore.loadPersonalReminderIds(session.userId)
        val scheduleItems = snapshot.activities.map {
            ScheduleItem(
                id = it.id,
                day = it.dayKey,
                startTime = it.startTime,
                endTime = it.endTime.orEmpty(),
                title = it.title,
                location = it.location.orEmpty()
            )
        }
        replanAllReminders(
            context = context,
            scheduleItems = scheduleItems,
            personalReminderIds = personalIds,
            scheduleRemindersEnabled = prefs.scheduleRemindersEnabled,
            personalRemindersEnabled = prefs.personalRemindersEnabled
        )
    }

    private fun buildReminderPendingIntent(
        context: Context,
        activityId: String,
        startTime: String,
        title: String,
        location: String?,
        isPersonal: Boolean,
        flags: Int
    ): PendingIntent? {
        val intent = Intent(context, ScheduleReminderReceiver::class.java).apply {
            action = ScheduleReminderReceiver.ACTION_FIRE_REMINDER
            putExtra(ScheduleReminderReceiver.EXTRA_ACTIVITY_ID, activityId)
            putExtra(ScheduleReminderReceiver.EXTRA_START_TIME, startTime)
            putExtra(ScheduleReminderReceiver.EXTRA_TITLE, title)
            putExtra(ScheduleReminderReceiver.EXTRA_LOCATION, location)
            putExtra(ScheduleReminderReceiver.EXTRA_IS_PERSONAL, isPersonal)
        }
        return PendingIntent.getBroadcast(
            context,
            ("fsy_rem_$activityId").hashCode(),
            intent,
            flags
        )
    }
}

