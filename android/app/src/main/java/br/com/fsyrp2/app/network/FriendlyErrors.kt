package br.com.fsyrp2.app.network

/**
 * Converte respostas de erro do servidor em frases curtas em pt-BR.
 * Nunca mostra códigos técnicos (invalid_grant, HTTP 500, JWT expired) para quem usa o app.
 */
object FriendlyErrors {
    private val knownEnglish: List<Pair<Regex, String>> = listOf(
        Regex("invalid login credentials|invalid_credentials|invalid email or password", RegexOption.IGNORE_CASE) to
            "E-mail ou senha incorretos.",
        Regex("email not confirmed", RegexOption.IGNORE_CASE) to
            "Confirme seu e-mail pelo link que enviamos antes de entrar.",
        Regex("user already registered|already been registered|user_already_exists", RegexOption.IGNORE_CASE) to
            "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
        Regex("password should be|weak_password|password is too weak", RegexOption.IGNORE_CASE) to
            "Use uma senha com pelo menos 8 caracteres, letras e números.",
        Regex("rate limit|too many requests|over_request_rate_limit|over_email_send_rate_limit", RegexOption.IGNORE_CASE) to
            "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
        Regex("invalid_grant|refresh token|jwt expired|token is expired|invalid jwt|bad_jwt|session_not_found", RegexOption.IGNORE_CASE) to
            "Sua sessão terminou. Entre novamente.",
        Regex("unable to validate email|invalid email|email_address_invalid", RegexOption.IGNORE_CASE) to
            "Confira o e-mail digitado.",
        Regex("signups not allowed|signup_disabled", RegexOption.IGNORE_CASE) to
            "Novos cadastros estão fechados no momento.",
        Regex("flow state|pkce|code verifier|auth code", RegexOption.IGNORE_CASE) to
            "Não foi possível concluir a entrada com Google. Tente novamente.",
    )

    private val portugueseHint = Regex(
        "[ãõçáéíóúâêôà]|\\b(nao|para|voce|sua|seu|com|informe|tente|conta|aviso|foto)\\b",
        RegexOption.IGNORE_CASE,
    )

    fun message(raw: String?, statusCode: Int): String {
        val text = raw?.trim().orEmpty()
        if (text.isNotEmpty()) {
            knownEnglish.firstOrNull { it.first.containsMatchIn(text) }?.let { return it.second }
            // Mensagens do portal já chegam em pt-BR: preserva.
            if (portugueseHint.containsMatchIn(text) && !text.contains("HTTP", ignoreCase = true)) return text
        }
        return byStatus(statusCode)
    }

    fun byStatus(statusCode: Int): String = when (statusCode) {
        400, 422 -> "Não foi possível concluir. Confira os dados e tente de novo."
        401 -> "Sua sessão terminou. Entre novamente."
        403 -> "Você não tem acesso a esta área."
        404 -> "Não encontramos esse conteúdo. Ele pode ter sido removido."
        409 -> "Alguém alterou isso há pouco. Atualize e tente de novo."
        413 -> "O arquivo é grande demais."
        429 -> "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."
        in 500..599 -> "O servidor não respondeu agora. Tente de novo em instantes."
        else -> "Não foi possível concluir agora. Tente de novo."
    }

    /** Mensagem para falhas sem resposta do servidor (sem rede, tempo esgotado). */
    const val OFFLINE = "Sem conexão. Verifique a internet e tente de novo."

    fun of(error: Throwable, fallback: String = "Não foi possível concluir agora. Tente de novo."): String = when (error) {
        is ApiException -> error.message
        is java.io.IOException -> OFFLINE
        else -> fallback
    }
}
