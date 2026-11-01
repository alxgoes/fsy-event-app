package br.com.fsyrp2.app.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.FsyReorderAutoScroll
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyReorderHandle
import br.com.fsyrp2.app.ui.motion.fsyReorderItem
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.motion.rememberFsyReorderState

data class ReorderableCardItem(
    val id: String,
    val title: String,
    val content: @Composable () -> Unit,
)

/**
 * Cartões reordenáveis (`ui/motion/FsyReorder.kt`).
 * - Uso normal: só os cartões, com revelação escalonada na primeira exibição.
 * - "Organizar": os cartões viram linhas compactas (alça de 48 dp para arrastar com o dedo +
 *   botões Subir/Descer para TalkBack e teclado). Linhas curtas tornam o arraste preciso.
 * - FLIP sem ultrapassagem, rolagem automática nas bordas, persistência só no commit.
 */
@Composable
fun ReorderableCardSection(
    pageKey: String,
    defaultIds: List<String>,
    orderedIds: List<String>,
    onOrderChange: (List<String>) -> Unit,
    cards: List<ReorderableCardItem>,
    scrollState: ScrollState? = null,
    viewportTopPx: Float? = null,
    viewportBottomPx: Float? = null,
    modifier: Modifier = Modifier,
    revealOffset: Int = 2,
    reveal: (Modifier.(Int) -> Modifier) = { i -> fsyReveal(i) },
) {
    var editing by remember { mutableStateOf(false) }
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val resolvedOrder = remember(defaultIds, orderedIds) {
        CardOrderManager.resolveOrder(defaultIds, orderedIds)
    }
    val reorder = rememberFsyReorderState(resolvedOrder) { newOrder ->
        onOrderChange(CardOrderManager.resolveOrder(defaultIds, newOrder))
    }
    LaunchedEffect(resolvedOrder) {
        reorder.syncFrom(resolvedOrder)
    }

    val isDefault = remember(defaultIds, reorder.order) {
        CardOrderManager.isDefaultOrder(defaultIds, reorder.order)
    }
    val cardMap = remember(cards) { cards.associateBy { it.id } }

    var measuredViewportTop by remember { mutableFloatStateOf(0f) }
    var measuredViewportBottom by remember { mutableFloatStateOf(0f) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .onGloballyPositioned { coords ->
                val (vTop, vBottom) = findVisibleScrollViewport(coords)
                measuredViewportTop = vTop
                measuredViewportBottom = vBottom
            },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AnimatedContent(
            targetState = editing,
            transitionSpec = { fsyContentSwap(reduceMotion) },
            label = "reorderMode",
        ) { isEditing ->
            Column(verticalArrangement = Arrangement.spacedBy(if (isEditing) 8.dp else 14.dp)) {
                if (isEditing) {
                    Text(
                        text = "Arraste pela alça ou use as setas.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    )
                }
                reorder.order.forEachIndexed { index, cardId ->
                    val item = cardMap[cardId] ?: return@forEachIndexed
                    Box(
                        modifier = Modifier
                            .fsyReorderItem(reorder, cardId)
                            .fillMaxWidth()
                            .then(if (isEditing) Modifier else Modifier.reveal(index + revealOffset)),
                    ) {
                        if (isEditing) {
                            ReorderRow(
                                position = index + 1,
                                title = item.title,
                                canUp = index > 0,
                                canDown = index < reorder.order.size - 1,
                                onUp = { reorder.moveBy(cardId, -1) },
                                onDown = { reorder.moveBy(cardId, 1) },
                                handle = Modifier.fsyReorderHandle(reorder, cardId, item.title),
                            )
                        } else {
                            item.content()
                        }
                    }
                }
            }
        }

        // Controles de organização no fim da lista: presentes, mas fora do caminho.
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AnimatedVisibility(visible = editing && !isDefault) {
                FsyActionButton(
                    label = "Restaurar",
                    icon = FsyIcons.RotateCcw,
                    tone = FsyButtonTone.Outline,
                    onClick = {
                        haptics.confirm()
                        onOrderChange(defaultIds)
                    },
                )
            }
            FsyActionButton(
                label = if (editing) "Concluir" else "Organizar",
                icon = if (editing) FsyIcons.Check else FsyIcons.SlidersHorizontal,
                tone = if (editing) FsyButtonTone.Primary else FsyButtonTone.Outline,
                onClick = {
                    haptics.tick()
                    editing = !editing
                },
            )
        }
    }

    if (scrollState != null) {
        FsyReorderAutoScroll(
            state = reorder,
            scrollState = scrollState,
            viewportTop = viewportTopPx ?: measuredViewportTop,
            viewportBottom = viewportBottomPx ?: measuredViewportBottom,
        )
    }
}

@Composable
private fun ReorderRow(
    position: Int,
    title: String,
    canUp: Boolean,
    canDown: Boolean,
    onUp: () -> Unit,
    onDown: () -> Unit,
    handle: Modifier,
) {
    Surface(
        shape = FsyControlShape,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .then(handle),
                contentAlignment = Alignment.Center,
            ) {
                Icon(FsyIcons.GripVertical, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            }
            Text(
                text = "$position",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(20.dp),
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f),
            )
            FsyIconButton(icon = FsyIcons.ArrowUp, contentDescription = "Subir $title", onClick = onUp, enabled = canUp)
            FsyIconButton(icon = FsyIcons.ArrowDown, contentDescription = "Descer $title", onClick = onDown, enabled = canDown)
            Spacer(Modifier.width(2.dp))
        }
    }
}

/**
 * Calcula o viewport visível em coordenadas da raiz caminhando da raiz até o container
 * imediatamente externo ao conteúdo rolado (descartando a altura expandida do verticalScroll).
 */
private fun findVisibleScrollViewport(coords: LayoutCoordinates): Pair<Float, Float> {
    val root = coords.findRootCoordinates()
    val rootHeight = root.size.height.toFloat()
    if (rootHeight <= 0f) {
        val b = coords.boundsInRoot()
        return b.top to b.bottom
    }
    var top = 0f
    var bottom = rootHeight
    val ancestors = mutableListOf<LayoutCoordinates>()
    var curr = coords.parentLayoutCoordinates
    while (curr != null) {
        ancestors.add(curr)
        curr = curr.parentLayoutCoordinates
    }
    var prevHeight = rootHeight
    for (anc in ancestors.asReversed()) {
        val h = anc.size.height.toFloat()
        val y = anc.positionInRoot().y
        if (h > prevHeight + 1f || y < -0.5f) {
            break
        }
        top = maxOf(top, y)
        bottom = minOf(bottom, y + h)
        prevHeight = h
    }
    return if (bottom > top) top to bottom else (0f to rootHeight)
}
