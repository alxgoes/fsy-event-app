package br.com.fsyrp2.app

import android.content.Context
import android.content.Intent
import androidx.activity.compose.setContent
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LocalRippleConfiguration
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import br.com.fsyrp2.app.model.AdminAccountDto
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.ui.screens.admin.AccountEditDialog
import br.com.fsyrp2.app.ui.theme.FsyTheme
import br.com.fsyrp2.app.ui.theme.FsyAppearance
import br.com.fsyrp2.app.ui.theme.FsyThemeMode
import com.github.takahirom.roborazzi.captureRoboImage
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h800dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@OptIn(ExperimentalMaterial3Api::class)
class AccountRoleUiTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val account = AdminAccountDto("synthetic-target", fullName = "Pessoa Fictícia", role = "jovem", email = "pessoa@example.invalid")

    @Before fun resetDisplaySettings() {
        org.robolectric.RuntimeEnvironment.setFontScale(1f)
        FsyAppearance.update(ApplicationProvider.getApplicationContext(), FsyThemeMode.SYSTEM)
    }

    @After fun restoreDisplaySettings() {
        org.robolectric.RuntimeEnvironment.setFontScale(1f)
    }

    private fun open(actions: Set<String>, onPatch: (JsonObject) -> Unit = {}): ActivityScenario<VisualQaActivity> {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val intent = Intent(context, VisualQaActivity::class.java).putExtra("screen", "auth")
            .putExtra("disable_native_ripple", true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return ActivityScenario.launch<VisualQaActivity>(intent).also { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    FsyTheme {
                        CompositionLocalProvider(LocalRippleConfiguration provides null) {
                            AccountEditDialog(
                                account = account, actions = actions, actorRole = UserRole.LOGISTICA,
                                busy = false, errorMessage = null, feedback = null,
                                onDismiss = {}, onSavePatch = onPatch, onSetPassword = {}, onSendRecovery = {},
                                onSendEmail = { _, _ -> }, onDeleteAccount = {}
                            )
                        }
                    }
                }
            }
        }
    }

    @Test fun managerChoosesPortugueseRoleAndSendsItsCanonicalValue() {
        var patch: JsonObject? = null
        open(setOf("role")) { patch = it }.use {
            compose.onNodeWithText("Aplicar cargo").performScrollTo().assertIsNotEnabled()
            compose.onNodeWithText("Mídia").performScrollTo().performClick()
            compose.onNodeWithText("Aplicar cargo").performScrollTo().assertIsEnabled().performClick()
            compose.runOnIdle {
                assertEquals("role", patch?.get("action")?.jsonPrimitive?.content)
                assertEquals("midia", patch?.get("role")?.jsonPrimitive?.content)
            }
            compose.onNodeWithText("Papel (jovem", substring = true).assertDoesNotExist()
            compose.onNodeWithText("Excluir conta permanentemente").assertDoesNotExist()
        }
    }

    @Test
    fun apiOmittingRoleActionHidesTheWholeRoleEditor() {
        var patch: JsonObject? = null
        open(setOf("edit")) { patch = it }.use {
            compose.onNodeWithText("Cargo no portal").assertDoesNotExist()
            compose.onNodeWithText("Aplicar cargo").assertDoesNotExist()
            compose.onNodeWithText("Nome completo").performTextReplacement("Pessoa Fictícia Editada")
            compose.onNodeWithText("Salvar dados").assertIsEnabled().performClick()
            compose.runOnIdle {
                assertEquals("edit", patch?.get("action")?.jsonPrimitive?.content)
                assertEquals("Pessoa Fictícia Editada", patch?.get("full_name")?.jsonPrimitive?.content)
            }
            compose.onNodeWithText("Definir senha").assertDoesNotExist()
        }
    }

    @Test
    @Config(qualifiers = "w360dp-h800dp-xhdpi")
    fun allRoleChoicesRemainReachableAtTwoHundredPercentFont() {
        org.robolectric.RuntimeEnvironment.setFontScale(2f)
        open(setOf("role")).use {
            UserRole.entries.forEach { role -> compose.onNodeWithText(role.labelPt).performScrollTo().assertIsDisplayed() }
            compose.onNodeWithText("Casal Diretor").performScrollTo().performClick()
            compose.onNodeWithText("Aplicar cargo").performScrollTo().assertIsEnabled()
            val out = File("build/outputs/visual-qa").apply { mkdirs() }
            compose.onAllNodes(isRoot()).onLast().captureRoboImage(File(out, "accounts-role-editor-font200.png").absolutePath)
        }
    }
}
