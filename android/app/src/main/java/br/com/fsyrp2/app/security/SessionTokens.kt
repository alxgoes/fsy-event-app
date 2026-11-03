package br.com.fsyrp2.app.security

import br.com.fsyrp2.app.model.UserSession
import br.com.fsyrp2.app.network.ApiException
import br.com.fsyrp2.app.network.PortalApiClient
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Renovação de sessão única para o processo inteiro (app, push e widgets).
 *
 * O Supabase troca o refresh token a cada renovação; duas renovações simultâneas com o mesmo
 * token fariam a segunda falhar. Por isso todos passam por este Mutex e, já dentro dele,
 * releem o cofre: se outra parte do app acabou de renovar, a sessão nova é reaproveitada.
 */
object SessionTokens {
    private val mutex = Mutex()
    private const val REFRESH_MARGIN_SECONDS = 90L

    class SessionEndedException(message: String) : Exception(message)

    fun needsRefresh(session: UserSession, nowSec: Long = System.currentTimeMillis() / 1000L): Boolean =
        session.expiresAtEpochSeconds > 0L &&
            session.expiresAtEpochSeconds - nowSec < REFRESH_MARGIN_SECONDS &&
            session.refreshToken.isNotBlank()

    /**
     * Devolve uma sessão válida para [expectedUserId]. Lança [SessionEndedException] quando o
     * servidor recusa a renovação (sessão encerrada de verdade) e [ApiException]/IOException
     * para falhas transitórias (sem rede), que não devem encerrar a sessão.
     */
    suspend fun valid(
        keyStore: KeystoreSessionStore,
        apiClient: PortalApiClient,
        expectedUserId: String? = null,
    ): UserSession = mutex.withLock {
        val stored = keyStore.loadSession() ?: throw SessionEndedException("Sessão encerrada.")
        if (expectedUserId != null && stored.userId != expectedUserId) {
            throw SessionEndedException("Sessão trocada.")
        }
        if (!needsRefresh(stored)) return@withLock stored
        val refreshed = try {
            apiClient.refreshSession(stored.refreshToken)
        } catch (e: ApiException) {
            if (e.statusCode in listOf(400, 401, 403)) throw SessionEndedException(e.message)
            throw e
        }
        if (refreshed.userId != stored.userId) throw SessionEndedException("Sessão trocada.")
        if (keyStore.loadSession()?.let { it.userId == stored.userId && it.refreshToken == stored.refreshToken } != true) {
            throw SessionEndedException("Sessão trocada.")
        }
        keyStore.saveSession(refreshed)
        refreshed
    }
}
