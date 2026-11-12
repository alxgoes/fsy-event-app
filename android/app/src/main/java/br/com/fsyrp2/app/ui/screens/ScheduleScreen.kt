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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.lazy.rememberLazyListState
import br.com.fsyrp2.app.model.ScheduleDays
import br.com.fsyrp2.app.ui.components.rememberFsyNow
import br.com.fsyrp2.app.ui.components.FsyFilterChip
import br.com.fsyrp2.app.ui.components.FsyNotice
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
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
import br.com.fsyrp2.app.model.ScheduleVisibility
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

private data class CategoryStyle(val label: String, val color: Color, val staffOnly: Boolean)

/**
 * Atividades para todos: uma cor por tipo (as mesmas do site). Atividades só da equipe: cinza,
 * com o selo "Só equipe" — a cor nunca é o único sinal. Jovem nunca recebe essas atividades.
 */
@Composable
private fun categoryStyle(item: ScheduleItem): CategoryStyle {
    val normalized = ScheduleDays.normalizeCategory(item.category)
    val staffOnly = ScheduleVisibility.isStaffOnly(item)
    val color = when {
        staffOnly -> Color(0xFF94A3B8)
        normalized == "Espiritual" -> Color(0xFF007DA5)
        normalized == "Alimentação" -> Color(0xFF93C742)
        normalized == "Show" || normalized == "Baile" -> Color(0xFFFC4E6D)
        normalized == "Atividade" -> Color(0xFFF68D2E)
        normalized == "Logística" -> Color(0xFF01B6D1)
        else -> Color(0xFFFFB81C)
    }
    return CategoryStyle(normalized, color, staffOnly)
}

@Composable
fun ScheduleScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val now = rememberFsyNow()
    val moment = remember(appState.scheduleItems, now) { EventCalendar.moment(appState.scheduleItems, now) }
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
    var pendingActivityIdForPermission by rememberSaveable { mutableStateOf<String?>(null) }
    var denied by rememberSaveable { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val daysScroll = rememberScrollState()
    val density = LocalDensity.current
    val scrollDays = density.fontScale >= 1.3f
    val dayWidthPx = with(density) { 72.dp.roundToPx() }
    var highlightedId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(selectedDayKey, scrollDays, dayWidthPx) {
        if (scrollDays) {
            withFrameNanos { }
            val selectedIndex = dayOptions.indexOfFirst { it.key == selectedDayKey }.coerceAtLeast(0)
            daysScroll.scrollTo((selectedIndex - 1).coerceAtLeast(0) * dayWidthPx)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        denied = !granted
        val pendingId = pendingActivityIdForPermission
        pendingActivityIdForPermission = null
        if (granted && pendingId != null) {
            appState.togglePersonalReminder(pendingId)
        }
    }

    val categories = listOf("all" to "Todas", "Espiritual" to "Espiritual", "Atividade" to "Atividade", "Alimentação" to "Alimentação")

    val filteredItems = remember(appState.scheduleItems, selectedDayKey, selectedCategory) {
        appState.scheduleItems
            .filter { it.dayKey == selectedDayKey }
            .filter { selectedCategory == "all" || it.normalizedCategory == selectedCategory }
            .sortedBy { it.startTime }
    }

    LaunchedEffect(appState.focusedScheduleItemId, appState.scheduleItems) {
        val id = appState.focusedScheduleItemId ?: return@LaunchedEffect
        val item = appState.scheduleItems.firstOrNull { it.id == id } ?: return@LaunchedEffect
        selectedDayKey = item.dayKey
        selectedCategory = "all"
        highlightedId = id
    }
    LaunchedEffect(highlightedId, filteredItems) {
        val index = filteredItems.indexOfFirst { it.id == highlightedId }
        if (index >= 0) {
            listState.scrollToItem(index + 1)
            appState.consumeFocusedScheduleItem()
        }
    }
    LaunchedEffect(isStaff) {
        if (!isStaff && selectedDayKey == "dia0") selectedDayKey = moment.selectedDayKey
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
            profileAction = { ProfileAccessAction(appState) },
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
            Box(modifier = Modifier.fillMaxWidth().then(if (scrollDays) Modifier.horizontalScroll(daysScroll) else Modifier)) {
                FsySegmentedSelector(
                options = dayOptions.map { it.dayNumber },
                secondaryLines = dayOptions.map { it.weekday },
                descriptions = dayOptions.map { "${it.spoken}: ${it.title}" },
                selectedIndex = selectedIndex,
                modifier = if (scrollDays) Modifier.width(72.dp * dayOptions.size) else Modifier,
                onSelect = { index ->
                    if (dayOptions[index].key != selectedDayKey) {
                        haptics.tick()
                        selectedDayKey = dayOptions[index].key
                    }
                },
            )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                categories.forEach { (catKey, catLabel) ->
                    val isSelected = selectedCategory == catKey
                    FsyFilterChip(
                        selected = isSelected,
                        onClick = {
                            haptics.tick()
                            selectedCategory = catKey
                        },
                        label = { Text(catLabel, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium) },
                        leadingIcon = if (isSelected) {
                            { Icon(FsyIcons.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                        } else null,
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
            }
        }

        if (denied) FsyNotice(container = MaterialTheme.colorScheme.errorContainer, content = MaterialTheme.colorScheme.onErrorContainer, icon = FsyIcons.Bell, text = "As notificações estão desativadas. Ative nas configurações do celular para receber lembretes.")

        AnimatedContent(
            targetState = selectedDayKey to selectedCategory,
            transitionSpec = { fsyContentSwap(reduceMotion) },
            label = "AgendaDaySwap",
            modifier = Modifier.weight(1f),
        ) { (dayKey, _) ->
            val day = dayOptions.firstOrNull { it.key == dayKey }
            LazyColumn(
                state = listState,
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
                                isFocused = highlightedId == item.id,
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
    isFocused: Boolean,
    isFirst: Boolean,
    isLast: Boolean,
    isReminderSet: Boolean,
    onToggleReminder: (ScheduleItem, Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable(item.id) { mutableStateOf(false) }
    LaunchedEffect(isFocused) { if (isFocused) expanded = true }
    val cat = categoryStyle(item)
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
            border = BorderStroke(if (isFocused) 2.dp else 1.dp, if (isCurrent || isFocused) primary.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outlineVariant),
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
                @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
                androidx.compose.foundation.layout.FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (isCurrent) {
                        Text("Agora", style = MaterialTheme.typography.labelMedium, color = primary, fontWeight = FontWeight.Bold)
                        Text("·", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.size(8.dp).clip(CircleShape).background(cat.color))
                    Text(cat.label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (cat.staffOnly) {
                        Text(
                            text = "Só equipe",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
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
                if (largeText && hasDescription) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
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
                        ReminderToggle(isSet = isReminderSet, title = item.title, onClick = { onToggleReminder(item, isReminderSet) })
                    }
                } else {
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
            .heightIn(min = 48.dp)
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
