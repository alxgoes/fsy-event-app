import AuthenticationServices
import SwiftUI

/// Entrar, cadastrar e recuperar acesso com as mesmas contas do portal.
struct LoginView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case entrar = "Entrar"
        case cadastrar = "Criar conta"
        case recuperar = "Recuperar"
        var id: String { rawValue }
    }

    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var mode: Mode = .entrar
    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var stake = ""
    @State private var phone = ""
    @State private var busy = false
    @State private var error: String?
    @State private var success: String?
    @State private var feedback = 0
    @State private var appeared = false
    @FocusState private var focus: Field?

    enum Field { case name, email, password, stake, phone }

    var body: some View {
        ZStack {
            FSYBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    if let notice = model.signedOutNotice {
                        StatusBanner(text: notice, icon: "exclamationmark.circle.fill", tone: .warning)
                    }
                    form
                        .fsyCard()
                    Text("Este app é o portal da FSY Sessão Ribeirão Preto 2. Entrada com as mesmas contas do site.")
                        .font(.footnote)
                        .foregroundStyle(FSYPalette.muted)
                }
                .padding(16)
                .opacity(appeared || reduceMotion ? 1 : 0)
                .offset(y: appeared || reduceMotion ? 0 : 16)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onAppear { withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { appeared = true } }
        .sensoryFeedback(trigger: feedback) { _, _ in error == nil ? .success : .error }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            FSYCirclesMark(size: 34)
            Text("FSY Sessão Ribeirão Preto 2")
                .font(FSYFont.display())
                .foregroundStyle(FSYPalette.ink)
                .fixedSize(horizontal: false, vertical: true)
            ThemeLockup(compact: true)
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(FSYPalette.parchment))
            Text("Equipe 05/02/2027 · Participantes 06 a 10/02/2027")
                .font(FSYFont.label())
                .foregroundStyle(FSYPalette.muted)
        }
        .padding(.top, 12)
    }

    @ViewBuilder private var form: some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker("Modo de acesso", selection: $mode) {
                ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .onChange(of: mode) { _, _ in
                error = nil
                success = nil
            }

            if mode == .cadastrar {
                field("Nome completo", text: $fullName, field: .name, content: .name)
            }
            field("E-mail", text: $email, field: .email, content: .username, keyboard: .emailAddress)
            if mode != .recuperar {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Senha").font(FSYFont.label()).foregroundStyle(FSYPalette.muted)
                    SecureField("Senha", text: $password)
                        .textContentType(mode == .cadastrar ? .newPassword : .password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit(submit)
                        .modifier(InputStyle())
                }
            }
            if mode == .cadastrar {
                field("Estaca (opcional)", text: $stake, field: .stake, content: nil)
                field("Telefone (opcional)", text: $phone, field: .phone, content: .telephoneNumber, keyboard: .phonePad)
                Text("Senha com ao menos 8 caracteres, letras e números. Toda conta nova começa como Jovem; cargos e companhia são definidos pela coordenação.")
                    .font(.footnote)
                    .foregroundStyle(FSYPalette.muted)
            }
            if mode == .recuperar {
                Text("Enviaremos um link para criar uma nova senha do portal. A redefinição abre no site.")
                    .font(.footnote)
                    .foregroundStyle(FSYPalette.muted)
            }

            if let error {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(FSYFont.body().weight(.semibold))
                    .foregroundStyle(FSYPalette.urgentText)
                    .accessibilityAddTraits(.updatesFrequently)
            }
            if let success {
                Label(success, systemImage: "checkmark.seal.fill")
                    .font(FSYFont.body().weight(.semibold))
                    .foregroundStyle(FSYPalette.link)
            }

            Button(action: submit) {
                HStack(spacing: 8) {
                    if busy { ProgressView().tint(.white) }
                    Text(primaryTitle)
                }
            }
            .buttonStyle(FSYButtonStyle(kind: .primary))
            .disabled(busy)

            if mode == .entrar {
                Button {
                    Task { await google() }
                } label: {
                    Label("Continuar com Google", systemImage: "globe")
                }
                .buttonStyle(FSYButtonStyle(kind: .outline))
                .disabled(busy)
                .accessibilityHint("Abre a autenticação segura do sistema")
            }
        }
    }

    private var primaryTitle: String {
        switch mode {
        case .entrar: "Entrar"
        case .cadastrar: "Criar conta"
        case .recuperar: "Enviar link"
        }
    }

    private func field(_ title: String, text: Binding<String>, field: Field, content: UITextContentType?, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(FSYFont.label()).foregroundStyle(FSYPalette.muted)
            TextField(title, text: text)
                .textContentType(content)
                .keyboardType(keyboard)
                .textInputAutocapitalization(field == .email ? .never : .words)
                .autocorrectionDisabled(field == .email)
                .focused($focus, equals: field)
                .submitLabel(.next)
                .modifier(InputStyle())
        }
    }

    private func submit() {
        guard !busy else { return }
        error = nil
        success = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        guard trimmedEmail.contains("@"), trimmedEmail.contains(".") else {
            fail("Informe um e-mail válido.")
            return
        }
        switch mode {
        case .entrar:
            guard !password.isEmpty else { return fail("Por favor, preencha o e-mail e a senha.") }
        case .cadastrar:
            guard fullName.trimmingCharacters(in: .whitespaces).count >= 2 else { return fail("Informe seu nome completo.") }
            if let problem = PasswordPolicy.problem(password) { return fail(problem) }
        case .recuperar:
            break
        }
        focus = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                switch mode {
                case .entrar:
                    try await model.signIn(email: trimmedEmail, password: password)
                case .cadastrar:
                    let result = try await model.signUp(email: trimmedEmail, password: password, fullName: fullName, stake: stake, phone: phone)
                    if case .confirmationRequired = result {
                        success = "Conta criada. Confirme seu e-mail pelo link enviado e depois entre."
                        mode = .entrar
                    }
                case .recuperar:
                    success = try await model.requestRecovery(email: trimmedEmail)
                }
                password = ""
                feedback += 1
            } catch let apiError as APIError {
                fail(apiError.userMessage)
            } catch {
                fail("Erro ao conectar com o servidor.")
            }
        }
    }

    private func google() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await model.signInWithGoogle { url in
                try await webAuthenticationSession.authenticate(
                    using: url,
                    callbackURLScheme: AppConfig.oauthCallbackScheme,
                    preferredBrowserSession: .ephemeral
                )
            }
            feedback += 1
        } catch let apiError as APIError {
            fail(apiError.userMessage)
        } catch let authError as ASWebAuthenticationSessionError where authError.code == .canceledLogin {
            return
        } catch {
            fail("Não foi possível concluir a entrada com Google.")
        }
    }

    private func fail(_ message: String) {
        error = message
        feedback += 1
    }
}

/// Mesma regra mínima de `src/lib/auth/password-policy.ts`.
enum PasswordPolicy {
    static func problem(_ password: String) -> String? {
        if password.count < 8 { return "A senha precisa ter pelo menos 8 caracteres." }
        if password.count > 72 { return "A senha pode ter no máximo 72 caracteres." }
        let hasLetter = password.range(of: "[A-Za-zÀ-ÿ]", options: .regularExpression) != nil
        let hasDigit = password.range(of: "[0-9]", options: .regularExpression) != nil
        return hasLetter && hasDigit ? nil : "Use letras e números na senha."
    }
}

struct InputStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.body)
            .padding(.horizontal, 14)
            .frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(FSYPalette.background))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(FSYPalette.muted.opacity(0.6), lineWidth: 1))
    }
}
