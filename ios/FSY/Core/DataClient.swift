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
        if let error = HTTPClient.status(response.statusCode) { throw error }
        do {
            return try JSONDecoder().decode(T.self, from: data)
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
        try await get("schedule_items", [
            URLQueryItem(name: "select", value: "id,day,date,title,start_time,end_time,location,description,category,is_highlight"),
            URLQueryItem(name: "order", value: "date.asc,start_time.asc"),
        ], token: token)
    }

    /// `announcements_scoped_read`: gerais + própria companhia; gestão vê todos (igual a GET /api/announcements).
    func announcements(token: String) async throws -> [Announcement] {
        try await get("announcements", [
            URLQueryItem(name: "select", value: "id,title,content,priority,category,created_at,target_company_id,profiles(full_name,role)"),
            URLQueryItem(name: "order", value: "created_at.desc"),
            URLQueryItem(name: "limit", value: "200"),
        ], token: token)
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
}
