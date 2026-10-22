import Foundation

@main enum ServerAddressChecks {
    static func main() throws {
        // The 其他设备 QR code: keep the origin, open the scanned page once.
        let scanned = try ServerAddress("http://172.18.136.167:3001/experiments/abc/run?view=bench#top", allowLoopback: false)
        precondition(scanned.origin.absoluteString == "http://172.18.136.167:3001")
        precondition(scanned.page?.absoluteString == "http://172.18.136.167:3001/experiments/abc/run?view=bench")
        // A typed address without a scheme is plain HTTP; a bare origin opens no page.
        let typed = try ServerAddress("  192.168.1.10:3001 ", allowLoopback: false)
        precondition(typed.origin.absoluteString == "http://192.168.1.10:3001" && typed.page == nil)
        let slash = try ServerAddress("HTTPS://LabNest.Example.ts.net/", allowLoopback: false)
        precondition(slash.origin.absoluteString == "https://labnest.example.ts.net" && slash.page == nil)
        // A watch pairing link gives its server.
        let pairing = try ServerAddress("labnest://watch-pair?server=http%3A%2F%2F192.168.1.10%3A3001&code=0123", allowLoopback: false)
        precondition(pairing.origin.absoluteString == "http://192.168.1.10:3001" && pairing.page == nil)
        // The simulator may use the Mac's localhost; a phone may not.
        let simulator = try ServerAddress("http://localhost:3002", allowLoopback: true)
        precondition(simulator.origin.absoluteString == "http://localhost:3002")
        // Same origin, with default ports.
        let https = try ServerAddress("https://lab.example", allowLoopback: false)
        precondition(https.contains(URL(string: "https://lab.example:443/entries/new")!))
        precondition(!https.contains(URL(string: "http://lab.example/entries/new")!))
        precondition(!https.contains(URL(string: "https://lab.example:8443/")!))
        precondition(!https.contains(URL(string: "https://evil.example/")!))
        precondition(typed.contains(URL(string: "http://192.168.1.10:3001/protocol-run")!))
        precondition(!typed.contains(URL(string: "http://192.168.1.10/protocol-run")!))
        let invalid = [
            "", "   ", "ftp://lab.example", "http://", "http://user:secret@lab.example",
            "http://localhost:3001", "localhost:3001", "http://127.0.0.1:3001", "http://0.0.0.0", "http://lab.localhost",
            "labnest://watch-pair?server=https://lab.example&code=12", "labnest://open?url=https://lab.example",
        ]
        for value in invalid {
            do { _ = try ServerAddress(value, allowLoopback: false); fatalError("Unexpected acceptance: \(value)") }
            catch is ServerAddressError { /* expected */ }
            catch is PairingError { /* expected */ }
        }
        print("Server address checks passed: scanned page, typed address, pairing link, loopback rule, same origin, \(invalid.count) invalid inputs")
    }
}
