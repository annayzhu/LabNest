import Foundation

// The runner inserts the production Codable types and refresh method unchanged.
// Network, storage, widget publication and notifications are isolated test doubles.
// MODEL_TYPES

enum WatchStorage {
    static let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    static func url(_ name: String) -> URL { directory.appendingPathComponent(name) }
    static func save<T: Encodable>(_ value: T, _ name: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(value).write(to: url(name), options: .atomic)
    }
}

@MainActor final class SyncFixture {
    var snapshot: RunSnapshot?
    var pending: PendingMutation?
    var credential: WatchCredential? = WatchCredential(token: "fixture", experimentId: "fixture", serverOrigin: "https://fixture.invalid")
    var busy = false, syncing = false, connected = false
    var message = ""
    var lastSyncedAt: Date?
    var serverOffset: TimeInterval = 0
    var calls: [String] = []
    var getError: NSError?
    var postError: NSError?
    var nextSnapshot = RunSnapshot(experimentId: "fixture", title: "Software test", revision: 8, serverTime: Date().timeIntervalSince1970 * 1000, capturedAt: "fixture", steps: [])
    var observeRequest: (() -> Void)?
    func request(_ path: String, body: Data? = nil) async throws -> Data {
        observeRequest?()
        calls.append(body == nil ? "GET" : "POST")
        if let error = body == nil ? getError : postError { throw error }
        return try JSONEncoder().encode(nextSnapshot)
    }
    func publishWidget() {}
    func scheduleReminders() async {}
    // REFRESH_UNDER_TEST
}

@main enum WatchSyncChecks {
    static func check(_ condition: @autoclosure () -> Bool, _ name: String) {
        if !condition() { print("FAIL: \(name)"); exit(1) }
    }
    @MainActor static func main() async throws {
        defer { try? FileManager.default.removeItem(at: WatchStorage.directory) }
        let model = SyncFixture()
        await model.refresh()
        check(model.message.contains("同步成功"), "successful unchanged sync must show confirmation")
        check(model.lastSyncedAt != nil && !model.busy && !model.syncing && model.connected, "successful sync publishes time and releases button")
        model.observeRequest = { check(model.busy && model.syncing && model.message == "正在同步…", "request displays progress") }
        await model.refresh()
        check(model.calls == ["GET", "GET"], "manual repeat sync reads again")
        model.observeRequest = nil
        let lastSuccess = model.lastSyncedAt
        model.getError = NSError(domain: NSURLErrorDomain, code: NSURLErrorTimedOut)
        await model.refresh()
        check(model.message.hasPrefix("未同步：") && !model.connected && !model.busy && !model.syncing, "failure shows error and releases button")
        check(model.snapshot?.revision == 8 && model.lastSyncedAt == lastSuccess, "failure preserves snapshot and last successful time")
        model.getError = nil
        var request = RunMutation(intent: "complete", stepId: "step", revision: 3, clientMutationId: UUID().uuidString, deviceCreatedAt: "fixture", sourceRef: "step")
        model.pending = PendingMutation(request: request, conflict: nil)
        model.postError = NSError(domain: "LabNest", code: 409, userInfo: [NSLocalizedDescriptionKey: "revision conflict"])
        model.calls = []
        await model.refresh()
        check(model.calls == ["POST", "GET"], "rejected write still reads current snapshot")
        check(model.pending?.request.revision == 3 && model.pending?.conflict == "revision conflict", "conflict retains original revision and explanation")
        check(model.snapshot?.revision == 8 && model.connected && model.message.contains("待处理"), "conflict refresh reports read success without claiming write success")
        model.calls = []
        await model.refresh()
        check(model.calls == ["GET"], "existing conflict is never resubmitted automatically")
        request.intent = "start"
        model.pending = PendingMutation(request: request, conflict: nil)
        model.calls = []
        await model.refresh()
        check(model.calls == ["GET"] && model.pending?.conflict != nil, "old timer action is held for review, never delayed into a new timer")
        request.intent = "complete"
        model.pending = PendingMutation(request: request, conflict: nil)
        try WatchStorage.save(model.pending!, "pending.json")
        model.postError = nil
        model.calls = []
        await model.refresh()
        check(model.calls == ["POST", "GET"] && model.pending == nil && model.message.contains("同步成功"), "accepted queued action clears only after server acknowledgement")
        model.credential = nil
        model.calls = []
        await model.refresh()
        check(model.calls.isEmpty && model.message.contains("尚未连接"), "unpaired refresh gives an actionable message")
        print("PASS: feedback, in-flight progress, repeated reads, failure recovery, snapshot preservation, conflict refresh, original revision, timer review, acknowledged queue, unpaired guidance")
    }
}
