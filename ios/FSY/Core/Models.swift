import Foundation

/// Cargos de `public.user_role`. Valor desconhecido vira `jovem` (menor privilégio).
enum UserRole: String, Codable, CaseIterable {
    case jovem, consultor, midia, medico, logistica, coordenador
    case casalDiretor = "casal_diretor"

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = UserRole(rawValue: raw) ?? .jovem
    }

    /// Mesmos rótulos de `ROLE_LABELS` no portal.
    var label: String {
        switch self {
        case .jovem: "Jovem"
        case .consultor: "Consultor(a)"
        case .midia: "Mídia"
        case .medico: "Equipe Multidisciplinar"
        case .logistica: "Logística"
        case .coordenador: "Coordenador(a)"
        case .casalDiretor: "Casal Diretor"
        }
    }

    /// `isStaff` do portal: todos exceto jovem (vê o Dia Zero da equipe).
    var isStaff: Bool { self != .jovem }

    /// Logística, Coordenação e Casal Diretor têm autoridade administrativa equivalente.
    var isManager: Bool { self == .logistica || self == .coordenador || self == .casalDiretor }

    /// Página inicial do cargo no portal (`homePathForRole`), aberta fora do app para gestão.
    var portalHomePath: String {
        switch self {
        case .jovem: "/dashboard"
        case .consultor: "/consultor"
        case .midia: "/admin/media"
        case .medico: "/admin/medical"
        case .logistica, .coordenador, .casalDiretor: "/admin"
        }
    }
}

struct Profile: Codable, Equatable {
    let id: String
    let fullName: String
    let role: UserRole
    let companyID: String?
    let stake: String?
    let room: String?
    let suspendedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, role, stake, room
        case fullName = "full_name"
        case companyID = "company_id"
        case suspendedAt = "suspended_at"
    }

    var firstName: String {
        fullName.split(separator: " ").first.map(String.init) ?? fullName
    }

    var isSuspended: Bool { !(suspendedAt ?? "").isEmpty }
}

struct Company: Codable, Equatable {
    let id: String
    let name: String
    let motto: String?
    let color: String?
    let counselors: [String]?
}

struct ScheduleItem: Codable, Equatable, Identifiable {
    let id: String
    let day: String
    let date: String
    let title: String
    let startTime: String
    let endTime: String
    let location: String
    let description: String?
    let category: String
    let isHighlight: Bool

    enum CodingKeys: String, CodingKey {
        case id, day, date, title, location, description, category
        case startTime = "start_time"
        case endTime = "end_time"
        case isHighlight = "is_highlight"
    }

    var start: Date? { EventCalendar.date(day: date, time: startTime) }
    var end: Date? { EventCalendar.date(day: date, time: endTime) }

    /// "07:30 – 08:00", ou só o início quando o término é "--".
    var timeRange: String {
        guard end != nil else { return startTime }
        return "\(startTime) – \(endTime)"
    }
}

enum AnnouncementPriority: String, Codable {
    case normal, important, urgent

    /// Aceita os valores legados (baixa/alta/urgente), como `announcementPrioritySchema`.
    init(raw: String) {
        switch raw {
        case "urgent", "urgente": self = .urgent
        case "important", "alta": self = .important
        default: self = .normal
        }
    }
}

struct Announcement: Decodable, Equatable, Identifiable {
    struct Author: Decodable, Equatable {
        let fullName: String?
        let role: UserRole?
        enum CodingKeys: String, CodingKey {
            case role
            case fullName = "full_name"
        }
    }

    let id: String
    let title: String
    let content: String
    let priority: AnnouncementPriority
    let category: String
    let createdAt: Date?
    let targetCompanyID: String?
    let author: Author?

    enum CodingKeys: String, CodingKey {
        case id, title, content, priority, category
        case createdAt = "created_at"
        case targetCompanyID = "target_company_id"
        case author = "profiles"
    }

    init(id: String, title: String, content: String, priority: AnnouncementPriority, category: String,
         createdAt: Date?, targetCompanyID: String?, author: Author?) {
        self.id = id
        self.title = title
        self.content = content
        self.priority = priority
        self.category = category
        self.createdAt = createdAt
        self.targetCompanyID = targetCompanyID
        self.author = author
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        content = try container.decode(String.self, forKey: .content)
        priority = AnnouncementPriority(raw: try container.decodeIfPresent(String.self, forKey: .priority) ?? "normal")
        category = Announcement.baseCategory(try container.decodeIfPresent(String.self, forKey: .category))
        createdAt = (try container.decodeIfPresent(String.self, forKey: .createdAt)).flatMap(Timestamp.parse)
        targetCompanyID = try container.decodeIfPresent(String.self, forKey: .targetCompanyID)
        author = try? container.decodeIfPresent(Author.self, forKey: .author)
    }

    /// Remove o sufixo legado "__LIKES__" (mesma regra de `baseCategory` no portal).
    static func baseCategory(_ raw: String?) -> String {
        let value = (raw ?? "").isEmpty ? "Geral" : raw!
        guard let range = value.range(of: "__LIKES__") else { return value }
        let base = String(value[..<range.lowerBound])
        return base.isEmpty ? "Geral" : base
    }
}

extension Announcement: Encodable {
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(content, forKey: .content)
        try container.encode(priority.rawValue, forKey: .priority)
        try container.encode(category, forKey: .category)
        try container.encodeIfPresent(createdAt.map(Timestamp.format), forKey: .createdAt)
        try container.encodeIfPresent(targetCompanyID, forKey: .targetCompanyID)
        try container.encodeIfPresent(author, forKey: .author)
    }
}

extension Announcement.Author: Encodable {
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(fullName, forKey: .fullName)
        try container.encodeIfPresent(role, forKey: .role)
    }
}

/// `timestamptz` do PostgREST ("2026-10-20T12:34:56.123456+00:00"), com ou sem fração de segundos.
enum Timestamp {
    static func parse(_ value: String) -> Date? {
        let normalized = value.replacingOccurrences(of: " ", with: "T")
            .replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: normalized)
    }

    static func format(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }
}
