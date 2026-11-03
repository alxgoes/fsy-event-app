package br.com.fsyrp2.app.ui.screens.admin

import br.com.fsyrp2.app.ui.icons.FsyIcons

import android.net.Uri
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun RegistrationsAdminScreen(appState: FsyAppState) {
    if (appState.profile == null || appState.profile?.isSuspended == true || !appState.effectiveRole.canManageRegistrations) return
    SecureScreenEffect()
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()
    DisposableEffect(appState) {
        onDispose {
            if ((context as? android.app.Activity)?.isChangingConfigurations != true) {
                appState.closeRegistrationAuthorizationEditor()
            }
        }
    }

    var listState by remember { mutableStateOf(RegistrationListResponseDto()) }
    var selectedBatchId by remember { mutableStateOf<String?>(null) }
    var roleCategory by remember { mutableStateOf("all") }
    var search by remember { mutableStateOf("") }
    var onlyHealthAlerts by remember { mutableStateOf(false) }
    var onlyIssues by remember { mutableStateOf(false) }
    var useNormalizedNames by remember { mutableStateOf(true) }
    var page by remember { mutableIntStateOf(1) }

    var isLoading by remember { mutableStateOf(false) }
    var isDownloading by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var activePreview by remember { mutableStateOf<RegistrationPreviewSummaryDto?>(null) }
    var importMode by remember { mutableStateOf("upsert") }
    var isCommitting by remember { mutableStateOf(false) }
    var acknowledgeAdjustmentRemoval by remember { mutableStateOf(false) }

    var batchToDelete by remember { mutableStateOf<RegistrationImportBatchSummaryDto?>(null) }
    var detailRecord by remember { mutableStateOf<RegistrationRecordDto?>(null) }
    var zipPartIndex by remember { mutableIntStateOf(1) }

    fun reload() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val s = appState.withValidSession()
                listState = appState.apiClient.fetchRegistrations(
                    session = s,
                    batchId = selectedBatchId,
                    roleCategory = roleCategory,
                    hasHealthAlert = onlyHealthAlerts,
                    hasIssues = onlyIssues,
                    search = search,
                    page = page
                )
            } catch (e: Exception) {
                errorMsg = e.message ?: "Erro ao carregar inscrições."
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(selectedBatchId, roleCategory, onlyHealthAlerts, onlyIssues, page) {
        reload()
    }

    val xlsxPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            isLoading = true
            errorMsg = null
            feedback = null
            try {
                val filename = resolveDisplayName(context.contentResolver, uri) ?: "Inscritos_FSY.xlsx"
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                    ?: throw IllegalStateException("Não foi possível ler o arquivo Excel selecionado.")
                val s = appState.withValidSession()
                activePreview = appState.apiClient.previewRegistrationsWorkbook(
                    session = s,
                    filename = filename,
                    xlsxBytes = bytes
                )
                acknowledgeAdjustmentRemoval = false
            } catch (e: Exception) {
                errorMsg = e.message ?: "Falha ao analisar a planilha Excel."
            } finally {
                isLoading = false
            }
        }
    }

    val metrics = listState.metrics
    val pagination = listState.pagination

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            FsyStatusBadge(
                text = "Tela protegida",
                icon = br.com.fsyrp2.app.ui.icons.FsyIcons.Lock,
                backgroundColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }

        // Resumo de métricas e revisão
        item {
            FsySectionCard {
                Text(
                    text = "Resumo das inscrições",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                if (listState.currentRevision.toString() != "0") {
                    Text(
                        text = "Revisão ${listState.currentRevision}",
                        style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "${metrics.totalCount} inscritos (${metrics.participantCount} participantes • ${metrics.counselorCount} conselheiros)",
                    style = MaterialTheme.typography.bodyMedium.merge(TabularTextStyle),
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "${metrics.confirmedCount} confirmados • ${metrics.healthAlertCount} alertas de saúde • ${metrics.missingGuardianMinorCount} menores sem responsável • ${metrics.documentWarningCount} avisos de documento",
                    style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Padronizar nomes nos documentos",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                    FsySwitch(
                        checked = useNormalizedNames,
                        onCheckedChange = { useNormalizedNames = it },
                        modifier = Modifier.semantics { contentDescription = "Padronizar nomes nos documentos" }
                    )
                }
            }
        }

        // Ações de Importação, Lotes e Downloads Oficiais (PDF, ZIP, XLSX, Template)
        item {
            FsySectionCard {
                Text(
                    text = "Planilha e autorizações",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(8.dp))

                FsyButton(
                    onClick = {
                        haptics.confirm()
                        xlsxPickerLauncher.launch("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    },
                    enabled = !isLoading && !isDownloading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(FsyIcons.Upload, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Importar planilha Excel", fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FsyOutlinedButton(
                        onClick = {
                            haptics.confirm()
                            isDownloading = true
                            errorMsg = null
                            scope.launch {
                                try {
                                    val s = appState.withValidSession()
                                    val bytes = appState.apiClient.downloadExportedXlsx(
                                        session = s,
                                        batchId = selectedBatchId,
                                        roleCategory = roleCategory,
                                        search = search,
                                        useNormalizedNames = useNormalizedNames
                                    )
                                    ExternalUrlLauncher.shareOrViewPrivateDocument(
                                        context = context,
                                        filename = "Inscritos_FSY_RP2_Normalizado.xlsx",
                                        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                        bytes = bytes
                                    )
                                    feedback = "Planilha Excel exportada com sucesso."
                                } catch (e: Exception) {
                                    errorMsg = e.message
                                } finally {
                                    isDownloading = false
                                }
                            }
                        },
                        enabled = !isDownloading && metrics.totalCount > 0,
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Exportar .xlsx")
                    }

                    FsyOutlinedButton(
                        onClick = {
                            haptics.confirm()
                            isDownloading = true
                            errorMsg = null
                            scope.launch {
                                try {
                                    val s = appState.withValidSession()
                                    val bytes = appState.apiClient.downloadBlankTemplatePdf(s)
                                    ExternalUrlLauncher.shareOrViewPrivateDocument(
                                        context = context,
                                        filename = "FICHA_AUTORIZACAO_EM_BRANCO.pdf",
                                        mimeType = "application/pdf",
                                        bytes = bytes
                                    )
                                    feedback = "Modelo em branco da Ficha de Autorização baixado."
                                } catch (e: Exception) {
                                    errorMsg = e.message
                                } finally {
                                    isDownloading = false
                                }
                            }
                        },
                        enabled = !isDownloading,
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.FileText, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Ficha em Branco")
                    }
                }

                Spacer(Modifier.height(8.dp))

                // Lote ZIP de Fichas de Autorização (até 50 PDFs por parte)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val totalParts = ((metrics.participantCount.coerceAtLeast(1) + 49) / 50).coerceAtLeast(1)
                    FsyOutlinedButton(
                        onClick = {
                            zipPartIndex = if (zipPartIndex >= totalParts) 1 else zipPartIndex + 1
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Text(
                            text = "Parte $zipPartIndex/$totalParts",
                            style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle)
                        )
                    }

                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            isDownloading = true
                            errorMsg = null
                            scope.launch {
                                try {
                                    val s = appState.withValidSession()
                                    val zipRole = if (roleCategory == "Consultor") "Consultor" else "Participante"
                                    val bytes = appState.apiClient.downloadAuthorizationPdfBatchZip(
                                        session = s,
                                        batchId = selectedBatchId,
                                        partIndex = zipPartIndex,
                                        partSize = 50,
                                        roleCategory = zipRole,
                                        search = search,
                                        useNormalizedNames = useNormalizedNames
                                    )
                                    ExternalUrlLauncher.shareOrViewPrivateDocument(
                                        context = context,
                                        filename = "Fichas_Autorizacao_FSY_Parte_${zipPartIndex}.zip",
                                        mimeType = "application/zip",
                                        bytes = bytes
                                    )
                                    feedback = "Pacote ZIP (Parte $zipPartIndex) gerado com sucesso."
                                } catch (e: Exception) {
                                    errorMsg = e.message
                                } finally {
                                    isDownloading = false
                                }
                            }
                        },
                        enabled = !isDownloading && metrics.totalCount > 0,
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.FolderArchive, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Baixar ZIP (até 50 PDFs)")
                    }
                }
            }
        }

        // Histórico de Lotes Importados + Exclusão Escopada por UUID
        if (listState.batches.isNotEmpty()) {
            item {
                FsySectionCard {
                    Text(
                        text = "Lotes de Importação (${listState.batches.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(8.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        listState.batches.take(5).forEach { batch ->
                            val isSelected = selectedBatchId == batch.id
                            Surface(
                                color = if (isSelected) FsyPalette.PrimarySky.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                shape = MaterialTheme.shapes.small,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "${batch.filename} (Rev #${batch.revision})",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${batch.totalCount} registros (${batch.participantCount} part. / ${batch.counselorCount} cons.)",
                                            style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle),
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    Row {
                                        FsyTextButton(
                                            onClick = {
                                                selectedBatchId = if (isSelected) null else batch.id
                                                page = 1
                                            },
                                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                                        ) {
                                            Text(if (isSelected) "Todos" else "Filtrar")
                                        }
                                        IconButton(
                                            onClick = {
                                                haptics.reject()
                                                batchToDelete = batch
                                            },
                                            modifier = Modifier.size(48.dp)
                                        ) {
                                            Icon(
                                                imageVector = FsyIcons.Trash2,
                                                contentDescription = "Excluir lote ${batch.filename}",
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
        }

        // Busca e Filtros
        item {
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = search,
                        onValueChange = { search = it },
                        label = { Text("Buscar por nome, ID participante, estaca ou ala") },
                        leadingIcon = { Icon(FsyIcons.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    FsyButton(
                        onClick = {
                            haptics.tick()
                            page = 1
                            reload()
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Text("Filtrar")
                    }
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        "all" to "Todos (${metrics.totalCount})",
                        "Participante" to "Participantes (${metrics.participantCount})",
                        "Consultor" to "Consultores (${metrics.counselorCount})"
                    ).forEach { (key, label) ->
                        FsyFilterChip(
                            selected = roleCategory == key,
                            onClick = {
                                haptics.tick()
                                roleCategory = key
                                page = 1
                            },
                            label = { Text(label) },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
                    }

                    FsyFilterChip(
                        selected = onlyHealthAlerts,
                        onClick = {
                            haptics.tick()
                            onlyHealthAlerts = !onlyHealthAlerts
                            page = 1
                        },
                        label = { Text("Alerta Saúde (${metrics.healthAlertCount})") },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )

                    FsyFilterChip(
                        selected = onlyIssues,
                        onClick = {
                            haptics.tick()
                            onlyIssues = !onlyIssues
                            page = 1
                        },
                        label = { Text("Com Avisos") },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )
                }
            }
        }

        if (isLoading || isDownloading) {
            item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        }

        if (!feedback.isNullOrBlank()) {
            item {
                Surface(color = FsyPalette.Success.copy(alpha = 0.15f), shape = MaterialTheme.shapes.medium) {
                    Text(feedback.orEmpty(), modifier = Modifier.padding(12.dp))
                }
            }
        }

        if (!errorMsg.isNullOrBlank()) {
            item {
                Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium) {
                    Text(
                        errorMsg.orEmpty(),
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }

        if (listState.items.isEmpty() && !isLoading) {
            item {
                FsyEmptyStateCard(
                    title = "Nenhuma inscrição encontrada",
                    description = "Importe a planilha ou ajuste os filtros."
                )
            }
        } else {
            items(listState.items, key = { it.id }) { item ->
                val displayName = if (useNormalizedNames) item.fullNameNormalized else item.fullNameRaw
                FsySectionCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                FsyStatusBadge(
                                    text = item.roleCategory,
                                    backgroundColor = MaterialTheme.colorScheme.primaryContainer,
                                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                if (item.hasHealthAlert) {
                                    FsyStatusBadge("Saúde", FsyPalette.Danger, MaterialTheme.colorScheme.onError, icon = FsyIcons.HeartPulse)
                                }
                                if (item.hasMissingGuardianForMinor) {
                                    FsyStatusBadge("Sem responsável", FsyPalette.Extended.warningContainer, FsyPalette.Extended.onWarningContainer, icon = FsyIcons.TriangleAlert)
                                }
                                if (item.hasAuthorizationAdjustments) {
                                    FsyStatusBadge("Editado", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = displayName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = buildString {
                                    append("Status: ${item.status ?: "—"}")
                                    if (item.ageAtRegistration != null) append(" • Idade: ${item.ageAtRegistration}")
                                    if (!item.stakeName.isNullOrBlank()) append(" • Estaca: ${item.stakeName}")
                                    if (!item.wardName.isNullOrBlank()) append(" • Ala: ${item.wardName}")
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FsyOutlinedButton(
                            onClick = {
                                haptics.tick()
                                scope.launch {
                                    try {
                                        val s = appState.withValidSession()
                                        detailRecord = appState.apiClient.fetchRegistrationDetail(s, item.id)
                                    } catch (e: Exception) {
                                        errorMsg = e.message ?: "Não foi possível abrir os dados da inscrição. Tente novamente."
                                    }
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.Eye, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Ver dados")
                        }

                        FsyButton(
                            onClick = {
                                haptics.confirm()
                                isDownloading = true
                                scope.launch {
                                    try {
                                        val s = appState.withValidSession()
                                        val pdfBytes = appState.apiClient.downloadAuthorizationPdf(
                                            session = s,
                                            registrationId = item.id,
                                            useNormalizedNames = useNormalizedNames
                                        )
                                        ExternalUrlLauncher.shareOrViewPrivateDocument(
                                            context = context,
                                            filename = item.authorizationFilename(),
                                            mimeType = "application/pdf",
                                            bytes = pdfBytes
                                        )
                                    } catch (e: Exception) {
                                        errorMsg = e.message
                                    } finally {
                                        isDownloading = false
                                    }
                                }
                            },
                            enabled = !isDownloading && !item.isCancelledRegistration(),
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.FileDown, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Ficha PDF")
                        }
                    }
                    FsyOutlinedButton(
                        onClick = {
                            errorMsg = null
                            scope.launch {
                                try {
                                    val session = appState.withValidSession()
                                    appState.editRegistrationAuthorization(appState.apiClient.fetchRegistrationDetail(session, item.id))
                                } catch (e: Exception) {
                                    errorMsg = e.message ?: "Não foi possível abrir a autorização. Tente novamente."
                                }
                            }
                        },
                        enabled = !isDownloading,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Editar autorização") }
                }
            }
        }

        if (pagination.totalPages > 1) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FsyOutlinedButton(
                        onClick = { if (page > 1) page-- },
                        enabled = page > 1,
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) { Text("Anterior") }

                    Text(
                        text = "Página ${pagination.page} de ${pagination.totalPages} (${pagination.totalFiltered} registros)",
                        style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle)
                    )

                    FsyOutlinedButton(
                        onClick = { if (page < pagination.totalPages) page++ },
                        enabled = page < pagination.totalPages,
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) { Text("Próxima") }
                }
            }
        }
    }

    // Modal de Pré-visualização de Importação Excel (Preview -> Commit)
    val preview = activePreview
    if (preview != null) {
        AlertDialog(
            onDismissRequest = { if (!isCommitting) activePreview = null },
            title = { Text("Pré-visualização: ${preview.filename}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Total lido: ${preview.totalCanonicalRows} (${preview.participantCount} Participantes • ${preview.counselorCount} Conselheiros)",
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${preview.diffSummary.insertCount} novos • ${preview.diffSummary.updateCount} atualizados • ${preview.diffSummary.unchangedCount} sem mudanças",
                        style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle)
                    )
                    Text(
                        text = "Nomes padronizados: ${preview.normalizedNamesChangedCount} • Alertas saúde: ${preview.healthAlertCount} • Erros bloqueantes: ${preview.blockingErrorCount}",
                        style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle)
                    )

                    HorizontalDivider()
                    Text("Como importar", fontWeight = FontWeight.Bold)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        FsyFilterChip(
                            selected = importMode == "upsert",
                            onClick = { importMode = "upsert"; acknowledgeAdjustmentRemoval = false },
                            label = { Text("Adicionar e atualizar") },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
                        FsyFilterChip(
                            selected = importMode == "replace_all",
                            onClick = { importMode = "replace_all"; acknowledgeAdjustmentRemoval = false },
                            label = { Text("Substituir Tudo") },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
                    }
                    val adjustmentImpact = preview.authorizationAdjustmentImpact
                    if (adjustmentImpact.retainedCount > 0) Text("${adjustmentImpact.retainedCount} autorizações manterão os ajustes salvos.")
                    if (importMode == "replace_all" && adjustmentImpact.removedCountOnReplaceAll > 0) {
                        Text(
                            "Esta substituição removerá ${adjustmentImpact.removedCountOnReplaceAll} inscrições com autorizações editadas. Os ajustes dessas inscrições serão perdidos.",
                            color = MaterialTheme.colorScheme.error
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            FsySwitch(
                                checked = acknowledgeAdjustmentRemoval,
                                onCheckedChange = { acknowledgeAdjustmentRemoval = it },
                                modifier = Modifier.semantics { contentDescription = "Confirmo a remoção dessas inscrições e de seus ajustes" }
                            )
                            Text("Confirmo a remoção dessas inscrições e de seus ajustes.", modifier = Modifier.weight(1f))
                        }
                    }

                    if (preview.issues.isNotEmpty()) {
                        HorizontalDivider()
                        Text("Avisos/Erros (${preview.issues.size})", fontWeight = FontWeight.Bold)
                        preview.issues.take(10).forEach { issue ->
                            Text(
                                text = "[${issue.sheetName ?: "Aba"} L${issue.rowNumber ?: 0}] ${issue.message}",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (issue.severity == "error") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        isCommitting = true
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val res = appState.apiClient.commitRegistrationsPreview(
                                    session = s,
                                    previewId = preview.previewId,
                                    mode = importMode,
                                    expectedRevision = preview.baseRevision,
                                    useNormalizedNames = useNormalizedNames,
                                    acknowledgeAdjustmentRemoval = acknowledgeAdjustmentRemoval
                                )
                                activePreview = null
                                feedback = "Importação concluída: ${res.insertedCount} inseridos, ${res.updatedCount} atualizados (revisão ${res.currentRevision})."
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            } finally {
                                isCommitting = false
                            }
                        }
                    },
                    enabled = preview.canCommit && !isCommitting && (importMode != "replace_all" ||
                        preview.authorizationAdjustmentImpact.removedCountOnReplaceAll == 0 || acknowledgeAdjustmentRemoval),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text(if (isCommitting) "Gravando..." else "Confirmar importação")
                }
            },
            dismissButton = {
                FsyTextButton(
                    onClick = { activePreview = null },
                    enabled = !isCommitting,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Cancelar") }
            }
        )
    }

    // Modal de Exclusão Escopada de Lote por UUID
    val deletingBatch = batchToDelete
    if (deletingBatch != null) {
        AlertDialog(
            onDismissRequest = { batchToDelete = null },
            title = { Text("Excluir Lote Importado") },
            text = {
                Text(
                    "Confirma a exclusão do lote '${deletingBatch.filename}'? " +
                        "Todos os registros vinculados exclusivamente a este lote serão removidos."
                )
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val res = appState.apiClient.deleteRegistrationBatch(s, deletingBatch.id)
                                if (selectedBatchId == deletingBatch.id) selectedBatchId = null
                                batchToDelete = null
                                feedback = "Lote excluído (${res.deletedRecordsCount} registros removidos)."
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                                batchToDelete = null
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = FsyPalette.Danger, contentColor = MaterialTheme.colorScheme.onError),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Excluir lote") }
            },
            dismissButton = {
                FsyTextButton(onClick = { batchToDelete = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }

    // Modal de Detalhe Completo das 34 Colunas da Planilha
    val detail = detailRecord
    if (detail != null) {
        AlertDialog(
            onDismissRequest = { detailRecord = null },
            title = { Text("Dados da inscrição — ${detail.fullNameNormalized}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text("Nome original: ${detail.fullNameRaw}", style = MaterialTheme.typography.bodySmall)
                    Text("Nome normalizado: ${detail.fullNameNormalized}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                    Text("Aba de origem: ${detail.sourceSheets.joinToString(", ")} (Linha ${detail.sourceRowNumbers.values.joinToString(", ")})", style = MaterialTheme.typography.labelSmall)

                    if (detail.issues.isNotEmpty()) {
                        HorizontalDivider()
                        Text("Alertas de Validação", fontWeight = FontWeight.Bold, color = FsyPalette.Warning)
                        detail.issues.forEach { iss ->
                            Text("• ${iss.message}", style = MaterialTheme.typography.bodySmall)
                        }
                    }

                    HorizontalDivider()
                    Text("Dados originais da planilha", fontWeight = FontWeight.Bold)
                    if (detail.rawColumns.isEmpty()) {
                        Text("Sem colunas brutas adicionais.", style = MaterialTheme.typography.bodySmall)
                    } else {
                        detail.rawColumns.entries.forEach { (colName, colVal) ->
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                                shape = MaterialTheme.shapes.extraSmall,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(6.dp)) {
                                    Text(
                                        text = colName,
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Text(
                                        text = colVal.ifBlank { "—" },
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                FsyTextButton(
                    onClick = { detailRecord = null },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Fechar") }
            }
        )
    }

    appState.registrationAuthorizationEditor?.let { editor ->
        RegistrationAuthorizationEditorDialog(
            record = editor.record,
            appState = appState,
            useNormalizedNames = useNormalizedNames,
            onSaved = { saved ->
                appState.acceptSavedRegistrationAuthorization(saved)
                listState = listState.copy(items = listState.items.map { if (it.id == saved.id) saved else it })
                if (detailRecord?.id == saved.id) detailRecord = saved
            },
            onDismiss = { appState.closeRegistrationAuthorizationEditor() }
        )
    }
}

private data class AuthorizationField(
    val key: String,
    val label: String,
    val group: String,
    val multiline: Boolean = false
)

private val authorizationFields = listOf(
    AuthorizationField("firstName", "Nome", "Identificação"),
    AuthorizationField("lastName", "Sobrenome", "Identificação"),
    AuthorizationField("birthDate", "Data de nascimento (dd/mm/aaaa)", "Identificação"),
    AuthorizationField("sex", "Sexo", "Identificação"),
    AuthorizationField("phone", "Telefone com DDD", "Identificação"),
    AuthorizationField("cpf", "CPF", "Identificação"),
    AuthorizationField("documentRgOrPassport", "RG, CIN ou passaporte", "Identificação"),
    AuthorizationField("issuingAgency", "Órgão emissor", "Identificação"),
    AuthorizationField("tshirtSize", "Tamanho da camiseta", "Identificação"),
    AuthorizationField("guardianName", "Nome do responsável legal", "Responsável e unidade"),
    AuthorizationField("guardianPhone", "Telefone do responsável com DDD", "Responsável e unidade"),
    AuthorizationField("stakeName", "Estaca ou distrito", "Responsável e unidade"),
    AuthorizationField("wardName", "Ala ou ramo", "Responsável e unidade"),
    AuthorizationField("bishopName", "Nome do bispo", "Responsável e unidade"),
    AuthorizationField("bishopEmail", "E-mail do bispo", "Responsável e unidade"),
    AuthorizationField("medicalInfo", "Informações médicas", "Saúde e alimentação", true),
    AuthorizationField("dietaryInfo", "Alimentação", "Saúde e alimentação", true),
    AuthorizationField("healthConditionsSummary", "Condições de saúde selecionadas", "Saúde e alimentação", true),
    AuthorizationField("healthConditionsDetails", "Detalhes das condições de saúde", "Saúde e alimentação", true)
)

/** Dados e prévia ficam em memória; a renderização remove imediatamente seu arquivo temporário. */
@Composable
private fun RegistrationAuthorizationEditorDialog(
    record: RegistrationRecordDto,
    appState: FsyAppState,
    useNormalizedNames: Boolean,
    onSaved: (RegistrationRecordDto) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val draft = appState.registrationAuthorizationEditor?.draft ?: record.authorizationValues()
    val changes = record.authorizationChanges(draft)
    val fieldErrors = authorizationAdjustmentErrors(changes)
    var busy by remember { mutableStateOf<String?>(null) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var previewBytes by remember(record) { mutableStateOf<ByteArray?>(null) }
    var previewBitmap by remember(record) { mutableStateOf<Bitmap?>(null) }
    var confirmReset by remember { mutableStateOf(false) }
    var confirmClose by remember { mutableStateOf(false) }
    val cancelled = record.isCancelledRegistration()

    fun requestClose() {
        if (busy != null) return
        if (changes.isNotEmpty()) confirmClose = true else onDismiss()
    }

    fun save(reset: Boolean = false) {
        busy = if (reset) "reset" else "save"
        error = null
        scope.launch {
            try {
                val session = appState.withValidSession()
                val saved = appState.apiClient.saveAuthorizationAdjustments(session, record.id, changes, reset)
                confirmReset = false
                onSaved(saved)
                feedback = if (reset) "Ajustes desfeitos. A autorização voltou aos dados da planilha." else "Autorização salva. A planilha original foi preservada."
            } catch (e: Exception) {
                error = e.message ?: "Não foi possível salvar. Tente novamente."
            } finally {
                busy = null
            }
        }
    }

    Dialog(
        onDismissRequest = ::requestClose,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            securePolicy = androidx.compose.ui.window.SecureFlagPolicy.SecureOn
        )
    ) {
        Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding()
                    .verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Editar autorização", style = MaterialTheme.typography.headlineSmall)
                Text(record.fullNameNormalized.ifBlank { record.fullNameRaw }, style = MaterialTheme.typography.titleMedium)
                Text("As alterações valem só para a autorização. Os dados originais da planilha permanecem guardados.")
                record.authorizationAdjustments?.let { adjustments ->
                    FsyStatusBadge("Editado", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
                    val at = FsyFormat.parseInstant(adjustments.editedAt)?.atZone(br.com.fsyrp2.app.data.EventCalendar.EVENT_ZONE)
                        ?.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm"))
                    Text(
                        "Última edição por ${adjustments.editedByName.ifBlank { "responsável pela gestão" }}${at?.let { " em $it" }.orEmpty()}.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                authorizationFields.groupBy { it.group }.forEach { (group, fields) ->
                    HorizontalDivider()
                    Text(group, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    fields.forEach { field ->
                        if (field.key == "sex") {
                            Text(field.label, style = MaterialTheme.typography.labelLarge)
                            listOf("" to "Não informado", "Masculino" to "Masculino", "Feminino" to "Feminino").forEach { (value, label) ->
                                FsyFilterChip(
                                    selected = draft[field.key] == value,
                                    enabled = busy == null,
                                    onClick = {
                                        appState.updateRegistrationAuthorizationField(field.key, value)
                                        previewBytes = null; previewBitmap = null; feedback = null
                                    },
                                    label = { Text(label) }, modifier = Modifier.fillMaxWidth()
                                )
                            }
                        } else {
                            OutlinedTextField(
                                value = draft[field.key].orEmpty(),
                                onValueChange = { value ->
                                    if (value.length <= 2000) {
                                        appState.updateRegistrationAuthorizationField(field.key, value)
                                        previewBytes = null; previewBitmap = null; feedback = null
                                    }
                                },
                                label = { Text(field.label) },
                                enabled = busy == null,
                                isError = field.key in fieldErrors,
                                supportingText = fieldErrors[field.key]?.let { message -> { Text(message) } },
                                minLines = if (field.multiline) 3 else 1,
                                singleLine = !field.multiline,
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium
                            )
                        }
                    }
                }

                HorizontalDivider()
                Text("Pré-visualização do PDF", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (cancelled) {
                    Text("Esta inscrição está cancelada. Você pode salvar ou desfazer ajustes, mas a autorização não pode ser gerada.")
                } else {
                    Text("Confira o rascunho antes de salvar. Baixar PDF usa os ajustes já salvos.")
                    FsyOutlinedButton(
                        enabled = busy == null && fieldErrors.isEmpty(),
                        onClick = {
                            busy = "preview"; error = null
                            scope.launch {
                                try {
                                    val session = appState.withValidSession()
                                    val bytes = appState.apiClient.previewAuthorizationPdf(session, record.id, changes, useNormalizedNames)
                                    val bitmap = renderAuthorizationPreview(context, bytes)
                                    previewBytes = bytes
                                    previewBitmap = bitmap
                                } catch (e: Exception) {
                                    error = e.message ?: "Não foi possível gerar a prévia. Tente novamente."
                                } finally { busy = null }
                            }
                        }, modifier = Modifier.fillMaxWidth()
                    ) { Text(if (busy == "preview") "Preparando prévia…" else "Atualizar prévia") }
                    previewBitmap?.let { bitmap ->
                        Image(bitmap = bitmap.asImageBitmap(), contentDescription = "Prévia da autorização com os ajustes atuais", modifier = Modifier.fillMaxWidth().aspectRatio(bitmap.width.toFloat() / bitmap.height))
                    }
                    previewBytes?.let { bytes ->
                        FsyTextButton(onClick = {
                            ExternalUrlLauncher.shareOrViewPrivateDocument(context, "previa-${record.authorizationFilename()}", "application/pdf", bytes)
                        }, enabled = busy == null, modifier = Modifier.fillMaxWidth()) { Text("Abrir prévia ampliada") }
                    }
                }

                if (busy != null) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                feedback?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                FsyButton(onClick = { save() }, enabled = busy == null && changes.isNotEmpty() && fieldErrors.isEmpty(), modifier = Modifier.fillMaxWidth()) {
                    Text(if (busy == "save") "Salvando…" else "Salvar autorização")
                }
                if (!cancelled) FsyOutlinedButton(
                    enabled = busy == null,
                    onClick = {
                        busy = "download"; error = null
                        scope.launch {
                            try {
                                val session = appState.withValidSession()
                                val bytes = appState.apiClient.downloadAuthorizationPdf(session, record.id, useNormalizedNames)
                                ExternalUrlLauncher.shareOrViewPrivateDocument(context, record.authorizationFilename(), "application/pdf", bytes)
                            } catch (e: Exception) {
                                error = e.message ?: "Não foi possível baixar o PDF. Tente novamente."
                            } finally { busy = null }
                        }
                    }, modifier = Modifier.fillMaxWidth()
                ) { Text("Baixar PDF salvo") }
                if (record.hasAuthorizationAdjustments || record.authorizationAdjustments != null) {
                    FsyOutlinedButton(onClick = { confirmReset = true }, enabled = busy == null, modifier = Modifier.fillMaxWidth()) { Text("Desfazer ajustes") }
                }
                FsyTextButton(onClick = ::requestClose, enabled = busy == null, modifier = Modifier.fillMaxWidth()) {
                    Text(if (changes.isEmpty()) "Fechar edição" else "Fechar sem salvar")
                }
            }
        }
    }
    if (confirmReset) FsyConfirmDialog(
        title = "Desfazer os ajustes?",
        message = "A autorização voltará aos dados originais da planilha. As edições salvas e o rascunho atual serão descartados.",
        confirmLabel = "Desfazer ajustes", onConfirm = { save(true) }, onDismiss = { confirmReset = false }, busy = busy != null
    )
    if (confirmClose) FsyConfirmDialog(
        title = "Descartar o rascunho?", message = "As alterações que você ainda não salvou serão perdidas.",
        confirmLabel = "Descartar e fechar", onConfirm = onDismiss, onDismiss = { confirmClose = false }
    )
}

private suspend fun renderAuthorizationPreview(context: android.content.Context, bytes: ByteArray): Bitmap = withContext(Dispatchers.IO) {
    val file = File.createTempFile("authorization-preview-", ".pdf", context.cacheDir)
    try {
        file.writeBytes(bytes)
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            PdfRenderer(descriptor).use { renderer ->
                renderer.openPage(0).use { page ->
                    val width = 1080
                    val bitmap = Bitmap.createBitmap(width, (width.toFloat() * page.height / page.width).toInt(), Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(android.graphics.Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    bitmap
                }
            }
        }
    } catch (e: Exception) {
        throw IllegalStateException("Não foi possível exibir a prévia. Tente novamente ou baixe o PDF salvo.", e)
    } finally { file.delete() }
}

private fun resolveDisplayName(contentResolver: android.content.ContentResolver, uri: Uri): String? {
    return try {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        }
    } catch (_: Exception) {
        null
    }
}

