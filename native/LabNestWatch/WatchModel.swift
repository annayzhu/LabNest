import Foundation
import SwiftUI
import Security
import UserNotifications

struct RunStep: Codable, Identifiable {
    struct TimerState: Codable { var durationSeconds: Int?; var remainingSeconds: Int?; var startedAt: String?; var pausedAt: String? }
    var id: String; var sourceRef: String; var title: String; var group: String; var text: String
    var completed: Bool; var canComplete: Bool; var blocked: Bool; var skipped: String?; var timer: TimerState; var canTime: Bool
}
struct RunSnapshot: Codable { var experimentId: String; var title: String; var revision: Int; var serverTime: Double; var capturedAt: String; var steps: [RunStep] }
struct WatchGrant: Codable { var token: String; var experimentId: String }
struct WatchCredential: Codable { var token: String; var experimentId: String; var serverOrigin: String }
struct RunMutation: Codable { var intent: String; var stepId: String; var revision: Int; var clientMutationId: String; var deviceCreatedAt: String; var sourceRef: String }
struct PendingMutation: Codable { var request: RunMutation; var conflict: String? }
struct ServerMessage: Codable { var error: String? }

/// Secrets stay in the device Keychain; snapshots and unsent observations are atomic files.
enum WatchStorage {
    static let service = "org.labnest.watch"
    static func credential() -> WatchCredential? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecReturnData as String: true]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(WatchCredential.self, from: data)
    }
    static func saveCredential(_ credential: WatchCredential) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
        let data = try JSONEncoder().encode(credential)
        let updated = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if updated == errSecItemNotFound {
            var insert = query; insert[kSecValueData as String] = data; insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else { throw CocoaError(.fileWriteUnknown) }
        } else if updated != errSecSuccess { throw CocoaError(.fileWriteUnknown) }
    }
    static func url(_ name: String) -> URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(name) }
    static func save<T: Encodable>(_ value: T, _ name: String) throws { try JSONEncoder().encode(value).write(to: url(name), options: .atomic) }
    static func load<T: Decodable>(_ type: T.Type, _ name: String) -> T? { guard let bytes = try? Data(contentsOf: url(name)) else { return nil }; return try? JSONDecoder().decode(type, from: bytes) }
}

@MainActor final class WatchModel: ObservableObject {
    @Published var snapshot: RunSnapshot? = WatchStorage.load(RunSnapshot.self, "snapshot.json")
    @Published var pending: PendingMutation? = WatchStorage.load(PendingMutation.self, "pending.json")
    @Published var message = "尚未连接。离线快照仅供核对。"
    @Published var busy = false
    @Published var connected = false
    @Published var notificationStatus = "未授权通知"
    @Published var credential = WatchStorage.credential()
    @Published var baseURL = UserDefaults.standard.string(forKey: "server") ?? ""
    @Published var reminders = UserDefaults.standard.bool(forKey: "reminders")
    private var serverOffset: TimeInterval = 0
    private var deviceId: String {
        if let value = UserDefaults.standard.string(forKey: "deviceId") { return value }
        let value = UUID().uuidString; UserDefaults.standard.set(value, forKey: "deviceId"); return value
    }
    func endpoint(_ path: String) throws -> URL {
        guard let base = URL(string: baseURL.trimmingCharacters(in: .whitespacesAndNewlines)), ["https", "http"].contains(base.scheme), base.host != nil,
              let url = URL(string: path, relativeTo: base) else { throw URLError(.badURL) }
        return url
    }
    func request(_ path: String, body: Data? = nil, authenticated: Bool = true, targetURL: URL? = nil) async throws -> Data {
        var request = URLRequest(url: try targetURL ?? endpoint(path)); request.timeoutInterval = 15; request.cachePolicy = .reloadIgnoringLocalCacheData
        request.httpMethod = body == nil ? "GET" : "POST"; request.httpBody = body
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if authenticated, let credential {
            guard let url = request.url, let trusted = URL(string: credential.serverOrigin), url.scheme == trusted.scheme, url.host == trusted.host, url.port == trusted.port else {
                throw NSError(domain: "LabNest", code: 401, userInfo: [NSLocalizedDescriptionKey: "服务器地址已改变，请重新配对；旧凭据不会发送到新地址。"])
            }
            request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if !(200..<300).contains(response.statusCode) {
            let detail = (try? JSONDecoder().decode(ServerMessage.self, from: data).error) ?? "服务器拒绝操作，请在手机核对。"
            throw NSError(domain: "LabNest", code: response.statusCode, userInfo: [NSLocalizedDescriptionKey: detail])
        }
        return data
    }
    func pair(code: String) async {
        guard !busy, pending == nil else { return }; busy = true; defer { busy = false }
        do {
            let destination = try endpoint("/api/watch/pair")
            let body = try JSONSerialization.data(withJSONObject: ["code": code, "deviceId": deviceId])
            let grant = try JSONDecoder().decode(WatchGrant.self, from: await request("/api/watch/pair", body: body, authenticated: false, targetURL: destination))
            let next = WatchCredential(token: grant.token, experimentId: grant.experimentId, serverOrigin: destination.absoluteString)
            try WatchStorage.saveCredential(next); credential = next; snapshot = nil
            UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
            try? FileManager.default.removeItem(at: WatchStorage.url("snapshot.json"))
            baseURL = URL(string: "/", relativeTo: destination)!.absoluteString
            UserDefaults.standard.set(baseURL, forKey: "server"); message = "已配对，请刷新实验。"
        } catch { message = error.localizedDescription }
    }
    func refresh(allowTimerSubmission: Bool = false) async {
        guard let credential, !busy else { return }; busy = true; defer { busy = false }
        do {
            // A queued mutation retains its captured revision. Fetching a newer snapshot must not rebase it.
            if let queued = pending, queued.conflict == nil, queued.request.intent != "complete", !allowTimerSubmission {
                let review = PendingMutation(request: queued.request, conflict: "上次计时操作未获确认。请核对下方服务器计时状态后丢弃待处理操作；不会在重连时延迟启动计时。")
                try WatchStorage.save(review, "pending.json"); pending = review
            }
            if let queued = pending, queued.conflict == nil {
                do {
                    _ = try await request("/api/watch/runs/\(credential.experimentId)", body: JSONEncoder().encode(queued.request))
                    try FileManager.default.removeItem(at: WatchStorage.url("pending.json")); pending = nil
                } catch let error as NSError {
                    if error.domain == "LabNest" { let conflict = PendingMutation(request: queued.request, conflict: error.localizedDescription); try WatchStorage.save(conflict, "pending.json"); pending = conflict }
                    throw error
                }
            }
            let value = try JSONDecoder().decode(RunSnapshot.self, from: await request("/api/watch/runs/\(credential.experimentId)"))
            try WatchStorage.save(value, "snapshot.json"); snapshot = value; connected = true
            serverOffset = value.serverTime / 1000 - Date().timeIntervalSince1970
            message = pending == nil ? "已同步 · \(value.capturedAt)" : "本机有冲突，未覆盖服务器。"
            await scheduleReminders()
        } catch { connected = false; message = "未同步：\(error.localizedDescription)。已保留本机快照与待发送操作。" }
    }
    func operate(_ intent: String, step: RunStep) async {
        guard let snapshot, pending == nil, !busy else { return }
        // Timer control requires a current online read. Completion can queue once with its original revision.
        guard intent == "complete" || connected else { message = "离线时仅查看计时状态，计时控制请联网。"; return }
        let operation = RunMutation(intent: intent, stepId: step.id, revision: snapshot.revision, clientMutationId: UUID().uuidString, deviceCreatedAt: ISO8601DateFormatter().string(from: Date()), sourceRef: step.sourceRef)
        do { let queued = PendingMutation(request: operation, conflict: nil); try WatchStorage.save(queued, "pending.json"); pending = queued; message = "已保存至本机，等待同步。"; await refresh(allowTimerSubmission: true) }
        catch { message = "本机保存失败，操作未确认：\(error.localizedDescription)" }
    }
    func discardPending() {
        do { try FileManager.default.removeItem(at: WatchStorage.url("pending.json")); pending = nil; message = "已丢弃未同步操作，请在手机核对当前状态。" }
        catch { message = error.localizedDescription }
    }
    func remaining(_ step: RunStep, now: Date = Date()) -> Int {
        let initial = step.timer.remainingSeconds ?? step.timer.durationSeconds ?? 0
        guard let text = step.timer.startedAt else { return initial }
        let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let start = formatter.date(from: text) else { return initial }
        return max(0, initial - Int(now.timeIntervalSince1970 + serverOffset - start.timeIntervalSince1970))
    }
    func enableReminders() async {
        do { reminders = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]); UserDefaults.standard.set(reminders, forKey: "reminders"); await scheduleReminders() }
        catch { notificationStatus = error.localizedDescription }
    }
    func scheduleReminders() async {
        let center = UNUserNotificationCenter.current(), settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationStatus = settings.authorizationStatus == .authorized ? "本表通知已授权；实际锁屏送达待真机验证。" : "本表通知未授权；只显示计时。"
        let old = await center.pendingNotificationRequests(); center.removePendingNotificationRequests(withIdentifiers: old.filter { $0.identifier.hasPrefix("labnest:") }.map(\.identifier))
        guard reminders, connected, settings.authorizationStatus == .authorized, let snapshot else { return }
        for step in snapshot.steps where step.timer.startedAt != nil && remaining(step) > 0 {
            let content = UNMutableNotificationContent(); content.title = "计时结束 · \(step.title)"; content.body = "\(step.group)。请核对实验操作；通知不会自动完成步骤。"; content.sound = .default
            let id = "labnest:\(snapshot.experimentId):\(step.id):\(snapshot.revision)"
            try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: Double(remaining(step)), repeats: false)))
        }
    }
}
