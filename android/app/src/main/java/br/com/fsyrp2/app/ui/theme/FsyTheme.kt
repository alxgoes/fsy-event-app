package br.com.fsyrp2.app.ui.theme

import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fsyrp2.app.R

// Tokens oficiais FSY Sessão Ribeirão Preto 2 (DESIGN.md & DESIGN-NATIVO.md §1)
val FsyParchment = Color(0xFFFAF8F5)
val FsyWarmCream = FsyParchment
val FsySurfaceLight = Color(0xFFFFFFFF)
val FsyAzul = Color(0xFF007DA5)
val FsyAzulDark = Color(0xFF005E7C)
val FsyAzulDarkTheme = Color(0xFF01B6D1)
val FsyTeal = FsyAzul
val FsyTealDark = FsyAzulDark
val FsySunshine = Color(0xFFFFE48A)
val FsyFlameGold = FsySunshine
val FsyCoral = Color(0xFFFC4E6D)
val FsyGraphite = Color(0xFF0F172A)
val FsyNavyDark = Color(0xFF0B141E)
val FsyNavySurface = Color(0xFF132232)
val FsyTextPrimaryLight = FsyGraphite
val FsyTextSecondaryLight = Color(0xFF334155)

val LibreBaskervilleFontFamily = FontFamily(
    Font(resId = R.font.libre_baskerville, weight = FontWeight.Normal),
    Font(resId = R.font.libre_baskerville, weight = FontWeight.Bold),
)

val TabularBodyStyle = TextStyle(
    fontFamily = FontFamily.Default,
    fontFeatureSettings = "tnum",
)

val TabularTextStyle = TabularBodyStyle

object FsyPalette {
    val PrimarySky: Color @Composable get() = MaterialTheme.colorScheme.primary
    val AccentCoral: Color @Composable get() = MaterialTheme.colorScheme.tertiary
    val SecondarySunshine: Color @Composable get() = MaterialTheme.colorScheme.secondary
    val DeepText: Color @Composable get() = MaterialTheme.colorScheme.onSurface
    val Danger: Color @Composable get() = MaterialTheme.colorScheme.error
    val Success = Color(0xFF247443)
    val Warning = Color(0xFF8B5700)
}

private val FsyTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = LibreBaskervilleFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = LibreBaskervilleFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = LibreBaskervilleFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
        lineHeight = 28.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = LibreBaskervilleFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 26.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontFeatureSettings = "tnum",
    ),
)

private val LightColorScheme = lightColorScheme(
    primary = FsyAzul,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0F2FE),
    onPrimaryContainer = FsyAzulDark,
    secondary = FsySunshine,
    onSecondary = FsyGraphite,
    tertiary = FsyCoral,
    onTertiary = FsyGraphite,
    background = FsyParchment,
    onBackground = FsyGraphite,
    surface = FsySurfaceLight,
    onSurface = FsyGraphite,
    surfaceVariant = Color(0xFFF1EDE4),
    onSurfaceVariant = FsyTextSecondaryLight,
)

private val DarkColorScheme = darkColorScheme(
    primary = FsyAzulDarkTheme,
    onPrimary = FsyGraphite,
    primaryContainer = Color(0xFF0C2733),
    onPrimaryContainer = Color(0xFFE0F2FE),
    secondary = FsySunshine,
    onSecondary = FsyGraphite,
    tertiary = FsyCoral,
    onTertiary = FsyGraphite,
    background = FsyNavyDark,
    onBackground = Color(0xFFF8FAFC),
    surface = FsyNavySurface,
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0xFF1E293B),
    onSurfaceVariant = Color(0xFFCBD5E1),
)

val LocalReducedMotion = staticCompositionLocalOf { false }

/**
 * Letreiro FSY nativo (§1 de DESIGN-NATIVO.md):
 * Três discos (azul/F branco, sol/S grafite, coral/Y grafite), glifo de fonte real,
 * borda de 1,5 dp, sem sombra e sem animação em laço.
 */
@Composable
fun FsyDiscLogo(
    discSize: Dp = 36.dp,
    modifier: Modifier = Modifier,
) {
    val borderColor = FsyGraphite.copy(alpha = 0.18f)
    Row(
        modifier = modifier.semantics {
            contentDescription = "Marca FSY Para a Força dos Jovens"
        },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val items = listOf(
            Triple("F", FsyAzul, Color.White),
            Triple("S", FsySunshine, FsyGraphite),
            Triple("Y", FsyCoral, FsyGraphite),
        )
        items.forEach { (letter, bg, fg) ->
            Box(
                modifier = Modifier
                    .size(discSize)
                    .background(bg, CircleShape)
                    .border(1.5.dp, borderColor, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = letter,
                    color = fg,
                    fontFamily = LibreBaskervilleFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = (discSize.value * 0.48f).sp,
                )
            }
        }
    }
}

@Composable
fun FsyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val reducedMotion = remember(context) {
        val scale = try {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            )
        } catch (_: Exception) {
            1f
        }
        scale == 0f
    }

    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(LocalReducedMotion provides reducedMotion) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = FsyTypography,
            content = content,
        )
    }
}
