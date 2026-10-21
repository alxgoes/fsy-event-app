import Foundation

/// Publicação do perfil oficial (contrato `src/types/instagram.ts`, vinda de GET /api/instagram, pública).
struct InstagramPost: Decodable, Identifiable, Equatable {
    enum MediaType: String, Decodable {
        case image = "IMAGE"
        case video = "VIDEO"
        case carousel = "CAROUSEL_ALBUM"
    }

    let id: String
    /// Para vídeo é a miniatura; para carrossel, a primeira imagem.
    let imageURL: URL
    let caption: String
    let publishedAt: Date?
    let authorHandle: String
    let postURL: URL
    let mediaType: MediaType

    enum CodingKeys: String, CodingKey {
        case id, imageUrl, caption, publishedAt, authorHandle, postUrl, mediaType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        guard let image = URL(string: try container.decode(String.self, forKey: .imageUrl)), image.scheme == "https" else {
            throw DecodingError.dataCorruptedError(forKey: .imageUrl, in: container, debugDescription: "imagem sem HTTPS")
        }
        imageURL = image
        caption = (try container.decodeIfPresent(String.self, forKey: .caption) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        publishedAt = (try container.decodeIfPresent(String.self, forKey: .publishedAt)).flatMap(Self.parseDate)
        authorHandle = try container.decodeIfPresent(String.self, forKey: .authorHandle) ?? Instagram.officialHandle
        let raw = try container.decodeIfPresent(String.self, forKey: .postUrl)
        postURL = raw.flatMap(URL.init(string:)).flatMap(Instagram.safeInstagramURL) ?? Instagram.officialURL
        mediaType = (try? container.decode(MediaType.self, forKey: .mediaType)) ?? .image
    }

    /// Instagram usa `+0000`; o Behold pode mandar ISO com `Z` ou frações de segundo.
    static func parseDate(_ raw: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: raw) { return date }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: raw) { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return formatter.date(from: raw)
    }
}

struct InstagramFeedResponse: Decodable {
    let data: [InstagramPost]
    let beholdConnected: Bool?

    enum CodingKeys: String, CodingKey { case data, beholdConnected }

    /// Uma publicação malformada não derruba o feed inteiro.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        beholdConnected = try container.decodeIfPresent(Bool.self, forKey: .beholdConnected)
        var list = try container.nestedUnkeyedContainer(forKey: .data)
        var posts: [InstagramPost] = []
        while !list.isAtEnd {
            if let post = try? list.decode(InstagramPost.self) { posts.append(post) } else { _ = try? list.decode(Skip.self) }
        }
        data = posts
    }

    private struct Skip: Decodable {}
}

enum Instagram {
    static let officialHandle = "fsy_ribeiraopreto"
    static let officialURL = URL(string: "https://www.instagram.com/fsy_ribeiraopreto/")!

    /// Só abre publicações do próprio Instagram (HTTPS).
    static func safeInstagramURL(_ url: URL) -> URL? {
        guard url.scheme == "https", let host = url.host?.lowercased(),
              host == "instagram.com" || host.hasSuffix(".instagram.com") else { return nil }
        return url
    }

    enum TokenKind: Equatable { case text, link, mention, hashtag }

    struct Token: Equatable {
        let kind: TokenKind
        let value: String
        let url: URL?
    }

    // Mesmo padrão de `src/lib/media/caption.ts`.
    private static let pattern = try! NSRegularExpression(
        pattern: #"(https?://[^\s<>"']+[^\s<>"'.,;:!?)\]])|(@[A-Za-z0-9._]{1,30})|(#[A-Za-z0-9_\x{00C0}-\x{024F}]{1,100})"#)

    /// Legenda em tokens: nada de HTML; links http(s), @menções e #hashtags viram destinos seguros.
    static func tokenize(_ text: String) -> [Token] {
        let ns = text as NSString
        var tokens: [Token] = []
        var last = 0
        for match in pattern.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            if match.range.location > last {
                tokens.append(Token(kind: .text, value: ns.substring(with: NSRange(location: last, length: match.range.location - last)), url: nil))
            }
            let value = ns.substring(with: match.range)
            if match.range(at: 1).location != NSNotFound {
                tokens.append(Token(kind: .link, value: value, url: URL(string: value)))
            } else if match.range(at: 2).location != NSNotFound {
                tokens.append(Token(kind: .mention, value: value, url: URL(string: "https://www.instagram.com/\(value.dropFirst())/")))
            } else {
                let tag = String(value.dropFirst()).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ""
                tokens.append(Token(kind: .hashtag, value: value, url: URL(string: "https://www.instagram.com/explore/tags/\(tag)/")))
            }
            last = match.range.location + match.range.length
        }
        if last < ns.length {
            tokens.append(Token(kind: .text, value: ns.substring(from: last), url: nil))
        }
        return tokens
    }

    static func isLongCaption(_ text: String, maxChars: Int = 140, maxLines: Int = 3) -> Bool {
        text.count > maxChars || text.split(separator: "\n", omittingEmptySubsequences: false).count > maxLines
    }
}
