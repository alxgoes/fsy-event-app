import SwiftUI

/// Atualização leve da tela ativa: ao aparecer e a cada intervalo, só com o app em primeiro plano.
/// A tarefa é cancelada ao sair da tela; formulários abertos guardam o próprio rascunho e não são tocados.
struct AdminAutoRefresh: ViewModifier {
    let seconds: Int
    let action: () async -> Void
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content.task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await action()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(seconds))
                guard !Task.isCancelled, scenePhase == .active else { break }
                await action()
            }
        }
    }
}

extension View {
    func adminAutoRefresh(seconds: Int = 60, _ action: @escaping () async -> Void) -> some View {
        modifier(AdminAutoRefresh(seconds: seconds, action: action))
    }

    /// Fundo geométrico atrás das listas do painel.
    func adminListStyle() -> some View {
        scrollContentBackground(.hidden)
            .background(FSYBackground())
    }
}

/// Linha de estado no topo das listas: erro com repetir, ou horário da última atualização.
struct AdminStatusSection<Value>: View {
    let resource: AdminResource<Value>
    let retry: () async -> Void

    var body: some View {
        if let error = resource.error {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(FSYPalette.urgentText)
                        .font(.subheadline.weight(.semibold))
                    Button("Tentar novamente") { Task { await retry() } }
                        .font(.subheadline.weight(.semibold))
                        .frame(minHeight: 44)
                }
            }
        } else if resource.value == nil {
            Section {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Carregando…").foregroundStyle(FSYPalette.muted)
                }
                .frame(minHeight: 44)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// Rodapé "Atualizado às HH:mm · a cada 1 min".
struct AdminUpdatedFooter: View {
    let date: Date?
    var isLoading = false

    var body: some View {
        HStack(spacing: 6) {
            if isLoading { ProgressView().controlSize(.mini) }
            if let date {
                Text("Atualizado às \(EventCalendar.timeString(date)) · atualiza a cada minuto e ao puxar")
            } else {
                Text("Aguardando dados do portal")
            }
        }
        .font(.footnote)
        .foregroundStyle(FSYPalette.muted)
        // Superfície opaca discreta: legível sobre as formas do fundo, que continuam visíveis ao redor.
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Capsule().fill(FSYPalette.surface))
        .overlay(Capsule().strokeBorder(FSYPalette.border.opacity(0.25), lineWidth: 1))
    }
}

/// Folha de formulário: salvar só fecha depois da confirmação do servidor; erro do servidor aparece no topo.
struct AdminFormSheet<Fields: View>: View {
    let title: String
    var saveLabel = "Salvar"
    var canSave = true
    var isDirty = true
    let save: () async throws -> Void
    @ViewBuilder let fields: () -> Fields

    @Environment(\.dismiss) private var dismiss
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(FSYPalette.urgentText)
                    }
                }
                fields()
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }.disabled(saving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving {
                        ProgressView().accessibilityLabel("Salvando")
                    } else {
                        Button(saveLabel) { Task { await submit() } }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .interactiveDismissDisabled(isDirty || saving)
            .sensoryFeedback(.error, trigger: error)
        }
    }

    private func submit() async {
        saving = true
        error = nil
        do {
            try await save()
            saving = false
            dismiss()
        } catch is CancellationError {
            saving = false
        } catch {
            saving = false
            self.error = adminMessage(error)
        }
    }
}

/// Campo de texto com rótulo visível (Form), alvo de 44 pt.
struct AdminField: View {
    let label: String
    @Binding var text: String
    var prompt: String = ""
    var keyboard: UIKeyboardType = .default
    var axis: Axis = .horizontal

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(FSYPalette.muted)
            TextField(prompt.isEmpty ? label : prompt, text: $text, axis: axis)
                .keyboardType(keyboard)
                .lineLimit(axis == .vertical ? 3...8 : 1...1)
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .contain)
    }
}

/// Selo colorido de módulo/estado.
struct AdminBadge: View {
    let text: String
    var color: Color = FSYPalette.sunshine
    var ink: Color = FSYPalette.fixedInk

    var body: some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(ink)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(color))
            .overlay(Capsule().strokeBorder(FSYPalette.fixedInk.opacity(0.7), lineWidth: 1))
    }
}

/// Estado vazio de lista.
struct AdminEmptyRow: View {
    let text: String
    var icon = "tray"

    var body: some View {
        Label(text, systemImage: icon)
            .foregroundStyle(FSYPalette.muted)
            .frame(minHeight: 44)
    }
}

extension Date {
    var adminDateTime: String {
        formatted(.dateTime.day().month(.abbreviated).hour().minute().locale(Locale(identifier: "pt_BR")))
    }
}
