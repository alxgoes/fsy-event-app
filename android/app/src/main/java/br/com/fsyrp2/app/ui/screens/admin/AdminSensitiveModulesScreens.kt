package br.com.fsyrp2.app.ui.screens.admin

import androidx.compose.runtime.saveable.rememberSaveable

import br.com.fsyrp2.app.ui.icons.FsyIcons

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.*
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

// =============================================================================
// 8. SAÚDE (`/api/medical`, `/api/medical/appointments`) — FLAG_SECURE + Memória
// =============================================================================

@Composable
fun MedicalAdminModuleView(appState: FsyAppState) {
    val confirm = rememberFsyConfirm()
    confirm.Host()
    SecureScreenEffect()
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var records by remember { mutableStateOf<List<MedicalRecordSummary>>(emptyList()) }
    var appointments by remember { mutableStateOf<List<MedicalAppointment>>(emptyList()) }
    var activeTab by remember { mutableStateOf("records") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var editingRecord by remember { mutableStateOf<MedicalRecordSummary?>(null) }
    var creatingNewRecord by remember { mutableStateOf(false) }

    var editingAppointment by remember { mutableStateOf<MedicalAppointment?>(null) }
    var creatingNewAppointment by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val s = appState.withValidSession()
                records = appState.apiClient.fetchMedicalRecords(s)
                appointments = appState.apiClient.fetchMedicalAppointments(s)
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }



    val metricCards = listOf(
        FsyCardContent("total-records", "Total de Fichas") {
            FsySectionCard {
                Text("Fichas Médicas Cadastradas", style = MaterialTheme.typography.labelMedium)
                Text(
                    text = "${records.size}",
                    style = MaterialTheme.typography.headlineSmall.merge(TabularTextStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        },
        FsyCardContent("allergies", "Alergias") {
            val allergyCount = records.count { !it.allergies.isNullOrBlank() }
            FsySectionCard {
                Text("Com Alergias Registradas", style = MaterialTheme.typography.labelMedium)
                Text(
                    text = "$allergyCount",
                    style = MaterialTheme.typography.headlineSmall.merge(TabularTextStyle),
                    fontWeight = FontWeight.Bold,
                    color = FsyPalette.Danger
                )
            }
        },
        FsyCardContent("medications", "Medicações") {
            val medCount = records.count { !it.medications.isNullOrBlank() }
            FsySectionCard {
                Text("Com Medicação Contínua", style = MaterialTheme.typography.labelMedium)
                Text(
                    text = "$medCount",
                    style = MaterialTheme.typography.headlineSmall.merge(TabularTextStyle),
                    fontWeight = FontWeight.Bold,
                    color = FsyPalette.Warning
                )
            }
        },
        FsyCardContent("dietary", "Restrições Alimentares") {
            val dietCount = records.count { !it.dietaryRestrictions.isNullOrBlank() }
            FsySectionCard {
                Text("Restrição Alimentar", style = MaterialTheme.typography.labelMedium)
                Text(
                    text = "$dietCount",
                    style = MaterialTheme.typography.headlineSmall.merge(TabularTextStyle),
                    fontWeight = FontWeight.Bold,
                    color = FsyPalette.Success
                )
            }
        }
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        FsyStatusBadge(
            text = "Dados de saúde · acesso restrito",
            backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
            contentColor = FsyPalette.PrimarySky
        )

        FsyCardGroup(cards = metricCards)

        val compactMedicalTabs = isCompactActionLayout()
        if (compactMedicalTabs) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = activeTab == "records",
                    onClick = { haptics.tick(); activeTab = "records" },
                    label = { Text("Fichas Médicas (${records.size})") },
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                )
                FilterChip(
                    selected = activeTab == "appointments",
                    onClick = { haptics.tick(); activeTab = "appointments" },
                    label = { Text("Consultas (${appointments.size})") },
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                )
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = activeTab == "records",
                    onClick = { haptics.tick(); activeTab = "records" },
                    label = { Text("Fichas Médicas (${records.size})") },
                    modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp)
                )
                FilterChip(
                    selected = activeTab == "appointments",
                    onClick = { haptics.tick(); activeTab = "appointments" },
                    label = { Text("Consultas (${appointments.size})") },
                    modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp)
                )
            }
        }

        if (isLoading) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        if (!errorMsg.isNullOrBlank()) Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error)

        if (activeTab == "records") {
            FsyButton(
                onClick = {
                    creatingNewRecord = true
                    editingRecord = MedicalRecordSummary(id = "", userId = "", fullName = "")
                },
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
            ) {
                Icon(FsyIcons.Plus, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("Registrar nova ficha médica")
            }

            records.forEach { rec ->
                FsySectionCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = rec.fullName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text("Alergias: ${rec.allergies ?: "Nenhuma"}", style = MaterialTheme.typography.bodySmall)
                            Text("Medicações: ${rec.medications ?: "Nenhuma"}", style = MaterialTheme.typography.bodySmall)
                            Text("Alimentação: ${rec.dietaryRestrictions ?: "Normal"}", style = MaterialTheme.typography.bodySmall)
                            if (!rec.emergencyContact.isNullOrBlank()) {
                                Text(
                                    text = "Emergência: ${rec.emergencyContact} (${rec.emergencyPhone ?: "—"})",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                        Row {
                            IconButton(
                                onClick = { creatingNewRecord = false; editingRecord = rec },
                                modifier = Modifier.size(48.dp)
                            ) { Icon(FsyIcons.Pencil, contentDescription = "Editar ficha") }
                            IconButton(
                                onClick = {
                                    confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                        scope.launch {
                                            runCatching {
                                                val s = appState.withValidSession()
                                                appState.apiClient.deleteMedicalRecord(s, rec.id)
                                                reload()
                                            }.onFailure { errorMsg = it.message }
                                        }
                                    }
                                },
                                modifier = Modifier.size(48.dp)
                            ) { Icon(FsyIcons.Trash2, contentDescription = "Excluir ficha", tint = FsyPalette.Danger) }
                        }
                    }
                }
            }
        } else {
            FsyButton(
                onClick = {
                    creatingNewAppointment = true
                    editingAppointment = MedicalAppointment(
                        id = "",
                        userId = "",
                        scheduledAt = "2027-02-06T10:00:00-03:00",
                        reason = ""
                    )
                },
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
            ) {
                Icon(FsyIcons.Plus, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("Agendar consulta médica")
            }

            appointments.forEach { appt ->
                FsySectionCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FsyStatusBadge(
                                    text = appt.priority.uppercase(),
                                    backgroundColor = if (appt.priority == "urgent") FsyPalette.Danger else FsyPalette.PrimarySky,
                                    contentColor = if (appt.priority == "urgent") MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onPrimary
                                )
                                FsyStatusBadge(
                                    text = appt.status,
                                    backgroundColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = appt.youthName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text("Motivo: ${appt.reason}", style = MaterialTheme.typography.bodySmall)
                            Text("Data/Hora: ${appt.scheduledFor.take(16)}", style = MaterialTheme.typography.labelSmall.merge(TabularTextStyle))
                        }
                        Row {
                            IconButton(
                                onClick = { creatingNewAppointment = false; editingAppointment = appt },
                                modifier = Modifier.size(48.dp)
                            ) { Icon(FsyIcons.Pencil, contentDescription = "Editar consulta") }
                            IconButton(
                                onClick = {
                                    confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                        scope.launch {
                                            runCatching {
                                                val s = appState.withValidSession()
                                                appState.apiClient.deleteMedicalAppointment(s, appt.id)
                                                reload()
                                            }.onFailure { errorMsg = it.message }
                                        }
                                    }
                                },
                                modifier = Modifier.size(48.dp)
                            ) { Icon(FsyIcons.Trash2, contentDescription = "Excluir consulta", tint = FsyPalette.Danger) }
                        }
                    }
                }
            }
        }
    }

    val recTarget = editingRecord
    if (recTarget != null) {
        var fullName by remember(recTarget) { mutableStateOf(recTarget.fullName) }
        var userId by remember(recTarget) { mutableStateOf(recTarget.userId.orEmpty()) }
        var allergies by remember(recTarget) { mutableStateOf(recTarget.allergies.orEmpty()) }
        var medications by remember(recTarget) { mutableStateOf(recTarget.medications.orEmpty()) }
        var dietary by remember(recTarget) { mutableStateOf(recTarget.dietaryRestrictions.orEmpty()) }
        var emergencyContact by remember(recTarget) { mutableStateOf(recTarget.emergencyContact.orEmpty()) }
        var emergencyPhone by remember(recTarget) { mutableStateOf(recTarget.emergencyPhone.orEmpty()) }
        var notes by remember(recTarget) { mutableStateOf(recTarget.observations.orEmpty()) }

        AlertDialog(
            onDismissRequest = { editingRecord = null },
            title = { Text(if (creatingNewRecord) "Nova Ficha Médica" else "Editar Ficha Médica") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Nome completo do participante") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = userId, onValueChange = { userId = it }, label = { Text("Conta vinculada (opcional)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = allergies, onValueChange = { allergies = it }, label = { Text("Alergias") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = medications, onValueChange = { medications = it }, label = { Text("Medicações em uso") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = dietary, onValueChange = { dietary = it }, label = { Text("Restrições alimentares") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = emergencyContact, onValueChange = { emergencyContact = it }, label = { Text("Contato de emergência") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = emergencyPhone, onValueChange = { emergencyPhone = it }, label = { Text("Telefone de emergência") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Observações clínicas") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNewRecord) put("id", recTarget.id)
                                    put("full_name", fullName.trim())
                                    put("user_id", userId.trim().ifBlank { null })
                                    put("allergies", allergies.trim().ifBlank { null })
                                    put("medications", medications.trim().ifBlank { null })
                                    put("dietary_restrictions", dietary.trim().ifBlank { null })
                                    put("emergency_contact_name", emergencyContact.trim().ifBlank { null })
                                    put("emergency_contact_phone", emergencyPhone.trim().ifBlank { null })
                                    put("doctor_notes", notes.trim().ifBlank { null })
                                }
                                appState.apiClient.saveMedicalRecord(s, isNew = creatingNewRecord, body = body)
                                editingRecord = null
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = fullName.trim().length >= 2,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                FsyTextButton(onClick = { editingRecord = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }

    val apptTarget = editingAppointment
    if (apptTarget != null) {
        var youthName by remember(apptTarget) { mutableStateOf(apptTarget.youthName) }
        var professionalName by remember(apptTarget) { mutableStateOf(apptTarget.professionalName) }
        var userId by remember(apptTarget) { mutableStateOf(apptTarget.userId.orEmpty()) }
        var scheduledFor by remember(apptTarget) { mutableStateOf(apptTarget.scheduledFor) }
        var reason by remember(apptTarget) { mutableStateOf(apptTarget.reason) }
        var status by remember(apptTarget) { mutableStateOf(apptTarget.status) }
        var notes by remember(apptTarget) { mutableStateOf(apptTarget.notes.orEmpty()) }

        AlertDialog(
            onDismissRequest = { editingAppointment = null },
            title = { Text(if (creatingNewAppointment) "Agendar Consulta" else "Editar Consulta") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(value = youthName, onValueChange = { youthName = it }, label = { Text("Nome do participante") }, enabled = creatingNewAppointment, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = professionalName, onValueChange = { professionalName = it }, label = { Text("Profissional responsável") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = scheduledFor, onValueChange = { scheduledFor = it }, label = { Text("Data/Hora ISO (ex: 2027-02-06T14:00:00-03:00)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("Queixa / Motivo") }, modifier = Modifier.fillMaxWidth())
                    if (!creatingNewAppointment) OutlinedTextField(value = status, onValueChange = { status = it }, label = { Text("Status: agendado, realizado ou cancelado") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Anotações de atendimento") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNewAppointment) put("id", apptTarget.id)
                                    if (creatingNewAppointment) {
                                        put("youth_name", youthName.trim())
                                        put("user_id", userId.trim().ifBlank { null })
                                    }
                                    put("professional_name", professionalName.trim())
                                    put("scheduled_at", scheduledFor.trim())
                                    put("reason", reason.trim())
                                    if (!creatingNewAppointment) put("status", status.trim())
                                    put("notes", notes.trim().ifBlank { null })
                                }
                                appState.apiClient.saveMedicalAppointment(s, isNew = creatingNewAppointment, body = body)
                                editingAppointment = null
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = youthName.trim().length >= 2 && professionalName.trim().length >= 2 && reason.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                FsyTextButton(onClick = { editingAppointment = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 9. INCLUSÃO E NECESSIDADES ESPECIAIS (`/api/inclusion`) — FLAG_SECURE + Memória
// =============================================================================

@Composable
fun InclusionAdminModuleView(appState: FsyAppState) {
    SecureScreenEffect()
    val scope = rememberCoroutineScope()

    var cases by remember { mutableStateOf<List<InclusionCaseSummary>>(emptyList()) }
    var includeArchived by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var creatingCase by remember { mutableStateOf(false) }
    var selectedCaseDetail by remember { mutableStateOf<InclusionCaseSummary?>(null) }
    var selectedCaseInterviews by remember { mutableStateOf<List<InclusionInterviewRecord>>(emptyList()) }
    var addingInterviewForCase by remember { mutableStateOf<InclusionCaseSummary?>(null) }
    var recordingDecisionForCase by remember { mutableStateOf<InclusionCaseSummary?>(null) }

    fun reload() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val s = appState.withValidSession()
                cases = appState.apiClient.fetchInclusionCases(s, includeArchived = includeArchived)
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(includeArchived) { reload() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        FsyStatusBadge(
            text = "Acompanhamento de inclusão · acesso restrito",
            backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
            contentColor = FsyPalette.PrimarySky
        )

        val compactInclusionHeader = isCompactActionLayout()
        if (compactInclusionHeader) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Exibir arquivados", modifier = Modifier.weight(1f))
                    FsySwitch(checked = includeArchived, onCheckedChange = { includeArchived = it })
                }
                FsyButton(
                    onClick = { creatingCase = true },
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(FsyIcons.Plus, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Novo caso")
                }
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Exibir arquivados")
                    FsySwitch(checked = includeArchived, onCheckedChange = { includeArchived = it })
                }
                FsyButton(
                    onClick = { creatingCase = true },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(FsyIcons.Plus, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Novo caso")
                }
            }
        }

        if (isLoading) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        if (!errorMsg.isNullOrBlank()) Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error)

        if (cases.isEmpty() && !isLoading) {
            FsyEmptyStateCard(
                title = "Nenhum caso de inclusão listado",
                description = "Use “Novo caso” para registrar um acompanhamento."
            )
        } else {
            cases.forEach { c ->
                FsySectionCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FsyStatusBadge(
                                    text = c.supportLevel.uppercase(),
                                    backgroundColor = if (c.supportLevel == "critical" || c.supportLevel == "high") FsyPalette.Danger else FsyPalette.PrimarySky,
                                    contentColor = if (c.supportLevel == "critical" || c.supportLevel == "high") MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onPrimary
                                )
                                FsyStatusBadge(
                                    text = c.workflowStatus,
                                    backgroundColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(c.participantName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text("Fase: ${c.phaseLabel}", style = MaterialTheme.typography.bodySmall)
                            if (!c.needs.isNullOrBlank()) {
                                Text(c.needs, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    val compactCaseActions = isCompactActionLayout()
                    if (compactCaseActions) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            FsyOutlinedButton(
                                onClick = {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            val (detail, interviews) = appState.apiClient.fetchInclusionCaseDetail(s, c.id)
                                            selectedCaseDetail = detail
                                            selectedCaseInterviews = interviews
                                        }.onFailure { errorMsg = it.message }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                            ) { Text("Entrevistas") }

                            FsyOutlinedButton(
                                onClick = { recordingDecisionForCase = c },
                                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(FsyIcons.CircleCheck, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Decisão")
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            FsyOutlinedButton(
                                onClick = {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            val (detail, interviews) = appState.apiClient.fetchInclusionCaseDetail(s, c.id)
                                            selectedCaseDetail = detail
                                            selectedCaseInterviews = interviews
                                        }.onFailure { errorMsg = it.message }
                                    }
                                },
                                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp)
                            ) { Text("Entrevistas") }

                            FsyOutlinedButton(
                                onClick = { recordingDecisionForCase = c },
                                modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(FsyIcons.CircleCheck, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Decisão")
                            }
                        }
                    }
                }
            }
        }
    }

    if (creatingCase) {
        var participantName by remember { mutableStateOf("") }
        var supportPlan by remember { mutableStateOf("") }
        var unit by remember { mutableStateOf("") }
        var guardianName by remember { mutableStateOf("") }
        var guardianPhone by remember { mutableStateOf("") }
        var summary by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { creatingCase = false },
            title = { Text("Novo Caso de Inclusão") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(value = participantName, onValueChange = { participantName = it }, label = { Text("Nome completo do jovem") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = supportPlan, onValueChange = { supportPlan = it }, label = { Text("Plano de apoio") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = unit, onValueChange = { unit = it }, label = { Text("Estaca / Ala") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = guardianName, onValueChange = { guardianName = it }, label = { Text("Responsável") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = guardianPhone, onValueChange = { guardianPhone = it }, label = { Text("Telefone do responsável") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = summary, onValueChange = { summary = it }, label = { Text("Resumo clínico / pedagógico") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    putJsonObject("new_record") { put("full_name", participantName.trim()) }
                                    put("needs", summary.trim())
                                    put("support_plan", supportPlan.trim())
                                    putJsonObject("contacts") {
                                        putJsonObject("parent") {
                                            put("name", guardianName.trim())
                                            put("phone", guardianPhone.trim())
                                            put("relationship", "")
                                            put("ward", unit.trim())
                                        }
                                        putJsonObject("bishop") { put("name", ""); put("phone", ""); put("relationship", ""); put("ward", "") }
                                    }
                                }
                                appState.apiClient.createInclusionCase(s, body)
                                creatingCase = false
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = participantName.isNotBlank() && summary.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Criar caso") }
            },
            dismissButton = {
                FsyTextButton(onClick = { creatingCase = false }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }

    val detailCase = selectedCaseDetail
    if (detailCase != null) {
        AlertDialog(
            onDismissRequest = { selectedCaseDetail = null },
            title = { Text("Entrevistas — ${detailCase.participantName}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FsyButton(
                        onClick = { addingInterviewForCase = detailCase },
                        modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Registrar entrevista")
                    }

                    if (selectedCaseInterviews.isEmpty()) {
                        Text("Nenhuma entrevista registrada ainda.")
                    } else {
                        selectedCaseInterviews.forEach { iv ->
                            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small) {
                                Column(modifier = Modifier.padding(8.dp)) {
                                    Text("${iv.role} • ${iv.interviewedPerson}", fontWeight = FontWeight.Bold)
                                    Text(iv.summary, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                FsyTextButton(onClick = { selectedCaseDetail = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Fechar") }
            }
        )
    }

    val ivCase = addingInterviewForCase
    if (ivCase != null) {
        var person by remember { mutableStateOf("") }
        var scheduledAt by remember { mutableStateOf("") }
        var summary by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { addingInterviewForCase = null },
            title = { Text("Nova Entrevista — ${ivCase.participantName}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = person, onValueChange = { person = it }, label = { Text("Participantes da entrevista") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = scheduledAt, onValueChange = { scheduledAt = it }, label = { Text("Data e hora (ex.: 2027-02-06T14:00:00-03:00)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = summary, onValueChange = { summary = it }, label = { Text("Síntese da entrevista") }, minLines = 3, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    put("version", ivCase.version)
                                    put("scheduled_at", scheduledAt.trim())
                                    put("participants", person.trim())
                                    put("status", "realizada")
                                    put("summary", summary.trim())
                                }
                                appState.apiClient.saveInclusionInterview(s, ivCase.id, null, body)
                                addingInterviewForCase = null
                                val (d, ivs) = appState.apiClient.fetchInclusionCaseDetail(s, ivCase.id)
                                selectedCaseDetail = d
                                selectedCaseInterviews = ivs
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = person.trim().length >= 2 && summary.isNotBlank() && scheduledAt.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar entrevista") }
            },
            dismissButton = {
                FsyTextButton(onClick = { addingInterviewForCase = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }

    val decCase = recordingDecisionForCase
    if (decCase != null) {
        var decision by remember { mutableStateOf("participacao_com_apoio") }
        var rationale by remember { mutableStateOf(decCase.decisionRationale.orEmpty()) }
        var conditions by remember { mutableStateOf(decCase.decisionConditions.joinToString("\n")) }
        var humanConfirmed by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { recordingDecisionForCase = null },
            title = { Text("Decisão Humana — ${decCase.participantName}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = decision,
                        onValueChange = { decision = it },
                        label = { Text("Decisão: participacao_confirmada, participacao_com_apoio ou participacao_nao_recomendada") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = rationale,
                        onValueChange = { rationale = it },
                        label = { Text("Fundamentação humana da coordenação") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = conditions,
                        onValueChange = { conditions = it },
                        label = { Text("Adaptações / Condições (uma por linha)") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Confirmo que esta decisão foi revisada por liderança humana",
                            modifier = Modifier.weight(1f).padding(end = 8.dp)
                        )
                        Checkbox(checked = humanConfirmed, onCheckedChange = { humanConfirmed = it })
                    }
                }
            },
            confirmButton = {
                FsyButton(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val condList = conditions.lines().map { it.trim() }.filter { it.isNotEmpty() }
                                val body = buildJsonObject {
                                    put("decision", decision.trim())
                                    put("reason", rationale.trim())
                                    put("support_plan", condList.joinToString("\n"))
                                    put("confirmed_by_human", true)
                                    put("version", decCase.version)
                                }
                                appState.apiClient.recordInclusionDecision(s, decCase.id, body)
                                recordingDecisionForCase = null
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = humanConfirmed && rationale.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Registrar decisão") }
            },
            dismissButton = {
                FsyTextButton(onClick = { recordingDecisionForCase = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}


