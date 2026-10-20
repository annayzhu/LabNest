import Foundation

@main enum PairingLinkChecks {
    static func main() throws {
        let link = try PairingLink(url: URL(string: "labnest://watch-pair?server=http%3A%2F%2F192.168.1.10%3A3001&code=0%201%202%203")!)
        precondition(link.server.absoluteString == "http://192.168.1.10:3001")
        precondition(link.code == "0123")
        let stripped = try PairingLink(server: "https://lab.example/run?token=discard#fragment", code: "0123")
        precondition(stripped.server.absoluteString == "https://lab.example")
        for code in ["0000", "9999"] { let value = try PairingLink(server: "https://lab.example", code: code); precondition(value.code == code) }
        let invalid = [
            "labnest://watch-pair?server=https://lab.example&code=123",
            "labnest://watch-pair?server=https://lab.example&code=12345",
            "labnest://watch-pair?server=https://lab.example&code=A123",
            "labnest://watch-pair?server=https://lab.example&code=A1B2C3D4E5F6",
            "https://watch-pair?server=https://lab.example&code=0123",
            "labnest://other?server=https://lab.example&code=0123",
            "labnest://watch-pair?server=https://lab.example&code=bad",
            "labnest://watch-pair?server=http://localhost:3001&code=0123",
            "labnest://watch-pair?server=http://127.0.0.2:3001&code=0123",
            "labnest://watch-pair?server=http://0.0.0.0&code=0123",
            "labnest://watch-pair?server=http://lab.localhost&code=0123",
            "labnest://watch-pair?server=http://user:secret@lab.example&code=0123",
            "labnest://watch-pair?server=ftp://lab.example&code=0123",
            "labnest://watch-pair?server=https://lab.example&code=0123&code=4567",
            "labnest://watch-pair?server=https://lab.example&code=0123&token=secret",
            "labnest://watch-pair?server=https://lab.example&code=0123#fragment",
        ]
        for value in invalid {
            do { _ = try PairingLink(url: URL(string: value)!); fatalError("Unexpected acceptance: \(value)") }
            catch is PairingError { /* expected */ }
        }
        print("Pairing link checks passed: normalization, origin stripping, 16 invalid inputs, four digits and leading zeros")
    }
}
