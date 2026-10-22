import UIKit

/// The app side of src/lib/native-bridge.ts. Messages arrive only from the server's own main frame (see WebModel).
@MainActor enum NativeBridge {
    static func handle(_ type: String, _ body: [String: Any], web: WebModel, app: AppState) {
        switch type {
        case "haptic":
            switch body["style"] as? String {
            case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "light": UIImpactFeedbackGenerator(style: .light).impactOccurred()
            default: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
        case "timers":
            guard let experimentId = body["experimentId"] as? String, !experimentId.isEmpty,
                  let link = (body["url"] as? String).flatMap(URL.init(string:)), app.address?.contains(link) == true,
                  let list = body["timers"] as? [[String: Any]] else { return }
            let title = body["experimentTitle"] as? String ?? "LabNest"
            let timers = list.compactMap(timer)
            Task { await app.timers.sync(experimentId: experimentId, experimentTitle: title, url: link, timers: timers) }
        case "watchPair":
            Task { web.dispatch(await watchPair(body, app: app)) }
        case "changeServer":
            app.setupShown = true
        case "print":
            web.printPage()
        default:
            break
        }
    }

    private static func timer(_ value: [String: Any]) -> BridgeTimer? {
        guard let stepId = value["stepId"] as? String, let title = value["title"] as? String else { return nil }
        let endsAt = (value["endsAt"] as? String).flatMap(parseDate)
        let remaining = (value["remainingSeconds"] as? NSNumber)?.intValue ?? endsAt.map { Int($0.timeIntervalSinceNow.rounded()) } ?? 0
        return BridgeTimer(stepId: stepId, title: title, endsAt: endsAt, remainingSeconds: remaining)
    }

    /// `Date.toISOString()` has milliseconds; accept either form.
    static func parseDate(_ text: String) -> Date? {
        let precise = ISO8601DateFormatter(); precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: text) ?? ISO8601DateFormatter().date(from: text)
    }

    /// The code is for the page's own server: the Watch is never pointed at another address from here.
    private static func watchPair(_ body: [String: Any], app: AppState) async -> [String: Any] {
        func answer(_ ok: Bool, _ message: String) -> [String: Any] { ["type": "watchPair", "ok": ok, "message": message] }
        guard let server = body["server"] as? String, let code = body["code"] as? String,
              let target = URL(string: server), app.address?.contains(target) == true else {
            return answer(false, "配对信息与当前服务器不一致，请在这台手机上重新生成配对码。")
        }
        do {
            let link = try PairingLink(server: server, code: code)
            let result = await app.phone.send(link)
            if result.ok { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            return answer(result.ok, result.message)
        } catch {
            return answer(false, error.localizedDescription)
        }
    }
}
