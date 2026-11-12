package br.com.fsyrp2.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.BuildConfig
import br.com.fsyrp2.app.data.PhotoProcessor
import br.com.fsyrp2.app.model.InstagramPost
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyStateTween
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyAppearance
import br.com.fsyrp2.app.ui.theme.FsyThemeMode
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Mais: perfil social (foto com anel, nome, companhia, conselheiros), Fotos, Aparência,
 * Notificações e — só para quem tem o papel — Painel do conselheiro e Gestão. Sair uma vez.
 */
@Composable
fun MoreScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()
    val profile = appState.profile
    val photo = appState.profilePhoto
    val confirm = rememberFsyConfirm()
    confirm.Host("Remover")

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        appState.submitProfilePhoto(uri)
    }
    val pickPhoto = {
        if (!appState.isPhotoBusy) {
            haptics.tick()
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = FsyGutter)
            .padding(top = 20.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        ProfileHeader(appState = appState, onEditPhoto = pickPhoto, modifier = Modifier.fsyReveal(0))

        PhotoStatusCard(appState = appState, onPickAnother = pickPhoto)
        if (photo.approvedUrl != null && (!photo.isPending || !appState.effectiveRole.requiresProfilePhotoApproval)) {
            FsyTextButton(onClick = { confirm.ask("Remover foto?", "Seu perfil voltará a mostrar suas iniciais.") { appState.removeProfilePhoto("approved") } }, enabled = !appState.isPhotoBusy) { Text("Remover foto") }
        }

        // Fotos e Evento
        val whatsappUrl = appState.companyWhatsapp?.validInviteUrl
        FsySectionCard(contentPadding = PaddingValues(6.dp), modifier = Modifier.fsyReveal(1)) {
            if (whatsappUrl != null) {
                FsyListRow(
                    title = "Grupo da companhia no WhatsApp",
                    supporting = appState.company?.name?.takeIf { it.isNotBlank() } ?: "Abrir convite oficial da companhia",
                    icon = FsyIcons.MessageCircle,
                    iconContainer = MaterialTheme.colorScheme.primaryContainer,
                    iconTint = MaterialTheme.colorScheme.onPrimaryContainer,
                    onClick = {
                        haptics.confirm()
                        ExternalUrlLauncher.openWhatsappInvite(context, whatsappUrl)
                    },
                    trailing = { Icon(FsyIcons.ExternalLink, contentDescription = "Abre fora do app", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp)) },
                )
                RowDivider()
            }
            FsyListRow(
                title = "Fotos",
                supporting = "Da sessão e do Instagram",
                icon = FsyIcons.Images,
                onClick = {
                    haptics.tick()
                    appState.open(OverlayDestination.Gallery)
                },
            )
            RowDivider()
            FsyListRow(
                title = "Instagram",
                supporting = "@${InstagramPost.OFFICIAL_HANDLE}",
                icon = FsyIcons.Camera,
                onClick = {
                    haptics.confirm()
                    ExternalUrlLauncher.openExternalUrl(context, appState.instagramProfileUrl)
                },
                trailing = { Icon(FsyIcons.ExternalLink, contentDescription = "Abre fora do app", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp)) },
            )
        }

        // Aparência
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            FsySectionTitle("Aparência")
            AppearancePicker(
                selected = FsyAppearance.mode,
                onSelect = { mode ->
                    haptics.tick()
                    FsyAppearance.update(context, mode)
                },
            )
        }

        // Atualização do app: faixa quando há versão nova e linha "Sobre o app".
        br.com.fsyrp2.app.update.FsyUpdateBanner(appState = appState)
        FsySectionCard(contentPadding = PaddingValues(6.dp)) {
            FsyListRow(
                title = "Sobre o app",
                supporting = "Versão ${br.com.fsyrp2.app.BuildConfig.VERSION_NAME.removeSuffix("-debug")} · Verificar atualização",
                icon = FsyIcons.Info,
                onClick = {
                    haptics.tick()
                    appState.open(OverlayDestination.AboutApp)
                },
            )
        }

        // Notificações
        FsySectionCard(contentPadding = PaddingValues(6.dp)) {
            val prefs = appState.notificationPreferences
            val summary = buildList {
                add(if (prefs.announcementsEnabled) (if (prefs.urgentOnly) "Só avisos urgentes" else "Avisos ligados") else "Avisos desligados")
                val qs = prefs.quietHoursStart
                val qe = prefs.quietHoursEnd
                if (!qs.isNullOrBlank() && !qe.isNullOrBlank()) add("silêncio $qs–$qe")
            }.joinToString(" · ")
            FsyListRow(
                title = "Notificações",
                supporting = summary,
                icon = FsyIcons.Bell,
                onClick = {
                    haptics.tick()
                    appState.open(OverlayDestination.NotificationSettings)
                },
            )
        }

        // Equipe: só existe para quem tem o papel (perfil carregado). Jovem não vê nada disto.
        val showCounselor = appState.canOpenCounselorPanel
        val showAdmin = appState.canOpenAdmin
        if (showCounselor || showAdmin) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FsySectionTitle("Equipe")
                FsySectionCard(contentPadding = PaddingValues(6.dp)) {
                    if (showCounselor) {
                        val pending = appState.photoReviews.size
                        FsyListRow(
                            title = "Painel do consultor",
                            supporting = if (pending > 0) "$pending ${if (pending == 1) "foto" else "fotos"} para aprovar" else "Companhia, avisos e jovens",
                            icon = FsyIcons.HandHeart,
                            onClick = {
                                haptics.confirm()
                                appState.open(OverlayDestination.CounselorPanel)
                            },
                            trailing = {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    if (pending > 0) CountBadge(pending)
                                    Icon(FsyIcons.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            },
                        )
                    }
                    if (showCounselor && showAdmin) RowDivider()
                    if (showAdmin) {
                        FsyListRow(
                            title = "Gestão",
                            supporting = "Módulos da coordenação",
                            icon = FsyIcons.ShieldCheck,
                            onClick = {
                                haptics.confirm()
                                appState.open(OverlayDestination.AdminHub())
                            },
                        )
                    }
                }
            }
        }

        FsyOutlinedButton(
            onClick = {
                haptics.reject()
                appState.signOut(revokeAllPushDevices = false)
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(FsyIcons.LogOut, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text("Sair", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelLarge)
        }

        Text(
            text = "${FsyEventFacts.SESSION} · versão ${BuildConfig.VERSION_NAME.removeSuffix("-debug")}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun RowDivider() {
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(horizontal = 14.dp))
}

@Composable
internal fun CountBadge(count: Int) {
    Surface(color = MaterialTheme.colorScheme.tertiary, contentColor = MaterialTheme.colorScheme.onTertiary, shape = FsyPillShape) {
        Text(
            text = if (count > 99) "99+" else count.toString(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun ProfileHeader(appState: FsyAppState, onEditPhoto: () -> Unit, modifier: Modifier = Modifier) {
    val profile = appState.profile
    val name = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Participante"
    val role = appState.effectiveRole
    val company = appState.company
    val photo = appState.profilePhoto
    // A própria pessoa vê a foto em análise no lugar; para os outros só vale a aprovada.
    val shownUrl = photo.approvedUrl ?: photo.pendingUrl.takeIf { photo.isPending } ?: profile?.avatarUrl
    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClickLabel = "Editar foto", onClick = onEditPhoto),
            ) {
                FsyAvatar(name = name, photoUrl = shownUrl, size = 116.dp, ring = true, onImageError = { appState.refreshProfilePhoto(fromImageError = true) })
            }
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier
                    .offset(x = (-2).dp, y = (-2).dp)
                    .size(34.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (appState.isPhotoBusy) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    } else {
                        Icon(FsyIcons.Camera, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Text(name, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center, modifier = Modifier.semantics { heading() })
        val subtitle = listOfNotNull(role.displayLabel, company?.name).joinToString(" · ")
        Text(subtitle, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 2.dp))
        val counselors = counselorContacts(appState).map { it.first }
        if (role == UserRole.JOVEM && counselors.isNotEmpty()) {
            Text(
                text = "Consultores: ${joinNames(counselors)}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        val room = profile?.room?.takeIf { it.isNotBlank() }
        if (room != null) {
            FsyMetaChip(text = "Quarto $room", icon = FsyIcons.BedDouble, modifier = Modifier.padding(top = 10.dp))
        }
        FsyTextButton(onClick = onEditPhoto, enabled = !appState.isPhotoBusy, modifier = Modifier.padding(top = 6.dp)) {
            Icon(FsyIcons.ImagePlus, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(8.dp))
            Text(if (photo.approvedUrl != null || photo.isPending) "Trocar foto" else "Editar foto", style = MaterialTheme.typography.labelLarge)
        }
        Text(
            text = if (role.requiresProfilePhotoApproval) "Sua foto precisa da aprovação do seu consultor."
                else "Sua foto aparece no perfil assim que o envio termina.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

private fun joinNames(names: List<String>): String = when (names.size) {
    0 -> ""
    1 -> names[0]
    else -> names.dropLast(1).joinToString(", ") + " e " + names.last()
}

/** Estado da foto: em análise, não aprovada ou erro de envio. Aprovada não precisa de cartão. */
@Composable
private fun PhotoStatusCard(appState: FsyAppState, onPickAnother: () -> Unit) {
    val photo = appState.profilePhoto
    val error = appState.photoError
    val requiresApproval = appState.effectiveRole.requiresProfilePhotoApproval
    AnimatedVisibility(visible = error != null) {
        FsyNotice(
            icon = FsyIcons.CircleAlert,
            text = error.orEmpty(),
            container = MaterialTheme.colorScheme.errorContainer,
            content = MaterialTheme.colorScheme.onErrorContainer,
        )
    }
    appState.photoSuccessMessage?.let { message ->
        FsyNotice(
            icon = FsyIcons.Check, text = message,
            container = MaterialTheme.colorScheme.primaryContainer,
            content = MaterialTheme.colorScheme.onPrimaryContainer
        )
    }
    when {
        requiresApproval && photo.isPending -> FsySectionCard(contentPadding = PaddingValues(18.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                FsyAvatar(name = "Foto enviada", photoUrl = photo.pendingUrl, size = 56.dp, onImageError = { appState.refreshProfilePhoto(fromImageError = true) })
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    FsyStatusBadge(
                        text = "Em análise pelo seu consultor",
                        icon = FsyIcons.Clock,
                        backgroundColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                    Text(
                        "Sua foto nova aparece para todos depois da aprovação.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            FsyTextButton(
                onClick = { appState.removeProfilePhoto("pending") },
                enabled = !appState.isPhotoBusy,
                modifier = Modifier.align(Alignment.End),
            ) { Text("Cancelar envio") }
        }
        requiresApproval && photo.isRejected -> FsySectionCard(contentPadding = PaddingValues(18.dp)) {
            Text("Sua foto não foi aprovada", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            val note = photo.reviewNote?.takeIf { it.isNotBlank() }
            if (note != null) {
                Text(
                    "“$note”",
                    fontFamily = LibreBaskervilleFontFamily,
                    fontStyle = FontStyle.Italic,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            Text(
                "Escolha outra foto em que seu rosto apareça bem.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
            FsyButton(onClick = onPickAnother, enabled = !appState.isPhotoBusy, modifier = Modifier.padding(top = 12.dp).fillMaxWidth()) {
                Icon(FsyIcons.ImagePlus, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Enviar outra")
            }
        }
        else -> Unit
    }
}

/** Escolha de aparência: linhas em pílula (não cortam com fonte 200%), seleção em Sunshine. */
@Composable
internal fun AppearancePicker(selected: FsyThemeMode, onSelect: (FsyThemeMode) -> Unit) {
    val reduce = fsyMotionPreferences().reduceMotion
    FsySectionCard(contentPadding = PaddingValues(6.dp)) {
        Column(modifier = Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            FsyThemeMode.entries.forEach { mode ->
                val isSelected = mode == selected
                val container by animateColorAsState(
                    targetValue = if (isSelected) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent,
                    animationSpec = fsyStateTween(reduce, FsyMotion.BASE_MS),
                    label = "appearanceRow",
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(container)
                        .selectable(selected = isSelected, role = Role.RadioButton, onClick = { onSelect(mode) })
                        .heightIn(min = 52.dp)
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Icon(
                        imageVector = when (mode) {
                            FsyThemeMode.SYSTEM -> FsyIcons.SunMoon
                            FsyThemeMode.LIGHT -> FsyIcons.Sun
                            FsyThemeMode.DARK -> FsyIcons.Moon
                        },
                        contentDescription = null,
                        tint = if (isSelected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            mode.label,
                            style = MaterialTheme.typography.titleMedium,
                            color = if (isSelected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurface,
                        )
                        if (mode == FsyThemeMode.SYSTEM) {
                            Text(
                                "Acompanha o celular",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (isSelected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    AnimatedVisibility(visible = isSelected) {
                        Icon(FsyIcons.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                }
            }
        }
    }
}
