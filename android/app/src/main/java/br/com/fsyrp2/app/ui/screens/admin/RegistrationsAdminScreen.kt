package br.com.fsyrp2.app.ui.screens.admin

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.FolderZip
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.launch

@Composable
fun RegistrationsAdminScreen(appState: FsyAppState) {
    SecureScreenEffect()
    val context = LocalContext.current
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()

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
                text = "INSCRIÇÕES FSY (34 COLUNAS) • TELA PROTEGIDA (FLAG_SECURE)",
                backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                contentColor = FsyPalette.PrimarySky
            )
        }

        // Resumo de métricas e revisão
        item {
            FsySectionCard {
                Text(
                    text = "Resumo Canônico (Revisão #${listState.currentRevision})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
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
                        text = "Usar nomes normalizados (Title Case pt-BR) nos PDFs/Excel",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = useNormalizedNames,
                        onCheckedChange = { useNormalizedNames = it }
                    )
                }
            }
        }

        // Ações de Importação, Lotes e Downloads Oficiais (PDF, ZIP, XLSX, Template)
        item {
            FsySectionCard {
                Text(
                    text = "Importação Excel & Geração de Documentos",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(8.dp))

                Button(
                    onClick = {
                        haptics.confirm()
                        xlsxPickerLauncher.launch("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    },
                    enabled = !isLoading && !isDownloading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.UploadFile, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Importar Planilha Excel (.xlsx — 34 Colunas)", fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
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
                        Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Exportar .xlsx")
                    }

                    OutlinedButton(
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
                        Icon(Icons.Default.Description, contentDescription = null, modifier = Modifier.size(18.dp))
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
                    OutlinedButton(
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

                    FilledTonalButton(
                        onClick = {
                            haptics.confirm()
                            isDownloading = true
                            errorMsg = null
                            scope.launch {
                                try {
                                    val s = appState.withValidSession()
                                    val zipRole = if (roleCategory == "Conselheiro") "Conselheiro" else "Participante"
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
                        Icon(Icons.Default.FolderZip, contentDescription = null)
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
                                            text = "UUID: ${batch.id.take(8)}… • ${batch.totalCount} registros (${batch.participantCount} part. / ${batch.counselorCount} cons.)",
                                            style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle),
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    Row {
                                        TextButton(
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
                                                imageVector = Icons.Default.Delete,
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
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(
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
                        "Conselheiro" to "Conselheiros (${metrics.counselorCount})"
                    ).forEach { (key, label) ->
                        FilterChip(
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

                    FilterChip(
                        selected = onlyHealthAlerts,
                        onClick = {
                            haptics.tick()
                            onlyHealthAlerts = !onlyHealthAlerts
                            page = 1
                        },
                        label = { Text("Alerta Saúde (${metrics.healthAlertCount})") },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    )

                    FilterChip(
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
                    description = "Importe a planilha Excel oficial de 34 colunas ou ajuste os filtros de pesquisa."
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
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FsyStatusBadge(
                                    text = item.roleCategory,
                                    backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                                    contentColor = FsyPalette.PrimarySky
                                )
                                if (item.hasHealthAlert) {
                                    FsyStatusBadge("SAÚDE", FsyPalette.Danger, Color.White)
                                }
                                if (item.hasMissingGuardianForMinor) {
                                    FsyStatusBadge("SEM RESPONSÁVEL", FsyPalette.Warning, FsyPalette.DeepText)
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
                        OutlinedButton(
                            onClick = {
                                haptics.tick()
                                scope.launch {
                                    try {
                                        val s = appState.withValidSession()
                                        detailRecord = appState.apiClient.fetchRegistrationDetail(s, item.id)
                                    } catch (_: Exception) {
                                        detailRecord = item
                                    }
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(Icons.Default.Visibility, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("34 Colunas")
                        }

                        FilledTonalButton(
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
                                            filename = "Autorizacao_${displayName.take(28)}.pdf",
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
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(Icons.Default.PictureAsPdf, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Ficha PDF")
                        }
                    }
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
                    OutlinedButton(
                        onClick = { if (page > 1) page-- },
                        enabled = page > 1,
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) { Text("Anterior") }

                    Text(
                        text = "Página ${pagination.page} de ${pagination.totalPages} (${pagination.totalFiltered} registros)",
                        style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle)
                    )

                    OutlinedButton(
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
                        text = "Diffs: +${preview.diffSummary.insertCount} novos • ~${preview.diffSummary.updateCount} atualizados • =${preview.diffSummary.unchangedCount} inalterados",
                        style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle)
                    )
                    Text(
                        text = "Nomes normalizados (Title Case): ${preview.normalizedNamesChangedCount} • Alertas saúde: ${preview.healthAlertCount} • Erros bloqueantes: ${preview.blockingErrorCount}",
                        style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle)
                    )

                    HorizontalDivider()
                    Text("Modo de Gravação", fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = importMode == "upsert",
                            onClick = { importMode = "upsert" },
                            label = { Text("Upsert (Atualizar/Inserir)") },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
                        FilterChip(
                            selected = importMode == "replace_all",
                            onClick = { importMode = "replace_all" },
                            label = { Text("Substituir Tudo") },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
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
                Button(
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
                                    useNormalizedNames = useNormalizedNames
                                )
                                activePreview = null
                                feedback = "Importação concluída: ${res.insertedCount} inseridos, ${res.updatedCount} atualizados (Revisão #${res.currentRevision})."
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            } finally {
                                isCommitting = false
                            }
                        }
                    },
                    enabled = preview.canCommit && !isCommitting,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text(if (isCommitting) "Gravando..." else "Confirmar importação")
                }
            },
            dismissButton = {
                TextButton(
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
                    "Confirma a exclusão do lote '${deletingBatch.filename}' (UUID ${deletingBatch.id})? " +
                        "Todos os registros vinculados exclusivamente a este lote serão removidos."
                )
            },
            confirmButton = {
                Button(
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
                    colors = ButtonDefaults.buttonColors(containerColor = FsyPalette.Danger, contentColor = Color.White),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Excluir lote") }
            },
            dismissButton = {
                TextButton(onClick = { batchToDelete = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }

    // Modal de Detalhe Completo das 34 Colunas da Planilha
    val detail = detailRecord
    if (detail != null) {
        AlertDialog(
            onDismissRequest = { detailRecord = null },
            title = { Text("34 Colunas — ${detail.fullNameNormalized}") },
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
                    Text("Todas as 34 Colunas da Planilha Oficial", fontWeight = FontWeight.Bold)
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
                TextButton(
                    onClick = { detailRecord = null },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Fechar") }
            }
        )
    }
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

