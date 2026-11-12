package br.com.fsyrp2.app.network

import br.com.fsyrp2.app.BuildConfig
import br.com.fsyrp2.app.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.UUID

class ApiException(
    val statusCode: Int,
    override val message: String,
    val errorCode: String? = null,
    val requiresTokenRotation: Boolean = false
) : Exception(message)

/** O reset usa exclusivamente sua própria chave, como exige o contrato estrito da API. */
internal fun authorizationAdjustmentsRequestBody(adjustments: Map<String, String>, resetAdjustments: Boolean): String {
    require(resetAdjustments || adjustments.isNotEmpty()) { "Informe ao menos um ajuste." }
    return buildJsonObject {
        if (resetAdjustments) put("resetAdjustments", true)
        else put("adjustments", buildJsonObject { adjustments.forEach { (key, value) -> put(key, value) } })
    }.toString()
}

/**
 * Cliente HTTP nativo para Supabase Auth/PostgREST e rotas autenticadas do Portal.
 * utilizando `Authorization: Bearer <accessToken>`, sem cache em disco de dados sensíveis.
 */
class PortalApiClient(
    private val supabaseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/'),
    private val supabaseAnonKey: String = BuildConfig.SUPABASE_ANON_KEY,
    private val portalBaseUrl: String = BuildConfig.PORTAL_BASE_URL.trimEnd('/')
) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }

    // -------------------------------------------------------------------------
    // Autenticação (Supabase GoTrue + Portal Recovery)
    // -------------------------------------------------------------------------

    suspend fun signInWithPassword(email: String, password: String): UserSession =
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject {
                put("email", email.trim())
                put("password", password)
            }.toString()

            val responseText = executeJsonRequest(
                url = "$supabaseUrl/auth/v1/token?grant_type=password",
                method = "POST",
                body = payload,
                bearerToken = null,
                includeApiKey = true
            )
            parseAuthSessionResponse(responseText)
        }

    suspend fun signUpWithPassword(
        email: String,
        password: String,
        fullName: String,
        stake: String
    ): SignUpResult = withContext(Dispatchers.IO) {
        // O gatilho do banco (`handle_new_user`) lê `full_name`, `name`, `stake` e `phone`
        // de raw_user_meta_data — os mesmos campos que o cadastro da web envia.
        val payload = buildJsonObject {
            put("email", email.trim().lowercase())
            put("password", password)
            putJsonObject("data") {
                put("full_name", fullName.trim())
                put("name", fullName.trim())
                val cleanStake = stake.trim()
                if (cleanStake.isNotEmpty()) put("stake", cleanStake)
            }
        }.toString()

        val responseText = executeJsonRequest(
            url = "$supabaseUrl/auth/v1/signup",
            method = "POST",
            body = payload,
            bearerToken = null,
            includeApiKey = true
        )
        val obj = json.parseToJsonElement(responseText).jsonObject
        val hasAccessToken = obj["access_token"]?.jsonPrimitive?.contentOrNull != null
        if (hasAccessToken) {
            SignUpResult(
                session = parseAuthSessionResponse(responseText),
                requiresEmailConfirmation = false
            )
        } else {
            SignUpResult(
                session = null,
                requiresEmailConfirmation = true
            )
        }
    }

    suspend fun exchangePkceCode(authCode: String, codeVerifier: String): UserSession =
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject {
                put("auth_code", authCode)
                put("code_verifier", codeVerifier)
            }.toString()

            val responseText = executeJsonRequest(
                url = "$supabaseUrl/auth/v1/token?grant_type=pkce",
                method = "POST",
                body = payload,
                bearerToken = null,
                includeApiKey = true
            )
            parseAuthSessionResponse(responseText)
        }

    suspend fun refreshSession(refreshToken: String): UserSession =
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject {
                put("refresh_token", refreshToken)
            }.toString()

            val responseText = executeJsonRequest(
                url = "$supabaseUrl/auth/v1/token?grant_type=refresh_token",
                method = "POST",
                body = payload,
                bearerToken = null,
                includeApiKey = true
            )
            parseAuthSessionResponse(responseText)
        }

    suspend fun signOut(session: UserSession) = withContext(Dispatchers.IO) {
        try {
            executeJsonRequest(
                url = "$supabaseUrl/auth/v1/logout",
                method = "POST",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = true
            )
        } catch (_: Exception) {
            // Logout local prossegue mesmo se a rede estiver indisponível
        }
    }

    suspend fun requestPasswordRecovery(email: String): String =
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject {
                put("email", email.trim().lowercase())
            }.toString()

            val res = executeJsonRequest(
                url = "$portalBaseUrl/api/auth/recover",
                method = "POST",
                body = payload,
                bearerToken = null,
                includeApiKey = false
            )
            val obj = json.parseToJsonElement(res).jsonObject
            obj["message"]?.jsonPrimitive?.contentOrNull
                ?: "Se este e-mail tiver uma conta com senha no portal, você receberá um link para criar uma nova senha."
        }

    // -------------------------------------------------------------------------
    // Perfil, Companhia, Agenda, Avisos e Galeria
    // -------------------------------------------------------------------------

    suspend fun fetchCurrentProfile(session: UserSession): Profile =
        withContext(Dispatchers.IO) {
            val encodedId = URLEncoder.encode("eq.${session.userId}", "UTF-8")
            val text = executeJsonRequest(
                url = "$supabaseUrl/rest/v1/profiles?id=$encodedId&select=*",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = true
            )
            val list = json.decodeFromString<List<Profile>>(text)
            val profile = list.firstOrNull()
                ?: throw ApiException(404, "Perfil não encontrado.")
            if (!profile.suspendedAt.isNullOrBlank()) {
                throw ApiException(403, "Sua conta está temporariamente suspensa pela coordenação.")
            }
            profile
        }

    suspend fun fetchCompany(session: UserSession, companyId: String): Company? =
        withContext(Dispatchers.IO) {
            val encodedId = URLEncoder.encode("eq.$companyId", "UTF-8")
            val text = executeJsonRequest(
                url = "$supabaseUrl/rest/v1/companies?id=$encodedId&select=*",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = true
            )
            json.decodeFromString<List<Company>>(text).firstOrNull()
        }

    suspend fun fetchCompanyYouth(session: UserSession, companyId: String): List<Profile> =
        withContext(Dispatchers.IO) {
            val encodedId = URLEncoder.encode("eq.$companyId", "UTF-8")
            val text = executeJsonRequest(
                url = "$supabaseUrl/rest/v1/profiles?company_id=$encodedId&role=eq.jovem&select=*&order=full_name.asc",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = true
            )
            json.decodeFromString(text)
        }

    suspend fun fetchSchedule(session: UserSession): List<ScheduleItem> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$supabaseUrl/rest/v1/schedule_items?select=*&order=date.asc,start_time.asc",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = true
            )
            json.decodeFromString(text)
        }

    suspend fun fetchAnnouncements(session: UserSession): List<Announcement> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/announcements",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val dataArr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(dataArr)
        }

    suspend fun toggleAnnouncementLike(
        session: UserSession,
        announcementId: String
    ): LikeToggleResponse = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("announcement_id", announcementId)
        }.toString()
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/announcements/like",
            method = "POST",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString(text)
    }

    /** Manifesto público de versões (`GET /api/app-release`), usado pelo atualizador interno. */
    suspend fun fetchAppReleaseManifest(): br.com.fsyrp2.app.update.AppReleaseManifestDto =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/app-release",
                method = "GET",
                body = null,
                bearerToken = null,
                includeApiKey = false
            )
            json.decodeFromString(text)
        }

    suspend fun fetchInstagramFeed(): InstagramFeedResponse =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/instagram",
                method = "GET",
                body = null,
                bearerToken = null,
                includeApiKey = false
            )
            json.decodeFromString(text)
        }

    suspend fun fetchPublicMedia(session: UserSession): List<MediaPhoto> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/media",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val arr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(arr)
        }

    // -------------------------------------------------------------------------
    // Foto de perfil com aprovação do consultor (`src/types/profile-photo.ts`)
    // -------------------------------------------------------------------------

    suspend fun fetchProfilePhoto(session: UserSession): ProfilePhotoState =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/profile/photo",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            json.decodeFromString(text)
        }

    /** Envia a foto já recortada e comprimida (JPEG) como multipart, campo "file". */
    suspend fun uploadProfilePhoto(session: UserSession, jpegBytes: ByteArray): ProfilePhotoState =
        withContext(Dispatchers.IO) {
            val boundary = "fsy" + UUID.randomUUID().toString().replace("-", "")
            val crlf = "\r\n"
            val conn = (URL("$portalBaseUrl/api/profile/photo").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 20000
                readTimeout = 45000
                useCaches = false
                doOutput = true
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer ${session.accessToken}")
                setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            }
            try {
                conn.outputStream.use { out ->
                    val head = "--$boundary$crlf" +
                        "Content-Disposition: form-data; name=\"file\"; filename=\"foto.jpg\"$crlf" +
                        "Content-Type: image/jpeg$crlf$crlf"
                    out.write(head.toByteArray(Charsets.UTF_8))
                    out.write(jpegBytes)
                    out.write("$crlf--$boundary--$crlf".toByteArray(Charsets.UTF_8))
                }
                json.decodeFromString(readResponseBody(conn))
            } finally {
                conn.disconnect()
            }
        }

    suspend fun deleteProfilePhoto(session: UserSession, scope: String): ProfilePhotoState =
        withContext(Dispatchers.IO) {
            val safeScope = if (scope == "approved") "approved" else "pending"
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/profile/photo?scope=$safeScope",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            json.decodeFromString(text)
        }

    suspend fun fetchCompanyProfilePhotos(session: UserSession): Map<String, String> = withContext(Dispatchers.IO) {
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/profile/photo/company", method = "GET", body = null,
            bearerToken = session.accessToken, includeApiKey = false,
        )
        val data = json.parseToJsonElement(text).jsonObject["data"] ?: JsonObject(emptyMap())
        json.decodeFromJsonElement<Map<String, String>>(data)
    }

    suspend fun fetchPhotoReviews(session: UserSession): List<ProfilePhotoReview> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/profile/photo/reviews",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            json.decodeFromString<ProfilePhotoReviewList>(text).data
        }

    suspend fun reviewProfilePhoto(session: UserSession, userId: String, approve: Boolean, note: String?) {
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject {
                put("user_id", userId)
                put("decision", if (approve) "approve" else "reject")
                val clean = note?.trim().orEmpty()
                if (clean.isNotEmpty()) put("note", clean)
            }.toString()
            executeJsonRequest(
                url = "$portalBaseUrl/api/profile/photo/reviews",
                method = "POST",
                body = payload,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }
    }

    // -------------------------------------------------------------------------
    // Notificações Push (FCM HTTP v1 + Preferências por Dispositivo)
    // -------------------------------------------------------------------------

    suspend fun fetchPushDevices(session: UserSession): List<RegisteredPushDeviceSummaryDto> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/notifications/devices",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val parsed = json.decodeFromString<PushDeviceListResponseDto>(text)
            parsed.devices
        }

    suspend fun registerPushDevice(
        session: UserSession,
        deviceId: String,
        fcmToken: String,
        appVersion: String,
        preferences: NotificationChannelPreferencesDto? = null
    ): RegisteredPushDeviceSummaryDto? = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("deviceId", deviceId)
            put("platform", "android")
            put("fcmToken", fcmToken)
            put("appVersion", appVersion)
            if (preferences != null) {
                put("preferences", json.encodeToJsonElement(preferences))
            }
        }.toString()

        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/notifications/devices",
            method = "POST",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString<RegisterPushDeviceResponseDto>(text).device
    }

    suspend fun updatePushPreferences(
        session: UserSession,
        deviceId: String,
        preferences: NotificationChannelPreferencesDto
    ): RegisteredPushDeviceSummaryDto? = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("deviceId", deviceId)
            put("preferences", json.encodeToJsonElement(preferences))
        }.toString()

        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/notifications/devices",
            method = "PATCH",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString<RegisterPushDeviceResponseDto>(text).device
    }

    suspend fun revokePushDevice(
        session: UserSession,
        deviceId: String,
        revokeAll: Boolean = false
    ) = withContext(Dispatchers.IO) {
        val encodedDeviceId = URLEncoder.encode(deviceId, "UTF-8")
        val query = if (revokeAll) "deviceId=$encodedDeviceId&all=true" else "deviceId=$encodedDeviceId"
        executeJsonRequest(
            url = "$portalBaseUrl/api/notifications/devices?$query",
            method = "DELETE",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
    }

    // -------------------------------------------------------------------------
    // Administração — Visão Geral & Contas (`/api/admin/overview`, `/api/admin/accounts`)
    // -------------------------------------------------------------------------

    suspend fun fetchAdminOverview(session: UserSession): AdminOverview =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/admin/overview",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            json.decodeFromString(text)
        }

    suspend fun fetchAdminAccounts(
        session: UserSession,
        search: String = "",
        role: String = "",
        status: String = "",
        companyId: String = "",
        page: Int = 1,
        pageSize: Int = 25
    ): AccountListResponse = withContext(Dispatchers.IO) {
        val params = buildList {
            add("page=$page")
            add("per_page=$pageSize")
            if (search.isNotBlank()) add("q=${URLEncoder.encode(search.trim(), "UTF-8")}")
            if (role.isNotBlank() && role != "all") add("role=${URLEncoder.encode(role, "UTF-8")}")
            if (status.isNotBlank() && status != "all") add("status=${URLEncoder.encode(status, "UTF-8")}")
            if (companyId.isNotBlank() && companyId != "all") add("company_id=${URLEncoder.encode(companyId, "UTF-8")}")
        }.joinToString("&")

        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/admin/accounts?$params",
            method = "GET",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString(text)
    }

    suspend fun fetchAccountEvents(session: UserSession, accountId: String): List<AccountAuditEvent> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/admin/accounts/$accountId",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val arr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(arr)
        }

    suspend fun patchAccount(
        session: UserSession,
        accountId: String,
        body: JsonObject
    ): Unit = withContext(Dispatchers.IO) {
        executeJsonRequest(
            url = "$portalBaseUrl/api/admin/accounts/$accountId",
            method = "PATCH",
            body = body.toString(),
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        Unit
    }

    suspend fun setAccountPassword(session: UserSession, accountId: String, password: String) =
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject { put("password", password) }.toString()
            executeJsonRequest(
                url = "$portalBaseUrl/api/admin/accounts/$accountId/password",
                method = "POST",
                body = payload,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun sendAccountRecovery(session: UserSession, accountId: String) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/admin/accounts/$accountId/recovery",
                method = "POST",
                body = "{}",
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun sendAccountEmail(
        session: UserSession,
        accountId: String,
        subject: String,
        bodyText: String
    ) = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("subject", subject.trim())
            put("body", bodyText.trim())
            put("confirm", true)
        }.toString()
        executeJsonRequest(
            url = "$portalBaseUrl/api/admin/accounts/$accountId/email",
            method = "POST",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
    }

    suspend fun deleteAccount(session: UserSession, accountId: String, confirmText: String) =
        withContext(Dispatchers.IO) {
            val payload = buildJsonObject {
                put("confirm", confirmText.trim())
            }.toString()
            executeJsonRequest(
                url = "$portalBaseUrl/api/admin/accounts/$accountId",
                method = "DELETE",
                body = payload,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração & Conselheiro — Companhias (`/api/companies`)
    // -------------------------------------------------------------------------

    suspend fun fetchCompaniesPayload(session: UserSession): CompaniesApiPayload =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/companies",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            json.decodeFromString(text)
        }

    suspend fun saveCompany(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/companies",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun updateCompanyMotto(
        session: UserSession,
        companyId: String,
        motto: String,
        previousMotto: String?
    ) = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("id", companyId)
            put("motto", motto.trim())
            if (previousMotto != null) put("previous_motto", previousMotto)
        }.toString()
        executeJsonRequest(
            url = "$portalBaseUrl/api/companies",
            method = "PUT",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
    }

    suspend fun deleteCompany(session: UserSession, companyId: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(companyId, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/companies?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração — Cronograma (`/api/schedule`)
    // -------------------------------------------------------------------------

    suspend fun fetchAdminSchedule(session: UserSession): List<ScheduleItem> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/schedule",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val arr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(arr)
        }

    suspend fun saveScheduleItem(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/schedule",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun deleteScheduleItem(session: UserSession, id: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(id, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/schedule?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração — Logística (`/api/logistics`)
    // -------------------------------------------------------------------------

    suspend fun fetchLogisticsBuses(session: UserSession): List<LogisticsBus> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/logistics",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val arr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(arr)
        }

    suspend fun saveLogisticsBus(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/logistics",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun deleteLogisticsBus(session: UserSession, id: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(id, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/logistics?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração & Conselheiro — Avisos (`/api/announcements`)
    // -------------------------------------------------------------------------

    suspend fun saveAnnouncement(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/announcements",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun deleteAnnouncement(session: UserSession, id: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(id, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/announcements?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração — Mídias (`/api/media`)
    // -------------------------------------------------------------------------

    suspend fun fetchAllMedia(session: UserSession): List<MediaPhoto> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/media?all=true",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val arr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(arr)
        }

    suspend fun saveMediaPhoto(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/media",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun deleteMediaPhoto(session: UserSession, id: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(id, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/media?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração — Saúde (`/api/medical`, `/api/medical/appointments`)
    // -------------------------------------------------------------------------

    suspend fun fetchMedicalRecords(session: UserSession): List<MedicalRecordSummary> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/medical",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val dataArr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(dataArr)
        }

    suspend fun saveMedicalRecord(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/medical",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun deleteMedicalRecord(session: UserSession, id: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(id, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/medical?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun fetchMedicalAppointments(session: UserSession): List<MedicalAppointment> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/medical/appointments",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val dataArr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(dataArr)
        }

    suspend fun saveMedicalAppointment(session: UserSession, isNew: Boolean, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/medical/appointments",
                method = if (isNew) "POST" else "PUT",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun deleteMedicalAppointment(session: UserSession, id: String) =
        withContext(Dispatchers.IO) {
            val encoded = URLEncoder.encode(id, "UTF-8")
            executeJsonRequest(
                url = "$portalBaseUrl/api/medical/appointments?id=$encoded",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração & Conselheiro — Inclusão (`/api/inclusion`)
    // -------------------------------------------------------------------------

    suspend fun fetchInclusionCases(
        session: UserSession,
        includeArchived: Boolean = false
    ): List<InclusionCaseSummary> = withContext(Dispatchers.IO) {
        val query = if (includeArchived) "?includeArchived=true" else ""
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/inclusion$query",
            method = "GET",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        val root = json.parseToJsonElement(text).jsonObject
        val dataArr = root["cases"] ?: root["data"] ?: JsonArray(emptyList())
        json.decodeFromJsonElement(dataArr)
    }

    suspend fun fetchInclusionCaseDetail(
        session: UserSession,
        caseId: String
    ): Pair<InclusionCaseSummary, List<InclusionInterviewRecord>> = withContext(Dispatchers.IO) {
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/inclusion/$caseId",
            method = "GET",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        val root = json.parseToJsonElement(text).jsonObject
        val caseEl = root["data"] ?: throw ApiException(404, "Caso de inclusão não encontrado.")
        val interviewsEl = caseEl.jsonObject["interviews"] ?: JsonArray(emptyList())
        Pair(
            json.decodeFromJsonElement(caseEl),
            json.decodeFromJsonElement(interviewsEl)
        )
    }

    suspend fun createInclusionCase(session: UserSession, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/inclusion",
                method = "POST",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun updateInclusionCase(session: UserSession, caseId: String, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/inclusion/$caseId",
                method = "PATCH",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun recordInclusionDecision(session: UserSession, caseId: String, body: JsonObject) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/inclusion/$caseId/decision",
                method = "POST",
                body = body.toString(),
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    suspend fun saveInclusionInterview(
        session: UserSession,
        caseId: String,
        interviewId: String?,
        body: JsonObject
    ) = withContext(Dispatchers.IO) {
        val url = if (interviewId.isNullOrBlank()) {
            "$portalBaseUrl/api/inclusion/$caseId/interviews"
        } else {
            "$portalBaseUrl/api/inclusion/$caseId/interviews/$interviewId"
        }
        executeJsonRequest(
            url = url,
            method = if (interviewId.isNullOrBlank()) "POST" else "PATCH",
            body = body.toString(),
            bearerToken = session.accessToken,
            includeApiKey = false
        )
    }

    suspend fun archiveInclusionCase(session: UserSession, caseId: String, version: Int) =
        withContext(Dispatchers.IO) {
            executeJsonRequest(
                url = "$portalBaseUrl/api/inclusion/$caseId?version=$version",
                method = "DELETE",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
        }

    // -------------------------------------------------------------------------
    // Administração — Auditoria de Conselheiros (`/api/admin/counselor-audit`)
    // -------------------------------------------------------------------------

    suspend fun fetchCounselorAudit(session: UserSession): List<CounselorAuditEntry> =
        withContext(Dispatchers.IO) {
            val text = executeJsonRequest(
                url = "$portalBaseUrl/api/admin/counselor-audit",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val root = json.parseToJsonElement(text).jsonObject
            val arr = root["data"] ?: JsonArray(emptyList())
            json.decodeFromJsonElement(arr)
        }

    // -------------------------------------------------------------------------
    // Administração — Inscrições FSY (34 Colunas, Lotes, PDF, ZIP, XLSX)
    // -------------------------------------------------------------------------

    suspend fun fetchRegistrations(
        session: UserSession,
        batchId: String? = null,
        roleCategory: String = "all",
        status: String = "",
        stakeName: String = "",
        wardName: String = "",
        hasHealthAlert: Boolean = false,
        hasIssues: Boolean = false,
        search: String = "",
        page: Int = 1,
        pageSize: Int = 50
    ): RegistrationListResponseDto = withContext(Dispatchers.IO) {
        val params = buildList {
            if (!batchId.isNullOrBlank()) add("batchId=${URLEncoder.encode(batchId, "UTF-8")}")
            add("roleCategory=${URLEncoder.encode(roleCategory, "UTF-8")}")
            if (status.isNotBlank()) add("status=${URLEncoder.encode(status, "UTF-8")}")
            if (stakeName.isNotBlank()) add("stakeName=${URLEncoder.encode(stakeName, "UTF-8")}")
            if (wardName.isNotBlank()) add("wardName=${URLEncoder.encode(wardName, "UTF-8")}")
            if (hasHealthAlert) add("hasHealthAlert=true")
            if (hasIssues) add("hasIssues=true")
            if (search.isNotBlank()) add("search=${URLEncoder.encode(search.trim(), "UTF-8")}")
            add("page=$page")
            add("pageSize=$pageSize")
        }.joinToString("&")

        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/admin/registrations?$params",
            method = "GET",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString(text)
    }

    suspend fun fetchRegistrationDetail(
        session: UserSession,
        registrationId: String
    ): RegistrationRecordDto = withContext(Dispatchers.IO) {
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/admin/registrations/$registrationId",
            method = "GET",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString(text)
    }

    suspend fun previewRegistrationsWorkbook(
        session: UserSession,
        filename: String,
        xlsxBytes: ByteArray
    ): RegistrationPreviewSummaryDto = withContext(Dispatchers.IO) {
        val conn = (URL("$portalBaseUrl/api/admin/registrations/preview").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20000
            readTimeout = 30000
            useCaches = false
            doOutput = true
            setRequestProperty("Authorization", "Bearer ${session.accessToken}")
            setRequestProperty("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            setRequestProperty("X-Filename", filename)
        }
        try {
            conn.outputStream.use { it.write(xlsxBytes) }
            val text = readResponseBody(conn)
            json.decodeFromString(text)
        } finally {
            conn.disconnect()
        }
    }

    suspend fun saveAuthorizationAdjustments(
        session: UserSession,
        registrationId: String,
        adjustments: Map<String, String> = emptyMap(),
        resetAdjustments: Boolean = false
    ): RegistrationRecordDto = withContext(Dispatchers.IO) {
        val payload = authorizationAdjustmentsRequestBody(adjustments, resetAdjustments)
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/admin/registrations/$registrationId",
            method = "PATCH", body = payload, bearerToken = session.accessToken, includeApiKey = false
        )
        json.decodeFromString(text)
    }

    suspend fun previewAuthorizationPdf(
        session: UserSession,
        registrationId: String,
        adjustments: Map<String, String> = emptyMap(),
        useNormalizedNames: Boolean = true
    ): ByteArray = withContext(Dispatchers.IO) {
        val payload = if (adjustments.isEmpty()) null else buildJsonObject {
            put("adjustments", buildJsonObject { adjustments.forEach { (key, value) -> put(key, value) } })
        }.toString()
        downloadBinary(
            url = "$portalBaseUrl/api/admin/registrations/$registrationId/authorization-pdf?download=0&useNormalizedNames=$useNormalizedNames",
            method = if (payload == null) "GET" else "POST", body = payload, bearerToken = session.accessToken
        )
    }

    suspend fun commitRegistrationsPreview(
        session: UserSession,
        previewId: String,
        mode: String,
        expectedRevision: Int,
        useNormalizedNames: Boolean = true,
        acknowledgeAdjustmentRemoval: Boolean = false,
        idempotencyKey: String = UUID.randomUUID().toString()
    ): CommitRegistrationImportResponseDto = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("previewId", previewId)
            put("mode", mode)
            put("expectedRevision", expectedRevision)
            put("idempotencyKey", idempotencyKey)
            put("useNormalizedNames", useNormalizedNames)
            put("acknowledgeAdjustmentRemoval", acknowledgeAdjustmentRemoval)
        }.toString()

        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/admin/registrations",
            method = "POST",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString(text)
    }

    suspend fun deleteRegistrationBatch(
        session: UserSession,
        batchId: String
    ): DeleteRegistrationBatchResponseDto = withContext(Dispatchers.IO) {
        val text = executeJsonRequest(
            url = "$portalBaseUrl/api/admin/registrations/batches/$batchId",
            method = "DELETE",
            body = null,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        json.decodeFromString(text)
    }

    suspend fun downloadAuthorizationPdf(
        session: UserSession,
        registrationId: String,
        useNormalizedNames: Boolean = true
    ): ByteArray = withContext(Dispatchers.IO) {
        val normFlag = if (useNormalizedNames) "true" else "false"
        downloadBinary(
            url = "$portalBaseUrl/api/admin/registrations/$registrationId/authorization-pdf?useNormalizedNames=$normFlag",
            method = "GET",
            body = null,
            bearerToken = session.accessToken
        )
    }

    suspend fun downloadAuthorizationPdfBatchZip(
        session: UserSession,
        batchId: String? = null,
        partIndex: Int = 1,
        partSize: Int = 50,
        roleCategory: String = "Participante",
        search: String = "",
        useNormalizedNames: Boolean = true
    ): ByteArray = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            if (!batchId.isNullOrBlank()) put("batchId", batchId)
            put("roleCategory", roleCategory)
            if (search.isNotBlank()) put("search", search.trim())
            put("partIndex", partIndex)
            put("partSize", partSize.coerceIn(1, 50))
            put("useNormalizedNames", useNormalizedNames)
        }.toString()

        downloadBinary(
            url = "$portalBaseUrl/api/admin/registrations/authorization-pdf-batch",
            method = "POST",
            body = payload,
            bearerToken = session.accessToken
        )
    }

    suspend fun downloadExportedXlsx(
        session: UserSession,
        batchId: String? = null,
        roleCategory: String = "all",
        search: String = "",
        useNormalizedNames: Boolean = true
    ): ByteArray = withContext(Dispatchers.IO) {
        val params = buildList {
            if (!batchId.isNullOrBlank()) add("batchId=${URLEncoder.encode(batchId, "UTF-8")}")
            add("roleCategory=${URLEncoder.encode(roleCategory, "UTF-8")}")
            if (search.isNotBlank()) add("search=${URLEncoder.encode(search.trim(), "UTF-8")}")
            add("useNormalizedNames=${if (useNormalizedNames) "true" else "false"}")
        }.joinToString("&")
        downloadBinary(
            url = "$portalBaseUrl/api/admin/registrations/export-xlsx?$params",
            method = "GET",
            body = null,
            bearerToken = session.accessToken
        )
    }

    suspend fun downloadBlankTemplatePdf(session: UserSession): ByteArray =
        withContext(Dispatchers.IO) {
            downloadBinary(
                url = "$portalBaseUrl/api/admin/registrations/template-pdf",
                method = "GET",
                body = null,
                bearerToken = session.accessToken
            )
        }

    // -------------------------------------------------------------------------
    // Link do Grupo de WhatsApp da Companhia
    // -------------------------------------------------------------------------

    suspend fun fetchCompanyWhatsapp(session: UserSession): List<CompanyWhatsappLink> =
        withContext(Dispatchers.IO) {
            val responseText = executeJsonRequest(
                url = "$portalBaseUrl/api/companies/whatsapp",
                method = "GET",
                body = null,
                bearerToken = session.accessToken,
                includeApiKey = false
            )
            val rootEl = json.parseToJsonElement(responseText)
            if (rootEl is JsonArray) {
                return@withContext rootEl.map { json.decodeFromJsonElement(CompanyWhatsappLink.serializer(), it) }
            }
            val root = rootEl.jsonObject
            val dataElement = root["data"] ?: root
            when (dataElement) {
                is JsonArray -> dataElement.map { json.decodeFromJsonElement(CompanyWhatsappLink.serializer(), it) }
                is JsonObject -> {
                    val companiesArr = dataElement["companies"] as? JsonArray
                    val singleCompany = dataElement["company"] as? JsonObject
                    when {
                        companiesArr != null -> companiesArr.map { json.decodeFromJsonElement(CompanyWhatsappLink.serializer(), it) }
                        singleCompany != null -> listOf(json.decodeFromJsonElement(CompanyWhatsappLink.serializer(), singleCompany))
                        dataElement.containsKey("company_id") -> listOf(json.decodeFromJsonElement(CompanyWhatsappLink.serializer(), dataElement))
                        else -> emptyList()
                    }
                }
                else -> emptyList()
            }
        }

    suspend fun saveCompanyWhatsapp(
        session: UserSession,
        companyId: String,
        inviteUrl: String?
    ): CompanyWhatsappLink = withContext(Dispatchers.IO) {
        val normalized = if (inviteUrl.isNullOrBlank()) {
            null
        } else {
            WhatsappInviteValidator.normalizeWhatsappInvite(inviteUrl)
                ?: throw ApiException(400, "Informe um link válido do WhatsApp (https://chat.whatsapp.com/...).")
        }
        val payload = buildJsonObject {
            put("company_id", companyId)
            if (normalized == null) put("invite_url", JsonNull) else put("invite_url", normalized)
        }.toString()
        val responseText = executeJsonRequest(
            url = "$portalBaseUrl/api/companies/whatsapp",
            method = "PUT",
            body = payload,
            bearerToken = session.accessToken,
            includeApiKey = false
        )
        val root = json.parseToJsonElement(responseText).jsonObject
        val dataElement = root["data"] ?: root
        if (dataElement is JsonObject) {
            val inner = (dataElement["company"] as? JsonObject) ?: dataElement
            if (inner.containsKey("company_id")) {
                json.decodeFromJsonElement(CompanyWhatsappLink.serializer(), inner)
            } else {
                CompanyWhatsappLink(companyId = companyId, inviteUrl = normalized, canEdit = true)
            }
        } else {
            CompanyWhatsappLink(companyId = companyId, inviteUrl = normalized, canEdit = true)
        }
    }

    // -------------------------------------------------------------------------
    // Helpers Privados de Transporte HTTP
    // -------------------------------------------------------------------------

    private fun parseAuthSessionResponse(responseText: String): UserSession {
        val obj = json.parseToJsonElement(responseText).jsonObject
        val accessToken = obj["access_token"]?.jsonPrimitive?.contentOrNull
            ?: throw ApiException(401, "Sessão inválida retornada pelo servidor.")
        val refreshToken = obj["refresh_token"]?.jsonPrimitive?.contentOrNull ?: ""
        val expiresAt = obj["expires_at"]?.jsonPrimitive?.longOrNull
            ?: obj["expires_in"]?.jsonPrimitive?.longOrNull?.let { System.currentTimeMillis() / 1000L + it }
            ?: 0L
        val userObj = obj["user"]?.jsonObject
        val userId = userObj?.get("id")?.jsonPrimitive?.contentOrNull
            ?: throw ApiException(401, "Identificador do usuário ausente na sessão.")
        val email = userObj["email"]?.jsonPrimitive?.contentOrNull

        return UserSession(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAtEpochSeconds = expiresAt,
            userId = userId,
            email = email
        )
    }

    private fun executeJsonRequest(
        url: String,
        method: String,
        body: String?,
        bearerToken: String?,
        includeApiKey: Boolean
    ): String {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 20000
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
            if (includeApiKey && supabaseAnonKey.isNotBlank()) {
                setRequestProperty("apikey", supabaseAnonKey)
            }
            if (!bearerToken.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $bearerToken")
            }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) {
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            return readResponseBody(conn)
        } finally {
            conn.disconnect()
        }
    }

    private fun downloadBinary(
        url: String,
        method: String,
        body: String?,
        bearerToken: String
    ): ByteArray {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 20000
            readTimeout = 45000
            useCaches = false
            setRequestProperty("Authorization", "Bearer $bearerToken")
            setRequestProperty("Cache-Control", "no-store")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) {
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                val errText = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                throw buildApiException(errText, code)
            }
            return conn.inputStream.use { it.readBytes() }
        } finally {
            conn.disconnect()
        }
    }

    private fun readResponseBody(conn: HttpURLConnection): String {
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.let {
            BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { reader -> reader.readText() }
        } ?: ""
        if (code !in 200..299) {
            throw buildApiException(text, code)
        }
        return text
    }

    private fun buildApiException(rawText: String, statusCode: Int): ApiException {
        return try {
            val obj = json.parseToJsonElement(rawText).jsonObject
            // Frase legível primeiro; o campo "error" do Supabase costuma ser só um código (invalid_grant).
            val raw = obj["error_description"]?.jsonPrimitive?.contentOrNull
                ?: obj["message"]?.jsonPrimitive?.contentOrNull
                ?: obj["msg"]?.jsonPrimitive?.contentOrNull
                ?: obj["error"]?.jsonPrimitive?.contentOrNull
            val code = obj["code"]?.jsonPrimitive?.contentOrNull
                ?: obj["error_code"]?.jsonPrimitive?.contentOrNull
            val rotate = obj["requiresTokenRotation"]?.jsonPrimitive?.booleanOrNull ?: false
            ApiException(statusCode, FriendlyErrors.message(raw, statusCode), code, rotate)
        } catch (_: Exception) {
            ApiException(statusCode, FriendlyErrors.byStatus(statusCode))
        }
    }
}

data class SignUpResult(
    val session: UserSession?,
    val requiresEmailConfirmation: Boolean
)
