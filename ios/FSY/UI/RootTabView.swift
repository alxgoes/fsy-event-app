import SafariServices
import SwiftUI

struct RootTabView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            HomeView()
                .tabItem { Label("Início", systemImage: "house.fill") }
                .tag(AppTab.inicio)
            ScheduleView()
                .tabItem { Label("Agenda", systemImage: "calendar") }
                .tag(AppTab.agenda)
            AnnouncementsView()
                .tabItem { Label("Avisos", systemImage: "megaphone.fill") }
                .tag(AppTab.avisos)
                .badge(model.urgentCount)
            ProfileView()
                .tabItem { Label("Perfil", systemImage: "person.crop.circle.fill") }
                .tag(AppTab.perfil)
        }
        .tint(FSYPalette.primary)
        .sensoryFeedback(.selection, trigger: model.selectedTab)
    }
}

extension AppModel {
    /// Avisos urgentes das últimas 48 h (indicador da aba, não "não lidos").
    var urgentCount: Int {
        let limit = Date().addingTimeInterval(-48 * 3600)
        return announcements.filter { $0.priority == .urgent && ($0.createdAt ?? .distantPast) > limit }.count
    }
}

/// Faixa de estado: sem conexão, cópia local, erro. Texto + ícone: cor não é o único sinal.
struct StatusBanner: View {
    enum Tone { case info, warning, error }
    let text: String
    let icon: String
    var tone: Tone = .info

    var body: some View {
        Label {
            Text(text).fixedSize(horizontal: false, vertical: true)
        } icon: {
            Image(systemName: icon)
        }
        .font(FSYFont.body().weight(.semibold))
        .foregroundStyle(tone == .error ? Color.white : FSYPalette.fixedInk)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(fill))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(FSYPalette.fixedInk, lineWidth: 1.5))
        .accessibilityElement(children: .combine)
    }

    private var fill: Color {
        switch tone {
        case .info: FSYPalette.blueSky
        case .warning: FSYPalette.sunshine
        case .error: FSYPalette.urgent
        }
    }
}

/// Estado da sincronização exibido no topo de cada aba.
struct SyncStatusView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 8) {
            if !model.connectivity.isOnline {
                StatusBanner(text: "Sem conexão. Você está vendo a última cópia salva neste aparelho.", icon: "wifi.slash", tone: .warning)
            } else if let error = model.errorMessage {
                StatusBanner(text: error, icon: "exclamationmark.triangle.fill", tone: .warning)
            }
        }
    }
}

struct LastUpdatedFooter: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            switch model.source {
            case .live:
                if let date = model.lastSuccess {
                    Text("Atualizado às \(EventCalendar.timeString(date)) · puxe para atualizar")
                }
            case .cache(let date):
                Text("Cópia salva em \(EventCalendar.shortDay(date)) \(EventCalendar.timeString(date))")
            case .none:
                Text("Ainda sem dados carregados")
            }
        }
        .font(.footnote)
        .foregroundStyle(FSYPalette.muted)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

/// Portal em Safari do sistema para módulos ainda não nativos. Sessão própria do site; o app não
/// injeta token nem cookie.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.preferredControlTintColor = UIColor(hex: 0x007DA5)
        controller.dismissButtonStyle = .close
        return controller
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

struct PortalLink: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
