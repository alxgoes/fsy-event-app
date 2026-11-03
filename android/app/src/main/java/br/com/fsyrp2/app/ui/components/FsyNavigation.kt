package br.com.fsyrp2.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyStateTween

data class FsyNavDestination(
    val label: String,
    val icon: ImageVector,
    val badgeCount: Int = 0,
)

/**
 * Barra de navegação inferior (Material: 3–5 destinos em telefone).
 * Indicador "sol" em cápsula que desliza entre destinos com mola sem ultrapassagem;
 * em movimento reduzido salta direto. Rótulos sempre visíveis.
 */
@Composable
fun FsyNavigationBar(
    destinations: List<FsyNavDestination>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val reduce = fsyMotionPreferences().reduceMotion
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        modifier = modifier.fillMaxWidth(),
    ) {
        Column {
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 1.dp)
            BoxWithConstraints(
                modifier = Modifier
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .fillMaxWidth()
                    .heightIn(min = 72.dp)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            ) {
                val itemWidth: Dp = maxWidth / destinations.size
                val indicatorWidth = 60.dp
                val targetX = itemWidth * selectedIndex + (itemWidth - indicatorWidth) / 2
                val indicatorX by animateDpAsState(
                    targetValue = targetX,
                    animationSpec = if (reduce) snap() else spring(
                        dampingRatio = Spring.DampingRatioNoBouncy,
                        stiffness = FsyMotion.STIFFNESS_NORMAL * 1.6f,
                    ),
                    label = "navIndicator",
                )
                // Indicador deslizante atrás do ícone selecionado.
                Box(
                    modifier = Modifier
                        .offset { IntOffset(indicatorX.roundToPx(), 0) }
                        .width(indicatorWidth)
                        .height(32.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.secondaryContainer),
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectableGroup(),
                ) {
                    destinations.forEachIndexed { index, dest ->
                        val selected = index == selectedIndex
                        val tint by animateColorAsState(
                            targetValue = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                            animationSpec = fsyStateTween(reduce, FsyMotion.FAST_MS),
                            label = "navTint",
                        )
                        val a11y = buildString {
                            append(dest.label)
                            if (dest.badgeCount > 0) append(", ${dest.badgeCount} novos")
                        }
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                // Altura pelo conteúdo (o bottomBar recebe a altura máxima da tela).
                                .heightIn(min = 56.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .selectable(
                                    selected = selected,
                                    onClick = { onSelect(index) },
                                    role = Role.Tab,
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = ripple(bounded = false, radius = 36.dp),
                                )
                                .semantics(mergeDescendants = true) { contentDescription = a11y },
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Box(modifier = Modifier.height(32.dp), contentAlignment = Alignment.Center) {
                                Icon(dest.icon, contentDescription = null, tint = tint, modifier = Modifier.size(22.dp))
                                if (dest.badgeCount > 0) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .offset(x = 12.dp, y = 2.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(MaterialTheme.colorScheme.tertiary)
                                            .padding(horizontal = 5.dp),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            text = if (dest.badgeCount > 9) "9+" else dest.badgeCount.toString(),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onTertiary,
                                        )
                                    }
                                }
                            }
                            Text(
                                text = dest.label,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                                overflow = TextOverflow.Clip,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Seletor segmentado com indicador que desliza (dias da agenda, filtros, entrar/criar conta).
 * Cada opção é uma aba acessível; o indicador anima posição e largura juntas.
 */
@Composable
fun FsySegmentedSelector(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    secondaryLines: List<String>? = null,
    descriptions: List<String>? = null,
) {
    val reduce = fsyMotionPreferences().reduceMotion
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = FsyPillShape,
        modifier = modifier.fillMaxWidth(),
    ) {
        BoxWithConstraints(modifier = Modifier.padding(4.dp)) {
            val itemWidth = maxWidth / options.size.coerceAtLeast(1)
            val x by animateDpAsState(
                targetValue = itemWidth * selectedIndex,
                animationSpec = if (reduce) snap() else spring(
                    dampingRatio = Spring.DampingRatioNoBouncy,
                    stiffness = FsyMotion.STIFFNESS_SNAPPY,
                ),
                label = "segmentIndicator",
            )
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shape = FsyPillShape,
                shadowElevation = 1.dp,
                modifier = Modifier
                    .offset { IntOffset(x.roundToPx(), 0) }
                    .width(itemWidth)
                    .matchParentSize(),
            ) {}
            Row(modifier = Modifier.fillMaxWidth().selectableGroup()) {
                options.forEachIndexed { index, label ->
                    val selected = index == selectedIndex
                    val desc = descriptions?.getOrNull(index)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(FsyPillShape)
                            .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(index) })
                            .then(if (desc != null) Modifier.semantics(mergeDescendants = true) { contentDescription = desc } else Modifier)
                            .padding(vertical = 6.dp, horizontal = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        val sub = secondaryLines?.getOrNull(index)
                        if (sub != null) {
                            Text(
                                text = sub,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                            )
                        }
                        Text(
                            text = label,
                            style = if (sub != null) MaterialTheme.typography.titleMedium else MaterialTheme.typography.labelLarge,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                            color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                            overflow = TextOverflow.Clip,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}
