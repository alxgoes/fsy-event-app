import SwiftUI

/// Programação por dia (mesma fonte `schedule_items` do /schedule), com destaque da atividade atual.
struct ScheduleView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var dayNamespace
    @State private var selectedDay: String?
    @State private var expanded: Set<String> = []

    private var days: [String] {
        Array(Set(model.visibleSchedule.map(\.day))).sorted()
    }

    private var activeDay: String? {
        if let selectedDay, days.contains(selectedDay) { return selectedDay }
        let today = EventClock.dayKey(for: Date())
        return model.visibleSchedule.first { $0.date == today }?.day ?? days.first { $0 != "dia0" } ?? days.first
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        SyncStatusView()
                        if days.isEmpty {
                            emptyState
                        } else {
                            dayPicker
                            TimelineView(.periodic(from: .now, by: 30)) { context in
                                LazyVStack(spacing: 14) {
                                    ForEach(items(for: activeDay)) { item in
                                        ScheduleRow(item: item, now: context.date, expanded: expanded.contains(item.id)) {
                                            toggle(item.id)
                                        }
                                        .id(item.id)
                                    }
                                }
                            }
                            if activeDay == "dia0" {
                                Label("Dia Zero: preparação da equipe, visível só para a equipe.", systemImage: "person.3.fill")
                                    .font(.footnote)
                                    .foregroundStyle(FSYPalette.muted)
                            }
                        }
                        LastUpdatedFooter()
                    }
                    .padding(16)
                }
                .background(FSYBackground(tab: .agenda))
                .refreshable { await model.refresh(.manual) }
                .navigationTitle("Programação")
                .onChange(of: model.focusedScheduleID, initial: true) { _, id in
                    guard let id, let item = model.visibleSchedule.first(where: { $0.id == id }) else { return }
                    selectedDay = item.day
                    expanded.insert(id)
                    Task {
                        try? await Task.sleep(for: .milliseconds(250))
                        withAnimation(reduceMotion ? nil : .spring) { proxy.scrollTo(id, anchor: .center) }
                        model.focusedScheduleID = nil
                    }
                }
            }
        }
    }

    private func items(for day: String?) -> [ScheduleItem] {
        model.visibleSchedule
            .filter { $0.day == day }
            .sorted { ($0.start ?? .distantPast) < ($1.start ?? .distantPast) }
    }

    private func toggle(_ id: String) {
        withAnimation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.8)) {
            if expanded.contains(id) { expanded.remove(id) } else { expanded.insert(id) }
        }
    }

    private var dayPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(days, id: \.self) { day in
                    let selected = day == activeDay
                    Button {
                        withAnimation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.75)) { selectedDay = day }
                    } label: {
                        VStack(spacing: 2) {
                            Text(day == "dia0" ? "Dia Zero" : "Dia \(day.dropFirst(3))")
                                .font(FSYFont.label())
                            if let first = model.visibleSchedule.first(where: { $0.day == day })?.start {
                                Text(EventCalendar.shortDay(first)).font(.caption2.weight(.semibold))
                            }
                        }
                        .foregroundStyle(selected ? Color.white : FSYPalette.ink)
                        .padding(.horizontal, 14)
                        .frame(minWidth: 64, minHeight: 48)
                        .background {
                            if selected {
                                Capsule().fill(Color(hex: 0x005E7C)).matchedGeometryEffect(id: "day", in: dayNamespace)
                            } else {
                                Capsule().fill(FSYPalette.surface)
                            }
                        }
                        .overlay(Capsule().strokeBorder(FSYPalette.border, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.vertical, 2)
        }
        .sensoryFeedback(.selection, trigger: selectedDay)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: model.connectivity.isOnline ? "calendar.badge.exclamationmark" : "wifi.slash")
                .font(.largeTitle)
                .foregroundStyle(FSYPalette.link)
            Text(model.isRefreshing ? "Carregando a programação…" : "Programação indisponível")
                .font(FSYFont.headline())
            Text(model.connectivity.isOnline
                 ? "Nenhuma atividade foi publicada ainda. Puxe para atualizar."
                 : "Conecte-se à internet para carregar a programação pela primeira vez.")
                .font(FSYFont.body())
                .foregroundStyle(FSYPalette.muted)
        }
        .fsyCard()
    }
}

private struct ScheduleRow: View {
    let item: ScheduleItem
    let now: Date
    let expanded: Bool
    let toggle: () -> Void

    private var isNow: Bool {
        guard let start = item.start, let end = item.end else { return false }
        return start <= now && end > now
    }

    private var isPast: Bool {
        guard let end = item.end ?? item.start else { return false }
        return end <= now
    }

    var body: some View {
        Button(action: toggle) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(spacing: 2) {
                        Text(item.startTime).font(.system(.headline, design: .rounded).weight(.heavy)).monospacedDigit()
                        if item.end != nil {
                            Text(item.endTime).font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(FSYPalette.muted)
                        }
                    }
                    .foregroundStyle(FSYPalette.ink)
                    .frame(minWidth: 52)

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Pill(text: item.category, icon: CategoryStyle.icon(item.category), fill: CategoryStyle.color(item.category))
                            if isNow { Pill(text: "Agora", icon: "dot.radiowaves.left.and.right", fill: FSYPalette.coral) }
                            if item.isHighlight { Image(systemName: "star.fill").foregroundStyle(Color(hex: 0xFFB81C)).accessibilityLabel("Destaque") }
                        }
                        Text(item.title)
                            .font(FSYFont.title())
                            .foregroundStyle(FSYPalette.ink)
                            .multilineTextAlignment(.leading)
                        Label(item.location, systemImage: "mappin.and.ellipse")
                            .font(FSYFont.body())
                            .foregroundStyle(FSYPalette.muted)
                    }
                    Spacer(minLength: 0)
                    if item.description?.isEmpty == false {
                        Image(systemName: "chevron.down")
                            .rotationEffect(.degrees(expanded ? 180 : 0))
                            .foregroundStyle(FSYPalette.muted)
                            .accessibilityHidden(true)
                    }
                }
                if expanded, let description = item.description, !description.isEmpty {
                    Text(description)
                        .font(FSYFont.body())
                        .foregroundStyle(FSYPalette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .fsyCard(fill: isNow ? FSYPalette.parchment : FSYPalette.surface, padding: 16)
        .opacity(isPast && !isNow ? 0.72 : 1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.timeRange), \(item.title), \(item.location)\(isNow ? ", acontecendo agora" : "")")
        .accessibilityHint(item.description?.isEmpty == false ? (expanded ? "Recolher descrição" : "Mostrar descrição") : "")
    }
}
