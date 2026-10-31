package br.com.fsyrp2.app.security

import android.net.Uri
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Implementação RFC 7636 (PKCE S256) + validação de parâmetro `state` para OAuth Google
 * via Chrome Custom Tabs com callback `fsyrp2://auth-callback`.
 */
object PkceAuthHelper {
    const val REDIRECT_URI = "fsyrp2://auth-callback"
    private val secureRandom = SecureRandom()

    fun generateCodeVerifier(): String {
        val bytes = ByteArray(48)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun computeCodeChallengeS256(codeVerifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(codeVerifier.toByteArray(Charsets.US_ASCII))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }

    fun generateStateNonce(): String {
        val bytes = ByteArray(24)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun verifyState(expectedState: String, actualState: String?): Boolean {
        if (expectedState.isBlank() || actualState.isNullOrBlank()) return false
        val a = expectedState.toByteArray(Charsets.UTF_8)
        val b = actualState.toByteArray(Charsets.UTF_8)
        return MessageDigest.isEqual(a, b)
    }

    fun buildGoogleAuthorizeUrl(
        supabaseUrl: String,
        codeChallenge: String,
        state: String
    ): Uri {
        val base = supabaseUrl.trimEnd('/')
        val redirectWithState = Uri.parse(REDIRECT_URI)
            .buildUpon()
            .appendQueryParameter("state", state)
            .build()
            .toString()

        return Uri.parse("$base/auth/v1/authorize")
            .buildUpon()
            .appendQueryParameter("provider", "google")
            .appendQueryParameter("redirect_to", redirectWithState)
            .appendQueryParameter("code_challenge", codeChallenge)
            .appendQueryParameter("code_challenge_method", "s256")
            .build()
    }
}
