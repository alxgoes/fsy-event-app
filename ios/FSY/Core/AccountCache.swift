import CryptoKit
import Foundation

/// Última leitura bem-sucedida, isolada por conta. Sem dados médicos, contatos ou tokens.
struct CachedSnapshot: Codable {
    var profile: Profile
    var company: Company?
    var schedule: [ScheduleItem]
    var announcements: [Announcement]
    var likedIDs: Set<String>
    var savedAt: Date
}

struct AccountPreferences: Codable {
    var remindersEnabled = false
}

/// Arquivos em Application Support/AccountCache/<hash da conta>/, com proteção completa de arquivo
/// e fora do backup. `clearAll()` no logout remove qualquer conta anterior.
enum AccountCache {
    private static var root: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("AccountCache", isDirectory: true)
    }

    private static func directory(for userID: String) -> URL {
        let digest = SHA256.hash(data: Data(userID.utf8)).prefix(12).map { String(format: "%02x", $0) }.joined()
        return root.appendingPathComponent(digest, isDirectory: true)
    }

    private static func write<T: Encodable>(_ value: T, name: String, userID: String) {
        do {
            var folder = directory(for: userID)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? folder.setResourceValues(values)
            let data = try JSONEncoder().encode(value)
            try data.write(to: folder.appendingPathComponent(name), options: [.atomic, .completeFileProtection])
        } catch {
            // Cache é opcional: falha de escrita não interrompe o uso online.
        }
    }

    private static func read<T: Decodable>(_ type: T.Type, name: String, userID: String) -> T? {
        guard let data = try? Data(contentsOf: directory(for: userID).appendingPathComponent(name)) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func save(_ snapshot: CachedSnapshot, userID: String) { write(snapshot, name: "snapshot.json", userID: userID) }
    static func load(userID: String) -> CachedSnapshot? { read(CachedSnapshot.self, name: "snapshot.json", userID: userID) }

    static func savePreferences(_ preferences: AccountPreferences, userID: String) {
        write(preferences, name: "preferences.json", userID: userID)
    }

    static func preferences(userID: String) -> AccountPreferences {
        read(AccountPreferences.self, name: "preferences.json", userID: userID) ?? AccountPreferences()
    }

    static func clearAll() {
        try? FileManager.default.removeItem(at: root)
    }
}
