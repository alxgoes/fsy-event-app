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

    @After fun stopFixtures() {
        fixtures.close()
        br.com.fsyrp2.app.ui.components.FsyClock.override = null
        compose.mainClock.autoAdvance = true
        org.robolectric.RuntimeEnvironment.setFontScale(1f)
    }

    private fun launch(
        screen: String,
        role: String = "jovem",
        empty: Boolean = false,
        module: String? = null,
        pending: Boolean = false,
        clock: String? = null,
        whatsappUrl: String? = null,
        includeWhatsappExtra: Boolean = false,
        editWhatsapp: Boolean = false,
        approvedPhoto: Boolean = false,
    ): ActivityScenario<VisualQaActivity> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val intent = Intent(context, VisualQaActivity::class.java)
            .putExtra("clock", clock).putExtra("screen", screen).putExtra("role", role).putExtra("empty", empty)
            .putExtra("module", module).putExtra("disable_native_ripple", true)
            .putExtra("fixture_host", "127.0.0.1").putExtra("fixture_port", fixtures.port)
            .putExtra("pending_photo", pending).putExtra("approved_photo", approvedPhoto)
            .putExtra("edit_whatsapp", editWhatsapp)
            .apply {
                if (includeWhatsappExtra || whatsappUrl != null) {
                    putExtra("whatsapp_url", whatsappUrl.orEmpty())
                }
            }
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

    @Test fun companyWhatsappYouthCounselorAndManagement() {
        val canonicalInvite = "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv"

        // 1. Jovem com link válido em Início e Mais
        launch("home", role = "jovem", whatsappUrl = canonicalInvite, approvedPhoto = true).use {
            compose.onNodeWithText("Entrar no grupo da companhia").performScrollTo().assertIsDisplayed()
            compose.onAllNodesWithText("Adicionar link").assertCountEquals(0)
            compose.onAllNodesWithText("Trocar link").assertCountEquals(0)
            capture("whatsapp-youth-home-with-link")
        }
        launch("more", role = "jovem", whatsappUrl = canonicalInvite, approvedPhoto = true).use {
            compose.onNodeWithText("Grupo da companhia no WhatsApp").performScrollTo().assertIsDisplayed()
            compose.onAllNodesWithText("Adicionar link").assertCountEquals(0)
            compose.onAllNodesWithText("Trocar link").assertCountEquals(0)
            capture("whatsapp-youth-more-with-link")
        }

        // 2. Jovem sem link cadastrado (bloco/linha não aparecem)
        launch("home", role = "jovem", whatsappUrl = "", includeWhatsappExtra = true).use {
            compose.onAllNodesWithText("Entrar no grupo da companhia").assertCountEquals(0)
            capture("whatsapp-youth-home-without-link")
        }
        launch("more", role = "jovem", whatsappUrl = "", includeWhatsappExtra = true).use {
            compose.onAllNodesWithText("Grupo da companhia no WhatsApp").assertCountEquals(0)
            capture("whatsapp-youth-more-without-link")
        }

        // 3. Consultor visualizando card e editando link no modal
        launch("counselor", role = "consultor", whatsappUrl = canonicalInvite).use {
            compose.onNodeWithText("Grupo do WhatsApp").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Link cadastrado").assertIsDisplayed()
            compose.onNodeWithText("Trocar link").performScrollTo().assertIsDisplayed()
            capture("whatsapp-counselor-card")
        }
        launch("counselor", role = "consultor", whatsappUrl = canonicalInvite, editWhatsapp = true).use {
            compose.onNodeWithText("Grupo do WhatsApp — Companhia Girassol").assertIsDisplayed()
            compose.onNodeWithText("Remover link").assertIsDisplayed()
            capture("whatsapp-counselor-editing")
        }

        // 4. Gestão (Companhias) com companhia sem consultor designado
        launch("admin", role = "coordenador", module = "companies").use {
            compose.waitUntil(10_000L) {
                compose.onAllNodesWithText("Companhia Ipê").fetchSemanticsNodes().isNotEmpty()
            }
            compose.onNodeWithText("1 companhia sem consultor").assertIsDisplayed()
            compose.onNodeWithText("1 companhia ainda está sem consultor designado.").assertIsDisplayed()
            compose.onNodeWithText("Sem consultor designado").performScrollTo().assertIsDisplayed()
            capture("whatsapp-admin-companies-no-counselor")
        }
    }

    private fun assertNoButtonTextOverflow(contextLabel: String) {
        compose.waitForIdle()
        val rootNode = compose.onRoot().fetchSemanticsNode()
        val rootBounds = rootNode.boundsInRoot

        fun countTextDescendants(n: androidx.compose.ui.semantics.SemanticsNode): Int {
            val self = if (n.config.contains(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult)) 1 else 0
            return self + n.children.sumOf { countTextDescendants(it) }
        }

        fun checkNodeRecursive(
            node: androidx.compose.ui.semantics.SemanticsNode,
            buttonNode: androidx.compose.ui.semantics.SemanticsNode?,
        ) {
            val role = node.config.getOrElseNullable(androidx.compose.ui.semantics.SemanticsProperties.Role) { null }
            val hasClick = node.config.contains(androidx.compose.ui.semantics.SemanticsActions.OnClick)
            val isButtonLike = hasClick && (
                role == androidx.compose.ui.semantics.Role.Tab ||
                    role == androidx.compose.ui.semantics.Role.RadioButton ||
                    role == androidx.compose.ui.semantics.Role.Checkbox ||
                    role == androidx.compose.ui.semantics.Role.Switch ||
                    (role == androidx.compose.ui.semantics.Role.Button && countTextDescendants(node) == 1)
                )

            if (hasClick && node.boundsInRoot.width > 0f && node.boundsInRoot.height > 0f) {
                org.junit.Assert.assertTrue(
                    "[$contextLabel] Controle clicável fora da largura da tela: bounds=${node.boundsInRoot}, root=$rootBounds",
                    node.boundsInRoot.left >= rootBounds.left - 2f && node.boundsInRoot.right <= rootBounds.right + 2f,
                )
            }

            val activeButtonNode = if (isButtonLike) node else buttonNode
            val activeButtonBounds = activeButtonNode?.boundsInRoot
            val activeButtonSize = activeButtonNode?.size
            if (
                activeButtonNode != null &&
                activeButtonBounds != null &&
                activeButtonSize != null &&
                node.config.contains(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult)
            ) {
                val results = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
                node.config[androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult].action?.invoke(results)
                val tb = node.boundsInRoot
                val isUnclippedByScroll =
                    kotlin.math.abs(activeButtonSize.width - activeButtonBounds.width) <= 2f &&
                        kotlin.math.abs(activeButtonSize.height - activeButtonBounds.height) <= 2f
                if (isUnclippedByScroll && tb.width > 0f && tb.height > 0f && activeButtonBounds.width > 0f && activeButtonBounds.height > 0f) {
                    org.junit.Assert.assertTrue(
                        "[$contextLabel] Texto '${results.firstOrNull()?.layoutInput?.text}' extravasa botão pai: texto=$tb, botão=$activeButtonBounds",
                        tb.left >= activeButtonBounds.left - 3f &&
                            tb.right <= activeButtonBounds.right + 3f &&
                            tb.top >= activeButtonBounds.top - 3f &&
                            tb.bottom <= activeButtonBounds.bottom + 3f,
                    )
                }
                results.forEach { layout ->
                    val labelText = layout.layoutInput.text.text
                    if (labelText.isNotBlank() && layout.lineCount > 0) {
                        val lastLine = layout.lineCount - 1
                        org.junit.Assert.assertFalse(
                            "[$contextLabel] Texto de botão '$labelText' foi truncado com reticências",
                            layout.isLineEllipsized(lastLine),
                        )
                        org.junit.Assert.assertEquals(
                            "[$contextLabel] Texto de botão '$labelText' teve caracteres cortados",
                            labelText.trimEnd().length,
                            layout.getLineEnd(lastLine, visibleEnd = true),
                        )
                    }
                    for (line in 0 until layout.lineCount) {
                        val lineWidth = layout.getLineRight(line) - layout.getLineLeft(line)
                        val fitsHorizontally = lineWidth <= layout.size.width + 3f && lineWidth <= activeButtonSize.width + 2f
                        val fitsVertically =
                            layout.getLineTop(line) >= -3f &&
                                layout.getLineBottom(line) <= layout.size.height + 3f &&
                                layout.size.height <= activeButtonSize.height + 2f
                        org.junit.Assert.assertTrue(
                            "[$contextLabel] Linha $line do botão '$labelText' cortada: box=${layout.size}, btnSize=$activeButtonSize, lineWidth=$lineWidth, line=${layout.getLineLeft(line)}..${layout.getLineRight(line)} x ${layout.getLineTop(line)}..${layout.getLineBottom(line)}",
                            fitsHorizontally && fitsVertically,
                        )
                    }
                }
            }
            node.children.forEach { child -> checkNodeRecursive(child, activeButtonNode) }
        }

        val unmergedRoot = compose.onRoot(useUnmergedTree = true).fetchSemanticsNode()
        checkNodeRecursive(unmergedRoot, null)
    }

    @Test fun framingMatrixAcrossWidthsAndFontScales() {
        val sampleRecord = """{"id":"qa-reg-1","firstNameRaw":"Gabriel","lastNameRaw":"Oliveira","fullNameRaw":"Gabriel Oliveira","fullNameNormalized":"Gabriel Oliveira","status":"Aprovado","ageAtRegistration":16,"stakeName":"Ribeirão Preto Leste","wardName":"Ala Jardim Macedo","hasHealthAlert":true,"hasMissingGuardianForMinor":false}"""
        val sampleBatch = """{"id":"qa-batch-1","filename":"inscricoes-fsy-rp2.xlsx","totalCount":120,"participantCount":108,"counselorCount":12,"createdAt":"2026-11-10T14:20:00Z","isActiveBatch":true}"""
        val registrationsJson = """{"items":[$sampleRecord],"batches":[$sampleBatch],"metrics":{"totalCount":120,"participantCount":108,"counselorCount":12,"confirmedCount":115,"healthAlertCount":8,"missingGuardianMinorCount":2,"documentWarningCount":1},"pagination":{"page":1,"pageSize":25,"totalPages":5,"totalFiltered":120}}"""
        fixtures.close()
        fixtures = VisualFixtures(mapOf("/api/admin/registrations" to registrationsJson))

        val widths = listOf(320, 360, 393, 412)
        val fontScales = listOf(1.0f, 1.3f, 2.0f)
        val canonicalInvite = "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv"

        for (width in widths) {
            for (scale in fontScales) {
                val scaleTag = (scale * 100).toInt()
                org.robolectric.RuntimeEnvironment.setQualifiers("w${width}dp-h840dp-xhdpi")
                org.robolectric.RuntimeEnvironment.setFontScale(scale)

                // Inscrições (RegistrationsAdminScreen) em todas as combinações de largura × fonte
                launch("admin", role = "coordenador", module = "registrations").use {
                    compose.waitUntil(10_000L) {
                        compose.onAllNodesWithText("120 inscritos", substring = true).fetchSemanticsNodes().isNotEmpty()
                    }
                    assertNoButtonTextOverflow("registrations-top-w$width-font$scaleTag-light")
                    if (width in listOf(320, 360, 393, 412) && (width == 320 || scale == 1.3f || scale == 2.0f)) {
                        capture("framing-registrations-w$width-font$scaleTag-light")
                    }
                    compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Gabriel Oliveira", substring = true))
                    assertNoButtonTextOverflow("registrations-cards-w$width-font$scaleTag-light")
                }

                // Telas principais (Início, Agenda, Mais, Painel do Consultor)
                launch("home", role = "jovem", whatsappUrl = canonicalInvite, approvedPhoto = true).use {
                    assertNoButtonTextOverflow("home-w$width-font$scaleTag-light")
                    if (width == 320 && (scale == 1.0f || scale == 1.3f || scale == 2.0f)) {
                        capture("framing-home-w$width-font$scaleTag-light")
                    }
                }
                launch("agenda", role = "jovem", approvedPhoto = true).use {
                    assertNoButtonTextOverflow("agenda-w$width-font$scaleTag-light")
                    if (width == 320 && scale == 2.0f) {
                        capture("framing-agenda-w$width-font$scaleTag-light")
                    }
                }
                launch("more", role = "jovem", whatsappUrl = canonicalInvite, approvedPhoto = true).use {
                    assertNoButtonTextOverflow("more-w$width-font$scaleTag-light")
                    if (width == 320 && scale == 2.0f) {
                        capture("framing-more-w$width-font$scaleTag-light")
                    }
                }
                if (width == 320 && scale == 2.0f) {
                    launch("counselor", role = "consultor", whatsappUrl = canonicalInvite).use {
                        compose.onNodeWithText("Minha companhia").performScrollTo()
                        assertNoButtonTextOverflow("counselor-w320-font200-light")
                        capture("framing-counselor-w320-font200-light")
                    }
                    org.robolectric.RuntimeEnvironment.setQualifiers("w320dp-h840dp-night-xhdpi")
                    org.robolectric.RuntimeEnvironment.setFontScale(2.0f)
                    launch("admin", role = "coordenador", module = "registrations").use {
                        compose.waitUntil(10_000L) {
                            compose.onAllNodesWithText("120 inscritos", substring = true).fetchSemanticsNodes().isNotEmpty()
                        }
                        assertNoButtonTextOverflow("registrations-top-w320-font200-dark")
                        capture("framing-registrations-w320-font200-dark")
                        compose.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Gabriel Oliveira", substring = true))
                        assertNoButtonTextOverflow("registrations-cards-w320-font200-dark")
                    }
                }
            }
        }
    }
}
