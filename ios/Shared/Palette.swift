import SwiftUI
import UIKit

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension Color {
    init(hex: UInt32) { self.init(uiColor: UIColor(hex: hex)) }

    static func fsy(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

/// Paleta do DESIGN.md / globals.css do portal (claro e escuro).
enum FSYPalette {
    static let primary = Color.fsy(light: 0x007DA5, dark: 0x01B6D1)
    static let link = Color.fsy(light: 0x005E7C, dark: 0x7DE3F4)
    /// Fundo da saudação com texto branco (7,26:1).
    static let hero = Color(hex: 0x005E7C)
    static let sunshine = Color(hex: 0xFFE48A)
    static let coral = Color(hex: 0xFC4E6D)
    static let green = Color(hex: 0x93C742)
    static let urgent = Color(hex: 0xB91C1C)
    /// Texto de erro legível nos dois temas.
    static let urgentText = Color.fsy(light: 0xB91C1C, dark: 0xFCA5A5)
    static let gold = Color(hex: 0xDBBF6B)
    static let blueSky = Color(hex: 0xB0EEFC)

    static let background = Color.fsy(light: 0xFAF8F5, dark: 0x030712)
    static let surface = Color.fsy(light: 0xFFFFFF, dark: 0x050C1F)
    static let parchment = Color.fsy(light: 0xF5EFCA, dark: 0x0F172A)
    static let ink = Color.fsy(light: 0x0F172A, dark: 0xF8FAFC)
    static let muted = Color.fsy(light: 0x334155, dark: 0x94A3B8)
    static let border = Color.fsy(light: 0x0F172A, dark: 0x64748B)
    static let depth = Color.fsy(light: 0x0F172A, dark: 0x020617)
    /// Texto sobre superfícies fixas claras (sol, rosa, ciano), independente do tema.
    static let fixedInk = Color(hex: 0x0F172A)
    static let launch = Color(hex: 0x0B1528)
}
