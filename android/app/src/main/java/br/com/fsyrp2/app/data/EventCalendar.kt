package br.com.fsyrp2.app.data

import br.com.fsyrp2.app.model.ScheduleDays
import br.com.fsyrp2.app.model.ScheduleItem
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

enum class EventPhase {
    BEFORE,
    DURING,
    AFTER
}

data class EventMoment(
    val phase: EventPhase,
    val current: ScheduleItem?,
    val next: ScheduleItem?,
    val dayLabel: String,
    val selectedDayKey: String = "dia1"
) {
    val currentItem: ScheduleItem? get() = current
    val nextItem: ScheduleItem? get() = next
}

/**
 * Calendário oficial da sessão FSY Ribeirão Preto 2 (06 a 10/02/2027, Equipe 05/02/2027),
 * sempre interpretado no fuso `America/Sao_Paulo` (paridade exata com `EventCalendar.swift` e `scheduleService.ts`).
 */
object EventCalendar {
    val TIME_ZONE: ZoneId = ZoneId.of("America/Sao_Paulo")
    val EVENT_ZONE: ZoneId = TIME_ZONE
    val LOCALE_PT_BR: Locale = Locale.forLanguageTag("pt-BR")

    val DAY_DATES: Map<String, LocalDate> = mapOf(
        "dia0" to LocalDate.of(2027, 2, 5),
        "dia1" to LocalDate.of(2027, 2, 6),
        "dia2" to LocalDate.of(2027, 2, 7),
        "dia3" to LocalDate.of(2027, 2, 8),
        "dia4" to LocalDate.of(2027, 2, 9),
        "dia5" to LocalDate.of(2027, 2, 10)
    )

    val DAY_LABELS: Map<String, String> = mapOf(
        "dia0" to "Sex 05/02 (Equipe)",
        "dia1" to "Sáb 06/02",
        "dia2" to "Dom 07/02",
        "dia3" to "Seg 08/02",
        "dia4" to "Ter 09/02",
        "dia5" to "Qua 10/02"
    )

    val PARTICIPANTS_START: ZonedDateTime = ZonedDateTime.of(2027, 2, 6, 8, 0, 0, 0, TIME_ZONE)
    val PARTICIPANTS_END: ZonedDateTime = ZonedDateTime.of(2027, 2, 10, 23, 59, 59, 0, TIME_ZONE)

    private val TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", LOCALE_PT_BR)
    private val SHORT_DAY_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE dd/MM", LOCALE_PT_BR)
    private val DATE_KEY_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)

    val OFFICIAL_EVENT_DAYS: List<Triple<String, String, String>> = listOf(
        Triple("dia1", "2027-02-06", "Sáb 06/02"),
        Triple("dia2", "2027-02-07", "Dom 07/02"),
        Triple("dia3", "2027-02-08", "Seg 08/02"),
        Triple("dia4", "2027-02-09", "Ter 09/02"),
        Triple("dia5", "2027-02-10", "Qua 10/02")
    )

    fun parseDateTime(dayDate: String, timeStr: String): ZonedDateTime? {
        val cleanDay = dayDate.trim()
        val cleanTime = timeStr.trim()
        if (cleanDay.isEmpty() || cleanTime.isEmpty() || cleanTime == "--") return null
        return try {
            val dParts = cleanDay.split("-").map { it.toInt() }
            val tParts = cleanTime.split(":").map { it.toInt() }
            if (dParts.size != 3 || tParts.size < 2) return null
            val hour = tParts[0]
            val minute = tParts[1]
            if (hour !in 0..23 || minute !in 0..59) return null
            val date = LocalDate.of(dParts[0], dParts[1], dParts[2])
            val time = LocalTime.of(hour, minute)
            ZonedDateTime.of(date, time, TIME_ZONE)
        } catch (_: Exception) {
            null
        }
    }

    fun startOf(item: ScheduleItem): ZonedDateTime? {
        val resolvedDate = item.date.ifBlank { ScheduleDays.dayDates[item.day].orEmpty() }
        return parseDateTime(resolvedDate, item.startTime)
    }

    fun endOf(item: ScheduleItem): ZonedDateTime? {
        val resolvedDate = item.date.ifBlank { ScheduleDays.dayDates[item.day].orEmpty() }
        return parseDateTime(resolvedDate, item.endTime)
    }

    /** Sem fim informado, dura até a próxima atividade; no último item, 60 minutos. */
    fun effectiveEndOf(item: ScheduleItem, items: List<ScheduleItem>): ZonedDateTime? {
        val start = startOf(item) ?: return null
        return endOf(item)?.takeIf { it.isAfter(start) }
            ?: items.asSequence().filter { it.day == item.day }.mapNotNull { startOf(it) }
                .filter { it.isAfter(start) }.minOrNull()
            ?: start.plusHours(1)
    }

    fun dayKey(now: Instant = Instant.now()): String =
        now.atZone(TIME_ZONE).format(DATE_KEY_FMT)

    fun formatTime(instant: Instant = Instant.now()): String =
        instant.atZone(TIME_ZONE).format(TIME_FMT)

    fun formatShortDay(zdt: ZonedDateTime): String =
        zdt.withZoneSameInstant(TIME_ZONE).format(SHORT_DAY_FMT)

    fun daysUntilStart(now: Instant = Instant.now()): Int {
        val fromDate = now.atZone(TIME_ZONE).toLocalDate()
        val toDate = PARTICIPANTS_START.toLocalDate()
        val diff = ChronoUnit.DAYS.between(fromDate, toDate).toInt()
        return diff.coerceAtLeast(0)
    }

    /**
     * Porta exata de `EventClock.moment` (iOS) e `calculateActiveAndNextEvents` (Web).
     * Dia Zero (`dia0`) não entra no cálculo da atividade pública dos participantes;
     * intervalos sem atividade não inventam evento em andamento.
     */
    fun moment(items: List<ScheduleItem>, now: Instant = Instant.now()): EventMoment {
        val list = items
            .filter { it.day != "dia0" && startOf(it) != null }
            .sortedBy { startOf(it)!!.toInstant() }

        val startInstant = PARTICIPANTS_START.toInstant()
        val endInstant = PARTICIPANTS_END.toInstant()

        if (now.isBefore(startInstant)) {
            return EventMoment(
                phase = EventPhase.BEFORE,
                current = null,
                next = list.firstOrNull(),
                dayLabel = "Em Breve • 06 a 10 Fev 2027"
            )
        }
        if (now.isAfter(endInstant)) {
            return EventMoment(
                phase = EventPhase.AFTER,
                current = null,
                next = null,
                dayLabel = "Edição Concluída • FSY 2027"
            )
        }

        val current = list.firstOrNull { item ->
            val s = startOf(item)?.toInstant() ?: return@firstOrNull false
            val e = effectiveEndOf(item, list)?.toInstant() ?: return@firstOrNull false
            !s.isAfter(now) && e.isAfter(now)
        }
        val next = list.firstOrNull { item ->
            val s = startOf(item)?.toInstant() ?: return@firstOrNull false
            s.isAfter(now)
        }
        val today = dayKey(now)
        val day = list.firstOrNull {
            (it.date.ifBlank { ScheduleDays.dayDates[it.day].orEmpty() }) == today
        }?.day
        val label = day?.let { ScheduleDays.fullLabel(it) } ?: "FSY 2027"

        return EventMoment(
            phase = EventPhase.DURING,
            current = current,
            next = next,
            dayLabel = label,
            selectedDayKey = day ?: DAY_DATES.entries.firstOrNull { it.value.toString() == today }?.key ?: "dia1"
        )
    }

    fun moment(items: List<ScheduleItem>, now: ZonedDateTime): EventMoment = moment(items, now.toInstant())

    /**
     * Avalia se `now` cai dentro do intervalo silencioso (`quietHoursStart`..`quietHoursEnd`)
     * interpretado no fuso `America/Sao_Paulo`. Suporta intervalos que cruzam a meia-noite (ex: 22:30 -> 06:30).
     */
    fun isWithinQuietHours(
        now: Instant = Instant.now(),
        quietStart: String?,
        quietEnd: String?
    ): Boolean {
        val start = parseLocalTime(quietStart) ?: return false
        val end = parseLocalTime(quietEnd) ?: return false
        if (start == end) return false

        val localNow = now.atZone(TIME_ZONE).toLocalTime()
        return if (start.isBefore(end)) {
            !localNow.isBefore(start) && localNow.isBefore(end)
        } else {
            // Cruza meia-noite (ex: 22:30 até 06:30)
            !localNow.isBefore(start) || localNow.isBefore(end)
        }
    }

    fun parseLocalTime(hhMm: String?): LocalTime? {
        val clean = hhMm?.trim().orEmpty()
        if (clean.isEmpty()) return null
        val parts = clean.split(":")
        if (parts.size != 2) return null
        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        if (h !in 0..23 || m !in 0..59) return null
        return LocalTime.of(h, m)
    }

    fun parseTime(hhMm: String?): LocalTime? = parseLocalTime(hhMm?.trim()?.take(5))

    fun isWithinQuietHours(now: ZonedDateTime, quietStart: String?, quietEnd: String?): Boolean =
        isWithinQuietHours(now.toInstant(), quietStart, quietEnd)
}
