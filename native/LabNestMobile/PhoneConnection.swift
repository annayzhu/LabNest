import SwiftUI
import Observation
import WatchConnectivity

/// Hands a one-use pairing code to the paired Watch, which pairs with the server itself and stores its credential.
@MainActor @Observable final class PhoneConnection: NSObject, WCSessionDelegate {
    var watchStatus = "正在查找配对的 Apple Watch…"
    var reachable = false
    var busy = false
    // Reuse the operation ID after a lost reply. The watch can acknowledge an already-saved connection.
    private var attempt: (link: PairingLink, id: String)?

    override init() {
        super.init()
        guard WCSession.isSupported() else { watchStatus = "此设备不支持 Apple Watch 连接"; return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func updateStatus() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        reachable = session.activationState == .activated && session.isPaired && session.isWatchAppInstalled && session.isReachable
        if session.activationState != .activated { watchStatus = "正在连接 Apple Watch…" }
        else if !session.isPaired { watchStatus = "请先在 iPhone 的 Watch App 中配对手表" }
        else if !session.isWatchAppInstalled { watchStatus = "请在 iPhone 的 Watch App 中安装 LabNest 手表端" }
        else if !session.isReachable { watchStatus = "请打开手表上的 LabNest，并保持屏幕亮起" }
        else { watchStatus = "手表已就绪" }
    }

    /// Foreground only: nothing is queued to run after the code expires. Returns whether the Watch saved the connection.
    func send(_ link: PairingLink) async -> (ok: Bool, message: String) {
        guard !busy else { return (false, "正在发送上一次的连接，请稍候。") }
        updateStatus()
        guard reachable else { return (false, watchStatus) }
        busy = true; defer { busy = false }
        if attempt?.link != link { attempt = (link, UUID().uuidString) }
        let id = attempt!.id
        do {
            let reply: [String: Any] = try await withCheckedThrowingContinuation { continuation in
                WCSession.default.sendMessage(["action": "pair", "server": link.server.absoluteString, "code": link.code, "requestId": id], replyHandler: { continuation.resume(returning: $0) }, errorHandler: { continuation.resume(throwing: $0) })
            }
            guard reply["requestId"] as? String == id, reply["saved"] as? Bool == true else {
                let detail = reply["error"] as? String ?? ""
                return (false, detail.isEmpty ? "手表未确认连接，请打开手表上的 LabNest 后重试。" : detail)
            }
            attempt = nil
            return (true, "手表已连接这个实验。")
        } catch {
            return (false, "手表没有回应：\(error.localizedDescription) 请保持手表上的 LabNest 打开后重试；配对码过期时重新生成。")
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { Task { @MainActor in self.updateStatus() } }
    nonisolated func sessionReachabilityDidChange(_ session: WCSession) { Task { @MainActor in self.updateStatus() } }
    nonisolated func sessionWatchStateDidChange(_ session: WCSession) { Task { @MainActor in self.updateStatus() } }
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) { Task { @MainActor in self.reachable = false; self.watchStatus = "正在切换手表…" } }
    nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
