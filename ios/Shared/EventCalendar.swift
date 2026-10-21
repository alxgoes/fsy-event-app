import Foundation

/// Datas e horários da sessão, sempre interpretados em America/Sao_Paulo (mesma regra do portal).
enum EventCalendar {
    static let timeZone = TimeZone(identifier: "America/Sao_Paulo")!
    static let locale = Locale(identifier: "pt_BR")

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.locale = locale
        return calendar
    }

    /// Início dos participantes (06/02/2027 08:00) e fim da edição (10/02/2027 23:59:59).
    static let participantsStart = date(day: "2027-02-06", time: "08:00")!
    static let participantsEnd = date(day: "2027-02-10", time: "23:59")!.addingTimeInterval(59)

    /// Converte `date` ("2027-02-06") e `start_time`/`end_time` ("07:30") do banco. "--" ou vazio → nil.
    static func date(day: String, time: String) -> Date? {
        let dayParts = day.split(separator: "-").compactMap { Int($0) }
        let timeParts = time.trimmingCharacters(in: .whitespaces).split(separator: ":").compactMap { Int($0) }
        guard dayParts.count == 3, timeParts.count >= 2,
              (0...23).contains(timeParts[0]), (0...59).contains(timeParts[1]) else { return nil }
        var components = DateComponents()
        components.year = dayParts[0]
        components.month = dayParts[1]
        components.day = dayParts[2]
        components.hour = timeParts[0]
        components.minute = timeParts[1]
        return calendar.date(from: components)
    }

    static func timeString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    /// "sáb., 06/02" — rótulo curto de dia.
    static func shortDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.dateFormat = "EEE dd/MM"
        return formatter.string(from: date)
    }
}
