package br.com.fsyrp2.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import br.com.fsyrp2.app.model.WhatsappInviteValidator
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyPressScale
import br.com.fsyrp2.app.ui.motion.fsyStateTween
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily
import kotlinx.coroutines.delay
import java.time.Instant

/*
 * Controles FSY de uso geral: substituem Button/OutlinedButton/TextButton/Switch/FilterChip
 * crus do Material nas telas de equipe, para uma única linguagem visual (pílula, 48 dp,
 * afundar 0,97 ao tocar, cores da paleta oficial).
 */

private val FsyButtonPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp)
private val FsyCompactButtonPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)

/** Indica quando botões lado a lado devem empilhar em coluna para não estourar nem quebrar palavras. */
@Composable
fun isCompactActionLayout(minSideBySideWidthDp: Int = 380): Boolean {
    val widthDp = LocalConfiguration.current.screenWidthDp
    val fontScale = LocalDensity.current.fontScale
    return widthDp < minSideBySideWidthDp || fontScale >= 1.3f
}

@Composable
private fun defaultFsyButtonPadding(): PaddingValues =
    if (LocalConfiguration.current.screenWidthDp < 360 || LocalDensity.current.fontScale >= 1.3f) {
        FsyCompactButtonPadding
    } else {
        FsyButtonPadding
    }

/** Botão principal (azul oficial). Aceita cores próprias, por exemplo para exclusão. */
@Composable
fun FsyButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors? = null,
    contentPadding: PaddingValues? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.defaultMinSize(minHeight = 48.dp).fsyPressScale(interaction, enabled),
        shape = FsyPillShape,
        colors = colors ?: ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
        contentPadding = contentPadding ?: defaultFsyButtonPadding(),
        interactionSource = interaction,
        content = content,
    )
}

/** Botão secundário com fio neutro (sem preenchimento). */
@Composable
fun FsyOutlinedButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors? = null,
    contentPadding: PaddingValues? = null,
    content: @Composable RowScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.defaultMinSize(minHeight = 48.dp).fsyPressScale(interaction, enabled),
        shape = FsyPillShape,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = if (enabled) 1f else 0.5f)),
        colors = colors ?: ButtonDefaults.outlinedButtonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
        contentPadding = contentPadding ?: defaultFsyButtonPadding(),
        interactionSource = interaction,
        content = content,
    )
}

/** Ação de texto (cor de link, alvo de 48 dp). */
@Composable
fun FsyTextButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    colors: ButtonColors? = null,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
    content: @Composable RowScope.() -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    TextButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp).fsyPressScale(interaction, enabled),
        shape = FsyPillShape,
        colors = colors ?: ButtonDefaults.textButtonColors(contentColor = FsyPalette.Link),
        contentPadding = contentPadding,
        interactionSource = interaction,
        content = content,
    )
}

/**
 * Interruptor FSY: trilho em pílula azul (ligado) ou neutro (desligado), botão branco que
 * desliza com tween curto; sem ícone dentro. Mesmo contrato do Switch do Material.
 */
@Composable
fun FsySwitch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val reduce = fsyMotionPreferences().reduceMotion
    val scheme = MaterialTheme.colorScheme
    val track by animateColorAsState(
        targetValue = when {
            !enabled -> scheme.surfaceContainerHighest.copy(alpha = 0.6f)
            checked -> scheme.primary
            else -> scheme.surfaceContainerHighest
        },
        animationSpec = fsyStateTween(reduce, FsyMotion.FAST_MS),
        label = "switchTrack",
    )
    val thumbX by animateDpAsState(
        targetValue = if (checked) 22.dp else 2.dp,
        animationSpec = fsyStateTween(reduce, FsyMotion.BASE_MS),
        label = "switchThumb",
    )
    val toggleMod = if (onCheckedChange != null) {
        Modifier.toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onCheckedChange)
    } else Modifier
    Box(
        modifier = modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .then(toggleMod),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .width(48.dp)
                .height(28.dp)
                .clip(FsyPillShape)
                .background(track)
                .border(1.dp, if (checked) Color.Transparent else scheme.outlineVariant, FsyPillShape),
        ) {
            Box(
                modifier = Modifier
                    .offset(x = thumbX, y = 2.dp)
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(if (checked) scheme.onPrimary else scheme.surface)
                    .border(1.dp, if (checked) Color.Transparent else scheme.outlineVariant, CircleShape),
            )
        }
    }
}

/** Chip de filtro FSY: seleção em Sunshine, fio neutro quando livre. */
@Composable
fun FsyFilterChip(
    selected: Boolean,
    onClick: () -> Unit,
    label: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val reduce = fsyMotionPreferences().reduceMotion
    val scheme = MaterialTheme.colorScheme
    val interaction = remember { MutableInteractionSource() }
    val container by animateColorAsState(
        targetValue = if (selected) scheme.secondaryContainer else scheme.surface,
        animationSpec = fsyStateTween(reduce, FsyMotion.FAST_MS),
        label = "chipContainer",
    )
    val content = if (selected) scheme.onSecondaryContainer else scheme.onSurface
    Row(
        modifier = modifier
            .heightIn(min = 48.dp)
            .semantics { this.selected = selected }
            .fsyPressScale(interaction, enabled)
            .clip(FsyPillShape)
            .background(container)
            .border(1.dp, if (selected) Color.Transparent else scheme.outlineVariant, FsyPillShape)
            .clickable(
                interactionSource = interaction,
                indication = ripple(),
                enabled = enabled,
                role = Role.Tab,
                onClick = onClick,
            )
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) {
        androidx.compose.runtime.CompositionLocalProvider(
            androidx.compose.material3.LocalContentColor provides content,
            androidx.compose.material3.LocalTextStyle provides MaterialTheme.typography.labelLarge.copy(
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            ),
        ) {
            leadingIcon?.invoke()
            label()
        }
    }
}

/** Confirmação de ação irreversível (excluir, sair de todos). Botão destrutivo em vermelho. */
@Composable
fun FsyConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    destructive: Boolean = true,
    busy: Boolean = false,
    icon: ImageVector? = if (destructive) FsyIcons.Trash2 else null,
) {
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        icon = icon?.let { { Icon(it, contentDescription = null) } },
        title = { Text(title, style = MaterialTheme.typography.headlineSmall) },
        text = { Text(message, style = MaterialTheme.typography.bodyLarge) },
        containerColor = MaterialTheme.colorScheme.surface,
        shape = FsyCardShape,
        confirmButton = {
            FsyButton(
                onClick = onConfirm,
                enabled = !busy,
                colors = if (destructive) ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ) else null,
            ) { Text(if (busy) "Aguarde…" else confirmLabel) }
        },
        dismissButton = {
            FsyTextButton(onClick = onDismiss, enabled = !busy) { Text("Cancelar") }
        },
    )
}

/**
 * Controle simples de confirmação para listas com várias exclusões:
 * `val confirm = rememberFsyConfirm()` … `confirm.ask("Excluir?", "…") { excluir() }` … `confirm.Host()`.
 */
class FsyConfirmController {
    internal var request by mutableStateOf<Triple<String, String, () -> Unit>?>(null)

    fun ask(title: String, message: String, onConfirm: () -> Unit) {
        request = Triple(title, message, onConfirm)
    }

    @Composable
    fun Host(confirmLabel: String = "Excluir") {
        val r = request ?: return
        FsyConfirmDialog(
            title = r.first,
            message = r.second,
            confirmLabel = confirmLabel,
            onConfirm = {
                request = null
                r.third()
            },
            onDismiss = { request = null },
        )
    }
}

@Composable
fun rememberFsyConfirm(): FsyConfirmController = remember { FsyConfirmController() }

/** Pede um motivo curto (obrigatório, ≥ [minLength] caracteres) antes de confirmar. */
@Composable
fun FsyReasonDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    minLength: Int = 3,
    busy: Boolean = false,
) {
    var reason by rememberSaveable { mutableStateOf("") }
    val valid = reason.trim().length >= minLength
    // Largura explícita evita o ciclo de medidas intrínsecas do AlertDialog com campo
    // multilinha; conteúdo rolável também mantém as ações acessíveis com fonte 200%.
    Dialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier.padding(20.dp).widthIn(max = 560.dp).fillMaxWidth()
                .heightIn(max = LocalConfiguration.current.screenHeightDp.dp * 0.85f),
            color = MaterialTheme.colorScheme.surface,
            shape = FsyCardShape,
        ) {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(title, style = MaterialTheme.typography.headlineSmall)
                Text(message, style = MaterialTheme.typography.bodyLarge)
                OutlinedTextField(
                    value = reason,
                    onValueChange = { if (it.length <= 280) reason = it },
                    label = { Text("Motivo") },
                    placeholder = { Text("Ex.: rosto pouco visível") },
                    minLines = 2,
                    shape = FsyControlShape,
                    supportingText = { Text("A pessoa vai ver este motivo.") },
                    modifier = Modifier.fillMaxWidth(),
                )
                FsyButton(onClick = { onConfirm(reason.trim()) }, enabled = valid && !busy, modifier = Modifier.fillMaxWidth()) {
                    Text(if (busy) "Enviando…" else confirmLabel)
                }
                FsyTextButton(onClick = onDismiss, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("Cancelar") }
            }
        }
    }
}

// --- Avatar -----------------------------------------------------------------------------

/**
 * Avatar circular: foto aprovada quando existe; senão a inicial em Libre Baskerville sobre
 * Sunshine. Anel opcional (perfil social). Quando a URL assinada expira, [onImageError] avisa
 * para buscar uma nova.
 */
@Composable
fun FsyAvatar(
    name: String,
    modifier: Modifier = Modifier,
    photoUrl: String? = null,
    size: Dp = 40.dp,
    ring: Boolean = false,
    containerColor: Color = MaterialTheme.colorScheme.secondary,
    contentColor: Color = MaterialTheme.colorScheme.onSecondary,
    onImageError: (() -> Unit)? = null,
) {
    val initial = name.trim().firstOrNull { it.isLetter() }?.uppercaseChar()?.toString() ?: "F"
    val ringWidth = if (ring) (size.value * 0.04f).coerceIn(2f, 4f).dp else 0.dp
    val gap = if (ring) ringWidth else 0.dp
    // Impede loop infinito de recarga caso a URL assinada renovada também falhe.
    var errorRetries by remember { mutableStateOf(0) }
    var lastFailedUrl by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(photoUrl) {
        if (photoUrl.isNullOrBlank()) {
            errorRetries = 0
            lastFailedUrl = null
        } else if (RemoteImageMemory.get(photoUrl) != null) {
            errorRetries = 0
            lastFailedUrl = null
        }
    }
    Box(
        modifier = modifier
            .size(size)
            .then(
                if (ring) Modifier.border(ringWidth, MaterialTheme.colorScheme.secondary, CircleShape).padding(ringWidth + gap)
                else Modifier
            )
            .clip(CircleShape)
            .background(containerColor)
            .semantics { contentDescription = "Foto de $name" },
        contentAlignment = Alignment.Center,
    ) {
        val initialSp = with(LocalDensity.current) { (size * 0.38f).toSp() }
        Text(
            text = initial,
            style = MaterialTheme.typography.labelMedium.copy(
                fontSize = initialSp,
                lineHeight = initialSp,
            ),
            fontFamily = LibreBaskervilleFontFamily,
            fontWeight = FontWeight.Bold,
            color = contentColor,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Clip,
        )
        if (!photoUrl.isNullOrBlank()) {
            RemotePublicImage(
                url = photoUrl,
                contentDescription = null,
                showPlaceholder = false,
                onError = {
                    if (errorRetries < 1 && lastFailedUrl != photoUrl) {
                        lastFailedUrl = photoUrl
                        errorRetries += 1
                        onImageError?.invoke()
                    }
                },
                modifier = Modifier.matchParentSize(),
            )
        }
    }
}

/**
 * Diálogo compartilhado (Consultor e Gestão) para cadastrar, trocar ou remover o link
 * do grupo de WhatsApp da companhia, com validação imediata do convite e confirmação ao remover.
 */
@Composable
fun FsyWhatsappLinkDialog(
    companyName: String,
    currentInviteUrl: String?,
    busy: Boolean = false,
    errorMessage: String? = null,
    onSave: (String) -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    var draft by rememberSaveable(currentInviteUrl) { mutableStateOf(currentInviteUrl.orEmpty()) }
    var confirmingRemoval by rememberSaveable { mutableStateOf(false) }
    val trimmed = draft.trim()
    val normalized = WhatsappInviteValidator.normalizeWhatsappInvite(trimmed)
    val showValidationError = trimmed.isNotEmpty() && normalized == null

    Dialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .padding(20.dp)
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .heightIn(max = LocalConfiguration.current.screenHeightDp.dp * 0.88f),
            color = MaterialTheme.colorScheme.surface,
            shape = FsyCardShape,
        ) {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                if (confirmingRemoval) {
                    Text(
                        text = "Remover link do grupo?",
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Text(
                        text = "Os jovens de $companyName deixarão de ver o botão de entrada no WhatsApp até que um novo convite seja salvo.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    FsyButton(
                        onClick = onRemove,
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                            contentColor = MaterialTheme.colorScheme.onError,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (busy) "Removendo…" else "Confirmar remoção")
                    }
                    FsyTextButton(
                        onClick = { confirmingRemoval = false },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Voltar")
                    }
                } else {
                    Text(
                        text = if (currentInviteUrl.isNullOrBlank()) "Adicionar link do WhatsApp" else "Trocar link do WhatsApp",
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Text(
                        text = "Grupo do WhatsApp — ${companyName.ifBlank { "Companhia" }}",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        text = "Cole o link de convite oficial do grupo da companhia (https://chat.whatsapp.com/...).",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedTextField(
                        value = draft,
                        onValueChange = { if (it.length <= 200) draft = it },
                        label = { Text("Link do grupo no WhatsApp") },
                        placeholder = { Text("https://chat.whatsapp.com/...") },
                        isError = showValidationError,
                        singleLine = true,
                        shape = FsyControlShape,
                        supportingText = {
                            if (showValidationError) {
                                Text("Use um link de convite oficial: https://chat.whatsapp.com/...")
                            } else {
                                Text("Somente links https://chat.whatsapp.com/ são aceitos.")
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (!errorMessage.isNullOrBlank()) {
                        FsyNotice(
                            icon = FsyIcons.CircleAlert,
                            text = errorMessage,
                            container = MaterialTheme.colorScheme.errorContainer,
                            content = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                    FsyButton(
                        onClick = { normalized?.let(onSave) },
                        enabled = normalized != null && !busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (busy) "Salvando…" else "Salvar")
                    }
                    if (!currentInviteUrl.isNullOrBlank()) {
                        FsyOutlinedButton(
                            onClick = { confirmingRemoval = true },
                            enabled = !busy,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = MaterialTheme.colorScheme.error,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            FsyButtonIcon(FsyIcons.Trash2)
                            Text("Remover link")
                        }
                    }
                    FsyTextButton(
                        onClick = onDismiss,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Cancelar")
                    }
                }
            }
        }
    }
}


// --- Relógio da interface ---------------------------------------------------------------------

/**
 * Hora atual que se atualiza sozinha (padrão: a cada 30 s), para "Agora / A seguir",
 * contagem e progresso não congelarem entre atualizações de dados.
 * [FsyClock.override] existe só para capturas de teste com horário fixo.
 */
object FsyClock {
    @Volatile
    var override: Instant? = null
    fun now(): Instant = override ?: Instant.now()
}

@Composable
fun rememberFsyNow(periodMs: Long = 30_000L): Instant {
    var now by remember { mutableStateOf(FsyClock.now()) }
    LaunchedEffect(periodMs) {
        while (true) {
            delay(periodMs)
            now = FsyClock.now()
        }
    }
    return now
}

/** Espaço pequeno reutilizado nas linhas de ação. */
@Composable
fun FsyButtonIcon(icon: ImageVector) {
    Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
    Spacer(Modifier.width(8.dp))
}
