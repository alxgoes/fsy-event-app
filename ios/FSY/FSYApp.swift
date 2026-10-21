import SwiftUI
import UserNotifications

@main
struct FSYApp: App {
    @UIApplicationDelegateAdaptor(NotificationDelegate.self) private var notificationDelegate
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            AppRootView()
                .environment(model)
                .task {
                    notificationDelegate.model = model
                    await model.bootstrap()
                }
                .onOpenURL { model.handle(url: $0) }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.sceneBecameActive() }
                }
        }
    }
}

/// Toque em lembrete: só segue links da allowlist (`DeepLink`), com sessão e permissão revalidadas no app.
final class NotificationDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    @MainActor weak var model: AppModel?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let raw = response.notification.request.content.userInfo["deeplink"] as? String,
              let url = URL(string: raw) else { return }
        await MainActor.run { model?.handle(url: url) }
    }
}

/// Abertura → configuração → entrada → abas, com a transição de marca por cima.
struct AppRootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var introAnimated = false

    /// Lido do modelo a cada renderização: a abertura sai assim que a animação mínima terminou e a fase
    /// foi decidida, sem depender de valores capturados pela tarefa da animação.
    private var showIntro: Bool { !introAnimated || model.phase == .launching }

    var body: some View {
        ZStack {
            switch model.phase {
            case .launching:
                FSYPalette.launch.ignoresSafeArea()
            case .needsConfiguration(let message):
                ConfigurationNeededView(message: message)
            case .signedOut:
                LoginView()
                    .transition(.opacity)
            case .signedIn:
                RootTabView()
                    .transition(.opacity)
            }

            if showIntro {
                LaunchTransitionView {
                    PhaseLog.mark("abertura: dissolvendo")
                    withAnimation(.easeInOut(duration: reduceMotion ? 0.2 : 0.45)) { introAnimated = true }
                }
                .transition(.opacity)
                .zIndex(1)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: model.phase)
    }
}

struct ConfigurationNeededView: View {
    let message: String

    var body: some View {
        ZStack {
            FSYBackground()
            VStack(spacing: 20) {
                FSYCirclesMark(size: 44)
                Text("Configuração necessária")
                    .font(FSYFont.headline())
                Text(message)
                    .font(FSYFont.body())
                    .foregroundStyle(FSYPalette.muted)
                    .multilineTextAlignment(.center)
            }
            .fsyCard()
            .padding(16)
        }
    }
}
