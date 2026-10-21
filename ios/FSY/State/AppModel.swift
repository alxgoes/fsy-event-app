import Foundation
import Observation
import UserNotifications

enum DataSource: Equatable {
    case none
    case live
    /// Cópia salva neste aparelho, com a data da última leitura bem-sucedida.
    case cache(Date)
}

enum RefreshReason {
    case launch, signIn, foreground, manual
}

@MainActor @Observable
final class AppModel {
    enum Phase: Equatable {
        case launching
        case needsConfiguration(String)
        case signedOut
        case signedIn
    }

    private(set) var phase: Phase = .launching
    private(set) var session: AuthSession?
    private(set) var profile: Profile?
    private(set) var company: Company?
    private(set) var schedule: [ScheduleItem] = []
    private(set) var announcements: [Announcement] = []
    private(set) var likedIDs: Set<String> = []
    private(set) var source: DataSource = .none
    private(set) var lastSuccess: Date?
    private(set) var isRefreshing = false
    private(set) var errorMessage: String?
    /// Motivo exibido na tela de entrada após logout forçado (sessão expirada, suspensão).
    var signedOutNotice: String?

    var selectedTab: AppTab = .inicio
    var focusedScheduleID: String?
    var focusedAnnouncementID: String?

    private(set) var remindersEnabled = false
    private(set) var reminderStatus: UNAuthorizationStatus = .notDetermined
    private(set) var liveActivityRunning = false

    let connectivity = Connectivity()

    @ObservationIgnored private var config: AppConfig?
    @ObservationIgnored private let http = HTTPClient()
    @ObservationIgnored private let reminders = ReminderScheduler()
    @ObservationIgnored private let liveActivities = LiveActivityController()
    @ObservationIgnored private var pendingLink: DeepLink?
    /// Incrementado a cada troca de conta: respostas atrasadas de outra sessão são descartadas.
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    /// Limpeza de lembretes, Atividades ao Vivo e widgets: roda fora do caminho da interface. Cada nova
    /// limpeza espera a anterior, e todo agendamento posterior espera a última, mantendo a ordem.
    @ObservationIgnored private var deviceCleanup: Task<Void, Never>?
    @ObservationIgnored private var didBootstrap = false
    private static let sessionAccount = "current"

    private var auth: AuthClient? { config.map { AuthClient(config: $0, http: http) } }
    private var data: DataClient? { config.map { DataClient(config: $0, http: http) } }

    var portalURL: URL? { config?.portalURL }
    var role: UserRole { profile?.role ?? .jovem }
    var liveActivitiesSupported: Bool { liveActivities.isSupported }

    /// Jovens veem os dias 1 a 5; a equipe também vê o Dia Zero (regra de /schedule).
    var visibleSchedule: [ScheduleItem] {
        role.isStaff ? schedule : schedule.filter { $0.day != "dia0" }
    }

    // MARK: Ciclo de vida

    /// Idempotente. Decide a fase só com Keychain e configuração (síncronos): nenhum serviço opcional
    /// do sistema (notificações, Atividades ao Vivo, widgets) pode prender a abertura.
    func bootstrap() async {
        guard !didBootstrap else { return }
        didBootstrap = true
        PhaseLog.mark("bootstrap: início")
        reminders.registerCategories()
        switch AppConfig.load() {
        case .failure(let problem):
            phase = .needsConfiguration(problem.message)
            return
        case .success(let loaded):
            config = loaded
        }

        guard let stored = Keychain.read(account: Self.sessionAccount),
              let session = try? JSONDecoder().decode(AuthSession.self, from: stored) else {
            // Reinstalação: o Keychain pode sobreviver ao app; sem sessão válida, limpa tudo.
            PhaseLog.mark("bootstrap: sem sessão, limpando")
            clearLocalState()
            PhaseLog.mark("bootstrap: entrada")
            phase = .signedOut
            return
        }
        PhaseLog.mark("bootstrap: sessão salva encontrada")
        self.session = session
        restoreCache(for: session.userID)
        phase = .signedIn
        await refresh(.launch)
    }

    func sceneBecameActive() {
        guard phase == .signedIn else { return }
        liveActivityRunning = liveActivities.isRunning
        Task { reminderStatus = await reminders.authorizationStatus() }
        if let lastSuccess, Date().timeIntervalSince(lastSuccess) < 30 { return }
        Task { await refresh(.foreground) }
    }

    // MARK: Entrada

    func signIn(email: String, password: String) async throws {
        guard let auth else { throw APIError.message("Configuração do app incompleta.") }
        let session = try await auth.signIn(email: email.trimmingCharacters(in: .whitespaces).lowercased(), password: password)
        await adopt(session)
    }

    func signUp(email: String, password: String, fullName: String, stake: String, phone: String) async throws -> SignUpResult {
        guard let auth else { throw APIError.message("Configuração do app incompleta.") }
        let result = try await auth.signUp(
            email: email.trimmingCharacters(in: .whitespaces).lowercased(), password: password,
            fullName: fullName.trimmingCharacters(in: .whitespaces),
            stake: stake.trimmingCharacters(in: .whitespaces), phone: phone.trimmingCharacters(in: .whitespaces)
        )
        if case .signedIn(let session) = result { await adopt(session) }
        return result
    }

    func requestRecovery(email: String) async throws -> String {
        guard let auth else { throw APIError.message("Configuração do app incompleta.") }
        return try await auth.requestRecovery(email: email.trimmingCharacters(in: .whitespaces).lowercased())
    }

    /// `authenticate` é a sessão de autenticação do sistema (ASWebAuthenticationSession), nunca uma WebView.
    func signInWithGoogle(authenticate: (URL) async throws -> URL) async throws {
        guard let auth else { throw APIError.message("Configuração do app incompleta.") }
        let pkce = PKCE()
        let callback = try await authenticate(auth.googleAuthorizeURL(pkce: pkce))
        let session = try await auth.completeGoogle(callback: callback, pkce: pkce)
        await adopt(session)
    }

    private func adopt(_ session: AuthSession) async {
        // Troca de conta: nada da pessoa anterior permanece em memória, cache, lembretes ou widgets.
        if self.session?.userID != session.userID || profile?.id != session.userID {
            clearLocalState()
        }
        generation += 1
        self.session = session
        persist(session)
        signedOutNotice = nil
        restoreCache(for: session.userID)
        phase = .signedIn
        selectedTab = pendingLink?.tab ?? .inicio
        await refresh(.signIn)
        if let link = pendingLink {
            pendingLink = nil
            route(link)
        }
    }

    func signOut(notice: String? = nil) async {
        let ending = session
        let revoker = auth
        generation += 1
        refreshTask?.cancel()
        clearLocalState()
        signedOutNotice = notice
        phase = .signedOut
        // A revogação no servidor usa o token já fora do Keychain e não segura a tela (rede lenta/offline).
        if let ending, let revoker { Task { await revoker.signOut(ending) } }
    }

    /// Apaga sessão, cópia local e memória na hora; a limpeza dos serviços do aparelho segue em segundo plano.
    private func clearLocalState() {
        PhaseLog.mark("limpeza: keychain/cache")
        Keychain.deleteAll()
        AccountCache.clearAll()
        let previous = deviceCleanup
        let reminders = reminders
        let liveActivities = liveActivities
        deviceCleanup = Task {
            await previous?.value
            PhaseLog.mark("limpeza: lembretes")
            await reminders.cancelAll()
            PhaseLog.mark("limpeza: atividades ao vivo")
            await liveActivities.endAll()
            PhaseLog.mark("limpeza: widgets")
            WidgetBridge.clear()
            PhaseLog.mark("limpeza: concluída")
        }
        http.reset()
        session = nil
        profile = nil
        company = nil
        schedule = []
        announcements = []
        likedIDs = []
        source = .none
        lastSuccess = nil
        errorMessage = nil
        isRefreshing = false
        remindersEnabled = false
        liveActivityRunning = false
        focusedScheduleID = nil
        focusedAnnouncementID = nil
    }

    private func persist(_ session: AuthSession) {
        if let encoded = try? JSONEncoder().encode(session) {
            try? Keychain.save(encoded, account: Self.sessionAccount)
        }
    }

    private func restoreCache(for userID: String) {
        remindersEnabled = AccountCache.preferences(userID: userID).remindersEnabled
        guard let cached = AccountCache.load(userID: userID), cached.profile.id == userID else { return }
        profile = cached.profile
        company = cached.company
        schedule = cached.schedule
        announcements = cached.announcements
        likedIDs = cached.likedIDs
        source = .cache(cached.savedAt)
    }

    // MARK: Sessão e dados

    /// Renova o token perto do vencimento. Rede indisponível mantém a sessão para uso do cache.
    private func validToken(forceRefresh: Bool = false) async throws -> String {
        guard var current = session, let auth else { throw APIError.unauthorized }
        if forceRefresh || current.needsRefresh {
            let expected = generation
            current = try await auth.refresh(current)
            guard expected == generation else { throw CancellationError() }
            session = current
            persist(current)
        }
        return current.accessToken
    }

    private func authorized<T>(_ operation: (String) async throws -> T) async throws -> T {
        do {
            return try await operation(try await validToken())
        } catch APIError.unauthorized {
            return try await operation(try await validToken(forceRefresh: true))
        }
    }

    func refresh(_ reason: RefreshReason) async {
        guard phase == .signedIn, let data, let userID = session?.userID else { return }
        if isRefreshing, reason != .manual { return }
        refreshTask?.cancel()
        let expected = generation
        let task = Task { await performRefresh(data: data, userID: userID, expected: expected) }
        refreshTask = task
        await task.value
    }

    private func performRefresh(data: DataClient, userID: String, expected: Int) async {
        isRefreshing = true
        defer { if expected == generation { isRefreshing = false } }
        do {
            guard let loaded = try await authorized({ try await data.profile(userID: userID, token: $0) }) else {
                guard expected == generation else { return }
                errorMessage = "Seu perfil não foi encontrado no portal. Fale com a coordenação da sessão."
                return
            }
            guard expected == generation else { return }
            if loaded.isSuspended {
                await signOut(notice: "Este acesso está suspenso pela administração da sessão.")
                return
            }

            async let scheduleRows = authorized { try await data.schedule(token: $0) }
            async let announcementRows = authorized { try await data.announcements(token: $0) }
            async let likedRows = authorized { try await data.likedAnnouncementIDs(userID: userID, token: $0) }
            var companyRow: Company?
            if let companyID = loaded.companyID {
                companyRow = try await authorized { try await data.company(id: companyID, token: $0) }
            }
            let (newSchedule, newAnnouncements) = try await (scheduleRows, announcementRows)
            // Curtidas são complementares: uma falha não invalida a atualização.
            let newLikes = (try? await likedRows) ?? likedIDs

            guard expected == generation, !Task.isCancelled else { return }
            profile = loaded
            company = companyRow
            schedule = newSchedule
            announcements = newAnnouncements
            likedIDs = newLikes
            source = .live
            lastSuccess = Date()
            errorMessage = nil
            AccountCache.save(CachedSnapshot(profile: loaded, company: companyRow, schedule: newSchedule,
                                             announcements: newAnnouncements, likedIDs: newLikes, savedAt: Date()),
                              userID: userID)
            scheduleDeviceSync(expected: expected)
        } catch is CancellationError {
            return
        } catch APIError.unauthorized {
            guard expected == generation else { return }
            await signOut(notice: APIError.unauthorized.userMessage)
        } catch let error as APIError {
            guard expected == generation else { return }
            errorMessage = error.userMessage
        } catch {
            guard expected == generation else { return }
            errorMessage = APIError.server(0).userMessage
        }
    }

    /// Lembretes, widgets e Live Activity acompanham cada atualização bem-sucedida, depois da última
    /// limpeza pendente e só se a conta ainda for a mesma. Não bloqueia a atualização nem a tela.
    private func scheduleDeviceSync(expected: Int) {
        let cleanup = deviceCleanup
        Task {
            await cleanup?.value
            guard expected == generation, phase == .signedIn else { return }
            await syncDeviceSurfaces()
        }
    }

    private func syncDeviceSurfaces() async {
        let items = visibleSchedule
        WidgetBridge.publish(items: items)
        if remindersEnabled, await reminders.authorizationStatus() == .authorized {
            await reminders.reschedule(items: items)
        }
        if liveActivities.isRunning {
            await liveActivities.update(LiveActivityController.state(for: EventClock.moment(items: items, now: Date())))
        }
        liveActivityRunning = liveActivities.isRunning
    }

    // MARK: Lembretes e Live Activity

    func setReminders(_ enabled: Bool) async {
        guard let userID = session?.userID else { return }
        if enabled {
            var status = await reminders.authorizationStatus()
            if status == .notDetermined {
                _ = await reminders.requestAuthorization()
                status = await reminders.authorizationStatus()
            }
            reminderStatus = status
            guard status == .authorized || status == .provisional else {
                remindersEnabled = false
                return
            }
            remindersEnabled = true
            await deviceCleanup?.value
            guard session?.userID == userID else { return }
            await reminders.reschedule(items: visibleSchedule)
        } else {
            remindersEnabled = false
            await reminders.cancelAll()
        }
        AccountCache.savePreferences(AccountPreferences(remindersEnabled: remindersEnabled), userID: userID)
    }

    func refreshReminderStatus() async {
        reminderStatus = await reminders.authorizationStatus()
    }

    /// Retorna mensagem de erro para a tela, se houver.
    func toggleLiveActivity() async -> String? {
        if liveActivities.isRunning {
            await liveActivities.endAll()
            liveActivityRunning = false
            return nil
        }
        guard liveActivities.isSupported else {
            return "Atividades ao Vivo estão desativadas para este app em Ajustes."
        }
        guard let state = LiveActivityController.state(for: EventClock.moment(items: visibleSchedule, now: Date())) else {
            return "Não há atividade atual ou próxima para acompanhar."
        }
        do {
            try await liveActivities.start(state)
            liveActivityRunning = true
            return nil
        } catch {
            return "Não foi possível iniciar a Atividade ao Vivo."
        }
    }

    // MARK: Links

    func handle(url: URL) {
        guard let link = DeepLink(url: url) else { return }
        guard phase == .signedIn else {
            pendingLink = link
            return
        }
        route(link)
    }

    private func route(_ link: DeepLink) {
        selectedTab = link.tab
        switch link.tab {
        case .agenda: focusedScheduleID = link.itemID
        case .avisos: focusedAnnouncementID = link.itemID
        default: break
        }
    }
}
