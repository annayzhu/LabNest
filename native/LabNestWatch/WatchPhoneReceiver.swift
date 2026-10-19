import Foundation
import WatchConnectivity

/// Foreground handoff only: a code is never silently queued to run after its expiry.
@MainActor final class WatchPhoneReceiver: NSObject, WCSessionDelegate {
    private weak var model: WatchModel?
    init(model: WatchModel) {
        self.model = model
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        Task { @MainActor in
            let id = message["requestId"] as? String ?? ""
            guard message["action"] as? String == "pair", UUID(uuidString: id) != nil,
                  let server = message["server"] as? String, let code = message["code"] as? String,
                  let model = self.model else { replyHandler(["saved": false, "requestId": id, "error": "连接请求无效，请重新扫码。"]); return }
            do {
                let link = try PairingLink(server: server, code: code)
                if model.credential?.pairingRequestId == id {
                    replyHandler(["saved": true, "requestId": id])
                    await model.refresh()
                    return
                }
                guard !model.busy, model.pending == nil else {
                    replyHandler(["saved": false, "requestId": id, "error": "手表正在同步或有未处理操作。请先在手表完成同步，再重新连接。"]); return
                }
                let saved = await model.pair(code: link.code, server: link.server, requestId: id)
                replyHandler(["saved": saved, "requestId": id, "error": model.pairingError ?? ""])
                if saved { await model.refresh() }
            } catch { replyHandler(["saved": false, "requestId": id, "error": error.localizedDescription]) }
        }
    }
}
