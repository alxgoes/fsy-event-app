import Foundation

/// Leituras diretas no PostgREST com o JWT da própria pessoa. As políticas RLS publicadas
/// (migrações 001–004) definem o escopo: o app não usa service_role nem amplia permissões.
struct DataClient {
    let config: AppConfig
    let http: HTTPClient

    private func get<T: Decodable>(_ table: String, _ query: [URLQueryItem], token: String) async throws -> T {
        var components = URLComponents(url: config.supabaseURL.appendingPathComponent("rest/v1/\(table)"), resolvingAgainstBaseURL: false)!
        components.queryItems = query
        var request = URLRequest(url: components.url!)
        request.setValue(config.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await http.send(request)
        if let error = HTTPClient.status(response.statusCode) {
            PhaseLog.read(table, status: response.statusCode, code: Self.postgrestCode(data))
            throw error
        }
        do {
            let value = try JSONDecoder().decode(T.self, from: data)
            PhaseLog.read(table, status: response.statusCode)
            return value
        } catch let error as DecodingError {
            PhaseLog.read(table, status: response.statusCode, code: "decoding", field: Self.fieldPath(error))
            throw APIError.invalidResponse
        } catch {
            throw APIError.invalidResponse
        }
    }

    /// `profiles_self_read`: cada pessoa lê o próprio perfil (sem telefone, que o app não usa).
    func profile(userID: String, token: String) async throws -> Profile? {
        let rows: [Profile] = try await get("profiles", [
            URLQueryItem(name: "select", value: "id,full_name,role,company_id,stake,room,suspended_at"),
            URLQueryItem(name: "id", value: "eq.\(userID)"),
        ], token: token)
        return rows.first
    }

    func company(id: String, token: String) async throws -> Company? {
        let rows: [Company] = try await get("companies", [
            URLQueryItem(name: "select", value: "id,name,motto,color,counselors"),
            URLQueryItem(name: "id", value: "eq.\(id)"),
        ], token: token)
        return rows.first
    }

    func schedule(token: String) async throws -> [ScheduleItem] {
        let rows: [ScheduleItem] = try await get("schedule_items", [
            URLQueryItem(name: "select", value: "id,day,date,title,start_time,end_time,location,description,category,is_highlight"),
            URLQueryItem(name: "order", value: "date.asc,start_time.asc"),
        ], token: token)
        // Válida = chave de dia conhecida (dia0…dia5, como o portal) e horário de início interpretável.
        PhaseLog.counts("schedule_items", rows: rows.count,
                        valid: rows.filter { EventClock.dayLabels[$0.day] != nil && $0.start != nil }.count)
        return rows
    }

    /// `announcements_scoped_read`: gerais + própria companhia; gestão vê todos (igual a GET /api/announcements).
    /// O autor é embutido pela FK `author_id`: sem a dica, `announcement_likes` (PK composta com FKs para
    /// `announcements` e `profiles`) cria um segundo caminho e o PostgREST responde 300 PGRST201.
    func announcements(token: String) async throws -> [Announcement] {
        let rows: [Announcement] = try await get("announcements", [
            URLQueryItem(name: "select", value: "id,title,content,priority,category,created_at,target_company_id,profiles!author_id(full_name,role)"),
            URLQueryItem(name: "order", value: "created_at.desc"),
            URLQueryItem(name: "limit", value: "200"),
        ], token: token)
        PhaseLog.counts("announcements", rows: rows.count, valid: rows.filter { !$0.title.isEmpty }.count)
        return rows
    }

    /// `announcement_likes_own_read`: somente as próprias curtidas.
    func likedAnnouncementIDs(userID: String, token: String) async throws -> Set<String> {
        struct Row: Decodable { let announcement_id: String }
        let rows: [Row] = try await get("announcement_likes", [
            URLQueryItem(name: "select", value: "announcement_id"),
            URLQueryItem(name: "user_id", value: "eq.\(userID)"),
        ], token: token)
        return Set(rows.map(\.announcement_id))
    }

    /// Só o código estável do PostgREST (`PGRST…` ou SQLSTATE), nunca `message`/`details`.
    private static func postgrestCode(_ data: Data) -> String? {
        struct Body: Decodable { let code: String? }
        return (try? JSONDecoder().decode(Body.self, from: data))?.code
    }

    /// Caminho de campos (nomes de chave e índices) do erro de decodificação, sem valores.
    static func fieldPath(_ error: DecodingError) -> String {
        let (kind, context): (String, DecodingError.Context?) = switch error {
        case .keyNotFound(let key, let c): ("ausente:\(key.stringValue)", c)
        case .typeMismatch(_, let c): ("tipo", c)
        case .valueNotFound(_, let c): ("nulo", c)
        case .dataCorrupted(let c): ("formato", c)
        @unknown default: ("?", nil)
        }
        let path = context?.codingPath.map { $0.intValue.map(String.init) ?? $0.stringValue }.joined(separator: ".") ?? ""
        return "\(kind) em \(path)"
    }
}
