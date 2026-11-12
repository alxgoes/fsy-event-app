package br.com.fsyrp2.app.ui.screens.admin

import androidx.compose.runtime.saveable.rememberSaveable

import br.com.fsyrp2.app.ui.components.*

import br.com.fsyrp2.app.ui.icons.FsyIcons

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

// =============================================================================
// 1. CONTAS E PERMISSÕES (`/api/admin/accounts`)
// =============================================================================

@Composable
fun AccountsAdminModuleView(appState: FsyAppState) {
    if (appState.profile == null || appState.profile?.isSuspended == true || !appState.effectiveRole.isManager) return
    SecureScreenEffect()
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()

    var accounts by remember { mutableStateOf<List<AdminAccountRecord>>(emptyList()) }
    var permissions by remember { mutableStateOf<Map<String, List<String>>>(emptyMap()) }
    var metrics by remember { mutableStateOf(AccountListMetrics()) }
    var search by remember { mutableStateOf("") }
    var roleFilter by remember { mutableStateOf("all") }
    var statusFilter by remember { mutableStateOf("all") }
    var page by remember { mutableIntStateOf(1) }
    var totalPages by remember { mutableIntStateOf(1) }

    var isLoading by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf<String?>(null) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var isMutating by remember { mutableStateOf(false) }

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
                permissions = res.permissions
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

                val compactSearch = isCompactActionLayout()
                if (compactSearch) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = search,
                            onValueChange = { search = it },
                            label = { Text("Buscar por nome, e-mail ou ala") },
                            leadingIcon = { Icon(FsyIcons.Search, contentDescription = null) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        FsyButton(
                            onClick = {
                                haptics.tick()
                                page = 1
                                reload()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Text("Buscar")
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = search,
                            onValueChange = { search = it },
                            label = { Text("Buscar por nome, e-mail ou ala") },
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
                            Text("Buscar")
                        }
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
                        "all" to "Todos os cargos",
                        "jovem" to "Jovens",
                        "consultor" to "Consultores",
                        "midia" to "Mídia",
                        "medico" to "Equipe Multidisciplinar",
                        "logistica" to "Logística",
                        "coordenador" to "Coordenadores",
                        "casal_diretor" to "Casal Diretor"
                    )
                    roles.forEach { (key, label) ->
                        FsyFilterChip(
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
            val allowedActions = AccountPermissions.allowedActions(appState.effectiveRole, appState.session?.userId, acc, permissions[acc.id].orEmpty())
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
                        append("Acesso: ${acc.statusLabel}")
                        if (!acc.companyName.isNullOrBlank()) append(" • Companhia: ${acc.companyName}")
                        if (!acc.room.isNullOrBlank()) append(" • Quarto: ${acc.room}")
                        if (!acc.busAssignment.isNullOrBlank()) append(" • Ônibus: ${acc.busAssignment}")
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(10.dp))

                val compactAccountActions = isCompactActionLayout()
                if (compactAccountActions) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (allowedActions.isNotEmpty()) FsyOutlinedButton(
                            onClick = {
                                haptics.tick()
                                errorMsg = null
                                feedback = null
                                selectedAccountForEdit = acc
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.Pencil, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Gerenciar")
                        }

                        FsyOutlinedButton(
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
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.History, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Histórico")
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (allowedActions.isNotEmpty()) FsyOutlinedButton(
                            onClick = {
                                haptics.tick()
                                errorMsg = null
                                feedback = null
                                selectedAccountForEdit = acc
                            },
                            modifier = Modifier
                                .weight(1f)
                                .defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.Pencil, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Gerenciar")
                        }

                        FsyOutlinedButton(
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
                            Icon(FsyIcons.History, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Histórico")
                        }
                    }
                }
            }
        }

        if (totalPages > 1) {
            item {
                val compactPagination = isCompactActionLayout()
                if (compactPagination) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Página $page de $totalPages",
                            style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle)
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FsyOutlinedButton(
                                onClick = { if (page > 1) page-- },
                                enabled = page > 1,
                                modifier = Modifier
                                    .weight(1f)
                                    .defaultMinSize(minHeight = 48.dp)
                            ) { Text("Anterior") }

                            FsyOutlinedButton(
                                onClick = { if (page < totalPages) page++ },
                                enabled = page < totalPages,
                                modifier = Modifier
                                    .weight(1f)
                                    .defaultMinSize(minHeight = 48.dp)
                            ) { Text("Próxima") }
                        }
                    }
                } else {
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
                            text = "Página $page de $totalPages",
                            style = MaterialTheme.typography.labelLarge.merge(TabularTextStyle)
                        )

                        FsyOutlinedButton(
                            onClick = { if (page < totalPages) page++ },
                            enabled = page < totalPages,
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                        ) { Text("Próxima") }
                    }
                }
            }
        }
    }

    val editingAcc = selectedAccountForEdit
    if (editingAcc != null) {
        val allowedActions = AccountPermissions.allowedActions(appState.effectiveRole, appState.session?.userId, editingAcc, permissions[editingAcc.id].orEmpty())
        fun mutate(action: String, message: String, closeAfter: Boolean = true, operation: suspend (UserSession) -> Unit) {
            if (isMutating || action !in allowedActions) return
            isMutating = true
            errorMsg = null
            feedback = null
            scope.launch {
                try {
                    operation(appState.withValidSession())
                    feedback = message
                    if (closeAfter) selectedAccountForEdit = null
                    reload()
                } catch (e: Exception) {
                    errorMsg = e.message ?: "Não foi possível concluir a alteração. Tente novamente."
                } finally { isMutating = false }
            }
        }
        AccountEditDialog(
            account = editingAcc,
            actions = allowedActions,
            actorRole = appState.effectiveRole,
            busy = isMutating,
            errorMessage = errorMsg,
            feedback = feedback,
            onDismiss = { if (!isMutating) selectedAccountForEdit = null },
            onSavePatch = { patchBody ->
                val action = patchBody["action"]?.jsonPrimitive?.contentOrNull.orEmpty()
                mutate(action, if (action == "role") "Cargo alterado." else "Conta de ${editingAcc.fullName} atualizada.") { session ->
                    appState.apiClient.patchAccount(session, editingAcc.id, patchBody)
                }
            },
            onSetPassword = { newPassword ->
                mutate("set_password", "Senha redefinida para ${editingAcc.fullName}.") { session ->
                    appState.apiClient.setAccountPassword(session, editingAcc.id, newPassword)
                }
            },
            onSendRecovery = {
                mutate("recovery_email", "Link de recuperação enviado para ${editingAcc.email}.", false) { session ->
                    appState.apiClient.sendAccountRecovery(session, editingAcc.id)
                }
            },
            onSendEmail = { subject, body ->
                mutate("email", "Mensagem aceita para envio a ${editingAcc.email}.", false) { session ->
                    appState.apiClient.sendAccountEmail(session, editingAcc.id, subject, body)
                }
            },
            onDeleteAccount = { confirmStr ->
                mutate("delete", "Conta excluída.") { session ->
                    appState.apiClient.deleteAccount(session, editingAcc.id, confirmStr)
                }
            }
        )
    }

    val eventsAcc = selectedAccountForEvents
    if (eventsAcc != null) {
        AlertDialog(
            onDismissRequest = { selectedAccountForEvents = null },
            title = { Text("Histórico — ${eventsAcc.fullName}") },
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
                                        text = "${ev.actionLabel} • ${ev.createdAt.take(16)}",
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
                FsyTextButton(
                    onClick = { selectedAccountForEvents = null },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Fechar") }
            }
        )
    }
}

@Composable
internal fun AccountEditDialog(
    account: AdminAccountRecord,
    actions: Set<String>,
    actorRole: UserRole,
    busy: Boolean,
    errorMessage: String?,
    feedback: String?,
    onDismiss: () -> Unit,
    onSavePatch: (kotlinx.serialization.json.JsonObject) -> Unit,
    onSetPassword: (String) -> Unit,
    onSendRecovery: () -> Unit,
    onSendEmail: (String, String) -> Unit,
    onDeleteAccount: (String) -> Unit
) {
    var fullName by remember(account.id) { mutableStateOf(account.fullName) }
    var selectedRoleValue by rememberSaveable(account.id) { mutableStateOf(account.role ?: "jovem") }
    val role = UserRole.fromWire(selectedRoleValue)
    var unit by remember(account.id) { mutableStateOf(account.unit.orEmpty()) }
    var room by remember(account.id) { mutableStateOf(account.room.orEmpty()) }
    var manualPassword by remember { mutableStateOf("") }
    var emailSubject by remember { mutableStateOf("") }
    var emailBody by remember { mutableStateOf("") }
    var deleteConfirm by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }
    val assignableRoles = AccountPermissions.assignableRoles(actorRole, actions)
    val expectedDeleteConfirmation = account.email ?: account.fullName

    AccountEditorDialogFrame(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Gerenciar conta: ${account.fullName}") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (busy) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                feedback?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                if ("edit" in actions) {
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    label = { Text("Nome completo") },
                    enabled = !busy,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = unit,
                    onValueChange = { unit = it },
                    label = { Text("Estaca ou distrito") },
                    enabled = !busy,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = room,
                    onValueChange = { room = it },
                    label = { Text("Quarto") },
                    enabled = !busy,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                }

                if (assignableRoles.isNotEmpty()) {
                    HorizontalDivider()
                    Text("Cargo no portal", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("O cargo define o que a pessoa pode ver e alterar.", style = MaterialTheme.typography.bodySmall)
                    AccountRolePicker(roles = assignableRoles, selected = role, enabled = !busy, onSelected = { selectedRoleValue = it.wireValue })
                    FsyOutlinedButton(
                        onClick = { onSavePatch(buildJsonObject { put("action", "role"); put("role", role.wireValue) }) },
                        enabled = !busy && role in assignableRoles && role.wireValue != account.role,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Aplicar cargo") }
                }
                if ("suspend" in actions || "reactivate" in actions) {
                    HorizontalDivider()
                    FsyOutlinedButton(
                        onClick = { onSavePatch(buildJsonObject { put("action", if (account.suspended) "reactivate" else "suspend") }) },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(if (account.suspended) "Reativar acesso" else "Suspender acesso") }
                }
                if ("set_password" in actions || "recovery_email" in actions) {
                HorizontalDivider()
                Text("Acesso e senha", fontWeight = FontWeight.Bold)
                if ("set_password" in actions) {
                OutlinedTextField(
                    value = manualPassword,
                    onValueChange = { manualPassword = it },
                    label = { Text("Nova senha (8 a 72 caracteres)") },
                    enabled = !busy,
                    visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )
                    FsyOutlinedButton(
                        onClick = { onSetPassword(manualPassword) },
                        enabled = !busy && PasswordPolicy.validate(manualPassword) == null,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(FsyIcons.KeyRound, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Definir senha")
                    }
                }
                if ("recovery_email" in actions) {
                    FsyOutlinedButton(
                        onClick = onSendRecovery,
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Enviar recuperação")
                    }
                }
                }

                if ("email" in actions) {
                HorizontalDivider()
                Text("Enviar e-mail", fontWeight = FontWeight.Bold)
                OutlinedTextField(
                    value = emailSubject,
                    onValueChange = { emailSubject = it },
                    label = { Text("Assunto do e-mail") },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = emailBody,
                    onValueChange = { emailBody = it },
                    label = { Text("Mensagem") },
                    minLines = 2,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth()
                )
                FsyOutlinedButton(
                    onClick = { onSendEmail(emailSubject, emailBody) },
                    enabled = !busy && emailSubject.trim().length in 3..150 && emailBody.trim().length in 10..5000,
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(FsyIcons.Mail, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Enviar mensagem")
                }
                }

                if ("delete" in actions) {
                HorizontalDivider()
                Text("Excluir conta", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                OutlinedTextField(
                    value = deleteConfirm,
                    onValueChange = { deleteConfirm = it },
                    label = { Text("Digite $expectedDeleteConfirmation") },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth()
                )
                FsyOutlinedButton(
                    onClick = { confirmDelete = true },
                    enabled = !busy && deleteConfirm.trim().equals(expectedDeleteConfirmation.trim(), ignoreCase = true),
                    modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                ) {
                    Icon(FsyIcons.Trash2, contentDescription = null, tint = FsyPalette.Danger)
                    Spacer(Modifier.width(6.dp))
                    Text("Excluir conta permanentemente", color = FsyPalette.Danger)
                }
                }
            }
        },
        confirmButton = {
            if ("edit" in actions) FsyButton(
                onClick = {

                    val patch = buildJsonObject {
                        put("action", "edit")
                        put("full_name", fullName.trim())

                        put("stake", unit.trim().ifBlank { null })
                        put("room", room.trim().ifBlank { null })



                    }
                    onSavePatch(patch)
                },
                enabled = !busy && fullName.trim().length in 2..160 && unit.trim().length <= 120 && room.trim().length <= 40,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Salvar dados")
            }
        },
        dismissButton = {
            FsyTextButton(
                onClick = onDismiss,
                enabled = !busy,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) { Text("Fechar") }
        }
    )
    if (confirmDelete) FsyConfirmDialog(
        title = "Excluir esta conta?",
        message = "A conta de ${account.fullName} será excluída permanentemente.",
        confirmLabel = "Excluir conta", busy = busy,
        onConfirm = { confirmDelete = false; onDeleteAccount(deleteConfirm) }, onDismiss = { confirmDelete = false }
    )
}

/** Evita medidas intrínsecas de AlertDialog com campos; título e ações ficam sempre acessíveis. */
@Composable
private fun AccountEditorDialogFrame(
    onDismissRequest: () -> Unit,
    title: @Composable () -> Unit,
    text: @Composable () -> Unit,
    confirmButton: @Composable () -> Unit,
    dismissButton: @Composable () -> Unit
) {
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            securePolicy = androidx.compose.ui.window.SecureFlagPolicy.SecureOn
        )
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 560.dp).fillMaxWidth(0.94f).fillMaxHeight(0.94f),
            color = MaterialTheme.colorScheme.surface,
            shape = FsyCardShape
        ) {
            Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
                CompositionLocalProvider(LocalTextStyle provides MaterialTheme.typography.headlineSmall) { title() }
                Spacer(Modifier.height(16.dp))
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) { text() }
                Spacer(Modifier.height(16.dp))
                Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) {
                    confirmButton()
                    dismissButton()
                }
            }
        }
    }
}

@Composable
internal fun AccountRolePicker(roles: List<UserRole>, selected: UserRole, enabled: Boolean, onSelected: (UserRole) -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().selectableGroup()) {
        roles.forEach { choice ->
            Row(
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)
                    .selectable(selected = choice == selected, enabled = enabled, role = Role.RadioButton, onClick = { onSelected(choice) })
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                RadioButton(selected = choice == selected, enabled = enabled, onClick = null)
                Text(choice.labelPt, modifier = Modifier.weight(1f))
            }
        }
    }
}

// =============================================================================
// 2. COMPANHIAS (`/api/companies`)
// =============================================================================

@Composable
fun CompaniesAdminModuleView(appState: FsyAppState) {
    val context = LocalContext.current
    val confirm = rememberFsyConfirm()
    confirm.Host()
    val haptics = rememberFsyHaptics()
    val scope = rememberCoroutineScope()

    var companies by remember { mutableStateOf<List<Company>>(emptyList()) }
    var counselors by remember { mutableStateOf<List<CounselorSummary>>(emptyList()) }
    var whatsappByCompany by remember { mutableStateOf<Map<String, CompanyWhatsappLink>>(emptyMap()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    var editingCompany by remember { mutableStateOf<Company?>(null) }
    var editingWhatsappCompany by remember { mutableStateOf<Company?>(null) }
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
                val waList = runCatching { appState.apiClient.fetchCompanyWhatsapp(s) }.getOrNull()
                if (waList != null) {
                    whatsappByCompany = waList.associateBy { it.companyId }
                    appState.allCompaniesWhatsapp = waList
                }
            } catch (e: Exception) {
                errorMsg = e.message
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { reload() }

    val withoutCounselorCount = companies.count { comp ->
        val assigned = counselors.any { it.companyId == comp.id }
        val wa = whatsappByCompany[comp.id] ?: appState.allCompaniesWhatsapp.firstOrNull { it.companyId == comp.id }
        !assigned || wa?.hasCounselor == false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            val compactHeader = isCompactActionLayout()
            if (compactHeader) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Companhias (${companies.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            creatingNew = true
                            editingCompany = Company(id = "", name = "")
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Nova companhia")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Companhias (${companies.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    FsyButton(
                        onClick = {
                            haptics.confirm()
                            creatingNew = true
                            editingCompany = Company(id = "", name = "")
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Nova companhia")
                    }
                }
            }
        }

        if (withoutCounselorCount > 0) {
            item {
                Surface(
                    color = FsyPalette.Warning.copy(alpha = 0.16f),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = FsyIcons.TriangleAlert,
                                contentDescription = null,
                                tint = FsyPalette.Warning,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = if (withoutCounselorCount == 1) {
                                    "1 companhia sem consultor"
                                } else {
                                    "$withoutCounselorCount companhias sem consultor"
                                },
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = if (withoutCounselorCount == 1) {
                                "1 companhia ainda está sem consultor designado."
                            } else {
                                "$withoutCounselorCount companhias ainda estão sem consultor designado."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        if (isLoading) {
            item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        }
        if (!errorMsg.isNullOrBlank()) {
            item { Text(errorMsg.orEmpty(), color = MaterialTheme.colorScheme.error) }
        }
        if (!appState.companyWhatsappFeedback.isNullOrBlank()) {
            item {
                Surface(color = FsyPalette.Success.copy(alpha = 0.15f), shape = MaterialTheme.shapes.medium) {
                    Text(appState.companyWhatsappFeedback.orEmpty(), modifier = Modifier.padding(12.dp))
                }
            }
        }

        items(companies, key = { it.id }) { comp ->
            val assignedCounselors = counselors.filter { it.companyId == comp.id }
            val waLink = whatsappByCompany[comp.id] ?: appState.allCompaniesWhatsapp.firstOrNull { it.companyId == comp.id }
            val hasCounselor = assignedCounselors.isNotEmpty() && (waLink?.hasCounselor ?: true)
            val validWhatsappUrl = waLink?.validInviteUrl
            val compactCardActions = isCompactActionLayout()

            FsySectionCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(comp.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        if (!hasCounselor) {
                            FsyStatusBadge(
                                text = "Sem consultor designado",
                                backgroundColor = FsyPalette.Warning.copy(alpha = 0.18f),
                                contentColor = FsyPalette.Warning,
                                icon = FsyIcons.TriangleAlert
                            )
                        }
                        if (!comp.motto.isNullOrBlank()) {
                            Text("Lema: “${comp.motto}”", style = MaterialTheme.typography.bodySmall)
                        }
                        Text(
                            text = buildList {
                                comp.room?.takeIf { it.isNotBlank() }?.let { add("Sala: $it") }
                                add("Consultores: ${assignedCounselors.joinToString { it.fullName }.ifBlank { "Nenhum vinculado" }}")
                            }.joinToString(" · "),
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
                        ) { Icon(FsyIcons.Pencil, contentDescription = "Editar ${comp.name}") }

                        IconButton(
                            onClick = {
                                confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            appState.apiClient.deleteCompany(s, comp.id)
                                            reload()
                                        }.onFailure { errorMsg = it.message }
                                    }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(FsyIcons.Trash2, contentDescription = "Excluir ${comp.name}", tint = FsyPalette.Danger)
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
                Spacer(Modifier.height(10.dp))

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = FsyIcons.MessageCircle,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = "Grupo do WhatsApp",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        FsyStatusBadge(
                            text = if (validWhatsappUrl != null) "Link cadastrado" else "Sem link cadastrado",
                            backgroundColor = if (validWhatsappUrl != null) {
                                FsyPalette.Success.copy(alpha = 0.16f)
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant
                            },
                            contentColor = if (validWhatsappUrl != null) {
                                FsyPalette.Success
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }

                    if (validWhatsappUrl != null) {
                        Text(
                            text = validWhatsappUrl,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    @Composable
                    fun openGroupBtn(modifier: Modifier) {
                        if (validWhatsappUrl != null) {
                            FsyOutlinedButton(
                                onClick = {
                                    haptics.tick()
                                    ExternalUrlLauncher.openWhatsappInvite(context, validWhatsappUrl)
                                },
                                modifier = modifier.defaultMinSize(minHeight = 48.dp)
                            ) {
                                Icon(FsyIcons.ExternalLink, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Abrir grupo")
                            }
                        }
                    }

                    @Composable
                    fun editGroupBtn(modifier: Modifier) {
                        FsyOutlinedButton(
                            onClick = {
                                haptics.tick()
                                appState.clearCompanyWhatsappMessages()
                                editingWhatsappCompany = comp
                            },
                            modifier = modifier.defaultMinSize(minHeight = 48.dp)
                        ) {
                            Icon(FsyIcons.Pencil, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(if (validWhatsappUrl != null) "Trocar link" else "Adicionar link")
                        }
                    }

                    if (compactCardActions || validWhatsappUrl == null) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (validWhatsappUrl != null) {
                                openGroupBtn(Modifier.fillMaxWidth())
                            }
                            editGroupBtn(Modifier.fillMaxWidth())
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            openGroupBtn(Modifier.weight(1f))
                            editGroupBtn(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }

    val waTargetComp = editingWhatsappCompany
    if (waTargetComp != null) {
        val currentWaUrl = (whatsappByCompany[waTargetComp.id]
            ?: appState.allCompaniesWhatsapp.firstOrNull { it.companyId == waTargetComp.id })?.validInviteUrl
        FsyWhatsappLinkDialog(
            companyName = waTargetComp.name,
            currentInviteUrl = currentWaUrl,
            busy = appState.isCompanyWhatsappBusy,
            errorMessage = appState.companyWhatsappError,
            onDismiss = {
                appState.clearCompanyWhatsappMessages()
                editingWhatsappCompany = null
            },
            onSave = { normalizedUrl ->
                haptics.confirm()
                appState.saveCompanyWhatsappLink(waTargetComp.id, normalizedUrl) {
                    editingWhatsappCompany = null
                    reload()
                }
            },
            onRemove = {
                haptics.confirm()
                appState.saveCompanyWhatsappLink(waTargetComp.id, null) {
                    editingWhatsappCompany = null
                    reload()
                }
            }
        )
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
                    Text("Consultores vinculados", fontWeight = FontWeight.Bold)
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
                FsyButton(
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
                FsyTextButton(onClick = { editingCompany = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 3. CRONOGRAMA (`/api/schedule`)
// =============================================================================

@Composable
fun ScheduleAdminModuleView(appState: FsyAppState) {
    val confirm = rememberFsyConfirm()
    confirm.Host()
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
            val compactHeader = isCompactActionLayout()
            if (compactHeader) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "Atividades do Cronograma (${items.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingItem = ScheduleItem(id = "", day = "dia1", startTime = "08:00", endTime = "09:00", title = "")
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Nova atividade")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Atividades do Cronograma (${items.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingItem = ScheduleItem(id = "", day = "dia1", startTime = "08:00", endTime = "09:00", title = "")
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Nova atividade")
                    }
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
                        ) { Icon(FsyIcons.Pencil, contentDescription = "Editar ${item.title}") }
                        IconButton(
                            onClick = {
                                confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            appState.apiClient.deleteScheduleItem(s, item.id)
                                            reload()
                                            appState.refreshCoreData()
                                        }.onFailure { errorMsg = it.message }
                                    }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(FsyIcons.Trash2, contentDescription = "Excluir ${item.title}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingItem
    if (target != null) {
        var dayKey by rememberSaveable(target.id) { mutableStateOf(target.dayKey) }
        var startTime by rememberSaveable(target.id) { mutableStateOf(target.startTime.take(5)) }
        var endTime by rememberSaveable(target.id) { mutableStateOf(target.endTime.take(5)) }
        var title by rememberSaveable(target.id) { mutableStateOf(target.title) }
        var location by rememberSaveable(target.id) { mutableStateOf(target.location.orEmpty()) }
        var category by rememberSaveable(target.id) { mutableStateOf(ScheduleDays.normalizeCategory(target.category)) }
        var description by rememberSaveable(target.id) { mutableStateOf(target.description.orEmpty()) }

        AlertDialog(
            onDismissRequest = { editingItem = null },
            title = { Text(if (creatingNew) "Nova Atividade" else "Editar Atividade") },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Dia da atividade", style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ScheduleDays.keys.forEach { key ->
                            FsyFilterChip(selected = dayKey == key, onClick = { dayKey = key }, label = { Text(ScheduleDays.label(key)) })
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = startTime, onValueChange = { startTime = it }, label = { Text("Início (HH:MM)") }, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = endTime, onValueChange = { endTime = it }, label = { Text("Fim (HH:MM)") }, modifier = Modifier.weight(1f))
                    }
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Título da atividade") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Local") }, modifier = Modifier.fillMaxWidth())
                    Text("Categoria", style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ScheduleDays.categories.forEach { value ->
                            FsyFilterChip(selected = category == value, onClick = { category = value }, label = { Text(value) })
                        }
                    }
                    if (!ScheduleDays.validTimes(startTime, endTime)) Text("Use HH:MM. O fim deve ser depois do início.", color = MaterialTheme.colorScheme.error)
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Descrição") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                FsyButton(
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
                                    put("category", category)
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
                    enabled = title.isNotBlank() && ScheduleDays.validTimes(startTime, endTime),
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) { Text("Salvar") }
            },
            dismissButton = {
                FsyTextButton(onClick = { editingItem = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 4. LOGÍSTICA DE ÔNIBUS (`/api/logistics`)
// =============================================================================

@Composable
fun LogisticsAdminModuleView(appState: FsyAppState) {
    val confirm = rememberFsyConfirm()
    confirm.Host()
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
            val compactHeader = isCompactActionLayout()
            if (compactHeader) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Frota e Transporte (${buses.size})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingBus = LogisticsBus(id = "", busNumber = "", stakeCity = "", driverName = "")
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Novo ônibus")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Frota e Transporte (${buses.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingBus = LogisticsBus(id = "", busNumber = "", stakeCity = "", driverName = "")
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Novo ônibus")
                    }
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
                            Icon(FsyIcons.Pencil, contentDescription = "Editar ${bus.name}")
                        }
                        IconButton(
                            onClick = {
                                confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            appState.apiClient.deleteLogisticsBus(s, bus.id)
                                            reload()
                                        }.onFailure { errorMsg = it.message }
                                    }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(FsyIcons.Trash2, contentDescription = "Excluir ${bus.name}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingBus
    if (target != null) {
        var name by rememberSaveable(target.id) { mutableStateOf(target.name) }
        var departure by rememberSaveable(target.id) { mutableStateOf(target.departureLocation.orEmpty()) }
        var arrival by rememberSaveable(target.id) { mutableStateOf(target.arrivalTime.orEmpty()) }
        var driverName by rememberSaveable(target.id) { mutableStateOf(target.driverName.orEmpty()) }
        var driverPhone by rememberSaveable(target.id) { mutableStateOf(target.driverPhone.orEmpty()) }

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
                FsyButton(
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
                FsyTextButton(onClick = { editingBus = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 5. MURAL DE AVISOS (`/api/announcements`)
// =============================================================================

@Composable
fun AnnouncementsAdminModuleView(appState: FsyAppState) {
    val confirm = rememberFsyConfirm()
    confirm.Host()
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
            val compactHeader = isCompactActionLayout()
            if (compactHeader) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Avisos Publicados (${appState.announcements.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingAnn = Announcement(id = "", title = "", content = "")
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Novo aviso")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Avisos Publicados (${appState.announcements.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingAnn = Announcement(id = "", title = "", content = "")
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Novo aviso")
                    }
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
                                FsyStatusBadge("Urgente", FsyPalette.Danger, MaterialTheme.colorScheme.onError, icon = FsyIcons.TriangleAlert)
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
                            Icon(FsyIcons.Pencil, contentDescription = "Editar ${ann.title}")
                        }
                        IconButton(
                            onClick = {
                                confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            appState.apiClient.deleteAnnouncement(s, ann.id)
                                            appState.refreshCoreData()
                                        }.onFailure { errorMsg = it.message }
                                    }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(FsyIcons.Trash2, contentDescription = "Excluir ${ann.title}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingAnn
    if (target != null) {
        var title by rememberSaveable(target.id) { mutableStateOf(target.title) }
        var content by rememberSaveable(target.id) { mutableStateOf(target.content) }
        var isUrgent by rememberSaveable(target.id) { mutableStateOf(target.isUrgent) }

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
                        Text(
                            "Marcar como urgente (envia alerta prioritário)",
                            modifier = Modifier.weight(1f).padding(end = 8.dp)
                        )
                        FsySwitch(checked = isUrgent, onCheckedChange = { isUrgent = it })
                    }
                }
            },
            confirmButton = {
                FsyButton(
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
                FsyTextButton(onClick = { editingAnn = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
            }
        )
    }
}

// =============================================================================
// 6. MÍDIAS (`/api/media?all=true`)
// =============================================================================

@Composable
fun MediaAdminModuleView(appState: FsyAppState) {
    val confirm = rememberFsyConfirm()
    confirm.Host()
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
            val compactHeader = isCompactActionLayout()
            if (compactHeader) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Álbuns e Mídias (${photos.size})", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingPhoto = MediaPhoto(id = "", title = "", driveUrl = "")
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Nova mídia")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Álbuns e Mídias (${photos.size})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    FsyButton(
                        onClick = {
                            creatingNew = true
                            editingPhoto = MediaPhoto(id = "", title = "", driveUrl = "")
                        },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                    ) {
                        Icon(FsyIcons.Plus, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Nova mídia")
                    }
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
                            Icon(FsyIcons.Pencil, contentDescription = "Editar ${photo.title}")
                        }
                        IconButton(
                            onClick = {
                                confirm.ask("Excluir este registro?", "Esta ação não pode ser desfeita.") {
                                    scope.launch {
                                        runCatching {
                                            val s = appState.withValidSession()
                                            appState.apiClient.deleteMediaPhoto(s, photo.id)
                                            reload()
                                        }.onFailure { errorMsg = it.message }
                                    }
                                }
                            },
                            modifier = Modifier.size(48.dp)
                        ) { Icon(FsyIcons.Trash2, contentDescription = "Excluir ${photo.title}", tint = FsyPalette.Danger) }
                    }
                }
            }
        }
    }

    val target = editingPhoto
    if (target != null) {
        var title by rememberSaveable(target.id) { mutableStateOf(target.title) }
        var driveUrl by rememberSaveable(target.id) { mutableStateOf(target.driveUrl) }
        var thumbnailUrl by rememberSaveable(target.id) { mutableStateOf(target.thumbnailUrl.orEmpty()) }
        var visible by rememberSaveable(target.id) { mutableStateOf(target.visible) }

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
                        Text(
                            "Visível para todos os participantes",
                            modifier = Modifier.weight(1f).padding(end = 8.dp)
                        )
                        FsySwitch(checked = visible, onCheckedChange = { visible = it })
                    }
                }
            },
            confirmButton = {
                FsyButton(
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
                FsyTextButton(onClick = { editingPhoto = null }, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text("Cancelar") }
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
                text = "Auditoria de consultores (${entries.size})",
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
                    description = "Mudanças de lema e avisos dos consultores aparecem aqui."
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
                        text = "Consultor(a): ${entry.actorName ?: "—"} (${entry.companyName ?: "—"})",
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




