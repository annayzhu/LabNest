import SwiftUI
import Observation
import WatchConnectivity

@MainActor @Observable final class PhoneConnection: NSObject, WCSessionDelegate {
    var server = UserDefaults.standard.string(forKey: "labnest.server") ?? ""
    var code = ""
    var watchStatus = "正在查找配对的 Apple Watch…"
    var message = "在电脑生成配对码，用 iPhone 相机扫描手表连接二维码。"
    var busy = false
    var reachable = false
    var failed = false
    // Reuse the operation ID after a lost reply. The watch can acknowledge an already-saved connection.
    private var attempt: (link: PairingLink, id: String)?

    override init() {
        super.init()
        guard WCSession.isSupported() else { watchStatus = "此设备不支持 Apple Watch 连接"; return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func updateStatus() {
        let session = WCSession.default
        reachable = session.activationState == .activated && session.isPaired && session.isWatchAppInstalled && session.isReachable
        if session.activationState != .activated { watchStatus = "正在连接 Apple Watch…" }
        else if !session.isPaired { watchStatus = "请先在 iPhone 的 Watch App 中配对手表" }
        else if !session.isWatchAppInstalled { watchStatus = "请在 iPhone 的 Watch App 中安装 LabNest 手表端" }
        else if !session.isReachable { watchStatus = "请打开手表上的 LabNest，并保持屏幕亮起" }
        else { watchStatus = "手表已就绪，可以发送连接" }
    }

    func receive(_ url: URL) {
        guard !busy else { return }
        do {
            let link = try PairingLink(url: url)
            server = link.server.absoluteString; code = link.code
            attempt = nil; failed = false
            message = "已填入连接信息。请核对服务器地址，再点「连接 Apple Watch」。"
        } catch { failed = true; message = error.localizedDescription }
    }

    func connect() async {
        guard !busy else { return }
        failed = false
        do {
            let link = try PairingLink(server: server, code: code)
            updateStatus()
            guard reachable else { failed = true; message = watchStatus; return }
            busy = true; defer { busy = false }
            if attempt?.link != link { attempt = (link, UUID().uuidString) }
            let id = attempt!.id
            message = "正在等待手表保存连接…"
            let reply: [String: Any] = try await withCheckedThrowingContinuation { continuation in
                WCSession.default.sendMessage(["action": "pair", "server": link.server.absoluteString, "code": link.code, "requestId": id], replyHandler: { continuation.resume(returning: $0) }, errorHandler: { continuation.resume(throwing: $0) })
            }
            guard reply["requestId"] as? String == id, reply["saved"] as? Bool == true else {
                failed = true
                message = reply["error"] as? String ?? "手表未确认连接，请打开手表 App 后重试。"
                return
            }
            UserDefaults.standard.set(link.server.absoluteString, forKey: "labnest.server")
            code = ""; attempt = nil
            message = "手表已保存连接。请在手表查看实验同步结果；手机现在可以返回 LabNest。"
        } catch {
            failed = true
            message = "连接未确认：\(error.localizedDescription) 请保持手表 App 打开后重试；配对码过期时重新生成。"
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { Task { @MainActor in self.updateStatus() } }
    nonisolated func sessionReachabilityDidChange(_ session: WCSession) { Task { @MainActor in self.updateStatus() } }
    nonisolated func sessionWatchStateDidChange(_ session: WCSession) { Task { @MainActor in self.updateStatus() } }
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) { Task { @MainActor in self.reachable = false; self.watchStatus = "正在切换手表…" } }
    nonisolated func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
