import SwiftUI

/// Companhias e vínculos: GET/POST/PUT/DELETE /api/companies (gestão). Companhia e consultores vinculados
/// são gravados juntos pelo servidor numa única transação.
struct CompaniesAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var payload = AdminResource<CompaniesPayload>()
    @State private var search = ""
    @State private var editing: CompanyDraft?
    @State private var deleting: AdminCompany?
    @State private var actionError: String?

    private var visible: [AdminCompany] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (payload.value?.companies ?? []).filter { term.isEmpty || "\($0.name) \($0.id) \($0.motto ?? "")".lowercased().contains(term) }
    }

    var body: some View {
        List {
            AdminStatusSection(resource: payload) { await load() }
            if let actionError {
                Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) }
            }
            if payload.value != nil {
                Section {
                    if visible.isEmpty { AdminEmptyRow(text: "Nenhuma companhia encontrada.", icon: "shield") }
                    ForEach(visible) { company in
                        Button { editing = CompanyDraft(company) } label: { row(company) }
                            .buttonStyle(.plain)
                            .swipeActions { Button("Excluir", role: .destructive) { deleting = company } }
                    }
                } header: {
                    Text("\(visible.count) companhias")
                } footer: {
                    AdminUpdatedFooter(date: payload.updatedAt, isLoading: payload.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Companhias")
        .searchable(text: $search, prompt: "Buscar companhia")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = CompanyDraft() } label: { Label("Nova companhia", systemImage: "plus") }
            }
        }
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sheet(item: $editing) { draft in
            CompanyForm(draft: draft, counselors: payload.value?.allCounselors ?? []) { await load(); await model.refresh(.manual) }
        }
        .confirmationDialog("Excluir companhia?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible, presenting: deleting) { company in
            Button("Excluir \(company.name)", role: .destructive) { Task { await delete(company) } }
        } message: { company in
            Text("\(company.youthCount ?? 0) participantes ficarão sem companhia no site e no app.")
        }
    }

    private func row(_ company: AdminCompany) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(company.hexColor.map { Color(hex: $0) } ?? FSYPalette.muted)
                .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: 1.5))
                .frame(width: 28, height: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(company.name).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                if let motto = company.motto, !motto.isEmpty {
                    Text("“\(motto)”").font(.subheadline.italic()).foregroundStyle(FSYPalette.ink).lineLimit(2)
                }
                Text(company.counselorNames.isEmpty ? "Sem consultores" : company.counselorNames.joined(separator: ", "))
                    .font(.caption).foregroundStyle(FSYPalette.muted)
                if let youth = company.youthCount {
                    AdminBadge(text: "\(youth) participantes", color: FSYPalette.blueSky)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Toque para editar")
    }

    private func load() async {
        await payload.load { try await model.portal { api, token in try await api.get("api/companies", token: token) } }
    }

    private func delete(_ company: AdminCompany) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/companies", query: ["id": company.id], body: nil, token: token)
            }
            await load()
            await model.refresh(.manual)
        } catch {
            actionError = adminMessage(error)
        }
    }
}

struct CompanyDraft: Identifiable {
    let id = UUID()
    let recordID: String?
    var slug = ""
    var name = ""
    var motto = ""
    var color = Color(hex: 0x007DA5)
    var counselorIDs: Set<String> = []

    init() { recordID = nil }

    init(_ company: AdminCompany) {
        recordID = company.id
        slug = company.id
        name = company.name
        motto = company.motto ?? ""
        if let hex = company.hexColor { color = Color(hex: hex) }
        counselorIDs = Set(company.counselorProfiles.map(\.id))
    }

    var isValid: Bool { name.trimmingCharacters(in: .whitespaces).count >= 2 }

    var hex: String {
        let components = UIColor(color).cgColor.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components ?? [0, 0, 0, 1]
        let value = components.prefix(3).map { Int((max(0, min(1, $0)) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", value[0], value[1], value.count > 2 ? value[2] : 0)
    }

    var body: JSONValue {
        var fields: [String: JSONValue] = [
            "name": .string(name.trimmingCharacters(in: .whitespaces)),
            "motto": .text(motto),
            "color": .string(hex),
            "counselor_ids": .array(counselorIDs.sorted().map(JSONValue.string)),
        ]
        if let recordID {
            fields["id"] = .string(recordID)
        } else if !slug.trimmingCharacters(in: .whitespaces).isEmpty {
            fields["id"] = .string(slug.trimmingCharacters(in: .whitespaces))
        }
        return .object(fields)
    }

    var fingerprint: String { "\(slug)|\(name)|\(motto)|\(hex)|\(counselorIDs.sorted())" }
}

private struct CompanyForm: View {
    @State var draft: CompanyDraft
    let counselors: [AdminCompany.Counselor]
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Nova companhia" : draft.name,
                       canSave: draft.isValid, isDirty: draft.fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/companies", body: body, token: token) }
            await saved()
        } fields: {
            Section("Companhia") {
                AdminField(label: "Nome", text: $draft.name, prompt: "ex.: Companhia 1 - Néfi")
                if draft.recordID == nil {
                    AdminField(label: "Identificador (opcional)", text: $draft.slug, prompt: "ex.: cia-1")
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                AdminField(label: "Lema", text: $draft.motto, axis: .vertical)
                ColorPicker("Cor", selection: $draft.color, supportsOpacity: false).frame(minHeight: 44)
            }
            Section {
                if counselors.isEmpty {
                    Text("Nenhuma conta com cargo de consultor.").foregroundStyle(FSYPalette.muted)
                }
                ForEach(counselors) { counselor in
                    Button {
                        if draft.counselorIDs.contains(counselor.id) { draft.counselorIDs.remove(counselor.id) } else { draft.counselorIDs.insert(counselor.id) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(counselor.fullName).foregroundStyle(FSYPalette.ink)
                                if let other = counselor.companyID, other != draft.recordID {
                                    Text("Hoje em \(other)").font(.caption).foregroundStyle(FSYPalette.muted)
                                }
                            }
                            Spacer()
                            if draft.counselorIDs.contains(counselor.id) {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(FSYPalette.primary)
                            }
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .accessibilityAddTraits(draft.counselorIDs.contains(counselor.id) ? .isSelected : [])
                }
            } header: {
                Text("Consultores vinculados")
            } footer: {
                Text("Selecionar move o consultor para esta companhia no site e no app.")
            }
        }
        .onAppear { original = draft.fingerprint }
    }
}
