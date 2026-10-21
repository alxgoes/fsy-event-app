import SwiftUI

/// Tipografia: títulos serifados (New York, substituto nativo de Cinzel/Cormorant) e corpo em SF,
/// todos por estilo dinâmico para respeitar o tamanho de texto escolhido.
enum FSYFont {
    static func display() -> Font { .system(.largeTitle, design: .serif).weight(.bold) }
    static func headline() -> Font { .system(.title2, design: .serif).weight(.bold) }
    static func title() -> Font { .system(.headline).weight(.semibold) }
    static func body() -> Font { .system(.subheadline) }
    static func label() -> Font { .system(.caption).weight(.bold) }
    static func scripture() -> Font { .system(.callout, design: .serif).italic() }
}

/// Cartão "camada" do portal: borda de 2 pt e sombra sólida deslocada (profundidade do web).
struct FSYCardStyle: ViewModifier {
    var fill: Color = FSYPalette.surface
    var padding: CGFloat = 20
    var radius: CGFloat = 24

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                ZStack {
                    shape.fill(FSYPalette.depth).offset(x: 4, y: 4)
                    shape.fill(fill)
                }
            }
            .overlay(shape.strokeBorder(FSYPalette.border, lineWidth: 2))
            .padding(.trailing, 4)
            .padding(.bottom, 4)
    }
}

extension View {
    func fsyCard(fill: Color = FSYPalette.surface, padding: CGFloat = 20) -> some View {
        modifier(FSYCardStyle(fill: fill, padding: padding))
    }
}

/// Botão tátil: afunda sobre a sombra ao toque; com Reduzir Movimento só muda a opacidade.
struct FSYButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, outline }
    var kind: Kind = .primary
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        let pressed = configuration.isPressed
        let (fill, ink): (Color, Color) = switch kind {
        case .primary: (Color(hex: 0x007DA5), .white)
        case .secondary: (FSYPalette.sunshine, FSYPalette.fixedInk)
        case .outline: (FSYPalette.surface, FSYPalette.ink)
        }
        configuration.label
            .font(.system(.body).weight(.semibold))
            .foregroundStyle(ink)
            .frame(maxWidth: .infinity, minHeight: 48)
            .padding(.horizontal, 16)
            .background {
                ZStack {
                    shape.fill(FSYPalette.depth).offset(x: 3, y: 3)
                    shape.fill(fill).offset(x: pressed && !reduceMotion ? 3 : 0, y: pressed && !reduceMotion ? 3 : 0)
                }
            }
            .overlay(shape.strokeBorder(FSYPalette.border, lineWidth: 2)
                .offset(x: pressed && !reduceMotion ? 3 : 0, y: pressed && !reduceMotion ? 3 : 0))
            .opacity(reduceMotion && pressed ? 0.75 : 1)
            .contentShape(shape)
            .animation(reduceMotion ? nil : .spring(response: 0.25, dampingFraction: 0.7), value: pressed)
    }
}

/// Pílula de status (caixa alta, 12 pt mínimo, como o passo Label do DESIGN.md).
struct Pill: View {
    let text: String
    var icon: String?
    var fill: Color = FSYPalette.sunshine
    var ink: Color = FSYPalette.fixedInk

    var body: some View {
        HStack(spacing: 4) {
            if let icon { Image(systemName: icon).imageScale(.small) }
            Text(text.uppercased())
        }
        .font(FSYFont.label())
        .tracking(0.6)
        .foregroundStyle(ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Capsule().fill(fill))
        .overlay(Capsule().strokeBorder(FSYPalette.fixedInk.opacity(0.85), lineWidth: 1.5))
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Cor de cada categoria da programação, a partir dos selos 2027.
enum CategoryStyle {
    static func color(_ category: String) -> Color {
        switch category {
        case "Espiritual": Color(hex: 0xB0EEFC)
        case "Alimentação": Color(hex: 0xD3E952)
        case "Atividade": FSYPalette.sunshine
        case "Show", "Baile": Color(hex: 0xFDA192)
        case "Logística", "Equipe": Color(hex: 0xE0E2E2)
        default: Color(hex: 0xEFEFE7)
        }
    }

    static func icon(_ category: String) -> String {
        switch category {
        case "Espiritual": "book.closed.fill"
        case "Alimentação": "fork.knife"
        case "Atividade": "figure.run"
        case "Show": "music.mic"
        case "Baile": "music.note"
        case "Logística": "bus.fill"
        case "Equipe": "person.3.fill"
        default: "sparkles"
        }
    }
}

struct SectionHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(FSYFont.headline())
                .foregroundStyle(FSYPalette.ink)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle).font(FSYFont.body()).foregroundStyle(FSYPalette.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Fundo pergaminho das telas.
struct FSYBackground: View {
    var body: some View {
        FSYPalette.background.ignoresSafeArea()
    }
}
