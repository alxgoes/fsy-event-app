import SwiftUI

/// Marca do templo em arco (SVG vetorial do portal). Sem sombra nem gradiente.
struct TempleMark: View {
    var body: some View {
        Image("TempleMark")
            .resizable()
            .aspectRatio(100.0 / 180.0, contentMode: .fit)
            .accessibilityLabel("Templo em arco, tema FSY 2027")
    }
}

/// Três círculos F·S·Y do ícone do portal.
struct FSYCirclesMark: View {
    var size: CGFloat = 28
    private struct Letter: Identifiable {
        let id: String
        let fill: Color
        let ink: Color
    }

    private var letters: [Letter] {
        [Letter(id: "F", fill: Color(hex: 0x007DA5), ink: .white),
         Letter(id: "S", fill: Color(hex: 0xFFDB65), ink: FSYPalette.fixedInk),
         Letter(id: "Y", fill: FSYPalette.coral, ink: .white)]
    }

    var body: some View {
        HStack(spacing: -size * 0.12) {
            ForEach(letters) { letter in
                Text(letter.id)
                    .font(.system(size: size * 0.5, weight: .heavy, design: .serif))
                    .foregroundStyle(letter.ink)
                    .frame(width: size, height: size)
                    .background(Circle().fill(letter.fill))
                    .overlay(Circle().strokeBorder(FSYPalette.fixedInk, lineWidth: max(1, size / 18)))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("FSY")
    }
}

/// Lockup horizontal: templo + tema em duas linhas + escritura, a partir de `EventIdentity` (grafia exata).
struct ThemeLockup: View {
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 10 : 14) {
            TempleMark().frame(height: compact ? 44 : 64)
            VStack(alignment: .leading, spacing: 2) {
                Text(EventIdentity.themeLead.uppercased(with: Locale(identifier: "pt_BR")))
                    .font(.system(compact ? .caption2 : .caption, design: .serif).weight(.bold))
                    .tracking(2.4)
                Text(EventIdentity.themeFocus.uppercased(with: Locale(identifier: "pt_BR")))
                    .font(.system(compact ? .title3 : .title, design: .serif).weight(.black))
                    .tracking(1.6)
                Text(EventIdentity.scripture.uppercased(with: Locale(identifier: "pt_BR")))
                    .font(.system(.caption2).weight(.bold))
                    .tracking(2)
                    .foregroundStyle(FSYPalette.link)
            }
            .foregroundStyle(FSYPalette.ink)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(EventIdentity.theme), \(EventIdentity.scripture)")
    }
}
