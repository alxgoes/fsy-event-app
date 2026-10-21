import Foundation

enum APIError: Error, Equatable {
    case offline
    case unauthorized
    case forbidden
    case notFound
    case rateLimited
    case server(Int)
    case invalidResponse
    case message(String)

    var userMessage: String {
        switch self {
        case .offline: "Sem conexão. Mostrando o que já estava salvo neste aparelho."
        case .unauthorized: "Sua sessão expirou. Entre novamente."
        case .forbidden: "Seu cargo não permite esta ação."
        case .notFound: "Conteúdo não encontrado."
        case .rateLimited: "Muitas tentativas. Aguarde alguns minutos."
        case .server: "Não foi possível concluir a operação. Tente novamente."
        case .invalidResponse: "Resposta inesperada do servidor."
        case .message(let text): text
        }
    }
}

/// Cliente HTTP efêmero: sem cookies, sem cache de respostas em disco.
final class HTTPClient {
    private(set) var session: URLSession

    init() {
        session = HTTPClient.makeSession()
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = 20
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }

    /// Cancela requisições em andamento (logout/troca de conta).
    func reset() {
        session.invalidateAndCancel()
        session = HTTPClient.makeSession()
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            return (data, http)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost,
                 .cannotConnectToHost, .dataNotAllowed, .internationalRoamingOff:
                throw APIError.offline
            case .cancelled:
                throw CancellationError()
            default:
                throw APIError.server(error.errorCode)
            }
        }
    }

    static func status(_ code: Int) -> APIError? {
        switch code {
        case 200..<300: nil
        case 401: .unauthorized
        case 403: .forbidden
        case 404: .notFound
        case 429: .rateLimited
        default: .server(code)
        }
    }
}
