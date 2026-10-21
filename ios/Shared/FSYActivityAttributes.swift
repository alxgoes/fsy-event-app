import ActivityKit
import Foundation

/// Live Activity da programação. Só leva dados públicos da agenda: nada de identidade, contatos ou saúde.
struct FSYActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var location: String
        var start: Date
        var end: Date?
        var nextTitle: String?
        var nextStart: Date?
    }

    var sessionName: String
}
