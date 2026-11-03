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
import org.junit.After
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

    private lateinit var fixtures: VisualFixtures
    @Before fun resetAppearance() {
        fixtures = VisualFixtures()
        FsyAppearance.update(ApplicationProvider.getApplicationContext(), FsyThemeMode.SYSTEM)
    }

    @After fun stopFixtures() { fixtures.close(); br.com.fsyrp2.app.ui.components.FsyClock.override = null; compose.mainClock.autoAdvance = true }

    private fun launch(screen: String, role: String = "jovem", empty: Boolean = false, module: String? = null, pending: Boolean = false, clock: String? = null): ActivityScenario<VisualQaActivity> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val intent = Intent(context, VisualQaActivity::class.java)
            .putExtra("clock", clock).putExtra("screen", screen).putExtra("role", role).putExtra("empty", empty)
            .putExtra("module", module).putExtra("disable_native_ripple", true)
            .putExtra("fixture_host", "127.0.0.1").putExtra("fixture_port", fixtures.port).putExtra("pending_photo", pending)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return ActivityScenario.launch(intent)
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        compose.onAllNodes(isRoot()).onLast().captureRoboImage(File(out, "$name.png").absolutePath)
    }

    @Test fun lightScreens() {
        for (screen in listOf("auth", "home", "agenda", "announcements", "more")) {
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
        launch("gallery").use { capture("gallery-grid") }
        launch("gallery", empty = true).use { capture("gallery-empty") }
        launch("counselor", role = "consultor").use {
            compose.onNodeWithText("Fotos para aprovar (1)").performScrollTo()
            compose.onNodeWithText("Em definição").assertDoesNotExist()
            capture("staff-counselor")
        }
        launch("notifications").use { capture("notification-settings") }
        launch("more", role = "consultor").use {
            compose.onNodeWithText("Painel do consultor").performScrollTo()
            capture("staff-more-photo-count")
        }
    }

    @Test fun administrationEmptyForms() {
        launch("admin", role = "coordenador", module = "accounts").use { capture("admin-accounts-empty") }
        launch("admin", role = "coordenador", module = "registrations").use { capture("admin-registrations-empty") }
    }

    @Test fun appearancePersistsAcrossScreens() {
        launch("more").use {
            compose.onAllNodesWithText("Escuro").onFirst().performScrollTo().performClick()
            org.junit.Assert.assertEquals(FsyThemeMode.DARK, FsyAppearance.mode)
            capture("appearance-manual-dark-more")
        }
        launch("auth").use { capture("appearance-persisted-dark-auth") }
        launch("more").use {
            compose.onAllNodesWithText("Claro").onFirst().performScrollTo().performClick()
            org.junit.Assert.assertEquals(FsyThemeMode.LIGHT, FsyAppearance.mode)
            capture("appearance-manual-light-more")
            compose.onAllNodesWithText("Automático").onFirst().performScrollTo().performClick()
        }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xhdpi")
    fun darkSmallPhone() {
        launch("home").use { capture("dark-home-360") }
        launch("agenda").use { capture("dark-agenda-360") }
        launch("more", pending = true).use { capture("dark-more-pending-360") }
        launch("announcements").use { capture("dark-announcements-360") }
        launch("gallery").use { capture("dark-gallery-360") }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-xhdpi")
    fun largeText() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        launch("auth").use { capture("text200-auth") }
        launch("home").use { capture("text200-home") }
        launch("agenda").use { capture("text200-agenda") }
        launch("more", pending = true).use { capture("text200-more-pending") }
        launch("announcements").use { capture("text200-announcements") }
        launch("notifications").use { capture("text200-notifications") }
        launch("gallery").use { capture("text200-gallery") }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xhdpi")
    fun darkLargeText() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        launch("home").use { capture("text200-dark-home") }
        launch("auth").use { capture("text200-dark-auth") }
        launch("agenda").use { capture("text200-dark-agenda") }
        launch("more", pending = true).use { capture("text200-dark-more-pending") }
        launch("announcements").use { capture("text200-dark-announcements") }
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

    @Test fun galleryViewerSwipesAndReturnsToMore() {
        launch("gallery").use {
            compose.onNodeWithContentDescription("Recordação da sessão 1").performClick()
            compose.onNodeWithText("1 de 9").assertExists()
            compose.onAllNodes(isRoot()).onLast().performTouchInput { swipeLeft() }
            compose.onNodeWithText("2 de 9").assertExists()
            capture("gallery-fullscreen")
            compose.onNodeWithContentDescription("Fechar").performClick()
            compose.onNodeWithContentDescription("Voltar").performClick()
            compose.onNodeWithText("Lia Exemplo").assertExists()
        }
    }

    @Test fun homeBeforeEventAndBetweenActivities() {
        launch("home", clock = "2026-11-02T12:00:00Z").use { capture("home-before-event") }
        launch("home", clock = "2027-02-06T16:30:00Z").use { capture("home-between-activities") }
    }

    @Test fun homeShowsTwoStaticNotices() {
        launch("home").use {
            compose.onAllNodesWithText("Bem-vindos ao FSY!").onFirst().performScrollTo()
            compose.onAllNodesWithText("Encontro no auditório").onFirst().assertExists()
            compose.onNodeWithContentDescription("Pausar troca automática").assertDoesNotExist()
            compose.onAllNodesWithText("Organizar").assertCountEquals(0)
            capture("home-static-notices")
        }
    }

    @Test fun youngAndUnknownProfilesNeverExposeStaffDestinations() {
        for (role in listOf("jovem", "cargo_desconhecido", "loading")) {
            for (screen in listOf("home", "more", "announcements", "agenda")) {
                launch(screen, role = role).use { scenario ->
                    for (label in listOf("Administração", "Gestão", "Conselheiro", "Painel do consultor", "Publicar", "Equipe", "Reunião reservada", "Preparação reservada", "Preparação interna antiga")) {
                        compose.onAllNodesWithText(label).assertCountEquals(0)
                    }
                    scenario.onActivity { activity ->
                        org.junit.Assert.assertFalse(activity.state.canOpenAdmin)
                        org.junit.Assert.assertFalse(activity.state.canOpenCounselorPanel)
                        org.junit.Assert.assertEquals(4, activity.state.scheduleItems.size)
                        activity.state.open(br.com.fsyrp2.app.state.OverlayDestination.AdminHub())
                        org.junit.Assert.assertEquals(br.com.fsyrp2.app.state.MainTab.HOME, activity.state.selectedTab)
                        activity.state.selectedTab = br.com.fsyrp2.app.state.MainTab.MORE
                        activity.state.handleIncomingDeepLink("fsyrp2://admin")
                        org.junit.Assert.assertEquals(br.com.fsyrp2.app.state.MainTab.HOME, activity.state.selectedTab)
                    }
                }
            }
        }
    }

    @Test fun portugueseCategoryFilterAndHomeFocus() {
        launch("agenda").use {
            compose.onAllNodesWithText("Alimentação").onFirst().performScrollTo().performClick()
            compose.onNodeWithText("Almoço").assertIsDisplayed()
            compose.onNodeWithText("Boas-vindas ao FSY").assertDoesNotExist()
        }
        launch("home").use {
            compose.onNode(hasText("Almoço") and hasClickAction()).performScrollTo().performClick()
            compose.onNodeWithText("Almoço").assertExists()
            capture("agenda-focused-from-home")
        }
    }

    @Test fun pendingPhotoAndCounselorReview() {
        launch("more", pending = true).use {
            compose.onNodeWithText("Em análise pelo seu consultor").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Cancelar envio").assertExists()
            capture("more-photo-pending")
        }
        launch("counselor", role = "consultor").use {
            compose.onNodeWithText("Fotos para aprovar (1)").assertExists()
            compose.onNodeWithText("Não aprovar").performScrollTo().performClick()
            compose.onNodeWithText("Enviar motivo").assertIsNotEnabled()
            compose.onNodeWithText("Motivo").performTextInput("Rosto pouco visível")
            compose.onNodeWithText("Enviar motivo").assertIsEnabled()
            capture("counselor-photo-reason")
        }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-xhdpi")
    fun authorizationEditorProtectsDraftAndHandlesInvalidPreview() {
        authorizationEditorFlow(largeText = false)
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xhdpi")
    fun authorizationEditorSupportsLargeTextInDarkMode() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        authorizationEditorFlow(largeText = true)
    }

    private fun authorizationEditorFlow(largeText: Boolean) {
        val record = """{"id":"qa-registration","firstNameRaw":"Pessoa","lastNameRaw":"Fictícia","fullNameRaw":"Pessoa Fictícia","fullNameNormalized":"Pessoa Fictícia","status":"Aprovado","hasHealthAlert":true,"hasMissingGuardianForMinor":true,"cpfRaw":"importado com aviso","hasAuthorizationAdjustments":true,"authorizationAdjustments":{"values":{"guardianName":"Responsável Fictício"},"editedByName":"Gestão Fictícia","editedAt":"2026-11-02T12:00:00Z"}}"""
        // Resposta corrompida proposital: deve mostrar erro em português e manter o rascunho.
        val pdfBytes = "invalid synthetic PDF fixture".toByteArray()
        fixtures.close()
        fixtures = VisualFixtures(
            mapOf("/api/admin/registrations" to """{"items":[$record],"metrics":{"totalCount":1}}""",
                "/api/admin/registrations/qa-registration" to record),
            mapOf("/api/admin/registrations/qa-registration/authorization-pdf" to pdfBytes)
        )
        launch("admin", role = "coordenador", module = "registrations").use { scenario ->
            scenario.onActivity { activity ->
                activity.state.editRegistrationAuthorization(kotlinx.serialization.json.Json.decodeFromString<br.com.fsyrp2.app.model.RegistrationRecordDto>(record))
            }
            compose.waitUntil(10_000L) { compose.onAllNodesWithText("Nome").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Nome").assertExists()
            capture(if (largeText) "text200-dark-authorization-editor" else "authorization-editor-360")
            compose.onNodeWithText("Nome do responsável legal").performScrollTo().performTextReplacement("Conceição Fictícia")
            compose.onNodeWithText("Salvar autorização").performScrollTo().assertIsEnabled()
            scenario.onActivity { activity ->
                org.junit.Assert.assertEquals("Conceição Fictícia", activity.state.registrationAuthorizationEditor?.draft?.get("guardianName"))
                org.junit.Assert.assertEquals("Responsável Fictício", activity.state.registrationAuthorizationEditor?.record?.authorizationAdjustments?.values?.get("guardianName"))
            }
            compose.onNodeWithText("Atualizar prévia").performScrollTo().performClick()
            val previewError = "Não foi possível exibir a prévia. Tente novamente ou baixe o PDF salvo."
            compose.waitUntil(10_000L) { compose.onAllNodesWithText(previewError).fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText(previewError).performScrollTo()
            capture(if (largeText) "text200-dark-authorization-preview-error" else "authorization-preview-error-360")
            compose.onNodeWithText("CPF").performScrollTo().performTextReplacement("11111111111")
            compose.onNodeWithText("Salvar autorização").performScrollTo().assertIsNotEnabled()
            compose.onNodeWithText("Fechar sem salvar").performScrollTo().performClick()
            compose.onNodeWithText("Descartar o rascunho?").assertExists()
            compose.onNodeWithText("Descartar e fechar").performClick()
            scenario.onActivity { activity -> org.junit.Assert.assertNull(activity.state.registrationAuthorizationEditor) }
        }
    }
}
