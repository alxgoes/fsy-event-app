package br.com.fsyrp2.app.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.fsyrp2.app.MainActivity
import br.com.fsyrp2.app.R
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.EventPhase
import br.com.fsyrp2.app.model.ScheduleItem
import br.com.fsyrp2.app.model.WidgetActivitySummaryDto
import br.com.fsyrp2.app.model.WidgetSnapshotDto
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.security.KeystoreSessionStore
import java.util.concurrent.TimeUnit

/*
 * Widgets FSY — "Papel e Arco" na tela inicial.
 *
 * Aparência: acompanham o modo claro/escuro do SISTEMA/launcher (cores dia/noite do Glance),
 * não a preferência manual do app — o launcher desenha o widget fora do processo do app.
 * Privacidade: só agenda pública do evento a partir do snapshot já existente (nada de
 * companhia, quarto ou saúde). Após sair da conta o snapshot é limpo e o widget mostra
 * "Entre no app". Movimento: o Glance 1.1 não anima conteúdo; usamos appWidgetBackground
 * (transição de abertura do launcher no Android 12+) e, no widget "Destaques", páginas
 * RemoteViews/ViewFlipper com entrada/saída e controles manuais (sem laço automático).
 */

private object WColors {
    val paper = ColorProvider(day = Color(0xFFFAF8F5), night = Color(0xFF121B2B))
    val card = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF1A2538))
    val ink = ColorProvider(day = Color(0xFF0F172A), night = Color(0xFFF1F5F9))
    val muted = ColorProvider(day = Color(0xFF475569), night = Color(0xFFB8C3D3))
    val primary = ColorProvider(day = Color(0xFF005E7C), night = Color(0xFF7DE3F4))
    val sun = ColorProvider(day = Color(0xFFFFE48A), night = Color(0xFF3B3316))
    val onSun = ColorProvider(day = Color(0xFF0F172A), night = Color(0xFFFFE48A))
    val nowBg = ColorProvider(day = Color(0xFFD9EFF6), night = Color(0xFF00455C))
    val onNow = ColorProvider(day = Color(0xFF003F55), night = Color(0xFFCDF6FD))
    val urgentBg = ColorProvider(day = Color(0xFFFDECEC), night = Color(0xFF5B1414))
    val onUrgent = ColorProvider(day = Color(0xFF7F1D1D), night = Color(0xFFFECACA))
}

private val DAY_PILLS = listOf(
    Triple("dia1", "Sáb", "06"),
    Triple("dia2", "Dom", "07"),
    Triple("dia3", "Seg", "08"),
    Triple("dia4", "Ter", "09"),
    Triple("dia5", "Qua", "10"),
)

object FsyWidgetManager {
    private const val WORK_NAME = "fsy_rp2_widget_periodic_sync"

    suspend fun updateAllWidgets(context: Context) {
        try {
            NextActivityWidget().updateAll(context)
            EventCalendarWidget().updateAll(context)
            DayAgendaWidget().updateAll(context)
            AnnouncementsWidget().updateAll(context)
        } catch (_: Exception) {
            // Ignora falha caso nenhum widget esteja fixado na tela inicial
        }
        runCatching { FsyHighlightsWidgetProvider.updateAll(context) }
    }

    fun schedulePeriodicSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<WidgetSyncWorker>(30, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    fun cancelPeriodicSync(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }
}

class WidgetSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val keyStore = KeystoreSessionStore(applicationContext)
        val session = keyStore.loadSession() ?: run {
            FsyWidgetManager.updateAllWidgets(applicationContext)
            return Result.success()
        }
        return try {
            val api = PortalApiClient()
            val items = api.fetchSchedule(session)
            val previous = keyStore.loadWidgetSnapshot()?.takeIf { it.userId == session.userId }
            val announcements = runCatching { api.fetchAnnouncements(session) }.getOrNull()
            val snapshot = WidgetSnapshotDto(
                userId = session.userId,
                companyName = previous?.companyName,
                updatedAtEpochMs = System.currentTimeMillis(),
                // Contrato: sem leitura nova, contagens ficam nulas (não reapresentar número antigo como atual).
                visibleAnnouncementCount = announcements?.size,
                urgentAnnouncementCount = announcements?.count { it.isUrgent },
                activities = items
                    .filter { it.dayKey != "dia0" }
                    .map {
                        WidgetActivitySummaryDto(
                            id = it.id,
                            dayKey = it.dayKey,
                            startTime = it.startTime,
                            endTime = it.endTime,
                            title = it.title,
                            location = it.location.orEmpty()
                        )
                    }
            )
            keyStore.saveWidgetSnapshot(snapshot)
            FsyWidgetManager.updateAllWidgets(applicationContext)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class NextActivityWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NextActivityWidget()
}

class EventCalendarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = EventCalendarWidget()
}

class DayAgendaWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = DayAgendaWidget()
}

class AnnouncementsWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AnnouncementsWidget()
}

// --- Dados compartilhados (somente agenda pública do snapshot) --------------------------

internal fun loadWidgetSchedule(context: Context): List<ScheduleItem>? {
    val snapshot = KeystoreSessionStore(context).loadWidgetSnapshot() ?: return null
    return snapshot.activities.map {
        ScheduleItem(
            id = it.id,
            day = it.dayKey,
            startTime = it.startTime,
            endTime = it.endTime.orEmpty(),
            title = it.title,
            location = it.location.orEmpty()
        )
    }
}

internal fun openAgendaIntent(context: Context): Intent =
    Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("fsyrp2://agenda")
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }

internal fun countdownLabel(): String {
    val moment = EventCalendar.moment(emptyList())
    val days = EventCalendar.daysUntilStart()
    return when (moment.phase) {
        EventPhase.BEFORE -> when {
            days <= 0 -> "Começa hoje"
            days == 1 -> "Falta 1 dia"
            else -> "Faltam $days dias"
        }
        EventPhase.DURING -> "Sessão em andamento"
        EventPhase.AFTER -> "Sessão concluída"
    }
}

// --- Peças visuais Glance ----------------------------------------------------------------

@Composable
private fun WidgetFrame(context: Context, description: String, content: @Composable () -> Unit) {
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .cornerRadius(24.dp)
            .background(WColors.paper)
            .clickable(actionStartActivity(openAgendaIntent(context)))
            .semantics { contentDescription = description }
            .padding(14.dp),
    ) { content() }
}

@Composable
private fun WidgetHeader(title: String) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = GlanceModifier.fillMaxWidth()) {
        Image(
            provider = ImageProvider(R.drawable.fsy_official_temple_only),
            contentDescription = null,
            modifier = GlanceModifier.size(width = 14.dp, height = 28.dp).cornerRadius(7.dp),
        )
        Spacer(GlanceModifier.width(8.dp))
        Text(title, style = TextStyle(color = WColors.muted, fontSize = 12.sp, fontWeight = FontWeight.Medium), maxLines = 1)
    }
}

@Composable
private fun SignedOutHint() {
    Text("Entre no app para ver a agenda", style = TextStyle(color = WColors.muted, fontSize = 13.sp))
}

@Composable
private fun ActivityRow(item: ScheduleItem, isCurrent: Boolean, compact: Boolean) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .cornerRadius(14.dp)
            .background(if (isCurrent) WColors.nowBg else WColors.card)
            .padding(horizontal = 10.dp, vertical = if (compact) 6.dp else 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            item.startTime.take(5),
            style = TextStyle(color = if (isCurrent) WColors.onNow else WColors.primary, fontSize = 13.sp, fontWeight = FontWeight.Bold),
            modifier = GlanceModifier.width(46.dp),
        )
        Column(modifier = GlanceModifier.defaultWeight()) {
            Text(
                item.title,
                style = TextStyle(color = if (isCurrent) WColors.onNow else WColors.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium),
                maxLines = if (compact) 1 else 2,
            )
            if (!compact && item.location.isNotBlank()) {
                Text(item.location, style = TextStyle(color = WColors.muted, fontSize = 12.sp), maxLines = 1)
            }
        }
    }
}

// --- 1. Próxima atividade (Agora / A seguir) ------------------------------------------

class NextActivityWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(
        setOf(DpSize(110.dp, 110.dp), DpSize(250.dp, 110.dp), DpSize(250.dp, 220.dp))
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val items = loadWidgetSchedule(context)
        val moment = EventCalendar.moment(items.orEmpty())
        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                val isSmall = size.width < 200.dp
                val description = when {
                    items == null -> "Próxima atividade. Entre no app para ver a agenda."
                    moment.current != null -> "Agora: ${moment.current.title}"
                    moment.next != null -> "A seguir às ${moment.next.startTime.take(5)}: ${moment.next.title}"
                    else -> "Próxima atividade"
                }
                WidgetFrame(context, description) {
                    Column(modifier = GlanceModifier.fillMaxSize()) {
                        WidgetHeader(if (moment.current != null) "Agora" else "A seguir")
                        Spacer(GlanceModifier.height(8.dp))
                        when {
                            items == null -> SignedOutHint()
                            moment.current == null && moment.next == null -> Text(
                                countdownLabel(),
                                style = TextStyle(color = WColors.ink, fontSize = 18.sp, fontWeight = FontWeight.Bold),
                            )
                            isSmall -> {
                                val item = moment.current ?: moment.next!!
                                Text(item.startTime.take(5), style = TextStyle(color = WColors.primary, fontSize = 22.sp, fontWeight = FontWeight.Bold))
                                Text(item.title, style = TextStyle(color = WColors.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium), maxLines = 3)
                            }
                            else -> {
                                moment.current?.let { ActivityRow(it, isCurrent = true, compact = false) }
                                if (moment.current != null && moment.next != null) Spacer(GlanceModifier.height(6.dp))
                                moment.next?.let { ActivityRow(it, isCurrent = false, compact = false) }
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- 2. Agenda do dia ------------------------------------------------------------------

class DayAgendaWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(
        setOf(DpSize(250.dp, 180.dp), DpSize(250.dp, 300.dp))
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val items = loadWidgetSchedule(context)
        val moment = EventCalendar.moment(items.orEmpty())
        val dayKey = moment.selectedDayKey
        val dayItems = items.orEmpty().filter { it.dayKey == dayKey }.sortedBy { it.startTime }
        provideContent {
            GlanceTheme {
                val maxRows = if (LocalSize.current.height >= 280.dp) 6 else 3
                val label = EventCalendar.DAY_LABELS[dayKey] ?: "Agenda"
                WidgetFrame(context, "Agenda de $label, ${dayItems.size} atividades") {
                    Column(modifier = GlanceModifier.fillMaxSize()) {
                        WidgetHeader(label)
                        Spacer(GlanceModifier.height(8.dp))
                        when {
                            items == null -> SignedOutHint()
                            dayItems.isEmpty() -> Text("Sem atividades neste dia", style = TextStyle(color = WColors.muted, fontSize = 13.sp))
                            else -> {
                                // Começa na atividade atual/próxima para o dia "andar" sozinho.
                                val anchor = dayItems.indexOfFirst { it.id == (moment.current?.id ?: moment.next?.id) }.coerceAtLeast(0)
                                dayItems.drop(anchor).take(maxRows).forEach { item ->
                                    ActivityRow(item, isCurrent = item.id == moment.current?.id, compact = true)
                                    Spacer(GlanceModifier.height(4.dp))
                                }
                                val rest = dayItems.size - anchor - maxRows
                                if (rest > 0) {
                                    Text("+$rest no app", style = TextStyle(color = WColors.primary, fontSize = 12.sp, fontWeight = FontWeight.Medium))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- 3. Contagem e calendário ----------------------------------------------------------

class EventCalendarWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(
        setOf(DpSize(110.dp, 110.dp), DpSize(250.dp, 110.dp))
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val moment = EventCalendar.moment(emptyList())
        val activeDay = if (moment.phase == EventPhase.DURING) moment.selectedDayKey else null
        val countdown = countdownLabel()
        provideContent {
            GlanceTheme {
                val wide = LocalSize.current.width >= 200.dp
                WidgetFrame(context, "$countdown. 6 a 10 de fevereiro de 2027, Ipê Park Hotel") {
                    Column(modifier = GlanceModifier.fillMaxSize()) {
                        WidgetHeader("Sessão Ribeirão Preto 2")
                        Spacer(GlanceModifier.height(6.dp))
                        Text(countdown, style = TextStyle(color = WColors.ink, fontSize = if (wide) 20.sp else 17.sp, fontWeight = FontWeight.Bold), maxLines = 2)
                        Text("06–10 fev · Ipê Park Hotel", style = TextStyle(color = WColors.muted, fontSize = 12.sp), maxLines = 1)
                        if (wide) {
                            Spacer(GlanceModifier.height(8.dp))
                            Row(modifier = GlanceModifier.fillMaxWidth()) {
                                DAY_PILLS.forEachIndexed { i, (key, wd, num) ->
                                    val on = key == activeDay
                                    Column(
                                        modifier = GlanceModifier
                                            .defaultWeight()
                                            .cornerRadius(14.dp)
                                            .background(if (on) WColors.sun else WColors.card)
                                            .padding(vertical = 4.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                    ) {
                                        Text(wd, style = TextStyle(color = if (on) WColors.onSun else WColors.muted, fontSize = 11.sp))
                                        Text(num, style = TextStyle(color = if (on) WColors.onSun else WColors.ink, fontSize = 15.sp, fontWeight = FontWeight.Bold))
                                    }
                                    if (i < DAY_PILLS.lastIndex) Spacer(GlanceModifier.width(4.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// --- 5. Avisos (somente contagens; nenhum título ou conteúdo na tela inicial) ------------

class AnnouncementsWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(
        setOf(DpSize(110.dp, 110.dp), DpSize(250.dp, 110.dp))
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = KeystoreSessionStore(context).loadWidgetSnapshot()
        val total = snapshot?.visibleAnnouncementCount
        val urgent = snapshot?.urgentAnnouncementCount ?: 0
        val openAnnouncements = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("fsyrp2://avisos")
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val description = when {
            snapshot == null -> "Avisos. Entre no app para ver."
            total == null -> "Avisos. Abra o app para atualizar."
            else -> "$total avisos" + if (urgent > 0) ", $urgent urgentes" else ""
        }
        provideContent {
            GlanceTheme {
                val wide = LocalSize.current.width >= 200.dp
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .appWidgetBackground()
                        .cornerRadius(24.dp)
                        .background(WColors.paper)
                        .clickable(actionStartActivity(openAnnouncements))
                        .semantics { contentDescription = description }
                        .padding(14.dp),
                ) {
                    Column(modifier = GlanceModifier.fillMaxSize()) {
                        WidgetHeader("Avisos")
                        Spacer(GlanceModifier.height(8.dp))
                        when {
                            snapshot == null -> Text("Entre no app para ver os avisos", style = TextStyle(color = WColors.muted, fontSize = 13.sp))
                            total == null -> Text("Abra o app para atualizar", style = TextStyle(color = WColors.muted, fontSize = 13.sp))
                            else -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(total.toString(), style = TextStyle(color = WColors.ink, fontSize = 30.sp, fontWeight = FontWeight.Bold))
                                    Spacer(GlanceModifier.width(8.dp))
                                    Text(if (total == 1) "aviso" else "avisos", style = TextStyle(color = WColors.muted, fontSize = 14.sp))
                                }
                                Spacer(GlanceModifier.height(6.dp))
                                Box(
                                    modifier = GlanceModifier
                                        .cornerRadius(999.dp)
                                        .background(if (urgent > 0) WColors.urgentBg else WColors.card)
                                        .padding(horizontal = 10.dp, vertical = 4.dp),
                                ) {
                                    Text(
                                        when {
                                            urgent == 0 -> "Nenhum urgente"
                                            urgent == 1 -> "1 urgente"
                                            else -> "$urgent urgentes"
                                        },
                                        style = TextStyle(color = if (urgent > 0) WColors.onUrgent else WColors.muted, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                                    )
                                }
                                if (wide) {
                                    Spacer(GlanceModifier.height(6.dp))
                                    Text("Toque para abrir o mural", style = TextStyle(color = WColors.primary, fontSize = 12.sp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
