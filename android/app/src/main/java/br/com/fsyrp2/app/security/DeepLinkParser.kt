package br.com.fsyrp2.app.security

import br.com.fsyrp2.app.model.AppTab
import java.net.URI
import java.net.URLDecoder
import java.util.UUID

sealed class DeepLinkTarget {
    data class AuthCallback(
        val code: String?,
        val state: String?,
        val error: String?
    ) : DeepLinkTarget()

    data class Navigation(
        val tab: AppTab,
        val itemId: String? = null
    ) : DeepLinkTarget()
}

/**
 * Parser e validador de deep links `fsyrp2://` com allowlist fechada:
 * - Recusa qualquer outro scheme, host, credenciais (`userInfo`) ou fragmento (`#`).
 * - Suporta:
 *   1. `fsyrp2://auth-callback?code=...&state=...` (retorno OAuth PKCE)
 *   2. `fsyrp2://inicio`, `fsyrp2://agenda[?item=<uuid>]`, `fsyrp2://avisos[?item=<uuid>]`, `fsyrp2://perfil` (padrão iOS/Widgets)
 *   3. `fsyrp2://portal/announcements[/<uuid>]` e `fsyrp2://portal/schedule[/<uuid>]` (padrão FCM Push)
 */
object DeepLinkParser {
    const val SCHEME = "fsyrp2"
    private val ALLOWED_HOSTS = setOf("auth-callback", "inicio", "agenda", "avisos", "perfil", "mais", "portal", "admin", "gestao", "gestão", "consultor", "counselor")

    fun parse(rawUriString: String?): DeepLinkTarget? {
        val raw = rawUriString?.trim().orEmpty()
        if (raw.isEmpty()) return null
        val uri = try {
            URI(raw)
        } catch (_: Exception) {
            return null
        }

        val scheme = uri.scheme?.lowercase() ?: return null
        if (scheme != SCHEME) return null
        if (uri.rawUserInfo != null || uri.rawFragment != null) return null

        val host = uri.host?.lowercase() ?: return null
        if (host !in ALLOWED_HOSTS) return null

        if (host in setOf("admin", "gestao", "gestão", "consultor", "counselor")) return DeepLinkTarget.Navigation(AppTab.INICIO)
        val path = uri.rawPath.orEmpty()
        if (path.contains("..") || path.contains("\\")) return null

        val queryMap = parseQuery(uri.rawQuery)

        if (host == "auth-callback") {
            if (path.isNotEmpty() && path != "/") return null
            val code = queryMap["code"]
            val state = queryMap["state"]
            val err = queryMap["error_description"] ?: queryMap["error"]
            if (code.isNullOrBlank() && err.isNullOrBlank()) return null
            return DeepLinkTarget.AuthCallback(code = code, state = state, error = err)
        }

        if (host == "portal") {
            val segments = path.trim('/').split('/').filter { it.isNotEmpty() }
            if (segments.isEmpty()) return DeepLinkTarget.Navigation(AppTab.INICIO)
            return when (segments[0].lowercase()) {
                "announcements", "avisos" -> {
                    val id = segments.getOrNull(1) ?: queryMap["item"]
                    if (id != null && !isValidUuid(id)) return null
                    DeepLinkTarget.Navigation(AppTab.AVISOS, itemId = id?.lowercase())
                }
                "schedule", "agenda" -> {
                    val id = segments.getOrNull(1) ?: queryMap["item"]
                    if (id != null && !isValidUuid(id)) return null
                    DeepLinkTarget.Navigation(AppTab.AGENDA, itemId = id?.lowercase())
                }
                "perfil", "profile" -> DeepLinkTarget.Navigation(AppTab.PERFIL)
                "admin", "gestao", "consultor", "counselor" -> DeepLinkTarget.Navigation(AppTab.INICIO)
                else -> null
            }
        }

        val tab = AppTab.fromHost(host) ?: return null
        if (path.isNotEmpty() && path != "/") return null

        // Somente o parâmetro `item=<uuid>` é aceito nas abas `agenda` e `avisos`
        if (queryMap.keys.any { it != "item" }) return null
        val itemParam = queryMap["item"]
        if (itemParam != null) {
            if (tab != AppTab.AGENDA && tab != AppTab.AVISOS) return null
            if (!isValidUuid(itemParam)) return null
        }

        return DeepLinkTarget.Navigation(tab = tab, itemId = itemParam?.lowercase())
    }

    fun buildTabUrl(tab: AppTab, itemId: String? = null): String {
        val cleanId = itemId?.trim()?.lowercase()
        return if (!cleanId.isNullOrEmpty() && isValidUuid(cleanId) && (tab == AppTab.AGENDA || tab == AppTab.AVISOS)) {
            "$SCHEME://${tab.wireHost}?item=$cleanId"
        } else {
            "$SCHEME://${tab.wireHost}"
        }
    }

    fun isValidUuid(value: String?): Boolean {
        val v = value?.trim().orEmpty()
        if (v.length != 36) return false
        return try {
            UUID.fromString(v)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun parseQuery(rawQuery: String?): Map<String, String> {
        if (rawQuery.isNullOrBlank()) return emptyMap()
        val result = linkedMapOf<String, String>()
        for (pair in rawQuery.split("&")) {
            if (pair.isBlank()) continue
            val idx = pair.indexOf('=')
            val key = if (idx >= 0) pair.substring(0, idx) else pair
            val value = if (idx >= 0) pair.substring(idx + 1) else ""
            val decodedKey = URLDecoder.decode(key, "UTF-8")
            val decodedVal = URLDecoder.decode(value, "UTF-8")
            result[decodedKey] = decodedVal
        }
        return result
    }
}
