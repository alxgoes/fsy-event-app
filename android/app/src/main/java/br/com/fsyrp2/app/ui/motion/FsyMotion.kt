package br.com.fsyrp2.app.ui.motion

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.VisibilityThreshold
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.unit.IntOffset
import br.com.fsyrp2.app.ui.theme.LocalReducedMotion

/**
 * Tokens de movimento FSY, os mesmos da web (`src/lib/motion.ts`).
 *
 * Princípios (traduzidos das referências de motion para interface operacional):
 * - Movimento explica estado, continuidade ou retorno de ação; nunca decoração em laço.
 * - Molas criticamente amortecidas (dampingRatio = 1): chegam sem ultrapassar o destino.
 * - Saída mais curta que a entrada. Nada piscando, nada pulsando sem fim.
 * - Com "Remover animações" do sistema (escala 0), só opacidade curta ou corte seco.
 */
object FsyMotion {
    /** Pressionar: retorno imediato. */
    const val INSTANT_MS = 100
    /** Cor, seleção, foco. */
    const val FAST_MS = 160
    /** Troca de estado (abas, chips, toasts). */
    const val BASE_MS = 220
    /** Reordenação e reflow de lista. */
    const val LAYOUT_MS = 260
    /** Entrada de tela, sheet ou diálogo. */
    const val OVERLAY_ENTER_MS = 300
    /** Saída de tela, sheet ou diálogo. */
    const val OVERLAY_EXIT_MS = 200
    /** Único momento autoral (entrada da identidade no primeiro acesso). */
    const val FOCAL_MS = 520
    /** Em movimento reduzido, a única transição permitida é um fade curto. */
    const val REDUCED_FADE_MS = 150

    /** Desaceleração natural para chegadas confiantes. */
    val EaseOut: Easing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)
    /** Aceleração curta para saídas. */
    val EaseIn: Easing = CubicBezierEasing(0.4f, 0f, 1f, 1f)

    /** Deslocamento máximo de uma entrada de tela/conteúdo, em dp. */
    const val ENTER_OFFSET_DP = 12
    /** Escala ao pressionar um elemento tocável. */
    const val PRESS_SCALE = 0.97f
    /** Escala do cartão levantado no arraste. */
    const val LIFT_SCALE = 1.02f
    /** Elevação da sombra do cartão levantado, em dp. */
    const val LIFT_ELEVATION_DP = 8

    /** Rigidez = (frequência natural)²; 14 rad/s ≈ normal, 22 ≈ ágil (referências de motion). */
    const val STIFFNESS_NORMAL = 196f
    const val STIFFNESS_SNAPPY = 484f
}

/** Preferências efetivas de movimento para quem anima. */
@Immutable
data class FsyMotionPreferences(val reduceMotion: Boolean)

@Composable
@ReadOnlyComposable
fun fsyMotionPreferences(): FsyMotionPreferences = FsyMotionPreferences(reduceMotion = LocalReducedMotion.current)

/** Mola sem ultrapassagem para valores Float (escala, alfa, deslocamento). */
fun fsySettleSpring(snappy: Boolean = false): SpringSpec<Float> = spring(
    dampingRatio = Spring.DampingRatioNoBouncy,
    stiffness = if (snappy) FsyMotion.STIFFNESS_SNAPPY else FsyMotion.STIFFNESS_NORMAL,
)

/** Reposicionamento de itens de lista (vizinhos que abrem espaço durante o arraste). */
fun fsyItemPlacementSpec(reduceMotion: Boolean): FiniteAnimationSpec<IntOffset> =
    if (reduceMotion) snap() else spring(
        dampingRatio = Spring.DampingRatioNoBouncy,
        stiffness = FsyMotion.STIFFNESS_SNAPPY,
        visibilityThreshold = IntOffset.VisibilityThreshold,
    )

/** Tween padrão para troca de estado; corte seco em movimento reduzido. */
fun <T> fsyStateTween(reduceMotion: Boolean, durationMs: Int = FsyMotion.BASE_MS): AnimationSpec<T> =
    if (reduceMotion) snap() else tween(durationMillis = durationMs, easing = FsyMotion.EaseOut)

/** Fade usado como substituto de qualquer deslocamento quando o movimento é reduzido. */
fun <T> fsyReducedFade(): FiniteAnimationSpec<T> = tween(durationMillis = FsyMotion.REDUCED_FADE_MS, easing = LinearEasing)
