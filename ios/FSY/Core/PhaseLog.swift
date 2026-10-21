import os

/// Marcos do ciclo de vida para diagnóstico no Console. Só nomes de etapa: nunca e-mail, token ou dados.
enum PhaseLog {
    private static let logger = Logger(subsystem: "br.com.fsyrp2.app", category: "fase")

    static func mark(_ step: StaticString) {
        logger.notice("\(step, privacy: .public)")
    }
}
