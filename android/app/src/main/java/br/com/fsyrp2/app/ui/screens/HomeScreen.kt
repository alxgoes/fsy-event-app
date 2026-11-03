package br.com.fsyrp2.app.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.EventMoment
import br.com.fsyrp2.app.data.EventPhase
import br.com.fsyrp2.app.model.Announcement
import br.com.fsyrp2.app.model.ScheduleItem
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.LibreBaskervilleFontFamily
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import java.time.Duration
import java.time.Instant

/**
 * Início: o essencial do dia. Um bloco "Agora / A seguir" vivo, a agenda de hoje resumida,
 * a companhia, os dois avisos mais recentes e uma faixa de fotos. Nada de personalizar.
 */
@Composable
fun HomeScreen(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val now = rememberFsyNow()
    val profile = appState.profile
    val moment = remember(appState.scheduleItems, now) { EventCalendar.moment(appState.scheduleItems, now) }
    val firstName = profile?.firstName?.takeIf { profile.fullName.isNotBlank() }

    FsyRefreshable(
        refreshing = appState.isLoading && !appState.isInitialLoading,
        onRefresh = { appState.refreshCoreData() },
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(horizontal = FsyGutter)
                .padding(top = 12.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            HomeHeader(
                name = profile?.fullName ?: "",
                firstName = firstName,
                photoUrl = appState.profilePhoto.approvedUrl,
                onPhotoError = { appState.refreshProfilePhoto() },
                onAvatar = {
                    haptics.tick()
                    appState.selectedTab = MainTab.MORE
                },
                modifier = Modifier.fsyHomeEntrance(0),
            )

            FsyConnectivityBanner(
                isOnline = appState.isOnline,
                lastSyncedAtLabel = appState.lastSyncedAtLabel,
                errorMessage = appState.globalBannerError,
                onRefresh = { appState.refreshCoreData() },
            )

            if (appState.isInitialLoading) {
                FsyLoadingBlock(rows = 1, rowHeight = 196.dp)
                FsyLoadingBlock(rows = 3, rowHeight = 56.dp)
                return@Column
            }

            EventHero(moment = moment, now = now, modifier = Modifier.fsyHomeEntrance(1))

            DayAgendaSection(
                moment = moment,
                items = appState.scheduleItems,
                now = now,
                onOpenItem = { id ->
                    haptics.tick()
                    appState.openAgendaAt(id)
                },
                modifier = Modifier.fsyHomeEntrance(2),
            )

            CompanySection(appState = appState, modifier = Modifier.fsyHomeEntrance(3))

            LatestAnnouncementsSection(
                items = appState.announcements.sortedByDescending { it.createdAt }.take(2),
                readIds = appState.readAnnouncementIds,
                now = now,
                onOpen = { id ->
                    haptics.tick()
                    appState.openAnnouncement(id)
                },
                onAll = {
                    haptics.tick()
                    appState.selectedTab = MainTab.ANNOUNCEMENTS
                },
                modifier = Modifier.fsyHomeEntrance(4),
            )

            PhotoStripSection(
                appState = appState,
                onOpen = {
                    haptics.tick()
                    appState.open(OverlayDestination.Gallery)
                },
                modifier = Modifier.fsyHomeEntrance(5),
            )
        }
    }
}

@Composable
private fun HomeHeader(
    name: String,
    firstName: String?,
    photoUrl: String?,
    onPhotoError: () -> Unit,
    onAvatar: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) { heading() }) {
            Text(
                text = if (firstName != null) "Olá, $firstName" else "Olá",
                style = MaterialTheme.typography.headlineLarge,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "${FsyEventFacts.THEME} · ${FsyEventFacts.SCRIPTURE}",
                style = MaterialTheme.typography.bodyMedium,
                fontFamily = LibreBaskervilleFontFamily,
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .clickable(role = Role.Button, onClickLabel = "Abrir Mais", onClick = onAvatar),
            contentAlignment = Alignment.Center,
        ) {
            FsyAvatar(name = name.ifBlank { "FSY" }, photoUrl = photoUrl, size = 44.dp, onImageError = onPhotoError)
        }
    }
}

// --- Bloco "Agora / A seguir" -------------------------------------------------------------

/**
 * O assunto do Início é o tempo. Antes: contagem e local. Durante: atividade atual com barra
 * de progresso viva + a seguinte. Entre atividades: a próxima com "começa em X min".
 * O templo oficial fica à direita, sem recolorir e sem sombra.
 */
@Composable
private fun EventHero(moment: EventMoment, now: Instant, modifier: Modifier = Modifier) {
    val ext = FsyPalette.Extended
    val onHero = ext.onHero
    val muted = onHero.copy(alpha = 0.82f)
    val largeText = LocalDensity.current.fontScale >= 1.3f
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        color = ext.hero,
        contentColor = onHero,
    ) {
        Box {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 22.dp, end = 22.dp, top = 22.dp, bottom = 22.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                when (moment.phase) {
                    EventPhase.BEFORE -> BeforeEventContent(now = now, muted = muted, reserveEnd = !largeText)
                    EventPhase.DURING -> DuringEventContent(moment = moment, now = now, muted = muted, reserveEnd = !largeText)
                    EventPhase.AFTER -> {
                        HeroPill("Até a próxima")
                        Text("Sessão concluída", style = MaterialTheme.typography.headlineMedium, color = onHero)
                        Text(
                            "Obrigado por viver estes dias. ${FsyEventFacts.THEME}.",
                            style = MaterialTheme.typography.bodyLarge,
                            color = muted,
                        )
                    }
                }
            }
            if (!largeText) {
                FsyTempleMark(
                    height = 76.dp,
                    decorative = true,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 20.dp, end = 20.dp),
                )
            }
        }
    }
}

@Composable
private fun HeroPill(text: String) {
    Surface(color = MaterialTheme.colorScheme.secondary, contentColor = MaterialTheme.colorScheme.onSecondary, shape = FsyPillShape) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
        )
    }
}

@Composable
private fun BeforeEventContent(now: Instant, muted: Color, reserveEnd: Boolean) {
    val onHero = FsyPalette.Extended.onHero
    val start = EventCalendar.PARTICIPANTS_START.toInstant()
    val minutesLeft = Duration.between(now, start).toMinutes().coerceAtLeast(0)
    val days = EventCalendar.daysUntilStart(now)
    val endPad = if (reserveEnd) Modifier.padding(end = 72.dp) else Modifier
    Text("Faltam", style = MaterialTheme.typography.titleMedium, color = muted, modifier = endPad)
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = endPad.semantics(mergeDescendants = true) {},
    ) {
        if (days >= 1) {
            Text(
                text = days.toString(),
                style = TabularTextStyle.copy(fontSize = 64.sp, lineHeight = 64.sp, fontWeight = FontWeight.Bold),
                color = onHero,
            )
            Text(
                text = if (days == 1) "dia" else "dias",
                style = MaterialTheme.typography.headlineSmall,
                color = onHero,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        } else {
            Text(
                text = FsyFormat.duration(minutesLeft),
                style = TabularTextStyle.copy(fontSize = 40.sp, lineHeight = 44.sp, fontWeight = FontWeight.Bold),
                color = onHero,
            )
        }
    }
    Text(FsyEventFacts.DATES, style = MaterialTheme.typography.bodyLarge, color = onHero)
    HeroPlaceLine("${FsyEventFacts.VENUE} · ${FsyEventFacts.CITY.substringBefore(',')}", muted)
}

@Composable
private fun HeroPlaceLine(text: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(FsyIcons.MapPin, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = color)
    }
}

@Composable
private fun DuringEventContent(moment: EventMoment, now: Instant, muted: Color, reserveEnd: Boolean) {
    val onHero = FsyPalette.Extended.onHero
    val endPad = if (reserveEnd) Modifier.padding(end = 72.dp) else Modifier
    val current = moment.currentItem
    val next = moment.nextItem
    if (current != null) {
        val start = EventCalendar.startOf(current)?.toInstant()
        val end = EventCalendar.effectiveEndOf(current, listOfNotNull(current, moment.nextItem))?.toInstant()
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = endPad) {
            HeroPill("Agora")
            Text(FsyFormat.timeRange(current), style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle), color = onHero)
        }
        Text(current.title, style = MaterialTheme.typography.headlineMedium, color = onHero, modifier = endPad)
        if (current.location.isNotBlank()) HeroPlaceLine(current.location, muted)
        if (start != null && end != null && end.isAfter(start)) {
            val total = Duration.between(start, end).toMillis().toFloat()
            val done = Duration.between(start, now).toMillis().toFloat()
            val target = (done / total).coerceIn(0f, 1f)
            val reduce = fsyMotionPreferences().reduceMotion
            val progress by animateFloatAsState(
                targetValue = target,
                animationSpec = if (reduce) androidx.compose.animation.core.snap() else tween(900),
                label = "heroProgress",
            )
            val minutesLeft = Duration.between(now, end).toMinutes() + 1
            Column(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .padding(top = 4.dp)
                    .clearAndSetSemantics { contentDescription = "Termina em ${FsyFormat.duration(minutesLeft)}" },
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(FsyPillShape)
                        .background(onHero.copy(alpha = 0.22f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progress)
                            .fillMaxHeight()
                            .clip(FsyPillShape)
                            .background(MaterialTheme.colorScheme.secondary),
                    )
                }
                Text("Termina em ${FsyFormat.duration(minutesLeft)}", style = MaterialTheme.typography.labelLarge, color = muted)
            }
        }
        if (next != null) {
            HorizontalDivider(color = onHero.copy(alpha = 0.2f), modifier = Modifier.padding(vertical = 4.dp))
            NextLine(next, now, muted)
        }
    } else if (next != null) {
        val startsIn = EventCalendar.startOf(next)?.toInstant()?.let { Duration.between(now, it).toMinutes() + 1 }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = endPad) {
            HeroPill("A seguir")
            if (startsIn != null && startsIn < 180) {
                Text("começa em ${FsyFormat.duration(startsIn)}", style = MaterialTheme.typography.titleMedium, color = onHero)
            } else {
                Text("às ${FsyFormat.hhmm(next.startTime)}", style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle), color = onHero)
            }
        }
        Text(next.title, style = MaterialTheme.typography.headlineMedium, color = onHero, modifier = endPad)
        val nextDay = EventCalendar.DAY_LABELS[next.dayKey]
        val today = moment.selectedDayKey
        if (next.dayKey != today && nextDay != null) {
            Text(nextDay, style = MaterialTheme.typography.bodyLarge, color = muted)
        }
        if (next.location.isNotBlank()) HeroPlaceLine(next.location, muted)
    } else {
        HeroPill("Sessão em andamento")
        Text("Por hoje é só", style = MaterialTheme.typography.headlineMedium, color = onHero, modifier = endPad)
        Text("Descanse bem. A programação de amanhã aparece aqui.", style = MaterialTheme.typography.bodyLarge, color = muted)
    }
}

@Composable
private fun NextLine(next: ScheduleItem, now: Instant, muted: Color) {
    val onHero = FsyPalette.Extended.onHero
    val startsIn = EventCalendar.startOf(next)?.toInstant()?.let { Duration.between(now, it).toMinutes() + 1 }
    Row(
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            FsyFormat.hhmm(next.startTime),
            style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle),
            fontWeight = FontWeight.Bold,
            color = onHero,
        )
        Column(Modifier.weight(1f)) {
            Text(
                text = if (startsIn != null && startsIn < 180) "A seguir · em ${FsyFormat.duration(startsIn)}" else "A seguir",
                style = MaterialTheme.typography.labelLarge,
                color = muted,
            )
            Text(next.title, style = MaterialTheme.typography.titleMedium, color = onHero)
        }
    }
}

// --- Agenda do dia ------------------------------------------------------------------------

@Composable
private fun DayAgendaSection(
    moment: EventMoment,
    items: List<ScheduleItem>,
    now: Instant,
    onOpenItem: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (moment.phase == EventPhase.AFTER) return
    val dayKey = if (moment.phase == EventPhase.BEFORE) "dia1" else moment.selectedDayKey
    val dayItems = remember(items, dayKey) { items.filter { it.dayKey == dayKey }.sortedBy { it.startTime } }
    val dayLabel = EventCalendar.DAY_LABELS[dayKey].orEmpty()
    val title = if (moment.phase == EventPhase.BEFORE) "Primeiro dia" else "Hoje"
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FsySectionTitle(text = "$title · $dayLabel")
        if (dayItems.isEmpty()) {
            Text(
                "Os horários aparecem aqui assim que a programação for publicada.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@Column
        }
        // Durante o dia, começa pela atividade atual (ou a próxima); no máximo 5 linhas.
        val anchorId = moment.currentItem?.id ?: moment.nextItem?.id
        val anchorIndex = dayItems.indexOfFirst { it.id == anchorId }.takeIf { it >= 0 && moment.phase == EventPhase.DURING } ?: 0
        val visible = dayItems.drop(anchorIndex).take(5)
        val remaining = dayItems.size - anchorIndex - visible.size
        FsySectionCard(contentPadding = PaddingValues(vertical = 6.dp, horizontal = 6.dp)) {
            visible.forEachIndexed { index, item ->
                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(horizontal = 14.dp))
                AgendaRow(item = item, isNow = item.id == moment.currentItem?.id, isPast = isPast(item, now), onClick = { onOpenItem(item.id) })
            }
            if (remaining > 0) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(horizontal = 14.dp))
                FsyListRow(
                    title = "Ver o dia todo",
                    supporting = if (remaining == 1) "Mais 1 atividade" else "Mais $remaining atividades",
                    onClick = { onOpenItem(dayItems[anchorIndex + visible.size].id) },
                )
            }
        }
    }
}

private fun isPast(item: ScheduleItem, now: Instant): Boolean {
    val end = EventCalendar.endOf(item) ?: EventCalendar.startOf(item) ?: return false
    return end.toInstant().isBefore(now)
}

@Composable
private fun AgendaRow(item: ScheduleItem, isNow: Boolean, isPast: Boolean, onClick: () -> Unit) {
    val scheme = MaterialTheme.colorScheme
    val textColor = if (isPast) scheme.onSurfaceVariant else scheme.onSurface
    val largeText = LocalDensity.current.fontScale >= 1.3f
    val rowMod = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(18.dp))
        .background(if (isNow) scheme.primaryContainer else Color.Transparent)
        .clickable(role = Role.Button, onClickLabel = "Abrir na agenda", onClick = onClick)
        .heightIn(min = 56.dp)
        .padding(horizontal = 14.dp, vertical = 12.dp)
        .semantics(mergeDescendants = true) {}
    val time: @Composable () -> Unit = {
        Text(
            text = FsyFormat.hhmm(item.startTime),
            style = MaterialTheme.typography.titleMedium.merge(TabularTextStyle),
            fontWeight = FontWeight.Bold,
            color = if (isNow) scheme.onPrimaryContainer else textColor,
            modifier = if (largeText) Modifier else Modifier.width(56.dp),
        )
    }
    val body: @Composable (Modifier) -> Unit = { m ->
        Column(m, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (isNow) {
                Text("Agora", style = MaterialTheme.typography.labelLarge, color = scheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
            }
            Text(item.title, style = MaterialTheme.typography.titleMedium, color = if (isNow) scheme.onPrimaryContainer else textColor)
            if (item.location.isNotBlank()) {
                Text(
                    item.location,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (isNow) scheme.onPrimaryContainer.copy(alpha = 0.85f) else scheme.onSurfaceVariant,
                )
            }
        }
    }
    if (largeText) {
        Column(rowMod) {
            time()
            body(Modifier.fillMaxWidth())
        }
    } else {
        Row(rowMod, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            time()
            body(Modifier.weight(1f))
            Icon(FsyIcons.ChevronRight, contentDescription = null, tint = scheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

// --- Minha companhia ----------------------------------------------------------------------

@Composable
private fun CompanySection(appState: FsyAppState, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val comp = appState.company
    val profile = appState.profile
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FsySectionTitle("Minha companhia")
        FsySectionCard(contentPadding = PaddingValues(20.dp)) {
            if (comp == null) {
                Text(
                    text = "Aparece aqui quando a coordenação vincular você a uma companhia.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                return@FsySectionCard
            }
            Text(comp.name, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
            if (!comp.motto.isNullOrBlank()) {
                Text(
                    text = "“${comp.motto}”",
                    fontFamily = LibreBaskervilleFontFamily,
                    fontStyle = FontStyle.Italic,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            val counselors = counselorContacts(appState)
            if (counselors.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                Text(
                    if (counselors.size == 1) "Consultor(a)" else "Consultores",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                counselors.forEach { (name, phone) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 52.dp)
                            .padding(top = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        FsyAvatar(name = name, size = 36.dp, containerColor = MaterialTheme.colorScheme.primaryContainer, contentColor = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text(name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                        if (!phone.isNullOrBlank()) {
                            FsyIconButton(
                                icon = FsyIcons.Phone,
                                contentDescription = "Ligar para $name",
                                tint = MaterialTheme.colorScheme.primary,
                                onClick = { openDialer(context, phone) },
                            )
                        }
                    }
                }
            }
            val room = profile?.room?.takeIf { it.isNotBlank() }
            if (room != null) {
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(FsyIcons.BedDouble, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                    Text("Quarto $room", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

/** Nome e telefone (quando o servidor informar) de quem cuida da companhia. */
internal fun counselorContacts(appState: FsyAppState): List<Pair<String, String?>> {
    val comp = appState.company ?: return emptyList()
    val fromProfiles = comp.counselorProfiles.map { it.fullName to null as String? }
    val names = if (fromProfiles.isNotEmpty()) fromProfiles else comp.counselors.filter { it.isNotBlank() }.map { it to null }
    return names.distinctBy { it.first.trim().lowercase() }.take(4)
}

// --- Avisos recentes ----------------------------------------------------------------------

@Composable
private fun LatestAnnouncementsSection(
    items: List<Announcement>,
    readIds: Set<String>,
    now: Instant,
    onOpen: (String) -> Unit,
    onAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FsySectionTitle("Avisos") {
            if (items.isNotEmpty()) FsyTextAction(label = "Ver todos", onClick = onAll, description = "Ver todos os avisos")
        }
        if (items.isEmpty()) {
            Text("Nenhum aviso por enquanto.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            return@Column
        }
        FsySectionCard(contentPadding = PaddingValues(6.dp)) {
            items.forEachIndexed { index, ann ->
                if (index > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(horizontal = 14.dp))
                val author = ann.author?.fullName?.takeIf { it.isNotBlank() } ?: "Coordenação"
                val unread = ann.id !in readIds
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .clickable(role = Role.Button, onClickLabel = "Abrir aviso") { onOpen(ann.id) }
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                        .semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    FsyAvatar(name = author, size = 40.dp, containerColor = MaterialTheme.colorScheme.primaryContainer, contentColor = MaterialTheme.colorScheme.onPrimaryContainer)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (ann.isUrgent) {
                                Text("Urgente", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
                            }
                            Text(
                                listOfNotNull(author, FsyFormat.relative(ann.createdAt, now)).joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                        }
                        Text(ann.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(
                            ann.content,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (unread) {
                        FsyDot(
                            color = MaterialTheme.colorScheme.tertiary,
                            size = 10.dp,
                            modifier = Modifier
                                .padding(top = 6.dp)
                                .semantics { contentDescription = "Novo" },
                        )
                    }
                }
            }
        }
    }
}

// --- Faixa de fotos -----------------------------------------------------------------------

@Composable
private fun PhotoStripSection(appState: FsyAppState, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val photos = remember(appState.instagramPosts, appState.publicMediaPhotos) {
        appState.instagramPosts.map { it.imageUrl to it.caption.ifBlank { "Publicação do Instagram" } } +
            appState.publicMediaPhotos.mapNotNull { p -> p.thumbnailUrl?.takeIf { it.isNotBlank() }?.let { it to p.title } }
    }.take(8)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FsySectionTitle("Fotos") {
            FsyTextAction(label = "Ver todas", onClick = onOpen, description = "Abrir as fotos")
        }
        if (photos.isEmpty()) {
            FsyClickableCard(onClick = onOpen, onClickLabel = "Abrir as fotos", contentPadding = PaddingValues(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Icon(FsyIcons.Camera, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f)) {
                        Text("As fotos da sessão aparecem aqui", style = MaterialTheme.typography.titleMedium)
                        Text("@${br.com.fsyrp2.app.model.InstagramPost.OFFICIAL_HANDLE} no Instagram", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            return@Column
        }
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(end = 4.dp),
        ) {
            itemsIndexed(photos, key = { i, p -> "$i-${p.first}" }) { _, (url, caption) ->
                RemotePublicImage(
                    url = url,
                    contentDescription = caption,
                    maxDimensionPx = 480,
                    modifier = Modifier
                        .size(128.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .clickable(role = Role.Button, onClickLabel = "Abrir as fotos", onClick = onOpen),
                )
            }
        }
    }
}
