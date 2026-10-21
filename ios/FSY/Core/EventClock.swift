import Foundation

/// Porta de `calculateActiveAndNextEvents` (src/services/scheduleService.ts).
/// Dia Zero não entra no cálculo; intervalo sem atividade não inventa evento em andamento.
struct EventMoment: Equatable {
    enum Phase: Equatable { case before, during, after }

    let phase: Phase
    let current: ScheduleItem?
    let next: ScheduleItem?
    let dayLabel: String
}

enum EventClock {
    static let dayLabels: [String: String] = [
        "dia0": "Dia Zero (Sexta 05/02)",
        "dia1": "1º Dia (Sábado 06/02)",
        "dia2": "2º Dia (Domingo 07/02)",
        "dia3": "3º Dia (Segunda 08/02)",
        "dia4": "4º Dia (Terça 09/02)",
        "dia5": "5º Dia (Quarta 10/02)",
    ]

    static func moment(items: [ScheduleItem], now: Date) -> EventMoment {
        let list = items
            .filter { $0.day != "dia0" && $0.start != nil }
            .sorted { ($0.start ?? .distantPast) < ($1.start ?? .distantPast) }

        if now < EventCalendar.participantsStart {
            return EventMoment(phase: .before, current: nil, next: list.first, dayLabel: "Em Breve • 06 a 10 Fev 2027")
        }
        if now > EventCalendar.participantsEnd {
            return EventMoment(phase: .after, current: nil, next: nil, dayLabel: "Edição Concluída • FSY 2027")
        }

        let current = list.first { item in
            guard let start = item.start, let end = item.end else { return false }
            return start <= now && end > now
        }
        let next = list.first { ($0.start ?? .distantPast) > now }
        let today = dayKey(for: now)
        let day = list.first { $0.date == today }?.day
        return EventMoment(phase: .during, current: current, next: next, dayLabel: day.flatMap { dayLabels[$0] } ?? "FSY 2027")
    }

    /// "2027-02-06" no fuso da sessão.
    static func dayKey(for date: Date) -> String {
        let parts = EventCalendar.calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// Dias inteiros até a abertura, contados no calendário da sessão.
    static func daysUntilStart(from now: Date) -> Int {
        let calendar = EventCalendar.calendar
        let from = calendar.startOfDay(for: now)
        let to = calendar.startOfDay(for: EventCalendar.participantsStart)
        return max(0, calendar.dateComponents([.day], from: from, to: to).day ?? 0)
    }
}
