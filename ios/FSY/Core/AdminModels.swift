import Foundation

// Contratos do painel administrativo, decodificados das mesmas APIs do site (src/types/*).
// Nada daqui é gravado em disco: dados de saúde e contas ficam só na memória da tela aberta.

/// Módulos do painel e cargos que os operam (espelho de `ROLE_GROUPS` em src/lib/auth/permissions.ts).
/// Só decide o que aparece; quem autoriza cada leitura e escrita é o servidor.
enum AdminModule: String, CaseIterable, Identifiable, Hashable {
    case overview, accounts, companies, schedule, logistics, announcements, media, health, inclusion, audit

    var id: String { rawValue }

    private static let master: Set<UserRole> = [.logistica, .coordenador, .casalDiretor]

    var roles: Set<UserRole> {
        switch self {
        case .overview, .accounts, .companies, .schedule, .logistics, .audit: Self.master
        case .announcements: Self.master.union([.consultor])
        case .media: Self.master.union([.midia])
        case .health, .inclusion: Self.master.union([.medico])
        }
    }

    static func available(for role: UserRole) -> [AdminModule] {
        allCases.filter { $0.roles.contains(role) }
    }

    var title: String {
        switch self {
        case .overview: "Visão geral"
        case .accounts: "Contas e usuários"
        case .companies: "Companhias"
        case .schedule: "Programação"
        case .logistics: "Logística e ônibus"
        case .announcements: "Comunicados"
        case .media: "Fotos e mídia"
        case .health: "Saúde e atendimentos"
        case .inclusion: "Inclusão"
        case .audit: "Auditoria dos consultores"
        }
    }

    var subtitle: String {
        switch self {
        case .overview: "Participantes, companhias e avisos"
        case .accounts: "Cargos, acesso e recuperação"
        case .companies: "Lemas, cores e consultores"
        case .schedule: "Atividades dos cinco dias"
        case .logistics: "Ônibus, motoristas e horários"
        case .announcements: "Publicar e editar avisos"
        case .media: "Registros de fotos do Drive"
        case .health: "Fichas e agenda multidisciplinar"
        case .inclusion: "Acompanhamentos e decisões"
        case .audit: "Registro de ações dos consultores"
        }
    }

    var icon: String {
        switch self {
        case .overview: "chart.bar.xaxis"
        case .accounts: "person.2.badge.key.fill"
        case .companies: "shield.lefthalf.filled"
        case .schedule: "calendar.badge.clock"
        case .logistics: "bus.fill"
        case .announcements: "megaphone.fill"
        case .media: "photo.stack.fill"
        case .health: "cross.case.fill"
        case .inclusion: "figure.2.and.child.holdinghands"
        case .audit: "list.clipboard.fill"
        }
    }

    /// Cor do selo do módulo (paleta 2027).
    var accent: UInt32 {
        switch self {
        case .overview: 0x007DA5
        case .accounts: 0xFC4E6D
        case .companies: 0x93C742
        case .schedule: 0xFFB81C
        case .logistics: 0x01B6D1
        case .announcements: 0xF68D2E
        case .media: 0xFDA192
        case .health: 0xB91C1C
        case .inclusion: 0x8B5CF6
        case .audit: 0x64748B
        }
    }
}

/// Decodificação tolerante: `null`, ausência ou tipo trocado (ex.: número vindo como texto) viram padrão.
extension KeyedDecodingContainer {
    func text(_ key: Key) -> String? {
        if let value = try? decodeIfPresent(String.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(Int.self, forKey: key) { return String(value) }
        return nil
    }

    func number(_ key: Key) -> Int? {
        if let value = try? decodeIfPresent(Int.self, forKey: key) { return value }
        if let value = try? decodeIfPresent(Double.self, forKey: key) { return Int(value) }
        if let raw = try? decodeIfPresent(String.self, forKey: key) { return Int(raw.trimmingCharacters(in: .whitespaces)) }
        return nil
    }

    func flag(_ key: Key) -> Bool? {
        try? decodeIfPresent(Bool.self, forKey: key)
    }
}

struct AnyKey: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }
    init(_ string: String) { stringValue = string }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
}

/// Data e hora ISO do Supabase (com ou sem frações, `Z` ou deslocamento).
enum ISODate {
    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: raw) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: raw) { return date }
        return Timestamp.parse(raw)
    }

    static func string(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = EventCalendar.timeZone
        return formatter.string(from: date)
    }
}

// MARK: Visão geral

struct AdminOverview: Decodable, Equatable {
    struct Recent: Decodable, Equatable, Identifiable {
        let id: String
        let title: String
        let priority: String
        let category: String
        let createdAt: Date?

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: AnyKey.self)
            id = c.text(AnyKey("id")) ?? UUID().uuidString
            title = c.text(AnyKey("title")) ?? ""
            priority = c.text(AnyKey("priority")) ?? "normal"
            category = Announcement.baseCategory(c.text(AnyKey("category")))
            createdAt = ISODate.parse(c.text(AnyKey("created_at")))
        }
    }

    let totalYouth: Int
    let youthWithCompany: Int
    let youthWithRoom: Int
    let totalCompanies: Int
    let totalCounselors: Int
    let medicalRecords: Int
    let totalAnnouncements: Int
    let totalPhotos: Int
    let recent: [Recent]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        totalYouth = c.number(AnyKey("total_youth")) ?? 0
        youthWithCompany = c.number(AnyKey("youth_with_company")) ?? 0
        youthWithRoom = c.number(AnyKey("youth_with_room")) ?? 0
        totalCompanies = c.number(AnyKey("total_companies")) ?? 0
        totalCounselors = c.number(AnyKey("total_counselors")) ?? 0
        medicalRecords = c.number(AnyKey("medical_records")) ?? 0
        totalAnnouncements = c.number(AnyKey("total_announcements")) ?? 0
        totalPhotos = c.number(AnyKey("total_photos")) ?? 0
        recent = (try? c.decodeIfPresent([Recent].self, forKey: AnyKey("recent_announcements"))) ?? []
    }
}

// MARK: Contas

struct AdminAccount: Decodable, Identifiable, Equatable {
    let id: String
    let fullName: String
    let email: String?
    let role: UserRole?
    let companyID: String?
    let companyName: String?
    let stake: String?
    let room: String?
    let phone: String?
    let providers: [String]
    let hasPassword: Bool
    let lastSignInAt: Date?
    let createdAt: Date?
    let suspended: Bool
    let status: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        fullName = c.text(AnyKey("full_name")) ?? "Sem nome"
        email = c.text(AnyKey("email"))
        role = c.text(AnyKey("role")).flatMap(UserRole.init(rawValue:))
        companyID = c.text(AnyKey("company_id"))
        companyName = c.text(AnyKey("company_name"))
        stake = c.text(AnyKey("stake"))
        room = c.text(AnyKey("room"))
        phone = c.text(AnyKey("phone"))
        providers = (try? c.decodeIfPresent([String].self, forKey: AnyKey("providers"))) ?? []
        hasPassword = c.flag(AnyKey("has_password")) ?? false
        lastSignInAt = ISODate.parse(c.text(AnyKey("last_sign_in_at")))
        createdAt = ISODate.parse(c.text(AnyKey("created_at")))
        suspended = c.flag(AnyKey("suspended")) ?? false
        status = c.text(AnyKey("status")) ?? "ativo"
    }

    var statusLabel: String {
        switch status {
        case "suspenso": "Suspensa"
        case "aguardando_confirmacao": "Aguardando confirmação"
        case "sem_perfil": "Sem perfil"
        default: "Ativa"
        }
    }
}

enum AccountAction: String, CaseIterable {
    case edit, role, suspend, reactivate, delete
    case recoveryEmail = "recovery_email"
    case setPassword = "set_password"
    case email
}

struct AccountList: Decodable {
    let data: [AdminAccount]
    let total: Int
    let page: Int
    let perPage: Int
    /// Ações que o servidor permite ao operador em cada conta.
    let permissions: [String: Set<AccountAction>]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        data = (try? c.decode([AdminAccount].self, forKey: AnyKey("data"))) ?? []
        total = c.number(AnyKey("total")) ?? data.count
        page = c.number(AnyKey("page")) ?? 1
        perPage = c.number(AnyKey("per_page")) ?? 25
        let raw = (try? c.decodeIfPresent([String: [String]].self, forKey: AnyKey("permissions"))) ?? [:]
        permissions = raw.mapValues { Set($0.compactMap(AccountAction.init(rawValue:))) }
    }
}

struct AccountEvent: Decodable, Identifiable {
    let id: String
    let actorName: String
    let action: String
    let createdAt: Date?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.text(AnyKey("id")) ?? UUID().uuidString
        actorName = c.text(AnyKey("actor_name")) ?? "Equipe"
        action = c.text(AnyKey("action")) ?? ""
        createdAt = ISODate.parse(c.text(AnyKey("created_at")))
    }

    var actionLabel: String {
        switch action {
        case "edit": "Dados editados"
        case "role": "Cargo alterado"
        case "suspend": "Acesso suspenso"
        case "reactivate": "Acesso reativado"
        case "delete": "Conta excluída"
        case "recovery_email": "Link de recuperação enviado"
        case "set_password": "Senha definida pela gestão"
        case "email": "E-mail enviado"
        default: action
        }
    }
}

// MARK: Companhias

struct AdminCompany: Decodable, Identifiable, Equatable {
    struct Counselor: Decodable, Identifiable, Equatable, Hashable {
        let id: String
        let fullName: String
        let companyID: String?

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: AnyKey.self)
            id = try c.decode(String.self, forKey: AnyKey("id"))
            fullName = c.text(AnyKey("full_name")) ?? "Consultor"
            companyID = c.text(AnyKey("company_id"))
        }
    }

    let id: String
    let name: String
    let motto: String?
    let color: String?
    let counselorNames: [String]
    let youthCount: Int?
    let counselorProfiles: [Counselor]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        name = c.text(AnyKey("name")) ?? id
        motto = c.text(AnyKey("motto"))
        color = c.text(AnyKey("color"))
        counselorNames = (try? c.decodeIfPresent([String].self, forKey: AnyKey("counselors"))) ?? []
        youthCount = c.number(AnyKey("youth_count"))
        counselorProfiles = (try? c.decodeIfPresent([Counselor].self, forKey: AnyKey("counselor_profiles"))) ?? []
    }

    var hexColor: UInt32? {
        guard let color, color.hasPrefix("#"), color.count == 7 else { return nil }
        return UInt32(color.dropFirst(), radix: 16)
    }
}

struct CompaniesPayload: Decodable {
    let companies: [AdminCompany]
    let allCounselors: [AdminCompany.Counselor]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        companies = (try? c.decode([AdminCompany].self, forKey: AnyKey("companies"))) ?? []
        allCounselors = (try? c.decodeIfPresent([AdminCompany.Counselor].self, forKey: AnyKey("all_counselors"))) ?? []
    }
}

// MARK: Logística

struct TransportBus: Decodable, Identifiable, Equatable {
    static let statuses: [(String, String)] = [
        ("programado", "Programado"), ("a_caminho", "A caminho"), ("chegou", "Chegou"),
        ("retornando", "Retornando"), ("concluido", "Concluído"),
    ]

    let id: String
    let busNumber: String
    let stakeCity: String
    let driverName: String
    let driverPhone: String
    let capacity: Int
    let passengers: Int
    let departureCityTime: String
    let arrivalTime: String
    let departureFSYTime: String
    let status: String
    let notes: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        busNumber = c.text(AnyKey("bus_number")) ?? "—"
        stakeCity = c.text(AnyKey("stake_city")) ?? ""
        driverName = c.text(AnyKey("driver_name")) ?? ""
        driverPhone = c.text(AnyKey("driver_phone")) ?? ""
        capacity = c.number(AnyKey("capacity")) ?? 0
        passengers = c.number(AnyKey("passengers_count")) ?? 0
        departureCityTime = c.text(AnyKey("departure_city_time")) ?? "--"
        arrivalTime = c.text(AnyKey("arrival_fsy_time")) ?? "--"
        departureFSYTime = c.text(AnyKey("departure_fsy_time")) ?? "--"
        status = c.text(AnyKey("status")) ?? "programado"
        notes = c.text(AnyKey("notes"))
    }

    var statusLabel: String { Self.statuses.first { $0.0 == status }?.1 ?? status }
    var occupancy: Double { capacity > 0 ? min(Double(passengers) / Double(capacity), 1) : 0 }
}

// MARK: Mídia

struct MediaRecord: Decodable, Identifiable, Equatable {
    let id: String
    let title: String
    let driveURL: String
    let thumbnailURL: URL?
    let category: String
    let visible: Bool
    let createdAt: Date?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        title = c.text(AnyKey("title")) ?? "Sem título"
        driveURL = c.text(AnyKey("drive_url")) ?? ""
        thumbnailURL = c.text(AnyKey("thumbnail_url")).flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
        category = c.text(AnyKey("category")) ?? "Geral"
        visible = c.flag(AnyKey("visible")) ?? true
        createdAt = ISODate.parse(c.text(AnyKey("created_at")))
    }
}

// MARK: Saúde

/// Ficha de saúde. Mantida só em memória enquanto a tela está aberta.
struct MedicalRecord: Decodable, Identifiable, Equatable {
    let id: String
    let fields: [String: String]
    let severeAllergy: Bool
    let createdAt: Date?

    /// Campos editáveis (mesmos de `medicalRecordSchema`).
    static let editable = [
        "full_name", "company_id", "room", "allergies", "dietary_restrictions", "medications", "blood_type",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_rel",
        "contact_2_name", "contact_2_phone", "contact_2_relationship",
        "contact_3_name", "contact_3_phone", "contact_3_relationship",
        "bishop_name", "bishop_phone", "bishop_ward", "doctor_notes",
    ]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        var values: [String: String] = [:]
        for key in Self.editable + ["user_id"] {
            if let value = c.text(AnyKey(key)), !value.isEmpty { values[key] = value }
        }
        fields = values
        severeAllergy = c.flag(AnyKey("is_severe_allergy")) ?? false
        createdAt = ISODate.parse(c.text(AnyKey("created_at")))
    }

    subscript(_ key: String) -> String { fields[key] ?? "" }
    var fullName: String { fields["full_name"] ?? "Sem nome" }
    var hasAllergy: Bool { !(self["allergies"].isEmpty) && self["allergies"].lowercased() != "nenhuma" }
}

struct Appointment: Decodable, Identifiable, Equatable {
    static let statuses: [(String, String)] = [("agendado", "Agendado"), ("realizado", "Realizado"), ("cancelado", "Cancelado")]

    let id: String
    let youthName: String
    let professionalName: String
    let reason: String
    let scheduledAt: Date?
    let status: String
    let notes: String?
    let isSeen: Bool
    let medicalRecordID: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        youthName = c.text(AnyKey("youth_name")) ?? "Participante"
        professionalName = c.text(AnyKey("professional_name")) ?? ""
        reason = c.text(AnyKey("reason")) ?? ""
        scheduledAt = ISODate.parse(c.text(AnyKey("scheduled_at")))
        status = c.text(AnyKey("status")) ?? "agendado"
        notes = c.text(AnyKey("notes"))
        isSeen = c.flag(AnyKey("is_seen")) ?? false
        medicalRecordID = c.text(AnyKey("medical_record_id"))
    }

    var statusLabel: String { Self.statuses.first { $0.0 == status }?.1 ?? status }
}

// MARK: Inclusão

struct InclusionContact: Decodable, Equatable {
    var name = ""
    var phone = ""
    var relationship = ""
    var ward = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        name = c.text(AnyKey("name")) ?? ""
        phone = c.text(AnyKey("phone")) ?? ""
        relationship = c.text(AnyKey("relationship")) ?? ""
        ward = c.text(AnyKey("ward")) ?? ""
    }

    var json: JSONValue {
        .object(["name": .string(name), "phone": .string(phone), "relationship": .string(relationship), "ward": .string(ward)])
    }
}

struct InclusionCase: Decodable, Identifiable, Equatable {
    static let phases: [(String, String)] = [
        ("triagem", "Triagem"), ("contato", "Contato com responsáveis"), ("entrevistas", "Entrevistas"),
        ("analise", "Análise da equipe"), ("concluido", "Decisão registrada"), ("arquivado", "Arquivado"),
    ]
    static let decisions: [(String, String)] = [
        ("participacao_confirmada", "Participação confirmada"),
        ("participacao_com_apoio", "Participação com apoio"),
        ("participacao_nao_recomendada", "Participação não recomendada"),
    ]

    struct Interview: Decodable, Identifiable, Equatable {
        let id: String
        let scheduledAt: Date?
        let participants: String
        let status: String
        let summary: String

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: AnyKey.self)
            id = try c.decode(String.self, forKey: AnyKey("id"))
            scheduledAt = ISODate.parse(c.text(AnyKey("scheduled_at")))
            participants = c.text(AnyKey("participants")) ?? ""
            status = c.text(AnyKey("status")) ?? "agendada"
            summary = c.text(AnyKey("summary")) ?? ""
        }
    }

    struct History: Decodable, Identifiable, Equatable {
        let id: String
        let action: String
        let actorName: String
        let createdAt: Date?

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: AnyKey.self)
            id = c.text(AnyKey("id")) ?? UUID().uuidString
            action = c.text(AnyKey("action")) ?? ""
            actorName = c.text(AnyKey("actor_name")) ?? "Equipe"
            createdAt = ISODate.parse(c.text(AnyKey("created_at")))
        }
    }

    let id: String
    let fullName: String
    let phase: String
    let needs: String
    let supportPlan: String
    let parent: InclusionContact
    let bishop: InclusionContact
    let version: Int
    let decision: String?
    let decisionReason: String?
    let updatedAt: Date?
    let interviews: [Interview]
    let history: [History]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        fullName = c.text(AnyKey("full_name")) ?? "Participante"
        phase = c.text(AnyKey("phase")) ?? "triagem"
        needs = c.text(AnyKey("needs")) ?? ""
        supportPlan = c.text(AnyKey("support_plan")) ?? ""
        struct Contacts: Decodable { let parent: InclusionContact?; let bishop: InclusionContact? }
        let contacts = try? c.decodeIfPresent(Contacts.self, forKey: AnyKey("contacts"))
        parent = contacts?.parent ?? InclusionContact()
        bishop = contacts?.bishop ?? InclusionContact()
        version = c.number(AnyKey("version")) ?? 1
        decision = c.text(AnyKey("decision"))
        decisionReason = c.text(AnyKey("decision_reason"))
        updatedAt = ISODate.parse(c.text(AnyKey("updated_at")))
        interviews = (try? c.decodeIfPresent([Interview].self, forKey: AnyKey("interviews"))) ?? []
        history = (try? c.decodeIfPresent([History].self, forKey: AnyKey("history"))) ?? []
    }

    var phaseLabel: String { Self.phases.first { $0.0 == phase }?.1 ?? phase }
    var decisionLabel: String? { decision.flatMap { d in Self.decisions.first { $0.0 == d }?.1 } }
}

// MARK: Auditoria

struct CounselorAuditEntry: Decodable, Identifiable, Equatable {
    let id: String
    let authorName: String
    let companyName: String?
    let companyID: String?
    let actionLabel: String
    let title: String?
    let content: String
    let createdAt: Date?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = try c.decode(String.self, forKey: AnyKey("id"))
        authorName = c.text(AnyKey("author_name")) ?? "Consultor"
        companyName = c.text(AnyKey("company_name"))
        companyID = c.text(AnyKey("company_id"))
        actionLabel = c.text(AnyKey("action_label")) ?? (c.text(AnyKey("action_type")) ?? "Ação")
        title = c.text(AnyKey("title"))
        content = c.text(AnyKey("content")) ?? ""
        createdAt = ISODate.parse(c.text(AnyKey("created_at")))
    }
}

// MARK: Programação (escrita)

enum ScheduleDays {
    static let keys = ["dia0", "dia1", "dia2", "dia3", "dia4", "dia5"]
    static let categories = ["Espiritual", "Alimentação", "Atividade", "Show", "Baile", "Logística", "Equipe", "Geral"]

    static func label(_ key: String) -> String {
        key == "dia0" ? "Dia Zero" : "Dia \(key.dropFirst(3))"
    }
}
