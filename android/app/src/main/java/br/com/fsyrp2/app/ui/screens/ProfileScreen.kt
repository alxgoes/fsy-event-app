package br.com.fsyrp2.app.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyActionButton
import br.com.fsyrp2.app.ui.components.FsyButtonTone
import br.com.fsyrp2.app.ui.components.FsyControlShape
import br.com.fsyrp2.app.ui.components.FsyGutter
import br.com.fsyrp2.app.ui.components.FsyListRow
import br.com.fsyrp2.app.ui.components.FsyNotice
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsySectionTitle
import br.com.fsyrp2.app.ui.components.FsyStatusBadge
import br.com.fsyrp2.app.ui.components.FsyTopBar
import br.com.fsyrp2.app.ui.components.fsyReveal
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.FsyAppearance
import br.com.fsyrp2.app.ui.theme.FsyThemeMode
import br.com.fsyrp2.app.ui.components.FsyPillShape
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyStateTween
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.ui.graphics.Color
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

@Composable
fun ProfileScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val profile = appState.profile
    val company = appState.company
    val role = profile?.roleEnum ?: UserRole.JOVEM
    val prefs = appState.notificationPreferences

    var hasOsPermission by remember {
        mutableStateOf(NotificationHelper.hasNotificationPermission(context))
    }
    var quietStartInput by remember(prefs.quietHoursStart) {
        mutableStateOf(prefs.quietHoursStart ?: "22:30")
    }
    var quietEndInput by remember(prefs.quietHoursEnd) {
        mutableStateOf(prefs.quietHoursEnd ?: "06:30")
    }
    var confirmRevokeAll by rememberSaveable { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasOsPermission = granted
    }

    val fullName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Participante"
    val initials = fullName.split(" ").filter { it.isNotBlank() }.let { parts ->
        (parts.firstOrNull()?.take(1).orEmpty() + if (parts.size > 1) parts.last().take(1) else "").uppercase()
    }

    Column(modifier = Modifier.fillMaxSize()) {
        FsyTopBar(title = "Perfil")
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = FsyGutter)
                .padding(top = 4.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Identidade
            Row(
                modifier = Modifier.fillMaxWidth().fsyReveal(0),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.secondary),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initials.ifBlank { "F" },
                        fontFamily = LibreBaskervilleFontFamily,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSecondary,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(fullName, style = MaterialTheme.typography.headlineSmall)
                    val email = profile?.email ?: appState.session?.email.orEmpty()
                    if (email.isNotBlank()) {
                        Text(email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FsyStatusBadge(
                        text = role.labelPt,
                        backgroundColor = MaterialTheme.colorScheme.primaryContainer,
                        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }

            // Detalhes do evento
            FsySectionCard(modifier = Modifier.fsyReveal(1), contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 6.dp, horizontal = 4.dp)) {
                DetailRow(FsyIcons.MapPin, "Unidade", profile?.unit)
                DetailRow(FsyIcons.Users, "Companhia", company?.name)
                DetailRow(FsyIcons.Hotel, "Sala", company?.room)
                DetailRow(FsyIcons.BedDouble, "Quarto", profile?.room)
                DetailRow(FsyIcons.Bus, "Ônibus", profile?.busAssignment)
            }

            // Atalhos
            FsySectionCard(modifier = Modifier.fsyReveal(2), contentPadding = androidx.compose.foundation.layout.PaddingValues(6.dp)) {
                FsyListRow(
                    title = "Galeria",
                    icon = FsyIcons.Images,
                    onClick = {
                        haptics.tick()
                        appState.overlayDestination = OverlayDestination.Gallery
                    },
                )
                if (role == UserRole.CONSULTOR || role.isManager) {
                    FsyListRow(
                        title = "Painel do conselheiro",
                        icon = FsyIcons.HandHeart,
                        onClick = {
                            haptics.confirm()
                            appState.overlayDestination = OverlayDestination.CounselorPanel
                        },
                    )
                }
                if (role.canAccessAdminHub) {
                    FsyListRow(
                        title = "Administração",
                        icon = FsyIcons.ShieldCheck,
                        iconContainer = MaterialTheme.colorScheme.primaryContainer,
                        iconTint = MaterialTheme.colorScheme.onPrimaryContainer,
                        onClick = {
                            haptics.confirm()
                            appState.overlayDestination = OverlayDestination.AdminHub()
                        },
                    )
                }
            }

            // Aparência
            FsySectionTitle("Aparência")
            AppearancePicker(
                selected = FsyAppearance.mode,
                onSelect = { mode ->
                    haptics.tick()
                    FsyAppearance.update(context, mode)
                },
            )

            // Notificações
            FsySectionTitle("Notificações")
            FsyNotice(
                icon = FsyIcons.Lock,
                text = "Na tela bloqueada, só aparece “FSY RP2: novo aviso”. Nenhum dado pessoal.",
                container = MaterialTheme.colorScheme.surfaceContainerHigh,
                content = MaterialTheme.colorScheme.onSurface,
            )
            AnimatedVisibility(visible = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasOsPermission) {
                FsyActionButton(
                    label = "Permitir notificações",
                    icon = FsyIcons.Bell,
                    tone = FsyButtonTone.Primary,
                    onClick = {
                        haptics.confirm()
                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            FsySectionCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)) {
                SwitchPreferenceRow(
                    title = "Avisos",
                    subtitle = "Da sessão e da sua companhia",
                    checked = prefs.announcementsEnabled,
                    onCheckedChange = { enabled ->
                        haptics.tick()
                        appState.updateNotificationPreferences(prefs.copy(announcementsEnabled = enabled))
                    },
                )
                PrefDivider()
                SwitchPreferenceRow(
                    title = "Só urgentes",
                    subtitle = "Silencia os avisos comuns",
                    checked = prefs.urgentOnly,
                    onCheckedChange = { urgentOnly ->
                        haptics.tick()
                        appState.updateNotificationPreferences(prefs.copy(urgentOnly = urgentOnly))
                    },
                )
                PrefDivider()
                SwitchPreferenceRow(
                    title = "Agenda",
                    subtitle = "10 min antes de cada atividade",
                    checked = prefs.scheduleRemindersEnabled,
                    onCheckedChange = { enabled ->
                        haptics.tick()
                        appState.updateNotificationPreferences(prefs.copy(scheduleRemindersEnabled = enabled))
                    },
                )
                PrefDivider()
                SwitchPreferenceRow(
                    title = "Meus lembretes",
                    subtitle = "Atividades marcadas com o sino",
                    checked = prefs.personalRemindersEnabled,
                    onCheckedChange = { enabled ->
                        haptics.tick()
                        appState.updateNotificationPreferences(prefs.copy(personalRemindersEnabled = enabled))
                    },
                )
            }

            // Horário silencioso
            FsySectionCard {
                Text("Horário silencioso", style = MaterialTheme.typography.titleSmall)
                Text(
                    "Horário de Brasília",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedTextField(
                        value = quietStartInput,
                        onValueChange = { quietStartInput = it },
                        label = { Text("Início") },
                        placeholder = { Text("22:30") },
                        singleLine = true,
                        shape = FsyControlShape,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        textStyle = MaterialTheme.typography.bodyLarge.merge(TabularTextStyle),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = quietEndInput,
                        onValueChange = { quietEndInput = it },
                        label = { Text("Fim") },
                        placeholder = { Text("06:30") },
                        singleLine = true,
                        shape = FsyControlShape,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        textStyle = MaterialTheme.typography.bodyLarge.merge(TabularTextStyle),
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(10.dp))
                FsyActionButton(
                    label = "Salvar horário",
                    icon = FsyIcons.Moon,
                    tone = FsyButtonTone.Tonal,
                    onClick = {
                        haptics.confirm()
                        appState.updateNotificationPreferences(
                            prefs.copy(
                                quietHoursStart = quietStartInput.trim().ifBlank { null },
                                quietHoursEnd = quietEndInput.trim().ifBlank { null }
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // Conta
            FsySectionTitle("Conta")
            FsyActionButton(
                label = "Sair",
                icon = FsyIcons.LogOut,
                tone = FsyButtonTone.Danger,
                onClick = {
                    haptics.reject()
                    appState.signOut(revokeAllPushDevices = false)
                },
                modifier = Modifier.fillMaxWidth(),
            )
            FsyActionButton(
                label = "Sair e parar notificações em todos os aparelhos",
                icon = FsyIcons.BellOff,
                tone = FsyButtonTone.Outline,
                onClick = {
                    haptics.tick()
                    confirmRevokeAll = true
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    if (confirmRevokeAll) {
        AlertDialog(
            onDismissRequest = { confirmRevokeAll = false },
            icon = { Icon(FsyIcons.BellOff, contentDescription = null) },
            title = { Text("Parar notificações em todos?") },
            text = { Text("Você sai desta conta e as notificações param em todos os seus aparelhos.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmRevokeAll = false
                    haptics.reject()
                    appState.signOut(revokeAllPushDevices = true)
                }) { Text("Sair e parar", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmRevokeAll = false }) { Text("Cancelar") }
            },
        )
    }
}

@Composable
private fun PrefDivider() {
    HorizontalDivider(
        color = MaterialTheme.colorScheme.outlineVariant,
        modifier = Modifier.padding(horizontal = 16.dp),
    )
}

@Composable
private fun DetailRow(icon: ImageVector, label: String, value: String?) {
    val missing = value.isNullOrBlank()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = if (missing) "Em definição" else value.orEmpty(),
            style = MaterialTheme.typography.titleSmall,
            color = if (missing) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (missing) FontWeight.Normal else FontWeight.SemiBold,
        )
    }
}

@Composable
private fun SwitchPreferenceRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange)
            .heightIn(min = 64.dp)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors = SwitchDefaults.colors(
                checkedTrackColor = MaterialTheme.colorScheme.primary,
                checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                uncheckedTrackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                uncheckedBorderColor = MaterialTheme.colorScheme.outline,
                uncheckedThumbColor = MaterialTheme.colorScheme.outline,
            ),
        )
    }
}

/** Escolha de aparência: linhas em pílula (não cortam com fonte 200%), seleção desliza a cor. */
@Composable
private fun AppearancePicker(selected: FsyThemeMode, onSelect: (FsyThemeMode) -> Unit) {
    val reduce = fsyMotionPreferences().reduceMotion
    FsySectionCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(6.dp)) {
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
                        .clip(FsyPillShape)
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
                            style = MaterialTheme.typography.titleSmall,
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
                    androidx.compose.animation.AnimatedVisibility(visible = isSelected) {
                        Icon(FsyIcons.Check, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                }
            }
        }
    }
}
