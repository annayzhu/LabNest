import Foundation

/// The QR/link contains only a ten-minute, one-use code. A link never starts pairing by itself.
struct PairingLink: Equatable {
    let server: URL
    let code: String

    init(server: String, code: String) throws {
        let text = server.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var parts = URLComponents(string: text),
              ["http", "https"].contains(parts.scheme?.lowercased() ?? ""),
              let host = parts.host?.lowercased(), !host.isEmpty,
              parts.user == nil, parts.password == nil,
              !["localhost", "0.0.0.0", "::1", "[::1]"].contains(host),
              !host.hasPrefix("127."), !host.hasSuffix(".localhost") else {
            throw PairingError.invalidServer
        }
        parts.path = ""; parts.query = nil; parts.fragment = nil
        guard let url = parts.url else { throw PairingError.invalidServer }
        let normalized = code.filter { !$0.isWhitespace }
        guard normalized.range(of: "^[0-9]{4}$", options: .regularExpression) != nil else {
            throw PairingError.invalidCode
        }
        self.server = url; self.code = normalized
    }

    init(url: URL) throws {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "labnest", parts.host == "watch-pair",
              parts.path.isEmpty, parts.user == nil, parts.password == nil, parts.port == nil,
              parts.fragment == nil else { throw PairingError.invalidLink }
        let items = parts.queryItems ?? []
        guard items.count == 2,
              items.filter({ $0.name == "server" }).count == 1,
              items.filter({ $0.name == "code" }).count == 1,
              let server = items.first(where: { $0.name == "server" })?.value,
              let code = items.first(where: { $0.name == "code" })?.value else { throw PairingError.invalidLink }
        try self.init(server: server, code: code)
    }
}

enum PairingError: LocalizedError {
    case invalidServer, invalidCode, invalidLink
    var errorDescription: String? {
        switch self {
        case .invalidServer: "请填写手机和手表可访问的 http:// 或 https:// 地址；不能使用 localhost。"
        case .invalidCode: "请填写网页生成的 4 位数字配对码。"
        case .invalidLink: "这不是有效的 LabNest 手表配对链接，请重新扫码。"
        }
    }
}
