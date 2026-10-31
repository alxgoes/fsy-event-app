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
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.fsyrp2.app.MainActivity
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.EventPhase
import br.com.fsyrp2.app.model.ScheduleItem
import br.com.fsyrp2.app.model.WidgetActivitySummaryDto
import br.com.fsyrp2.app.model.WidgetSnapshotDto
import br.com.fsyrp2.app.network.PortalApiClient
import br.com.fsyrp2.app.security.KeystoreSessionStore
import java.util.concurrent.TimeUnit

private val WidgetSurfaceColor = ColorProvider(Color(0xFFFDFDFD))
private val WidgetDeepTextColor = ColorProvider(Color(0xFF0A1F2C))
private val WidgetMutedTextColor = ColorProvider(Color(0xFF3E5564))
private val WidgetPrimaryBlue = ColorProvider(Color(0xFF006184))
private val WidgetSunshineAccent = ColorProvider(Color(0xFFFBD965))
private val WidgetChipBackground = ColorProvider(Color(0xFFF3F6F8))

object FsyWidgetManager {
    private const val WORK_NAME = "fsy_rp2_widget_periodic_sync"

    suspend fun updateAllWidgets(context: Context) {
        try {
            NextActivityWidget().updateAll(context)
            EventCalendarWidget().updateAll(context)
        } catch (_: Exception) {
            // Ignora falha caso nenhum widget esteja fixado na tela inicial
        }
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
            val snapshot = WidgetSnapshotDto(
                userId = session.userId,
                updatedAtEpochMs = System.currentTimeMillis(),
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

class NextActivityWidget : GlanceAppWidget() {

    override val sizeMode: SizeMode = SizeMode.Responsive(
        setOf(
            DpSize(110.dp, 110.dp),
            DpSize(250.dp, 110.dp),
            DpSize(250.dp, 220.dp)
        )
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val keyStore = KeystoreSessionStore(context)
        val snapshot = keyStore.loadWidgetSnapshot()
        val scheduleItems = snapshot?.activities.orEmpty().map {
            ScheduleItem(
                id = it.id,
                day = it.dayKey,
                startTime = it.startTime,
                endTime = it.endTime.orEmpty(),
                title = it.title,
                location = it.location.orEmpty()
            )
        }
        val moment = EventCalendar.moment(scheduleItems)
        val openAgendaIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("fsyrp2://agenda")
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                val isTall = size.height >= 200.dp
                val isWide = size.width >= 200.dp

                Column(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(WidgetSurfaceColor)
                        .cornerRadius(16.dp)
                        .padding(12.dp)
                        .clickable(actionStartActivity(openAgendaIntent))
                ) {
                    Text(
                        text = "FSY RIBEIRÃO PRETO 2",
                        style = TextStyle(
                            color = WidgetPrimaryBlue,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                    Spacer(GlanceModifier.height(4.dp))

                    if (snapshot == null) {
                        Text(
                            text = "Entre no app FSY para ver sua agenda",
                            style = TextStyle(
                                color = WidgetDeepTextColor,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        )
                        Spacer(GlanceModifier.height(4.dp))
                        Text(
                            text = "06 a 10 de fevereiro de 2027 • Ipê Park Hotel",
                            style = TextStyle(
                                color = WidgetMutedTextColor,
                                fontSize = 11.sp
                            )
                        )
                    } else {
                        val current = moment.currentItem
                        val next = moment.nextItem
                        val dayActivities = scheduleItems
                            .filter { it.dayKey == moment.selectedDayKey }
                            .take(if (isTall) 4 else if (isWide) 2 else 1)

                        if (current != null) {
                            ActivityRowGlance(item = current, isCurrent = true)
                            Spacer(GlanceModifier.height(6.dp))
                        }

                        if (next != null && (current == null || isWide || isTall)) {
                            ActivityRowGlance(item = next, isCurrent = false)
                        } else if (current == null && dayActivities.isEmpty()) {
                            Text(
                                text = "Agenda oficial 06–10 fev 2027",
                                style = TextStyle(
                                    color = WidgetDeepTextColor,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            )
                        }

                        if (isTall && dayActivities.size > 2) {
                            Spacer(GlanceModifier.height(6.dp))
                            dayActivities.drop(if (current != null && next != null) 2 else 1)
                                .take(2)
                                .forEach { extra ->
                                    ActivityRowGlance(item = extra, isCurrent = false)
                                    Spacer(GlanceModifier.height(4.dp))
                                }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActivityRowGlance(item: ScheduleItem, isCurrent: Boolean) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(WidgetChipBackground)
            .cornerRadius(8.dp)
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (isCurrent) {
            Box(
                modifier = GlanceModifier
                    .width(3.dp)
                    .height(28.dp)
                    .background(WidgetPrimaryBlue)
            ) {}
            Spacer(GlanceModifier.width(8.dp))
        }
        Column(modifier = GlanceModifier.defaultWeight()) {
            Text(
                text = if (isCurrent) {
                    "AGORA • ${item.startTime.take(5)}–${item.endTime.take(5)}"
                } else {
                    "PRÓXIMA • ${item.startTime.take(5)}"
                },
                style = TextStyle(
                    color = WidgetPrimaryBlue,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            )
            Text(
                text = item.title,
                style = TextStyle(
                    color = WidgetDeepTextColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                ),
                maxLines = 1
            )
            if (!item.location.isNullOrBlank()) {
                Text(
                    text = item.location,
                    style = TextStyle(
                        color = WidgetMutedTextColor,
                        fontSize = 10.sp
                    ),
                    maxLines = 1
                )
            }
        }
    }
}

class EventCalendarWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val moment = EventCalendar.moment(emptyList())
        val daysLeft = EventCalendar.daysUntilStart()
        val openAgendaIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("fsyrp2://agenda")
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val dayPills = listOf(
            Triple("dia1", "SÁB", "06"),
            Triple("dia2", "DOM", "07"),
            Triple("dia3", "SEG", "08"),
            Triple("dia4", "TER", "09"),
            Triple("dia5", "QUA", "10")
        )

        provideContent {
            GlanceTheme {
                Column(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(WidgetSurfaceColor)
                        .cornerRadius(16.dp)
                        .padding(12.dp)
                        .clickable(actionStartActivity(openAgendaIntent))
                ) {
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = GlanceModifier.defaultWeight()) {
                            Text(
                                text = "FSY RIBEIRÃO PRETO 2 • FEV 2027",
                                style = TextStyle(
                                    color = WidgetPrimaryBlue,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Text(
                                text = when (moment.phase) {
                                    EventPhase.BEFORE -> "Faltam $daysLeft dias • Alegrar-se em Cristo"
                                    EventPhase.DURING -> "Sessão em andamento no Ipê Park Hotel"
                                    EventPhase.AFTER -> "Sessão concluída • Alegrar-se em Cristo"
                                },
                                style = TextStyle(
                                    color = WidgetMutedTextColor,
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }

                    Spacer(GlanceModifier.height(8.dp))

                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        dayPills.forEach { (key, dow, dayNum) ->
                            val isSelected = moment.selectedDayKey == key && moment.phase == EventPhase.DURING
                            Column(
                                modifier = GlanceModifier
                                    .defaultWeight()
                                    .padding(horizontal = 2.dp)
                                    .background(if (isSelected) WidgetSunshineAccent else WidgetChipBackground)
                                    .cornerRadius(8.dp)
                                    .padding(vertical = 6.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = dow,
                                    style = TextStyle(
                                        color = WidgetMutedTextColor,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = dayNum,
                                    style = TextStyle(
                                        color = WidgetDeepTextColor,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

