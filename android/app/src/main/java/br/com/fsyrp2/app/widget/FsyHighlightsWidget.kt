package br.com.fsyrp2.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.widget.RemoteViews
import br.com.fsyrp2.app.R
import br.com.fsyrp2.app.data.EventCalendar

/**
 * Widget "Destaques": três páginas (contagem, próxima atividade, tema) num ViewFlipper de
 * RemoteViews — o único caminho de animação de conteúdo suportado em widgets. A troca de
 * página é MANUAL (setas "Anterior"/"Próxima"): sem autoStart, sem laço, sem atualização
 * frequente. Com "Remover animações" do sistema, usa o layout sem in/out.
 */
class FsyHighlightsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { id -> manager.updateAppWidget(id, buildViews(context, id)) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return
        val views = RemoteViews(context.packageName, layoutFor(context))
        when (intent.action) {
            ACTION_NEXT -> views.showNext(R.id.fsy_highlights_flipper)
            ACTION_PREVIOUS -> views.showPrevious(R.id.fsy_highlights_flipper)
            else -> return
        }
        AppWidgetManager.getInstance(context).partiallyUpdateAppWidget(id, views)
    }

    companion object {
        private const val ACTION_NEXT = "br.com.fsyrp2.app.widget.HIGHLIGHTS_NEXT"
        private const val ACTION_PREVIOUS = "br.com.fsyrp2.app.widget.HIGHLIGHTS_PREVIOUS"

        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, FsyHighlightsWidgetProvider::class.java))
            ids.forEach { id -> manager.updateAppWidget(id, buildViews(context, id)) }
        }

        private fun reduceMotion(context: Context): Boolean =
            runCatching {
                Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
            }.getOrDefault(false)

        private fun layoutFor(context: Context): Int =
            if (reduceMotion(context)) R.layout.widget_fsy_highlights_static else R.layout.widget_fsy_highlights

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, layoutFor(context))

            // Página 1 — contagem (fato público do evento)
            views.setTextViewText(R.id.fsy_hl_countdown, countdownLabel())

            // Página 2 — próxima atividade (agenda pública do snapshot; vazio após sair)
            val items = loadWidgetSchedule(context)
            if (items == null) {
                views.setTextViewText(R.id.fsy_hl_next_time, "")
                views.setTextViewText(R.id.fsy_hl_next_title, "Entre no app para ver a agenda")
                views.setTextViewText(R.id.fsy_hl_next_place, "")
            } else {
                val moment = EventCalendar.moment(items)
                val item = moment.current ?: moment.next
                views.setTextViewText(R.id.fsy_hl_next_label, if (moment.current != null) "Agora" else "A seguir")
                views.setTextViewText(R.id.fsy_hl_next_time, item?.startTime?.take(5).orEmpty())
                views.setTextViewText(R.id.fsy_hl_next_title, item?.title ?: "Sem próximas atividades")
                views.setTextViewText(R.id.fsy_hl_next_place, item?.location.orEmpty())
            }

            // Abrir o app (agenda) ao tocar no conteúdo
            val open = PendingIntent.getActivity(
                context, 0, openAgendaIntent(context),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.fsy_highlights_flipper, open)

            // Controles manuais de página
            views.setOnClickPendingIntent(R.id.fsy_hl_prev, pageIntent(context, widgetId, ACTION_PREVIOUS))
            views.setOnClickPendingIntent(R.id.fsy_hl_next, pageIntent(context, widgetId, ACTION_NEXT))
            return views
        }

        private fun pageIntent(context: Context, widgetId: Int, action: String): PendingIntent {
            val intent = Intent(context, FsyHighlightsWidgetProvider::class.java).apply {
                this.action = action
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            }
            val request = widgetId * 2 + if (action == ACTION_NEXT) 1 else 0
            return PendingIntent.getBroadcast(
                context, request, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}
