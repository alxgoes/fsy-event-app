package br.com.fsyrp2.app.ui.screens

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.AdminModule
import br.com.fsyrp2.app.model.Announcement
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.icons.FsyIconsFilled
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyPressScale
import br.com.fsyrp2.app.ui.motion.fsySettleSpring
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * Avisos como um mural: quem escreveu, quando, o texto e a curtida. Dois filtros
 * (Todos / Não lidos). O que aparece na tela por um instante conta como lido.
 */
@Composable
fun AnnouncementsScreen(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val now = rememberFsyNow(60_000L)
    var showUnreadOnly by rememberSaveable { mutableStateOf(false) }
    val unreadCount = appState.unreadAnnouncementCount

    // Ao escolher "Não lidos", a lista fica fixa até trocar o filtro (ler não faz o item sumir).
    val unreadSnapshot = remember(showUnreadOnly) {
        appState.announcements.filter { it.id !in appState.readAnnouncementIds }.map { it.id }.toSet()
    }
    val items = if (showUnreadOnly) appState.announcements.filter { it.id in unreadSnapshot } else appState.announcements
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(listState, appState.announcements) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.mapNotNull { it.key as? String } }
            .collectLatest { keys ->
                delay(1200)
                appState.markAnnouncementsRead(keys.filter { k -> appState.announcements.any { it.id == k } })
            }
    }
    val focusedId = appState.focusedAnnouncementId
    LaunchedEffect(focusedId, items) {
        if (focusedId == null) return@LaunchedEffect
        val idx = items.indexOfFirst { it.id == focusedId }
        if (idx >= 0) {
            listState.animateScrollToItem(idx)
            delay(2500)
            appState.consumeFocusedAnnouncement()
        } else if (items.isNotEmpty()) {
            appState.consumeFocusedAnnouncement()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        FsyTopBar(
            title = "Avisos",
            actions = {
                // Publicar só existe para quem pode publicar (perfil carregado e papel de equipe).
                if (appState.canPublishAnnouncements) {
                    FsyActionButton(
                        label = "Publicar",
                        icon = FsyIcons.Plus,
                        tone = FsyButtonTone.Tonal,
                        onClick = {
                            haptics.confirm()
                            if (appState.effectiveRole == UserRole.CONSULTOR) {
                                appState.open(OverlayDestination.CounselorPanel)
                            } else {
                                appState.open(OverlayDestination.AdminHub(AdminModule.ANNOUNCEMENTS))
                            }
                        },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
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
            FsySegmentedSelector(
                options = listOf("Todos", if (unreadCount > 0) "Não lidos ($unreadCount)" else "Não lidos"),
                selectedIndex = if (showUnreadOnly) 1 else 0,
                onSelect = { index ->
                    haptics.tick()
                    showUnreadOnly = index == 1
                    scope.launch { listState.scrollToItem(0) }
                },
            )
        }

        FsyRefreshable(
            refreshing = appState.isLoading && !appState.isInitialLoading,
            onRefresh = { appState.refreshCoreData() },
            modifier = Modifier.weight(1f),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = FsyGutter, end = FsyGutter, top = 14.dp, bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                when {
                    appState.announcements.isEmpty() && appState.isInitialLoading -> item(key = "loading") {
                        FsyLoadingBlock(rows = 3, rowHeight = 148.dp)
                    }
                    items.isEmpty() -> item(key = "empty") {
                        FsyEmptyStateCard(
                            icon = FsyIcons.Megaphone,
                            title = if (showUnreadOnly) "Tudo lido por aqui" else "Nenhum aviso por enquanto",
                            description = if (showUnreadOnly) "Avisos novos aparecem aqui." else "Quando a coordenação publicar, aparece aqui.",
                        )
                    }
                    else -> itemsIndexed(items, key = { _, it -> it.id }) { index, ann ->
                        AnnouncementPost(
                            ann = ann,
                            now = now,
                            isUnread = ann.id !in appState.readAnnouncementIds,
                            isFocused = focusedId == ann.id,
                            onLike = {
                                haptics.confirm()
                                appState.toggleAnnouncementLike(ann.id)
                            },
                            modifier = if (index < 6) Modifier.fsyReveal(index) else Modifier,
                        )
                    }
                }
            }
        }
    }
}

internal fun authorRoleLabel(role: String?): String = when (role?.trim()?.lowercase()) {
    null, "" -> "Coordenação"
    "coordenador", "casal_diretor", "logistica" -> "Coordenação"
    else -> UserRole.fromWire(role).displayLabel
}

@Composable
private fun AnnouncementPost(
    ann: Announcement,
    now: Instant,
    isUnread: Boolean,
    isFocused: Boolean,
    onLike: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable(ann.id) { mutableStateOf(isFocused) }
    val scheme = MaterialTheme.colorScheme
    val author = ann.author?.fullName?.takeIf { it.isNotBlank() } ?: "Coordenação"
    val meta = listOfNotNull(authorRoleLabel(ann.author?.role), FsyFormat.relative(ann.createdAt, now)).joinToString(" · ")
    val longContent = ann.content.length > 240
    Surface(
        shape = FsyCardShape,
        color = scheme.surface,
        border = BorderStroke(
            if (isFocused) 2.dp else 1.dp,
            when {
                isFocused -> scheme.primary
                ann.isUrgent -> scheme.error.copy(alpha = 0.5f)
                else -> scheme.outlineVariant
            },
        ),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.animateContentSize().padding(start = 18.dp, end = 10.dp, top = 16.dp, bottom = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                FsyAvatar(
                    name = author,
                    size = 44.dp,
                    containerColor = scheme.primaryContainer,
                    contentColor = scheme.onPrimaryContainer,
                )
                Column(Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                    Text(author, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = Int.MAX_VALUE, overflow = TextOverflow.Clip)
                    Text(meta, style = MaterialTheme.typography.bodyMedium, color = scheme.onSurfaceVariant)
                }
                if (isUnread) {
                    FsyDot(color = scheme.tertiary, size = 10.dp, modifier = Modifier.padding(end = 8.dp).semantics { contentDescription = "Novo" })
                }
            }
            if (ann.isUrgent || !ann.companyId.isNullOrBlank()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) {
                    if (ann.isUrgent) {
                        FsyStatusBadge(
                            text = "Urgente",
                            icon = FsyIcons.TriangleAlert,
                            backgroundColor = scheme.errorContainer,
                            contentColor = scheme.onErrorContainer,
                        )
                    }
                    if (!ann.companyId.isNullOrBlank()) {
                        FsyStatusBadge(
                            text = "Sua companhia",
                            icon = FsyIcons.Users,
                            backgroundColor = scheme.secondaryContainer,
                            contentColor = scheme.onSecondaryContainer,
                        )
                    }
                }
            }
            Text(
                text = ann.title,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(top = 12.dp, end = 8.dp),
            )
            Text(
                text = ann.content,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = if (expanded || !longContent) Int.MAX_VALUE else 5,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp, end = 8.dp),
            )
            Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                LikeButton(liked = ann.isLikedEffective, count = ann.likesCount, onClick = onLike)
                Spacer(Modifier.weight(1f))
                if (longContent) {
                    Text(
                        text = if (expanded) "Mostrar menos" else "Ler tudo",
                        style = MaterialTheme.typography.labelLarge,
                        color = br.com.fsyrp2.app.ui.theme.FsyPalette.Link,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .clickable(role = Role.Button) { expanded = !expanded }
                            .padding(horizontal = 12.dp, vertical = 14.dp),
                    )
                }
            }
        }
    }
}

/**
 * Curtir: o coração cresce até 1,3 em 120 ms e assenta com mola sem ultrapassagem, enche de
 * coral e o número troca. Retorno tátil de confirmação. Movimento reduzido: só a troca.
 */
@Composable
internal fun LikeButton(liked: Boolean, count: Int, onClick: () -> Unit) {
    val reduce = fsyMotionPreferences().reduceMotion
    val interaction = remember { MutableInteractionSource() }
    val pop = remember { Animatable(1f) }
    var userToggled by remember { mutableStateOf(false) }
    LaunchedEffect(liked) {
        if (liked && userToggled && !reduce) {
            pop.animateTo(1.3f, tween(120, easing = FsyMotion.EaseOut))
            pop.animateTo(1f, fsySettleSpring(snappy = true))
        }
    }
    val tint = if (liked) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = Modifier
            .fsyPressScale(interaction)
            .clip(RoundedCornerShape(16.dp))
            .clickable(interactionSource = interaction, indication = ripple(), role = Role.Button) {
                userToggled = true
                onClick()
            }
            .semantics(mergeDescendants = true) {
                contentDescription = "Curtir, $count curtidas"
                stateDescription = if (liked) "Curtido" else "Não curtido"
            }
            .heightIn(min = 48.dp)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = if (liked) FsyIconsFilled.Heart else FsyIcons.Heart,
            contentDescription = null,
            tint = tint,
            modifier = Modifier
                .size(24.dp)
                .graphicsLayer {
                    scaleX = pop.value
                    scaleY = pop.value
                },
        )
        Text(
            text = if (count > 0) count.toString() else "Curtir",
            style = MaterialTheme.typography.titleSmall.merge(TabularTextStyle),
            fontWeight = FontWeight.Bold,
            color = if (liked) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
