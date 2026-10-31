package br.com.fsyrp2.app.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyConnectivityBanner
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsyStatusBadge
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

private data class DayOption(val key: String, val shortLabel: String, val dateLabel: String)

@Composable
fun ScheduleScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val moment = remember(appState.scheduleItems) { EventCalendar.moment(appState.scheduleItems) }
    val isStaff = (appState.profile?.roleEnum ?: UserRole.JOVEM) != UserRole.JOVEM

    val dayOptions = remember(isStaff) {
        buildList {
            if (isStaff) {
                add(DayOption("dia0", "Sex 05/02", "Dia 0 • Treinamento da Equipe"))
            }
            add(DayOption("dia1", "Sáb 06/02", "Dia 1 • Chegada e Abertura"))
            add(DayOption("dia2", "Dom 07/02", "Dia 2 • Domingo de Devoção"))
            add(DayOption("dia3", "Seg 08/02", "Dia 3 • Aulas e Atividades"))
            add(DayOption("dia4", "Ter 09/02", "Dia 4 • Show de Variedades e Testemunhos"))
            add(DayOption("dia5", "Qua 10/02", "Dia 5 • Encerramento e Partida"))
        }
    }

    var selectedDayKey by remember(moment.selectedDayKey) {
        mutableStateOf(moment.selectedDayKey)
    }
    var selectedCategory by remember { mutableStateOf("all") }
    var pendingActivityIdForPermission by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { _ ->
        val pendingId = pendingActivityIdForPermission
        pendingActivityIdForPermission = null
        if (pendingId != null) {
            appState.togglePersonalReminder(pendingId)
        }
    }

    val categories = listOf(
        "all" to "Todas",
        "spiritual" to "Espiritual",
        "activity" to "Atividade",
        "meal" to "Refeição",
        "logistics" to "Logística"
    )

    val filteredItems = remember(appState.scheduleItems, selectedDayKey, selectedCategory) {
        appState.scheduleItems
            .filter { it.dayKey == selectedDayKey }
            .filter { selectedCategory == "all" || it.category.equals(selectedCategory, ignoreCase = true) }
            .sortedBy { it.startTime }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            FsyConnectivityBanner(
                isOnline = appState.isOnline,
                lastSyncedAtLabel = appState.lastSyncedAtLabel,
                errorMessage = appState.globalBannerError,
                onRefresh = { appState.refreshCoreData() }
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Agenda Oficial • FSY 2027",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Horários em fuso de Brasília (America/Sao_Paulo)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(
                    onClick = {
                        haptics.tick()
                        appState.refreshCoreData()
                    },
                    modifier = Modifier.size(48.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = "Atualizar programação")
                }
            }
        }

        // Seletor de dias
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                dayOptions.forEach { day ->
                    val isSelected = selectedDayKey == day.key
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            haptics.tick()
                            selectedDayKey = day.key
                        },
                        label = {
                            Text(
                                text = day.shortLabel,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            )
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )
                }
            }
        }

        // Filtro por categoria
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                categories.forEach { (catKey, catLabel) ->
                    val isSelected = selectedCategory == catKey
                    AssistChip(
                        onClick = {
                            haptics.tick()
                            selectedCategory = catKey
                        },
                        label = { Text(catLabel) },
                        colors = if (isSelected) {
                            AssistChipDefaults.assistChipColors(
                                containerColor = FsyPalette.PrimarySky.copy(alpha = 0.15f),
                                labelColor = FsyPalette.PrimarySky
                            )
                        } else AssistChipDefaults.assistChipColors(),
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )
                }
            }
        }

        item {
            val activeDayTitle = dayOptions.firstOrNull { it.key == selectedDayKey }?.dateLabel
                ?: EventCalendar.DAY_LABELS[selectedDayKey].orEmpty()
            Text(
                text = activeDayTitle,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        if (filteredItems.isEmpty()) {
            item {
                FsyEmptyStateCard(
                    title = "Nenhuma atividade para este filtro",
                    description = "Selecione outra categoria ou atualize a programação para visualizar os horários."
                )
            }
        } else {
            items(filteredItems, key = { it.id }) { item ->
                val isCurrent = moment.currentItem?.id == item.id
                val isReminderSet = appState.personalReminderIds.contains(item.id)
                val catColor = when (item.category.lowercase()) {
                    "spiritual" -> FsyPalette.PrimarySky
                    "meal" -> FsyPalette.Success
                    "logistics" -> FsyPalette.Warning
                    else -> FsyPalette.AccentCoral
                }
                val catLabel = when (item.category.lowercase()) {
                    "spiritual" -> "Espiritual"
                    "meal" -> "Refeição"
                    "logistics" -> "Logística"
                    else -> "Atividade"
                }

                FsySectionCard(
                    containerColor = if (isCurrent) {
                        FsyPalette.PrimarySky.copy(alpha = 0.08f)
                    } else {
                        MaterialTheme.colorScheme.surface
                    },
                    borderColor = if (isCurrent) {
                        FsyPalette.PrimarySky
                    } else {
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                    }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${item.startTime.take(5)} – ${item.endTime.take(5)}",
                            style = MaterialTheme.typography.titleSmall.merge(TabularTextStyle),
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (isCurrent) {
                                FsyStatusBadge(
                                    text = "AGORA",
                                    backgroundColor = FsyPalette.PrimarySky,
                                    contentColor = Color.White
                                )
                            }
                            FsyStatusBadge(
                                text = catLabel,
                                backgroundColor = catColor.copy(alpha = 0.15f),
                                contentColor = catColor
                            )
                        }
                    }

                    Spacer(Modifier.height(6.dp))

                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    if (!item.location.isNullOrBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Place,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = item.location,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    if (!item.description.isNullOrBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = item.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Lembrete local (não substitui chamada presencial)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f)
                        )

                        OutlinedButton(
                            onClick = {
                                haptics.confirm()
                                if (!isReminderSet &&
                                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                                    !NotificationHelper.hasNotificationPermission(context)
                                ) {
                                    pendingActivityIdForPermission = item.id
                                    permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                } else {
                                    appState.togglePersonalReminder(item.id)
                                }
                            },
                            border = BorderStroke(
                                1.dp,
                                if (isReminderSet) FsyPalette.PrimarySky else MaterialTheme.colorScheme.outline
                            ),
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(
                                imageVector = if (isReminderSet) Icons.Default.NotificationsActive else Icons.Default.NotificationsNone,
                                contentDescription = null,
                                tint = if (isReminderSet) FsyPalette.PrimarySky else MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = if (isReminderSet) "Lembrete ativo (10 min)" else "Lembrar-me 10 min antes"
                            )
                        }
                    }
                }
            }
        }
    }
}
