import SwiftUI
import UserNotifications

/// Perfil, companhia, lembretes, Tela Bloqueada, acesso ao portal e saída.
struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var portalLink: PortalLink?
    @State private var confirmingSignOut = false
    @State private var liveMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    identity
                }
                Section("Sessão") {
                    row("Companhia", model.company?.name ?? "Aguardando designação", icon: "shield.lefthalf.filled")
                    if let room = model.profile?.room, !room.isEmpty { row("Quarto", room, icon: "bed.double.fill") }
                    if let stake = model.profile?.stake, !stake.isEmpty { row("Estaca", stake, icon: "building.columns.fill") }
                    row("Equipe", "05/02/2027", icon: "person.3.fill")
                    row("Participantes", "06 a 10/02/2027", icon: "calendar")
                }
                Section {
                    Toggle(isOn: Binding(get: { model.remindersEnabled }, set: { value in Task { await model.setReminders(value) } })) {
                        Label("Lembrete 10 min antes", systemImage: "bell.badge.fill")
                    }
                    .frame(minHeight: 44)
                    if model.reminderStatus == .denied {
                        Button {
                            if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                        } label: {
                            Label("Notificações bloqueadas — abrir Ajustes", systemImage: "gear")
                        }
                        .frame(minHeight: 44)
                    }
                    Button {
                        Task { liveMessage = await model.toggleLiveActivity() }
                    } label: {
                        Label(model.liveActivityRunning ? "Parar Atividade ao Vivo" : "Atividade ao Vivo na Tela Bloqueada",
                              systemImage: "lock.iphone")
                    }
                    .frame(minHeight: 44)
                    if let liveMessage { Text(liveMessage).font(.footnote).foregroundStyle(FSYPalette.muted) }
                } header: {
                    Text("Neste iPhone")
                } footer: {
                    Text("Lembretes são locais e seguem a programação carregada. Avisos novos não chegam por push nesta versão: abra o app ou puxe para atualizar.")
                }

                if let portal = model.portalURL {
                    Section {
                        if model.role != .jovem {
                            portalButton("Painel de \(model.role.label)", path: model.role.portalHomePath, base: portal, icon: "rectangle.grid.2x2.fill")
                        }
                        portalButton("Galeria e Instagram", path: "/dashboard", base: portal, icon: "photo.on.rectangle")
                    } header: {
                        Text("Portal")
                    } footer: {
                        Text("Abre o site no Safari do sistema, com login próprio do portal. Gestão, saúde, mídia e logística continuam no site.")
                    }
                }

                Section {
                    Button(role: .destructive) { confirmingSignOut = true } label: {
                        Label("Sair desta conta", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    .frame(minHeight: 44)
                } footer: {
                    Text("Ao sair, a sessão, a cópia local, lembretes, widgets e Atividades ao Vivo deste aparelho são apagados.")
                }

                Section {
                    LastUpdatedFooter()
                    Text("Versão \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") · FSY Sessão Ribeirão Preto 2")
                        .font(.footnote)
                        .foregroundStyle(FSYPalette.muted)
                }
            }
            .scrollContentBackground(.hidden)
            .background(FSYBackground())
            .navigationTitle("Perfil")
            .refreshable { await model.refresh(.manual) }
            .task { await model.refreshReminderStatus() }
            .sheet(item: $portalLink) { SafariView(url: $0.url).ignoresSafeArea() }
            .confirmationDialog("Sair da conta?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
                Button("Sair", role: .destructive) { Task { await model.signOut() } }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Você precisará entrar novamente para ver seus dados.")
            }
        }
    }

    private var identity: some View {
        HStack(spacing: 14) {
            Text(initials)
                .font(.system(.title2, design: .serif).weight(.black))
                .foregroundStyle(FSYPalette.fixedInk)
                .frame(width: 60, height: 60)
                .background(Circle().fill(FSYPalette.sunshine))
                .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: 2))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(model.profile?.fullName ?? "Carregando perfil…")
                    .font(FSYFont.title())
                    .foregroundStyle(FSYPalette.ink)
                Text(model.role.label)
                    .font(FSYFont.label())
                    .foregroundStyle(FSYPalette.link)
                if let email = model.session?.email {
                    Text(email).font(.footnote).foregroundStyle(FSYPalette.muted)
                }
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }

    private var initials: String {
        let parts = (model.profile?.fullName ?? "FSY").split(separator: " ")
        return String(parts.prefix(2).compactMap(\.first)).uppercased()
    }

    private func row(_ title: String, _ value: String, icon: String) -> some View {
        LabeledContent {
            Text(value).foregroundStyle(FSYPalette.ink).multilineTextAlignment(.trailing)
        } label: {
            Label(title, systemImage: icon).foregroundStyle(FSYPalette.muted)
        }
        .frame(minHeight: 44)
    }

    private func portalButton(_ title: String, path: String, base: URL, icon: String) -> some View {
        Button {
            portalLink = PortalLink(url: base.appendingPathComponent(String(path.dropFirst())))
        } label: {
            Label(title, systemImage: icon)
        }
        .frame(minHeight: 44)
    }
}
