package br.com.fsyrp2.app.ui.screens.admin

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.CardOrderManager
import br.com.fsyrp2.app.model.AdminModule
import br.com.fsyrp2.app.model.AdminOverview
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsyHeroBanner
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.ReorderableCardItem
import br.com.fsyrp2.app.ui.components.ReorderableCardSection
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminHubScreen(
    appState: FsyAppState,
    initialModule: AdminModule? = null
) {
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val profile = appState.profile
    val role = profile?.roleEnum ?: UserRole.JOVEM
    val permissions = profile?.permissions.orEmpty().toSet()

    val availableModules = remember(role, permissions) {
        AdminModule.entries.filter { it.canAccess(role, permissions) }
    }

    var activeModule by remember(initialModule, availableModules) {
        mutableStateOf(
            if (initialModule != null && availableModules.contains(initialModule)) {
                initialModule
            } else {
                availableModules.firstOrNull() ?: AdminModule.OVERVIEW
            }
        )
    }

    var overview by remember { mutableStateOf<AdminOverview?>(null) }
    var overviewLoading by remember { mutableStateOf(false) }
    var overviewError by remember { mutableStateOf<String?>(null) }

    fun loadOverview() {
        if (!AdminModule.OVERVIEW.canAccess(role, permissions)) return
        overviewLoading = true
        overviewError = null
        scope.launch {
            try {
                overview = appState.apiClient.fetchAdminOverview(appState.withValidSession())
            } catch (_: Exception) {
                overviewError = "Não foi possível atualizar os indicadores. Tente novamente."
            } finally {
                overviewLoading = false
            }
        }
    }

    LaunchedEffect(activeModule) {
        if (activeModule == AdminModule.OVERVIEW && AdminModule.OVERVIEW.canAccess(role, permissions)) {
            overviewLoading = true
            overviewError = null
            try {
                val s = appState.withValidSession()
                overview = appState.apiClient.fetchAdminOverview(s)
            } catch (e: Exception) {
                overviewError = e.message ?: "Erro ao carregar visão geral administrativa."
            } finally {
                overviewLoading = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Administração • ${activeModule.titlePt}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = activeModule.subtitlePt,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(
                        onClick = {
                            haptics.tick()
                            if (activeModule != AdminModule.OVERVIEW && availableModules.contains(AdminModule.OVERVIEW)) {
                                activeModule = AdminModule.OVERVIEW
                            } else {
                                appState.overlayDestination = OverlayDestination.None
                            }
                        },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (availableModules.isEmpty()) {
                Box(modifier = Modifier.padding(16.dp)) {
                    FsyEmptyStateCard(
                        title = "Acesso restrito",
                        description = "Seu perfil não possui permissões administrativas ativas."
                    )
                }
            } else {
                // Barra horizontal de módulos administrativos
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    availableModules.forEach { mod ->
                        val isSelected = activeModule == mod
                        FilterChip(
                            selected = isSelected,
                            onClick = {
                                haptics.tick()
                                activeModule = mod
                            },
                            label = {
                                Text(
                                    text = mod.titlePt,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                )
                            },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
                    }
                }

                HorizontalDivider()

                AnimatedContent(
                    targetState = activeModule,
                    transitionSpec = { fsyContentSwap(reduceMotion) },
                    label = "AdminModuleSwap",
                    modifier = Modifier.fillMaxSize()
                ) { targetMod ->
                    when (targetMod) {
                        AdminModule.OVERVIEW -> AdminOverviewModuleContent(
                            appState = appState,
                            overview = overview,
                            isLoading = overviewLoading,
                            errorMessage = overviewError,
                            onSelectModule = { mod ->
                                haptics.confirm()
                                activeModule = mod
                            }
                        )

                        AdminModule.ACCOUNTS -> AccountsAdminModuleView(appState = appState)
                        AdminModule.COMPANIES -> CompaniesAdminModuleView(appState = appState)
                        AdminModule.SCHEDULE -> ScheduleAdminModuleView(appState = appState)
                        AdminModule.LOGISTICS -> LogisticsAdminModuleView(appState = appState)
                        AdminModule.ANNOUNCEMENTS -> AnnouncementsAdminModuleView(appState = appState)
                        AdminModule.MEDIA -> MediaAdminModuleView(appState = appState)
                        AdminModule.MEDICAL -> MedicalAdminModuleView(appState = appState)
                        AdminModule.INCLUSION -> InclusionAdminModuleView(appState = appState)
                        AdminModule.COUNSELOR_AUDIT -> CounselorAuditAdminModuleView(appState = appState)
                        AdminModule.REGISTRATIONS -> RegistrationsAdminScreen(appState = appState)
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminOverviewModuleContent(
    appState: FsyAppState,
    overview: AdminOverview?,
    isLoading: Boolean,
    errorMessage: String?,
    onSelectModule: (AdminModule) -> Unit
) {
    val scrollState = rememberScrollState()
    val metricsDefaults = CardOrderManager.PAGE_DEFAULT_IDS["admin-metrics"].orEmpty()
    val metricsOrder = appState.cardOrderFor("admin-metrics")

    val modulesDefaults = CardOrderManager.PAGE_DEFAULT_IDS["admin-modules"].orEmpty()
    val modulesOrder = appState.cardOrderFor("admin-modules")

    val counts = overview

    val metricCards = listOf(
        ReorderableCardItem("youth-total", "Total de Jovens") {
            MetricSummaryCard(
                label = "Jovens Cadastrados",
                value = counts?.totalYouth?.toString() ?: "—",
                detail = "${((counts?.totalYouth ?: 0) - (counts?.youthWithCompany ?: 0)).coerceAtLeast(0)} sem companhia • ${((counts?.totalYouth ?: 0) - (counts?.youthWithRoom ?: 0)).coerceAtLeast(0)} sem quarto"
            )
        },
        ReorderableCardItem("companies-total", "Total de Companhias") {
            MetricSummaryCard(
                label = "Companhias Ativas",
                value = counts?.totalCompanies?.toString() ?: "—",
                detail = "Companhias cadastradas na sessão"
            )
        },
        ReorderableCardItem("counselors-total", "Total de Conselheiros") {
            MetricSummaryCard(
                label = "Conselheiros",
                value = counts?.totalCounselors?.toString() ?: "—",
                detail = "Atuando na Sessão Ribeirão Preto 2"
            )
        },
        ReorderableCardItem("medical-total", "Fichas Médicas") {
            MetricSummaryCard(
                label = "Fichas de Saúde",
                value = counts?.medicalRecords?.toString() ?: "—",
                detail = "Acesso restrito à equipe autorizada"
            )
        },
        ReorderableCardItem("inclusion-open", "Casos de Inclusão") {
            MetricSummaryCard(
                label = "Fotos da sessão",
                value = counts?.totalPhotos?.toString() ?: "—",
                detail = "Álbuns cadastrados pela equipe"
            )
        },
        ReorderableCardItem("announcements-urgent", "Avisos Urgentes") {
            MetricSummaryCard(
                label = "Avisos Publicados",
                value = counts?.totalAnnouncements?.toString() ?: "—",
                detail = "Comunicados cadastrados na sessão"
            )
        }
    )

    val moduleMap = mapOf(
        "users" to AdminModule.ACCOUNTS,
        "companies" to AdminModule.COMPANIES,
        "schedule" to AdminModule.SCHEDULE,
        "logistics" to AdminModule.LOGISTICS,
        "announcements" to AdminModule.ANNOUNCEMENTS,
        "media" to AdminModule.MEDIA,
        "medical" to AdminModule.MEDICAL,
        "inclusion" to AdminModule.INCLUSION,
        "counselor-audit" to AdminModule.COUNSELOR_AUDIT,
        "registrations" to AdminModule.REGISTRATIONS
    )

    val moduleCards = moduleMap.map { (id, mod) ->
        ReorderableCardItem(id = id, title = mod.titlePt) {
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = mod.titlePt,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = mod.subtitlePt,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    FilledTonalButton(
                        onClick = { onSelectModule(mod) },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Text("Abrir")
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Default.ChevronRight, contentDescription = null)
                    }
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        FsyHeroBanner(
            badgeText = "CENTRAL ADMINISTRATIVA NATIVA",
            title = "Gestão FSY Ribeirão Preto 2",
            subtitle = "Todos os 11 módulos com leitura e escrita sincronizadas em tempo real com o portal web e iOS."
        )

        // Destaque direto para o módulo de Inscrições FSY (34 colunas + PDFs + ZIP + XLSX)
        FsySectionCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = AdminModule.REGISTRATIONS.titlePt,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Importar planilha Excel de 34 colunas, pré-visualizar diffs, excluir lote por UUID e baixar PDFs/ZIP.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = { onSelectModule(AdminModule.REGISTRATIONS) },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Gerenciar")
                }
            }
        }

        if (isLoading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        if (!errorMessage.isNullOrBlank()) {
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = errorMessage,
                    modifier = Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        Text(
            text = "Indicadores da Sessão",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        ReorderableCardSection(
            pageKey = "admin-metrics",
            defaultIds = metricsDefaults,
            orderedIds = metricsOrder,
            onOrderChange = { appState.updateCardOrder("admin-metrics", it) },
            cards = metricCards,
            scrollState = scrollState
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "Módulos de Operação",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        ReorderableCardSection(
            pageKey = "admin-modules",
            defaultIds = modulesDefaults,
            orderedIds = modulesOrder,
            onOrderChange = { appState.updateCardOrder("admin-modules", it) },
            cards = moduleCards,
            scrollState = scrollState
        )
    }
}

@Composable
private fun MetricSummaryCard(
    label: String,
    value: String,
    detail: String
) {
    FsySectionCard {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.headlineMedium.merge(TabularTextStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = detail,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

