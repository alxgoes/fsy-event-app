package br.com.fsyrp2.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

object EventIdentity {
    const val EVENT_NAME = "FSY Sessão Ribeirão Preto 2"
    const val EVENT_SHORT_NAME = "FSY Ribeirão Preto 2 — 2027"
    const val EVENT_THEME_LEAD = "Alegrar-se em"
    const val EVENT_THEME_FOCUS = "Cristo"
    const val EVENT_THEME = "Alegrar-se em Cristo"
    const val EVENT_SCRIPTURE = "Filipenses 4:4"
    const val EVENT_SCRIPTURE_QUOTE = "“Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.”"
    const val EVENT_DATES = "06 a 10 de fevereiro de 2027"
    const val EVENT_VALIDITY_SHORT = "06 a 10/02/2027"
    const val STAFF_DAY_DATE = "05 de fevereiro de 2027"
    const val STAFF_DAY_SHORT = "05/02/2027"
    const val EVENT_VENUE = "Ipê Park Hotel"
    const val EVENT_CITY_UF = "São José do Rio Preto / SP"
    const val EVENT_LOCATION_FULL = "Ipê Park Hotel — São José do Rio Preto / SP"
}

enum class AppTab(val wireHost: String, val labelPtBr: String) {
    INICIO("inicio", "Início"),
    AGENDA("agenda", "Agenda"),
    AVISOS("avisos", "Avisos"),
    PERFIL("perfil", "Mais");

    companion object {
        fun fromHost(host: String?): AppTab? {
            val normalized = host?.trim()?.lowercase() ?: return null
            if (normalized == "mais") return PERFIL
            return entries.firstOrNull { it.wireHost == normalized }
        }
    }
}

enum class AdminModule(
    val id: String,
    val title: String,
    val subtitle: String,
    val accentHex: Long
) {
    OVERVIEW("overview", "Visão geral", "Participantes, companhias e avisos", 0xFF007DA5),
    ACCOUNTS("accounts", "Contas e usuários", "Cargos, acesso e recuperação", 0xFFFC4E6D),
    COMPANIES("companies", "Companhias", "Lemas, cores e consultores", 0xFF93C742),
    SCHEDULE("schedule", "Programação", "Atividades dos cinco dias", 0xFFFFB81C),
    LOGISTICS("logistics", "Logística e ônibus", "Ônibus, motoristas e horários", 0xFF01B6D1),
    ANNOUNCEMENTS("announcements", "Comunicados", "Publicar e editar avisos", 0xFFF68D2E),
    MEDIA("media", "Fotos e mídia", "Registros de fotos do Drive", 0xFFFDA192),
    MEDICAL("health", "Saúde e atendimentos", "Fichas e agenda multidisciplinar", 0xFFB91C1C),
    INCLUSION("inclusion", "Inclusão", "Acompanhamentos e decisões", 0xFF8B5CF6),
    COUNSELOR_AUDIT("audit", "Auditoria dos consultores", "Registro de ações dos consultores", 0xFF64748B),
    REGISTRATIONS("registrations", "Inscrições e autorizações", "Planilha Excel 34 colunas e fichas PDF", 0xFF005E7C);

    val titlePt: String get() = title
    val subtitlePt: String get() = subtitle

    fun isAllowedFor(role: UserRole): Boolean = when (this) {
        OVERVIEW, ACCOUNTS, COMPANIES, SCHEDULE, LOGISTICS, COUNSELOR_AUDIT, REGISTRATIONS -> role.isManager
        ANNOUNCEMENTS -> role.canPublishAnnouncements
        MEDIA -> role.canManageMedia
        MEDICAL -> role.canReadMedical
        INCLUSION -> role.canReadInclusion
    }

    fun canAccess(role: UserRole, permissions: Set<String>): Boolean = isAllowedFor(role)

    companion object {
        fun availableFor(role: UserRole): List<AdminModule> =
            entries.filter { it.isAllowedFor(role) }
    }
}

enum class UserRole(val wireValue: String, val displayLabel: String) {
    JOVEM("jovem", "Jovem"),
    CONSULTOR("consultor", "Consultor(a)"),
    MIDIA("midia", "Mídia"),
    MEDICO("medico", "Equipe Multidisciplinar"),
    LOGISTICA("logistica", "Logística"),
    COORDENADOR("coordenador", "Coordenador(a)"),
    CASAL_DIRETOR("casal_diretor", "Casal Diretor");

    val labelPt: String get() = displayLabel

    val isStaff: Boolean
        get() = this != JOVEM

    /** Texto da interface; a API decide a aprovação com o cargo protegido da sessão. */
    val requiresProfilePhotoApproval: Boolean
        get() = this == JOVEM

    val isManager: Boolean
        get() = this == LOGISTICA || this == COORDENADOR || this == CASAL_DIRETOR

    val canAccessAdminHub: Boolean
        get() = this != JOVEM

    val canAccessCounselorPanel: Boolean
        get() = this == CONSULTOR || isManager

    val canReadOverview: Boolean
        get() = isManager

    val canManageRegistrations: Boolean
        get() = isManager

    val canReadMedical: Boolean
        get() = this == MEDICO || isManager

    val canReadInclusion: Boolean
        get() = this == MEDICO || this == CONSULTOR || isManager

    val canManageLogistics: Boolean
        get() = isManager

    val canManageMedia: Boolean
        get() = this == MIDIA || isManager

    val canPublishAnnouncements: Boolean
        get() = isManager || this == CONSULTOR

    companion object {
        fun fromWire(value: String?): UserRole {
            val normalized = value?.trim()?.lowercase() ?: return JOVEM
            return entries.firstOrNull { it.wireValue == normalized } ?: JOVEM
        }
    }
}

object PasswordPolicy {
    fun validate(password: String): String? {
        if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres."
        if (password.length > 72) return "A senha pode ter no máximo 72 caracteres."
        val hasLetter = password.any { it.isLetter() }
        val hasDigit = password.any { it.isDigit() }
        return if (hasLetter && hasDigit) null else "Use letras e números na senha."
    }
}

@Serializable
data class UserSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_at") val expiresAtEpochSeconds: Long = 0L,
    @SerialName("user_id") val userId: String,
    val email: String? = null
) {
    fun needsRefresh(nowEpochSeconds: Long = System.currentTimeMillis() / 1000L): Boolean {
        if (expiresAtEpochSeconds <= 0L) return false
        return (expiresAtEpochSeconds - nowEpochSeconds) < 60L
    }
}

sealed class SignUpResult {
    data class SignedIn(val session: UserSession) : SignUpResult()
    data object ConfirmationRequired : SignUpResult()
}

@Serializable
data class Profile(
    val id: String,
    @SerialName("full_name") val fullName: String = "Participante",
    val role: String = "jovem",
    @SerialName("company_id") val companyId: String? = null,
    val stake: String? = null,
    val room: String? = null,
    @SerialName("bus_assignment") val busAssignment: String? = null,
    val phone: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("suspended_at") val suspendedAt: String? = null
) {
    val roleEnum: UserRole get() = parsedRole
    val unit: String? get() = stake
    val permissions: Set<String> get() = emptySet()
    val parsedRole: UserRole
        get() = UserRole.fromWire(role)

    val firstName: String
        get() = fullName.trim().split(Regex("\\s+")).firstOrNull()?.ifBlank { "Participante" } ?: "Participante"

    val isSuspended: Boolean
        get() = !suspendedAt.isNullOrBlank()
}

@Serializable
data class CounselorProfileDto(
    val id: String,
    @SerialName("full_name") val fullName: String = "Consultor(a)",
    @SerialName("company_id") val companyId: String? = null
)

@Serializable
data class Company(
    val id: String,
    val name: String,
    val motto: String? = null,
    val color: String? = null,
    @SerialName("color_hex") val colorHex: String? = null,
    val room: String? = null,
    @SerialName("drive_url") val driveUrl: String? = null,
    val counselors: List<String> = emptyList(),
    @SerialName("youth_count") val youthCount: Int? = null,
    @SerialName("counselor_profiles") val counselorProfiles: List<CounselorProfileDto> = emptyList()
) {
    val resolvedColorHex: String
        get() = color ?: colorHex ?: "#007DA5"
}

@Serializable
data class CompaniesPayload(
    val companies: List<Company> = emptyList(),
    @SerialName("all_counselors") val allCounselors: List<CounselorProfileDto> = emptyList()
) {
    val counselors: List<CounselorProfileDto> get() = allCounselors
}

@Serializable
data class ScheduleItem(
    val id: String,
    val day: String,
    val date: String = "",
    val title: String,
    @SerialName("start_time") val startTime: String,
    @SerialName("end_time") val endTime: String = "--",
    val location: String = "",
    val description: String? = null,
    val category: String = "Geral",
    @SerialName("is_highlight") val isHighlight: Boolean = false
) {
    val dayKey: String get() = day
    val normalizedCategory: String get() = ScheduleDays.normalizeCategory(category)
    val timeRange: String
        get() = if (endTime.isBlank() || endTime == "--") startTime else "$startTime – $endTime"
}

/**
 * Atividades só da equipe (todo o Dia Zero e a categoria "Equipe") nunca aparecem para jovem,
 * nem quando o papel ainda é desconhecido. Mesma regra de `scheduleVisibleTo()` na web.
 */
object ScheduleVisibility {
    fun isStaffOnly(item: ScheduleItem): Boolean = item.day == "dia0" || item.normalizedCategory == "Equipe" ||
        (item.normalizedCategory == "Logística" && item.title.trim().startsWith("Prepara", ignoreCase = true))

    fun visibleTo(items: List<ScheduleItem>, role: UserRole?): List<ScheduleItem> =
        if (role != null && role.isStaff) items else items.filterNot { isStaffOnly(it) }
}

object ScheduleDays {
    fun validTimes(start: String, end: String): Boolean {
        val format = Regex("[0-2][0-9]:[0-5][0-9]")
        if (!format.matches(start) || !format.matches(end)) return false
        val from = br.com.fsyrp2.app.data.EventCalendar.parseLocalTime(start) ?: return false
        val to = br.com.fsyrp2.app.data.EventCalendar.parseLocalTime(end) ?: return false
        return to.isAfter(from)
    }

    val keys = listOf("dia0", "dia1", "dia2", "dia3", "dia4", "dia5")
    /** Categorias gravadas no banco (pt-BR, iguais às da web). */
    val categories = listOf("Espiritual", "Alimentação", "Atividade", "Show", "Baile", "Logística", "Equipe", "Geral")

    /**
     * Normaliza a categoria vinda do banco (pt-BR) ou de dados antigos (chaves em inglês)
     * para uma das [categories]. Desconhecida vira "Geral".
     */
    fun normalizeCategory(raw: String?): String {
        val v = raw?.trim().orEmpty()
        if (v.isEmpty()) return "Geral"
        categories.firstOrNull { it.equals(v, ignoreCase = true) }?.let { return it }
        return when (v.lowercase()) {
            "spiritual", "devocional", "espiritualidade" -> "Espiritual"
            "meal", "food", "refeição", "refeicao", "alimentacao" -> "Alimentação"
            "activity", "atividades" -> "Atividade"
            "logistics", "logistica" -> "Logística"
            "dance" -> "Baile"
            "staff", "team" -> "Equipe"
            else -> "Geral"
        }
    }

    val dayDates = mapOf(
        "dia0" to "2027-02-05",
        "dia1" to "2027-02-06",
        "dia2" to "2027-02-07",
        "dia3" to "2027-02-08",
        "dia4" to "2027-02-09",
        "dia5" to "2027-02-10"
    )

    fun label(key: String): String = when (key) {
        "dia0" -> "Dia Zero"
        else -> "Dia ${key.removePrefix("dia")}"
    }

    fun fullLabel(key: String): String = when (key) {
        "dia0" -> "Dia Zero (Sexta 05/02)"
        "dia1" -> "1º Dia (Sábado 06/02)"
        "dia2" -> "2º Dia (Domingo 07/02)"
        "dia3" -> "3º Dia (Segunda 08/02)"
        "dia4" -> "4º Dia (Terça 09/02)"
        "dia5" -> "5º Dia (Quarta 10/02)"
        else -> "FSY 2027"
    }
}

@Serializable
data class AnnouncementAuthor(
    @SerialName("full_name") val fullName: String? = null,
    val role: String? = null
)

@Serializable
data class Announcement(
    val id: String,
    val title: String,
    val content: String,
    val priority: String = "normal",
    val category: String = "Geral",
    @SerialName("target_company_id") val targetCompanyId: String? = null,
    @SerialName("likes_count") val likesCount: Int = 0,
    @SerialName("liked_by_me") val likedByMe: Boolean = false,
    @SerialName("is_liked") val isLiked: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
    val profiles: AnnouncementAuthor? = null
) {
    val companyId: String? get() = targetCompanyId
    val author: AnnouncementAuthor? get() = profiles
    val isUrgent: Boolean get() = normalizedPriority == "urgent"
    val normalizedPriority: String
        get() = when (priority.lowercase().trim()) {
            "urgent", "urgente" -> "urgent"
            "important", "alta" -> "important"
            else -> "normal"
        }

    val priorityLabelPtBr: String
        get() = when (normalizedPriority) {
            "urgent" -> "Urgente"
            "important" -> "Importante"
            else -> "Normal"
        }

    val cleanCategory: String
        get() = baseCategory(category)

    val isLikedEffective: Boolean
        get() = likedByMe || isLiked

    companion object {
        fun baseCategory(raw: String?): String {
            val v = raw?.trim().orEmpty()
            if (v.isEmpty()) return "Geral"
            val idx = v.indexOf("__LIKES__")
            if (idx < 0) return v
            return v.substring(0, idx).ifBlank { "Geral" }
        }
    }
}

@Serializable
data class LikeToggleResponse(
    val success: Boolean = true,
    @SerialName("is_liked") val isLiked: Boolean = false,
    @SerialName("likes_count") val likesCount: Int = 0
) {
    val liked: Boolean get() = isLiked
}

@Serializable
data class InstagramPost(
    val id: String,
    val imageUrl: String,
    val caption: String = "",
    val publishedAt: String? = null,
    val authorHandle: String = OFFICIAL_HANDLE,
    val postUrl: String = OFFICIAL_URL,
    val mediaType: String = "IMAGE"
) {
    val permalink: String get() = postUrl
    companion object {
        const val OFFICIAL_HANDLE = "fsy_ribeiraopreto"
        const val OFFICIAL_URL = "https://www.instagram.com/fsy_ribeiraopreto/"
    }
}

@Serializable
data class InstagramFeedResponse(
    val data: List<InstagramPost> = emptyList(),
    val beholdConnected: Boolean? = null
) {
    val posts: List<InstagramPost> get() = data
    val profileUrl: String get() = InstagramPost.OFFICIAL_URL
}

@Serializable
data class MediaPhoto(
    val id: String,
    val title: String,
    @SerialName("drive_url") val driveUrl: String,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    val category: String = "Geral",
    val visible: Boolean = true,
    @SerialName("created_at") val createdAt: String = ""
)

@Serializable
data class TransportBus(
    val id: String,
    @SerialName("bus_number") val busNumber: String,
    @SerialName("stake_city") val stakeCity: String,
    @SerialName("driver_name") val driverName: String,
    @SerialName("driver_phone") val driverPhone: String = "",
    val capacity: Int = 46,
    @SerialName("passengers_count") val passengersCount: Int = 0,
    val status: String = "programado",
    @SerialName("departure_city_time") val departureCityTime: String = "--",
    @SerialName("arrival_fsy_time") val arrivalFsyTime: String = "--",
    @SerialName("departure_fsy_time") val departureFsyTime: String = "--",
    val notes: String? = null
) {
    val name: String get() = busNumber
    val departureLocation: String get() = stakeCity
    val arrivalTime: String get() = arrivalFsyTime
    val statusLabel: String
        get() = STATUSES.firstOrNull { it.first == status }?.second ?: status

    companion object {
        val STATUSES = listOf(
            "programado" to "Programado",
            "a_caminho" to "A caminho",
            "chegou" to "Chegou",
            "retornando" to "Retornando",
            "concluido" to "Concluído"
        )
    }
}

@Serializable
data class MedicalRecordSummary(
    val id: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("full_name") val fullName: String,
    @SerialName("company_id") val companyId: String? = null,
    val room: String? = null,
    @SerialName("blood_type") val bloodType: String? = null,
    val allergies: String? = null,
    @SerialName("is_severe_allergy") val isSevereAllergy: Boolean = false,
    @SerialName("dietary_restrictions") val dietaryRestrictions: String? = null,
    val medications: String? = null,
    @SerialName("doctor_notes") val doctorNotes: String? = null,
    @SerialName("emergency_contact_name") val emergencyContactName: String? = null,
    @SerialName("emergency_contact_phone") val emergencyContactPhone: String? = null,
    @SerialName("emergency_contact_rel") val emergencyContactRel: String? = null,
    @SerialName("contact_2_name") val contact2Name: String? = null,
    @SerialName("contact_2_phone") val contact2Phone: String? = null,
    @SerialName("contact_2_relationship") val contact2Relationship: String? = null,
    @SerialName("contact_3_name") val contact3Name: String? = null,
    @SerialName("contact_3_phone") val contact3Phone: String? = null,
    @SerialName("contact_3_relationship") val contact3Relationship: String? = null,
    @SerialName("bishop_name") val bishopName: String? = null,
    @SerialName("bishop_phone") val bishopPhone: String? = null,
    @SerialName("bishop_ward") val bishopWard: String? = null,
    @SerialName("created_at") val createdAt: String? = null
) {
    val emergencyContact: String? get() = emergencyContactName
    val emergencyPhone: String? get() = emergencyContactPhone
    val observations: String? get() = doctorNotes
    val hasAllergy: Boolean
        get() {
            val a = allergies?.trim().orEmpty()
            return isSevereAllergy || (a.isNotEmpty() && !a.equals("nenhuma", ignoreCase = true) && !a.equals("não", ignoreCase = true))
        }

    val hasDiet: Boolean
        get() {
            val d = dietaryRestrictions?.trim().orEmpty()
            return d.isNotEmpty() && !d.equals("nenhuma", ignoreCase = true) && !d.equals("não", ignoreCase = true)
        }
}

@Serializable
data class MedicalAppointmentDto(
    val id: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("medical_record_id") val medicalRecordId: String? = null,
    @SerialName("youth_name") val youthName: String = "Participante",
    @SerialName("professional_name") val professionalName: String = "",
    val reason: String = "Atendimento Multidisciplinar",
    @SerialName("scheduled_at") val scheduledAt: String = "",
    val status: String = "agendado",
    val notes: String? = null,
    @SerialName("is_seen") val isSeen: Boolean = false
) {
    val scheduledFor: String get() = scheduledAt
    val priority: String get() = "normal"
    val participantName: String get() = youthName
    val statusLabel: String
        get() = STATUSES.firstOrNull { it.first == status }?.second ?: status

    companion object {
        val STATUSES = listOf(
            "agendado" to "Agendado",
            "realizado" to "Realizado",
            "cancelado" to "Cancelado"
        )
    }
}

@Serializable
data class InclusionContactDto(
    val name: String = "",
    val phone: String = "",
    val relationship: String = "",
    val ward: String = ""
)

@Serializable
data class InclusionContactsDto(
    val parent: InclusionContactDto = InclusionContactDto(),
    val bishop: InclusionContactDto = InclusionContactDto()
)

@Serializable
data class InclusionInterviewDto(
    val id: String,
    @SerialName("case_id") val caseId: String = "",
    @SerialName("scheduled_at") val scheduledAt: String = "",
    val participants: String = "",
    val status: String = "agendada",
    val summary: String = ""
) {
    val role: String get() = status
    val interviewedPerson: String get() = participants
}

@Serializable
data class InclusionHistoryDto(
    val id: String = "",
    val action: String = "",
    @SerialName("actor_name") val actorName: String = "Equipe",
    @SerialName("created_at") val createdAt: String = ""
)

@Serializable
data class InclusionCaseSummary(
    val id: String,
    @SerialName("medical_record_id") val medicalRecordId: String? = null,
    @SerialName("full_name") val fullName: String = "Participante",
    @SerialName("participant_name") val participantNameRaw: String? = null,
    @SerialName("company_id") val companyId: String? = null,
    val phase: String = "triagem",
    val status: String = "aberto",
    val priority: String = "normal",
    val needs: String = "",
    val summary: String = "",
    @SerialName("support_plan") val supportPlan: String = "",
    val contacts: InclusionContactsDto = InclusionContactsDto(),
    val version: Int = 1,
    val decision: String? = null,
    @SerialName("decision_reason") val decisionReason: String? = null,
    @SerialName("updated_at") val updatedAt: String = "",
    val interviews: List<InclusionInterviewDto> = emptyList(),
    val history: List<InclusionHistoryDto> = emptyList()
) {
    val participantName: String get() = fullName.ifBlank { participantNameRaw ?: "Participante" }
    val workflowStatus: String get() = phaseLabel
    val supportLevel: String get() = priority
    val category: String get() = needs
    val unit: String get() = contacts.parent.ward
    val decisionRationale: String? get() = decisionReason
    val decisionConditions: List<String> get() = supportPlan.lines().filter { it.isNotBlank() }
    val displayName: String
        get() = participantName

    val phaseLabel: String
        get() = PHASES.firstOrNull { it.first == phase }?.second ?: phase

    val decisionLabel: String?
        get() = decision?.let { d -> DECISIONS.firstOrNull { it.first == d }?.second ?: d }

    companion object {
        val PHASES = listOf(
            "triagem" to "Triagem",
            "contato" to "Contato com responsáveis",
            "entrevistas" to "Entrevistas",
            "analise" to "Análise da equipe",
            "concluido" to "Decisão registrada",
            "arquivado" to "Arquivado"
        )
        val DECISIONS = listOf(
            "participacao_confirmada" to "Participação confirmada",
            "participacao_com_apoio" to "Participação com apoio",
            "participacao_nao_recomendada" to "Participação não recomendada"
        )
    }
}

@Serializable
data class OverviewRecentAnnouncement(
    val id: String,
    val title: String,
    val priority: String = "normal",
    val category: String = "Geral",
    @SerialName("created_at") val createdAt: String = ""
)

@Serializable
data class AdminOverview(
    @SerialName("total_youth") val totalYouth: Int = 0,
    @SerialName("youth_with_company") val youthWithCompany: Int = 0,
    @SerialName("youth_with_room") val youthWithRoom: Int = 0,
    @SerialName("total_companies") val totalCompanies: Int = 0,
    @SerialName("total_counselors") val totalCounselors: Int = 0,
    @SerialName("medical_records") val medicalRecords: Int = 0,
    @SerialName("total_announcements") val totalAnnouncements: Int = 0,
    @SerialName("total_photos") val totalPhotos: Int = 0,
    @SerialName("recent_announcements") val recentAnnouncements: List<OverviewRecentAnnouncement> = emptyList(),
    @SerialName("generated_at") val generatedAt: String = ""
)

@Serializable
data class AdminAccountDto(
    val id: String,
    @SerialName("full_name") val fullName: String = "Sem nome",
    val email: String? = null,
    val role: String? = "jovem",
    @SerialName("company_id") val companyId: String? = null,
    @SerialName("company_name") val companyName: String? = null,
    val stake: String? = null,
    val room: String? = null,
    @SerialName("bus_assignment") val busAssignment: String? = null,
    val phone: String? = null,
    val providers: List<String> = emptyList(),
    @SerialName("has_password") val hasPassword: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("last_sign_in_at") val lastSignInAt: String? = null,
    val suspended: Boolean = false,
    val status: String = "ativo"
) {
    val unit: String? get() = stake
    val permissions: List<String> get() = emptyList()
    val parsedRole: UserRole
        get() = UserRole.fromWire(role)

    val statusLabel: String
        get() = when (status) {
            "suspenso" -> "Suspensa"
            "aguardando_confirmacao" -> "Aguardando confirmação"
            "sem_perfil" -> "Sem perfil"
            else -> "Ativa"
        }
}

@Serializable
data class AccountListResponseDto(
    val data: List<AdminAccountDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    @SerialName("per_page") val perPage: Int = 25,
    val permissions: Map<String, List<String>> = emptyMap()
) {
    val accounts: List<AdminAccountDto> get() = data
    val totalPages: Int get() = ((total + perPage - 1) / perPage.coerceAtLeast(1)).coerceAtLeast(1)
    val metrics: AccountListMetrics get() = AccountListMetrics(total, data.count { it.status == "ativo" }, data.count { it.status == "aguardando_confirmacao" }, data.count { it.status == "suspenso" })
}

data class AccountListMetrics(val total: Int = 0, val activeCount: Int = 0, val pendingEmailCount: Int = 0, val suspendedCount: Int = 0)

/** Espelha permissions.ts; a API continua autorizando cada mutação e protegendo o último gestor. */
object AccountPermissions {
    private val actions = setOf("edit", "role", "suspend", "reactivate", "delete", "recovery_email", "set_password", "email")
    private val selfRestricted = setOf("role", "suspend", "reactivate", "delete", "set_password")

    fun allowedActions(
        actorRole: UserRole?, actorId: String?, target: AdminAccountDto, serverActions: List<String>
    ): Set<String> {
        if (actorRole?.isManager != true || actorId.isNullOrBlank()) return emptySet()
        return serverActions.filterTo(linkedSetOf()) { action ->
            action in actions && !(actorId == target.id && action in selfRestricted) &&
                !(action == "suspend" && target.suspended) && !(action == "reactivate" && !target.suspended) &&
                !(action in setOf("email", "recovery_email") && target.email.isNullOrBlank())
        }
    }

    fun assignableRoles(actorRole: UserRole?, allowedActions: Set<String>): List<UserRole> =
        if (actorRole?.isManager == true && "role" in allowedActions) UserRole.entries.toList() else emptyList()
}

typealias AccountListResponse = AccountListResponseDto
typealias AdminAccountRecord = AdminAccountDto
typealias AccountAuditEvent = AccountEventDto
typealias CompaniesApiPayload = CompaniesPayload
typealias CounselorSummary = CounselorProfileDto
typealias LogisticsBus = TransportBus
typealias MedicalAppointment = MedicalAppointmentDto
typealias InclusionInterviewRecord = InclusionInterviewDto
typealias CounselorAuditEntry = CounselorAuditEntryDto

val String?.labelPt: String get() = UserRole.fromWire(this).displayLabel

@Serializable
data class AccountEventDto(
    val id: String,
    @SerialName("actor_name") val actorName: String = "Equipe",
    @SerialName("actor_role") val actorRole: String = "",
    @SerialName("target_label") val targetLabel: String = "",
    val action: String = "",
    @SerialName("created_at") val createdAt: String = ""
) {
    val actorEmail: String? get() = null
    val actionLabel: String
        get() = when (action) {
            "edit" -> "Dados editados"
            "role" -> "Cargo alterado"
            "suspend" -> "Acesso suspenso"
            "reactivate" -> "Acesso reativado"
            "delete" -> "Conta excluída"
            "recovery_email" -> "Link de recuperação enviado"
            "set_password" -> "Senha definida pela gestão"
            "email" -> "E-mail enviado"
            else -> action
        }
}

@Serializable
data class CounselorAuditEntryDto(
    val id: String,
    @SerialName("author_id") val authorId: String? = null,
    @SerialName("author_name") val authorName: String = "Consultor(a)",
    @SerialName("author_role") val authorRole: String = "consultor",
    @SerialName("company_id") val companyId: String? = null,
    @SerialName("company_name") val companyName: String? = null,
    @SerialName("action_type") val actionType: String = "",
    @SerialName("action_label") val actionLabel: String = "Ação",
    val title: String? = null,
    val content: String = "",
    @SerialName("created_at") val createdAt: String = ""
) {
    val action: String get() = actionLabel
    val actorName: String get() = authorName
    val summary: String get() = content
}

@Serializable
data class RegistrationValidationIssueDto(
    val severity: String,
    val code: String,
    val sheetName: String? = null,
    val rowNumber: Int? = null,
    val columnKey: String? = null,
    val message: String
)

@Serializable
data class RegistrationAuthorizationAdjustmentsDto(
    val values: Map<String, String> = emptyMap(),
    val editedByUserId: String = "",
    val editedByName: String = "",
    val editedAt: String = ""
)

@Serializable
data class RegistrationRecordDto(
    val id: String,
    val batchId: String? = null,
    val dedupKey: String = "",
    val sourceSheets: List<String> = emptyList(),
    val sourceRowNumbers: Map<String, Int> = emptyMap(),
    val roleCategory: String = "Participante",
    val status: String = "",
    val firstNameRaw: String = "",
    val lastNameRaw: String = "",
    val preferredNameRaw: String? = null,
    val fullNameRaw: String = "",
    val firstNameNormalized: String = "",
    val lastNameNormalized: String = "",
    val preferredNameNormalized: String? = null,
    val fullNameNormalized: String = "",
    val birthDateRaw: String? = null,
    val birthDateIso: String? = null,
    val ageAtRegistration: Int? = null,
    val registrationDateRaw: String? = null,
    val sex: String? = null,
    val phoneRaw: String? = null,
    val email: String? = null,
    val tshirtSize: String? = null,
    val stakeName: String? = null,
    val wardName: String? = null,
    val bishopNameRaw: String? = null,
    val bishopNameNormalized: String? = null,
    val bishopEmail: String? = null,
    val documentRgOrPassportRaw: String? = null,
    val issuingAgencyRaw: String? = null,
    val cpfRaw: String? = null,
    val cpfDigitsOnly: String? = null,
    val guardianNameRaw: String? = null,
    val guardianNameNormalized: String? = null,
    val guardianPhoneRaw: String? = null,
    val parentAuthorizationAckRaw: String? = null,
    val contact1NameRaw: String? = null,
    val contact1NameNormalized: String? = null,
    val contact1Email: String? = null,
    val contact1PhoneRaw: String? = null,
    val contact2NameRaw: String? = null,
    val contact2NameNormalized: String? = null,
    val contact2Email: String? = null,
    val contact2PhoneRaw: String? = null,
    val isChurchMemberRaw: String? = null,
    val talentShowPresentationRaw: String? = null,
    val medicalInfoRaw: String? = null,
    val dietaryInfoRaw: String? = null,
    val healthConditionsSummaryRaw: String? = null,
    val healthConditionsDetailsRaw: String? = null,
    val wasNameNormalized: Boolean = false,
    val hasHealthAlert: Boolean = false,
    val hasMissingGuardianForMinor: Boolean = false,
    val hasDocumentWarning: Boolean = false,
    val hasAuthorizationAdjustments: Boolean = false,
    val authorizationAdjustments: RegistrationAuthorizationAdjustmentsDto? = null,
    val issues: List<RegistrationValidationIssueDto> = emptyList(),
    val rawColumns: Map<String, String> = emptyMap(),
    val createdAt: String = "",
    val updatedAt: String = ""
)

/** Projeção só da autorização; mantém a planilha importada e a identidade intactas. */
fun RegistrationRecordDto.authorizationValues(): Map<String, String> {
    val importedSex = sex.orEmpty().trim().lowercase().removePrefix("sexo ")
    val values = linkedMapOf(
        "firstName" to firstNameRaw, "lastName" to lastNameRaw,
        "birthDate" to (birthDateIso?.split("-")?.reversed()?.joinToString("/") ?: birthDateRaw.orEmpty()),
        "sex" to when (importedSex) {
            "m", "masc", "masculino" -> "Masculino"
            "f", "fem", "feminino" -> "Feminino"
            else -> ""
        },
        "phone" to phoneRaw.orEmpty(), "cpf" to cpfRaw.orEmpty(),
        "documentRgOrPassport" to documentRgOrPassportRaw.orEmpty(), "issuingAgency" to issuingAgencyRaw.orEmpty(),
        "tshirtSize" to tshirtSize.orEmpty(), "guardianName" to guardianNameRaw.orEmpty(),
        "guardianPhone" to guardianPhoneRaw.orEmpty(), "stakeName" to stakeName.orEmpty(),
        "wardName" to wardName.orEmpty(), "bishopName" to bishopNameRaw.orEmpty(), "bishopEmail" to bishopEmail.orEmpty(),
        "medicalInfo" to medicalInfoRaw.orEmpty(), "dietaryInfo" to dietaryInfoRaw.orEmpty(),
        "healthConditionsSummary" to healthConditionsSummaryRaw.orEmpty(),
        "healthConditionsDetails" to healthConditionsDetailsRaw.orEmpty()
    )
    authorizationAdjustments?.values?.filterKeys { it in values }?.let(values::putAll)
    return values
}

/** Envia só campos alterados: avisos em dados importados não bloqueiam outra correção. */
fun RegistrationRecordDto.authorizationChanges(draft: Map<String, String>): Map<String, String> {
    val initial = authorizationValues()
    return draft.filter { (key, value) -> key in initial && value.trim() != initial[key]?.trim() }
        .mapValues { it.value.trim() }
}

fun authorizationAdjustmentErrors(
    changes: Map<String, String>,
    today: java.time.LocalDate = java.time.LocalDate.now(java.time.ZoneOffset.UTC)
): Map<String, String> = buildMap {
    changes.forEach { (key, value) ->
        if (value.length > 2000) put(key, "Use no máximo 2.000 caracteres.")
        when (key) {
            "firstName" -> if (value.isBlank()) put(key, "Informe o nome.")
            "birthDate" -> if (value.isNotEmpty()) {
                val valid = runCatching {
                    val date = java.time.LocalDate.parse(value, java.time.format.DateTimeFormatter.ofPattern("dd/MM/uuuu")
                        .withResolverStyle(java.time.format.ResolverStyle.STRICT))
                    date.year >= 1920 && !date.isAfter(today)
                }.getOrDefault(false)
                if (!valid) put(key, "Informe uma data de nascimento válida em dd/mm/aaaa.")
            }
            "sex" -> if (value !in listOf("", "Masculino", "Feminino")) put(key, "Escolha uma das opções de sexo.")
            "phone", "guardianPhone" -> if (value.isNotEmpty()) {
                val digits = value.filter(Char::isDigit).replace(Regex("^55(?=\\d{10,11}$)"), "")
                if (!Regex("[\\d\\s()+.\\-]+").matches(value) || !Regex("[1-9]\\d{9,10}").matches(digits))
                    put(key, "Informe um telefone com DDD e 10 ou 11 dígitos.")
            }
            "cpf" -> if (value.isNotEmpty()) {
                val digits = value.filter(Char::isDigit)
                val valid = Regex("[\\d.\\s\\-]+").matches(value) && digits.length == 11 && digits.toSet().size > 1 &&
                    listOf(9, 10).all { length ->
                        val sum = digits.take(length).mapIndexed { index, char -> (char - '0') * (length + 1 - index) }.sum()
                        ((sum * 10) % 11) % 10 == digits[length] - '0'
                    }
                if (!valid) put(key, "Informe um CPF com dígitos verificadores válidos.")
            }
            "bishopEmail" -> if (value.isNotEmpty() && !Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+").matches(value))
                put(key, "Informe um e-mail válido.")
        }
    }
}

fun RegistrationRecordDto.isCancelledRegistration(): Boolean = status.trim().startsWith("cancelad", ignoreCase = true)

fun RegistrationRecordDto.authorizationFilename(): String {
    val values = authorizationValues()
    val name = listOf(values["firstName"], values["lastName"]).filterNotNull().filter(String::isNotBlank).joinToString("-")
    val ascii = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
        .lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-').take(100).ifBlank { "inscrito" }
    return "autorizacao-$ascii.pdf"
}

@Serializable
data class RegistrationImportBatchSummaryDto(
    val id: String,
    val revision: Int = 0,
    val filename: String,
    val fileSha256: String = "",
    val fileSizeBytes: Int = 0,
    val importMode: String = "upsert",
    val useNormalizedNames: Boolean = true,
    val totalCount: Int = 0,
    val participantCount: Int = 0,
    val counselorCount: Int = 0,
    val warningCount: Int = 0,
    val importedByName: String? = null,
    val createdAt: String = "",
    val isActiveBatch: Boolean = false
)

@Serializable
data class RegistrationListMetricsDto(
    val totalCount: Int = 0,
    val participantCount: Int = 0,
    val counselorCount: Int = 0,
    val confirmedCount: Int = 0,
    val healthAlertCount: Int = 0,
    val missingGuardianMinorCount: Int = 0,
    val documentWarningCount: Int = 0,
    val stakes: List<String> = emptyList(),
    val wards: List<String> = emptyList(),
    val statuses: List<String> = emptyList()
)

@Serializable
data class RegistrationPaginationDto(
    val page: Int = 1,
    val pageSize: Int = 50,
    val totalFiltered: Int = 0,
    val totalPages: Int = 1
)

@Serializable
data class RegistrationListResponseDto(
    val currentRevision: Int = 0,
    val activeBatch: RegistrationImportBatchSummaryDto? = null,
    val batches: List<RegistrationImportBatchSummaryDto> = emptyList(),
    val metrics: RegistrationListMetricsDto = RegistrationListMetricsDto(),
    val items: List<RegistrationRecordDto> = emptyList(),
    val pagination: RegistrationPaginationDto = RegistrationPaginationDto()
)

@Serializable
data class RegistrationPreviewDiffDto(
    val insertCount: Int = 0,
    val updateCount: Int = 0,
    val unchangedCount: Int = 0,
    val deleteCountOnReplaceAll: Int = 0
)

@Serializable
data class RegistrationNameChangePreviewDto(
    val id: String = "",
    val dedupKey: String = "",
    val fullNameRaw: String = "",
    val fullNameNormalized: String = "",
    val guardianNameRaw: String? = null,
    val guardianNameNormalized: String? = null
)

@Serializable
data class RegistrationSheetSummaryDto(
    val sheetName: String,
    val present: Boolean = true,
    val totalRows: Int = 0,
    val headerMatched: Boolean = true
)

@Serializable
data class AuthorizationAdjustmentImpactDto(
    val retainedCount: Int = 0,
    val removedCountOnReplaceAll: Int = 0
)

@Serializable
data class RegistrationPreviewSummaryDto(
    val previewId: String,
    val baseRevision: Int,
    val filename: String,
    val canCommit: Boolean,
    val blockingErrorCount: Int = 0,
    val warningCount: Int = 0,
    val totalCanonicalRows: Int = 0,
    val participantCount: Int = 0,
    val counselorCount: Int = 0,
    val normalizedNamesChangedCount: Int = 0,
    val healthAlertCount: Int = 0,
    val missingGuardianMinorCount: Int = 0,
    val documentWarningCount: Int = 0,
    val diffSummary: RegistrationPreviewDiffDto = RegistrationPreviewDiffDto(),
    val authorizationAdjustmentImpact: AuthorizationAdjustmentImpactDto = AuthorizationAdjustmentImpactDto(),
    val sheets: List<RegistrationSheetSummaryDto> = emptyList(),
    val issues: List<RegistrationValidationIssueDto> = emptyList(),
    val sampleRows: List<RegistrationRecordDto> = emptyList(),
    val nameChanges: List<RegistrationNameChangePreviewDto> = emptyList(),
    val expiresAt: String = ""
)

@Serializable
data class CommitRegistrationImportResponseDto(
    val ok: Boolean = true,
    val idempotentReplay: Boolean = false,
    val currentRevision: Int = 0,
    val batch: RegistrationImportBatchSummaryDto? = null,
    val insertedCount: Int = 0,
    val updatedCount: Int = 0,
    val deletedCount: Int = 0
)

@Serializable
data class DeleteRegistrationBatchResponseDto(
    val ok: Boolean = true,
    val deletedBatchId: String = "",
    val deletedRecordsCount: Int = 0,
    val currentRevision: Int = 0,
    val activeBatch: RegistrationImportBatchSummaryDto? = null
)

@Serializable
data class NotificationChannelPreferencesDto(
    val announcementsEnabled: Boolean = true,
    val urgentOnly: Boolean = false,
    /** Desligado por padrão: o "Lembrar" de cada atividade é a escolha explícita da pessoa. */
    val scheduleRemindersEnabled: Boolean = false,
    val personalRemindersEnabled: Boolean = true,
    val quietHoursStart: String? = "22:30",
    val quietHoursEnd: String? = "06:30"
)

@Serializable
data class RegisteredPushDeviceSummaryDto(
    val id: String,
    val userId: String = "",
    val deviceId: String,
    val platform: String = "android",
    val appVersion: String? = null,
    val bindingGeneration: Int = 1,
    val hasActiveToken: Boolean = true,
    val preferences: NotificationChannelPreferencesDto = NotificationChannelPreferencesDto(),
    val lastSeenAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class RegisterPushDeviceResponseDto(
    val ok: Boolean = true,
    val device: RegisteredPushDeviceSummaryDto? = null
)

@Serializable
data class PushDeviceListResponseDto(
    val devices: List<RegisteredPushDeviceSummaryDto> = emptyList()
)

@Serializable
data class WidgetActivitySummaryDto(
    val id: String,
    val dayKey: String,
    val startTime: String,
    val endTime: String,
    val title: String,
    val location: String? = null,
    val category: String = "Geral",
)

@Serializable
data class WidgetSnapshotDto(
    val userId: String,
    val companyName: String? = null,
    val updatedAtEpochMs: Long = 0L,
    val activities: List<WidgetActivitySummaryDto> = emptyList(),
    val visibleAnnouncementCount: Int? = null,
    val urgentAnnouncementCount: Int? = null,
    /** Só equipe vê atividades "Equipe" no widget; o atualizador em segundo plano respeita isto. */
    val isStaff: Boolean = false,
)


/** Jovem envia para análise; demais cargos recebem foto aprovada imediatamente pela API. */
@Serializable
data class ProfilePhotoState(
    val status: String = "none",
    @SerialName("approved_url") val approvedUrl: String? = null,
    @SerialName("pending_url") val pendingUrl: String? = null,
    @SerialName("submitted_at") val submittedAt: String? = null,
    @SerialName("reviewed_at") val reviewedAt: String? = null,
    @SerialName("review_note") val reviewNote: String? = null,
) {
    val isPending: Boolean get() = status == "pending"
    val isRejected: Boolean get() = status == "rejected"

    fun uploadMessageFor(role: UserRole): String? = when {
        status == "approved" && !approvedUrl.isNullOrBlank() -> "Foto atualizada."
        isPending && role.requiresProfilePhotoApproval -> "Foto enviada para análise do seu consultor."
        isPending -> "Foto enviada. Atualize o perfil para ver a foto."
        else -> null
    }
}

@Serializable
data class ProfilePhotoReview(
    @SerialName("user_id") val userId: String,
    @SerialName("full_name") val fullName: String = "Participante",
    @SerialName("company_id") val companyId: String? = null,
    @SerialName("company_name") val companyName: String? = null,
    @SerialName("pending_url") val pendingUrl: String = "",
    @SerialName("current_url") val currentUrl: String? = null,
    @SerialName("submitted_at") val submittedAt: String = "",
)

@Serializable
data class ProfilePhotoReviewList(val data: List<ProfilePhotoReview> = emptyList())

/** Cópia local honesta dos últimos dados vistos (cache offline, apagada ao sair). */
@Serializable
data class OfflineSnapshot(
    val userId: String,
    val savedAtEpochMs: Long = 0L,
    val profile: Profile? = null,
    val company: Company? = null,
    val scheduleItems: List<ScheduleItem> = emptyList(),
    val announcements: List<Announcement> = emptyList(),
)
