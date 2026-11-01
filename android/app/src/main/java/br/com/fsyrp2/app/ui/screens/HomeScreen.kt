package br.com.fsyrp2.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.clickable
import android.content.Context
import android.view.accessibility.AccessibilityManager
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.input.pointer.pointerInput
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import br.com.fsyrp2.app.model.Announcement
import br.com.fsyrp2.app.ui.motion.FsyMotion
import kotlinx.coroutines.delay
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyStateTween
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.EventPhase
import br.com.fsyrp2.app.model.ScheduleItem
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(appState: FsyAppState) {
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val scrollState = rememberScrollState()
    val profile = appState.profile
    val moment = remember(appState.scheduleItems) { EventCalendar.moment(appState.scheduleItems) }
    val daysUntilStart = remember { EventCalendar.daysUntilStart() }

    val defaultDashboardOrder = CardOrderManager.PAGE_DEFAULT_IDS["dashboard"].orEmpty()
    val currentOrder = appState.cardOrderFor("dashboard")

    val goAgenda = {
        haptics.tick()
        appState.selectedTab = MainTab.AGENDA
    }

    val cards = listOf(
        ReorderableCardItem(id = "next-activity", title = "Programação") {
            FsySectionCard {
                FsyCardHeader(
                    icon = FsyIcons.Clock,
                    title = "Programação",
                    actionLabel = "Agenda",
                    actionDescription = "Abrir a agenda completa",
                    onAction = goAgenda,
                )
                Spacer(Modifier.height(12.dp))
                val currentItem = moment.currentItem
                val nextItem = moment.nextItem
                if (currentItem == null && nextItem == null) {
                    Text(
                        text = "Os horários aparecem aqui assim que a programação for publicada.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (currentItem != null) {
                    MomentRow(item = currentItem, label = "Agora", highlighted = true)
                }
                if (currentItem != null && nextItem != null) {
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant,
                        modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
                    )
                }
                if (nextItem != null) {
                    MomentRow(
                        item = nextItem,
                        label = "A seguir · ${EventCalendar.DAY_LABELS[nextItem.dayKey] ?: nextItem.dayKey}",
                        highlighted = false,
                    )
                }
                DayAgendaDisclosure(
                    dayKey = moment.selectedDayKey,
                    items = appState.scheduleItems,
                    currentId = currentItem?.id,
                    onOpenAgenda = goAgenda,
                )
            }
        },
        ReorderableCardItem(id = "announcements", title = "Avisos") {
            FsySectionCard {
                FsyCardHeader(
                    icon = FsyIcons.Megaphone,
                    title = "Avisos",
                    actionLabel = if (appState.announcements.isNotEmpty()) "Todos (${appState.announcements.size})" else null,
                    actionDescription = "Ver todos os ${appState.announcements.size} avisos",
                    onAction = {
                        haptics.tick()
                        appState.selectedTab = MainTab.ANNOUNCEMENTS
                    },
                )
                Spacer(Modifier.height(8.dp))
                val urgent = appState.announcements.filter { it.isUrgent }.take(3)
                val others = appState.announcements.filterNot { it.isUrgent }
                val open: (String) -> Unit = { id ->
                    haptics.tick()
                    appState.focusedAnnouncementId = id
                    appState.selectedTab = MainTab.ANNOUNCEMENTS
                }
                if (urgent.isEmpty() && others.isEmpty()) {
                    Text(
                        text = "Nenhum aviso por enquanto.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                // Urgentes ficam fixos: nunca entram na rotação.
                urgent.forEach { ann -> HomeAnnouncementRow(ann = ann, onOpen = { open(ann.id) }) }
                if (others.isNotEmpty()) {
                    if (urgent.isNotEmpty()) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(horizontal = 4.dp))
                    AnnouncementRotator(items = others, onOpen = open)
                }
            }
        },
        ReorderableCardItem(id = "company", title = "Minha companhia") {
            val comp = appState.company
            FsySectionCard {
                FsyCardHeader(icon = FsyIcons.Users, title = "Minha companhia")
                Spacer(Modifier.height(12.dp))
                if (comp != null) {
                    Text(
                        text = comp.name,
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    if (!comp.motto.isNullOrBlank()) {
                        Text(
                            text = "“${comp.motto}”",
                            fontFamily = LibreBaskervilleFontFamily,
                            fontStyle = FontStyle.Italic,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    val chips = buildList {
                        comp.room?.takeIf { it.isNotBlank() }?.let { add(FsyIcons.MapPin to "Sala $it") }
                        profile?.room?.takeIf { it.isNotBlank() }?.let { add(FsyIcons.BedDouble to "Quarto $it") }
                        profile?.busAssignment?.takeIf { it.isNotBlank() }?.let { add(FsyIcons.Bus to "Ônibus $it") }
                    }
                    if (chips.isNotEmpty()) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 12.dp),
                        ) {
                            chips.forEach { (icon, text) -> FsyMetaChip(text = text, icon = icon) }
                        }
                    }
                    if (!comp.driveUrl.isNullOrBlank()) {
                        FsyActionButton(
                            label = "Fotos da companhia",
                            icon = FsyIcons.ExternalLink,
                            tone = FsyButtonTone.Outline,
                            onClick = {
                                haptics.confirm()
                                ExternalUrlLauncher.openExternalUrl(context, comp.driveUrl.orEmpty())
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp),
                        )
                    }
                } else {
                    Text(
                        text = "Aparece aqui quando a coordenação vincular você a uma companhia.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        ReorderableCardItem(id = "gallery", title = "Galeria") {
            val openGallery = {
                haptics.tick()
                appState.overlayDestination = OverlayDestination.Gallery
            }
            FsySectionCard {
                FsyCardHeader(
                    icon = FsyIcons.Images,
                    title = "Galeria",
                    actionLabel = "Abrir",
                    actionDescription = "Abrir a galeria",
                    onAction = openGallery,
                )
                val previewPosts = appState.instagramPosts.take(3)
                if (previewPosts.isNotEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        previewPosts.forEach { post ->
                            RemotePublicImage(
                                url = post.imageUrl,
                                contentDescription = post.caption.ifBlank { "Publicação do Instagram" },
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .clickable(role = Role.Button, onClickLabel = "Abrir galeria", onClick = openGallery),
                            )
                        }
                    }
                } else if (appState.publicMediaPhotos.isNotEmpty()) {
                    Text(
                        text = "${appState.publicMediaPhotos.size} álbuns disponíveis",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        },
    )

    val greetingName = profile?.fullName?.substringBefore(" ")?.takeIf { it.isNotBlank() }

    Column(modifier = Modifier.fillMaxSize()) {
        FsyTopBar(
            title = if (greetingName != null) "Olá, $greetingName" else "Olá",
            subtitle = FsyEventFacts.SESSION,
            showMark = false,
            actions = {
                FsyIconButton(
                    icon = FsyIcons.RefreshCw,
                    contentDescription = "Atualizar",
                    onClick = {
                        haptics.tick()
                        appState.refreshCoreData()
                    },
                    enabled = !appState.isLoading,
                )
            },
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = FsyGutter)
                .padding(top = 4.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            FsyConnectivityBanner(
                isOnline = appState.isOnline,
                lastSyncedAtLabel = appState.lastSyncedAtLabel,
                errorMessage = appState.globalBannerError,
                onRefresh = { appState.refreshCoreData() },
            )

            EventMomentHero(
                phase = moment.phase,
                daysUntilStart = daysUntilStart,
                current = moment.currentItem,
                onOpenAgenda = goAgenda,
                modifier = Modifier.fsyHomeEntrance(0),
            )

            val role = profile?.roleEnum ?: UserRole.JOVEM
            val hasAdminAccess = role.canAccessAdminHub
            val isCounselorOrManager = role == UserRole.CONSULTOR || role.isManager
            if (isCounselorOrManager || hasAdminAccess) QuickActions(
                modifier = Modifier.fsyHomeEntrance(1),
                showCounselor = isCounselorOrManager,
                showAdmin = hasAdminAccess,
                onAgenda = goAgenda,
                onAnnouncements = {
                    haptics.tick()
                    appState.selectedTab = MainTab.ANNOUNCEMENTS
                },
                onGallery = {
                    haptics.tick()
                    appState.overlayDestination = OverlayDestination.Gallery
                },
                onCounselor = {
                    haptics.confirm()
                    appState.overlayDestination = OverlayDestination.CounselorPanel
                },
                onAdmin = {
                    haptics.confirm()
                    appState.overlayDestination = OverlayDestination.AdminHub()
                },
            )

            ReorderableCardSection(
                pageKey = "dashboard",
                defaultIds = defaultDashboardOrder,
                orderedIds = currentOrder,
                onOrderChange = { appState.updateCardOrder("dashboard", it) },
                cards = cards,
                scrollState = scrollState,
                reveal = { i -> fsyHomeEntrance(i) },
            )

            ThemeOfTheYearCard()
        }
    }
}

/**
 * Faixa do momento do evento: o tempo é o assunto da tela inicial.
 * Antes: contagem; durante: o que acontece agora; depois: encerramento. Fatos oficiais só.
 */
@Composable
private fun EventMomentHero(
    phase: EventPhase,
    daysUntilStart: Int,
    current: ScheduleItem?,
    onOpenAgenda: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ext = FsyPalette.Extended
    val title = when (phase) {
        EventPhase.BEFORE -> when {
            daysUntilStart <= 0 -> "Começa hoje"
            daysUntilStart == 1 -> "Falta 1 dia"
            else -> "Faltam $daysUntilStart dias"
        }
        EventPhase.DURING -> current?.title ?: "Sessão em andamento"
        EventPhase.AFTER -> "Sessão concluída"
    }
    val badge = when (phase) {
        EventPhase.BEFORE -> FsyEventFacts.DATES_SHORT
        EventPhase.DURING -> current?.let { "Agora · ${it.startTime.take(5)}–${it.endTime.take(5)}" } ?: "Em andamento"
        EventPhase.AFTER -> FsyEventFacts.THEME
    }
    FsyClickableCard(
        onClick = onOpenAgenda,
        onClickLabel = "Abrir agenda",
        containerColor = ext.hero,
        borderColor = ext.hero,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
        modifier = modifier,
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FsyStatusBadge(
                    text = badge,
                    backgroundColor = MaterialTheme.colorScheme.secondary,
                    contentColor = MaterialTheme.colorScheme.onSecondary,
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = ext.onHero,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(FsyIcons.MapPin, contentDescription = null, tint = ext.onHero, modifier = Modifier.size(16.dp))
                    Text(
                        text = if (phase == EventPhase.DURING && !current?.location.isNullOrBlank()) current?.location.orEmpty()
                        else "${FsyEventFacts.VENUE} · ${FsyEventFacts.CITY}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ext.onHero,
                    )
                }
            }
        }
    }
}

@Composable
private fun MomentRow(item: ScheduleItem, label: String, highlighted: Boolean) {
    if (LocalDensity.current.fontScale >= 1.3f) {
        // Fonte ampliada: faixa de horário em linha própria, acima do texto (nada de "09:0" + "0").
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (highlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = if (item.endTime.length >= 4 && item.endTime != "--") "${item.startTime.take(5)}–${item.endTime.take(5)}" else item.startTime.take(5),
                style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle),
                fontWeight = FontWeight.Bold,
                color = if (highlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
            )
            Text(text = item.title, style = MaterialTheme.typography.titleMedium)
            if (item.location.isNotBlank()) {
                Text(item.location, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        return
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.width(56.dp), horizontalAlignment = Alignment.Start) {
            Text(
                text = item.startTime.take(5),
                style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle),
                color = if (highlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
            if (item.endTime.length >= 4 && item.endTime != "--") {
                Text(
                    text = item.endTime.take(5),
                    style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (highlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(text = item.title, style = MaterialTheme.typography.titleMedium)
            if (item.location.isNotBlank()) {
                Text(
                    text = item.location,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Atalhos em pílula só das funções do perfil (Conselheiro/Administração); destinos comuns ficam na barra. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuickActions(
    modifier: Modifier,
    showCounselor: Boolean,
    showAdmin: Boolean,
    onAgenda: () -> Unit,
    onAnnouncements: () -> Unit,
    onGallery: () -> Unit,
    onCounselor: () -> Unit,
    onAdmin: () -> Unit,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (showAdmin) FsyActionButton("Administração", onAdmin, icon = FsyIcons.ShieldCheck, tone = FsyButtonTone.Primary)
        if (showCounselor) FsyActionButton("Conselheiro", onCounselor, icon = FsyIcons.HandHeart, tone = FsyButtonTone.Tonal)
    }
}

/** Tema do ano: identificador oficial horizontal (PNG original) + versículo, como no portal web. */
@Composable
private fun ThemeOfTheYearCard(modifier: Modifier = Modifier) {
    // Placa sempre clara: o PNG oficial tem fundo branco e não pode ser recolorido.
    FsySectionCard(modifier = modifier, containerColor = Color.White, borderColor = Color(0xFFE5E0D6)) {
        FsyOfficialMark(
            horizontal = true,
            modifier = Modifier
                .height(84.dp)
                .align(Alignment.CenterHorizontally),
        )
        HorizontalDivider(color = Color(0xFFE5E0D6), modifier = Modifier.padding(vertical = 10.dp))
        Text(
            text = "“Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.”",
            fontFamily = LibreBaskervilleFontFamily,
            fontStyle = FontStyle.Italic,
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF0F172A),
        )
        Text(
            text = FsyEventFacts.SCRIPTURE,
            style = MaterialTheme.typography.labelMedium,
            color = Color(0xFF475569),
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

/**
 * Agenda do dia em revelação progressiva: fechada mostra só a contagem;
 * aberta lista horários com entrada escalonada.
 */
@Composable
private fun ColumnScope.DayAgendaDisclosure(
    dayKey: String,
    items: List<ScheduleItem>,
    currentId: String?,
    onOpenAgenda: () -> Unit,
) {
    val dayItems = remember(items, dayKey) { items.filter { it.dayKey == dayKey }.sortedBy { it.startTime } }
    if (dayItems.isEmpty()) return
    var open by rememberSaveable(dayKey) { mutableStateOf(false) }
    val reduce = fsyMotionPreferences().reduceMotion
    val dayLabel = EventCalendar.DAY_LABELS[dayKey] ?: dayKey
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(top = 12.dp))
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(role = Role.Button, onClickLabel = if (open) "Recolher" else "Mostrar o dia") { open = !open }
            .padding(horizontal = 4.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(FsyIcons.CalendarDays, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        Text("$dayLabel · ${dayItems.size} atividades", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
        val rotation by animateFloatAsState(
            targetValue = if (open) 90f else 0f,
            animationSpec = fsyStateTween(reduce),
            label = "dayChevron",
        )
        Icon(
            FsyIcons.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.graphicsLayer { rotationZ = rotation },
        )
    }
    AnimatedVisibility(visible = open) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            val largeText = LocalDensity.current.fontScale >= 1.3f
            dayItems.forEachIndexed { index, item ->
                val now = item.id == currentId
                if (largeText) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .fsyReveal(index)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (now) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                            .padding(horizontal = 8.dp, vertical = 8.dp),
                    ) {
                        Text(
                            item.startTime.take(5),
                            style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle),
                            color = if (now) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            item.title,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (now) FontWeight.Bold else FontWeight.Normal,
                            color = if (now) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                } else Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .fsyReveal(index)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (now) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        item.startTime.take(5),
                        style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle),
                        color = if (now) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(48.dp),
                    )
                    Text(
                        item.title,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (now) FontWeight.Bold else FontWeight.Normal,
                        color = if (now) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            FsyTextAction(label = "Abrir na agenda", onClick = onOpenAgenda, modifier = Modifier.align(Alignment.End))
        }
    }
}

@Composable
private fun HomeAnnouncementRow(ann: Announcement, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(role = Role.Button, onClickLabel = "Abrir aviso", onClick = onOpen)
            .padding(horizontal = 4.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        FsyDot(
            color = if (ann.isUrgent) FsyPalette.Danger else MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(top = 7.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = if (ann.isUrgent) "Urgente" else if (ann.companyId != null) "Minha companhia" else "Toda a sessão",
                style = MaterialTheme.typography.labelMedium,
                color = if (ann.isUrgent) FsyPalette.Danger else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(text = ann.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        if (ann.likesCount > 0) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "${ann.likesCount} curtidas" },
            ) {
                Icon(
                    FsyIcons.Heart,
                    contentDescription = null,
                    tint = if (ann.likedByMe) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
                Text(ann.likesCount.toString(), style = MaterialTheme.typography.labelMedium.merge(TabularTextStyle))
            }
        }
    }
}

/**
 * Avisos não urgentes em rotação lenta: 10 s por aviso, troca com deslize curto + fade (350 ms).
 * Pausa sozinha com toque/leitura no cartão, TalkBack ativo, app fora do primeiro plano ou
 * movimento reduzido (aí só controles manuais). Contagem "n de N" e botão Pausar/Retomar.
 */
@Composable
private fun AnnouncementRotator(items: List<Announcement>, onOpen: (String) -> Unit) {
    val context = LocalContext.current
    val reduce = fsyMotionPreferences().reduceMotion
    var index by rememberSaveable { mutableIntStateOf(0) }
    var userPaused by rememberSaveable { mutableStateOf(false) }
    val safeIndex = if (items.isEmpty()) 0 else index.coerceIn(0, items.lastIndex)
    val touchExploration = remember(context) {
        (context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager)?.isTouchExplorationEnabled == true
    }
    val lifecycle = androidx.compose.ui.platform.LocalLifecycleOwner.current.lifecycle
    var resumed by remember { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, _ -> resumed = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    val canAutoplay = items.size > 1 && !reduce && !touchExploration
    val playing = canAutoplay && !userPaused && resumed

    LaunchedEffect(playing, safeIndex, items.size) {
        if (playing) {
            delay(10_000)
            index = (safeIndex + 1) % items.size
        }
    }

    Column {
        AnimatedContent(
            targetState = safeIndex,
            transitionSpec = {
                val transform = if (reduce) {
                    fadeIn(tween(150)) togetherWith fadeOut(tween(150))
                } else {
                    val forward = targetState > initialState || (initialState == items.lastIndex && targetState == 0)
                    val dir = if (forward) 1 else -1
                    (slideInHorizontally(tween(350, easing = FsyMotion.EaseOut)) { w -> dir * w / 6 } + fadeIn(tween(350))) togetherWith
                        (slideOutHorizontally(tween(250, easing = FsyMotion.EaseIn)) { w -> -dir * w / 8 } + fadeOut(tween(250)))
                }
                transform.using(SizeTransform(clip = true))
            },
            label = "announcementRotation",
            // Toque na área de leitura = leitura: pausa a rotação até "Retomar".
            modifier = Modifier.pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    userPaused = true
                }
            },
        ) { i ->
            val ann = items.getOrNull(i)
            if (ann != null) HomeAnnouncementRow(ann = ann, onOpen = { onOpen(ann.id) })
        }
        if (items.size > 1) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "${safeIndex + 1} de ${items.size}",
                    style = MaterialTheme.typography.labelMedium.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 4.dp),
                )
                FsyIconButton(
                    icon = FsyIcons.ChevronLeft,
                    contentDescription = "Aviso anterior",
                    onClick = {
                        userPaused = true
                        index = (safeIndex - 1 + items.size) % items.size
                    },
                )
                if (canAutoplay) {
                    FsyIconButton(
                        icon = if (userPaused) FsyIcons.Play else FsyIcons.Pause,
                        contentDescription = if (userPaused) "Retomar troca automática" else "Pausar troca automática",
                        onClick = { userPaused = !userPaused },
                    )
                }
                FsyIconButton(
                    icon = FsyIcons.ChevronRight,
                    contentDescription = "Próximo aviso",
                    onClick = {
                        userPaused = true
                        index = (safeIndex + 1) % items.size
                    },
                )
            }
        }
    }
}
