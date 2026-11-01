package br.com.fsyrp2.app.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.ScheduleItem
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.notifications.NotificationHelper
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyConnectivityBanner
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsyGutter
import br.com.fsyrp2.app.ui.components.FsyIconButton
import br.com.fsyrp2.app.ui.components.FsyLoadingBlock
import br.com.fsyrp2.app.ui.components.FsySegmentedSelector
import br.com.fsyrp2.app.ui.components.FsyTopBar
import br.com.fsyrp2.app.ui.components.fsyReveal
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

private data class DayOption(
    val key: String,
    val weekday: String,
    val dayNumber: String,
    val title: String,
    val spoken: String,
)

private data class CategoryStyle(val label: String, val color: Color)

@Composable
private fun categoryStyle(category: String): CategoryStyle = when (category.lowercase()) {
    "spiritual" -> CategoryStyle("Espiritual", MaterialTheme.colorScheme.primary)
    "meal" -> CategoryStyle("Refeição", FsyPalette.Success)
    "logistics" -> CategoryStyle("Logística", FsyPalette.Warning)
    else -> CategoryStyle("Atividade", MaterialTheme.colorScheme.tertiary)
}

@Composable
fun ScheduleScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val moment = remember(appState.scheduleItems) { EventCalendar.moment(appState.scheduleItems) }
    val isStaff = (appState.profile?.roleEnum ?: UserRole.JOVEM) != UserRole.JOVEM

    val dayOptions = remember(isStaff) {
        buildList {
            if (isStaff) add(DayOption("dia0", "Sex", "05", "Treinamento da equipe", "Sexta, 5 de fevereiro"))
            add(DayOption("dia1", "Sáb", "06", "Chegada e abertura", "Sábado, 6 de fevereiro"))
            add(DayOption("dia2", "Dom", "07", "Domingo de devoção", "Domingo, 7 de fevereiro"))
            add(DayOption("dia3", "Seg", "08", "Aulas e atividades", "Segunda, 8 de fevereiro"))
            add(DayOption("dia4", "Ter", "09", "Show de variedades e testemunhos", "Terça, 9 de fevereiro"))
            add(DayOption("dia5", "Qua", "10", "Encerramento e partida", "Quarta, 10 de fevereiro"))
        }
    }

    var selectedDayKey by rememberSaveable(moment.selectedDayKey) { mutableStateOf(moment.selectedDayKey) }
    var selectedCategory by rememberSaveable { mutableStateOf("all") }
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

    val onToggleReminder: (ScheduleItem, Boolean) -> Unit = { item, isSet ->
        haptics.confirm()
        if (!isSet &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !NotificationHelper.hasNotificationPermission(context)
        ) {
            pendingActivityIdForPermission = item.id
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            appState.togglePersonalReminder(item.id)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        FsyTopBar(
            title = "Agenda",
            subtitle = "Horário de Brasília",
            actions = {
                FsyIconButton(
                    icon = FsyIcons.RefreshCw,
                    contentDescription = "Atualizar agenda",
                    onClick = {
                        haptics.tick()
                        appState.refreshCoreData()
                    },
                    enabled = !appState.isLoading,
                )
            },
        )

        Column(
            modifier = Modifier.padding(horizontal = FsyGutter),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            FsyConnectivityBanner(
                isOnline = appState.isOnline,
                lastSyncedAtLabel = appState.lastSyncedAtLabel,
                errorMessage = appState.globalBannerError,
                onRefresh = { appState.refreshCoreData() }
            )
            val selectedIndex = dayOptions.indexOfFirst { it.key == selectedDayKey }.coerceAtLeast(0)
            FsySegmentedSelector(
                options = dayOptions.map { it.dayNumber },
                secondaryLines = dayOptions.map { it.weekday },
                descriptions = dayOptions.map { "${it.spoken}: ${it.title}" },
                selectedIndex = selectedIndex,
                onSelect = { index ->
                    if (dayOptions[index].key != selectedDayKey) {
                        haptics.tick()
                        selectedDayKey = dayOptions[index].key
                    }
                },
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                categories.forEach { (catKey, catLabel) ->
                    val isSelected = selectedCategory == catKey
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            haptics.tick()
                            selectedCategory = catKey
                        },
                        label = { Text(catLabel, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium) },
                        leadingIcon = if (isSelected) {
                            { Icon(FsyIcons.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                        } else null,
                        shape = br.com.fsyrp2.app.ui.components.FsyPillShape,
                        colors = FilterChipDefaults.filterChipColors(
                            containerColor = MaterialTheme.colorScheme.surface,
                            selectedContainerColor = MaterialTheme.colorScheme.secondaryContainer,
                            selectedLabelColor = MaterialTheme.colorScheme.onSecondaryContainer,
                            selectedLeadingIconColor = MaterialTheme.colorScheme.onSecondaryContainer,
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = isSelected,
                            borderColor = MaterialTheme.colorScheme.outlineVariant,
                            selectedBorderColor = Color.Transparent,
                        ),
                        modifier = Modifier.height(40.dp).padding(vertical = 0.dp),
                    )
                }
            }
        }

        AnimatedContent(
            targetState = selectedDayKey to selectedCategory,
            transitionSpec = { fsyContentSwap(reduceMotion) },
            label = "AgendaDaySwap",
            modifier = Modifier.weight(1f),
        ) { (dayKey, _) ->
            val day = dayOptions.firstOrNull { it.key == dayKey }
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = FsyGutter, end = FsyGutter, top = 14.dp, bottom = 24.dp),
            ) {
                item(key = "day-title") {
                    Text(
                        text = day?.title ?: EventCalendar.DAY_LABELS[dayKey].orEmpty(),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(bottom = 12.dp),
                    )
                }
                when {
                    appState.scheduleItems.isEmpty() && appState.isLoading -> item(key = "loading") {
                        FsyLoadingBlock(rows = 4, rowHeight = 84.dp)
                    }
                    filteredItems.isEmpty() -> item(key = "empty") {
                        FsyEmptyStateCard(
                            icon = FsyIcons.CalendarDays,
                            title = if (selectedCategory == "all") "Sem atividades neste dia" else "Nada nesta categoria",
                            description = if (selectedCategory == "all") "" else "Tente outra categoria.",
                            actionLabel = if (selectedCategory == "all") null else "Ver todas",
                            onAction = { selectedCategory = "all" },
                        )
                    }
                    else -> {
                        itemsIndexed(filteredItems, key = { _, it -> it.id }) { index, item ->
                            TimelineEntry(
                                item = item,
                                isCurrent = moment.currentItem?.id == item.id,
                                isFirst = index == 0,
                                isLast = index == filteredItems.lastIndex,
                                isReminderSet = appState.personalReminderIds.contains(item.id),
                                onToggleReminder = onToggleReminder,
                                modifier = if (index < 8) Modifier.fsyReveal(index) else Modifier,
                            )
                        }
                        item(key = "reminder-note") {
                            Row(
                                modifier = Modifier.padding(top = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Icon(
                                    FsyIcons.Info,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(16.dp).padding(top = 2.dp),
                                )
                                Text(
                                    text = "Lembretes avisam 10 min antes, neste aparelho. Não substituem a chamada presencial.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Linha do tempo: hora à esquerda, trilho com marcador, cartão à direita.
 * A descrição fica recolhida e abre com toque (revelação progressiva).
 */
@Composable
private fun TimelineEntry(
    item: ScheduleItem,
    isCurrent: Boolean,
    isFirst: Boolean,
    isLast: Boolean,
    isReminderSet: Boolean,
    onToggleReminder: (ScheduleItem, Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable(item.id) { mutableStateOf(false) }
    val cat = categoryStyle(item.category)
    val primary = MaterialTheme.colorScheme.primary
    val rail = MaterialTheme.colorScheme.outlineVariant
    val hasDescription = !item.description.isNullOrBlank()
    // Fonte ampliada (>= 130%): a hora sai da coluna estreita e vai para o topo do cartão.
    val largeText = LocalDensity.current.fontScale >= 1.3f
    val timeRange = if (item.endTime.length >= 4 && item.endTime != "--") "${item.startTime.take(5)}–${item.endTime.take(5)}" else item.startTime.take(5)

    Row(modifier = modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        // Hora
        if (!largeText) Column(modifier = Modifier.width(52.dp).padding(top = 14.dp)) {
            Text(
                text = item.startTime.take(5),
                style = MaterialTheme.typography.titleSmall.merge(TabularTextStyle),
                fontWeight = FontWeight.Bold,
                color = if (isCurrent) primary else MaterialTheme.colorScheme.onSurface,
            )
            if (item.endTime.length >= 4 && item.endTime != "--") {
                Text(
                    text = item.endTime.take(5),
                    style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        // Trilho
        Box(modifier = Modifier.width(24.dp).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
            Column(modifier = Modifier.fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.width(2.dp).height(18.dp).background(if (isFirst) Color.Transparent else rail))
                Box(
                    modifier = Modifier
                        .size(if (isCurrent) 14.dp else 10.dp)
                        .clip(CircleShape)
                        .background(if (isCurrent) primary else MaterialTheme.colorScheme.surface)
                        .border(2.dp, if (isCurrent) primary else cat.color, CircleShape),
                )
                Box(Modifier.width(2.dp).weight(1f).background(if (isLast) Color.Transparent else rail))
            }
        }
        // Cartão
        Surface(
            shape = RoundedCornerShape(18.dp),
            color = if (isCurrent) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, if (isCurrent) primary.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outlineVariant),
            modifier = Modifier
                .weight(1f)
                .padding(start = 6.dp, bottom = 10.dp),
        ) {
            Column(
                modifier = Modifier
                    .then(
                        if (hasDescription) Modifier.clickable(
                            role = Role.Button,
                            onClickLabel = if (expanded) "Recolher detalhes" else "Ver detalhes",
                        ) { expanded = !expanded } else Modifier
                    )
                    .animateContentSize()
                    .padding(start = 14.dp, top = 12.dp, bottom = 6.dp, end = 6.dp),
            ) {
                if (largeText) {
                    Text(
                        text = timeRange,
                        style = MaterialTheme.typography.titleSmall.merge(TabularTextStyle),
                        fontWeight = FontWeight.Bold,
                        color = if (isCurrent) primary else MaterialTheme.colorScheme.onSurface,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (isCurrent) {
                        Text("Agora", style = MaterialTheme.typography.labelMedium, color = primary, fontWeight = FontWeight.Bold)
                        Text("·", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.size(8.dp).clip(CircleShape).background(cat.color))
                    Text(cat.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 4.dp, end = 8.dp),
                )
                if (item.location.isNotBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(top = 2.dp),
                    ) {
                        Icon(FsyIcons.MapPin, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        Text(item.location, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                AnimatedVisibility(visible = expanded && hasDescription) {
                    Text(
                        text = item.description.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp, end = 8.dp),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (hasDescription) {
                        Icon(
                            imageVector = if (expanded) FsyIcons.ChevronDown else FsyIcons.ChevronRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            text = if (expanded) "Menos" else "Detalhes",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 4.dp),
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    ReminderToggle(isSet = isReminderSet, title = item.title, onClick = { onToggleReminder(item, isReminderSet) })
                }
            }
        }
    }
}

@Composable
private fun ReminderToggle(isSet: Boolean, title: String, onClick: () -> Unit) {
    val tint = if (isSet) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(role = Role.Switch, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "Lembrete 10 minutos antes de $title"
                stateDescription = if (isSet) "Ativado" else "Desativado"
            }
            .height(48.dp)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(if (isSet) FsyIcons.BellRing else FsyIcons.Bell, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        Text(
            text = if (isSet) "Lembrete" else "Lembrar",
            style = MaterialTheme.typography.labelLarge,
            color = tint,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
