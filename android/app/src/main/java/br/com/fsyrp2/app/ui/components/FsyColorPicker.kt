package br.com.fsyrp2.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.ui.icons.FsyIcons
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

/** Cores sugeridas para companhias, tiradas da paleta oficial FSY 2027 (nome em pt-BR para leitor de tela). */
val FsyCompanyColorPresets: List<Pair<String, String>> = listOf(
    "Azul oceano" to "#007DA5",
    "Azul profundo" to "#005E7C",
    "Ciano" to "#01B6D1",
    "Céu" to "#7DE3F4",
    "Coral" to "#FC4E6D",
    "Salmão" to "#FDA192",
    "Laranja" to "#F68D2E",
    "Ferrugem" to "#D45311",
    "Amarelo" to "#FFB81C",
    "Sol" to "#FFE48A",
    "Verde folha" to "#6DB344",
    "Verde lima" to "#93C742",
)

fun parseHexColorOrNull(hex: String?): Color? {
    val clean = hex?.trim()?.removePrefix("#") ?: return null
    if (clean.length != 6 || clean.any { it.lowercaseChar() !in "0123456789abcdef" }) return null
    return Color(("FF$clean").toLong(16))
}

fun Color.toHexRgb(): String = String.format("#%06X", toArgb() and 0xFFFFFF)

/**
 * Escolha da cor da companhia sem digitar código: tabela de cores oficiais e, em "Outra cor",
 * uma roda de cores (matiz e intensidade) com ajuste de brilho. Devolve sempre "#RRGGBB".
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FsyColorPicker(
    selectedHex: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val current = parseHexColorOrNull(selectedHex) ?: Color(0xFF007DA5)
    val isPreset = FsyCompanyColorPresets.any { it.second.equals(current.toHexRgb(), ignoreCase = true) }
    var showWheel by remember { mutableStateOf(!isPreset) }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Cor da companhia", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        ColorPreview(current)

        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            FsyCompanyColorPresets.forEach { (name, hex) ->
                val color = parseHexColorOrNull(hex)!!
                val isSelected = hex.equals(current.toHexRgb(), ignoreCase = true)
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .border(if (isSelected) 3.dp else 1.dp, if (isSelected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.outlineVariant, CircleShape)
                        .padding(if (isSelected) 5.dp else 0.dp)
                        .clip(CircleShape)
                        .semantics { contentDescription = name; selected = isSelected }
                        .clickable(role = Role.RadioButton) { onSelect(hex) },
                    contentAlignment = Alignment.Center,
                ) {
                    Canvas(Modifier.matchParentSizeCompat()) { drawRect(color) }
                    if (isSelected) {
                        Icon(FsyIcons.Check, contentDescription = null, tint = if (color.luminance() > 0.5f) Color(0xFF0F172A) else Color.White, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        FsyTextButton(onClick = { showWheel = !showWheel }) {
            Text(if (showWheel) "Esconder roda de cores" else "Outra cor (roda de cores)")
        }
        if (showWheel) {
            ColorWheel(selected = current, onSelect = { onSelect(it.toHexRgb()) })
        }
    }
}

@Composable
private fun ColorPreview(color: Color) {
    Surface(color = color, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Companhia",
            color = if (color.luminance() > 0.5f) Color(0xFF0F172A) else Color.White,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

@Composable
private fun ColorWheel(selected: Color, onSelect: (Color) -> Unit) {
    val hsv = remember(selected) { FloatArray(3).also { android.graphics.Color.colorToHSV(selected.toArgb(), it) } }
    var hue by remember(selected) { mutableFloatStateOf(hsv[0]) }
    var saturation by remember(selected) { mutableFloatStateOf(hsv[1]) }
    var brightness by remember(selected) { mutableFloatStateOf(hsv[2].coerceAtLeast(0.35f)) }
    fun emit() = onSelect(Color(android.graphics.Color.HSVToColor(floatArrayOf(hue, saturation, brightness))))

    Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .widthIn(max = 260.dp)
                .fillMaxWidth()
                .aspectRatio(1f)
                .semantics { contentDescription = "Roda de cores: toque ou arraste para escolher" },
        ) {
            fun pick(pos: Offset, w: Float, h: Float) {
                val cx = w / 2f; val cy = h / 2f
                val r = min(cx, cy)
                val dx = pos.x - cx; val dy = pos.y - cy
                hue = ((Math.toDegrees(atan2(dy, dx).toDouble()) + 360.0) % 360.0).toFloat()
                saturation = (hypot(dx, dy) / r).coerceIn(0f, 1f)
                emit()
            }
            Canvas(
                modifier = Modifier
                    .matchParentSizeCompat()
                    .pointerInput(Unit) { detectTapGestures { pick(it, size.width.toFloat(), size.height.toFloat()) } }
                    .pointerInput(Unit) { detectDragGestures { change, _ -> pick(change.position, size.width.toFloat(), size.height.toFloat()) } },
            ) {
                val radius = min(size.width, size.height) / 2f
                val hues = (0..360 step 30).map { Color(android.graphics.Color.HSVToColor(floatArrayOf(it.toFloat(), 1f, brightness))) }
                drawCircle(Brush.sweepGradient(hues, center), radius)
                drawCircle(Brush.radialGradient(listOf(Color(android.graphics.Color.HSVToColor(floatArrayOf(0f, 0f, brightness))), Color.Transparent), center, radius), radius)
                val angle = Math.toRadians(hue.toDouble())
                val marker = Offset(center.x + (cos(angle) * saturation * radius).toFloat(), center.y + (sin(angle) * saturation * radius).toFloat())
                drawCircle(Color.White, 12.dp.toPx(), marker, style = Stroke(4.dp.toPx()))
                drawCircle(Color(0xFF0F172A), 12.dp.toPx(), marker, style = Stroke(1.5.dp.toPx()))
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Brilho", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(end = 12.dp))
            Slider(
                value = brightness,
                onValueChange = { brightness = it; emit() },
                valueRange = 0.35f..1f,
                modifier = Modifier.weight(1f).semantics { contentDescription = "Brilho da cor" },
            )
        }
    }
}

/** Preenche o pai sem depender de BoxScope (usado dentro de Box). */
private fun Modifier.matchParentSizeCompat(): Modifier = this.then(Modifier.fillMaxWidth().aspectRatio(1f))
