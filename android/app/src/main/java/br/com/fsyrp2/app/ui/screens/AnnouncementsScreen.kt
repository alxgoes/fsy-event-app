package br.com.fsyrp2.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.AdminModule
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyConnectivityBanner
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsyStatusBadge
import br.com.fsyrp2.app.ui.motion.fsyPressScale
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

@Composable
fun AnnouncementsScreen(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    var filterScope by remember { mutableStateOf("all") }
    val profile = appState.profile
    val role = profile?.roleEnum ?: UserRole.JOVEM
    val canPublish = role == UserRole.CONSULTOR || role.isManager ||
        (profile?.permissions?.contains("announcements") == true)

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
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Mural de Avisos",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Comunicados da coordenação e da sua companhia",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (canPublish) {
                        FilledTonalButton(
                            onClick = {
                                haptics.confirm()
                                if (role == UserRole.CONSULTOR) {
                                    appState.overlayDestination = OverlayDestination.CounselorPanel
                                } else {
                                    appState.overlayDestination = OverlayDestination.AdminHub(AdminModule.ANNOUNCEMENTS)
                                }
                            },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Spacer(Modifier.width(4.dp))
                            Text("Publicar")
                        }
                    }

                    IconButton(
                        onClick = {
                            haptics.tick()
                            appState.refreshCoreData()
                        },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar avisos")
                    }
                }
            }
        }

        item {
            val filters = listOf(
                "all" to "Todos (${appState.announcements.size})",
                "urgent" to "Urgentes",
                "global" to "Sessão Geral",
                "company" to "Minha Companhia"
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                filters.forEach { (key, label) ->
                    val selected = filterScope == key
                    FilterChip(
                        selected = selected,
                        onClick = {
                            haptics.tick()
                            filterScope = key
                        },
                        label = { Text(label) },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )
                }
            }
        }

        if (filtered.isEmpty()) {
            item {
                FsyEmptyStateCard(
                    title = "Nenhum comunicado encontrado",
                    description = "Não há avisos publicados para este filtro no momento."
                )
            }
        } else {
            items(filtered, key = { it.id }) { ann ->
                val isFocused = appState.focusedAnnouncementId == ann.id
                val likeInteraction = remember(ann.id) { MutableInteractionSource() }

                FsySectionCard(
                    containerColor = when {
                        ann.isUrgent -> FsyPalette.Danger.copy(alpha = 0.08f)
                        isFocused -> FsyPalette.PrimarySky.copy(alpha = 0.09f)
                        else -> MaterialTheme.colorScheme.surface
                    },
                    borderColor = when {
                        ann.isUrgent -> FsyPalette.Danger.copy(alpha = 0.65f)
                        isFocused -> FsyPalette.PrimarySky
                        else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                    }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (ann.isUrgent) {
                                FsyStatusBadge(
                                    text = "URGENTE",
                                    backgroundColor = FsyPalette.Danger,
                                    contentColor = Color.White
                                )
                            }
                            FsyStatusBadge(
                                text = if (!ann.companyId.isNullOrBlank()) "Companhia" else "Sessão Geral",
                                backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                                contentColor = FsyPalette.PrimarySky
                            )
                        }

                        if (!ann.createdAt.isNullOrBlank()) {
                            Text(
                                text = ann.createdAt.take(10),
                                style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    Text(
                        text = ann.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(Modifier.height(6.dp))

                    Text(
                        text = ann.content,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Spacer(Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val authorLabel = ann.author?.fullName?.takeIf { it.isNotBlank() } ?: "Coordenação FSY"
                        Text(
                            text = "Por $authorLabel",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        OutlinedButton(
                            onClick = {
                                haptics.confirm()
                                appState.toggleAnnouncementLike(ann.id)
                            },
                            interactionSource = likeInteraction,
                            border = BorderStroke(
                                1.dp,
                                if (ann.likedByMe) FsyPalette.Danger else MaterialTheme.colorScheme.outline
                            ),
                            modifier = Modifier
                                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                .fsyPressScale(likeInteraction)
                        ) {
                            Icon(
                                imageVector = if (ann.likedByMe) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                contentDescription = if (ann.likedByMe) "Descurtir aviso" else "Curtir aviso",
                                tint = if (ann.likedByMe) FsyPalette.Danger else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = "${ann.likesCount}",
                                style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
