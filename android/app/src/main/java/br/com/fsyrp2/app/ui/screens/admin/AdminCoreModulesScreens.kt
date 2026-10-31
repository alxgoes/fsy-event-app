package br.com.fsyrp2.app.ui.screens.admin

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import br.com.fsyrp2.app.data.EventCalendar
import br.com.fsyrp2.app.model.*
import br.com.fsyrp2.app.state.FsyAppState
import br.com.fsyrp2.app.ui.components.FsyEmptyStateCard
import br.com.fsyrp2.app.ui.components.FsySectionCard
import br.com.fsyrp2.app.ui.components.FsyStatusBadge
import br.com.fsyrp2.app.ui.components.SecureScreenEffect
import br.com.fsyrp2.app.ui.motion.rememberFsyHaptics
import br.com.fsyrp2.app.ui.theme.FsyPalette
import br.com.fsyrp2.app.ui.theme.TabularTextStyle
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// =============================================================================
// 1. CONTAS E PERMISSÕES (`/api/admin/accounts`)
// =============================================================================

@Composable
fun AccountsAdminModuleView(appState: FsyAppState) {
    SecureScreenEffect()
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()

    var accounts by remember { mutableStateOf<List<AdminAccountRecord>>(emptyList()) }
    var metrics by remember { mutableStateOf(AccountListMetrics()) }
    var search by remember { mutableStateOf("") }
    var roleFilter by remember { mutableStateOf("all") }
    var statusFilter by remember { mutableStateOf("all") }
    var page by remember { mutableIntStateOf(1) }
    var totalPages by remember { mutableIntStateOf(1) }

    var isLoading by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var selectedAccountForEdit by remember { mutableStateOf<AdminAccountRecord?>(null) }
    var selectedAccountForEvents by remember { mutableStateOf<AdminAccountRecord?>(null) }
    var accountEvents by remember { mutableStateOf<List<AccountAuditEvent>>(emptyList()) }

    fun reload() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val s = appState.withValidSession()
                val res = appState.apiClient.fetchAdminAccounts(
                    session = s,
                    search = search,
                    role = roleFilter,
                    status = statusFilter,
                    page = page
                )
                accounts = res.accounts
                metrics = res.metrics
                totalPages = res.totalPages
            } catch (e: Exception) {
                errorMsg = e.message ?: "Erro ao carregar contas."
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(roleFilter, statusFilter, page) {
        reload()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            FsySectionCard {
                Text(
                    text = "Resumo de Contas (${metrics.total})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "${metrics.activeCount} ativas • ${metrics.pendingEmailCount} pendentes de e-mail • ${metrics.suspendedCount} suspensas",
                    style = MaterialTheme.typography.bodySmall.merge(TabularTextStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = search,
                        onValueChange = { search = it },
                        label = { Text("Buscar por nome, e-mail ou ala") },
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
                        Text("Buscar")
                    }
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val roles = listOf(
                        "all" to "Todos os papéis",
                        "jovem" to "Jovens",
                        "consultor" to "Conselheiros",
                        "logistica" to "Logística",
                        "coordenador" to "Coordenadores",
                        "casal_diretor" to "Casal Diretor"
                    )
                    roles.forEach { (key, label) ->
                        FilterChip(
                            selected = roleFilter == key,
                            onClick = {
                                haptics.tick()
                                roleFilter = key
                                page = 1
                            },
                            label = { Text(label) },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        )
                    }
                }
            }
        }

        if (isLoading) {
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

        items(accounts, key = { it.id }) { acc ->
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = acc.fullName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = acc.email.orEmpty(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    FsyStatusBadge(
                        text = UserRole.fromWire(acc.role).labelPt,
                        backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                        contentColor = FsyPalette.PrimarySky
                    )
                }

                Spacer(Modifier.height(6.dp))

                Text(
                    text = buildString {
                        append("Status: ${acc.status}")
                        if (!acc.companyName.isNullOrBlank()) append(" • Companhia: ${acc.companyName}")
                        if (!acc.room.isNullOrBlank()) append(" • Quarto: ${acc.room}")
                        if (!acc.busAssignment.isNullOrBlank()) append(" • Ônibus: ${acc.busAssignment}")
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            haptics.tick()
                            selectedAccountForEdit = acc
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Gerenciar")
                    }

                    OutlinedButton(
                        onClick = {
                            haptics.tick()
                            selectedAccountForEvents = acc
                            scope.launch {
                                runCatching {
                                    val s = appState.withValidSession()
                                    accountEvents = appState.apiClient.fetchAccountEvents(s, acc.id)
                                }
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Auditoria")
                    }
                }
            }
        }

        if (totalPages > 1) {
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
                        text = "Página $page de $totalPages",
                        style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle)
                    )

                    OutlinedButton(
                        onClick = { if (page < totalPages) page++ },
                        enabled = page < totalPages,
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) { Text("Próxima") }
                }
            }
        }
    }

    val editingAcc = selectedAccountForEdit
    if (editingAcc != null) {
        AccountEditDialog(
            account = editingAcc,
            onDismiss = { selectedAccountForEdit = null },
            onSavePatch = { patchBody ->
                scope.launch {
                    try {
                        val s = appState.withValidSession()
                        appState.apiClient.patchAccount(s, editingAcc.id, patchBody)
                        feedback = "Conta de ${editingAcc.fullName} atualizada."
                        selectedAccountForEdit = null
                        reload()
                    } catch (e: Exception) {
                        errorMsg = e.message
                    }
                }
            },
            onSetPassword = { newPassword ->
                scope.launch {
                    try {
                        val s = appState.withValidSession()
                        appState.apiClient.setAccountPassword(s, editingAcc.id, newPassword)
                        feedback = "Senha redefinida para ${editingAcc.fullName}."
                        selectedAccountForEdit = null
                    } catch (e: Exception) {
                        errorMsg = e.message
                    }
                }
            },
            onSendRecovery = {
                scope.launch {
                    try {
                        val s = appState.withValidSession()
                        appState.apiClient.sendAccountRecovery(s, editingAcc.id)
                        feedback = "Link de recuperação enviado para ${editingAcc.email}."
                    } catch (e: Exception) {
                        errorMsg = e.message
                    }
                }
            },
            onSendEmail = { subject, body ->
                scope.launch {
                    try {
                        val s = appState.withValidSession()
                        appState.apiClient.sendAccountEmail(s, editingAcc.id, subject, body)
                        feedback = "E-mail enviado para ${editingAcc.email}."
                    } catch (e: Exception) {
                        errorMsg = e.message
                    }
                }
            },
            onDeleteAccount = { confirmStr ->
                scope.launch {
                    try {
                        val s = appState.withValidSession()
                        appState.apiClient.deleteAccount(s, editingAcc.id, confirmStr)
                        feedback = "Conta excluída."
                        selectedAccountForEdit = null
                        reload()
                    } catch (e: Exception) {
                        errorMsg = e.message
                    }
                }
            }
        )
    }

    val eventsAcc = selectedAccountForEvents
    if (eventsAcc != null) {
        AlertDialog(
            onDismissRequest = { selectedAccountForEvents = null },
            title = { Text("Histórico de Auditoria — ${eventsAcc.fullName}") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (accountEvents.isEmpty()) {
                        Text("Nenhum evento auditado para esta conta.")
                    } else {
                        accountEvents.forEach { ev ->
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = MaterialTheme.shapes.small,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(8.dp)) {
                                    Text(
                                        text = "${ev.action} • ${ev.createdAt.take(16)}",
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Autor: ${ev.actorName ?: ev.actorEmail ?: "Sistema"}",
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
                    onClick = { selectedAccountForEvents = null },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Fechar") }
            }
        )
    }
}

@Composable
private fun AccountEditDialog(
    account: AdminAccountRecord,
    onDismiss: () -> Unit,
    onSavePatch: (kotlinx.serialization.json.JsonObject) -> Unit,
    onSetPassword: (String) -> Unit,
    onSendRecovery: () -> Unit,
    onSendEmail: (String, String) -> Unit,
    onDeleteAccount: (String) -> Unit
) {
    var fullName by remember { mutableStateOf(account.fullName) }
    var role by remember { mutableStateOf(account.role.orEmpty()) }
    var unit by remember { mutableStateOf(account.unit.orEmpty()) }
    var room by remember { mutableStateOf(account.room.orEmpty()) }

    var suspended by remember { mutableStateOf(account.status == "suspenso") }


    var manualPassword by remember { mutableStateOf("") }
    var emailSubject by remember { mutableStateOf("") }
    var emailBody by remember { mutableStateOf("") }
    var deleteConfirm by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Gerenciar Conta: ${account.fullName}") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text("Nome completo") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = role,
                    onValueChange = { role = it },
                    label = { Text("Papel (jovem, consultor, logistica, coordenador, casal_diretor)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = unit,
                    onValueChange = { unit = it },
                    label = { Text("Unidade / Ala / Estaca") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = room,
                        onValueChange = { room = it },
                        label = { Text("Quarto") },
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Suspender acesso da conta")
                    Switch(checked = suspended, onCheckedChange = { suspended = it })
                }

                HorizontalDivider()
                OutlinedButton(onClick = { onSavePatch(buildJsonObject { put("action", "role"); put("role", role.trim()) }) }, modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)) { Text("Alterar cargo") }
                OutlinedButton(onClick = { onSavePatch(buildJsonObject { put("action", if (suspended) "suspend" else "reactivate") }) }, modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)) { Text("Aplicar estado de acesso") }
                Text("Segurança e Senha", fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = manualPassword,
                    onValueChange = { manualPassword = it },
                    label = { Text("Nova senha manual (mín. 8 caracteres)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { onSetPassword(manualPassword) },
                        enabled = manualPassword.length >= 8,
                        modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(Icons.Default.Key, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Definir senha")
                    }
                    OutlinedButton(
                        onClick = onSendRecovery,
                        modifier = Modifier.weight(1f).defaultMinSize(minHeight = 48.dp)
                    ) {
                        Text("Enviar recuperação")
                    }
                }

                HorizontalDivider()
                Text("Enviar E-mail Direto", fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = emailSubject,
                    onValueChange = { emailSubject = it },
                    label = { Text("Assunto do e-mail") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = emailBody,
                    onValueChange = { emailBody = it },
                    label = { Text("Mensagem") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedButton(
                    onClick = { onSendEmail(emailSubject, emailBody) },
                    enabled = emailSubject.isNotBlank() && emailBody.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Email, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Disparar e-mail institucional")
                }

                HorizontalDivider()
                Text("Zona de Exclusão Permanente", fontWeight = FontWeight.Bold, color = FsyPalette.Danger)
                OutlinedTextField(
                    value = deleteConfirm,
                    onValueChange = { deleteConfirm = it },
                    label = { Text("Digite EXCLUIR ou ${account.email}") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedButton(
                    onClick = { onDeleteAccount(deleteConfirm) },
                    enabled = deleteConfirm.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null, tint = FsyPalette.Danger)
                    Spacer(Modifier.width(6.dp))
                    Text("Excluir conta permanentemente", color = FsyPalette.Danger)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {

                    val patch = buildJsonObject {
                        put("action", "edit")
                        put("full_name", fullName.trim())

                        put("stake", unit.trim().ifBlank { null })
                        put("room", room.trim().ifBlank { null })



                    }
                    onSavePatch(patch)
                },
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Salvar alterações")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) { Text("Cancelar") }
        }
    )
}

// =============================================================================
// 2. COMPANHIAS (`/api/companies`)
// =============================================================================

@Composable
fun CompaniesAdminModuleView(appState: FsyAppState) {
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()

    var companies by remember { mutableStateOf<List<Company>>(emptyList()) }
    var counselors by remember { mutableStateOf<List<CounselorSummary>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var editingCompany by remember { mutableStateOf<Company?>(null) }
    var creatingNew by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            isLoading = true
            errorMsg = null
            try {
                val s = appState.withValidSession()
                val payload = appState.apiClient.fetchCompaniesPayload(s)
                companies = payload.companies
                counselors = payload.counselors
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Companhias (${companies.size})",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = {
                        haptics.confirm()
                        creatingNew = true
                        editingCompany = Company(id = "", name = "")
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Nova companhia")
                }
            }
        }

        if (isLoading) {
            item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        }
        if (!errorMsg.isNullOrBlank()) {
            item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }
        }

        items(companies, key = { it.id }) { comp ->
            val assignedCounselors = counselors.filter { it.companyId == comp.id }
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(comp.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        if (!comp.motto.isNullOrBlank()) {
                            Text("Lema: “${comp.motto}”", style = MaterialTheme.typography.bodySmall)
                        }
                        Text(
                            text = "Sala: ${comp.room ?: "—"} • Conselheiros: ${
                                assignedCounselors.joinToString { it.fullName }.ifBlank { "Nenhum vinculado" }
                            }",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Row {
                        IconButton(
                            onClick = {
                                creatingNew = false
                                editingCompany = comp
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(Icons.Default.Edit, contentDescription = "Editar ${comp.name}") }

                        IconButton(
                            onClick = {
                                scope.launch {
                                    runCatching {
                                        val s = appState.withValidSession()
                                        appState.apiClient.deleteCompany(s, comp.id)
                                        reload()
                                    }.onFailure { errorMsg = it.message }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Excluir ${comp.name}", tint = FsyPalette.Danger)
                        }
                    }
                }
            }
        }
    }

    val compTarget = editingCompany
    if (compTarget != null) {
        var selectedCounselors by remember(compTarget) { mutableStateOf(counselors.filter { it.companyId == compTarget.id }.map { it.id }.toSet()) }
        var name by remember(compTarget) { mutableStateOf(compTarget.name) }
        var motto by remember(compTarget) { mutableStateOf(compTarget.motto.orEmpty()) }

        var color by remember(compTarget) { mutableStateOf(compTarget.color ?: "#006184") }


        AlertDialog(
            onDismissRequest = { editingCompany = null },
            title = { Text(if (creatingNew) "Nova Companhia" else "Editar Companhia") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome da companhia") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = motto, onValueChange = { motto = it }, label = { Text("Lema / Grito de guerra") }, modifier = Modifier.fillMaxWidth())

                    OutlinedTextField(value = color, onValueChange = { color = it }, label = { Text("Cor Hex (ex: #007DA5)") }, modifier = Modifier.fillMaxWidth())
                    Text("Conselheiros vinculados", fontWeight = FontWeight.Bold)
                    Column(modifier = Modifier.heightIn(max = 200.dp).verticalScroll(rememberScrollState())) {
                        counselors.forEach { counselor ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(checked = counselor.id in selectedCounselors, onCheckedChange = { checked -> selectedCounselors = if (checked) selectedCounselors + counselor.id else selectedCounselors - counselor.id })
                                Text(counselor.fullName)
                            }
                        }
                    }

                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNew) put("id", compTarget.id)
                                    put("name", name.trim())
                                    put("motto", motto.trim().ifBlank { null })

                                    put("color", color.trim().ifBlank { "#006184" })
                                    put("counselor_ids", JsonArray(selectedCounselors.map { JsonPrimitive(it) }))

                                }
                                appState.apiClient.saveCompany(s, isNew = creatingNew, body = body)
                                editingCompany = null
                                reload()
                                appState.refreshCoreData()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = name.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                TextButton(onClick = { editingCompany = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 3. CRONOGRAMA (`/api/schedule`)
// =============================================================================

@Composable
fun ScheduleAdminModuleView(appState: FsyAppState) {
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<ScheduleItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var editingItem by remember { mutableStateOf<ScheduleItem?>(null) }
    var creatingNew by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            isLoading = true
            try {
                val s = appState.withValidSession()
                items = appState.apiClient.fetchAdminSchedule(s)
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Atividades do Cronograma (${items.size})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Button(
                    onClick = {
                        creatingNew = true
                        editingItem = ScheduleItem(id = "", day = "dia1", startTime = "08:00", endTime = "09:00", title = "")
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Nova atividade")
                }
            }
        }

        if (isLoading) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        if (!errorMsg.isNullOrBlank()) item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }

        items(items, key = { it.id }) { item ->
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${EventCalendar.DAY_LABELS[item.dayKey] ?: item.dayKey} • ${item.startTime.take(5)}–${item.endTime.take(5)}",
                            style = MaterialTheme.typography.labelMedium.merge(TabularTextStyle),
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold
                        )
                        Text(item.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        if (!item.location.isNullOrBlank()) {
                            Text("Local: ${item.location}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Row {
                        IconButton(
                            onClick = {
                                creatingNew = false
                                editingItem = item
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(Icons.Default.Edit, contentDescription = "Editar ${item.title}") }
                        IconButton(
                            onClick = {
                                scope.launch {
                                    runCatching {
                                        val s = appState.withValidSession()
                                        appState.apiClient.deleteScheduleItem(s, item.id)
                                        reload()
                                        appState.refreshCoreData()
                                    }.onFailure { errorMsg = it.message }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(Icons.Default.Delete, contentDescription = "Excluir ${item.title}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingItem
    if (target != null) {
        var dayKey by remember(target) { mutableStateOf(target.dayKey) }
        var startTime by remember(target) { mutableStateOf(target.startTime.take(5)) }
        var endTime by remember(target) { mutableStateOf(target.endTime.take(5)) }
        var title by remember(target) { mutableStateOf(target.title) }
        var location by remember(target) { mutableStateOf(target.location.orEmpty()) }
        var category by remember(target) { mutableStateOf(target.category) }
        var description by remember(target) { mutableStateOf(target.description.orEmpty()) }

        AlertDialog(
            onDismissRequest = { editingItem = null },
            title = { Text(if (creatingNew) "Nova Atividade" else "Editar Atividade") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(value = dayKey, onValueChange = { dayKey = it }, label = { Text("Dia (dia0, dia1, dia2, dia3, dia4, dia5)") }, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = startTime, onValueChange = { startTime = it }, label = { Text("Início (HH:MM)") }, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = endTime, onValueChange = { endTime = it }, label = { Text("Fim (HH:MM)") }, modifier = Modifier.weight(1f))
                    }
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Título da atividade") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Local") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Categoria (spiritual, activity, meal, logistics)") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Descrição") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNew) put("id", target.id)
                                    put("day", dayKey.trim())
                                    put("date", br.com.fsyrp2.app.model.ScheduleDays.dayDates[dayKey.trim()].orEmpty())
                                    put("start_time", startTime.trim())
                                    put("end_time", endTime.trim())
                                    put("title", title.trim())
                                    put("location", location.trim().ifBlank { null })
                                    put("category", category.trim().ifBlank { "activity" })
                                    put("description", description.trim().ifBlank { null })
                                }
                                appState.apiClient.saveScheduleItem(s, isNew = creatingNew, body = body)
                                editingItem = null
                                reload()
                                appState.refreshCoreData()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = title.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                TextButton(onClick = { editingItem = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 4. LOGÍSTICA DE ÔNIBUS (`/api/logistics`)
// =============================================================================

@Composable
fun LogisticsAdminModuleView(appState: FsyAppState) {
    val scope = rememberCoroutineScope()
    var buses by remember { mutableStateOf<List<LogisticsBus>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var editingBus by remember { mutableStateOf<LogisticsBus?>(null) }
    var creatingNew by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            isLoading = true
            try {
                val s = appState.withValidSession()
                buses = appState.apiClient.fetchLogisticsBuses(s)
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Frota e Transporte (${buses.size})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Button(
                    onClick = {
                        creatingNew = true
                        editingBus = LogisticsBus(id = "", busNumber = "", stakeCity = "", driverName = "")
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Novo ônibus")
                }
            }
        }

        if (isLoading) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        if (!errorMsg.isNullOrBlank()) item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }

        items(buses, key = { it.id }) { bus ->
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(bus.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = "Origem: ${bus.departureLocation ?: "—"} • Chegada: ${bus.arrivalTime ?: "—"}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        if (!bus.driverName.isNullOrBlank()) {
                            Text(
                                text = "Motorista: ${bus.driverName} (${bus.driverPhone ?: "—"})",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Row {
                        IconButton(onClick = { creatingNew = false; editingBus = bus }, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar ${bus.name}")
                        }
                        IconButton(
                            onClick = {
                                scope.launch {
                                    runCatching {
                                        val s = appState.withValidSession()
                                        appState.apiClient.deleteLogisticsBus(s, bus.id)
                                        reload()
                                    }.onFailure { errorMsg = it.message }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(Icons.Default.Delete, contentDescription = "Excluir ${bus.name}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingBus
    if (target != null) {
        var name by remember(target) { mutableStateOf(target.name) }
        var departure by remember(target) { mutableStateOf(target.departureLocation.orEmpty()) }
        var arrival by remember(target) { mutableStateOf(target.arrivalTime.orEmpty()) }
        var driverName by remember(target) { mutableStateOf(target.driverName.orEmpty()) }
        var driverPhone by remember(target) { mutableStateOf(target.driverPhone.orEmpty()) }

        AlertDialog(
            onDismissRequest = { editingBus = null },
            title = { Text(if (creatingNew) "Novo Ônibus / Rota" else "Editar Ônibus") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Identificação do ônibus") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = departure, onValueChange = { departure = it }, label = { Text("Local de partida") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = arrival, onValueChange = { arrival = it }, label = { Text("Previsão de chegada") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = driverName, onValueChange = { driverName = it }, label = { Text("Responsável / Motorista") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = driverPhone, onValueChange = { driverPhone = it }, label = { Text("Telefone") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNew) put("id", target.id)
                                    put("bus_number", name.trim())
                                    put("stake_city", departure.trim())
                                    put("arrival_fsy_time", arrival.trim())
                                    put("driver_name", driverName.trim().ifBlank { null })
                                    put("driver_phone", driverPhone.trim().ifBlank { null })
                                }
                                appState.apiClient.saveLogisticsBus(s, isNew = creatingNew, body = body)
                                editingBus = null
                                reload()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = name.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                TextButton(onClick = { editingBus = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 5. MURAL DE AVISOS (`/api/announcements`)
// =============================================================================

@Composable
fun AnnouncementsAdminModuleView(appState: FsyAppState) {
    val scope = rememberCoroutineScope()
    var editingAnn by remember { mutableStateOf<Announcement?>(null) }
    var creatingNew by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Avisos Publicados (${appState.announcements.size})",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = {
                        creatingNew = true
                        editingAnn = Announcement(id = "", title = "", content = "")
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Novo aviso")
                }
            }
        }

        if (!errorMsg.isNullOrBlank()) item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }

        items(appState.announcements, key = { it.id }) { ann ->
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (ann.isUrgent) {
                                FsyStatusBadge("URGENTE", FsyPalette.Danger, Color.White)
                            }
                            FsyStatusBadge(
                                text = if (ann.companyId != null) "Companhia" else "Global",
                                backgroundColor = FsyPalette.PrimarySky.copy(alpha = 0.14f),
                                contentColor = FsyPalette.PrimarySky
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(ann.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(ann.content, style = MaterialTheme.typography.bodySmall)
                    }
                    Row {
                        IconButton(onClick = { creatingNew = false; editingAnn = ann }, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar ${ann.title}")
                        }
                        IconButton(
                            onClick = {
                                scope.launch {
                                    runCatching {
                                        val s = appState.withValidSession()
                                        appState.apiClient.deleteAnnouncement(s, ann.id)
                                        appState.refreshCoreData()
                                    }.onFailure { errorMsg = it.message }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(Icons.Default.Delete, contentDescription = "Excluir ${ann.title}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingAnn
    if (target != null) {
        var title by remember(target) { mutableStateOf(target.title) }
        var content by remember(target) { mutableStateOf(target.content) }
        var isUrgent by remember(target) { mutableStateOf(target.isUrgent) }

        AlertDialog(
            onDismissRequest = { editingAnn = null },
            title = { Text(if (creatingNew) "Publicar Comunicado" else "Editar Comunicado") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Título") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text("Conteúdo do comunicado") }, minLines = 3, modifier = Modifier.fillMaxWidth())
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Marcar como urgente (envia alerta prioritário)")
                        Switch(checked = isUrgent, onCheckedChange = { isUrgent = it })
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNew) put("id", target.id)
                                    put("title", title.trim())
                                    put("content", content.trim())
                                    put("priority", if (isUrgent) "urgent" else "normal")
                                }
                                appState.apiClient.saveAnnouncement(s, isNew = creatingNew, body = body)
                                editingAnn = null
                                appState.refreshCoreData()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = title.isNotBlank() && content.isNotBlank(),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Publicar") }
            },
            dismissButton = {
                TextButton(onClick = { editingAnn = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 6. MÍDIAS (`/api/media?all=true`)
// =============================================================================

@Composable
fun MediaAdminModuleView(appState: FsyAppState) {
    val scope = rememberCoroutineScope()
    var photos by remember { mutableStateOf<List<MediaPhoto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var editingPhoto by remember { mutableStateOf<MediaPhoto?>(null) }
    var creatingNew by remember { mutableStateOf(false) }

    fun reload() {
        scope.launch {
            isLoading = true
            try {
                val s = appState.withValidSession()
                photos = appState.apiClient.fetchAllMedia(s)
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Álbuns e Mídias (${photos.size})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Button(
                    onClick = {
                        creatingNew = true
                        editingPhoto = MediaPhoto(id = "", title = "", driveUrl = "")
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Nova mídia")
                }
            }
        }

        if (isLoading) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        if (!errorMsg.isNullOrBlank()) item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }

        items(photos, key = { it.id }) { photo ->
            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(photo.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            text = if (photo.visible) "Visível na galeria" else "Oculta",
                            style = MaterialTheme.typography.bodySmall,
                            color = if (photo.visible) FsyPalette.Success else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Row {
                        IconButton(onClick = { creatingNew = false; editingPhoto = photo }, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = "Editar ${photo.title}")
                        }
                        IconButton(
                            onClick = {
                                scope.launch {
                                    runCatching {
                                        val s = appState.withValidSession()
                                        appState.apiClient.deleteMediaPhoto(s, photo.id)
                                        reload()
                                    }.onFailure { errorMsg = it.message }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(Icons.Default.Delete, contentDescription = "Excluir ${photo.title}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingPhoto
    if (target != null) {
        var title by remember(target) { mutableStateOf(target.title) }
        var driveUrl by remember(target) { mutableStateOf(target.driveUrl) }
        var thumbnailUrl by remember(target) { mutableStateOf(target.thumbnailUrl.orEmpty()) }
        var visible by remember(target) { mutableStateOf(target.visible) }

        AlertDialog(
            onDismissRequest = { editingPhoto = null },
            title = { Text(if (creatingNew) "Nova Mídia / Álbum" else "Editar Mídia") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Título") }, modifier = Modifier.fillMaxWidth())

                    OutlinedTextField(value = thumbnailUrl, onValueChange = { thumbnailUrl = it }, label = { Text("URL Miniatura (opcional)") }, modifier = Modifier.fillMaxWidth())
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Visível para todos os participantes")
                        Switch(checked = visible, onCheckedChange = { visible = it })
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val s = appState.withValidSession()
                                val body = buildJsonObject {
                                    if (!creatingNew) put("id", target.id)
                                    put("title", title.trim())
                                    put("drive_url", driveUrl.trim())
                                    put("thumbnail_url", thumbnailUrl.trim().ifBlank { null })
                                    put("visible", visible)
                                }
                                appState.apiClient.saveMediaPhoto(s, isNew = creatingNew, body = body)
                                editingPhoto = null
                                reload()
                                appState.refreshCoreData()
                            } catch (e: Exception) {
                                errorMsg = e.message
                            }
                        }
                    },
                    enabled = title.isNotBlank() && driveUrl.startsWith("https://"),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                TextButton(onClick = { editingPhoto = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 7. AUDITORIA DE CONSELHEIROS (`/api/admin/counselor-audit`)
// =============================================================================

@Composable
fun CounselorAuditAdminModuleView(appState: FsyAppState) {
    var entries by remember { mutableStateOf<List<CounselorAuditEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val s = appState.withValidSession()
            entries = appState.apiClient.fetchCounselorAudit(s)
        } catch (e: Exception) {
            errorMsg = e.message
        } finally {
            isLoading = false
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                text = "Auditoria de Conselheiros (${entries.size})",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }
        if (isLoading) item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        if (!errorMsg.isNullOrBlank()) item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }

        if (entries.isEmpty() && !isLoading) {
            item {
                FsyEmptyStateCard(
                    title = "Nenhum registro de auditoria",
                    description = "As alterações de lemas de companhia e avisos publicados por conselheiros aparecerão aqui."
                )
            }
        } else {
            items(entries, key = { it.id }) { entry ->
                FsySectionCard {
                    Text(
                        text = "${entry.action} • ${entry.createdAt.take(16)}",
                        style = MaterialTheme.typography.labelMedium.merge(TabularTextStyle),
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Conselheiro: ${entry.actorName ?: "—"} (${entry.companyName ?: "—"})",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (!entry.summary.isNullOrBlank()) {
                        Text(
                            text = entry.summary,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}




