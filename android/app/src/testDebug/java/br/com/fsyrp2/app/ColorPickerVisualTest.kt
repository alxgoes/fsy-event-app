package br.com.fsyrp2.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.ui.components.FsyColorPicker
import br.com.fsyrp2.app.ui.theme.FsyTheme
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h900dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ColorPickerVisualTest {
    @get:Rule val compose = createComposeRule()
    private val out = File("build/outputs/visual-qa").apply { mkdirs() }

    @Test fun pickerUsesPresetsAndWheelWithoutHexField() {
        var chosen = "#007DA5"
        compose.setContent {
            FsyTheme(darkTheme = false) {
                var value by remember { mutableStateOf(chosen) }
                Box(Modifier.background(MaterialTheme.colorScheme.surface).padding(16.dp)) {
                    FsyColorPicker(selectedHex = value, onSelect = { value = it; chosen = it })
                }
            }
        }
        compose.onRoot().captureRoboImage(File(out, "company-color-presets.png").absolutePath)
        compose.onNodeWithContentDescription("Coral").performClick()
        assertEquals("#FC4E6D", chosen)
        compose.onNodeWithText("Outra cor (roda de cores)").performClick()
        compose.onNodeWithContentDescription("Roda de cores: toque ou arraste para escolher").performClick()
        assert(chosen.matches(Regex("^#[0-9A-F]{6}$"))) { "cor inválida: $chosen" }
        compose.onRoot().captureRoboImage(File(out, "company-color-wheel.png").absolutePath)
    }
}
