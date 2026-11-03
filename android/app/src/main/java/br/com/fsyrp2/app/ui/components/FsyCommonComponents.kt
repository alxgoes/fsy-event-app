package br.com.fsyrp2.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyPressScale
import br.com.fsyrp2.app.ui.theme.FsyPalette

/*
 * Kit de componentes nativos "Papel e Arco".
 * Cartões brancos com fio de 1 dp sobre papel quente, títulos serifados, ícones Lucide de
 * traço único, um tom de destaque por vez. Nada de gradiente, brilho ou sombra decorativa.
 */

val FsyCardShape = RoundedCornerShape(24.dp)
val FsyControlShape = RoundedCornerShape(14.dp)
val FsyPillShape = RoundedCornerShape(999.dp)

/** Margem lateral padrão das telas (16 dp em telefone). */
val FsyGutter = 16.dp

// --- Contêineres ------------------------------------------------------------------------

@Composable
fun FsySectionCard(
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outlineVariant,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = FsyCardShape,
        color = containerColor,
        border = BorderStroke(1.dp, borderColor),
    ) {
        Column(
            modifier = Modifier.padding(contentPadding),
            content = content
        )
    }
}

/** Cartão inteiro tocável, com retorno de pressão e ondulação. */
@Composable
fun FsyClickableCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onClickLabel: String? = null,
    containerColor: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outlineVariant,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit
) {
    val interaction = remember { MutableInteractionSource() }
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .fsyPressScale(interaction)
            .clip(FsyCardShape)
            .clickable(
                interactionSource = interaction,
                indication = ripple(),
                onClickLabel = onClickLabel,
                role = Role.Button,
                onClick = onClick,
            ),
        shape = FsyCardShape,
        color = containerColor,
        border = BorderStroke(1.dp, borderColor),
    ) {
        Column(modifier = Modifier.padding(contentPadding), content = content)
    }
}

/** Ícone em ladrilho suave: identifica a seção sem competir com o título. */
@Composable
fun FsyIconTile(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    container: Color = MaterialTheme.colorScheme.primaryContainer,
    tint: Color = MaterialTheme.colorScheme.onPrimaryContainer,
    size: Dp = 36.dp,
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.32f))
            .background(container),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(size * 0.55f))
    }
}

/**
 * Cabeçalho de cartão: ícone + título + ação curta opcional (com chevron).
 * A ação mantém alvo de 48 dp e nome acessível próprio.
 */
@Composable
fun FsyCardHeader(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    actionDescription: String? = null,
    onAction: (() -> Unit)? = null,
) {
    // Fonte ampliada (>= 130%): título com a linha toda e ação embaixo, sem quebrar palavras.
    val largeText = LocalDensity.current.fontScale >= 1.3f
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            FsyIconTile(icon = icon)
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .weight(1f)
                    .semantics { heading() },
            )
            if (!largeText && actionLabel != null && onAction != null) {
                FsyTextAction(label = actionLabel, onClick = onAction, description = actionDescription)
            }
        }
        if (largeText && actionLabel != null && onAction != null) {
            FsyTextAction(
                label = actionLabel,
                onClick = onAction,
                description = actionDescription,
                modifier = Modifier.padding(start = 40.dp),
            )
        }
    }
}

/** Ação de texto com chevron (ex.: "Ver tudo ›"). */
@Composable
fun FsyTextAction(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null,
) {
    TextButton(
        onClick = onClick,
        modifier = modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .then(if (description != null) Modifier.semantics { contentDescription = description } else Modifier),
        contentPadding = PaddingValues(start = 10.dp, end = 4.dp),
        colors = ButtonDefaults.textButtonColors(contentColor = FsyPalette.Link),
    ) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Icon(FsyIcons.ChevronRight, contentDescription = null, modifier = Modifier.size(18.dp))
    }
}

/** Título de seção de tela: serifado, com espaço maior acima que abaixo. */
@Composable
fun FsySectionTitle(
    text: String,
    modifier: Modifier = Modifier,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier
                .weight(1f)
                .semantics { heading() },
        )
        trailing?.invoke(this)
    }
}

// --- Cabeçalhos de tela -----------------------------------------------------------------

/**
 * Barra superior própria das telas principais e sobrepostas: aplica o recuo da barra de
 * status, título serifado, voltar com rótulo acessível e até duas ações.
 */
@Composable
fun FsyTopBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    showMark: Boolean = onBack == null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Surface(color = MaterialTheme.colorScheme.background, modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .windowInsetsPadding(WindowInsets.statusBars)
                .fillMaxWidth()
                .heightIn(min = 64.dp)
                .padding(start = if (onBack != null) 4.dp else FsyGutter, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                    Icon(FsyIcons.ArrowLeft, contentDescription = "Voltar", tint = MaterialTheme.colorScheme.onBackground)
                }
                Spacer(Modifier.width(4.dp))
            } else if (showMark) {
                FsyTempleMark(height = 36.dp, decorative = true)
                Spacer(Modifier.width(12.dp))
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .semantics(mergeDescendants = true) { heading() },
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, content = actions)
        }
    }
}

/** Botão de ícone com nome acessível obrigatório (48 dp). */
@Composable
fun FsyIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: Color = MaterialTheme.colorScheme.onSurface,
) {
    IconButton(onClick = onClick, enabled = enabled, modifier = modifier.size(48.dp)) {
        Icon(icon, contentDescription = contentDescription, tint = if (enabled) tint else tint.copy(alpha = 0.38f))
    }
}

/**
 * Faixa de saudação: azul profundo sólido (#005E7C, 7,26:1 com branco), sem gradiente.
 * Assinatura preservada para chamadas existentes.
 */
@Composable
fun FsyHeroBanner(
    badgeText: String,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    trailingContent: (@Composable () -> Unit)? = null
) {
    val ext = FsyPalette.Extended
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = ext.hero,
        contentColor = ext.onHero,
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FsyStatusBadge(
                    text = badgeText,
                    backgroundColor = MaterialTheme.colorScheme.secondary,
                    contentColor = MaterialTheme.colorScheme.onSecondary,
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = ext.onHero,
                    modifier = Modifier.semantics { heading() },
                )
                if (subtitle.isNotBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = ext.onHero.copy(alpha = 0.92f)
                    )
                }
            }
            if (trailingContent != null) {
                Spacer(Modifier.width(12.dp))
                trailingContent()
            }
        }
    }
}

// --- Selos e botões ---------------------------------------------------------------------

@Composable
fun FsyStatusBadge(
    text: String,
    backgroundColor: Color,
    contentColor: Color,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    Surface(
        modifier = modifier,
        color = backgroundColor,
        contentColor = contentColor,
        shape = FsyPillShape
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (icon != null) Icon(icon, contentDescription = null, modifier = Modifier.size(14.dp))
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = contentColor,
                overflow = TextOverflow.Clip,
            )
        }
    }
}

/** Selo neutro (metadado: sala, quarto, categoria). */
@Composable
fun FsyMetaChip(
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    FsyStatusBadge(
        text = text,
        icon = icon,
        backgroundColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        contentColor = MaterialTheme.colorScheme.onSurface,
        modifier = modifier,
    )
}

enum class FsyButtonTone { Primary, Tonal, Outline, Danger }

/**
 * Botão de ação com ícone + rótulo curto visível. Altura mínima 48 dp; retorno de pressão.
 */
@Composable
fun FsyActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    tone: FsyButtonTone = FsyButtonTone.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val mod = modifier
        .defaultMinSize(minHeight = 48.dp)
        .fsyPressScale(interaction, enabled)
    val content: @Composable RowScope.() -> Unit = {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = LocalContentColorOr(),
            )
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(label, style = MaterialTheme.typography.labelLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
    val padding = PaddingValues(horizontal = 18.dp, vertical = 12.dp)
    when (tone) {
        FsyButtonTone.Primary -> Button(
            onClick = onClick, enabled = enabled && !loading, modifier = mod, shape = FsyPillShape,
            interactionSource = interaction, contentPadding = padding, content = content,
        )
        FsyButtonTone.Tonal -> FilledTonalButton(
            onClick = onClick, enabled = enabled && !loading, modifier = mod, shape = FsyPillShape,
            interactionSource = interaction, contentPadding = padding,
            colors = ButtonDefaults.filledTonalButtonColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            ),
            content = content,
        )
        FsyButtonTone.Outline -> OutlinedButton(
            onClick = onClick, enabled = enabled && !loading, modifier = mod, shape = FsyPillShape,
            interactionSource = interaction, contentPadding = padding,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            content = content,
        )
        FsyButtonTone.Danger -> Button(
            onClick = onClick, enabled = enabled && !loading, modifier = mod, shape = FsyPillShape,
            interactionSource = interaction, contentPadding = padding,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error,
                contentColor = MaterialTheme.colorScheme.onError,
            ),
            content = content,
        )
    }
}

@Composable
private fun LocalContentColorOr(): Color = androidx.compose.material3.LocalContentColor.current

// --- Linhas de lista --------------------------------------------------------------------

/** Linha de lista com ícone, título, apoio e conteúdo final; tocável quando há `onClick`. */
@Composable
fun FsyListRow(
    title: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    supporting: String? = null,
    iconContainer: Color = Color.Transparent,
    iconTint: Color = MaterialTheme.colorScheme.onSurface,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = if (onClick != null) {
        { Icon(FsyIcons.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant) }
    } else null,
) {
    val clickMod = if (onClick != null) {
        Modifier.clickable(role = Role.Button, onClick = onClick)
    } else Modifier
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .then(clickMod)
            .heightIn(min = 56.dp)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (icon != null) FsyIconTile(icon = icon, container = iconContainer, tint = iconTint, size = 40.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            if (!supporting.isNullOrBlank()) {
                Text(
                    supporting,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    overflow = TextOverflow.Clip,
                )
            }
        }
        trailing?.invoke()
    }
}

// --- Estados ----------------------------------------------------------------------------

/** Faixas de conexão/erro: entram e saem com movimento curto; texto de uma linha. */
@Composable
fun FsyConnectivityBanner(
    isOnline: Boolean,
    lastSyncedAtLabel: String?,
    errorMessage: String?,
    onRefresh: () -> Unit
) {
    val ext = FsyPalette.Extended
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        AnimatedVisibility(visible = !isOnline) {
            FsyNotice(
                icon = FsyIcons.CloudOff,
                text = if (!lastSyncedAtLabel.isNullOrBlank()) "Sem conexão · dados de $lastSyncedAtLabel" else "Sem conexão · mostrando dados salvos",
                container = ext.warningContainer,
                content = ext.onWarningContainer,
            )
        }
        AnimatedVisibility(visible = !errorMessage.isNullOrBlank()) {
            FsyNotice(
                icon = FsyIcons.CircleAlert,
                text = errorMessage.orEmpty(),
                container = MaterialTheme.colorScheme.errorContainer,
                content = MaterialTheme.colorScheme.onErrorContainer,
                actionLabel = "Tentar de novo",
                onAction = onRefresh,
            )
        }
    }
}

/** Aviso em linha (atenção, erro, sucesso). Cor nunca é o único sinal: sempre ícone + texto. */
@Composable
fun FsyNotice(
    icon: ImageVector,
    text: String,
    container: Color,
    content: Color,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Surface(color = container, contentColor = content, shape = FsyControlShape, modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp).heightIn(min = 44.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f).padding(vertical = 6.dp))
            if (actionLabel != null && onAction != null) {
                TextButton(
                    onClick = onAction,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp),
                    colors = ButtonDefaults.textButtonColors(contentColor = content),
                ) {
                    Icon(FsyIcons.RefreshCw, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(actionLabel, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

/** Estado vazio contextual: ícone, frase curta e, se houver, uma ação. */
@Composable
fun FsyEmptyStateCard(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = FsyIcons.Info,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 28.dp, horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FsyIconTile(
            icon = icon,
            size = 52.dp,
            container = MaterialTheme.colorScheme.surfaceContainerHigh,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(4.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (description.isNotBlank()) {
            Text(
                description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(4.dp))
            FsyActionButton(label = actionLabel, onClick = onAction, tone = FsyButtonTone.Tonal)
        }
    }
}

/** Esqueleto de carregamento: blocos no formato do conteúdo; pulso para em movimento reduzido. */
@Composable
fun FsyLoadingBlock(
    modifier: Modifier = Modifier,
    rows: Int = 3,
    rowHeight: Dp = 64.dp,
) {
    val reduce = fsyMotionPreferences().reduceMotion
    val alpha = if (reduce) {
        0.7f
    } else {
        val transition = rememberInfiniteTransition(label = "skeleton")
        val a by transition.animateFloat(
            initialValue = 0.55f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
            label = "skeletonAlpha",
        )
        a
    }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clearAndSetSemantics { contentDescription = "Carregando" },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        repeat(rows) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(rowHeight)
                    .graphicsLayer { this.alpha = alpha }
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            )
        }
    }
}

/** Ponto de status pequeno (não pisca). */
@Composable
fun FsyDot(color: Color, modifier: Modifier = Modifier, size: Dp = 8.dp) {
    Box(modifier.size(size).clip(CircleShape).background(color))
}

// --- Movimento de lista -----------------------------------------------------------------

/**
 * Revelação de item na primeira exibição: parte de um estado já visível (opacidade 0,4),
 * sobe 10 dp e assenta com saída exponencial; atraso escalonado de 35 ms (máx. 8 itens).
 * Em movimento reduzido não anima.
 */
fun Modifier.fsyReveal(
    index: Int = 0,
    stepMs: Int = 35,
    distance: Dp = 10.dp,
    durationMs: Int = FsyMotion.OVERLAY_ENTER_MS,
    startAlpha: Float = 0.4f,
): Modifier = composed {
    val reduce = fsyMotionPreferences().reduceMotion
    if (reduce) return@composed this
    val offsetPx = with(LocalDensity.current) { distance.toPx() }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.animateTo(
            1f,
            tween(
                durationMillis = durationMs,
                delayMillis = index.coerceIn(0, 8) * stepMs,
                easing = FsyMotion.EaseOut,
            ),
        )
    }
    graphicsLayer {
        val p = progress.value
        alpha = startAlpha + (1f - startAlpha) * p
        translationY = (1f - p) * offsetPx
    }
}

/**
 * Coreografia de entrada da Início: automática, sem toque, ~0,8 s no total
 * (5 grupos × 90 ms + 420 ms), começando já legível (opacidade 0,6) e subindo 16 dp.
 */
fun Modifier.fsyHomeEntrance(index: Int): Modifier =
    fsyReveal(index = index, stepMs = 90, distance = 16.dp, durationMs = 420, startAlpha = 0.6f)
