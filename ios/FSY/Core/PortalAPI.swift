import Foundation

/// Cliente das APIs do portal (`/api/...`) com o token da pessoa no cabeçalho. Sem cookies, sem cache,
/// nada registrado em log além do caminho e do status.
struct PortalAPI {
    let config: AppConfig
    let http: HTTPClient

    func get<T: Decodable>(_ path: String, query: [String: String] = [:], token: String) async throws -> T {
        try await send("GET", path, query: query, body: nil, token: token)
    }

    func send<T: Decodable>(_ method: String, _ path: String, query: [String: String] = [:],
                            body: JSONValue?, token: String) async throws -> T {
        var components = URLComponents(url: config.portalURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpShouldHandleCookies = false
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await http.send(request)
        guard (200..<300).contains(response.statusCode) else {
            PhaseLog.read(Self.logName(path), status: response.statusCode)
            throw PortalAPI.error(status: response.statusCode, data: data)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch let error as DecodingError {
            PhaseLog.read(Self.logName(path), status: response.statusCode, code: "decoding", field: DataClient.fieldPath(error))
            throw APIError.invalidResponse
        }
    }

    /// Mensagem do servidor (já em pt-BR e sem detalhes internos) quando houver; senão a genérica do status.
    static func error(status: Int, data: Data) -> APIError {
        if status == 401 { return .unauthorized }
        struct Body: Decodable { let error: String? }
        if let message = (try? JSONDecoder().decode(Body.self, from: data))?.error?.trimmingCharacters(in: .whitespacesAndNewlines),
           !message.isEmpty, status != 500 {
            return .message(message)
        }
        return HTTPClient.status(status) ?? .server(status)
    }

    /// Só o recurso (sem IDs nem consulta) para os marcos de diagnóstico.
    private static func logName(_ path: String) -> String {
        path.split(separator: "/").filter { UUID(uuidString: String($0)) == nil }.joined(separator: "/")
    }
}

/// Corpo JSON das escritas. `null` explícito limpa um campo no servidor.
enum JSONValue: Encodable, Equatable {
    case string(String)
    case number(Double)
    case int(Int)
    case bool(Bool)
    case null
    case array([JSONValue])
    case object([String: JSONValue])

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }

    /// Texto opcional: vazio vira `null`.
    static func text(_ value: String) -> JSONValue {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? .null : .string(trimmed)
    }
}

/// Envelope `{ data: ... }` usado pela maioria das rotas.
struct DataEnvelope<T: Decodable>: Decodable {
    let data: T
}

/// Resposta cujo corpo não importa (`{ success: true }`).
struct Acknowledgement: Decodable {
    let success: Bool?
}
