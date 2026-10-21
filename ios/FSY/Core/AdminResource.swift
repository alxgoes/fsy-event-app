import Foundation
import Observation

/// Dado carregado de uma API do painel, com estado de carregamento, erro e horário da última leitura.
/// Fica só na memória da tela: nada de saúde ou contas é gravado no aparelho.
///
/// Cada leitura recebe um número de sequência e só a mais recente aplica o resultado: uma atualização
/// automática antiga que termine depois do recarregamento pós-salvar não sobrescreve o dado novo.
@MainActor @Observable
final class AdminResource<Value> {
    private(set) var value: Value?
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var updatedAt: Date?
    @ObservationIgnored private var sequence = 0

    func load(_ fetch: () async throws -> Value) async {
        sequence += 1
        let request = sequence
        isLoading = true
        defer { if request == sequence { isLoading = false } }
        do {
            let fresh = try await fetch()
            guard request == sequence else { return }
            value = fresh
            error = nil
            updatedAt = Date()
        } catch is CancellationError {
            return
        } catch {
            guard request == sequence else { return }
            self.error = adminMessage(error)
        }
    }
}

func adminMessage(_ error: Error) -> String {
    (error as? APIError)?.userMessage ?? "Não foi possível concluir a operação. Tente novamente."
}
