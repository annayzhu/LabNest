import Foundation
import ActivityKit
import UserNotifications

/// Keeps one Live Activity and one notification per running timer in step with what the page last reported for an experiment.
@MainActor final class TimerCenter {
    /// The page sends the whole set every time, so a later message simply replaces an earlier one.
    func sync(experimentId: String, experimentTitle: String, url: URL, timers: [BridgeTimer]) async {
        await syncActivity(experimentId: experimentId, experimentTitle: experimentTitle, url: url, timers: timers)
        await syncNotifications(experimentId: experimentId, experimentTitle: experimentTitle, url: url, timers: timers)
    }

    private func syncActivity(experimentId: String, experimentTitle: String, url: URL, timers: [BridgeTimer]) async {
        let existing = Activity<LabNestTimerAttributes>.activities.filter { $0.attributes.experimentId == experimentId }
        guard let state = LabNestTimerAttributes.ContentState(timers) else {
            for activity in existing { await activity.end(nil, dismissalPolicy: .immediate) }
            return
        }
        // Past its end the countdown shows 0:00 and the system dims it.
        let content = ActivityContent(state: state, staleDate: state.endsAt)
        if let current = existing.first, current.attributes.experimentTitle == experimentTitle, current.attributes.url == url.absoluteString {
            await current.update(content)
            for extra in existing.dropFirst() { await extra.end(nil, dismissalPolicy: .immediate) }
            return
        }
        for activity in existing { await activity.end(nil, dismissalPolicy: .immediate) }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        _ = try? Activity.request(attributes: LabNestTimerAttributes(experimentId: experimentId, experimentTitle: experimentTitle, url: url.absoluteString), content: content)
    }

    private func syncNotifications(experimentId: String, experimentTitle: String, url: URL, timers: [BridgeTimer]) async {
        let center = UNUserNotificationCenter.current(), prefix = "labnest-timer:\(experimentId):"
        let scheduled = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: scheduled)
        let now = Date()
        let running = timers.filter { ($0.endsAt ?? .distantPast) > now }
        guard !running.isEmpty else { return }
        if await center.notificationSettings().authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
        }
        for timer in running {
            let content = UNMutableNotificationContent()
            content.title = "\(timer.title) 计时结束"
            content.body = experimentTitle
            content.sound = .default
            content.userInfo = ["url": url.absoluteString]
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, timer.endsAt!.timeIntervalSince(now)), repeats: false)
            try? await center.add(UNNotificationRequest(identifier: prefix + timer.stepId, content: content, trigger: trigger))
        }
    }
}
