import SwiftUI

/// Saúde e atendimentos: /api/medical (fichas) e /api/medical/appointments (agenda multidisciplinar).
/// Dados confidenciais: ficam só na memória desta tela, sem cópia offline e sem fila de envio.
struct HealthAdminView: View {
    enum Tab: String { case records, appointments }

    @Environment(AppModel.self) private var model
    @State private var tab: Tab = .records
    @State private var records = AdminResource<[MedicalRecord]>()
    @State private var appointments = AdminResource<[Appointment]>()
    @State private var search = ""
    @State private var onlyAllergies = false
    @State private var editingRecord: RecordDraft?
    @State private var viewing: MedicalRecord?
    @State private var editingAppointment: AppointmentDraft?
    @State private var deletingRecord: MedicalRecord?
    @State private var deletingAppointment: Appointment?
    @State private var actionError: String?

    private var visibleRecords: [MedicalRecord] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (records.value ?? [])
            .filter { !onlyAllergies || $0.hasAllergy || $0.severeAllergy }
            .filter { term.isEmpty || "\($0.fullName) \($0["company_id"]) \($0["room"])".lowercased().contains(term) }
            .sorted { $0.fullName.localizedCompare($1.fullName) == .orderedAscending }
    }

    private var visibleAppointments: [Appointment] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (appointments.value ?? []).filter { term.isEmpty || "\($0.youthName) \($0.professionalName) \($0.reason)".lowercased().contains(term) }
    }

    var body: some View {
        List {
            Section {
                Picker("Seção", selection: $tab) {
                    Text("Fichas").tag(Tab.records)
                    Text("Atendimentos").tag(Tab.appointments)
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)
            if let actionError {
                Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) }
            }
            switch tab {
            case .records: recordsSection
            case .appointments: appointmentsSection
            }
        }
        .adminListStyle()
        .navigationTitle("Saúde")
        .searchable(text: $search, prompt: tab == .records ? "Buscar participante" : "Buscar atendimento")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    if tab == .records { editingRecord = RecordDraft() } else { editingAppointment = AppointmentDraft() }
                } label: {
                    Label(tab == .records ? "Nova ficha" : "Novo atendimento", systemImage: "plus")
                }
            }
        }
        .refreshable { await loadAll() }
        .adminAutoRefresh { await loadAll() }
        .sensoryFeedback(.selection, trigger: tab)
        .sheet(item: $viewing) { record in
            RecordDetail(record: record) {
                viewing = nil
                editingRecord = RecordDraft(record)
            }
        }
        .sheet(item: $editingRecord) { draft in RecordForm(draft: draft) { await loadRecords() } }
        .sheet(item: $editingAppointment) { draft in
            AppointmentForm(draft: draft, records: records.value ?? []) { await loadAppointments() }
        }
        .confirmationDialog("Excluir ficha?", isPresented: Binding(get: { deletingRecord != nil }, set: { if !$0 { deletingRecord = nil } }),
                            titleVisibility: .visible, presenting: deletingRecord) { record in
            Button("Excluir ficha de \(record.fullName)", role: .destructive) { Task { await deleteRecord(record) } }
        } message: { _ in
            Text("A ficha deixa de existir no site e no app. Esta ação não pode ser desfeita.")
        }
        .confirmationDialog("Excluir atendimento?", isPresented: Binding(get: { deletingAppointment != nil }, set: { if !$0 { deletingAppointment = nil } }),
                            titleVisibility: .visible, presenting: deletingAppointment) { item in
            Button("Excluir atendimento de \(item.youthName)", role: .destructive) { Task { await deleteAppointment(item) } }
        }
    }

    @ViewBuilder private var recordsSection: some View {
        AdminStatusSection(resource: records) { await loadRecords() }
        if records.value != nil {
            Section {
                Toggle("Só com alergias", isOn: $onlyAllergies).frame(minHeight: 44)
            }
            Section {
                if visibleRecords.isEmpty { AdminEmptyRow(text: "Nenhuma ficha encontrada.", icon: "cross.case") }
                ForEach(visibleRecords) { record in
                    Button { viewing = record } label: {
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(record.fullName).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                                Text([record["company_id"], record["room"].isEmpty ? "" : "Quarto \(record["room"])"].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.caption).foregroundStyle(FSYPalette.muted)
                            }
                            Spacer()
                            if record.severeAllergy {
                                AdminBadge(text: "Alergia grave", color: FSYPalette.urgent, ink: .white)
                            } else if record.hasAllergy {
                                AdminBadge(text: "Alergia", color: Color(hex: 0xFDA192))
                            }
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .swipeActions { Button("Excluir", role: .destructive) { deletingRecord = record } }
                    .accessibilityElement(children: .combine)
                }
            } header: {
                Text("\(visibleRecords.count) fichas")
            } footer: {
                AdminUpdatedFooter(date: records.updatedAt, isLoading: records.isLoading)
            }
        }
    }

    @ViewBuilder private var appointmentsSection: some View {
        AdminStatusSection(resource: appointments) { await loadAppointments() }
        if appointments.value != nil {
            Section {
                if visibleAppointments.isEmpty { AdminEmptyRow(text: "Nenhum atendimento agendado.", icon: "stethoscope") }
                ForEach(visibleAppointments) { item in
                    Button { editingAppointment = AppointmentDraft(item) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.youthName).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                                Spacer()
                                AdminBadge(text: item.statusLabel, color: item.status == "realizado" ? Color(hex: 0xD3E952) : (item.status == "cancelado" ? Color(hex: 0xE0E2E2) : FSYPalette.sunshine))
                            }
                            Text("\(item.professionalName) · \(item.reason)").font(.subheadline).foregroundStyle(FSYPalette.ink)
                            if let date = item.scheduledAt { Text(date.adminDateTime).font(.caption).foregroundStyle(FSYPalette.muted) }
                        }
                        .padding(.vertical, 2)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .swipeActions { Button("Excluir", role: .destructive) { deletingAppointment = item } }
                    .contextMenu {
                        ForEach(Appointment.statuses, id: \.0) { status in
                            Button(status.1) { Task { await setStatus(item, status.0) } }.disabled(status.0 == item.status)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityHint("Toque para editar; toque e segure para mudar o status")
                }
            } header: {
                Text("\(visibleAppointments.count) atendimentos")
            } footer: {
                AdminUpdatedFooter(date: appointments.updatedAt, isLoading: appointments.isLoading)
            }
        }
    }

    private func loadAll() async {
        await loadRecords()
        await loadAppointments()
    }

    private func loadRecords() async {
        await records.load {
            let envelope: DataEnvelope<[MedicalRecord]> = try await model.portal { api, token in try await api.get("api/medical", token: token) }
            return envelope.data
        }
    }

    private func loadAppointments() async {
        await appointments.load {
            let envelope: DataEnvelope<[Appointment]> = try await model.portal { api, token in try await api.get("api/medical/appointments", token: token) }
            return envelope.data
        }
    }

    private func setStatus(_ item: Appointment, _ status: String) async {
        await mutate {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("PUT", "api/medical/appointments", body: .object(["id": .string(item.id), "status": .string(status)]), token: token)
            }
            await loadAppointments()
        }
    }

    private func deleteRecord(_ record: MedicalRecord) async {
        await mutate {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/medical", query: ["id": record.id], body: nil, token: token)
            }
            await loadRecords()
        }
    }

    private func deleteAppointment(_ item: Appointment) async {
        await mutate {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/medical/appointments", query: ["id": item.id], body: nil, token: token)
            }
            await loadAppointments()
        }
    }

    private func mutate(_ work: () async throws -> Void) async {
        actionError = nil
        do { try await work() } catch { actionError = adminMessage(error) }
    }
}

// MARK: Ficha

private struct RecordDetail: View {
    let record: MedicalRecord
    let edit: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Participante") {
                    row("Companhia", "company_id")
                    row("Quarto", "room")
                    row("Tipo sanguíneo", "blood_type")
                }
                Section("Saúde") {
                    if record.severeAllergy {
                        Label("Alergia grave", systemImage: "exclamationmark.octagon.fill").foregroundStyle(FSYPalette.urgentText)
                    }
                    row("Alergias", "allergies")
                    row("Restrições alimentares", "dietary_restrictions")
                    row("Medicamentos", "medications")
                    row("Observações da equipe", "doctor_notes")
                }
                Section("Contatos") {
                    contact("Responsável", name: "emergency_contact_name", phone: "emergency_contact_phone", relation: "emergency_contact_rel")
                    contact("Contato 2", name: "contact_2_name", phone: "contact_2_phone", relation: "contact_2_relationship")
                    contact("Contato 3", name: "contact_3_name", phone: "contact_3_phone", relation: "contact_3_relationship")
                    contact("Bispo", name: "bishop_name", phone: "bishop_phone", relation: "bishop_ward")
                }
            }
            .navigationTitle(record.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Editar", action: edit) }
            }
        }
    }

    @ViewBuilder private func row(_ title: String, _ key: String) -> some View {
        let value = record[key]
        LabeledContent(title, value: value.isEmpty ? "—" : value)
    }

    @ViewBuilder private func contact(_ title: String, name: String, phone: String, relation: String) -> some View {
        if !record[name].isEmpty || !record[phone].isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(FSYPalette.muted)
                Text([record[name], record[relation]].filter { !$0.isEmpty }.joined(separator: " · "))
                if let url = URL(string: "tel:\(record[phone].filter { $0.isNumber || $0 == "+" })"), !record[phone].isEmpty {
                    Link(record[phone], destination: url).frame(minHeight: 44)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

struct RecordDraft: Identifiable {
    let id = UUID()
    let recordID: String?
    var values: [String: String] = [:]
    var severe = false

    init() { recordID = nil }

    init(_ record: MedicalRecord) {
        recordID = record.id
        values = record.fields.filter { MedicalRecord.editable.contains($0.key) }
        severe = record.severeAllergy
    }

    func binding(_ key: String, in state: Binding<RecordDraft>) -> Binding<String> {
        Binding(get: { state.wrappedValue.values[key] ?? "" }, set: { state.wrappedValue.values[key] = $0 })
    }

    var isValid: Bool { (values["full_name"] ?? "").trimmingCharacters(in: .whitespaces).count >= 2 }

    /// Só chaves do esquema estrito do servidor; vazio vira null (limpa o campo).
    var body: JSONValue {
        var fields: [String: JSONValue] = ["is_severe_allergy": .bool(severe)]
        for key in MedicalRecord.editable {
            let value = values[key] ?? ""
            fields[key] = key == "full_name" ? .string(value.trimmingCharacters(in: .whitespaces)) : .text(value)
        }
        if let recordID { fields["id"] = .string(recordID) }
        return .object(fields)
    }

    var fingerprint: String { MedicalRecord.editable.map { values[$0] ?? "" }.joined(separator: "|") + "\(severe)" }
}

private struct RecordForm: View {
    @State var draft: RecordDraft
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Nova ficha" : "Editar ficha",
                       canSave: draft.isValid, isDirty: draft.fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/medical", body: body, token: token) }
            await saved()
        } fields: {
            Section("Participante") {
                field("Nome completo", "full_name")
                field("Companhia", "company_id")
                field("Quarto", "room")
                field("Tipo sanguíneo", "blood_type")
            }
            Section("Saúde") {
                field("Alergias", "allergies", axis: .vertical)
                Toggle("Alergia grave", isOn: $draft.severe).frame(minHeight: 44)
                field("Restrições alimentares", "dietary_restrictions", axis: .vertical)
                field("Medicamentos", "medications", axis: .vertical)
                field("Observações da equipe", "doctor_notes", axis: .vertical)
            }
            Section("Responsável") {
                field("Nome", "emergency_contact_name")
                field("Telefone", "emergency_contact_phone", keyboard: .phonePad)
                field("Parentesco", "emergency_contact_rel")
            }
            Section("Outros contatos") {
                field("Contato 2 — nome", "contact_2_name")
                field("Contato 2 — telefone", "contact_2_phone", keyboard: .phonePad)
                field("Contato 2 — parentesco", "contact_2_relationship")
                field("Contato 3 — nome", "contact_3_name")
                field("Contato 3 — telefone", "contact_3_phone", keyboard: .phonePad)
                field("Contato 3 — parentesco", "contact_3_relationship")
            }
            Section("Bispo") {
                field("Nome", "bishop_name")
                field("Telefone", "bishop_phone", keyboard: .phonePad)
                field("Ala", "bishop_ward")
            }
        }
        .onAppear { original = draft.fingerprint }
    }

    private func field(_ label: String, _ key: String, keyboard: UIKeyboardType = .default, axis: Axis = .horizontal) -> some View {
        AdminField(label: label, text: draft.binding(key, in: $draft), keyboard: keyboard, axis: axis)
    }
}

// MARK: Atendimento

struct AppointmentDraft: Identifiable {
    let id = UUID()
    let recordID: String?
    var medicalRecordID: String?
    var youthName = ""
    var professional = ""
    var reason = "Atendimento Multidisciplinar"
    var date = Date().addingTimeInterval(3600)
    var notes = ""
    var status = "agendado"

    init() { recordID = nil }

    init(_ item: Appointment) {
        recordID = item.id
        medicalRecordID = item.medicalRecordID
        youthName = item.youthName
        professional = item.professionalName
        reason = item.reason
        date = item.scheduledAt ?? Date()
        notes = item.notes ?? ""
        status = item.status
    }

    var isValid: Bool {
        youthName.trimmingCharacters(in: .whitespaces).count >= 2 && professional.trimmingCharacters(in: .whitespaces).count >= 2
            && !reason.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Criação e edição usam os esquemas estritos do servidor (campos diferentes).
    var body: JSONValue {
        if let recordID {
            return .object([
                "id": .string(recordID), "status": .string(status), "notes": .text(notes),
                "scheduled_at": .string(ISODate.string(date)),
                "professional_name": .string(professional.trimmingCharacters(in: .whitespaces)),
                "reason": .string(reason.trimmingCharacters(in: .whitespaces)),
            ])
        }
        return .object([
            "youth_name": .string(youthName.trimmingCharacters(in: .whitespaces)),
            "professional_name": .string(professional.trimmingCharacters(in: .whitespaces)),
            "reason": .string(reason.trimmingCharacters(in: .whitespaces)),
            "scheduled_at": .string(ISODate.string(date)),
            "notes": .text(notes),
            "medical_record_id": medicalRecordID.map(JSONValue.string) ?? .null,
        ])
    }

    var fingerprint: String { "\(medicalRecordID ?? "")|\(youthName)|\(professional)|\(reason)|\(date.timeIntervalSince1970)|\(notes)|\(status)" }
}

private struct AppointmentForm: View {
    @State var draft: AppointmentDraft
    let records: [MedicalRecord]
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Novo atendimento" : "Atendimento",
                       canSave: draft.isValid, isDirty: draft.fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/medical/appointments", body: body, token: token) }
            await saved()
        } fields: {
            Section("Participante") {
                if draft.recordID == nil {
                    Picker("Ficha", selection: $draft.medicalRecordID) {
                        Text("Sem ficha vinculada").tag(String?.none)
                        ForEach(records.sorted { $0.fullName < $1.fullName }) { Text($0.fullName).tag(String?.some($0.id)) }
                    }
                    .frame(minHeight: 44)
                    .onChange(of: draft.medicalRecordID) { _, id in
                        if let record = records.first(where: { $0.id == id }) { draft.youthName = record.fullName }
                    }
                    AdminField(label: "Nome do participante", text: $draft.youthName)
                } else {
                    LabeledContent("Participante", value: draft.youthName)
                    Picker("Status", selection: $draft.status) {
                        ForEach(Appointment.statuses, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    .frame(minHeight: 44)
                }
            }
            Section("Atendimento") {
                AdminField(label: "Profissional", text: $draft.professional)
                AdminField(label: "Motivo", text: $draft.reason)
                DatePicker("Data e hora", selection: $draft.date)
                    .environment(\.timeZone, EventCalendar.timeZone)
                    .frame(minHeight: 44)
                AdminField(label: "Observações", text: $draft.notes, axis: .vertical)
            }
        }
        .onAppear { original = draft.fingerprint }
    }
}
