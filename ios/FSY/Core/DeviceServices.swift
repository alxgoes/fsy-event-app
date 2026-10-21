import ActivityKit
import Foundation
import Network
import Observation
import UserNotifications
import WidgetKit

/// Estado da rede para o aviso "sem conexão". Não dispara sincronização sozinho.
@MainActor @Observable
final class Connectivity {
    private(set) var isOnline = true
    @ObservationIgnored private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: DispatchQueue(label: "fsy.connectivity"))
    }
}

/// Lembretes locais 10 minutos antes das atividades, com ação que abre a agenda pelo deep link permitido.
/// Push remoto (APNs) não está implementado: exige credenciais e backend.
@MainActor
final class ReminderScheduler {
    static let category = "FSY_ATIVIDADE"
    static let openAction = "FSY_ABRIR_AGENDA"
    private static let prefix = "fsy.reminder."
    private static let leadTime: TimeInterval = 10 * 60
    /// O iOS mantém até 64 pendentes por app; deixamos folga.
    private static let limit = 48

    private let center = UNUserNotificationCenter.current()

    func registerCategories() {
        let open = UNNotificationAction(identifier: Self.openAction, title: "Ver na agenda", options: [.foreground])
        let category = UNNotificationCategory(identifier: Self.category, actions: [open], intentIdentifiers: [], options: [])
        center.setNotificationCategories([category])
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Pedido feito só quando a pessoa ativa os lembretes no Perfil.
    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func reschedule(items: [ScheduleItem], now: Date = Date()) async {
        await cancelAll()
        let upcoming = items
            .compactMap { item -> (ScheduleItem, Date)? in
                guard let start = item.start, start.addingTimeInterval(-Self.leadTime) > now else { return nil }
                return (item, start)
            }
            .sorted { $0.1 < $1.1 }
            .prefix(Self.limit)

        for (item, start) in upcoming {
            let content = UNMutableNotificationContent()
            content.title = "Em 10 min: \(item.title)"
            content.body = "\(item.location) · \(item.startTime)"
            content.sound = .default
            content.categoryIdentifier = Self.category
            content.threadIdentifier = "fsy.agenda"
            content.userInfo = ["deeplink": DeepLink(tab: .agenda, itemID: item.id).url.absoluteString]

            let fire = start.addingTimeInterval(-Self.leadTime)
            let components = EventCalendar.calendar.dateComponents(in: EventCalendar.timeZone, from: fire)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: Self.prefix + item.id, content: content, trigger: trigger))
        }
    }

    func cancelAll() async {
        let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(Self.prefix) }
        center.removePendingNotificationRequests(withIdentifiers: pending)
        let delivered = await center.deliveredNotifications().map(\.request.identifier).filter { $0.hasPrefix(Self.prefix) }
        center.removeDeliveredNotifications(withIdentifiers: delivered)
    }
}

/// Live Activity na Tela Bloqueada (e Dynamic Island nos modelos que a têm). Atualizada quando o app
/// recarrega em primeiro plano; o contador avança sozinho pelo sistema. Sem push de atualização.
@MainActor
final class LiveActivityController {
    var isSupported: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }
    var isRunning: Bool { !Activity<FSYActivityAttributes>.activities.isEmpty }

    static func state(for moment: EventMoment) -> FSYActivityAttributes.ContentState? {
        guard let focus = moment.current ?? moment.next, let start = focus.start else { return nil }
        let following = moment.current == nil ? nil : moment.next
        return FSYActivityAttributes.ContentState(
            title: focus.title,
            location: focus.location,
            start: start,
            end: focus.end,
            nextTitle: following?.title,
            nextStart: following?.start
        )
    }

    func start(_ state: FSYActivityAttributes.ContentState) async throws {
        await endAll()
        let content = ActivityContent(state: state, staleDate: state.end ?? state.start.addingTimeInterval(3600))
        _ = try Activity.request(attributes: FSYActivityAttributes(sessionName: "Sessão Ribeirão Preto 2"), content: content, pushType: nil)
    }

    func update(_ state: FSYActivityAttributes.ContentState?) async {
        for activity in Activity<FSYActivityAttributes>.activities {
            if let state {
                await activity.update(ActivityContent(state: state, staleDate: state.end ?? state.start.addingTimeInterval(3600)))
            } else {
                await activity.end(nil, dismissalPolicy: .default)
            }
        }
    }

    func endAll() async {
        for activity in Activity<FSYActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}

/// Resumo da agenda para os widgets (somente com App Group configurado).
enum WidgetBridge {
    static func publish(items: [ScheduleItem], now: Date = Date()) {
        guard WidgetSnapshotStore.isAvailable else { return }
        let activities = items
            .filter { $0.day != "dia0" }
            .compactMap { item -> WidgetActivity? in
                guard let start = item.start else { return nil }
                if let end = item.end, end <= now { return nil }
                if item.end == nil, start <= now { return nil }
                return WidgetActivity(id: item.id, title: item.title, location: item.location,
                                      category: item.category, start: start, end: item.end)
            }
            .sorted { $0.start < $1.start }
            .prefix(12)
        WidgetSnapshotStore.save(WidgetSnapshot(generatedAt: now, activities: Array(activities)))
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func clear() {
        WidgetSnapshotStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
    }
}
