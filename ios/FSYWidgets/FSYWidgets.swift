import ActivityKit
import SwiftUI
import WidgetKit

@main
struct FSYWidgetsBundle: WidgetBundle {
    var body: some Widget {
        NextActivityWidget()
        ScheduleLiveActivity()
    }
}

// MARK: - Próxima atividade

struct NextActivityEntry: TimelineEntry {
    let date: Date
    let current: WidgetActivity?
    let next: WidgetActivity?
    let hasData: Bool
}

struct NextActivityProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextActivityEntry {
        NextActivityEntry(date: Date(), current: nil, next: WidgetActivity(
            id: "placeholder", title: "Programação da sessão", location: "FSY Ribeirão Preto 2",
            category: "Geral", start: Date().addingTimeInterval(1800), end: nil), hasData: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextActivityEntry) -> Void) {
        completion(entry(at: Date(), snapshot: WidgetSnapshotStore.load()) ?? placeholder(in: context))
    }

    /// Uma entrada por início/fim de atividade: o widget muda sozinho sem rede nem token.
    func getTimeline(in context: Context, completion: @escaping (Timeline<NextActivityEntry>) -> Void) {
        let now = Date()
        guard let snapshot = WidgetSnapshotStore.load() else {
            completion(Timeline(entries: [NextActivityEntry(date: now, current: nil, next: nil, hasData: false)], policy: .never))
            return
        }
        var boundaries = Set<Date>([now])
        for activity in snapshot.activities {
            if activity.start > now { boundaries.insert(activity.start) }
            if let end = activity.end, end > now { boundaries.insert(end) }
        }
        let entries = boundaries.sorted().prefix(30).compactMap { entry(at: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(at date: Date, snapshot: WidgetSnapshot?) -> NextActivityEntry? {
        guard let snapshot else { return nil }
        return NextActivityEntry(date: date, current: snapshot.current(at: date), next: snapshot.next(after: date), hasData: true)
    }
}

struct NextActivityWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FSYNextActivity", provider: NextActivityProvider()) { entry in
            NextActivityView(entry: entry)
                .containerBackground(for: .widget) { FSYPalette.background }
        }
        .configurationDisplayName("Próxima atividade")
        .description("Atividade atual e a seguinte da programação FSY.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct NextActivityView: View {
    let entry: NextActivityEntry
    @Environment(\.widgetFamily) private var family

    private var focus: WidgetActivity? { entry.current ?? entry.next }

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                if let focus {
                    Text("\(entry.current != nil ? "Agora" : EventCalendar.timeString(focus.start)) · \(focus.title)")
                } else {
                    Text("FSY · abra o app")
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.current != nil ? "AGORA" : "PRÓXIMA").font(.caption2.weight(.bold))
                    Text(focus?.title ?? "Abra o app FSY").font(.headline).lineLimit(2)
                    if let focus { Text("\(EventCalendar.timeString(focus.start)) · \(focus.location)").font(.caption2).lineLimit(1) }
                }
            default:
                regular
            }
        }
        .widgetURL(DeepLinkURL.agenda(focus?.id))
    }

    private var regular: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                FSYCirclesMark(size: 18)
                Spacer()
                if entry.current != nil {
                    Text("AGORA")
                        .font(.caption2.weight(.heavy))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(FSYPalette.coral))
                        .foregroundStyle(FSYPalette.fixedInk)
                }
            }
            if let focus {
                Text(focus.title)
                    .font(.system(.headline, design: .serif).weight(.bold))
                    .foregroundStyle(FSYPalette.ink)
                    .lineLimit(family == .systemSmall ? 3 : 2)
                Text("\(EventCalendar.shortDay(focus.start)) · \(EventCalendar.timeString(focus.start))")
                    .font(.caption.weight(.semibold)).foregroundStyle(FSYPalette.link)
                Text(focus.location).font(.caption).foregroundStyle(FSYPalette.muted).lineLimit(1)
                if family == .systemMedium, entry.current != nil, let next = entry.next {
                    Divider()
                    Text("A seguir: \(EventCalendar.timeString(next.start)) · \(next.title)")
                        .font(.caption).foregroundStyle(FSYPalette.ink).lineLimit(1)
                }
            } else {
                Text(entry.hasData ? "Sem próximas atividades" : "Abra o app FSY para carregar a programação")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(FSYPalette.ink)
            }
            Spacer(minLength: 0)
        }
    }
}

/// Mesma allowlist do app: só `fsyrp2://agenda[?item=<uuid>]`.
enum DeepLinkURL {
    static func agenda(_ id: String?) -> URL {
        guard let id, UUID(uuidString: id) != nil else { return URL(string: "fsyrp2://agenda")! }
        return URL(string: "fsyrp2://agenda?item=\(id.lowercased())")!
    }
}

// MARK: - Live Activity (Tela Bloqueada e Dynamic Island)

struct ScheduleLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FSYActivityAttributes.self) { context in
            LockScreenActivityView(state: context.state)
                .activityBackgroundTint(Color(hex: 0x005E7C))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    FSYCirclesMark(size: 22)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CountdownText(state: context.state).font(.headline).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Label(context.state.location, systemImage: "mappin.and.ellipse").font(.caption)
                        if let nextTitle = context.state.nextTitle, let nextStart = context.state.nextStart {
                            Text("A seguir \(EventCalendar.timeString(nextStart)): \(nextTitle)").font(.caption2).lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Text("FSY").font(.caption.weight(.heavy)).foregroundStyle(Color(hex: 0xFFE48A))
            } compactTrailing: {
                CountdownText(state: context.state).font(.caption.weight(.semibold)).monospacedDigit().frame(maxWidth: 52)
            } minimal: {
                Image(systemName: "calendar").foregroundStyle(Color(hex: 0xFFE48A))
            }
            .widgetURL(URL(string: "fsyrp2://agenda"))
        }
    }
}

/// Contagem até o início ou o fim, renderizada pelo sistema (avança sem atualização do app).
struct CountdownText: View {
    let state: FSYActivityAttributes.ContentState

    var body: some View {
        if state.start > Date() {
            Text(timerInterval: Date()...state.start, countsDown: true)
        } else if let end = state.end, end > Date() {
            Text(timerInterval: Date()...end, countsDown: true)
        } else {
            Text(EventCalendar.timeString(state.start))
        }
    }
}

struct LockScreenActivityView: View {
    let state: FSYActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            FSYCirclesMark(size: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(state.start > Date() ? "PRÓXIMA ATIVIDADE" : "ACONTECENDO AGORA")
                    .font(.caption2.weight(.heavy)).tracking(0.8)
                    .foregroundStyle(Color(hex: 0xFFE48A))
                Text(state.title).font(.headline).lineLimit(2)
                Text("\(EventCalendar.timeString(state.start))\(state.end.map { " – \(EventCalendar.timeString($0))" } ?? "") · \(state.location)")
                    .font(.caption).lineLimit(1)
                if let nextTitle = state.nextTitle, let nextStart = state.nextStart {
                    Text("A seguir \(EventCalendar.timeString(nextStart)): \(nextTitle)").font(.caption2).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            CountdownText(state: state)
                .font(.title3.weight(.bold)).monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 80)
        }
        .foregroundStyle(.white)
        .padding(16)
    }
}
