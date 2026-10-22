import Foundation
import ActivityKit

/// One experiment's step timers on the lock screen and in the Dynamic Island. Shared by the app and the LabNestTimers extension.
struct LabNestTimerAttributes: ActivityAttributes {
    /// The timer that ends first (or, when all are paused, the first paused one) and how many others the experiment has.
    struct ContentState: Codable, Hashable {
        var stepTitle: String
        /// When the shown timer ends; nil while it is paused.
        var endsAt: Date?
        /// What is left of a paused timer.
        var remainingSeconds: Int
        var others: Int
    }
    var experimentId: String
    var experimentTitle: String
    /// The experiment page this activity opens.
    var url: String
}

/// A step timer as the page reports it.
struct BridgeTimer: Equatable {
    var stepId: String
    var title: String
    var endsAt: Date?
    var remainingSeconds: Int
}

extension LabNestTimerAttributes.ContentState {
    /// Nil when the experiment has no timers left.
    init?(_ timers: [BridgeTimer]) {
        let running = timers.filter { $0.endsAt != nil }.sorted { $0.endsAt! < $1.endsAt! }
        guard let lead = running.first ?? timers.first else { return nil }
        self.init(stepTitle: lead.title, endsAt: lead.endsAt, remainingSeconds: max(0, lead.remainingSeconds), others: timers.count - 1)
    }
}

/// "labnest://open?url=…": the app opens that page of its own server.
func labnestOpenURL(_ page: String) -> URL? {
    var parts = URLComponents(); parts.scheme = "labnest"; parts.host = "open"; parts.queryItems = [URLQueryItem(name: "url", value: page)]
    return parts.url
}

/// "12:05" or "1:02:05".
func timerText(_ seconds: Int) -> String {
    let value = max(0, seconds), hours = value / 3600, minutes = value % 3600 / 60, rest = value % 60
    return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, rest) : String(format: "%d:%02d", minutes, rest)
}
