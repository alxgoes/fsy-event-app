package br.com.fsyrp2.app.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animate
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.min

/** Posição de layout (sem transformações de desenho) de um cartão, em coordenadas da raiz. */
private data class ItemBounds(val top: Float, val height: Float) {
    val bottom: Float get() = top + height
    val center: Float get() = top + height / 2f
}

/**
 * Estado de reordenação de cartões em uma `Column` (mesma semântica da web):
 * - arraste só pela alça; o cartão levantado segue o dedo e os vizinhos abrem espaço;
 * - cancelamento do gesto (sistema, troca de app, ACTION_CANCEL) devolve a ordem anterior;
 * - `onCommit` recebe a nova ordem só ao soltar (ou em ação de acessibilidade);
 *   persistência e isolamento por conta ficam com o chamador (CardOrderManager).
 */
@Stable
class FsyReorderState internal constructor(
    initialOrder: List<String>,
    private val scope: CoroutineScope,
    private val haptics: FsyHaptics,
    private val reduceMotion: Boolean,
    private val hysteresisPx: Float,
    private val onCommit: (List<String>) -> Unit,
) {
    var order by mutableStateOf(initialOrder)
        private set

    /** Cartão levantado (ou assentando depois de solto). */
    var draggingId by mutableStateOf<String?>(null)
        private set

    /** Deslocamento visual do cartão levantado em relação ao próprio slot. */
    var dragOffsetY by mutableFloatStateOf(0f)
        private set

    /** Verdadeiro só enquanto o dedo está no cartão (não durante o assentamento). */
    var isDragging by mutableStateOf(false)
        private set

    private val bounds = HashMap<String, ItemBounds>()
    private var before: List<String>? = null
    private var settleJob: Job? = null

    /** Atualiza a ordem vinda de fora (servidor/cache) quando não há gesto em andamento. */
    fun syncFrom(external: List<String>) {
        if (draggingId == null && external != order) order = external
    }

    internal fun reportBounds(id: String, top: Float, height: Float) {
        bounds[id] = ItemBounds(top, height)
    }

    internal fun onDragStart(id: String) {
        settleJob?.cancel()
        before = order
        draggingId = id
        dragOffsetY = 0f
        isDragging = true
        haptics.grab()
    }

    internal fun onDrag(deltaY: Float) {
        if (!isDragging) return
        dragOffsetY += deltaY
        retarget()
    }

    /** Rolagem automática: o conteúdo andou, o dedo não; o cartão continua sob o dedo. */
    internal fun onAutoScrolled(consumed: Float) {
        if (!isDragging || consumed == 0f) return
        dragOffsetY += consumed
        bounds.replaceAll { _, b -> b.copy(top = b.top - consumed) }
        retarget()
    }

    private fun retarget() {
        val id = draggingId ?: return
        val current = bounds[id] ?: return
        val index = order.indexOf(id)
        val visualCenter = current.center + dragOffsetY
        if (dragOffsetY > 0f && index < order.lastIndex) {
            val next = bounds[order[index + 1]] ?: return
            if (visualCenter > next.center + hysteresisPx) {
                // O slot do cartão passa a terminar onde o vizinho terminava.
                val shift = next.bottom - current.bottom
                bounds[order[index + 1]] = next.copy(top = current.top)
                bounds[id] = current.copy(top = current.top + shift)
                dragOffsetY -= shift
                order = order.toMutableList().apply { add(index + 1, removeAt(index)) }
                haptics.step()
            }
        } else if (dragOffsetY < 0f && index > 0) {
            val previous = bounds[order[index - 1]] ?: return
            if (visualCenter < previous.center - hysteresisPx) {
                val shift = previous.top - current.top
                bounds[order[index - 1]] = previous.copy(top = current.bottom - previous.height)
                bounds[id] = current.copy(top = previous.top)
                dragOffsetY -= shift
                order = order.toMutableList().apply { add(index - 1, removeAt(index)) }
                haptics.step()
            }
        }
    }

    internal fun onDragEnd() = finish(revert = false)

    internal fun onDragCancel() = finish(revert = true)

    private fun finish(revert: Boolean) {
        if (!isDragging) return
        isDragging = false
        val previous = before
        before = null
        if (revert && previous != null) order = previous
        val committed = !revert && previous != null && previous != order
        if (committed) {
            haptics.drop()
            onCommit(order)
        }
        settleJob = scope.launch {
            if (reduceMotion) {
                dragOffsetY = 0f
            } else {
                animate(dragOffsetY, 0f, animationSpec = fsySettleSpring(snappy = true)) { value, _ -> dragOffsetY = value }
            }
            draggingId = null
        }
    }

    /** Alternativa sem gesto (TalkBack, teclado, botões Subir/Descer). */
    fun moveBy(id: String, delta: Int) {
        if (isDragging) return
        val from = order.indexOf(id)
        if (from < 0) return
        val to = (from + delta).coerceIn(0, order.lastIndex)
        if (to == from) return
        order = order.toMutableList().apply { add(to, removeAt(from)) }
        haptics.tick()
        onCommit(order)
    }

    internal fun draggedBounds(): Pair<Float, Float>? {
        val id = draggingId ?: return null
        val b = bounds[id] ?: return null
        return (b.top + dragOffsetY) to (b.bottom + dragOffsetY)
    }
}

@Composable
fun rememberFsyReorderState(
    initialOrder: List<String>,
    onCommit: (List<String>) -> Unit,
): FsyReorderState {
    val scope = rememberCoroutineScope()
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val hysteresisPx = with(LocalDensity.current) { 16.dp.toPx() }
    val latestCommit by rememberUpdatedState(onCommit)
    return remember(scope, haptics, reduceMotion, hysteresisPx) {
        FsyReorderState(initialOrder, scope, haptics, reduceMotion, hysteresisPx) { latestCommit(it) }
    }
}

/**
 * Aplicar em cada cartão (filho direto da Column), ANTES de outros modificadores de desenho.
 * O cartão levantado é desenhado acima, com escala 1,02 e sombra; os vizinhos deslizam
 * (FLIP) até o novo lugar com mola sem ultrapassagem.
 */
@Composable
fun Modifier.fsyReorderItem(state: FsyReorderState, id: String): Modifier {
    val scope = rememberCoroutineScope()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val flip = remember(id) { Animatable(0f) }
    val lastTop = remember(id) { floatArrayOf(Float.NaN) }
    val elevationPx = with(LocalDensity.current) { FsyMotion.LIFT_ELEVATION_DP.dp.toPx() }
    val isLifted = state.draggingId == id

    return this
        .zIndex(if (isLifted) 1f else 0f)
        .onGloballyPositioned { coordinates ->
            val top = coordinates.positionInRoot().y
            val previousTop = lastTop[0]
            lastTop[0] = top
            state.reportBounds(id, top, coordinates.size.height.toFloat())
            // FLIP: só vizinhos animam a mudança de lugar; o levantado segue o dedo.
            if (!previousTop.isNaN() && state.draggingId != null && state.draggingId != id && !reduceMotion) {
                val moved = previousTop - top
                if (abs(moved) > 0.5f && abs(moved) < 4000f) {
                    scope.launch {
                        flip.snapTo(flip.value + moved)
                        flip.animateTo(0f, fsySettleSpring(snappy = true))
                    }
                }
            }
        }
        .graphicsLayer {
            if (isLifted) {
                translationY = state.dragOffsetY
                val lift = if (reduceMotion || !state.isDragging) 1f else FsyMotion.LIFT_SCALE
                scaleX = lift
                scaleY = lift
                shadowElevation = if (state.isDragging) elevationPx else 0f
            } else {
                translationY = flip.value
            }
        }
}

/**
 * Alça de arraste (alvo mínimo 48 dp fica com o chamador). O arraste começa depois do
 * "touch slop" do sistema, então um toque curto não move nada. Ações de acessibilidade
 * equivalentes são expostas para TalkBack.
 */
fun Modifier.fsyReorderHandle(state: FsyReorderState, id: String, label: String): Modifier = this
    .semantics {
        val position = state.order.indexOf(id) + 1
        contentDescription = "Mover $label. Posição $position de ${state.order.size}."
        customActions = listOf(
            CustomAccessibilityAction("Mover para cima") { state.moveBy(id, -1); true },
            CustomAccessibilityAction("Mover para baixo") { state.moveBy(id, 1); true },
        )
    }
    .pointerInput(state, id) {
        detectDragGestures(
            onDragStart = { state.onDragStart(id) },
            onDragEnd = { state.onDragEnd() },
            onDragCancel = { state.onDragCancel() },
            onDrag = { change, amount ->
                change.consume()
                state.onDrag(amount.y)
            },
        )
    }

/**
 * Rolagem automática enquanto o cartão levantado está a até 80 dp das bordas da área
 * rolável. Velocidade proporcional à proximidade, no máximo 16 dp por quadro.
 * `viewportTop`/`viewportBottom` em coordenadas da raiz (ex.: via onGloballyPositioned).
 */
@Composable
fun FsyReorderAutoScroll(state: FsyReorderState, scrollState: ScrollState, viewportTop: Float, viewportBottom: Float) {
    val density = LocalDensity.current
    val edge = with(density) { 80.dp.toPx() }
    val maxStep = with(density) { 16.dp.toPx() }
    val top by rememberUpdatedState(viewportTop)
    val bottom by rememberUpdatedState(viewportBottom)
    LaunchedEffect(state, state.isDragging) {
        if (!state.isDragging) return@LaunchedEffect
        while (state.isDragging) {
            withFrameNanos { }
            val (itemTop, itemBottom) = state.draggedBounds() ?: continue
            val step = when {
                itemTop < top + edge -> -maxStep * min(1f, (top + edge - itemTop) / edge)
                itemBottom > bottom - edge -> maxStep * min(1f, (itemBottom - (bottom - edge)) / edge)
                else -> 0f
            }
            if (step != 0f) {
                val consumed = scrollState.scrollBy(step)
                state.onAutoScrolled(consumed)
            }
        }
    }
}
