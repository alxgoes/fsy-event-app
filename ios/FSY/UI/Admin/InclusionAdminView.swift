import SwiftUI

/// Inclusão: /api/inclusion (casos), /{id} (detalhe, fase, arquivar), /{id}/interviews e /{id}/decision.
/// Toda escrita envia a `version` lida; se outra pessoa salvou antes, o servidor recusa e pedimos para atualizar.
struct InclusionAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var cases = AdminResource<[InclusionCase]>()
    @State private var phase: String?
    @State private var search = ""
    @State private var creating: InclusionCreateDraft?

    private var visible: [InclusionCase] {
        let term = search.trimmingCharacters(in: .whitespaces).lowercased()
        return (cases.value ?? []).filter { item in
            (phase == nil ? item.phase != "arquivado" : item.phase == phase)
                && (term.isEmpty || "\(item.fullName) \(item.needs)".lowercased().contains(term))
        }
    }

    var body: some View {
        List {
            Section {
                Picker("Fase", selection: $phase) {
                    Text("Em andamento").tag(String?.none)
                    ForEach(InclusionCase.phases, id: \.0) { Text($0.1).tag(String?.some($0.0)) }
                }
                .frame(minHeight: 44)
            }
            AdminStatusSection(resource: cases) { await load() }
            if cases.value != nil {
                Section {
                    if visible.isEmpty { AdminEmptyRow(text: "Nenhum acompanhamento nesta fase.", icon: "figure.2.and.child.holdinghands") }
                    ForEach(visible) { item in
                        NavigationLink {
                            InclusionDetailView(caseID: item.id) { await load() }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.fullName).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                                HStack(spacing: 6) {
                                    AdminBadge(text: item.phaseLabel, color: Color(hex: 0xC4B5FD))
                                    if let decision = item.decisionLabel { Text(decision).font(.caption).foregroundStyle(FSYPalette.muted) }
                                }
                                Text(item.needs).font(.caption).foregroundStyle(FSYPalette.muted).lineLimit(2)
                            }
                            .padding(.vertical, 2)
                            .accessibilityElement(children: .combine)
                        }
                    }
                } header: {
                    Text("\(visible.count) acompanhamentos")
                } footer: {
                    AdminUpdatedFooter(date: cases.updatedAt, isLoading: cases.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Inclusão")
        .searchable(text: $search, prompt: "Buscar participante")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { creating = InclusionCreateDraft() } label: { Label("Novo acompanhamento", systemImage: "plus") }
            }
        }
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sheet(item: $creating) { draft in InclusionCreateForm(draft: draft) { await load() } }
    }

    private func load() async {
        await cases.load {
            let envelope: DataEnvelope<[InclusionCase]> = try await model.portal { api, token in try await api.get("api/inclusion", token: token) }
            return envelope.data
        }
    }
}

private struct InclusionDetailView: View {
    let caseID: String
    let changed: () async -> Void

    @Environment(AppModel.self) private var model
    @State private var detail = AdminResource<InclusionCase>()
    @State private var sheet: InclusionSheet?
    @State private var archiving = false
    @State private var reopening = false
    @State private var actionError: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            AdminStatusSection(resource: detail) { await load() }
            if let actionError { Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) } }
            if let item = detail.value {
                Section("Situação") {
                    LabeledContent("Fase", value: item.phaseLabel)
                    if let decision = item.decisionLabel { LabeledContent("Decisão", value: decision) }
                    if let reason = item.decisionReason, !reason.isEmpty { Text(reason).font(.subheadline) }
                    if isClosed(item) {
                        Button("Reabrir acompanhamento", systemImage: "arrow.uturn.backward.circle") { reopening = true }.frame(minHeight: 44)
                    } else {
                        Button("Mudar fase ou dados", systemImage: "pencil") { sheet = .update(item) }.frame(minHeight: 44)
                        Button("Registrar decisão", systemImage: "checkmark.seal") { sheet = .decision(item) }.frame(minHeight: 44)
                    }
                }
                Section("Necessidades") { Text(item.needs.isEmpty ? "—" : item.needs) }
                Section("Plano de apoio") { Text(item.supportPlan.isEmpty ? "—" : item.supportPlan) }
                Section("Contatos") {
                    contact("Responsável", item.parent)
                    contact("Bispo", item.bishop)
                }
                Section {
                    if item.interviews.isEmpty { AdminEmptyRow(text: "Nenhuma entrevista.", icon: "person.2") }
                    ForEach(item.interviews) { interview in
                        if item.phase == "arquivado" {
                            // Caso arquivado: entrevistas só para leitura; para editar, reabrir antes.
                            interviewSummary(interview, full: true)
                        } else {
                            Button { sheet = .interview(item, interview) } label: { interviewSummary(interview, full: false) }
                                .buttonStyle(.plain)
                                .accessibilityHint("Toque para editar")
                        }
                    }
                    if item.phase != "arquivado" {
                        Button("Agendar entrevista", systemImage: "calendar.badge.plus") { sheet = .interview(item, nil) }.frame(minHeight: 44)
                    }
                } header: { Text("Entrevistas") }
                Section("Histórico") {
                    ForEach(item.history) { entry in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.action.replacingOccurrences(of: "_", with: " ").capitalized).font(.subheadline)
                            Text("\(entry.actorName)\(entry.createdAt.map { " · \($0.adminDateTime)" } ?? "")").font(.caption).foregroundStyle(FSYPalette.muted)
                        }
                    }
                }
                if item.phase != "arquivado" {
                    Section {
                        Button("Arquivar acompanhamento", systemImage: "archivebox", role: .destructive) { archiving = true }.frame(minHeight: 44)
                    }
                }
            }
        }
        .adminListStyle()
        .navigationTitle(detail.value?.fullName ?? "Acompanhamento")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sheet(item: $sheet) { sheet in
            InclusionActionForm(sheet: sheet, caseID: caseID) { await load(); await changed() }
        }
        .confirmationDialog("Reabrir acompanhamento?", isPresented: $reopening, titleVisibility: .visible) {
            Button("Reabrir e escolher a fase") { if let item = detail.value { sheet = .update(item) } }
        } message: {
            Text(detail.value?.decision != nil
                 ? "Reabrir o acompanhamento removerá a decisão atual. O registro anterior continuará no histórico."
                 : "O acompanhamento volta para a lista em andamento. O histórico é mantido.")
        }
        .confirmationDialog("Arquivar acompanhamento?", isPresented: $archiving, titleVisibility: .visible) {
            Button("Arquivar", role: .destructive) { Task { await archive() } }
        } message: {
            Text("O caso sai da lista em andamento no site e no app; o histórico é mantido.")
        }
    }

    private func isClosed(_ item: InclusionCase) -> Bool { item.phase == "arquivado" || item.phase == "concluido" }

    private func interviewSummary(_ interview: InclusionCase.Interview, full: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(interview.scheduledAt?.adminDateTime ?? "Sem data").font(.subheadline.weight(.semibold))
                Spacer()
                AdminBadge(text: interview.status.capitalized, color: interview.status == "realizada" ? Color(hex: 0xD3E952) : FSYPalette.sunshine)
            }
            Text(interview.participants).font(.caption).foregroundStyle(FSYPalette.muted)
            if !interview.summary.isEmpty { Text(interview.summary).font(.caption).lineLimit(full ? nil : 3) }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func contact(_ title: String, _ value: InclusionContact) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(FSYPalette.muted)
            Text([value.name, value.relationship, value.ward].filter { !$0.isEmpty }.joined(separator: " · ").ifEmpty("—"))
            if !value.phone.isEmpty, let url = URL(string: "tel:\(value.phone.filter { $0.isNumber || $0 == "+" })") {
                Link(value.phone, destination: url).frame(minHeight: 44)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func load() async {
        await detail.load {
            let envelope: DataEnvelope<InclusionCase> = try await model.portal { api, token in try await api.get("api/inclusion/\(caseID)", token: token) }
            return envelope.data
        }
    }

    private func archive() async {
        guard let version = detail.value?.version else { return }
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/inclusion/\(caseID)", query: ["version": "\(version)"], body: nil, token: token)
            }
            await changed()
            dismiss()
        } catch {
            actionError = adminMessage(error)
        }
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}

private enum InclusionSheet: Identifiable {
    case update(InclusionCase), decision(InclusionCase), interview(InclusionCase, InclusionCase.Interview?)

    var id: String {
        switch self {
        case .update: "update"
        case .decision: "decision"
        case .interview(_, let interview): "interview-\(interview?.id ?? "new")"
        }
    }
}

private struct InclusionActionForm: View {
    let sheet: InclusionSheet
    let caseID: String
    let saved: () async -> Void

    @Environment(AppModel.self) private var model
    @State private var phase = "triagem"
    @State private var needs = ""
    @State private var plan = ""
    @State private var parent = InclusionContact()
    @State private var bishop = InclusionContact()
    @State private var decision = "participacao_confirmada"
    @State private var reason = ""
    @State private var confirmed = false
    @State private var when = Date().addingTimeInterval(86_400)
    @State private var participants = ""
    @State private var interviewStatus = "agendada"
    @State private var summary = ""
    @State private var loaded = false

    var body: some View {
        switch sheet {
        case .update(let item):
            AdminFormSheet(title: ["concluido", "arquivado"].contains(item.phase) ? "Reabrir acompanhamento" : "Atualizar acompanhamento",
                           saveLabel: ["concluido", "arquivado"].contains(item.phase) ? "Reabrir" : "Salvar",
                           canSave: !needs.trimmingCharacters(in: .whitespaces).isEmpty) {
                try await send("PATCH", "api/inclusion/\(caseID)", [
                    "version": .int(item.version), "phase": .string(phase),
                    "needs": .string(needs.trimmingCharacters(in: .whitespacesAndNewlines)),
                    "support_plan": .string(plan.trimmingCharacters(in: .whitespacesAndNewlines)),
                    "contacts": .object(["parent": parent.json, "bishop": bishop.json]),
                ])
            } fields: {
                Section {
                    Picker("Fase", selection: $phase) {
                        ForEach(InclusionCase.phases.filter { $0.0 != "concluido" && $0.0 != "arquivado" }, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    .frame(minHeight: 44)
                } footer: {
                    Text(item.decision != nil && ["concluido", "arquivado"].contains(item.phase)
                         ? "Ao salvar, a decisão atual sai do acompanhamento e fica registrada no histórico."
                         : "A decisão final é registrada em “Registrar decisão”.")
                }
                Section("Acompanhamento") {
                    AdminField(label: "Necessidades", text: $needs, axis: .vertical)
                    AdminField(label: "Plano de apoio", text: $plan, axis: .vertical)
                }
                contactFields("Responsável", $parent, showWard: false)
                contactFields("Bispo", $bishop, showWard: true)
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                phase = ["concluido", "arquivado"].contains(item.phase) ? "analise" : item.phase
                needs = item.needs
                plan = item.supportPlan
                parent = item.parent
                bishop = item.bishop
            }
        case .decision(let item):
            AdminFormSheet(title: "Registrar decisão", saveLabel: "Registrar",
                           canSave: confirmed && reason.trimmingCharacters(in: .whitespaces).count >= 10
                               && (decision != "participacao_com_apoio" || !plan.trimmingCharacters(in: .whitespaces).isEmpty)) {
                try await send("POST", "api/inclusion/\(caseID)/decision", [
                    "version": .int(item.version), "decision": .string(decision),
                    "reason": .string(reason.trimmingCharacters(in: .whitespacesAndNewlines)),
                    "support_plan": .string(plan.trimmingCharacters(in: .whitespacesAndNewlines)),
                    "confirmed_by_human": .bool(true),
                ])
            } fields: {
                Section("Decisão") {
                    Picker("Decisão", selection: $decision) {
                        ForEach(InclusionCase.decisions, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
                Section("Fundamentação") {
                    AdminField(label: "Motivo (mínimo de 10 caracteres)", text: $reason, axis: .vertical)
                    AdminField(label: decision == "participacao_com_apoio" ? "Apoio necessário" : "Plano de apoio (opcional)", text: $plan, axis: .vertical)
                }
                Section {
                    Toggle("Confirmo que esta é a decisão da equipe responsável", isOn: $confirmed).frame(minHeight: 44)
                }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                plan = item.supportPlan
            }
        case .interview(let item, let interview):
            AdminFormSheet(title: interview == nil ? "Agendar entrevista" : "Entrevista",
                           canSave: participants.trimmingCharacters(in: .whitespaces).count >= 2
                               && (interviewStatus != "realizada" || !summary.trimmingCharacters(in: .whitespaces).isEmpty)) {
                let body: [String: JSONValue] = [
                    "version": .int(item.version), "scheduled_at": .string(ISODate.string(when)),
                    "participants": .string(participants.trimmingCharacters(in: .whitespaces)),
                    "status": .string(interviewStatus), "summary": .string(summary.trimmingCharacters(in: .whitespacesAndNewlines)),
                ]
                if let interview {
                    try await send("PATCH", "api/inclusion/\(caseID)/interviews/\(interview.id)", body)
                } else {
                    try await send("POST", "api/inclusion/\(caseID)/interviews", body)
                }
            } fields: {
                Section("Entrevista") {
                    DatePicker("Data e hora", selection: $when).environment(\.timeZone, EventCalendar.timeZone).frame(minHeight: 44)
                    AdminField(label: "Participantes", text: $participants)
                    Picker("Situação", selection: $interviewStatus) {
                        Text("Agendada").tag("agendada")
                        Text("Realizada").tag("realizada")
                        Text("Cancelada").tag("cancelada")
                    }
                    .frame(minHeight: 44)
                }
                Section("Resumo") {
                    AdminField(label: interviewStatus == "realizada" ? "Resumo (obrigatório)" : "Resumo", text: $summary, axis: .vertical)
                }
            }
            .onAppear {
                guard !loaded, let interview else { return }
                loaded = true
                when = interview.scheduledAt ?? when
                participants = interview.participants
                interviewStatus = interview.status
                summary = interview.summary
            }
        }
    }

    private func contactFields(_ title: String, _ contact: Binding<InclusionContact>, showWard: Bool) -> some View {
        Section(title) {
            AdminField(label: "Nome", text: contact.name)
            AdminField(label: "Telefone", text: contact.phone, keyboard: .phonePad)
            AdminField(label: "Parentesco / função", text: contact.relationship)
            if showWard { AdminField(label: "Ala", text: contact.ward) }
        }
    }

    private func send(_ method: String, _ path: String, _ body: [String: JSONValue]) async throws {
        let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, path, body: .object(body), token: token) }
        await saved()
    }
}

struct InclusionCreateDraft: Identifiable {
    let id = UUID()
    var medicalRecordID: String?
    var newName = ""
    var needs = ""
    var plan = ""
    var parent = InclusionContact()
    var bishop = InclusionContact()

    var isValid: Bool {
        (medicalRecordID != nil || newName.trimmingCharacters(in: .whitespaces).count >= 2) && !needs.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: JSONValue {
        var fields: [String: JSONValue] = [
            "needs": .string(needs.trimmingCharacters(in: .whitespacesAndNewlines)),
            "support_plan": .string(plan.trimmingCharacters(in: .whitespacesAndNewlines)),
            "contacts": .object(["parent": parent.json, "bishop": bishop.json]),
        ]
        if let medicalRecordID {
            fields["medical_record_id"] = .string(medicalRecordID)
        } else {
            fields["new_record"] = .object(["full_name": .string(newName.trimmingCharacters(in: .whitespaces))])
        }
        return .object(fields)
    }
}

private struct InclusionCreateForm: View {
    @State var draft: InclusionCreateDraft
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var records: [MedicalRecord] = []

    var body: some View {
        AdminFormSheet(title: "Novo acompanhamento", saveLabel: "Criar", canSave: draft.isValid,
                       isDirty: !draft.needs.isEmpty || !draft.newName.isEmpty || draft.medicalRecordID != nil) {
            let body = draft.body
            let _: Acknowledgement = try await model.portal { api, token in try await api.send("POST", "api/inclusion", body: body, token: token) }
            await saved()
        } fields: {
            Section {
                Picker("Ficha de saúde", selection: $draft.medicalRecordID) {
                    Text("Cadastrar novo participante").tag(String?.none)
                    ForEach(records) { Text($0.fullName).tag(String?.some($0.id)) }
                }
                .frame(minHeight: 44)
                if draft.medicalRecordID == nil {
                    AdminField(label: "Nome do participante", text: $draft.newName)
                }
            } header: { Text("Participante") }
            Section("Acompanhamento") {
                AdminField(label: "Necessidades", text: $draft.needs, axis: .vertical)
                AdminField(label: "Plano de apoio (opcional)", text: $draft.plan, axis: .vertical)
            }
            Section("Responsável") {
                AdminField(label: "Nome", text: $draft.parent.name)
                AdminField(label: "Telefone", text: $draft.parent.phone, keyboard: .phonePad)
                AdminField(label: "Parentesco", text: $draft.parent.relationship)
            }
            Section("Bispo") {
                AdminField(label: "Nome", text: $draft.bishop.name)
                AdminField(label: "Telefone", text: $draft.bishop.phone, keyboard: .phonePad)
                AdminField(label: "Ala", text: $draft.bishop.ward)
            }
        }
        .task {
            if let envelope: DataEnvelope<[MedicalRecord]> = try? await model.portal({ api, token in try await api.get("api/medical", token: token) }) {
                records = envelope.data.sorted { $0.fullName.localizedCompare($1.fullName) == .orderedAscending }
            }
        }
    }
}
