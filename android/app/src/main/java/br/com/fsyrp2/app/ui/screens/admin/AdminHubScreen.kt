package br.com.fsyrp2.app.ui.screens.admin

import androidx.compose.runtime.saveable.rememberSaveable

import br.com.fsyrp2.app.ui.components.*

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.AdminModule
import br.com.fsyrp2.app.model.AdminOverview
import br.com.fsyrp2.app.model.UserRole
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.state.OverlayDestination
import br.com.fsyrp2.app.ui.components.FsyClickableCard
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsyGutter
import br.com.fsyrp2.app.ui.components.FsyIconTile
import br.com.fsyrp2.app.ui.components.FsyNotice
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsySectionTitle
import br.com.fsyrp2.app.ui.components.FsyTopBar
import br.com.fsyrp2.app.ui.components.FsyCardContent
import br.com.fsyrp2.app.ui.components.FsyCardGroup
import br.com.fsyrp2.app.ui.icons.FsyIcons
import br.com.fsyrp2.app.ui.motion.fsyContentSwap
import br.com.fsyrp2.app.ui.motion.fsyMotionPreferences
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import br.com.fsyrp2.app.ui.screens.ProfileAccessAction
import kotlinx.coroutines.launch

/** Ícone Lucide de cada módulo administrativo (mesma família em toda a app). */
fun AdminModule.icon(): ImageVector = when (this) {
    AdminModule.OVERVIEW -> FsyIcons.LayoutDashboard
    AdminModule.ACCOUNTS -> FsyIcons.UserCog
    AdminModule.COMPANIES -> FsyIcons.Users
    AdminModule.SCHEDULE -> FsyIcons.CalendarClock
    AdminModule.LOGISTICS -> FsyIcons.Bus
    AdminModule.ANNOUNCEMENTS -> FsyIcons.Megaphone
    AdminModule.MEDIA -> FsyIcons.Images
    AdminModule.MEDICAL -> FsyIcons.Stethoscope
    AdminModule.INCLUSION -> FsyIcons.HandHeart
    AdminModule.COUNSELOR_AUDIT -> FsyIcons.ClipboardCheck
    AdminModule.REGISTRATIONS -> FsyIcons.FileSpreadsheet
}

/** Rótulo curto para o seletor de módulos (o título completo segue no cabeçalho). */
private fun AdminModule.shortLabel(): String = when (this) {
    AdminModule.OVERVIEW -> "Visão geral"
    AdminModule.ACCOUNTS -> "Contas"
    AdminModule.COMPANIES -> "Companhias"
    AdminModule.SCHEDULE -> "Programação"
    AdminModule.LOGISTICS -> "Logística"
    AdminModule.ANNOUNCEMENTS -> "Comunicados"
    AdminModule.MEDIA -> "Fotos"
    AdminModule.MEDICAL -> "Saúde"
    AdminModule.INCLUSION -> "Inclusão"
    AdminModule.COUNSELOR_AUDIT -> "Auditoria"
    AdminModule.REGISTRATIONS -> "Inscrições"
}

/** Linha de apoio sem jargão técnico. */
private fun AdminModule.plainSubtitle(): String = when (this) {
    AdminModule.REGISTRATIONS -> "Planilha de inscrições e fichas em PDF"
    else -> subtitlePt
}

private fun AdminModule.isSensitive(): Boolean =
    this == AdminModule.MEDICAL || this == AdminModule.INCLUSION

@Composable
fun AdminHubScreen(
    appState: FsyAppState,
    initialModule: AdminModule? = null
) {
    if (!appState.canOpenAdmin) return
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()
    val reduceMotion = fsyMotionPreferences().reduceMotion
    val profile = appState.profile
    val role = profile?.roleEnum ?: UserRole.JOVEM
    val permissions = profile?.permissions.orEmpty().toSet()

    val availableModules = remember(role, permissions) {
        AdminModule.entries.filter { it.canAccess(role, permissions) }
    }

    var activeModule by rememberSaveable(initialModule, availableModules) {
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
                overviewError = "Não foi possível atualizar os números."
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
                overviewError = e.message ?: "Não foi possível carregar a visão geral."
            } finally {
                overviewLoading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.navigationBars)
    ) {
        FsyTopBar(
            title = activeModule.titlePt,
            subtitle = "Gestão",
            profileAction = { ProfileAccessAction(appState) },
            onBack = {
                haptics.tick()
                if (activeModule != AdminModule.OVERVIEW && availableModules.contains(AdminModule.OVERVIEW)) {
                    activeModule = AdminModule.OVERVIEW
                } else {
                    appState.closeOverlay()
                }
            },
        )

        if (availableModules.isEmpty()) {
            FsyEmptyStateCard(
                icon = FsyIcons.Lock,
                title = "Acesso restrito",
                description = "Seu perfil não tem permissões administrativas.",
            )
        } else {

        // Seletor de módulos: ícone + rótulo curto, selecionado em "sol".
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = FsyGutter, vertical = 6.dp),
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
                        Text(mod.shortLabel(), fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium)
                    },
                    leadingIcon = { Icon(mod.icon(), contentDescription = null, modifier = Modifier.size(18.dp)) },
                    shape = br.com.fsyrp2.app.ui.components.FsyPillShape,
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        iconColor = MaterialTheme.colorScheme.onSurfaceVariant,
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
                    modifier = Modifier.heightIn(min = 48.dp),
                )
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

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
                    availableModules = availableModules,
                    onRetry = { loadOverview() },
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

@Composable
private fun AdminOverviewModuleContent(
    appState: FsyAppState,
    overview: AdminOverview?,
    isLoading: Boolean,
    errorMessage: String?,
    availableModules: List<AdminModule>,
    onRetry: () -> Unit,
    onSelectModule: (AdminModule) -> Unit
) {
    val scrollState = rememberScrollState()





    val counts = overview

    // Os ids persistidos não mudam; os títulos descrevem o que cada cartão mostra.
    val metricCards = listOf(
        FsyCardContent("youth-total", "Jovens") {
            val noCompany = ((counts?.totalYouth ?: 0) - (counts?.youthWithCompany ?: 0)).coerceAtLeast(0)
            val noRoom = ((counts?.totalYouth ?: 0) - (counts?.youthWithRoom ?: 0)).coerceAtLeast(0)
            MetricSummaryCard(
                icon = FsyIcons.Users,
                label = "Jovens cadastrados",
                value = counts?.totalYouth?.toString() ?: "—",
                detail = if (counts != null) "$noCompany sem companhia · $noRoom sem quarto" else null,
            )
        },
        FsyCardContent("companies-total", "Companhias") {
            MetricSummaryCard(FsyIcons.Users, "Companhias", counts?.totalCompanies?.toString() ?: "—", null)
        },
        FsyCardContent("counselors-total", "Consultores") {
            MetricSummaryCard(FsyIcons.HandHeart, "Consultores", counts?.totalCounselors?.toString() ?: "—", null)
        },
        FsyCardContent("medical-total", "Fichas de saúde") {
            MetricSummaryCard(FsyIcons.Stethoscope, "Fichas de saúde", counts?.medicalRecords?.toString() ?: "—", "Acesso restrito à equipe autorizada")
        },
        FsyCardContent("inclusion-open", "Fotos") {
            MetricSummaryCard(FsyIcons.Images, "Álbuns de fotos", counts?.totalPhotos?.toString() ?: "—", null)
        },
        FsyCardContent("announcements-urgent", "Avisos") {
            MetricSummaryCard(FsyIcons.Megaphone, "Avisos publicados", counts?.totalAnnouncements?.toString() ?: "—", null)
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
    ).filterValues { availableModules.contains(it) }

    val moduleCards = moduleMap.map { (id, mod) ->
        FsyCardContent(id = id, title = mod.titlePt) {
            FsyClickableCard(
                onClick = { onSelectModule(mod) },
                onClickLabel = "Abrir ${mod.titlePt}",
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    FsyIconTile(
                        icon = mod.icon(),
                        size = 42.dp,
                        container = if (mod.isSensitive()) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer,
                        tint = if (mod.isSensitive()) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(mod.titlePt, style = MaterialTheme.typography.titleSmall)
                        Text(
                            mod.plainSubtitle(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (mod.isSensitive()) {
                        Icon(
                            FsyIcons.Lock,
                            contentDescription = "Dados sensíveis",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                    Icon(FsyIcons.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = FsyGutter)
            .padding(top = 14.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        AnimatedVisibility(visible = isLoading) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceContainerHigh,
            )
        }
        AnimatedVisibility(visible = !errorMessage.isNullOrBlank()) {
            FsyNotice(
                icon = FsyIcons.CircleAlert,
                text = errorMessage.orEmpty(),
                container = MaterialTheme.colorScheme.errorContainer,
                content = MaterialTheme.colorScheme.onErrorContainer,
                actionLabel = "Tentar de novo",
                onAction = onRetry,
            )
        }

        FsySectionTitle("Números da sessão")
        FsyCardGroup(cards = metricCards)

        Spacer(Modifier.height(4.dp))
        FsySectionTitle("Módulos")
        FsyCardGroup(cards = moduleCards)
    }
}

/** Indicador: rótulo, número em sans tabular (nunca serifa em números) e detalhe opcional. */
@Composable
private fun MetricSummaryCard(
    icon: ImageVector,
    label: String,
    value: String,
    detail: String?,
) {
    FsySectionCard(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.semantics(mergeDescendants = true) {
                contentDescription = "$label: $value" + (detail?.let { ". $it" } ?: "")
            },
        ) {
            FsyIconTile(
                icon = icon,
                container = MaterialTheme.colorScheme.surfaceContainerHigh,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (detail != null) {
                    Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Box {
                Text(
                    text = value,
                    style = MaterialTheme.typography.headlineSmall.merge(TabularTextStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}
