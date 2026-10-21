import SwiftUI

/// Entrada do painel nas pilhas de Início e Perfil.
enum AdminEntry: Hashable {
    case hub
}

/// Painel administrativo nativo: índice dos módulos do cargo e, para a gestão, a visão geral.
struct AdminHubView: View {
    @Environment(AppModel.self) private var model
    @State private var overview = AdminResource<AdminOverview>()

    private var modules: [AdminModule] {
        AdminModule.available(for: model.role).filter { $0 != .overview }
    }

    private var showsOverview: Bool { AdminModule.overview.roles.contains(model.role) }

    var body: some View {
        List {
            Section {
                header
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

            if showsOverview {
                AdminStatusSection(resource: overview) { await load() }
                if let data = overview.value {
                    Section {
                        metrics(data)
                    } header: {
                        Text("Visão geral")
                    } footer: {
                        AdminUpdatedFooter(date: overview.updatedAt, isLoading: overview.isLoading)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                }
            }

            Section("Módulos") {
                if modules.isEmpty {
                    AdminEmptyRow(text: "Seu cargo não tem módulos administrativos.", icon: "lock")
                }
                ForEach(modules) { module in
                    NavigationLink(value: module) {
                        ModuleRow(module: module)
                    }
                }
            }

            if showsOverview, let recent = overview.value?.recent, !recent.isEmpty {
                Section("Comunicados recentes") {
                    ForEach(recent) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                            HStack(spacing: 6) {
                                AdminBadge(text: priorityLabel(item.priority), color: priorityColor(item.priority), ink: item.priority == "urgent" ? .white : FSYPalette.fixedInk)
                                Text(item.category).font(.caption).foregroundStyle(FSYPalette.muted)
                                if let date = item.createdAt { Text(date.adminDateTime).font(.caption).foregroundStyle(FSYPalette.muted) }
                            }
                        }
                        .padding(.vertical, 2)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .adminListStyle()
        .navigationTitle("Painel")
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await load() }
        .adminAutoRefresh { await load() }
        .navigationDestination(for: AdminModule.self) { module in
            AdminModuleView(module: module)
        }
    }

    private func load() async {
        guard showsOverview else { return }
        await overview.load { try await model.portal { api, token in try await api.get("api/admin/overview", token: token) } }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "rectangle.grid.2x2.fill")
                .font(.title2.weight(.bold))
                .foregroundStyle(FSYPalette.fixedInk)
                .frame(width: 52, height: 52)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FSYPalette.sunshine))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(FSYPalette.fixedInk, lineWidth: 2))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text("Painel de \(model.role.label)").font(FSYFont.headline()).foregroundStyle(FSYPalette.ink)
                Text("Suas alterações aparecem também no site.")
                    .font(FSYFont.body())
                    .foregroundStyle(FSYPalette.muted)
            }
        }
        .fsyCard(padding: 16)
    }

    private func metrics(_ data: AdminOverview) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            Metric(value: data.totalYouth, label: "Participantes", detail: "\(data.youthWithCompany) com companhia", color: 0x007DA5)
            Metric(value: data.youthWithRoom, label: "Com quarto", detail: "de \(data.totalYouth)", color: 0x93C742)
            Metric(value: data.totalCompanies, label: "Companhias", detail: "\(data.totalCounselors) consultores", color: 0xFFB81C)
            Metric(value: data.medicalRecords, label: "Fichas de saúde", detail: "cadastradas", color: 0xFC4E6D)
            Metric(value: data.totalAnnouncements, label: "Comunicados", detail: "publicados", color: 0xF68D2E)
            Metric(value: data.totalPhotos, label: "Fotos", detail: "registradas", color: 0x01B6D1)
        }
    }

    private func priorityLabel(_ priority: String) -> String {
        switch priority { case "urgent": "Urgente"; case "important": "Importante"; default: "Normal" }
    }

    private func priorityColor(_ priority: String) -> Color {
        switch priority { case "urgent": FSYPalette.urgent; case "important": FSYPalette.sunshine; default: Color(hex: 0xE0E2E2) }
    }
}

private struct Metric: View {
    let value: Int
    let label: String
    let detail: String
    let color: UInt32

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(value)")
                .font(.system(.title, design: .serif).weight(.black))
                .foregroundStyle(FSYPalette.ink)
                .contentTransition(.numericText())
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(FSYPalette.ink)
            Text(detail).font(.caption).foregroundStyle(FSYPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(alignment: .topTrailing) {
            Circle().fill(Color(hex: color)).frame(width: 26, height: 26).offset(x: 6, y: -6).accessibilityHidden(true)
        }
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(FSYPalette.surface))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(FSYPalette.border, lineWidth: 2))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct ModuleRow: View {
    let module: AdminModule

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: module.icon)
                .font(.body.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(hex: module.accent)))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(module.title).font(.body.weight(.semibold)).foregroundStyle(FSYPalette.ink)
                Text(module.subtitle).font(.caption).foregroundStyle(FSYPalette.muted)
            }
        }
        .frame(minHeight: 48)
    }
}

/// Roteia cada módulo para a tela nativa correspondente.
struct AdminModuleView: View {
    let module: AdminModule

    var body: some View {
        switch module {
        case .overview: AdminHubView()
        case .accounts: AccountsAdminView()
        case .companies: CompaniesAdminView()
        case .schedule: ScheduleAdminView()
        case .logistics: LogisticsAdminView()
        case .announcements: AnnouncementsAdminView()
        case .media: MediaAdminView()
        case .health: HealthAdminView()
        case .inclusion: InclusionAdminView()
        case .audit: AuditAdminView()
        }
    }
}
