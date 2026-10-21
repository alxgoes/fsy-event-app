import SwiftUI

/// Contas e usuários: GET /api/admin/accounts (busca, filtros, páginas) e ações por conta. As ações exibidas
/// são as que o servidor devolve em `permissions`; última conta administrativa e a própria conta continuam
/// protegidas no servidor.
struct AccountsAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var list = AdminResource<AccountList>()
    @State private var companies: [AdminCompany] = []
    @State private var search = ""
    @State private var role: UserRole?
    @State private var status: String?
    @State private var page = 1
    private let perPage = 50

    private var query: [String: String] {
        var values = ["page": "\(page)", "per_page": "\(perPage)"]
        let term = search.trimmingCharacters(in: .whitespaces)
        if !term.isEmpty { values["q"] = String(term.prefix(120)) }
        if let role { values["role"] = role.rawValue }
        if let status { values["status"] = status }
        return values
    }

    var body: some View {
        List {
            Section {
                Picker("Cargo", selection: $role) {
                    Text("Todos os cargos").tag(UserRole?.none)
                    ForEach(UserRole.allCases, id: \.self) { Text($0.label).tag(UserRole?.some($0)) }
                }
                .frame(minHeight: 44)
                Picker("Situação", selection: $status) {
                    Text("Todas").tag(String?.none)
                    Text("Ativas").tag(String?.some("ativo"))
                    Text("Suspensas").tag(String?.some("suspenso"))
                    Text("Aguardando confirmação").tag(String?.some("aguardando_confirmacao"))
                    Text("Sem perfil").tag(String?.some("sem_perfil"))
                }
                .frame(minHeight: 44)
            }
            AdminStatusSection(resource: list) { await load() }
            if let value = list.value {
                Section {
                    if value.data.isEmpty { AdminEmptyRow(text: "Nenhuma conta encontrada.", icon: "person.crop.circle.badge.questionmark") }
                    ForEach(value.data) { account in
                        NavigationLink {
                            AccountDetailView(accountID: account.id, list: list, companies: companies) { await load() }
                        } label: {
                            AccountRow(account: account)
                        }
                    }
                } header: {
                    Text("\(value.total) contas · página \(value.page) de \(max(1, Int(ceil(Double(value.total) / Double(perPage)))))")
                } footer: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Button("Anterior") { page -= 1 }.disabled(page <= 1)
                            Spacer()
                            Button("Próxima") { page += 1 }.disabled(page * perPage >= value.total)
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                        AdminUpdatedFooter(date: list.updatedAt, isLoading: list.isLoading)
                    }
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Contas")
        .searchable(text: $search, prompt: "Nome, e-mail, companhia ou estaca")
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .task(id: "\(search)|\(role?.rawValue ?? "")|\(status ?? "")") {
            // Novo filtro volta à primeira página; a busca espera a digitação parar.
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            if page != 1 { page = 1 } else { await load() }
        }
        .onChange(of: page) { _, _ in Task { await load() } }
        .task { await loadCompanies() }
    }

    private func load() async {
        let query = query
        await list.load { try await model.portal { api, token in try await api.get("api/admin/accounts", query: query, token: token) } }
    }

    private func loadCompanies() async {
        if let payload: CompaniesPayload = try? await model.portal({ api, token in try await api.get("api/companies", token: token) }) {
            companies = payload.companies
        }
    }
}

private struct AccountRow: View {
    let account: AdminAccount

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(account.fullName).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                if account.suspended { Image(systemName: "lock.fill").foregroundStyle(FSYPalette.urgentText).accessibilityLabel("Suspensa") }
            }
            if let email = account.email { Text(email).font(.caption).foregroundStyle(FSYPalette.muted) }
            HStack(spacing: 6) {
                AdminBadge(text: account.role?.label ?? "Sem cargo", color: account.role?.isManager == true ? FSYPalette.sunshine : Color(hex: 0xE0E2E2))
                if account.status != "ativo" { AdminBadge(text: account.statusLabel, color: Color(hex: 0xFDA192)) }
                if let company = account.companyName { Text(company).font(.caption).foregroundStyle(FSYPalette.muted).lineLimit(1) }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

/// Detalhe da conta com as ações permitidas pelo servidor e o histórico administrativo.
private struct AccountDetailView: View {
    let accountID: String
    let list: AdminResource<AccountList>
    let companies: [AdminCompany]
    let changed: () async -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var events = AdminResource<[AccountEvent]>()
    @State private var sheet: AccountSheet?
    @State private var confirming: AccountAction?
    @State private var notice: String?
    @State private var actionError: String?
    @State private var working = false

    private var account: AdminAccount? { list.value?.data.first { $0.id == accountID } }
    private var allowed: Set<AccountAction> { list.value?.permissions[accountID] ?? [] }

    var body: some View {
        List {
            if let account {
                Section {
                    LabeledContent("Cargo", value: account.role?.label ?? "Sem cargo")
                    LabeledContent("Situação", value: account.statusLabel)
                    if let email = account.email { LabeledContent("E-mail", value: email) }
                    LabeledContent("Companhia", value: account.companyName ?? "Sem companhia")
                    if let stake = account.stake { LabeledContent("Estaca", value: stake) }
                    if let room = account.room { LabeledContent("Quarto", value: room) }
                    if let phone = account.phone { LabeledContent("Telefone", value: phone) }
                    LabeledContent("Login", value: account.providers.isEmpty ? "—" : account.providers.map { $0 == "google" ? "Google" : "E-mail e senha" }.joined(separator: ", "))
                    if let last = account.lastSignInAt { LabeledContent("Último acesso", value: last.adminDateTime) }
                }

                if let notice { Section { Label(notice, systemImage: "checkmark.circle.fill").foregroundStyle(FSYPalette.primary) } }
                if let actionError { Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) } }

                Section("Ações") {
                    if allowed.isEmpty { AdminEmptyRow(text: "Nenhuma ação disponível para esta conta.", icon: "lock") }
                    if allowed.contains(.edit) { action("Editar dados", "pencil") { sheet = .edit(account) } }
                    if allowed.contains(.role) { action("Alterar cargo", "person.badge.key") { sheet = .role(account) } }
                    if allowed.contains(.recoveryEmail), account.email != nil { action("Enviar link de nova senha", "envelope.badge") { confirming = .recoveryEmail } }
                    if allowed.contains(.setPassword) { action("Definir senha", "key.fill") { sheet = .password } }
                    if allowed.contains(.email), account.email != nil { action("Enviar e-mail", "envelope.fill") { sheet = .email } }
                    if account.suspended {
                        if allowed.contains(.reactivate) { action("Reativar acesso", "lock.open.fill") { confirming = .reactivate } }
                    } else if allowed.contains(.suspend) {
                        action("Suspender acesso", "lock.fill", destructive: true) { confirming = .suspend }
                    }
                    if allowed.contains(.delete) { action("Excluir conta", "trash", destructive: true) { sheet = .delete(account) } }
                }

                Section("Histórico administrativo") {
                    if let items = events.value, items.isEmpty { AdminEmptyRow(text: "Sem registros.", icon: "clock") }
                    ForEach(events.value ?? []) { event in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.actionLabel).font(.subheadline.weight(.semibold))
                            Text("\(event.actorName)\(event.createdAt.map { " · \($0.adminDateTime)" } ?? "")").font(.caption).foregroundStyle(FSYPalette.muted)
                        }
                        .accessibilityElement(children: .combine)
                    }
                    if let error = events.error { Text(error).font(.caption).foregroundStyle(FSYPalette.urgentText) }
                }
            } else {
                AdminEmptyRow(text: "Esta conta não está mais na lista. Volte e atualize.", icon: "person.crop.circle.badge.xmark")
            }
        }
        .adminListStyle()
        .navigationTitle(account?.fullName ?? "Conta")
        .navigationBarTitleDisplayMode(.inline)
        .disabled(working)
        .task { await loadEvents() }
        .sheet(item: $sheet) { sheet in
            AccountActionSheet(sheet: sheet, accountID: accountID, companies: companies) { message in
                notice = message
                await refreshAll()
            }
        }
        .confirmationDialog(confirmTitle, isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }), titleVisibility: .visible) {
            if let confirming {
                Button(confirmButton(confirming), role: confirming == .suspend ? .destructive : nil) { Task { await run(confirming) } }
            }
        } message: {
            Text(confirmMessage)
        }
    }

    private func action(_ title: String, _ icon: String, destructive: Bool = false, _ perform: @escaping () -> Void) -> some View {
        Button(role: destructive ? .destructive : nil, action: perform) {
            Label(title, systemImage: icon)
        }
        .frame(minHeight: 44)
    }

    private var confirmTitle: String {
        switch confirming {
        case .suspend: "Suspender acesso?"
        case .reactivate: "Reativar acesso?"
        case .recoveryEmail: "Enviar link de nova senha?"
        default: ""
        }
    }

    private var confirmMessage: String {
        switch confirming {
        case .suspend: "A pessoa sai do site e do app na próxima ação e não consegue entrar até ser reativada."
        case .reactivate: "A pessoa volta a entrar com o mesmo cargo."
        case .recoveryEmail: "Um e-mail com link para criar nova senha será enviado para \(account?.email ?? "a conta")."
        default: ""
        }
    }

    private func confirmButton(_ action: AccountAction) -> String {
        switch action {
        case .suspend: "Suspender"
        case .reactivate: "Reativar"
        default: "Enviar"
        }
    }

    private func run(_ action: AccountAction) async {
        working = true
        actionError = nil
        notice = nil
        defer { working = false }
        do {
            switch action {
            case .suspend, .reactivate:
                let _: Acknowledgement = try await model.portal { api, token in
                    try await api.send("PATCH", "api/admin/accounts/\(accountID)", body: .object(["action": .string(action.rawValue)]), token: token)
                }
                notice = action == .suspend ? "Acesso suspenso." : "Acesso reativado."
            case .recoveryEmail:
                let _: Acknowledgement = try await model.portal { api, token in
                    try await api.send("POST", "api/admin/accounts/\(accountID)/recovery", body: .object([:]), token: token)
                }
                notice = "Link enviado. Confira também o spam."
            default:
                return
            }
            await refreshAll()
        } catch {
            actionError = adminMessage(error)
        }
    }

    private func refreshAll() async {
        await changed()
        await loadEvents()
        if account == nil { dismiss() }
    }

    private func loadEvents() async {
        await events.load {
            let envelope: DataEnvelope<[AccountEvent]> = try await model.portal { api, token in try await api.get("api/admin/accounts/\(accountID)", token: token) }
            return envelope.data
        }
    }
}

private enum AccountSheet: Identifiable {
    case edit(AdminAccount), role(AdminAccount), password, email, delete(AdminAccount)

    var id: String {
        switch self {
        case .edit: "edit"
        case .role: "role"
        case .password: "password"
        case .email: "email"
        case .delete: "delete"
        }
    }
}

/// Formulários das ações de conta. Fecham só depois da confirmação do servidor.
private struct AccountActionSheet: View {
    let sheet: AccountSheet
    let accountID: String
    let companies: [AdminCompany]
    let done: (String) async -> Void

    @Environment(AppModel.self) private var model
    @State private var fullName = ""
    @State private var companyID: String?
    @State private var stake = ""
    @State private var room = ""
    @State private var phone = ""
    @State private var role: UserRole = .jovem
    @State private var password = ""
    @State private var subject = ""
    @State private var message = ""
    @State private var confirmSend = false
    @State private var confirmation = ""
    @State private var loaded = false

    var body: some View {
        switch sheet {
        case .edit(let account):
            AdminFormSheet(title: "Editar dados", canSave: fullName.trimmingCharacters(in: .whitespaces).count >= 2) {
                let body: JSONValue = .object([
                    "action": .string("edit"), "full_name": .string(fullName.trimmingCharacters(in: .whitespaces)),
                    "company_id": companyID.map(JSONValue.string) ?? .null,
                    "stake": .text(stake), "room": .text(room), "phone": .text(phone),
                ])
                try await patch(body)
                await done("Dados atualizados.")
            } fields: {
                Section("Pessoa") {
                    AdminField(label: "Nome completo", text: $fullName)
                    AdminField(label: "Estaca", text: $stake)
                    AdminField(label: "Telefone", text: $phone, keyboard: .phonePad)
                }
                Section("Sessão") {
                    Picker("Companhia", selection: $companyID) {
                        Text("Sem companhia").tag(String?.none)
                        ForEach(companies) { Text($0.name).tag(String?.some($0.id)) }
                    }
                    .frame(minHeight: 44)
                    AdminField(label: "Quarto", text: $room)
                }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                fullName = account.fullName
                companyID = account.companyID
                stake = account.stake ?? ""
                room = account.room ?? ""
                phone = account.phone ?? ""
            }
        case .role(let account):
            AdminFormSheet(title: "Alterar cargo", canSave: role != account.role) {
                try await patch(.object(["action": .string("role"), "role": .string(role.rawValue)]))
                await done("Cargo alterado para \(role.label).")
            } fields: {
                Section {
                    Picker("Cargo", selection: $role) {
                        ForEach(UserRole.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } footer: {
                    Text("O cargo define o que a pessoa vê no site e no app. Gestão: Logística, Coordenação e Casal Diretor.")
                }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                role = account.role ?? .jovem
            }
        case .password:
            AdminFormSheet(title: "Definir senha", canSave: PasswordPolicy.problem(password) == nil) {
                let _: Acknowledgement = try await model.portal { api, token in
                    try await api.send("POST", "api/admin/accounts/\(accountID)/password", body: .object(["password": .string(password)]), token: token)
                }
                await done("Senha definida. Informe a pessoa por um canal seguro.")
            } fields: {
                Section {
                    SecureField("Nova senha", text: $password)
                        .textContentType(.newPassword)
                        .frame(minHeight: 44)
                } footer: {
                    Text(PasswordPolicy.problem(password) ?? "Senha válida.")
                }
            }
        case .email:
            AdminFormSheet(title: "Enviar e-mail", saveLabel: "Enviar",
                           canSave: subject.trimmingCharacters(in: .whitespaces).count >= 3 && message.trimmingCharacters(in: .whitespaces).count >= 10 && confirmSend) {
                let _: Acknowledgement = try await model.portal { api, token in
                    try await api.send("POST", "api/admin/accounts/\(accountID)/email", body: .object([
                        "subject": .string(subject.trimmingCharacters(in: .whitespaces)),
                        "body": .string(message.trimmingCharacters(in: .whitespacesAndNewlines)),
                        "confirm": .bool(true),
                    ]), token: token)
                }
                await done("E-mail enviado.")
            } fields: {
                Section("Mensagem") {
                    AdminField(label: "Assunto", text: $subject)
                    AdminField(label: "Texto", text: $message, axis: .vertical)
                }
                Section {
                    Toggle("Confirmo o envio para esta conta", isOn: $confirmSend).frame(minHeight: 44)
                }
            }
        case .delete(let account):
            AdminFormSheet(title: "Excluir conta", saveLabel: "Excluir", canSave: !confirmation.trimmingCharacters(in: .whitespaces).isEmpty) {
                let _: Acknowledgement = try await model.portal { api, token in
                    try await api.send("DELETE", "api/admin/accounts/\(accountID)", body: .object(["confirm": .string(confirmation.trimmingCharacters(in: .whitespaces))]), token: token)
                }
                await done("Conta excluída.")
            } fields: {
                Section {
                    Text("A exclusão é definitiva e vale para o site e o app. Registros de saúde e comunicados são preservados conforme as regras do portal.")
                        .font(.subheadline)
                    AdminField(label: "Digite o e-mail da conta para confirmar", text: $confirmation, prompt: account.email ?? "e-mail")
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                }
            }
        }
    }

    private func patch(_ body: JSONValue) async throws {
        let _: Acknowledgement = try await model.portal { api, token in
            try await api.send("PATCH", "api/admin/accounts/\(accountID)", body: body, token: token)
        }
    }
}
