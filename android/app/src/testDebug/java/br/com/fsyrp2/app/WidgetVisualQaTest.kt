package br.com.fsyrp2.app

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.FrameLayout
import android.widget.RemoteViews
import android.widget.ViewFlipper
import android.graphics.Bitmap
import android.graphics.Canvas
import android.provider.Settings
import br.com.fsyrp2.app.widget.FsyHighlightsWidgetProvider
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.compose
import androidx.test.core.app.ApplicationProvider
import br.com.fsyrp2.app.model.WidgetActivitySummaryDto
import br.com.fsyrp2.app.model.WidgetSnapshotDto
import br.com.fsyrp2.app.security.KeystoreSessionStore
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Robolectric
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w393dp-h851dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WidgetVisualQaTest {
    private fun captureWidget(view: View, path: File, height: Int = 360) {
        view.measure(View.MeasureSpec.makeMeasureSpec(640, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
        view.layout(0, 0, 640, height)
        val image = Bitmap.createBitmap(640, height, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(image))
        image.captureRoboImage(path.absolutePath)
        image.recycle()
    }

    @Test fun interactiveWidgetHasRealPagesAndReducedMotionFallback() {
        val host = Robolectric.buildActivity(WidgetQaHostActivity::class.java).setup()
        val activity = host.get()
        val out = File("build/outputs/visual-qa/widgets").apply { mkdirs() }
        val builder = FsyHighlightsWidgetProvider.Companion::class.java.getDeclaredMethod(
            "buildViews", Context::class.java, Int::class.javaPrimitiveType,
        ).apply { isAccessible = true }
        fun render(name: String): View {
            val remote = builder.invoke(FsyHighlightsWidgetProvider.Companion, activity, 42) as RemoteViews
            val view = remote.apply(activity, FrameLayout(activity))
            activity.setContentView(view)
            captureWidget(view, File(out, "$name.png"), 400)
            return view
        }
        Settings.Global.putFloat(activity.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
        val view = render("interactive-countdown")
        val flipper = view.findViewById<ViewFlipper>(R.id.fsy_highlights_flipper)
        org.junit.Assert.assertFalse("O widget não deve trocar páginas sozinho", flipper.isAutoStart)
        org.junit.Assert.assertNotNull("A troca manual deve ter transição", flipper.inAnimation)
        val nextPage = RemoteViews(activity.packageName, R.layout.widget_fsy_highlights)
        nextPage.showNext(R.id.fsy_highlights_flipper)
        nextPage.reapply(activity, view)
        org.junit.Assert.assertEquals(1, flipper.displayedChild)
        flipper.inAnimation?.cancel()
        flipper.outAnimation?.cancel()
        captureWidget(view, File(out, "interactive-agenda.png"), 400)
        Settings.Global.putFloat(activity.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 0f)
        val reduced = render("interactive-reduced-motion")
        org.junit.Assert.assertNull("Movimento reduzido deve retirar a animação", reduced.findViewById<ViewFlipper>(R.id.fsy_highlights_flipper).inAnimation)
        host.pause().stop().destroy()
    }

    @Test fun renderRegisteredWidgetsAndLogout() = runBlocking<Unit> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("fsy_rp2_secure_store", Context.MODE_PRIVATE)
            .edit().clear().putString("active_user_id", "qa-widget-user").commit()
        val store = KeystoreSessionStore(context)
        store.saveWidgetSnapshot(WidgetSnapshotDto(
            userId = "qa-widget-user", companyName = "Companhia Exemplo",
            updatedAtEpochMs = System.currentTimeMillis(),
            visibleAnnouncementCount = 2, urgentAnnouncementCount = 1,
            activities = listOf(
                WidgetActivitySummaryDto("qa-1", "dia1", "09:00", "10:00", "Boas-vindas ao FSY", "Auditório"),
                WidgetActivitySummaryDto("qa-2", "dia1", "12:00", "13:00", "Almoço", "Restaurante"),
                WidgetActivitySummaryDto("qa-3", "dia1", "14:00", "15:00", "Atividade da companhia", "Jardim"),
            ),
        ))
        val providers = context.packageManager.queryBroadcastReceivers(
            Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setPackage(context.packageName), 0,
        ).mapNotNull {
            runCatching { Class.forName(it.activityInfo.name).getDeclaredConstructor().newInstance() as? GlanceAppWidgetReceiver }.getOrNull()
        }
        check(providers.size >= 4) { "Os widgets esperados não foram registrados." }
        val out = File("build/outputs/visual-qa/widgets").apply { mkdirs() }
        val host = Robolectric.buildActivity(WidgetQaHostActivity::class.java).setup()
        for (provider in providers) {
            val widget = provider.glanceAppWidget
            val remote = withTimeout(20_000) { widget.compose(context, size = DpSize(320.dp, 180.dp)) }
            val activity = host.get()
            val view = remote.apply(activity, FrameLayout(activity))
            activity.setContentView(view)
            captureWidget(view, File(out, provider.javaClass.simpleName + ".png"))
        }
        context.getSharedPreferences("fsy_rp2_secure_store", Context.MODE_PRIVATE)
            .edit().putString("active_user_id", "qa-other-user").commit()
        org.junit.Assert.assertNull("Outra conta não deve ler o snapshot anterior", store.loadWidgetSnapshot())
        store.clearSession()
        org.junit.Assert.assertNull("Logout deve retirar o conteúdo da conta dos widgets", store.loadWidgetSnapshot())
        host.pause().stop().destroy()
    }
}
