package br.com.fsyrp2.app.ui.screens

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

/** Notificações (aberta a partir de Mais): canais, horário silencioso e parar em todos. */
@Composable
fun NotificationSettingsScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val prefs = appState.notificationPreferences

    var hasOsPermission by remember { mutableStateOf(NotificationHelper.hasNotificationPermission(context)) }
    var permissionDenied by rememberSaveable { mutableStateOf(false) }
    // Volta das configurações do sistema: relê a permissão.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val obs = LifecycleEventObserver { _, e ->
            if (e == Lifecycle.Event.ON_RESUME) hasOsPermission = NotificationHelper.hasNotificationPermission(context)
        }
        lifecycle.addObserver(obs)
        onDispose { lifecycle.removeObserver(obs) }
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasOsPermission = granted
        permissionDenied = !granted
    }

    var quietStart by rememberSaveable(prefs.quietHoursStart) { mutableStateOf(prefs.quietHoursStart ?: "22:30") }
    var quietEnd by rememberSaveable(prefs.quietHoursEnd) { mutableStateOf(prefs.quietHoursEnd ?: "06:30") }
    var savedQuiet by rememberSaveable { mutableStateOf(false) }
    var confirmRevokeAll by rememberSaveable { mutableStateOf(false) }
    val startValid = quietStart.isBlank() || EventCalendar.parseLocalTime(quietStart) != null
    val endValid = quietEnd.isBlank() || EventCalendar.parseLocalTime(quietEnd) != null

    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.navigationBars)) {
        FsyTopBar(title = "Notificações", profileAction = { ProfileAccessAction(appState) }, onBack = {
            haptics.tick()
            appState.closeOverlay()
        })
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = FsyGutter)
                .padding(top = 8.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasOsPermission) {
                FsySectionCard(contentPadding = PaddingValues(18.dp)) {
                    Text("As notificações estão desligadas neste celular", style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (permissionDenied) "Ative em Configurações › Notificações para receber avisos e lembretes."
                        else "Permita para receber avisos urgentes e os lembretes que você marcar.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
                    )
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            if (permissionDenied) {
                                runCatching {
                                    context.startActivity(
                                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    )
                                }
                            } else {
                                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(FsyIcons.Bell, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text(if (permissionDenied) "Abrir configurações" else "Permitir notificações")
                    }
                }
            }

            FsySectionCard(contentPadding = PaddingValues(vertical = 4.dp)) {
                SwitchRow("Avisos", "Da sessão e da sua companhia", prefs.announcementsEnabled) {
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(announcementsEnabled = it))
                }
                Divider()
                SwitchRow("Só urgentes", "Silencia os avisos comuns", prefs.urgentOnly, enabled = prefs.announcementsEnabled) {
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(urgentOnly = it))
                }
                Divider()
                SwitchRow("Toda a agenda", "Aviso 10 min antes de cada atividade", prefs.scheduleRemindersEnabled) {
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(scheduleRemindersEnabled = it))
                }
                Divider()
                SwitchRow("Meus lembretes", "Atividades marcadas com “Lembrar”", prefs.personalRemindersEnabled) {
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(personalRemindersEnabled = it))
                }
            }

            FsySectionTitle("Horário silencioso")
            FsySectionCard(contentPadding = PaddingValues(18.dp)) {
                Text(
                    "Avisos comuns ficam em silêncio nesse intervalo (horário de Brasília). Urgentes e os lembretes que você marcou continuam tocando.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TimeField("Início", quietStart, startValid, Modifier.weight(1f)) { quietStart = it; savedQuiet = false }
                    TimeField("Fim", quietEnd, endValid, Modifier.weight(1f)) { quietEnd = it; savedQuiet = false }
                }
                Spacer(Modifier.height(12.dp))
                FsyButton(
                    onClick = {
                        haptics.confirm()
                        appState.updateNotificationPreferences(
                            prefs.copy(
                                quietHoursStart = quietStart.trim().ifBlank { null },
                                quietHoursEnd = quietEnd.trim().ifBlank { null },
                            )
                        )
                        savedQuiet = true
                    },
                    enabled = startValid && endValid,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(if (savedQuiet) "Horário salvo" else "Salvar horário") }
            }

            FsyNotice(
                icon = FsyIcons.Lock,
                text = "Na tela bloqueada aparece só “FSY RP2: novo aviso”, sem dados pessoais.",
                container = MaterialTheme.colorScheme.surfaceContainerHigh,
                content = MaterialTheme.colorScheme.onSurface,
            )

            FsyTextButton(
                onClick = {
                    haptics.tick()
                    confirmRevokeAll = true
                },
                colors = androidx.compose.material3.ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(FsyIcons.BellOff, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Sair e parar notificações em todos os aparelhos")
            }
        }
    }

    if (confirmRevokeAll) {
        FsyConfirmDialog(
            title = "Parar em todos os aparelhos?",
            message = "Você sai desta conta e as notificações param em todos os seus aparelhos.",
            confirmLabel = "Sair e parar",
            icon = FsyIcons.BellOff,
            onConfirm = {
                confirmRevokeAll = false
                haptics.reject()
                appState.signOut(revokeAllPushDevices = true)
            },
            onDismiss = { confirmRevokeAll = false },
        )
    }
}

@Composable
private fun Divider() {
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(horizontal = 18.dp))
}

@Composable
private fun TimeField(label: String, value: String, valid: Boolean, modifier: Modifier, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { raw -> onChange(raw.filter { it.isDigit() || it == ':' }.take(5)) },
        label = { Text(label) },
        placeholder = { Text("HH:MM") },
        singleLine = true,
        isError = !valid,
        supportingText = if (!valid) ({ Text("Use HH:MM") }) else null,
        shape = FsyControlShape,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = MaterialTheme.typography.bodyLarge.merge(TabularTextStyle),
        modifier = modifier,
    )
}

@Composable
private fun SwitchRow(title: String, subtitle: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onChange)
            .heightIn(min = 68.dp)
            .padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        FsySwitch(checked = checked, onCheckedChange = null, enabled = enabled)
    }
}
