package br.com.fsyrp2.app.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.DragIndicator
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.ui.motion.FsyReorderAutoScroll
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
 * Container de cartões reordenáveis integrando o pacote de motion nativo (`ui/motion/FsyReorder.kt`):
 * - Arraste por alça de 48 dp (`Modifier.fsyReorderHandle`) + botões Subir/Descer (`reorder.moveBy`)
 * - FLIP crítico sem ultrapassagem para vizinhos (`Modifier.fsyReorderItem`)
 * - Rolagem automática nas bordas se `scrollState` for fornecido (`FsyReorderAutoScroll`)
 * - Persistência isolada por conta (`fsy:layout:v1:{userId}:{pageKey}`) somente no commit.
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
) {
    var editing by remember { mutableStateOf(false) }
    val haptics = rememberFsyHaptics()
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(
                onClick = {
                    haptics.tick()
                    editing = !editing
                },
                modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp),
            ) {
                Icon(
                    imageVector = Icons.Default.Tune,
                    contentDescription = "Personalizar ordem dos cartões",
                )
                Spacer(Modifier.width(6.dp))
                Text(if (editing) "Concluir organização" else "Organizar cartões")
            }

            if (editing && !isDefault) {
                TextButton(
                    onClick = {
                        haptics.confirm()
                        onOrderChange(defaultIds)
                    },
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp),
                ) {
                    Icon(
                        imageVector = Icons.Default.RestartAlt,
                        contentDescription = "Restaurar ordem padrão dos cartões",
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("Restaurar padrão")
                }
            }
        }

        reorder.order.forEachIndexed { index, cardId ->
            val item = cardMap[cardId] ?: return@forEachIndexed
            Box(
                modifier = Modifier
                    .fsyReorderItem(reorder, cardId)
                    .fillMaxWidth(),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (editing) {
                        Surface(
                            tonalElevation = 2.dp,
                            shape = MaterialTheme.shapes.medium,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(48.dp)
                                            .fsyReorderHandle(reorder, cardId, item.title),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.DragIndicator,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                        )
                                    }
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        text = "${index + 1}. ${item.title}",
                                        style = MaterialTheme.typography.labelLarge,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                                Row {
                                    IconButton(
                                        onClick = { reorder.moveBy(cardId, -1) },
                                        enabled = index > 0,
                                        modifier = Modifier
                                            .size(48.dp)
                                            .semantics {
                                                contentDescription = "Mover cartão ${item.title} para cima"
                                            },
                                    ) {
                                        Icon(Icons.Default.ArrowUpward, contentDescription = null)
                                    }
                                    IconButton(
                                        onClick = { reorder.moveBy(cardId, 1) },
                                        enabled = index < reorder.order.size - 1,
                                        modifier = Modifier
                                            .size(48.dp)
                                            .semantics {
                                                contentDescription = "Mover cartão ${item.title} para baixo"
                                            },
                                    ) {
                                        Icon(Icons.Default.ArrowDownward, contentDescription = null)
                                    }
                                }
                            }
                        }
                    }
                    item.content()
                }
            }
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
