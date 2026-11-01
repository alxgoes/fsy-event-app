package br.com.fsyrp2.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import br.com.fsyrp2.app.ui.components.FsyActionButton
import br.com.fsyrp2.app.ui.components.FsyButtonTone
import br.com.fsyrp2.app.ui.components.FsyCardShape
import br.com.fsyrp2.app.ui.components.FsyConnectivityBanner
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsyGutter
import br.com.fsyrp2.app.ui.components.FsyIconButton
import br.com.fsyrp2.app.ui.components.FsyLoadingBlock
import br.com.fsyrp2.app.ui.components.FsySegmentedSelector
import br.com.fsyrp2.app.ui.components.FsyTopBar
import br.com.fsyrp2.app.ui.components.fsyReveal
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.icons.FsyIconsFilled
import br.com.fsyrp2.app.ui.motion.FsyMotion
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.fsyPressScale
import br.com.fsyrp2.app.ui.motion.fsySettleSpring
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

@Composable
fun AnnouncementsScreen(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    var filterScope by rememberSaveable { mutableStateOf("all") }
    val profile = appState.profile
    val role = profile?.roleEnum ?: UserRole.JOVEM
    val canPublish = role == UserRole.CONSULTOR || role.isManager ||
        (profile?.permissions?.contains("announcements") == true)

    val filters = listOf("all" to "Todos", "urgent" to "Urgentes", "global" to "Sessão", "company" to "Companhia")
    val filterDescriptions = listOf(
        "Todos os avisos (${appState.announcements.size})",
        "Somente urgentes",
        "Avisos para toda a sessão",
        "Avisos da minha companhia",
    )

    val filtered = remember(appState.announcements, filterScope, profile?.companyId) {
        appState.announcements.filter { ann ->
            when (filterScope) {
                "urgent" -> ann.isUrgent
                "global" -> ann.companyId.isNullOrBlank()
                "company" -> !ann.companyId.isNullOrBlank() && ann.companyId == profile?.companyId
                else -> true
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        FsyTopBar(
            title = "Avisos",
            subtitle = "Coordenação e companhia",
            actions = {
                if (canPublish) {
                    FsyActionButton(
                        label = "Publicar",
                        icon = FsyIcons.Plus,
                        tone = FsyButtonTone.Tonal,
                        onClick = {
                            haptics.confirm()
                            appState.overlayDestination = if (role == UserRole.CONSULTOR) {
                                OverlayDestination.CounselorPanel
                            } else {
                                OverlayDestination.AdminHub(AdminModule.ANNOUNCEMENTS)
                            }
                        },
                    )
                }
                FsyIconButton(
                    icon = FsyIcons.RefreshCw,
                    contentDescription = "Atualizar avisos",
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
            FsySegmentedSelector(
                options = filters.map { it.second },
                descriptions = filterDescriptions,
                selectedIndex = filters.indexOfFirst { it.first == filterScope }.coerceAtLeast(0),
                onSelect = { index ->
                    haptics.tick()
                    filterScope = filters[index].first
                },
            )
        }

        AnimatedContent(
            targetState = filterScope,
            transitionSpec = { fsyContentSwap(reduceMotion) },
            label = "AnnouncementFilterSwap",
            modifier = Modifier.weight(1f),
        ) { scope ->
            val listState = rememberLazyListState()
            val focusedId = appState.focusedAnnouncementId
            LaunchedEffect(focusedId, filtered) {
                val idx = filtered.indexOfFirst { it.id == focusedId }
                if (idx >= 0) listState.animateScrollToItem(idx)
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = FsyGutter, end = FsyGutter, top = 14.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                when {
                    appState.announcements.isEmpty() && appState.isLoading -> item(key = "loading") {
                        FsyLoadingBlock(rows = 3, rowHeight = 120.dp)
                    }
                    filtered.isEmpty() -> item(key = "empty") {
                        FsyEmptyStateCard(
                            icon = FsyIcons.Megaphone,
                            title = when (scope) {
                                "urgent" -> "Nenhum aviso urgente"
                                "company" -> "Nada da sua companhia"
                                else -> "Nenhum aviso por enquanto"
                            },
                            description = "Novos avisos aparecem aqui.",
                        )
                    }
                    else -> itemsIndexed(filtered, key = { _, it -> it.id }) { index, ann ->
                        AnnouncementCard(
                            ann = ann,
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

private fun shortDate(iso: String): String? =
    if (iso.length >= 10 && iso[4] == '-' && iso[7] == '-') "${iso.substring(8, 10)}/${iso.substring(5, 7)}" else null

@Composable
private fun AnnouncementCard(
    ann: Announcement,
    isFocused: Boolean,
    onLike: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by rememberSaveable(ann.id) { mutableStateOf(isFocused) }
    val scheme = MaterialTheme.colorScheme
    val container = if (ann.isUrgent) scheme.errorContainer else scheme.surface
    val border = when {
        isFocused -> scheme.primary
        ann.isUrgent -> scheme.error.copy(alpha = 0.45f)
        else -> scheme.outlineVariant
    }
    val onContainer = if (ann.isUrgent) scheme.onErrorContainer else scheme.onSurface
    val muted = if (ann.isUrgent) scheme.onErrorContainer.copy(alpha = 0.85f) else scheme.onSurfaceVariant
    val longContent = ann.content.length > 220

    Surface(
        shape = FsyCardShape,
        color = container,
        contentColor = onContainer,
        border = BorderStroke(if (isFocused) 2.dp else 1.dp, border),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .animateContentSize()
                .padding(start = 16.dp, end = 8.dp, top = 14.dp, bottom = 4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (ann.isUrgent) {
                    Icon(FsyIcons.TriangleAlert, contentDescription = null, tint = scheme.error, modifier = Modifier.size(16.dp))
                    Text("Urgente", style = MaterialTheme.typography.labelMedium, color = scheme.error, fontWeight = FontWeight.Bold)
                    Text("·", style = MaterialTheme.typography.labelMedium, color = muted)
                }
                Text(
                    text = if (!ann.companyId.isNullOrBlank()) "Companhia" else "Toda a sessão",
                    style = MaterialTheme.typography.labelMedium,
                    color = muted,
                )
                Spacer(Modifier.weight(1f))
                shortDate(ann.createdAt)?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelMedium.merge(TabularTextStyle),
                        color = muted,
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
            }
            Text(
                text = ann.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 6.dp, end = 8.dp),
            )
            Text(
                text = ann.content,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = if (expanded || !longContent) Int.MAX_VALUE else 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp, end = 8.dp),
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val authorLabel = ann.author?.fullName?.takeIf { it.isNotBlank() } ?: "Coordenação"
                Text(
                    text = authorLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = muted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (longContent) {
                    Text(
                        text = if (expanded) "Menos" else "Ler tudo",
                        style = MaterialTheme.typography.labelLarge,
                        color = if (ann.isUrgent) onContainer else scheme.primary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(role = Role.Button) { expanded = !expanded }
                            .padding(horizontal = 10.dp, vertical = 14.dp),
                    )
                }
                LikeButton(liked = ann.likedByMe, count = ann.likesCount, onClick = onLike)
            }
        }
    }
}

/** Curtir: coração preenche e dá um leve "assentar" de escala (mola sem ultrapassagem). */
@Composable
private fun LikeButton(liked: Boolean, count: Int, onClick: () -> Unit) {
    val reduce = fsyMotionPreferences().reduceMotion
    val interaction = remember { MutableInteractionSource() }
    val pop = remember { Animatable(1f) }
    LaunchedEffect(liked) {
        if (liked && !reduce) {
            pop.snapTo(0.8f)
            pop.animateTo(1f, fsySettleSpring(snappy = true))
        }
    }
    val tint = if (liked) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = Modifier
            .fsyPressScale(interaction)
            .clip(RoundedCornerShape(14.dp))
            .clickable(interactionSource = interaction, indication = ripple(), role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "Curtir aviso, $count curtidas"
                stateDescription = if (liked) "Curtido" else "Não curtido"
            }
            .height(48.dp)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = if (liked) FsyIconsFilled.Heart else FsyIcons.Heart,
            contentDescription = null,
            tint = tint,
            modifier = Modifier
                .size(20.dp)
                .graphicsLayer {
                    scaleX = pop.value
                    scaleY = pop.value
                },
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle),
            fontWeight = FontWeight.Bold,
        )
    }
}
