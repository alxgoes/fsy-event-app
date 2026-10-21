import Foundation

/// Configuração pública lida do Info.plist (preenchido pelos .xcconfig). Só a chave publicável:
/// service_role nunca entra no app.
struct AppConfig {
    let supabaseURL: URL
    let publishableKey: String
    let portalURL: URL

    static let oauthCallbackScheme = DeepLink.scheme
    static let oauthCallbackURL = URL(string: "fsyrp2://auth-callback")!

    enum Problem: Error {
        case missing(String)

        var message: String {
            switch self {
            case .missing(let key):
                "Configuração ausente: \(key). Copie ios/Config/Local.example.xcconfig para Local.xcconfig, preencha e compile de novo."
            }
        }
    }

    static func load(bundle: Bundle = .main) -> Result<AppConfig, Problem> {
        func value(_ key: String) -> String? {
            guard let raw = bundle.object(forInfoDictionaryKey: key) as? String else { return nil }
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty || trimmed.contains("$(") || trimmed.contains("COLE_AQUI") ? nil : trimmed
        }
        guard let host = value("FSYSupabaseHost"), let url = URL(string: "https://\(host)") else {
            return .failure(.missing("SUPABASE_HOST"))
        }
        guard let key = value("FSYSupabasePublishableKey") else {
            return .failure(.missing("SUPABASE_PUBLISHABLE_KEY"))
        }
        guard let portalHost = value("FSYPortalHost"), let portal = URL(string: "https://\(portalHost)") else {
            return .failure(.missing("PORTAL_HOST"))
        }
        return .success(AppConfig(supabaseURL: url, publishableKey: key, portalURL: portal))
    }
}
