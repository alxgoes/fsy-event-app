package br.com.fsyrp2.app.ui.screens

import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.icons.FsyIconsFilled

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.model.AdminModule
import br.com.fsyrp2.app.model.Announcement
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.components.SecureScreenEffect
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CounselorScreen(appState: FsyAppState) {
    SecureScreenEffect()
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()
    val company = appState.company

    var mottoInput by remember(company?.motto) { mutableStateOf(company?.motto.orEmpty()) }
    var editingMotto by remember { mutableStateOf(false) }
    var isSavingMotto by remember { mutableStateOf(false) }

    var newAnnTitle by remember { mutableStateOf("") }
    var newAnnContent by remember { mutableStateOf("") }
    var newAnnUrgent by remember { mutableStateOf(false) }
    var isPublishingAnn by remember { mutableStateOf(false) }

    var youthSearch by remember { mutableStateOf("") }
    var actionFeedback by remember { mutableStateOf<String?>(null) }
    var actionError by remember { mutableStateOf<String?>(null) }

    var announcementToDelete by remember { mutableStateOf<Announcement?>(null) }
    var isDeletingAnnouncement by remember { mutableStateOf(false) }

    val companyAnnouncements = remember(appState.announcements, company?.id) {
        if (company == null) emptyList()
        else appState.announcements.filter { it.companyId == company.id }
    }

    val filteredYouth = remember(appState.companyYouth, youthSearch) {
        val q = youthSearch.trim().lowercase()
        if (q.isBlank()) appState.companyYouth
        else appState.companyYouth.filter {
            it.fullName.lowercase().contains(q) ||
                it.unit.orEmpty().lowercase().contains(q) ||
                it.room.orEmpty().lowercase().contains(q)
        }
    }

    val metricsDefaultOrder = CardOrderManager.PAGE_DEFAULT_IDS["consultor-metrics"].orEmpty()
    val metricsOrder = appState.cardOrderFor("consultor-metrics")

    val annSectionDefaultOrder = CardOrderManager.PAGE_DEFAULT_IDS["consultor-announcements"].orEmpty()
    val annSectionOrder = appState.cardOrderFor("consultor-announcements")

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            FsyTopBar(
                title = "Conselheiro",
                subtitle = appState.company?.name ?: "Minha companhia",
                onBack = {
                    haptics.tick()
                    appState.overlayDestination = OverlayDestination.None
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (!actionFeedback.isNullOrBlank()) {
                Surface(
                    color = FsyPalette.Success.copy(alpha = 0.14f),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = actionFeedback.orEmpty(),
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            if (!actionError.isNullOrBlank()) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = actionError.orEmpty(),
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            if (company == null) {
                FsyEmptyStateCard(
                    title = "Nenhuma companhia vinculada ao seu perfil",
                    description = "Peça à coordenação para vincular sua companhia."
                )
            } else {
                FsyHeroBanner(
                    badgeText = "Minha companhia",
                    title = company.name,
                    subtitle = company.motto?.let { "“$it”" } ?: "Sem lema definido"
                )

                // Métricas reordenáveis do conselheiro (consultor-metrics)
                val metricCards = listOf(
                    ReorderableCardItem(
                        id = "youth-count",
                        title = "Jovens da Companhia"
                    ) {
                        FsySectionCard {
                            Text(
                                text = "Jovens",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "${appState.companyYouth.size} jovens",
                                style = MaterialTheme.typography.headlineSmall.merge(TabularTextStyle),
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    },
                    ReorderableCardItem(
                        id = "company-room",
                        title = "Sala e Pasta de Fotos"
                    ) {
                        FsySectionCard {
                            Text(
                                text = "Sala de reunião",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = company.room ?: "Em definição",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            if (!company.driveUrl.isNullOrBlank()) {
                                Spacer(Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = {
                                        ExternalUrlLauncher.openExternalUrl(context, company.driveUrl.orEmpty())
                                    },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Icon(FsyIcons.ExternalLink, contentDescription = null)
                                    Spacer(Modifier.width(6.dp))
                                    Text("Fotos da companhia")
                                }
                            }
                        }
                    },
                    ReorderableCardItem(
                        id = "company-motto",
                        title = "Grito de Guerra / Lema"
                    ) {
                        FsySectionCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Lema",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                TextButton(
                                    onClick = {
                                        haptics.tick()
                                        editingMotto = !editingMotto
                                    },
                                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Icon(FsyIcons.Pencil, contentDescription = null)
                                    Spacer(Modifier.width(4.dp))
                                    Text(if (editingMotto) "Cancelar" else "Editar lema")
                                }
                            }

                            if (!editingMotto) {
                                Text(
                                    text = company.motto?.takeIf { it.isNotBlank() } ?: "Nenhum lema cadastrado ainda.",
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            } else {
                                Spacer(Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = mottoInput,
                                    onValueChange = { mottoInput = it },
                                    label = { Text("Novo lema") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(Modifier.height(8.dp))
                                Button(
                                    onClick = {
                                        haptics.confirm()
                                        isSavingMotto = true
                                        actionError = null
                                        actionFeedback = null
                                        scope.launch {
                                            try {
                                                val s = appState.withValidSession()
                                                appState.apiClient.updateCompanyMotto(
                                                    session = s,
                                                    companyId = company.id,
                                                    motto = mottoInput,
                                                    previousMotto = company.motto
                                                )
                                                editingMotto = false
                                                actionFeedback = "Lema da companhia atualizado com sucesso!"
                                                appState.refreshCoreData()
                                            } catch (e: Exception) {
                                                actionError = e.message ?: "Não foi possível salvar o lema."
                                            } finally {
                                                isSavingMotto = false
                                            }
                                        }
                                    },
                                    enabled = !isSavingMotto && mottoInput.isNotBlank(),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .defaultMinSize(minHeight = 48.dp)
                                ) {
                                    Text(if (isSavingMotto) "Salvando..." else "Salvar lema da companhia")
                                }
                            }
                        }
                    }
                )

                ReorderableCardSection(
                    pageKey = "consultor-metrics",
                    defaultIds = metricsDefaultOrder,
                    orderedIds = metricsOrder,
                    onOrderChange = { appState.updateCardOrder("consultor-metrics", it) },
                    cards = metricCards,
                    scrollState = scrollState
                )

                // Avisos da Companhia reordenáveis (consultor-announcements)
                val announcementCards = listOf(
                    ReorderableCardItem(
                        id = "publish-form",
                        title = "Publicar Comunicado para a Companhia"
                    ) {
                        FsySectionCard {
                            Text(
                                text = "Novo aviso",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))

                            OutlinedTextField(
                                value = newAnnTitle,
                                onValueChange = { newAnnTitle = it },
                                label = { Text("Título do aviso") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(Modifier.height(8.dp))

                            OutlinedTextField(
                                value = newAnnContent,
                                onValueChange = { newAnnContent = it },
                                label = { Text("Mensagem") },
                                minLines = 3,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(Modifier.height(8.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Marcar como urgente",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Switch(
                                    checked = newAnnUrgent,
                                    onCheckedChange = { newAnnUrgent = it }
                                )
                            }

                            Spacer(Modifier.height(8.dp))

                            Button(
                                onClick = {
                                    haptics.confirm()
                                    isPublishingAnn = true
                                    actionError = null
                                    actionFeedback = null
                                    scope.launch {
                                        try {
                                            val s = appState.withValidSession()
                                            val body = buildJsonObject {
                                                put("title", newAnnTitle.trim())
                                                put("content", newAnnContent.trim())
                                                put("priority", if (newAnnUrgent) "urgent" else "normal")
                                                put("target_company_id", company.id)
                                            }
                                            appState.apiClient.saveAnnouncement(s, isNew = true, body = body)
                                            newAnnTitle = ""
                                            newAnnContent = ""
                                            newAnnUrgent = false
                                            actionFeedback = "Aviso publicado e enviado para a companhia!"
                                            appState.refreshCoreData()
                                        } catch (e: Exception) {
                                            actionError = e.message ?: "Erro ao publicar aviso."
                                        } finally {
                                            isPublishingAnn = false
                                        }
                                    }
                                },
                                enabled = !isPublishingAnn && newAnnTitle.isNotBlank() && newAnnContent.isNotBlank(),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(FsyIcons.Plus, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text(if (isPublishingAnn) "Publicando..." else "Publicar aviso para a companhia")
                            }
                        }
                    },
                    ReorderableCardItem(
                        id = "published-list",
                        title = "Avisos Publicados na Companhia"
                    ) {
                        FsySectionCard {
                            Text(
                                text = "Avisos da companhia (${companyAnnouncements.size})",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))

                            if (companyAnnouncements.isEmpty()) {
                                Text(
                                    text = "Nenhum aviso da companhia ainda.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    companyAnnouncements.forEach { ann ->
                                        Surface(
                                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                                            shape = MaterialTheme.shapes.medium,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(12.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(
                                                        text = ann.title,
                                                        style = MaterialTheme.typography.titleSmall,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                    Text(
                                                        text = ann.content,
                                                        style = MaterialTheme.typography.bodySmall,
                                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                                    )
                                                }
                                                IconButton(
                                                    onClick = {
                                                        haptics.tick()
                                                        announcementToDelete = ann
                                                    },
                                                    modifier = Modifier.size(48.dp)
                                                ) {
                                                    Icon(
                                                        imageVector = FsyIcons.Trash2,
                                                        contentDescription = "Excluir aviso ${ann.title}",
                                                        tint = FsyPalette.Danger
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                )

                ReorderableCardSection(
                    pageKey = "consultor-announcements",
                    defaultIds = annSectionDefaultOrder,
                    orderedIds = annSectionOrder,
                    onOrderChange = { appState.updateCardOrder("consultor-announcements", it) },
                    cards = announcementCards,
                    scrollState = scrollState
                )

                // Lista de Jovens da Companhia
                FsySectionCard {
                    Text(
                        text = "Jovens (${filteredYouth.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(8.dp))

                    OutlinedTextField(
                        value = youthSearch,
                        onValueChange = { youthSearch = it },
                        label = { Text("Buscar por nome, ala ou quarto") },
                        leadingIcon = { Icon(FsyIcons.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(Modifier.height(10.dp))

                    if (filteredYouth.isEmpty()) {
                        Text(
                            text = "Ninguém encontrado.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            filteredYouth.forEach { youth ->
                                Surface(
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                                    shape = MaterialTheme.shapes.medium,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text(
                                            text = youth.fullName,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = buildString {
                                                append("Unidade: ${youth.unit ?: "Não informada"}")
                                                if (!youth.room.isNullOrBlank()) append(" • Quarto: ${youth.room}")
                                                if (!youth.busAssignment.isNullOrBlank()) append(" • Ônibus: ${youth.busAssignment}")
                                            },
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        if (!youth.phone.isNullOrBlank()) {
                                            Text(
                                                text = "Telefone: ${youth.phone}",
                                                style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Atalho para Inclusão e Necessidades Especiais (permitido a conselheiros e gestores)
            OutlinedButton(
                onClick = {
                    haptics.confirm()
                    appState.overlayDestination = OverlayDestination.AdminHub(AdminModule.INCLUSION)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 48.dp)
            ) {
                Icon(FsyIconsFilled.Heart, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Acompanhamento de inclusão")
            }
        }
    }

    // Modal de confirmação para exclusão de comunicado da companhia
    val deletingAnn = announcementToDelete
    if (deletingAnn != null) {
        AlertDialog(
            onDismissRequest = {
                if (!isDeletingAnnouncement) {
                    announcementToDelete = null
                }
            },
            title = {
                Text(
                    text = "Excluir aviso",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "Excluir “${deletingAnn.title}”? Não dá para desfazer.",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val targetId = deletingAnn.id
                        isDeletingAnnouncement = true
                        actionError = null
                        actionFeedback = null
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                appState.apiClient.deleteAnnouncement(s, targetId)
                                announcementToDelete = null
                                actionFeedback = "Aviso removido com sucesso."
                                haptics.confirm()
                                appState.refreshCoreData()
                            } catch (e: Exception) {
                                haptics.reject()
                                actionError = "Não foi possível excluir o aviso. Tente novamente."
                                announcementToDelete = null
                            } finally {
                                isDeletingAnnouncement = false
                            }
                        }
                    },
                    enabled = !isDeletingAnnouncement,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = FsyPalette.Danger,
                        contentColor = MaterialTheme.colorScheme.onError
                    ),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text(if (isDeletingAnnouncement) "Excluindo..." else "Excluir aviso")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { announcementToDelete = null },
                    enabled = !isDeletingAnnouncement,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Cancelar")
                }
            }
        )
    }
}


