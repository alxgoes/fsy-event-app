package br.com.fsyrp2.app

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Looper
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.semantics.SemanticsActions
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.ui.components.RemoteImageMemory
import br.com.fsyrp2.app.ui.theme.FsyAppearance
import br.com.fsyrp2.app.ui.theme.FsyThemeMode
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.Duration
import kotlin.math.abs

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h800dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ProfilePhotoRolesUiTest {
    @get:Rule val compose = createEmptyComposeRule()
    private lateinit var fixtures: VisualFixtures
    private val approvedUrl = "https://photos.example.invalid/approved"
    private val pendingUrl = "https://photos.example.invalid/pending"
    private val out = File("build/outputs/visual-qa").apply { mkdirs() }

    @Before fun prepare() {
        org.robolectric.RuntimeEnvironment.setFontScale(1f)
        FsyAppearance.update(ApplicationProvider.getApplicationContext(), FsyThemeMode.SYSTEM)
        fixtures = VisualFixtures()
    }

    @After fun finish() {
        fixtures.close()
        RemoteImageMemory.clear()
        br.com.fsyrp2.app.ui.components.FsyClock.override = null
        org.robolectric.RuntimeEnvironment.setFontScale(1f)
    }

    private fun launch(screen: String, role: String, pending: Boolean = false): ActivityScenario<VisualQaActivity> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        return ActivityScenario.launch(Intent(context, VisualQaActivity::class.java)
            .putExtra("screen", screen).putExtra("role", role).putExtra("pending_photo", pending)
            .putExtra("disable_native_ripple", true).putExtra("fixture_host", "127.0.0.1").putExtra("fixture_port", fixtures.port)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun prepareResponse(pending: Boolean) {
        fixtures.close()
        val json = if (pending) """{"status":"pending","approved_url":"$approvedUrl","pending_url":"$pendingUrl"}"""
            else """{"status":"approved","approved_url":"$approvedUrl","pending_url":null}"""
        fixtures = VisualFixtures(mapOf("/api/profile/photo" to json))
    }

    private fun registerPhotos() {
        Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888).apply { eraseColor(android.graphics.Color.rgb(18, 90, 154)) }
            .let { RemoteImageMemory.put(approvedUrl, it.asImageBitmap()) }
        Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888).apply { eraseColor(android.graphics.Color.rgb(240, 80, 110)) }
            .let { RemoteImageMemory.put(pendingUrl, it.asImageBitmap()) }
    }

    private fun assertApprovedPhotoInHeader(caseName: String) {
        val avatar = compose.onNodeWithContentDescription("Abrir meu perfil").assertIsDisplayed().assertHasClickAction()
        avatar.assertHeightIsAtLeast(48.dp).assertWidthIsAtLeast(48.dp)
        // Usa o renderer Robolectric da suíte, sem o PixelCopy de um aparelho real.
        val file = File(out, "photo-avatar-$caseName.png")
        avatar.captureRoboImage(file.absolutePath)
        val image = BitmapFactory.decodeFile(file.absolutePath)
        assertNotNull("O avatar precisa ser renderizado", image)
        val center = image.getPixel(image.width / 2, image.height / 2)
        assertEquals(18f, android.graphics.Color.red(center).toFloat(), 6f)
        assertEquals(90f, android.graphics.Color.green(center).toFloat(), 6f)
        assertEquals(154f, android.graphics.Color.blue(center).toFloat(), 6f)
        image.recycle()
    }

    private fun awaitUpload(state: FsyAppState) {
        // O retorno de Dispatchers.IO é enfileirado no Looper Android, separado do
        // relógio Compose. Drena essa fila como os testes de revalidação de perfil.
        val deadline = System.nanoTime() + 10_000_000_000L
        while (state.isPhotoBusy && System.nanoTime() < deadline) {
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(25))
            Thread.sleep(10)
        }
        assertFalse("O envio precisa terminar; estado=${state.profilePhoto.status}, erro=${state.photoError}", state.isPhotoBusy)
        assertNull("O envio não pode falhar", state.photoError)
        compose.waitForIdle()
    }

    @Test fun staffUploadUpdatesTheSameApprovedAvatarAcrossTheMainTabs() {
        prepareResponse(pending = false)
        launch("home", "consultor").use { scenario ->
            lateinit var state: FsyAppState
            scenario.onActivity { activity ->
                state = activity.state
                registerPhotos()
                state.uploadProfilePhoto(byteArrayOf(-1, -40, -1, 0))
            }
            awaitUpload(state)
            assertEquals("approved", state.profilePhoto.status)
            assertEquals("Foto atualizada.", state.photoSuccessMessage)
            for (tab in listOf(MainTab.HOME, MainTab.AGENDA, MainTab.ANNOUNCEMENTS)) {
                scenario.onActivity { state.selectedTab = tab }
                compose.waitForIdle()
                assertApprovedPhotoInHeader("staff-${tab.key}")
                compose.onNodeWithContentDescription("Abrir meu perfil").performClick()
                compose.onNodeWithText("Sua foto aparece no perfil assim que o envio termina.").assertExists()
                compose.onNodeWithText("Em análise pelo seu consultor").assertDoesNotExist()
                compose.onNodeWithText("Sua foto precisa da aprovação do seu consultor.").assertDoesNotExist()
            }
            compose.onAllNodes(isRoot()).onLast().captureRoboImage(File(out, "staff-photo-approved-more.png").absolutePath)
        }
    }

    @Test fun youthKeepsApprovedHeaderPhotoWhileTheReplacementAwaitsReview() {
        prepareResponse(pending = true)
        launch("home", "jovem").use { scenario ->
            lateinit var state: FsyAppState
            scenario.onActivity { activity -> state = activity.state; registerPhotos(); state.uploadProfilePhoto(byteArrayOf(-1, -40, -1, 0)) }
            awaitUpload(state)
            assertTrue(state.profilePhoto.isPending)
            assertApprovedPhotoInHeader("youth-home-pending")
            compose.onNodeWithContentDescription("Abrir meu perfil").performClick()
            compose.onNodeWithText("Em análise pelo seu consultor").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("Cancelar envio").assertExists()
        }
    }

    @Test fun allOtherRolesAvoidYouthApprovalCopyEvenForLegacyPendingState() {
        for (role in UserRole.entries.filter { it != UserRole.JOVEM }) {
            launch("more", role.wireValue, pending = true).use {
                compose.onNodeWithText("Sua foto precisa da aprovação do seu consultor.").assertDoesNotExist()
                compose.onNodeWithText("Em análise pelo seu consultor").assertDoesNotExist()
                compose.onNodeWithText("Sua foto não foi aprovada").assertDoesNotExist()
                compose.onNodeWithText("Sua foto aparece no perfil assim que o envio termina.").assertExists()
            }
        }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-night-xhdpi")
    fun narrowLargeTextHeaderAndReviewPhotoStayWithinTheViewport() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        launch("agenda", "consultor").use {
            val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
            val avatar = compose.onNodeWithContentDescription("Abrir meu perfil").fetchSemanticsNode().boundsInRoot
            assertTrue(avatar.left >= root.left && avatar.right <= root.right)
            compose.onAllNodesWithText("Agenda").onFirst().assertIsDisplayed()
            compose.onAllNodes(isRoot()).onLast().captureRoboImage(File(out, "photo-agenda-360-dark-font200.png").absolutePath)
            for (weekday in listOf("Sex", "Sáb", "Dom", "Seg", "Ter", "Qua")) {
                val results = mutableListOf<TextLayoutResult>()
                compose.onNodeWithText(weekday, useUnmergedTree = true).performScrollTo()
                    .performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
                assertTrue("O dia $weekday precisa expor sua medição de texto", results.isNotEmpty())
                results.forEach { layout ->
                    // MultiParagraph.width também inclui espaço reservado sem glifos.
                    // Confere a linha efetivamente desenhada e todos os seus caracteres.
                    assertEquals("O dia $weekday precisa caber em uma linha", 1, layout.lineCount)
                    assertEquals("O dia $weekday precisa mostrar todas as letras", weekday.length, layout.getLineEnd(0, visibleEnd = true))
                    val fits = layout.getLineLeft(0) >= -1f && layout.getLineRight(0) <= layout.size.width + 1f &&
                        layout.getLineTop(0) >= -1f && layout.getLineBottom(0) <= layout.size.height + 1f
                    assertTrue("O dia $weekday não pode cortar glifos: caixa=${layout.size}, linha=${layout.getLineLeft(0)}..${layout.getLineRight(0)} × ${layout.getLineTop(0)}..${layout.getLineBottom(0)}", fits)
                }
            }
        }
        launch("counselor", "consultor").use {
            val image = compose.onNodeWithContentDescription("Foto enviada por Jovem Exemplo").performScrollTo()
            val bounds = image.fetchSemanticsNode().boundsInRoot
            val root = compose.onRoot().fetchSemanticsNode().boundsInRoot
            assertTrue(bounds.left >= root.left && bounds.right <= root.right)
            assertTrue(abs(bounds.width - bounds.height) <= 1.5f)
            compose.onAllNodes(isRoot()).onLast().captureRoboImage(File(out, "photo-review-360-dark-font200.png").absolutePath)
            compose.onNodeWithText("Não aprovar").performScrollTo().assertIsDisplayed()
        }
    }

    @Test fun expiredSignedUrlRefreshesOnceWithoutLooping() {
        prepareResponse(pending = false)
        launch("home", "jovem").use { scenario ->
            lateinit var state: FsyAppState
            scenario.onActivity { activity ->
                state = activity.state
                registerPhotos()
            }
            val initialCount = state.profilePhotoFetchCount
            scenario.onActivity { state.refreshProfilePhoto(fromImageError = true) }
            val deadline = System.nanoTime() + 5_000_000_000L
            while (state.profilePhotoFetchCount == initialCount && System.nanoTime() < deadline) {
                shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(25))
                Thread.sleep(10)
            }
            assertEquals("Deve buscar nova URL assinada exatamente uma vez após erro de imagem", initialCount + 1, state.profilePhotoFetchCount)
            assertEquals(approvedUrl, state.profilePhoto.approvedUrl)
            assertEquals(approvedUrl, state.profile?.avatarUrl)

            // Se a nova URL também falhar em seguida, não deve entrar em loop infinito
            scenario.onActivity { state.refreshProfilePhoto(fromImageError = true) }
            shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(100))
            assertEquals("Não deve repetir a busca em loop para erro consecutivo de imagem", initialCount + 1, state.profilePhotoFetchCount)

            // Uma atualização explícita (ex.: retorno ao primeiro plano) volta a permitir renovação
            scenario.onActivity { state.refreshProfilePhoto(fromImageError = false) }
            val secondDeadline = System.nanoTime() + 5_000_000_000L
            while (state.profilePhotoFetchCount == initialCount + 1 && System.nanoTime() < secondDeadline) {
                shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(25))
                Thread.sleep(10)
            }
            assertEquals(initialCount + 2, state.profilePhotoFetchCount)
        }
    }

    @Test fun photoOperationsSurfacePortugueseMessageOn401And403() {
        val server = java.net.ServerSocket(0)
        var statusToReturn = 403
        val worker = kotlin.concurrent.thread(isDaemon = true) {
            while (!server.isClosed) {
                val client = try { server.accept() } catch (_: Exception) { break }
                client.use {
                    val reader = it.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                    reader.readLine() ?: return@use
                    var length = 0
                    while (true) {
                        val line = reader.readLine() ?: break
                        if (line.isEmpty()) break
                        if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                    }
                    repeat(length) { reader.read() }
                    val bodyText = if (statusToReturn == 401) """{"error":"Unauthorized"}""" else """{"error":"Forbidden"}"""
                    val body = bodyText.toByteArray(Charsets.UTF_8)
                    val statusLine = if (statusToReturn == 401) "401 Unauthorized" else "403 Forbidden"
                    it.getOutputStream().apply {
                        write("HTTP/1.1 $statusLine\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(body)
                        flush()
                    }
                }
            }
        }
        try {
            val context = ApplicationProvider.getApplicationContext<Context>()
            ActivityScenario.launch<VisualQaActivity>(
                Intent(context, VisualQaActivity::class.java)
                    .putExtra("screen", "more")
                    .putExtra("role", "jovem")
                    .putExtra("disable_native_ripple", true)
                    .putExtra("fixture_host", "127.0.0.1")
                    .putExtra("fixture_port", server.localPort)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ).use { scenario ->
                lateinit var state: FsyAppState
                scenario.onActivity { activity ->
                    state = activity.state
                    state.refreshProfilePhoto(fromImageError = false)
                }
                val deadline = System.nanoTime() + 5_000_000_000L
                while (state.photoError == null && System.nanoTime() < deadline) {
                    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(25))
                    Thread.sleep(10)
                }
                assertEquals("Você não tem permissão para concluir esta ação.", state.photoError)

                statusToReturn = 401
                scenario.onActivity {
                    state.photoError = null
                    state.uploadProfilePhoto(byteArrayOf(-1, -40, -1, 0))
                }
                val secondDeadline = System.nanoTime() + 5_000_000_000L
                while (state.isPhotoBusy && System.nanoTime() < secondDeadline) {
                    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(25))
                    Thread.sleep(10)
                }
                assertEquals("Sua sessão terminou. Entre novamente.", state.photoError)
            }
        } finally {
            server.close()
            worker.join(1000)
        }
    }
}
