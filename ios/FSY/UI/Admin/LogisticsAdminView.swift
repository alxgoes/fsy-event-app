import SwiftUI

/// Logística e ônibus: GET/POST/PUT/DELETE /api/logistics (gestão).
struct LogisticsAdminView: View {
    @Environment(AppModel.self) private var model
    @State private var buses = AdminResource<[TransportBus]>()
    @State private var editing: BusDraft?
    @State private var deleting: TransportBus?
    @State private var actionError: String?

    var body: some View {
        List {
            AdminStatusSection(resource: buses) { await load() }
            if let list = buses.value {
                Section {
                    summary(list)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))

                if let actionError {
                    Section { Label(actionError, systemImage: "exclamationmark.triangle.fill").foregroundStyle(FSYPalette.urgentText) }
                }

                Section {
                    if list.isEmpty { AdminEmptyRow(text: "Nenhum ônibus cadastrado.", icon: "bus") }
                    ForEach(list) { bus in
                        Button { editing = BusDraft(bus) } label: { BusRow(bus: bus) }
                            .buttonStyle(.plain)
                            .swipeActions {
                                Button("Excluir", role: .destructive) { deleting = bus }
                            }
                            .contextMenu {
                                ForEach(TransportBus.statuses, id: \.0) { status in
                                    Button(status.1) { Task { await setStatus(bus, status.0) } }
                                        .disabled(status.0 == bus.status)
                                }
                            }
                    }
                } header: {
                    Text("Ônibus")
                } footer: {
                    AdminUpdatedFooter(date: buses.updatedAt, isLoading: buses.isLoading)
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Logística")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editing = BusDraft() } label: { Label("Novo ônibus", systemImage: "plus") }
            }
        }
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .sheet(item: $editing) { draft in
            BusForm(draft: draft) { await load() }
        }
        .confirmationDialog("Excluir ônibus?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible, presenting: deleting) { bus in
            Button("Excluir ônibus \(bus.busNumber)", role: .destructive) { Task { await delete(bus) } }
        } message: { bus in
            Text("\(bus.stakeCity) · \(bus.driverName). A exclusão vale também para o site.")
        }
    }

    private func load() async {
        await buses.load {
            let envelope: DataEnvelope<[TransportBus]> = try await model.portal { api, token in try await api.get("api/logistics", token: token) }
            return envelope.data
        }
    }

    private func setStatus(_ bus: TransportBus, _ status: String) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("PUT", "api/logistics", body: .object(["id": .string(bus.id), "status": .string(status)]), token: token)
            }
            await load()
        } catch {
            actionError = adminMessage(error)
        }
    }

    private func delete(_ bus: TransportBus) async {
        actionError = nil
        do {
            let _: Acknowledgement = try await model.portal { api, token in
                try await api.send("DELETE", "api/logistics", query: ["id": bus.id], body: nil, token: token)
            }
            await load()
        } catch {
            actionError = adminMessage(error)
        }
    }

    private func summary(_ list: [TransportBus]) -> some View {
        let seats = list.reduce(0) { $0 + $1.capacity }
        let riders = list.reduce(0) { $0 + $1.passengers }
        let arrived = list.filter { $0.status == "chegou" || $0.status == "concluido" }.count
        return HStack(spacing: 10) {
            SummaryTile(value: "\(list.count)", label: "ônibus", color: 0x01B6D1)
            SummaryTile(value: "\(riders)/\(seats)", label: "passageiros", color: 0xFFB81C)
            SummaryTile(value: "\(arrived)", label: "chegaram", color: 0x93C742)
        }
    }
}

struct SummaryTile: View {
    let value: String
    let label: String
    let color: UInt32

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.system(.title3, design: .serif).weight(.black)).foregroundStyle(FSYPalette.ink).minimumScaleFactor(0.7).lineLimit(1)
            Text(label).font(.caption).foregroundStyle(FSYPalette.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 64)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FSYPalette.surface))
        .overlay(alignment: .top) { Rectangle().fill(Color(hex: color)).frame(height: 5).accessibilityHidden(true) }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(FSYPalette.border, lineWidth: 2))
        .accessibilityElement(children: .combine)
    }
}

private struct BusRow: View {
    let bus: TransportBus

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Ônibus \(bus.busNumber)").font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                Spacer()
                AdminBadge(text: bus.statusLabel, color: statusColor)
            }
            Text(bus.stakeCity).font(.subheadline).foregroundStyle(FSYPalette.ink)
            Text("\(bus.driverName) · \(bus.driverPhone)").font(.caption).foregroundStyle(FSYPalette.muted)
            HStack(spacing: 12) {
                Label(bus.departureCityTime, systemImage: "arrow.up.right").accessibilityLabel("Saída da cidade \(bus.departureCityTime)")
                Label(bus.arrivalTime, systemImage: "flag.checkered").accessibilityLabel("Chegada ao FSY \(bus.arrivalTime)")
                Label(bus.departureFSYTime, systemImage: "arrow.uturn.backward").accessibilityLabel("Saída do FSY \(bus.departureFSYTime)")
            }
            .font(.caption)
            .foregroundStyle(FSYPalette.muted)
            ProgressView(value: bus.occupancy) {
                Text("\(bus.passengers) de \(bus.capacity) lugares").font(.caption2).foregroundStyle(FSYPalette.muted)
            }
            .tint(bus.occupancy >= 1 ? FSYPalette.coral : FSYPalette.primary)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Toque para editar; toque e segure para mudar o status")
    }

    private var statusColor: Color {
        switch bus.status {
        case "a_caminho", "retornando": Color(hex: 0xB0EEFC)
        case "chegou", "concluido": Color(hex: 0xD3E952)
        default: FSYPalette.sunshine
        }
    }
}

struct BusDraft: Identifiable {
    let id = UUID()
    let recordID: String?
    var busNumber = ""
    var stakeCity = ""
    var driverName = ""
    var driverPhone = ""
    var capacity = 46
    var passengers = 0
    var departureCityTime = ""
    var arrivalTime = ""
    var departureFSYTime = ""
    var status = "programado"
    var notes = ""

    init() { recordID = nil }

    init(_ bus: TransportBus) {
        recordID = bus.id
        busNumber = bus.busNumber
        stakeCity = bus.stakeCity
        driverName = bus.driverName
        driverPhone = bus.driverPhone
        capacity = bus.capacity
        passengers = bus.passengers
        departureCityTime = bus.departureCityTime == "--" ? "" : bus.departureCityTime
        arrivalTime = bus.arrivalTime == "--" ? "" : bus.arrivalTime
        departureFSYTime = bus.departureFSYTime == "--" ? "" : bus.departureFSYTime
        status = bus.status
        notes = bus.notes ?? ""
    }

    var isValid: Bool {
        !busNumber.trimmingCharacters(in: .whitespaces).isEmpty
            && !stakeCity.trimmingCharacters(in: .whitespaces).isEmpty
            && !driverName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: JSONValue {
        func time(_ value: String) -> JSONValue { .string(value.trimmingCharacters(in: .whitespaces).isEmpty ? "--" : value.trimmingCharacters(in: .whitespaces)) }
        var fields: [String: JSONValue] = [
            "bus_number": .string(busNumber.trimmingCharacters(in: .whitespaces)),
            "stake_city": .string(stakeCity.trimmingCharacters(in: .whitespaces)),
            "driver_name": .string(driverName.trimmingCharacters(in: .whitespaces)),
            "driver_phone": .string(driverPhone.trimmingCharacters(in: .whitespaces)),
            "capacity": .int(capacity),
            "passengers_count": .int(passengers),
            "departure_city_time": time(departureCityTime),
            "arrival_fsy_time": time(arrivalTime),
            "departure_fsy_time": time(departureFSYTime),
            "status": .string(status),
            "notes": .text(notes),
        ]
        if let recordID { fields["id"] = .string(recordID) }
        return .object(fields)
    }
}

private struct BusForm: View {
    @State var draft: BusDraft
    let saved: () async -> Void
    @Environment(AppModel.self) private var model
    @State private var original: String = ""

    var body: some View {
        AdminFormSheet(title: draft.recordID == nil ? "Novo ônibus" : "Ônibus \(draft.busNumber)",
                       canSave: draft.isValid, isDirty: fingerprint != original) {
            let body = draft.body
            let method = draft.recordID == nil ? "POST" : "PUT"
            let _: Acknowledgement = try await model.portal { api, token in try await api.send(method, "api/logistics", body: body, token: token) }
            await saved()
        } fields: {
            Section("Ônibus") {
                AdminField(label: "Número do ônibus", text: $draft.busNumber)
                AdminField(label: "Estaca / cidade", text: $draft.stakeCity)
                Picker("Status", selection: $draft.status) {
                    ForEach(TransportBus.statuses, id: \.0) { Text($0.1).tag($0.0) }
                }
                .frame(minHeight: 44)
            }
            Section("Motorista") {
                AdminField(label: "Nome", text: $draft.driverName)
                AdminField(label: "Telefone", text: $draft.driverPhone, keyboard: .phonePad)
            }
            Section("Lotação") {
                Stepper("Capacidade: \(draft.capacity)", value: $draft.capacity, in: 1...120).frame(minHeight: 44)
                Stepper("Passageiros: \(draft.passengers)", value: $draft.passengers, in: 0...120).frame(minHeight: 44)
            }
            Section("Horários") {
                AdminField(label: "Saída da cidade", text: $draft.departureCityTime, prompt: "ex.: 06/02 05:30")
                AdminField(label: "Chegada ao FSY", text: $draft.arrivalTime, prompt: "ex.: 06/02 08:00")
                AdminField(label: "Saída do FSY", text: $draft.departureFSYTime, prompt: "ex.: 10/02 14:00")
            }
            Section("Observações") {
                AdminField(label: "Notas", text: $draft.notes, axis: .vertical)
            }
        }
        .onAppear { original = fingerprint }
    }

    private var fingerprint: String {
        "\(draft.busNumber)|\(draft.stakeCity)|\(draft.driverName)|\(draft.driverPhone)|\(draft.capacity)|\(draft.passengers)|\(draft.departureCityTime)|\(draft.arrivalTime)|\(draft.departureFSYTime)|\(draft.status)|\(draft.notes)"
    }
}
