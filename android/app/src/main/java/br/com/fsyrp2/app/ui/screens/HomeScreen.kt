package br.com.fsyrp2.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SupervisorAccount
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.data.EventPhase
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.MainTab
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle

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

    val cards = listOf(
        ReorderableCardItem(
            id = "next-activity",
            title = "Próxima atividade"
        ) {
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CalendarMonth,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "Agenda e Próxima Atividade",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    TextButton(
                        onClick = {
                            haptics.tick()
                            appState.selectedTab = MainTab.AGENDA
                        },
                        modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    ) {
                        Text("Ver agenda")
                    }
                }

                Spacer(Modifier.height(8.dp))

                val currentItem = moment.currentItem
                val nextItem = moment.nextItem

                if (currentItem != null) {
                    Surface(
                        color = FsyPalette.PrimarySky.copy(alpha = 0.1f),
                        border = BorderStroke(1.dp, FsyPalette.PrimarySky.copy(alpha = 0.35f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            FsyStatusBadge(
                                text = "ACONTECENDO AGORA • ${currentItem.startTime.take(5)}–${currentItem.endTime.take(5)}",
                                backgroundColor = FsyPalette.PrimarySky,
                                contentColor = Color.White
                            )
                            Text(
                                text = currentItem.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            if (!currentItem.location.isNullOrBlank()) {
                                Text(
                                    text = "Local: ${currentItem.location}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }

                if (nextItem != null) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = "EM SEGUIDA • ${EventCalendar.DAY_LABELS[nextItem.dayKey] ?: nextItem.dayKey} às ${nextItem.startTime.take(5)}",
                                style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle),
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = nextItem.title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold
                            )
                            if (!nextItem.location.isNullOrBlank()) {
                                Text(
                                    text = nextItem.location,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                } else if (currentItem == null) {
                    Text(
                        text = "Sessão de 06 a 10 de fevereiro de 2027 no Ipê Park Hotel. Toque em 'Ver agenda' para explorar todos os dias.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        ReorderableCardItem(
            id = "announcements",
            title = "Mural de Avisos"
        ) {
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Campaign,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "Últimos Comunicados",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    TextButton(
                        onClick = {
                            haptics.tick()
                            appState.selectedTab = MainTab.ANNOUNCEMENTS
                        },
                        modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    ) {
                        Text("Ver todos (${appState.announcements.size})")
                    }
                }

                Spacer(Modifier.height(8.dp))

                val recent = appState.announcements.take(3)
                if (recent.isEmpty()) {
                    Text(
                        text = "Nenhum comunicado publicado até o momento.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        recent.forEach { ann ->
                            Surface(
                                color = if (ann.isUrgent) {
                                    FsyPalette.Danger.copy(alpha = 0.08f)
                                } else {
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
                                },
                                border = if (ann.isUrgent) {
                                    BorderStroke(1.dp, FsyPalette.Danger.copy(alpha = 0.4f))
                                } else null,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        haptics.tick()
                                        appState.focusedAnnouncementId = ann.id
                                        appState.selectedTab = MainTab.ANNOUNCEMENTS
                                    }
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (ann.isUrgent) {
                                            FsyStatusBadge(
                                                text = "URGENTE",
                                                backgroundColor = FsyPalette.Danger,
                                                contentColor = Color.White
                                            )
                                        } else {
                                            FsyStatusBadge(
                                                text = if (ann.companyId != null) "Minha Companhia" else "Sessão Geral",
                                                backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                                                contentColor = FsyPalette.PrimarySky
                                            )
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (ann.likedByMe) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                                contentDescription = null,
                                                tint = if (ann.likedByMe) FsyPalette.Danger else MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(
                                                text = ann.likesCount.toString(),
                                                style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle)
                                            )
                                        }
                                    }
                                    Text(
                                        text = ann.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = ann.content,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        ReorderableCardItem(
            id = "company",
            title = "Minha Companhia"
        ) {
            val comp = appState.company
            FsySectionCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Groups,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Minha Companhia e Alojamento",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(Modifier.height(10.dp))

                if (comp != null) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = comp.name,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        if (!comp.motto.isNullOrBlank()) {
                            Text(
                                text = "Grito de guerra / Lema: “${comp.motto}”",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            if (!comp.room.isNullOrBlank()) {
                                FsyStatusBadge(
                                    text = "Sala: ${comp.room}",
                                    backgroundColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            if (!profile?.room.isNullOrBlank()) {
                                FsyStatusBadge(
                                    text = "Quarto: ${profile?.room}",
                                    backgroundColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            if (!profile?.busAssignment.isNullOrBlank()) {
                                FsyStatusBadge(
                                    text = "Ônibus: ${profile?.busAssignment}",
                                    backgroundColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        if (!comp.driveUrl.isNullOrBlank()) {
                            OutlinedButton(
                                onClick = {
                                    haptics.confirm()
                                    ExternalUrlLauncher.openExternalUrl(context, comp.driveUrl.orEmpty())
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(Icons.Default.OpenInNew, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Abrir pasta de fotos da companhia (Google Drive)")
                            }
                        }
                    }
                } else {
                    Text(
                        text = "Sua companhia e sala de reunião serão exibidas aqui assim que vinculadas pela coordenação.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        ReorderableCardItem(
            id = "gallery",
            title = "Galeria e Instagram"
        ) {
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Collections,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = "Galeria & @fsybrasiloficial",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    TextButton(
                        onClick = {
                            haptics.tick()
                            appState.overlayDestination = OverlayDestination.Gallery
                        },
                        modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    ) {
                        Text("Abrir galeria")
                    }
                }

                Spacer(Modifier.height(8.dp))

                val previewPosts = appState.instagramPosts.take(3)
                if (previewPosts.isNotEmpty()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        previewPosts.forEach { post ->
                            RemotePublicImage(
                                url = post.imageUrl,
                                contentDescription = post.caption.ifBlank { "Publicação oficial do FSY" },
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable {
                                        haptics.tick()
                                        appState.overlayDestination = OverlayDestination.Gallery
                                    }
                            )
                        }
                    }
                } else {
                    Text(
                        text = "${appState.publicMediaPhotos.size} álbuns/mídias disponíveis na galeria oficial da sessão.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        FsyConnectivityBanner(
            isOnline = appState.isOnline,
            lastSyncedAtLabel = appState.lastSyncedAtLabel,
            errorMessage = appState.globalBannerError,
            onRefresh = { appState.refreshCoreData() }
        )

        val greetingName = profile?.fullName?.substringBefore(" ") ?: "Participante"
        val phaseBadge = when (moment.phase) {
            EventPhase.BEFORE -> "Faltam $daysUntilStart dias • 06 a 10 fev 2027"
            EventPhase.DURING -> "Sessão em andamento • Ipê Park Hotel"
            EventPhase.AFTER -> "Sessão concluída • Alegrar-se em Cristo"
        }

        FsyHeroBanner(
            badgeText = phaseBadge,
            title = "Olá, $greetingName!",
            subtitle = "Sessão Ribeirão Preto 2 • Ipê Park Hotel • São José do Rio Preto / SP",
            trailingContent = {
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    FsyDiscLogo(size = 56.dp)
                    IconButton(
                        onClick = {
                            haptics.tick()
                            appState.refreshCoreData()
                        },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Atualizar dados do painel",
                            tint = Color.White
                        )
                    }
                }
            }
        )

        // Atalhos nativos de função (Conselheiro / Administração)
        val role = profile?.roleEnum ?: UserRole.JOVEM
        val hasAdminAccess = role.canAccessAdminHub
        val isCounselorOrManager = role == UserRole.CONSULTOR || role.isManager

        if (isCounselorOrManager || hasAdminAccess) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (isCounselorOrManager) {
                    FilledTonalButton(
                        onClick = {
                            haptics.confirm()
                            appState.overlayDestination = OverlayDestination.CounselorPanel
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(Icons.Default.SupervisorAccount, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Conselheiro", fontWeight = FontWeight.Bold)
                    }
                }
                if (hasAdminAccess) {
                    Button(
                        onClick = {
                            haptics.confirm()
                            appState.overlayDestination = OverlayDestination.AdminHub()
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(Icons.Default.AdminPanelSettings, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Administração", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        ReorderableCardSection(
            pageKey = "dashboard",
            defaultIds = defaultDashboardOrder,
            orderedIds = currentOrder,
            onOrderChange = { appState.updateCardOrder("dashboard", it) },
            cards = cards,
            scrollState = scrollState
        )

        Spacer(Modifier.height(16.dp))
    }
}
