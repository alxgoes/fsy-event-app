package br.com.fsyrp2.app.ui.components

import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.ScheduleItem
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/** Formatos curtos em pt-BR usados nas telas (tempo relativo, contagens, horários). */
object FsyFormat {
    private val dayMonth = DateTimeFormatter.ofPattern("dd/MM")

    fun parseInstant(iso: String?): Instant? {
        val v = iso?.trim().orEmpty()
        if (v.isEmpty()) return null
        return runCatching { OffsetDateTime.parse(v).toInstant() }.getOrNull()
            ?: runCatching { Instant.parse(v) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(v.replace(" ", "T")).toInstant() }.getOrNull()
    }

    /** "agora", "há 5 min", "há 2 h", "ontem", "06/02". */
    fun relative(iso: String?, now: Instant): String? {
        val at = parseInstant(iso) ?: return null
        val minutes = Duration.between(at, now).toMinutes()
        val zone = EventCalendar.EVENT_ZONE
        return when {
            minutes < 1 -> "agora"
            minutes < 60 -> "há $minutes min"
            minutes < 24 * 60 && at.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate() -> "há ${minutes / 60} h"
            at.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate().minusDays(1) -> "ontem"
            else -> at.atZone(zone).format(dayMonth)
        }
    }

    /** "25 min", "1 h 20 min", "3 dias". */
    fun duration(minutesTotal: Long): String {
        val m = minutesTotal.coerceAtLeast(0)
        return when {
            m < 1 -> "menos de 1 min"
            m < 60 -> "$m min"
            m < 24 * 60 -> {
                val h = m / 60
                val r = m % 60
                if (r == 0L) "$h h" else "$h h $r min"
            }
            else -> {
                val d = m / (24 * 60)
                if (d == 1L) "1 dia" else "$d dias"
            }
        }
    }

    fun hhmm(raw: String): String = raw.trim().take(5)

    fun timeRange(item: ScheduleItem): String {
        val end = item.endTime.trim()
        return if (end.length >= 4 && end != "--") "${hhmm(item.startTime)}–${hhmm(end)}" else hhmm(item.startTime)
    }
}
