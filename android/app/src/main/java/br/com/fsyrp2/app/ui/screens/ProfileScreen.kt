package br.com.fsyrp2.app.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.SupervisorAccount
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyDiscLogo
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsyStatusBadge
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
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

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasOsPermission = granted
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = "Meu Perfil & Preferências",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        // Cartão de Identidade
        FsySectionCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                FsyDiscLogo(size = 64.dp)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = profile?.fullName ?: "Participante FSY",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = profile?.email ?: appState.session?.email.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    FsyStatusBadge(
                        text = role.labelPt,
                        backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                        contentColor = FsyPalette.PrimarySky
                    )
                }
            }

            Spacer(Modifier.height(14.dp))
            HorizontalDivider()
            Spacer(Modifier.height(10.dp))

            ProfileDetailRow("Ala / Ramo ou Estaca", profile?.unit ?: "Não informado")
            ProfileDetailRow("Companhia", company?.name ?: "Em definição")
            ProfileDetailRow("Sala de Reunião", company?.room ?: "Em definição")
            ProfileDetailRow("Quarto / Alojamento", profile?.room ?: "Em definição")
            ProfileDetailRow("Ônibus Designado", profile?.busAssignment ?: "Em definição")
        }

        // Atalhos de Função (Conselheiro / Administração / Galeria)
        FsySectionCard {
            Text(
                text = "Acesso Rápido",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(10.dp))

            OutlinedButton(
                onClick = {
                    haptics.tick()
                    appState.overlayDestination = OverlayDestination.Gallery
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
            ) {
                Icon(Icons.Default.Collections, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Abrir Galeria Oficial e Instagram")
            }

            if (role == UserRole.CONSULTOR || role.isManager) {
                Spacer(Modifier.height(8.dp))
                FilledTonalButton(
                    onClick = {
                        haptics.confirm()
                        appState.overlayDestination = OverlayDestination.CounselorPanel
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.SupervisorAccount, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Abrir Painel do Conselheiro", fontWeight = FontWeight.Bold)
                }
            }

            if (role.canAccessAdminHub) {
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        haptics.confirm()
                        appState.overlayDestination = OverlayDestination.AdminHub()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.AdminPanelSettings, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Abrir Central Administrativa (11 Módulos)", fontWeight = FontWeight.Bold)
                }
            }
        }

        // Notificações e Horário Silencioso
        FsySectionCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Notifications,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Notificações e Horário Silencioso",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Na tela bloqueada, as notificações nunca exibem detalhes pessoais (apenas 'FSY RP2: novo aviso').",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasOsPermission) {
                Spacer(Modifier.height(10.dp))
                FilledTonalButton(
                    onClick = {
                        haptics.confirm()
                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Autorizar notificações no Android")
                }
            }

            Spacer(Modifier.height(10.dp))

            SwitchPreferenceRow(
                title = "Comunicados da sessão e companhia",
                subtitle = "Receber avisos gerais e recados dos conselheiros via push",
                checked = prefs.announcementsEnabled,
                onCheckedChange = { enabled ->
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(announcementsEnabled = enabled))
                }
            )

            SwitchPreferenceRow(
                title = "Somente comunicados urgentes",
                subtitle = "Silenciar avisos normais e receber apenas alertas urgentes",
                checked = prefs.urgentOnly,
                onCheckedChange = { urgentOnly ->
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(urgentOnly = urgentOnly))
                }
            )

            SwitchPreferenceRow(
                title = "Lembretes automáticos da agenda (10 min antes)",
                subtitle = "Avisar localmente antes de cada atividade oficial de 06 a 10/02/2027",
                checked = prefs.scheduleRemindersEnabled,
                onCheckedChange = { enabled ->
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(scheduleRemindersEnabled = enabled))
                }
            )

            SwitchPreferenceRow(
                title = "Meus lembretes pessoais",
                subtitle = "Avisar nas atividades marcadas com 'Lembrar-me 10 min antes'",
                checked = prefs.personalRemindersEnabled,
                onCheckedChange = { enabled ->
                    haptics.tick()
                    appState.updateNotificationPreferences(prefs.copy(personalRemindersEnabled = enabled))
                }
            )

            Spacer(Modifier.height(10.dp))
            Text(
                text = "Horário silencioso (fuso de Brasília — America/Sao_Paulo)",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = quietStartInput,
                    onValueChange = { quietStartInput = it },
                    label = { Text("Início (HH:MM)") },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.merge(TabularTextStyle),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = quietEndInput,
                    onValueChange = { quietEndInput = it },
                    label = { Text("Fim (HH:MM)") },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyMedium.merge(TabularTextStyle),
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    haptics.confirm()
                    appState.updateNotificationPreferences(
                        prefs.copy(
                            quietHoursStart = quietStartInput.trim().ifBlank { null },
                            quietHoursEnd = quietEndInput.trim().ifBlank { null }
                        )
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Salvar horário silencioso")
            }
        }

        // Sessão e Segurança
        FsySectionCard {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Segurança da Sessão",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.height(10.dp))

            Button(
                onClick = {
                    haptics.reject()
                    appState.signOut(revokeAllPushDevices = false)
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = FsyPalette.Danger,
                    contentColor = androidx.compose.ui.graphics.Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Sair desta conta", fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(8.dp))

            OutlinedButton(
                onClick = {
                    haptics.reject()
                    appState.signOut(revokeAllPushDevices = true)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Sair e revogar notificações em todos os dispositivos")
            }
        }
    }
}

@Composable
private fun ProfileDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun SwitchPreferenceRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

