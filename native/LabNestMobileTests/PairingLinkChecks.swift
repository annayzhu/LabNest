import Foundation

@main enum PairingLinkChecks {
    static func main() throws {
        let link = try PairingLink(url: URL(string: "labnest://watch-pair?server=http%3A%2F%2F192.168.1.10%3A3001&code=a1b2%20c3d4%20e5f6")!)
        precondition(link.server.absoluteString == "http://192.168.1.10:3001")
        precondition(link.code == "A1B2C3D4E5F6")
        let stripped = try PairingLink(server: "https://lab.example/run?token=discard#fragment", code: "A1B2C3D4E5F6")
        precondition(stripped.server.absoluteString == "https://lab.example")
        let invalid = [
            "https://watch-pair?server=https://lab.example&code=A1B2C3D4E5F6",
            "labnest://other?server=https://lab.example&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=https://lab.example&code=bad",
            "labnest://watch-pair?server=http://localhost:3001&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=http://127.0.0.2:3001&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=http://0.0.0.0&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=http://lab.localhost&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=http://user:secret@lab.example&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=ftp://lab.example&code=A1B2C3D4E5F6",
            "labnest://watch-pair?server=https://lab.example&code=A1B2C3D4E5F6&code=123456789ABC",
            "labnest://watch-pair?server=https://lab.example&code=A1B2C3D4E5F6&token=secret",
            "labnest://watch-pair?server=https://lab.example&code=A1B2C3D4E5F6#fragment",
        ]
        for value in invalid {
            do { _ = try PairingLink(url: URL(string: value)!); fatalError("Unexpected acceptance: \(value)") }
            catch is PairingError { /* expected */ }
        }
        print("Pairing link checks passed: normalization, origin stripping, 12 invalid inputs")
    }
}
