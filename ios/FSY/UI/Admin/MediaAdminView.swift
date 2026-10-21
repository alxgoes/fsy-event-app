import SwiftUI

/// Fotos e mídia: registros de links do Drive (GET ?all=true, POST/PUT/DELETE /api/media).
/// A galeria pública do Instagram é outro módulo; aqui é a gestão dos registros do site.
struct MediaAdminView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var items = AdminResource<[MediaRecord]>()
    @State private var search = ""
    @State private var showHidden = true
    @State private var editing: MediaDraft?
    @State private var deleting: MediaRecord?
    @State private var actionError: String?

    private var visible: [MediaRecord] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (items.value ?? []).filter { ($0.visible || showHidden) && (term.isEmpty || "\($0.title) \($0.category)".lowercased().contains(term)) }
    }

    var body: some View {
        List {
            Section {
                Toggle("Mostrar fotos ocultas", isOn: $showHidden).frame(minHeight: 44)
            }
            AdminStatusSection(resource: items) { await load() }
            if let actionError {
                Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) }
            }
            if items.value != nil {
                Section {
                    if visible.isEmpty { AdminEmptyRow(text: "Nenhum registro de foto.", icon: "photo") }
                    ForEach(visible) { item in
                        row(item)
                            .swipeActions {
                                Button("Excluir", role: .destructive) { deleting = item }
                                Button(item.visible ? "Ocultar" : "Mostrar") { Task { await setVisible(item, !item.visible) } }
                                    .tint(FSYPalette.primary)
                            }
                    }
                } header: {
                    Text("\(visible.count) registros")
                } footer: {
                    AdminUpdatedFooter(date: items.updatedAt, isLoading: items.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Fotos e mídia")
        .searchable(text: $search, prompt: "Buscar por título ou categoria")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = MediaDraft() } label: { Label("Novo registro", systemImage: "plus") }
            }
        }
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sheet(item: $editing) { draft in MediaForm(draft: draft) { await load() } }
        .confirmationDialog("Excluir registro?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible, presenting: deleting) { item in
            Button("Excluir “\(item.title)”", role: .destructive) { Task { await delete(item) } }
        } message: { _ in
            Text("Remove o registro do site. O arquivo no Google Drive não é apagado.")
        }
    }

    private func row(_ item: MediaRecord) -> some View {
        HStack(spacing: 12) {
            AsyncImage(url: item.thumbnailURL) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFill()
                default: Image(systemName: "photo").foregroundStyle(FSYPalette.muted)
                }
            }
            .frame(width: 64, height: 64)
            .background(FSYPalette.parchment)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(FSYPalette.border, lineWidth: 1.5))
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(FSYFont.title()).foregroundStyle(FSYPalette.ink).lineLimit(2)
                HStack(spacing: 6) {
                    AdminBadge(text: item.category, color: Color(hex: 0xFDA192))
                    if !item.visible { AdminBadge(text: "Oculta", color: Color(hex: 0xE0E2E2)) }
                }
            }
            Spacer(minLength: 0)
            Menu {
                Button("Editar", systemImage: "pencil") { editing = MediaDraft(item) }
                if let url = URL(string: item.driveURL), url.scheme == "https" {
                    Button("Abrir no Drive", systemImage: "arrow.up.right.square") { openURL(url) }
                }
            } label: {
                Image(systemName: "ellipsis.circle").font(.title3).frame(width: 44, height: 44)
            }
            .accessibilityLabel("Ações de \(item.title)")
        }
        .accessibilityElement(children: .combine)
    }

    private func load() async {
        await items.load {
            let envelope: DataEnvelope<[MediaRecord]> = try await model.portal { api, token in try await api.get("api/media", query: ["all": "true"], token: token) }
            return envelope.data
        }
    }

    private func setVisible(_ item: MediaRecord, _ visible: Bool) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("PUT", "api/media", body: .object(["id": .string(item.id), "visible": .bool(visible)]), token: token)
            }
            await load()
        } catch {
            actionError = adminMessage(error)
        }
    }

    private func delete(_ item: MediaRecord) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/media", query: ["id": item.id], body: nil, token: token)
            }
            await load()
        } catch {
            actionError = adminMessage(error)
        }
    }
}

struct MediaDraft: Identifiable {
    static let categories = ["Geral", "Dia 1", "Dia 2", "Dia 3", "Dia 4", "Dia 5", "Baile", "Show", "Devocional", "Companhias"]

    let id = UUID()
    let recordID: String?
    var title = ""
    var driveURL = ""
    var category = "Geral"
    var visible = true

    init() { recordID = nil }

    init(_ item: MediaRecord) {
        recordID = item.id
        title = item.title
        driveURL = item.driveURL
        category = item.category
        visible = item.visible
    }

    var isValid: Bool {
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty,
              let url = URL(string: driveURL.trimmingCharacters(in: .whitespaces)), url.scheme == "https" else { return false }
        return true
    }

    var body: JSONValue {
        var fields: [String: JSONValue] = [
            "title": .string(title.trimmingCharacters(in: .whitespaces)),
            "drive_url": .string(driveURL.trimmingCharacters(in: .whitespaces)),
            "category": .string(category),
            "visible": .bool(visible),
        ]
        if let recordID { fields["id"] = .string(recordID) }
        return .object(fields)
    }

    var fingerprint: String { "\(title)|\(driveURL)|\(category)|\(visible)" }
}

private struct MediaForm: View {
    @State var draft: MediaDraft
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Novo registro" : "Editar registro",
                       canSave: draft.isValid, isDirty: draft.fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/media", body: body, token: token) }
            await saved()
        } fields: {
            Section {
                AdminField(label: "Título", text: $draft.title)
                AdminField(label: "Link do Google Drive", text: $draft.driveURL, prompt: "https://drive.google.com/file/d/…", keyboard: .URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } footer: {
                Text("A miniatura é gerada pelo servidor a partir do link.")
            }
            Section {
                Picker("Categoria", selection: $draft.category) {
                    ForEach(MediaDraft.categories.contains(draft.category) ? MediaDraft.categories : MediaDraft.categories + [draft.category], id: \.self) { Text($0).tag($0) }
                }
                .frame(minHeight: 44)
                Toggle("Visível no site", isOn: $draft.visible).frame(minHeight: 44)
            }
        }
        .onAppear { original = draft.fingerprint }
    }
}
