import CryptoKit
import Foundation

/// Sessão do Supabase Auth guardada no Keychain. Nunca registrada em log nem colocada em URL.
struct AuthSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userID: String
    var email: String?

    var needsRefresh: Bool { expiresAt.timeIntervalSinceNow < 60 }
}

enum SignUpResult {
    case signedIn(AuthSession)
    case confirmationRequired
}

/// PKCE para o OAuth Google: o código só é trocado por sessão com o verificador deste aparelho.
struct PKCE {
    let verifier: String
    let challenge: String

    init() {
        var bytes = [UInt8](repeating: 0, count: 48)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        verifier = PKCE.base64URL(Data(bytes))
        challenge = PKCE.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

/// Endpoints REST do Supabase Auth (GoTrue) usados pelo portal: mesmas contas e identidades.
struct AuthClient {
    let config: AppConfig
    let http: HTTPClient

    private struct TokenResponse: Decodable {
        struct User: Decodable {
            let id: String
            let email: String?
        }
        let access_token: String?
        let refresh_token: String?
        let expires_in: Double?
        let expires_at: Double?
        let user: User?
    }

    private func authURL(_ path: String, query: [URLQueryItem] = []) -> URL {
        var components = URLComponents(url: config.supabaseURL.appendingPathComponent("auth/v1/\(path)"), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        return components.url!
    }

    private func request(_ url: URL, body: [String: Any]?, bearer: String? = nil) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(config.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        return request
    }

    private func session(from data: Data) throws -> AuthSession? {
        let token = try JSONDecoder().decode(TokenResponse.self, from: data)
        guard let access = token.access_token, let refresh = token.refresh_token, let user = token.user else { return nil }
        let expiresAt = token.expires_at.map { Date(timeIntervalSince1970: $0) }
            ?? Date().addingTimeInterval(token.expires_in ?? 3600)
        return AuthSession(accessToken: access, refreshToken: refresh, expiresAt: expiresAt, userID: user.id, email: user.email)
    }

    /// Mensagens equivalentes às da página /login, sem revelar se a conta existe.
    private func authError(_ data: Data, status: Int) -> APIError {
        let text = (String(data: data, encoding: .utf8) ?? "").lowercased()
        if text.contains("email not confirmed") || text.contains("email_not_confirmed") {
            return .message("Confirme seu e-mail pelo link que enviamos antes de entrar.")
        }
        if text.contains("invalid login credentials") || text.contains("invalid_credentials") || text.contains("invalid_grant") {
            return .message("E-mail ou senha incorretos. Confira os dados ou use “Esqueci minha senha”.")
        }
        if text.contains("user already registered") || text.contains("user_already_exists") {
            return .message("Já existe uma conta com este e-mail. Entre ou recupere o acesso.")
        }
        if text.contains("weak_password") || text.contains("password should") {
            return .message("A senha não atende à política do portal. Use ao menos 8 caracteres com letras e números.")
        }
        if text.contains("banned") || text.contains("user_banned") {
            return .message("Este acesso está suspenso. Fale com a coordenação da sessão.")
        }
        if status == 429 { return .rateLimited }
        return HTTPClient.status(status) ?? .server(status)
    }

    func signIn(email: String, password: String) async throws -> AuthSession {
        let url = authURL("token", query: [URLQueryItem(name: "grant_type", value: "password")])
        let (data, response) = try await http.send(try request(url, body: ["email": email, "password": password]))
        guard (200..<300).contains(response.statusCode), let session = try session(from: data) else {
            throw authError(data, status: response.statusCode)
        }
        return session
    }

    /// Falha 400/401 significa refresh token revogado/expirado → sessão encerrada.
    func refresh(_ current: AuthSession) async throws -> AuthSession {
        let url = authURL("token", query: [URLQueryItem(name: "grant_type", value: "refresh_token")])
        let (data, response) = try await http.send(try request(url, body: ["refresh_token": current.refreshToken]))
        if response.statusCode == 400 || response.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(response.statusCode), let session = try session(from: data) else {
            throw authError(data, status: response.statusCode)
        }
        return session
    }

    /// Cadastro com os mesmos metadados do portal; o gatilho do banco cria o perfil como `jovem`.
    func signUp(email: String, password: String, fullName: String, stake: String?, phone: String?) async throws -> SignUpResult {
        var metadata: [String: Any] = ["full_name": fullName]
        if let stake, !stake.isEmpty { metadata["stake"] = stake }
        if let phone, !phone.isEmpty { metadata["phone"] = phone }
        let (data, response) = try await http.send(try request(authURL("signup"), body: [
            "email": email, "password": password, "data": metadata,
        ]))
        guard (200..<300).contains(response.statusCode) else { throw authError(data, status: response.statusCode) }
        if let session = try session(from: data) { return .signedIn(session) }
        return .confirmationRequired
    }

    func googleAuthorizeURL(pkce: PKCE) -> URL {
        authURL("authorize", query: [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: AppConfig.oauthCallbackURL.absoluteString),
            URLQueryItem(name: "code_challenge", value: pkce.challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
        ])
    }

    /// Lê o retorno `fsyrp2://auth-callback?code=…` e troca o código pelo verificador PKCE.
    func completeGoogle(callback: URL, pkce: PKCE) async throws -> AuthSession {
        guard callback.scheme == AppConfig.oauthCallbackScheme, callback.host == "auth-callback",
              let components = URLComponents(url: callback, resolvingAgainstBaseURL: false) else {
            throw APIError.message("Retorno de autenticação inválido.")
        }
        let query = components.queryItems ?? []
        if let description = query.first(where: { $0.name == "error_description" || $0.name == "error" })?.value {
            throw APIError.message("Google não concluiu a entrada: \(description)")
        }
        guard let code = query.first(where: { $0.name == "code" })?.value else {
            throw APIError.message("O Google não devolveu um código de acesso. Confira as Redirect URLs do Supabase (docs/ios/CONTRATO-WEB.md).")
        }
        let url = authURL("token", query: [URLQueryItem(name: "grant_type", value: "pkce")])
        let (data, response) = try await http.send(try request(url, body: ["auth_code": code, "code_verifier": pkce.verifier]))
        guard (200..<300).contains(response.statusCode), let session = try session(from: data) else {
            throw authError(data, status: response.statusCode)
        }
        return session
    }

    /// Revoga somente esta sessão no Auth; falha de rede não impede a limpeza local.
    func signOut(_ session: AuthSession) async {
        let url = authURL("logout", query: [URLQueryItem(name: "scope", value: "local")])
        _ = try? await http.send(try request(url, body: nil, bearer: session.accessToken))
    }

    /// Mesmo endpoint público do portal (resposta neutra, limite de tentativas e link para /redefinir-senha).
    func requestRecovery(email: String) async throws -> String {
        var request = URLRequest(url: config.portalURL.appendingPathComponent("api/auth/recover"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email])
        let (data, response) = try await http.send(request)
        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard (200..<300).contains(response.statusCode) else {
            if let message = body?["error"] as? String { throw APIError.message(message) }
            throw HTTPClient.status(response.statusCode) ?? .server(response.statusCode)
        }
        return body?["message"] as? String
            ?? "Se este e-mail tiver uma conta com senha no portal, você receberá um link para criar uma nova senha."
    }
}
