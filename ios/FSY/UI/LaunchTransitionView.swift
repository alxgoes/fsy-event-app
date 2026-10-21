import SwiftUI

/// Continua a tela de abertura estática (fundo #0B1528): os círculos F·S·Y entram em sequência e a
/// cena se dissolve no app. Com Reduzir Movimento, só um esmaecimento curto.
/// Só avisa quando a animação mínima terminou; quem decide sair é `AppRootView`, pela fase atual.
struct LaunchTransitionView: View {
    let animationFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var revealed = 0
    @State private var showTitle = false

    private let letters: [(String, Color, Color)] = [
        ("F", Color(hex: 0x007DA5), .white),
        ("S", Color(hex: 0xFFDB65), Color(hex: 0x0F172A)),
        ("Y", Color(hex: 0xFC4E6D), .white),
    ]

    var body: some View {
        ZStack {
            FSYPalette.launch.ignoresSafeArea()
            VStack(spacing: 22) {
                HStack(spacing: -8) {
                    ForEach(0..<3, id: \.self) { index in
                        let letter = letters[index]
                        Text(letter.0)
                            .font(.system(size: 34, weight: .heavy, design: .serif))
                            .foregroundStyle(letter.2)
                            .frame(width: 70, height: 70)
                            .background(Circle().fill(letter.1))
                            .overlay(Circle().strokeBorder(Color(hex: 0x0F172A), lineWidth: 3))
                            .scaleEffect(revealed > index ? 1 : (reduceMotion ? 1 : 0.2))
                            .offset(y: revealed > index || reduceMotion ? 0 : -40)
                            .opacity(revealed > index || reduceMotion ? 1 : 0)
                    }
                }
                VStack(spacing: 4) {
                    Text("Sessão Ribeirão Preto 2")
                        .font(.system(.title3, design: .serif).weight(.bold))
                    Text("\(EventIdentity.theme) · \(EventIdentity.scripture)")
                        .font(.system(.footnote).weight(.semibold))
                }
                .foregroundStyle(.white)
                .opacity(showTitle || reduceMotion ? 1 : 0)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(EventIdentity.name), \(EventIdentity.theme)")
        }
        .task {
            if reduceMotion {
                try? await Task.sleep(for: .milliseconds(350))
            } else {
                for index in 1...3 {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.62)) { revealed = index }
                    try? await Task.sleep(for: .milliseconds(150))
                }
                withAnimation(.easeOut(duration: 0.3)) { showTitle = true }
                try? await Task.sleep(for: .milliseconds(650))
            }
            PhaseLog.mark("abertura: animação mínima concluída")
            animationFinished()
        }
        .sensoryFeedback(.impact(weight: .light), trigger: revealed)
    }
}
