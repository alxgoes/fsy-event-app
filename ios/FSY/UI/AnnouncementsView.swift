import SwiftUI

/// Avisos gerais e da companhia (escopo do RLS igual ao GET /api/announcements), com busca e filtros.
struct AnnouncementsView: View {
    enum Filter: String, CaseIterable, Identifiable {
        case todos = "Todos"
        case urgentes = "Urgentes"
        case companhia = "Companhia"
        var id: String { rawValue }
    }

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var query = ""
    @State private var filter: Filter = .todos
    @State private var expanded: Set<String> = []

    private var filtered: [Announcement] {
        model.announcements.filter { item in
            switch filter {
            case .todos: true
            case .urgentes: item.priority == .urgent || item.priority == .important
            case .companhia: item.targetCompanyID != nil
            }
        }
        .filter { item in
            let term = query.trimmingCharacters(in: .whitespaces)
            guard !term.isEmpty else { return true }
            return item.title.localizedStandardContains(term) || item.content.localizedStandardContains(term)
                || item.category.localizedStandardContains(term)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        SyncStatusView()
                        Picker("Filtro", selection: $filter) {
                            ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)

                        if filtered.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Image(systemName: "megaphone").font(.largeTitle).foregroundStyle(FSYPalette.link)
                                Text(query.isEmpty ? "Nenhum aviso por aqui" : "Nada encontrado para “\(query)”")
                                    .font(FSYFont.headline())
                                Text("Novos comunicados aparecem ao abrir o app ou puxar para atualizar.")
                                    .font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
                            }
                            .fsyCard()
                        }

                        LazyVStack(spacing: 14) {
                            ForEach(filtered) { item in
                                AnnouncementCard(item: item, liked: model.likedIDs.contains(item.id),
                                                 ownCompany: item.targetCompanyID != nil && item.targetCompanyID == model.profile?.companyID,
                                                 expanded: expanded.contains(item.id)) {
                                    withAnimation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.8)) {
                                        if expanded.contains(item.id) { expanded.remove(item.id) } else { expanded.insert(item.id) }
                                    }
                                }
                                .id(item.id)
                            }
                        }
                        LastUpdatedFooter()
                    }
                    .padding(16)
                }
                .background(FSYBackground(tab: .avisos))
                .searchable(text: $query, prompt: "Buscar avisos")
                .refreshable { await model.refresh(.manual) }
                .navigationTitle("Avisos")
                .sensoryFeedback(.selection, trigger: filter)
                .onChange(of: model.focusedAnnouncementID, initial: true) { _, id in
                    guard let id, model.announcements.contains(where: { $0.id == id }) else { return }
                    filter = .todos
                    query = ""
                    expanded.insert(id)
                    Task {
                        try? await Task.sleep(for: .milliseconds(250))
                        withAnimation(reduceMotion ? nil : .spring) { proxy.scrollTo(id, anchor: .top) }
                        model.focusedAnnouncementID = nil
                    }
                }
            }
        }
    }
}

private struct AnnouncementCard: View {
    let item: Announcement
    let liked: Bool
    let ownCompany: Bool
    let expanded: Bool
    let toggle: () -> Void

    private static let relative: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = EventCalendar.locale
        formatter.unitsStyle = .short
        return formatter
    }()

    var body: some View {
        Button(action: toggle) {
            VStack(alignment: .leading, spacing: 10) {
                FlowRow(spacing: 6) {
                    switch item.priority {
                    case .urgent: Pill(text: "Urgente", icon: "exclamationmark.triangle.fill", fill: FSYPalette.urgent, ink: .white)
                    case .important: Pill(text: "Importante", icon: "pin.fill", fill: FSYPalette.sunshine)
                    case .normal: EmptyView()
                    }
                    Pill(text: item.category, fill: Color(hex: 0xEFEFE7))
                    if item.targetCompanyID != nil {
                        Pill(text: ownCompany ? "Sua companhia" : "Companhia", icon: "person.3.fill", fill: Color(hex: 0xB0EEFC))
                    }
                }
                Text(item.title)
                    .font(FSYFont.title())
                    .foregroundStyle(FSYPalette.ink)
                    .multilineTextAlignment(.leading)
                Text(item.content)
                    .font(FSYFont.body())
                    .foregroundStyle(FSYPalette.ink)
                    .lineLimit(expanded ? nil : 4)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) {
                    if let date = item.createdAt {
                        Label(Self.relative.localizedString(for: date, relativeTo: Date()), systemImage: "clock")
                    }
                    if let name = item.author?.fullName, !name.isEmpty {
                        Label(name, systemImage: "person.fill").lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    if liked {
                        Label("Você curtiu", systemImage: "heart.fill")
                            .foregroundStyle(FSYPalette.urgentText)
                    }
                }
                .font(.footnote)
                .foregroundStyle(FSYPalette.muted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .fsyCard(padding: 18)
        .accessibilityElement(children: .combine)
        .accessibilityHint(expanded ? "Recolher" : "Ler o aviso completo")
    }
}
