package br.com.fsyrp2.app.ui.theme

import android.provider.Settings
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fsyrp2.app.R

/*
 * Tema nativo FSY Sessão Ribeirão Preto 2 — "Papel e Arco".
 *
 * Fatos oficiais (guia FSY 2027 / DESIGN.md): azul #007DA5, sol #FFE48A, coral #FC4E6D,
 * papel quente #FAF8F5, grafite #0F172A, ouro do templo #DBBF6B (só no templo).
 *
 * Causa raiz do roxo anterior: o esquema definia ~14 dos 36 papéis do Material 3; os
 * demais (secondaryContainer do indicador da barra de navegação, surfaceContainer*,
 * outline*, inverse*, error*) caíam na paleta-base roxa do M3. Aqui TODOS os papéis são
 * mapeados explicitamente, sem cor dinâmica do papel de parede. O escuro é desenhado
 * (grafite-azulado com primário céu), não uma inversão.
 */

// --- Cores oficiais ---------------------------------------------------------------
val FsyParchment = Color(0xFFFAF8F5)
val FsyWarmCream = FsyParchment
val FsySurfaceLight = Color(0xFFFFFFFF)
val FsyAzul = Color(0xFF007DA5)
val FsyAzulDark = Color(0xFF005E7C)
val FsyAzulDarkTheme = Color(0xFF7DE3F4)
val FsyTeal = FsyAzul
val FsyTealDark = FsyAzulDark
val FsySunshine = Color(0xFFFFE48A)
val FsyFlameGold = FsySunshine
val FsyCoral = Color(0xFFFC4E6D)
val FsyGraphite = Color(0xFF0F172A)
val FsyTempleGold = Color(0xFFDBBF6B)
val FsyNeutral5 = Color(0xFFEFEFE7)
val FsyParchmentDeep = Color(0xFFF5EFCA)
val FsyNavyDark = Color(0xFF0B1220)
val FsyNavySurface = Color(0xFF121B2B)
val FsyTextPrimaryLight = FsyGraphite
val FsyTextSecondaryLight = Color(0xFF475569)

// --- Tipografia ---------------------------------------------------------------------
/** Libre Baskerville (SIL OFL 1.1), empacotada em res/font. Obrigatória para marca e títulos. */
val LibreBaskervilleFontFamily = FontFamily(
    Font(resId = R.font.libre_baskerville, weight = FontWeight.Normal),
    Font(resId = R.font.libre_baskerville, weight = FontWeight.Bold),
)

/** Sans de interface: a face do sistema (Roboto/Google Sans), limpa e legível em 200%. */
private val InterfaceSans = FontFamily.Default

val TabularBodyStyle = TextStyle(
    fontFamily = InterfaceSans,
    fontFeatureSettings = "tnum",
)

val TabularTextStyle = TabularBodyStyle

private val FsyTypography = Typography(
    displayLarge = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 44.sp, lineHeight = 52.sp),
    displayMedium = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 36.sp, lineHeight = 44.sp),
    displaySmall = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 30.sp, lineHeight = 38.sp),
    headlineLarge = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 36.sp),
    headlineMedium = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 32.sp),
    headlineSmall = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = LibreBaskervilleFontFamily, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp, fontFeatureSettings = "tnum"),
    labelMedium = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.2.sp, fontFeatureSettings = "tnum"),
    labelSmall = TextStyle(fontFamily = InterfaceSans, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.4.sp, fontFeatureSettings = "tnum"),
)

private val FsyShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

// --- Esquemas completos ---------------------------------------------------------------
private val LightColorScheme: ColorScheme = lightColorScheme(
    primary = FsyAzul,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD9EFF6),
    onPrimaryContainer = Color(0xFF003F55),
    inversePrimary = FsyAzulDarkTheme,
    secondary = FsySunshine,
    onSecondary = FsyGraphite,
    secondaryContainer = FsySunshine,
    onSecondaryContainer = FsyGraphite,
    tertiary = FsyCoral,
    onTertiary = FsyGraphite,
    tertiaryContainer = Color(0xFFFFE2E7),
    onTertiaryContainer = Color(0xFF7A1028),
    background = FsyParchment,
    onBackground = FsyGraphite,
    surface = FsySurfaceLight,
    onSurface = FsyGraphite,
    surfaceVariant = Color(0xFFF1EDE4),
    onSurfaceVariant = FsyTextSecondaryLight,
    surfaceTint = Color.Transparent,
    inverseSurface = Color(0xFF1E293B),
    inverseOnSurface = Color(0xFFF8FAFC),
    error = Color(0xFFB91C1C),
    onError = Color.White,
    errorContainer = Color(0xFFFDECEC),
    onErrorContainer = Color(0xFF7F1D1D),
    outline = Color(0xFF8A8276),
    outlineVariant = Color(0xFFE5E0D6),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFFFFFFFF),
    surfaceDim = Color(0xFFECE8E1),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFFCFBF9),
    surfaceContainer = Color(0xFFF6F3EE),
    surfaceContainerHigh = Color(0xFFF1EDE6),
    surfaceContainerHighest = Color(0xFFEBE6DE),
)

private val DarkColorScheme: ColorScheme = darkColorScheme(
    primary = FsyAzulDarkTheme,
    onPrimary = FsyGraphite,
    primaryContainer = Color(0xFF00455C),
    onPrimaryContainer = Color(0xFFCDF6FD),
    inversePrimary = FsyAzul,
    secondary = FsySunshine,
    onSecondary = FsyGraphite,
    secondaryContainer = Color(0xFF3B3316),
    onSecondaryContainer = FsySunshine,
    tertiary = FsyCoral,
    onTertiary = FsyGraphite,
    tertiaryContainer = Color(0xFF5A1424),
    onTertiaryContainer = Color(0xFFFFD9DF),
    background = FsyNavyDark,
    onBackground = Color(0xFFF1F5F9),
    surface = FsyNavySurface,
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF1E2A3D),
    onSurfaceVariant = Color(0xFFB8C3D3),
    surfaceTint = Color.Transparent,
    inverseSurface = Color(0xFFE2E8F0),
    inverseOnSurface = FsyGraphite,
    error = Color(0xFFFCA5A5),
    onError = Color(0xFF450A0A),
    errorContainer = Color(0xFF5B1414),
    onErrorContainer = Color(0xFFFECACA),
    outline = Color(0xFF7C8BA1),
    outlineVariant = Color(0xFF26344A),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFF2A374C),
    surfaceDim = FsyNavyDark,
    surfaceContainerLowest = Color(0xFF080D17),
    surfaceContainerLow = Color(0xFF0F1726),
    surfaceContainer = Color(0xFF141E30),
    surfaceContainerHigh = Color(0xFF1A2538),
    surfaceContainerHighest = Color(0xFF202D42),
)

/** Cores de estado que o Material não modela (sucesso, atenção, link, saudação). */
@Immutable
data class FsyExtendedColors(
    val success: Color,
    val onSuccessContainer: Color,
    val successContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val link: Color,
    /** Faixa de saudação: #005E7C com branco (7,26:1). */
    val hero: Color,
    val onHero: Color,
    val templeGold: Color,
    val isDark: Boolean,
)

private val LightExtended = FsyExtendedColors(
    success = Color(0xFF247443),
    successContainer = Color(0xFFE8F5DC),
    onSuccessContainer = Color(0xFF1F4D12),
    warning = Color(0xFF8B5700),
    warningContainer = Color(0xFFFFF4D1),
    onWarningContainer = Color(0xFF5C3A00),
    link = FsyAzulDark,
    hero = FsyAzulDark,
    onHero = Color.White,
    templeGold = FsyTempleGold,
    isDark = false,
)

private val DarkExtended = FsyExtendedColors(
    success = Color(0xFFA7DC7A),
    successContainer = Color(0xFF17280D),
    onSuccessContainer = Color(0xFFD6F0BC),
    warning = Color(0xFFFFD27A),
    warningContainer = Color(0xFF33260A),
    onWarningContainer = Color(0xFFFFE9B8),
    link = FsyAzulDarkTheme,
    hero = Color(0xFF0B3A4C),
    onHero = Color(0xFFF1F5F9),
    templeGold = FsyTempleGold,
    isDark = true,
)

val LocalFsyColors = staticCompositionLocalOf { LightExtended }

object FsyPalette {
    val PrimarySky: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.primary
    val AccentCoral: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.tertiary
    val SecondarySunshine: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.secondary
    val DeepText: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.onSurface
    val Danger: Color @Composable @ReadOnlyComposable get() = MaterialTheme.colorScheme.error
    val Success: Color @Composable @ReadOnlyComposable get() = LocalFsyColors.current.success
    val Warning: Color @Composable @ReadOnlyComposable get() = LocalFsyColors.current.warning
    val Link: Color @Composable @ReadOnlyComposable get() = LocalFsyColors.current.link
    val Extended: FsyExtendedColors @Composable @ReadOnlyComposable get() = LocalFsyColors.current
}

val LocalReducedMotion = staticCompositionLocalOf { false }

/**
 * Aparência: Automático (padrão, segue o celular), Claro ou Escuro — ver FsyAppearance.
 * Ambos os esquemas são deliberados e completos; nunca usa cor dinâmica do papel de parede.
 */
@Composable
fun FsyTheme(
    darkTheme: Boolean = fsyEffectiveDarkTheme(),
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

    FsySystemBarsEffect(darkTheme)
    CompositionLocalProvider(
        LocalReducedMotion provides reducedMotion,
        LocalFsyColors provides if (darkTheme) DarkExtended else LightExtended,
    ) {
        MaterialTheme(
            colorScheme = (if (darkTheme) DarkColorScheme else LightColorScheme).animated(reducedMotion),
            typography = FsyTypography,
            shapes = FsyShapes,
            content = content,
        )
    }
}

/** Troca de aparência: as cores mais visíveis fazem transição de 220 ms; corte seco em movimento reduzido. */
@Composable
private fun ColorScheme.animated(reduce: Boolean): ColorScheme {
    val spec: androidx.compose.animation.core.AnimationSpec<Color> =
        if (reduce) androidx.compose.animation.core.snap() else androidx.compose.animation.core.tween(220)
    return copy(
        primary = animC(primary, spec, "p"),
        onPrimary = animC(onPrimary, spec, "op"),
        primaryContainer = animC(primaryContainer, spec, "pc"),
        onPrimaryContainer = animC(onPrimaryContainer, spec, "opc"),
        secondaryContainer = animC(secondaryContainer, spec, "sc"),
        onSecondaryContainer = animC(onSecondaryContainer, spec, "osc"),
        background = animC(background, spec, "bg"),
        onBackground = animC(onBackground, spec, "obg"),
        surface = animC(surface, spec, "s"),
        onSurface = animC(onSurface, spec, "os"),
        onSurfaceVariant = animC(onSurfaceVariant, spec, "osv"),
        outlineVariant = animC(outlineVariant, spec, "ov"),
        surfaceContainerLowest = animC(surfaceContainerLowest, spec, "scl"),
        surfaceContainerHigh = animC(surfaceContainerHigh, spec, "sch"),
    )
}

@Composable
private fun animC(c: Color, spec: androidx.compose.animation.core.AnimationSpec<Color>, label: String): Color =
    androidx.compose.animation.animateColorAsState(c, spec, label = label).value
