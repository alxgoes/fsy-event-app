package br.com.fsyrp2.app

import android.content.Context
import android.content.Intent
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import br.com.fsyrp2.app.ui.theme.FsyAppearance
import br.com.fsyrp2.app.ui.theme.FsyThemeMode
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Real Compose layouts on Android native graphics; all identities are synthetic. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w393dp-h851dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class VisualQaTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val out = File("build/outputs/visual-qa").apply { mkdirs() }

    @Before fun resetAppearance() {
        FsyAppearance.update(ApplicationProvider.getApplicationContext(), FsyThemeMode.SYSTEM)
    }

    private fun launch(screen: String, role: String = "jovem", empty: Boolean = false, module: String? = null): ActivityScenario<VisualQaActivity> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val intent = Intent(context, VisualQaActivity::class.java)
            .putExtra("screen", screen).putExtra("role", role).putExtra("empty", empty)
            .putExtra("module", module)
            .putExtra("fixture_host", "127.0.0.1")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return ActivityScenario.launch(intent)
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        compose.onRoot().captureRoboImage(File(out, "$name.png").absolutePath)
    }

    @Test fun lightScreens() {
        for (screen in listOf("auth", "home", "agenda", "announcements", "profile")) {
            launch(screen).use {
                if (screen != "auth") {
                    compose.waitForIdle()
                    val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
                    val navigation = compose.onNodeWithContentDescription("Início").fetchSemanticsNode().boundsInRoot
                    org.junit.Assert.assertTrue("A navegação deve ficar abaixo do conteúdo", navigation.top > root.height / 2f)
                }
                if (screen == "home") compose.onAllNodesWithText("Lia", substring = true).onFirst().assertIsDisplayed()
                capture("light-$screen")
            }
        }
    }

    @Test fun emptyAnnouncements() {
        launch("announcements", empty = true).use { capture("empty-announcements") }
    }

    @Test fun staffAndGallery() {
        launch("home", role = "coordenador").use { capture("staff-home") }
        launch("admin", role = "coordenador").use {
            compose.waitUntil(10_000L) {
                compose.onAllNodesWithText("120", substring = true).fetchSemanticsNodes().isNotEmpty()
            }
            capture("staff-admin")
        }
        launch("gallery").use { capture("gallery-empty") }
        launch("counselor", role = "consultor").use { capture("staff-counselor") }
    }

    @Test fun administrationEmptyForms() {
        launch("admin", role = "coordenador", module = "accounts").use { capture("admin-accounts-empty") }
        launch("admin", role = "coordenador", module = "registrations").use { capture("admin-registrations-empty") }
    }

    @Test fun appearancePersistsAcrossScreens() {
        launch("profile").use {
            compose.onAllNodesWithText("Escuro").onFirst().performScrollTo().performClick()
            org.junit.Assert.assertEquals(FsyThemeMode.DARK, FsyAppearance.mode)
            capture("appearance-manual-dark-profile")
        }
        launch("auth").use { capture("appearance-persisted-dark-auth") }
        launch("profile").use {
            compose.onAllNodesWithText("Claro").onFirst().performScrollTo().performClick()
            org.junit.Assert.assertEquals(FsyThemeMode.LIGHT, FsyAppearance.mode)
            capture("appearance-manual-light-profile")
            compose.onAllNodesWithText("Automático").onFirst().performScrollTo().performClick()
        }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xhdpi")
    fun darkSmallPhone() {
        launch("home").use { capture("dark-home-360") }
        launch("agenda").use { capture("dark-agenda-360") }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-xhdpi")
    fun largeText() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        launch("auth").use { capture("text200-auth") }
        launch("home").use { capture("text200-home") }
        launch("agenda").use { capture("text200-agenda") }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xhdpi")
    fun darkLargeText() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        launch("home").use { capture("text200-dark-home") }
        launch("auth").use { capture("text200-dark-auth") }
        launch("agenda").use { capture("text200-dark-agenda") }
    }

    @Test fun navigationMotion() {
        launch("home").use {
            compose.waitForIdle()
            compose.mainClock.autoAdvance = false
            compose.onAllNodesWithText("Agenda").onLast().performClick()
            for (frame in 0..15) {
                compose.mainClock.advanceTimeBy(32L)
                capture("motion-nav-${frame.toString().padStart(2, '0')}")
            }
            compose.mainClock.autoAdvance = true
            compose.onAllNodesWithText("Avisos").onLast().performClick()
            capture("navigation-avisos")
        }
    }

    @Test fun automaticHomeEntranceFrames() {
        compose.mainClock.autoAdvance = false
        launch("home").use {
            for (frame in 0..23) {
                compose.mainClock.advanceTimeBy(40L)
                capture("motion-home-${frame.toString().padStart(2, '0')}")
            }
        }
        compose.mainClock.autoAdvance = true
    }

    @Test fun announcementsRotateWithoutClickAndCanBePaused() {
        launch("home").use {
            compose.onAllNodesWithText("Bem-vindos ao FSY!").onFirst().performScrollTo()
            compose.waitForIdle()
            capture("automatic-notice-before")
            compose.mainClock.autoAdvance = false
            compose.mainClock.advanceTimeUntil(15_000L) {
                compose.onAllNodesWithText("Encontro no auditório").fetchSemanticsNodes().isNotEmpty()
            }
            for (frame in 0..15) {
                compose.mainClock.advanceTimeBy(32L)
                capture("motion-auto-notice-${frame.toString().padStart(2, '0')}")
            }
            compose.mainClock.autoAdvance = true
            compose.onNodeWithContentDescription("Pausar troca automática").performScrollTo().performClick()
            compose.onNodeWithContentDescription("Retomar troca automática").assertExists()
            capture("automatic-notice-paused")
        }
    }
}
