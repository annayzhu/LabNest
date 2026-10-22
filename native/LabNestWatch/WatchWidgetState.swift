import Foundation
import WidgetKit

/// What the watch face shows: the step in focus and, while its timer runs, when it ends. The app writes it to the
/// shared App Group after every sync, operation or step choice; the LabNestWatchWidget extension reads it.
/// Without the App Group entitlement there is no shared container: nothing is written and the face shows "LabNest".
struct WatchWidgetState: Codable, Equatable {
    var experimentTitle: String
    var stepTitle: String?
    /// The running timer's end; nil when no timer runs.
    var endsAt: Date?
    /// A paused timer's remaining time.
    var pausedSeconds: Int?
    /// Every step is done or skipped.
    var finished = false

    static let appGroup = "group.org.labnest.mobile"
    private static var file: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appendingPathComponent("watch-widget.json")
    }

    static func load() -> WatchWidgetState? {
        guard let file, let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(WatchWidgetState.self, from: data)
    }

    /// nil clears the face (unpaired). The face is reloaded only when what it shows changed.
    static func publish(_ state: WatchWidgetState?) {
        guard let file, load() != state else { return }
        if let state, let data = try? JSONEncoder().encode(state) { try? data.write(to: file, options: .atomic) }
        else { try? FileManager.default.removeItem(at: file) }
        WidgetCenter.shared.reloadAllTimelines()
    }
}
