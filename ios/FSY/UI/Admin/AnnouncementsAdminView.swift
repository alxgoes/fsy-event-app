import SwiftUI

/// Comunicados: GET/POST/PUT/DELETE /api/announcements. Gestão publica para todos ou por companhia;
/// consultor publica e remove apenas na própria companhia (regra conferida no servidor).
struct AnnouncementsAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var items = AdminResource<[Announcement]>()
    @State private var companies: [AdminCompany] = []
    @State private var search = ""
    @State private var priority: AnnouncementPriority?
    @State private var editing: AnnouncementDraft?
    @State private var deleting: Announcement?
    @State private var actionError: String?

    private var visible: [Announcement] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (items.value ?? []).filter { item in
            (priority == nil || item.priority == priority)
                && (term.isEmpty || "\(item.title) \(item.content) \(item.category)".lowercased().contains(term))
        }
    }

    var body: some View {
        List {
            Section {
                Picker("Prioridade", selection: $priority) {
                    Text("Todas").tag(AnnouncementPriority?.none)
                    Text("Urgentes").tag(AnnouncementPriority?.some(.urgent))
                    Text("Importantes").tag(AnnouncementPriority?.some(.important))
                    Text("Normais").tag(AnnouncementPriority?.some(.normal))
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)
            AdminStatusSection(resource: items) { await load() }
            if let actionError {
                Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) }
            }
            if items.value != nil {
                Section {
                    if visible.isEmpty { AdminEmptyRow(text: "Nenhum comunicado encontrado.", icon: "megaphone") }
                    ForEach(visible) { item in
                        Button { editing = AnnouncementDraft(item) } label: { row(item) }
                            .buttonStyle(.plain)
                            .swipeActions { Button("Excluir", role: .destructive) { deleting = item } }
                    }
                } header: {
                    Text("\(visible.count) comunicados")
                } footer: {
                    AdminUpdatedFooter(date: items.updatedAt, isLoading: items.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Comunicados")
        .searchable(text: $search, prompt: "Buscar comunicado")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = AnnouncementDraft(company: model.role == .consultor ? model.profile?.companyID : nil) } label: {
                    Label("Novo comunicado", systemImage: "square.and.pencil")
                }
            }
        }
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .task { await loadCompanies() }
        .sheet(item: $editing) { draft in
            AnnouncementForm(draft: draft, companies: companies, lockedCompany: model.role == .consultor ? model.profile?.companyID : nil) {
                await load()
                await model.refresh(.manual)
            }
        }
        .confirmationDialog("Excluir comunicado?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible, presenting: deleting) { item in
            Button("Excluir “\(item.title)”", role: .destructive) { Task { await delete(item) } }
        } message: { _ in
            Text("O comunicado sai do site e do app para todos.")
        }
    }

    private func row(_ item: Announcement) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                AdminBadge(text: item.priority.label, color: item.priority == .urgent ? FSYPalette.urgent : (item.priority == .important ? FSYPalette.sunshine : Color(hex: 0xE0E2E2)),
                           ink: item.priority == .urgent ? .white : FSYPalette.fixedInk)
                Text(item.category).font(.caption).foregroundStyle(FSYPalette.muted)
                Spacer()
                if let date = item.createdAt { Text(date.adminDateTime).font(.caption).foregroundStyle(FSYPalette.muted) }
            }
            Text(item.title).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
            Text(item.content).font(.subheadline).foregroundStyle(FSYPalette.muted).lineLimit(3)
            Text(target(item.targetCompanyID)).font(.caption.weight(.semibold)).foregroundStyle(FSYPalette.link)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Toque para editar")
    }

    private func target(_ id: String?) -> String {
        guard let id else { return "Para toda a sessão" }
        return "Para \(companies.first { $0.id == id }?.name ?? id)"
    }

    private func load() async {
        await items.load {
            let envelope: DataEnvelope<[Announcement]> = try await model.portal { api, token in try await api.get("api/announcements", token: token) }
            return envelope.data
        }
    }

    private func loadCompanies() async {
        if let payload: CompaniesPayload = try? await model.portal({ api, token in try await api.get("api/companies", token: token) }) {
            companies = payload.companies
        }
    }

    private func delete(_ item: Announcement) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/announcements", query: ["id": item.id], body: nil, token: token)
            }
            await load()
            await model.refresh(.manual)
        } catch {
            actionError = adminMessage(error)
        }
    }
}

extension AnnouncementPriority {
    var label: String {
        switch self {
        case .urgent: "Urgente"
        case .important: "Importante"
        case .normal: "Normal"
        }
    }

    var apiValue: String {
        switch self {
        case .urgent: "urgent"
        case .important: "important"
        case .normal: "normal"
        }
    }
}

struct AnnouncementDraft: Identifiable {
    static let categories = ["Geral", "Programação", "Logística", "Saúde", "Espiritual", "Companhias", "Mídia"]

    let id = UUID()
    let recordID: String?
    var title = ""
    var content = ""
    var priority: AnnouncementPriority = .normal
    var category = "Geral"
    var company: String?

    init(company: String?) {
        recordID = nil
        self.company = company
    }

    init(_ item: Announcement) {
        recordID = item.id
        title = item.title
        content = item.content
        priority = item.priority
        category = item.category
        company = item.targetCompanyID
    }

    var isValid: Bool {
        title.trimmingCharacters(in: .whitespaces).count >= 2 && content.trimmingCharacters(in: .whitespaces).count >= 2
    }

    var body: JSONValue {
        var fields: [String: JSONValue] = [
            "title": .string(title.trimmingCharacters(in: .whitespacesAndNewlines)),
            "content": .string(content.trimmingCharacters(in: .whitespacesAndNewlines)),
            "priority": .string(priority.apiValue),
            "category": .string(category),
            "target_company_id": company.map(JSONValue.string) ?? .null,
        ]
        if let recordID { fields["id"] = .string(recordID) }
        return .object(fields)
    }

    var fingerprint: String { "\(title)|\(content)|\(priority)|\(category)|\(company ?? "")" }
}

private struct AnnouncementForm: View {
    @State var draft: AnnouncementDraft
    let companies: [AdminCompany]
    let lockedCompany: String?
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Novo comunicado" : "Editar comunicado",
                       saveLabel: draft.recordID == nil ? "Publicar" : "Salvar",
                       canSave: draft.isValid, isDirty: draft.fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/announcements", body: body, token: token) }
            await saved()
        } fields: {
            Section("Comunicado") {
                AdminField(label: "Título", text: $draft.title)
                AdminField(label: "Mensagem", text: $draft.content, axis: .vertical)
            }
            Section("Classificação") {
                Picker("Prioridade", selection: $draft.priority) {
                    Text("Normal").tag(AnnouncementPriority.normal)
                    Text("Importante").tag(AnnouncementPriority.important)
                    Text("Urgente").tag(AnnouncementPriority.urgent)
                }
                .pickerStyle(.segmented)
                Picker("Categoria", selection: $draft.category) {
                    ForEach(categoryOptions, id: \.self) { Text($0).tag($0) }
                }
                .frame(minHeight: 44)
                Picker("Destino", selection: $draft.company) {
                    if lockedCompany == nil { Text("Toda a sessão").tag(String?.none) }
                    ForEach(companies.filter { lockedCompany == nil || $0.id == lockedCompany }) { Text($0.name).tag(String?.some($0.id)) }
                }
                .frame(minHeight: 44)
            }
        }
        .onAppear { original = draft.fingerprint }
    }

    private var categoryOptions: [String] {
        AnnouncementDraft.categories.contains(draft.category) ? AnnouncementDraft.categories : AnnouncementDraft.categories + [draft.category]
    }
}
