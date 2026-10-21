import SwiftUI

/// Auditoria dos consultores (somente leitura): GET /api/admin/counselor-audit.
struct AuditAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var entries = AdminResource<[CounselorAuditEntry]>()
    @State private var search = ""
    @State private var company: String?
    @State private var selected: CounselorAuditEntry?

    private var companies: [(String, String)] {
        var seen: [String: String] = [:]
        for entry in entries.value ?? [] {
            if let id = entry.companyID { seen[id] = entry.companyName ?? id }
        }
        return seen.sorted { $0.value < $1.value }.map { ($0.key, $0.value) }
    }

    private var visible: [CounselorAuditEntry] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (entries.value ?? []).filter { entry in
            (company == nil || entry.companyID == company)
                && (term.isEmpty || "\(entry.authorName) \(entry.actionLabel) \(entry.title ?? "") \(entry.content)".lowercased().contains(term))
        }
    }

    var body: some View {
        List {
            if !companies.isEmpty {
                Section {
                    Picker("Companhia", selection: $company) {
                        Text("Todas as companhias").tag(String?.none)
                        ForEach(companies, id: \.0) { Text($0.1).tag(String?.some($0.0)) }
                    }
                    .frame(minHeight: 44)
                }
            }
            AdminStatusSection(resource: entries) { await load() }
            if entries.value != nil {
                Section {
                    if visible.isEmpty { AdminEmptyRow(text: "Nenhum registro de auditoria.", icon: "list.clipboard") }
                    ForEach(visible) { entry in
                        Button { selected = entry } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    AdminBadge(text: entry.actionLabel, color: Color(hex: 0xB0EEFC))
                                    Spacer()
                                    if let date = entry.createdAt { Text(date.adminDateTime).font(.caption).foregroundStyle(FSYPalette.muted) }
                                }
                                Text(entry.title ?? entry.content).font(FSYFont.title()).foregroundStyle(FSYPalette.ink).lineLimit(2)
                                Text("\(entry.authorName)\(entry.companyName.map { " · \($0)" } ?? "")").font(.caption).foregroundStyle(FSYPalette.muted)
                            }
                            .padding(.vertical, 2)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                    }
                } header: {
                    Text("\(visible.count) registros")
                } footer: {
                    AdminUpdatedFooter(date: entries.updatedAt, isLoading: entries.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Auditoria")
        .searchable(text: $search, prompt: "Buscar consultor ou ação")
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sheet(item: $selected) { entry in
            NavigationStack {
                List {
                    Section("Ação") {
                        LabeledContent("Tipo", value: entry.actionLabel)
                        LabeledContent("Consultor", value: entry.authorName)
                        if let name = entry.companyName { LabeledContent("Companhia", value: name) }
                        if let date = entry.createdAt { LabeledContent("Quando", value: date.adminDateTime) }
                    }
                    if let title = entry.title { Section("Título") { Text(title) } }
                    Section("Conteúdo") { Text(entry.content).textSelection(.enabled) }
                }
                .navigationTitle("Registro")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("OK") { selected = nil } } }
            }
            .presentationDetents([.medium, .large])
        }
    }

    private func load() async {
        await entries.load {
            let envelope: DataEnvelope<[CounselorAuditEntry]> = try await model.portal { api, token in try await api.get("api/admin/counselor-audit", token: token) }
            return envelope.data
        }
    }
}
