import Foundation

/// The LabNest server the app shows. It comes from the computer's 其他设备 QR code (a page on the server, opened once
/// after setup), a typed address (`http://` is assumed when no scheme is given), or a watch pairing link (its server).
/// Only the origin is kept.
struct ServerAddress: Equatable {
    let origin: URL
    /// The scanned page, when the code pointed at one (e.g. an experiment's 现场模式).
    let page: URL?

    /// On the phone, localhost is the phone itself; the simulator shares the Mac's network, so it may use it.
    static var loopbackAllowed: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    init(_ input: String, allowLoopback: Bool = ServerAddress.loopbackAllowed) throws {
        var text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.lowercased().hasPrefix("labnest://") {
            guard let url = URL(string: text) else { throw ServerAddressError.invalid }
            text = try PairingLink(url: url).server.absoluteString
        } else if !text.contains("://") {
            text = "http://" + text
        }
        guard var parts = URLComponents(string: text),
              let scheme = parts.scheme?.lowercased(), ["http", "https"].contains(scheme),
              let host = parts.host?.lowercased(), !host.isEmpty,
              parts.user == nil, parts.password == nil else { throw ServerAddressError.invalid }
        if !allowLoopback && Self.isLoopback(host) { throw ServerAddressError.loopback }
        parts.scheme = scheme; parts.host = host; parts.fragment = nil
        let path = parts.path, query = parts.query
        parts.path = ""; parts.query = nil
        guard let origin = parts.url else { throw ServerAddressError.invalid }
        self.origin = origin
        if path.isEmpty || path == "/" { page = nil } else {
            parts.path = path; parts.query = query
            page = parts.url
        }
    }

    static func isLoopback(_ host: String) -> Bool {
        ["localhost", "0.0.0.0", "::1", "[::1]"].contains(host) || host.hasPrefix("127.") || host.hasSuffix(".localhost")
    }

    /// Same scheme, host and port (80 and 443 by default) as this server.
    func contains(_ url: URL) -> Bool { Self.sameOrigin(origin, url) }

    static func sameOrigin(_ a: URL, _ b: URL) -> Bool {
        func port(_ url: URL) -> Int? { url.port ?? (url.scheme?.lowercased() == "https" ? 443 : url.scheme?.lowercased() == "http" ? 80 : nil) }
        return a.scheme?.lowercased() == b.scheme?.lowercased() && a.host?.lowercased() == b.host?.lowercased() && port(a) == port(b)
    }
}

enum ServerAddressError: LocalizedError {
    case invalid, loopback
    var errorDescription: String? {
        switch self {
        case .invalid: "这不是 LabNest 地址。请扫电脑上「其他设备」里的二维码，或填写 http://电脑地址:3001。"
        case .loopback: "手机上的 localhost 指向手机自己，不是电脑。请填写电脑的局域网或 Tailscale 地址。"
        }
    }
}
