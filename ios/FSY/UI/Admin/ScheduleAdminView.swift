import SwiftUI

/// Programação: GET/POST/PUT/DELETE /api/schedule (gestão). Também atualiza a Agenda do próprio app.
struct ScheduleAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var items = AdminResource<[ScheduleItem]>()
    @State private var day = "dia1"
    @State private var search = ""
    @State private var editing: ScheduleDraft?
    @State private var deleting: ScheduleItem?
    @State private var actionError: String?

    private var visible: [ScheduleItem] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (items.value ?? [])
            .filter { $0.day == day }
            .filter { term.isEmpty || "\($0.title) \($0.location)".lowercased().contains(term) }
            .sorted { $0.startTime < $1.startTime }
    }

    var body: some View {
        List {
            Section {
                Picker("Dia", selection: $day) {
                    ForEach(ScheduleDays.keys, id: \.self) { Text(ScheduleDays.label($0)).tag($0) }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Dia da programação")
            }
            .listRowBackground(Color.clear)
            AdminStatusSection(resource: items) { await load() }
            if let actionError {
                Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) }
            }
            if items.value != nil {
                Section {
                    if visible.isEmpty { AdminEmptyRow(text: "Nenhuma atividade neste dia.", icon: "calendar") }
                    ForEach(visible) { item in
                        Button { editing = ScheduleDraft(item) } label: { ScheduleAdminRow(item: item) }
                            .buttonStyle(.plain)
                            .swipeActions {
                                Button("Excluir", role: .destructive) { deleting = item }
                            }
                    }
                } header: {
                    Text("\(ScheduleDays.label(day)) · \(visible.count) atividades")
                } footer: {
                    AdminUpdatedFooter(date: items.updatedAt, isLoading: items.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Programação")
        .searchable(text: $search, prompt: "Buscar atividade ou local")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = ScheduleDraft(day: day) } label: { Label("Nova atividade", systemImage: "plus") }
            }
        }
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sensoryFeedback(.selection, trigger: day)
        .sheet(item: $editing) { draft in
            ScheduleForm(draft: draft) { await load(); await model.refresh(.manual) }
        }
        .confirmationDialog("Excluir atividade?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible, presenting: deleting) { item in
            Button("Excluir \(item.title)", role: .destructive) { Task { await delete(item) } }
        } message: { item in
            Text("\(ScheduleDays.label(item.day)) às \(item.startTime). Some também da agenda do site e do app.")
        }
    }

    private func load() async {
        await items.load {
            let envelope: DataEnvelope<[ScheduleItem]> = try await model.portal { api, token in try await api.get("api/schedule", token: token) }
            return envelope.data
        }
    }

    private func delete(_ item: ScheduleItem) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/schedule", query: ["id": item.id], body: nil, token: token)
            }
            await load()
            await model.refresh(.manual)
        } catch {
            actionError = adminMessage(error)
        }
    }
}

private struct ScheduleAdminRow: View {
    let item: ScheduleItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 2) {
                Text(item.startTime).font(.subheadline.weight(.bold).monospacedDigit())
                if item.endTime != "--", !item.endTime.isEmpty {
                    Text(item.endTime).font(.caption.monospacedDigit()).foregroundStyle(FSYPalette.muted)
                }
            }
            .frame(width: 52)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(item.title).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                    if item.isHighlight { Image(systemName: "star.fill").foregroundStyle(Color(hex: 0xFFB81C)).accessibilityLabel("Destaque") }
                }
                Text(item.location).font(.caption).foregroundStyle(FSYPalette.muted)
                AdminBadge(text: item.category, color: CategoryStyle.color(item.category))
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Toque para editar")
    }
}

struct ScheduleDraft: Identifiable {
    let id = UUID()
    let recordID: String?
    var title = ""
    var day: String
    var start = EventCalendar.date(day: "2027-02-06", time: "08:00") ?? Date()
    var hasEnd = true
    var end = EventCalendar.date(day: "2027-02-06", time: "09:00") ?? Date()
    var location = ""
    var category = "Atividade"
    var description = ""
    var highlight = false

    init(day: String) {
        recordID = nil
        self.day = day
    }

    init(_ item: ScheduleItem) {
        recordID = item.id
        title = item.title
        day = item.day
        if let start = item.start { self.start = start }
        if let end = item.end { self.end = end } else { hasEnd = false }
        location = item.location
        category = item.category
        description = item.description ?? ""
        highlight = item.isHighlight
    }

    var isValid: Bool {
        title.trimmingCharacters(in: .whitespaces).count >= 2 && location.trimmingCharacters(in: .whitespaces).count >= 2
    }

    var body: JSONValue {
        var fields: [String: JSONValue] = [
            "title": .string(title.trimmingCharacters(in: .whitespaces)),
            "day": .string(day),
            "start_time": .string(EventCalendar.timeString(start)),
            "end_time": .string(hasEnd ? EventCalendar.timeString(end) : "--"),
            "location": .string(location.trimmingCharacters(in: .whitespaces)),
            "category": .string(category),
            "description": .text(description),
            "is_highlight": .bool(highlight),
        ]
        if let recordID { fields["id"] = .string(recordID) }
        return .object(fields)
    }

    var fingerprint: String {
        "\(title)|\(day)|\(EventCalendar.timeString(start))|\(hasEnd)|\(EventCalendar.timeString(end))|\(location)|\(category)|\(description)|\(highlight)"
    }
}

private struct ScheduleForm: View {
    @State var draft: ScheduleDraft
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Nova atividade" : "Editar atividade",
                       canSave: draft.isValid, isDirty: draft.fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/schedule", body: body, token: token) }
            await saved()
        } fields: {
            Section("Atividade") {
                AdminField(label: "Título", text: $draft.title)
                AdminField(label: "Local", text: $draft.location)
                Picker("Categoria", selection: $draft.category) {
                    ForEach(ScheduleDays.categories, id: \.self) { Text($0).tag($0) }
                }
                .frame(minHeight: 44)
                Toggle("Destaque", isOn: $draft.highlight).frame(minHeight: 44)
            }
            Section("Quando") {
                Picker("Dia", selection: $draft.day) {
                    ForEach(ScheduleDays.keys, id: \.self) { Text(ScheduleDays.label($0)).tag($0) }
                }
                .frame(minHeight: 44)
                DatePicker("Início", selection: $draft.start, displayedComponents: .hourAndMinute)
                    .environment(\.timeZone, EventCalendar.timeZone)
                    .frame(minHeight: 44)
                Toggle("Tem horário de término", isOn: $draft.hasEnd).frame(minHeight: 44)
                if draft.hasEnd {
                    DatePicker("Término", selection: $draft.end, displayedComponents: .hourAndMinute)
                        .environment(\.timeZone, EventCalendar.timeZone)
                        .frame(minHeight: 44)
                }
            }
            Section("Descrição") {
                AdminField(label: "Descrição (opcional)", text: $draft.description, axis: .vertical)
            }
        }
        .onAppear { original = draft.fingerprint }
    }
}
