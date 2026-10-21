import SwiftUI

/// Início: mesma organização do /dashboard — saudação, agora/próxima, tema, companhia e avisos.
struct HomeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    SyncStatusView()
                    HeroCard()
                    if !AdminModule.available(for: model.role).isEmpty {
                        PanelShortcutCard()
                    }
                    HappeningNowCard()
                    InstagramPreviewCard()
                    DailyThemeCard()
                    MyCompanyCard()
                    RecentAnnouncementsCard()
                    LastUpdatedFooter()
                }
                .padding(16)
            }
            .background(FSYBackground(tab: .inicio))
            .refreshable { await model.refresh(.manual) }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 8) {
                        FSYCirclesMark(size: 24)
                        Text("Sessão Ribeirão Preto 2")
                            .font(.system(.subheadline, design: .serif).weight(.bold))
                            .foregroundStyle(FSYPalette.ink)
                    }
                    .accessibilityElement(children: .combine)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if model.isRefreshing { ProgressView().accessibilityLabel("Atualizando") }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: GalleryRoute.self) { _ in InstagramGalleryView() }
            .navigationDestination(for: AdminEntry.self) { _ in AdminHubView() }
        }
    }
}

/// Acesso direto ao painel administrativo nativo do cargo.
struct PanelShortcutCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationLink(value: AdminEntry.hub) {
            HStack(spacing: 14) {
                Image(systemName: "rectangle.grid.2x2.fill")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(FSYPalette.fixedInk)
                    .frame(width: 52, height: 52)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(FSYPalette.sunshine))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(FSYPalette.fixedInk, lineWidth: 2))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Painel de \(model.role.label)").font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                    Text("\(AdminModule.available(for: model.role).count) módulos de gestão, sincronizados com o site.")
                        .font(FSYFont.body())
                        .foregroundStyle(FSYPalette.muted)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").foregroundStyle(FSYPalette.muted).accessibilityHidden(true)
            }
            .fsyCard(padding: 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(FSYPressableCardStyle())
        .accessibilityHint("Abre o painel administrativo")
    }
}

/// Prévia com as três publicações mais recentes; leva à galeria completa.
private struct InstagramPreviewCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationLink(value: GalleryRoute.gallery) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Pill(text: "Instagram", icon: "camera.fill", fill: Color(hex: 0xFC4E6D), ink: .white)
                    Spacer()
                    Text("Ver galeria").font(.subheadline.weight(.semibold)).foregroundStyle(FSYPalette.link)
                    Image(systemName: "chevron.right").foregroundStyle(FSYPalette.muted).accessibilityHidden(true)
                }
                Text("@\(Instagram.officialHandle)").font(FSYFont.title()).foregroundStyle(FSYPalette.ink)
                if model.instagramPosts.isEmpty {
                    Text(previewMessage).font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
                } else {
                    HStack(spacing: 10) {
                        ForEach(model.instagramPosts.prefix(3)) { InstagramTile(post: $0, compact: true) }
                    }
                    .accessibilityHidden(true)
                }
            }
            .fsyCard(padding: 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(FSYPressableCardStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Instagram oficial da sessão, \(model.instagramPosts.count) publicações")
        .accessibilityHint("Abre a galeria")
        .task { await model.loadInstagram() }
    }

    private var previewMessage: String {
        switch model.instagramState {
        case .failed: "O feed não carregou agora. Toque para tentar na galeria."
        case .loaded: "Nenhuma publicação ainda."
        default: "Carregando publicações…"
        }
    }
}

private struct HeroCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let moment = EventClock.moment(items: model.visibleSchedule, now: Date())
        VStack(alignment: .leading, spacing: 14) {
            Pill(text: moment.dayLabel, icon: "circle.fill", fill: .white, ink: Color(hex: 0x005E7C))
            Text("Olá, \(model.profile?.firstName ?? "Bem-vindo")!")
                .font(FSYFont.display())
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text("\(EventIdentity.theme) · Sua companhia, programação e avisos da sessão.")
                .font(FSYFont.body().weight(.medium))
                .foregroundStyle(.white)
            FlowRow {
                Pill(text: model.company?.name ?? "Aguardando designação", icon: "shield.lefthalf.filled", fill: .white)
                if let room = model.profile?.room, !room.isEmpty {
                    Pill(text: room, icon: "safari.fill")
                }
                if let role = model.profile?.role, role != .jovem {
                    Pill(text: role.label, icon: "person.badge.key.fill", fill: Color(hex: 0xB0EEFC))
                }
            }
        }
        .fsyCard(fill: FSYPalette.hero, padding: 22)
        .accessibilityElement(children: .combine)
    }
}

/// "Acontecendo agora": contagem regressiva antes do evento, atual/próxima durante, encerrado depois.
private struct HappeningNowCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var liveMessage: String?
    @State private var pulse = false

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            let moment = EventClock.moment(items: model.visibleSchedule, now: context.date)
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Pill(text: title(moment), icon: moment.current != nil ? "dot.radiowaves.left.and.right" : "clock.fill",
                         fill: moment.current != nil ? FSYPalette.coral : FSYPalette.sunshine)
                        .scaleEffect(pulse && moment.current != nil && !reduceMotion ? 1.04 : 1)
                    Spacer()
                }

                switch moment.phase {
                case .before:
                    let days = EventClock.daysUntilStart(from: context.date)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("\(days)")
                            .font(.system(.largeTitle, design: .serif).weight(.black))
                            .contentTransition(.numericText())
                        Text(days == 1 ? "dia para a abertura" : "dias para a abertura")
                            .font(FSYFont.title())
                    }
                    .foregroundStyle(FSYPalette.ink)
                    if let next = moment.next { activityRow(next, label: "Primeira atividade") }
                case .during:
                    if let current = moment.current { activityRow(current, label: "Agora") }
                    if let next = moment.next { activityRow(next, label: "A seguir") }
                    if moment.current == nil && moment.next == nil {
                        Text("Sem atividades programadas para o restante do dia.").font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
                    }
                case .after:
                    Text("Obrigado por fazer parte da FSY Sessão Ribeirão Preto 2!")
                        .font(FSYFont.title())
                        .foregroundStyle(FSYPalette.ink)
                }

                if moment.phase != .after, moment.current != nil || moment.next != nil {
                    Button {
                        Task { liveMessage = await model.toggleLiveActivity() }
                    } label: {
                        Label(model.liveActivityRunning ? "Parar na Tela Bloqueada" : "Acompanhar na Tela Bloqueada",
                              systemImage: model.liveActivityRunning ? "stop.circle" : "lock.iphone")
                    }
                    .buttonStyle(FSYButtonStyle(kind: model.liveActivityRunning ? .outline : .secondary))
                    .sensoryFeedback(.impact(weight: .medium), trigger: model.liveActivityRunning)
                    if let liveMessage {
                        Text(liveMessage).font(.footnote).foregroundStyle(FSYPalette.muted)
                    }
                }
            }
        }
        .fsyCard()
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { pulse = true }
        }
    }

    private func title(_ moment: EventMoment) -> String {
        switch moment.phase {
        case .before: "Contagem regressiva"
        case .during: moment.current != nil ? "Acontecendo agora" : "Próxima atividade"
        case .after: "Edição concluída"
        }
    }

    private func activityRow(_ item: ScheduleItem, label: String) -> some View {
        Button {
            model.focusedScheduleID = item.id
            model.selectedTab = .agenda
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: CategoryStyle.icon(item.category))
                    .font(.title3)
                    .foregroundStyle(FSYPalette.fixedInk)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(CategoryStyle.color(item.category)))
                    .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: 1.5))
                VStack(alignment: .leading, spacing: 3) {
                    Text(label.uppercased()).font(FSYFont.label()).foregroundStyle(FSYPalette.link)
                    Text(item.title).font(FSYFont.title()).foregroundStyle(FSYPalette.ink).multilineTextAlignment(.leading)
                    Text("\(item.start.map(EventCalendar.shortDay) ?? "") · \(item.timeRange) · \(item.location)")
                        .font(FSYFont.body())
                        .foregroundStyle(FSYPalette.muted)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").foregroundStyle(FSYPalette.muted).accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Abre na agenda")
    }
}

private struct DailyThemeCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Pill(text: "Tema FSY 2027", icon: "book.fill", fill: Color(hex: 0x007DA5), ink: .white)
                Spacer()
            }
            VStack(alignment: .leading, spacing: 12) {
                ThemeLockup()
                Divider()
                Text("“Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.”")
                    .font(FSYFont.scripture())
                    .foregroundStyle(FSYPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(FSYPalette.surface))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(FSYPalette.border, lineWidth: 2))
        }
        .fsyCard(fill: FSYPalette.parchment)
    }
}

private struct MyCompanyCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Minha companhia", systemImage: "person.3.fill")
                .font(FSYFont.label())
                .foregroundStyle(FSYPalette.link)
            if let company = model.company {
                Text(company.name).font(FSYFont.headline()).foregroundStyle(FSYPalette.ink)
                if let motto = company.motto, !motto.isEmpty {
                    Text("“\(motto)”").font(FSYFont.scripture()).foregroundStyle(FSYPalette.ink)
                }
                if let counselors = company.counselors, !counselors.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("CONSULTORES").font(FSYFont.label()).foregroundStyle(FSYPalette.muted)
                        ForEach(counselors, id: \.self) { name in
                            Label(name, systemImage: "person.fill").font(FSYFont.body()).foregroundStyle(FSYPalette.ink)
                        }
                    }
                }
            } else {
                Text("Sua companhia ainda não foi designada. A coordenação faz essa atribuição pelo portal.")
                    .font(FSYFont.body())
                    .foregroundStyle(FSYPalette.muted)
            }
        }
        .fsyCard()
    }
}

private struct RecentAnnouncementsCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Avisos recentes", systemImage: "megaphone.fill")
                    .font(FSYFont.label())
                    .foregroundStyle(FSYPalette.link)
                Spacer()
                Button("Ver todos") { model.selectedTab = .avisos }
                    .font(FSYFont.body().weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
            }
            if model.announcements.isEmpty {
                Text("Nenhum aviso publicado para você ainda.").font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
            } else {
                ForEach(model.announcements.prefix(3)) { item in
                    Button {
                        model.focusedAnnouncementID = item.id
                        model.selectedTab = .avisos
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            PriorityDot(priority: item.priority)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title).font(FSYFont.title()).foregroundStyle(FSYPalette.ink).multilineTextAlignment(.leading)
                                Text(item.content).font(FSYFont.body()).foregroundStyle(FSYPalette.muted).lineLimit(2).multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: 0)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .fsyCard()
    }
}

struct PriorityDot: View {
    let priority: AnnouncementPriority

    var body: some View {
        Circle()
            .fill(priority == .urgent ? FSYPalette.urgent : priority == .important ? Color(hex: 0xFFB81C) : FSYPalette.green)
            .frame(width: 12, height: 12)
            .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: 1))
            .padding(.top, 5)
            .accessibilityHidden(true)
    }
}

/// Quebra pílulas em linhas no iPhone SE e com texto grande.
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: width, height: nil))
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: min(maxX, width), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
