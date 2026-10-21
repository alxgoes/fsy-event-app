import SwiftUI

/// Fundo geométrico FSY 2027: arcos do templo, discos, flâmulas, traços e pontos nas cores dos selos.
///
/// Momento autoral: ao trocar de aba, as formas saem do arranjo da aba anterior e se reorganizam no da
/// nova, como selos remanejados numa cartela. Não há laço contínuo nem timer: só uma animação de mola por
/// troca de aba, desenhada em vetor. As formas ficam nas bordas e no alto/rodapé; o miolo, onde fica o
/// texto, mostra só a camada de fundo esmaecida. O logotipo nunca é desenhado aqui.
struct FSYBackground: View {
    /// Aba dona deste fundo; `nil` para entrada e configuração (arranjo próprio).
    var tab: AppTab?

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var arrangement: Int?

    private var target: Int { tab.map(Self.arrangement(for:)) ?? 4 }

    var body: some View {
        GeometryReader { geometry in
            let shown = arrangement ?? target
            ZStack {
                FSYPalette.background
                ForEach(Array(Self.shapes.enumerated()), id: \.offset) { index, spec in
                    let place = spec.placement(arrangement: shown, index: index)
                    let side = min(geometry.size.width, 500) * place.size
                    GeometricShapeView(kind: spec.kind, color: spec.color, outlined: spec.front, side: side)
                        .opacity(opacity(front: spec.front))
                        .scaleEffect(place.scale)
                        .rotationEffect(.degrees(place.rotation))
                        .position(x: geometry.size.width * place.x, y: geometry.size.height * place.y)
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
        .onAppear {
            guard tab != nil, !reduceMotion else { arrangement = target; return }
            arrangement = Self.arrangement(for: model.previousTab)
            withAnimation(.spring(response: 0.75, dampingFraction: 0.82)) { arrangement = target }
        }
    }

    private func opacity(front: Bool) -> Double {
        switch (colorScheme, front) {
        case (.dark, true): 0.72
        case (.dark, false): 0.2
        case (_, true): 1
        case (_, false): 0.5
        }
    }

    static func arrangement(for tab: AppTab) -> Int {
        switch tab {
        case .inicio: 0
        case .agenda: 1
        case .avisos: 2
        case .perfil: 3
        }
    }

    // Camada de fundo: formas grandes e esmaecidas. Frente: formas menores com contorno de 2 pt,
    // a mesma linguagem dos cartões.
    static let shapes: [GeometricSpec] = [
        GeometricSpec(.disc, 0xFFE48A, front: false, x: 0.06, y: 0.02, size: 0.58, rotation: 0),
        GeometricSpec(.arch, 0xB0EEFC, front: false, x: 0.88, y: 0.07, size: 0.6, rotation: 0),
        GeometricSpec(.halfDisc, 0x93C742, front: false, x: 0.1, y: 0.95, size: 0.62, rotation: 0),
        GeometricSpec(.disc, 0xD3E952, front: false, x: 1.02, y: 0.6, size: 0.38, rotation: 0),
        GeometricSpec(.ring, 0xFC4E6D, front: true, x: 0.2, y: 0.15, size: 0.19, rotation: 0),
        GeometricSpec(.pennant, 0xF68D2E, front: true, x: 0.7, y: 0.16, size: 0.16, rotation: 14),
        GeometricSpec(.stripes, 0x007DA5, front: true, x: 0.95, y: 0.32, size: 0.22, rotation: -28),
        GeometricSpec(.arch, 0xFC4E6D, front: true, x: 0.85, y: 0.9, size: 0.24, rotation: 0),
        GeometricSpec(.dots, 0x01B6D1, front: true, x: 0.3, y: 0.87, size: 0.18, rotation: 8),
        GeometricSpec(.disc, 0xFFB81C, front: true, x: 0.03, y: 0.52, size: 0.11, rotation: 0),
    ]
}

struct GeometricSpec {
    enum Kind { case disc, ring, arch, halfDisc, pennant, stripes, dots }
    struct Placement { var x, y, size, rotation, scale: Double }

    let kind: Kind
    let color: Color
    let front: Bool
    let base: Placement

    init(_ kind: Kind, _ hex: UInt32, front: Bool, x: Double, y: Double, size: Double, rotation: Double) {
        self.kind = kind
        color = Color(hex: hex)
        self.front = front
        base = Placement(x: x, y: y, size: size, rotation: rotation, scale: 1)
    }

    /// Arranjo determinístico por aba: deslocamentos curtos (formas não invadem o miolo), giro e escala.
    func placement(arrangement: Int, index: Int) -> Placement {
        guard arrangement > 0 else { return base }
        let seed = Double(index * 7 + arrangement * 13)
        let reach = front ? 0.09 : 0.06
        return Placement(
            x: base.x + reach * sin(seed),
            y: base.y + reach * 0.7 * cos(seed * 1.3),
            size: base.size,
            rotation: base.rotation + Double(arrangement) * (index.isMultiple(of: 2) ? 26 : -20),
            scale: 1 + 0.14 * sin(seed * 0.7)
        )
    }
}

private struct GeometricShapeView: View {
    let kind: GeometricSpec.Kind
    let color: Color
    let outlined: Bool
    let side: Double

    var body: some View {
        let stroke = outlined ? FSYPalette.border : .clear
        switch kind {
        case .disc:
            Circle().fill(color).overlay(Circle().strokeBorder(stroke, lineWidth: 2)).frame(width: side, height: side)
        case .ring:
            Circle().strokeBorder(color, lineWidth: side * 0.2)
                .overlay(Circle().strokeBorder(stroke, lineWidth: 2))
                .frame(width: side, height: side)
        case .arch:
            ArchShape().fill(color).overlay(ArchShape().stroke(stroke, lineWidth: 2)).frame(width: side, height: side * 1.3)
        case .halfDisc:
            HalfDiscShape().fill(color).frame(width: side, height: side / 2)
        case .pennant:
            PennantShape().fill(color).overlay(PennantShape().stroke(stroke, style: StrokeStyle(lineWidth: 2, lineJoin: .round)))
                .frame(width: side * 1.4, height: side)
        case .stripes:
            VStack(spacing: side * 0.12) {
                ForEach(0..<4, id: \.self) { _ in
                    Capsule().fill(color).overlay(Capsule().strokeBorder(stroke, lineWidth: 1.5)).frame(height: side * 0.13)
                }
            }
            .frame(width: side)
        case .dots:
            Grid(horizontalSpacing: side * 0.14, verticalSpacing: side * 0.14) {
                ForEach(0..<3, id: \.self) { _ in
                    GridRow {
                        ForEach(0..<3, id: \.self) { _ in Circle().fill(color).frame(width: side * 0.2, height: side * 0.2) }
                    }
                }
            }
        }
    }
}

/// Arco do templo: retângulo com topo em semicírculo.
struct ArchShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let radius = rect.width / 2
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
        path.addArc(center: CGPoint(x: rect.midX, y: rect.minY + radius), radius: radius,
                    startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

private struct HalfDiscShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(center: CGPoint(x: rect.midX, y: rect.maxY), radius: rect.width / 2,
                    startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        path.closeSubpath()
        return path
    }
}

/// Flâmula (estandarte dos eventos FSY).
private struct PennantShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
