package br.com.fsyrp2.app.ui.motion

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

/**
 * Entrada de tela/conteúdo: fade + deslocamento curto vindo de baixo (12 dp), 300 ms.
 * Em movimento reduzido: só fade de 150 ms.
 */
@Composable
fun fsyEnter(reduceMotion: Boolean = fsyMotionPreferences().reduceMotion): EnterTransition {
    if (reduceMotion) return fadeIn(fsyReducedFade())
    val offsetPx = with(LocalDensity.current) { FsyMotion.ENTER_OFFSET_DP.dp.roundToPx() }
    return fadeIn(tween(FsyMotion.OVERLAY_ENTER_MS, easing = FsyMotion.EaseOut)) +
        slideInVertically(tween(FsyMotion.OVERLAY_ENTER_MS, easing = FsyMotion.EaseOut)) { offsetPx }
}

/** Saída mais curta que a entrada: 200 ms, sem deslocamento longo. */
@Composable
fun fsyExit(reduceMotion: Boolean = fsyMotionPreferences().reduceMotion): ExitTransition {
    if (reduceMotion) return fadeOut(fsyReducedFade())
    val offsetPx = with(LocalDensity.current) { (FsyMotion.ENTER_OFFSET_DP / 2).dp.roundToPx() }
    return fadeOut(tween(FsyMotion.OVERLAY_EXIT_MS, easing = FsyMotion.EaseIn)) +
        slideOutVertically(tween(FsyMotion.OVERLAY_EXIT_MS, easing = FsyMotion.EaseIn)) { -offsetPx }
}

/**
 * Troca de conteúdo dentro do mesmo contêiner (ex.: dia da programação, filtro de avisos).
 * O contêiner continua no lugar; o conteúdo antigo sai antes de o novo entrar, para os
 * textos não se sobreporem. Use com `AnimatedContent(transitionSpec = { fsyContentSwap(reduce) })`.
 */
fun <S> AnimatedContentTransitionScope<S>.fsyContentSwap(reduceMotion: Boolean): ContentTransform {
    if (reduceMotion) {
        return (fadeIn(fsyReducedFade()) togetherWith fadeOut(fsyReducedFade())).using(SizeTransform(clip = false))
    }
    val enter = fadeIn(tween(FsyMotion.BASE_MS, delayMillis = FsyMotion.INSTANT_MS, easing = FsyMotion.EaseOut))
    val exit = fadeOut(tween(FsyMotion.INSTANT_MS, easing = FsyMotion.EaseIn))
    return (enter togetherWith exit).using(SizeTransform(clip = false) { _, _ -> tween(FsyMotion.BASE_MS, easing = FsyMotion.EaseOut) })
}

/**
 * Retorno de toque: o elemento afunda levemente (0,97) enquanto pressionado e volta com
 * mola sem ultrapassagem. Combine com a ondulação (ripple) do Material; em movimento
 * reduzido mantém só a ondulação.
 */
@Composable
fun Modifier.fsyPressScale(interactionSource: InteractionSource, enabled: Boolean = true): Modifier {
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (enabled && pressed && !reduceMotion) FsyMotion.PRESS_SCALE else 1f,
        animationSpec = fsySettleSpring(snappy = true),
        label = "fsyPressScale",
    )
    return graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}

/** Duração da troca de tela empilhada (Fotos, Notificações, Conselheiro, Gestão). */
const val FSY_PUSH_MS = 250

/**
 * Tela empilhada: a nova entra deslizando 1/5 da largura a partir da direita com fade
 * (250 ms, desaceleração); ao voltar, o inverso. A tela de baixo só esmaece e recua 1/12,
 * sem atravessar a tela inteira. Movimento reduzido: só fade de 150 ms.
 */
fun <S> AnimatedContentTransitionScope<S>.fsyPushTransition(forward: Boolean, reduceMotion: Boolean): ContentTransform {
    if (reduceMotion) {
        return (fadeIn(fsyReducedFade()) togetherWith fadeOut(fsyReducedFade())).using(SizeTransform(clip = false))
    }
    val enterSpec = tween<androidx.compose.ui.unit.IntOffset>(FSY_PUSH_MS, easing = FsyMotion.EaseOut)
    val exitSpec = tween<androidx.compose.ui.unit.IntOffset>(FSY_PUSH_MS - 50, easing = FsyMotion.EaseIn)
    return if (forward) {
        (androidx.compose.animation.slideInHorizontally(enterSpec) { it / 5 } + fadeIn(tween(FSY_PUSH_MS, easing = FsyMotion.EaseOut))) togetherWith
            (androidx.compose.animation.slideOutHorizontally(exitSpec) { -it / 12 } + fadeOut(tween(FSY_PUSH_MS - 50, easing = FsyMotion.EaseIn)))
    } else {
        (androidx.compose.animation.slideInHorizontally(enterSpec) { -it / 12 } + fadeIn(tween(FSY_PUSH_MS, easing = FsyMotion.EaseOut))) togetherWith
            (androidx.compose.animation.slideOutHorizontally(exitSpec) { it / 5 } + fadeOut(tween(FSY_PUSH_MS - 50, easing = FsyMotion.EaseIn)))
    }.using(SizeTransform(clip = false))
}
