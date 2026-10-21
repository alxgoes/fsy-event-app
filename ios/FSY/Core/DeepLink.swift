import Foundation

enum AppTab: String, Hashable, CaseIterable {
    case inicio, agenda, avisos, perfil
}

/// Links internos `fsyrp2://<aba>[?item=<uuid>]`. Allowlist fechada: qualquer outro esquema,
/// host, caminho ou parâmetro é recusado. Nunca carrega tokens nem dados pessoais.
struct DeepLink: Equatable {
    static let scheme = "fsyrp2"

    let tab: AppTab
    let itemID: String?

    init(tab: AppTab, itemID: String? = nil) {
        self.tab = tab
        self.itemID = itemID
    }

    init?(url: URL) {
        guard url.scheme?.lowercased() == DeepLink.scheme,
              let host = url.host?.lowercased(), let tab = AppTab(rawValue: host),
              url.path.isEmpty || url.path == "/",
              url.user == nil, url.password == nil, url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }

        let items = components.queryItems ?? []
        var itemID: String?
        for item in items {
            guard item.name == "item", tab == .agenda || tab == .avisos,
                  let value = item.value, UUID(uuidString: value) != nil, itemID == nil else { return nil }
            itemID = value.lowercased()
        }
        self.init(tab: tab, itemID: itemID)
    }

    var url: URL {
        var components = URLComponents()
        components.scheme = DeepLink.scheme
        components.host = tab.rawValue
        if let itemID { components.queryItems = [URLQueryItem(name: "item", value: itemID)] }
        return components.url!
    }
}
