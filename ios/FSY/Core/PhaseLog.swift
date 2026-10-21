import os

/// Marcos do ciclo de vida para diagnóstico no Console. Só nomes de etapa: nunca e-mail, token ou dados.
enum PhaseLog {
    private static let logger = Logger(subsystem: "br.com.fsyrp2.app", category: "fase")

    static func mark(_ step: StaticString) {
        logger.notice("\(step, privacy: .public)")
    }

    /// Leitura do PostgREST: tabela, status HTTP, código PostgREST (ex.: PGRST201) e nomes de campos de
    /// decodificação. Nenhum valor, ID, token ou mensagem livre do servidor.
    static func read(_ table: String, status: Int, code: String? = nil, field: String? = nil) {
        logger.notice("leitura \(table, privacy: .public): HTTP \(status, privacy: .public) \(code ?? "-", privacy: .public) \(field ?? "-", privacy: .public)")
    }

    /// Contagens agregadas (sem conteúdo) para confirmar o formato recebido.
    static func counts(_ table: String, rows: Int, valid: Int) {
        logger.notice("contagem \(table, privacy: .public): \(rows, privacy: .public) linhas, \(valid, privacy: .public) válidas")
    }
}
