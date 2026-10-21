import Foundation

/// Atividade mínima para widgets: título, local, categoria e horários. Sem identidade nem tokens.
struct WidgetActivity: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let location: String
    let category: String
    let start: Date
    let end: Date?
}

struct WidgetSnapshot: Codable {
    let generatedAt: Date
    let activities: [WidgetActivity]

    func current(at date: Date) -> WidgetActivity? {
        activities.first { activity in
            guard let end = activity.end else { return false }
            return activity.start <= date && end > date
        }
    }

    func next(after date: Date) -> WidgetActivity? {
        activities.first { $0.start > date }
    }
}

/// Armazena o resumo no App Group, se configurado. Sem App Group (Team gratuito), o widget pede para abrir o app.
enum WidgetSnapshotStore {
    static let key = "fsy.widget.snapshot.v1"

    static var groupID: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "FSYAppGroup") as? String,
              !value.isEmpty, !value.contains("$(") else { return nil }
        return value
    }

    private static var defaults: UserDefaults? {
        groupID.flatMap { UserDefaults(suiteName: $0) }
    }

    static var isAvailable: Bool { defaults != nil }

    static func load() -> WidgetSnapshot? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    static func save(_ snapshot: WidgetSnapshot) {
        guard let defaults, let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: key)
    }

    static func clear() {
        defaults?.removeObject(forKey: key)
    }
}
