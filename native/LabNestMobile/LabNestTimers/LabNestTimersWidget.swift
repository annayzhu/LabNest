import ActivityKit
import SwiftUI
import WidgetKit

@main struct LabNestTimersBundle: WidgetBundle {
    var body: some Widget { LabNestTimerActivity() }
}

/// A step timer on the lock screen and in the Dynamic Island. Tapping opens the experiment in the app.
struct LabNestTimerActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LabNestTimerAttributes.self) { context in
            LockScreenTimer(attributes: context.attributes, state: context.state)
                .padding(16)
                .activityBackgroundTint(Color(.systemBackground).opacity(0.86))
                .activitySystemActionForegroundColor(.labnestMoss)
                .widgetURL(labnestOpenURL(context.attributes.url))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.endsAt == nil ? "pause.circle" : "timer").font(.title2).foregroundStyle(Color.labnestMoss)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(state: context.state).font(.title2.monospacedDigit().weight(.semibold)).frame(maxWidth: 110, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.stepTitle).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(subtitle(context.attributes, context.state)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: context.state.endsAt == nil ? "pause.fill" : "timer").foregroundStyle(Color.labnestMoss)
            } compactTrailing: {
                Countdown(state: context.state).monospacedDigit().frame(maxWidth: 56)
            } minimal: {
                Image(systemName: context.state.endsAt == nil ? "pause.fill" : "timer").foregroundStyle(Color.labnestMoss)
            }
            .widgetURL(labnestOpenURL(context.attributes.url))
            .keylineTint(.labnestMoss)
        }
    }
}

private func subtitle(_ attributes: LabNestTimerAttributes, _ state: LabNestTimerAttributes.ContentState) -> String {
    state.others > 0 ? "\(attributes.experimentTitle) · 另有 \(state.others) 个计时" : attributes.experimentTitle
}

struct LockScreenTimer: View {
    let attributes: LabNestTimerAttributes
    let state: LabNestTimerAttributes.ContentState
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(state.stepTitle).font(.headline).lineLimit(2)
                Text(subtitle(attributes, state)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Countdown(state: state).font(.system(size: 34, weight: .semibold, design: .rounded).monospacedDigit())
                if state.endsAt == nil { Text("已暂停").font(.caption2).foregroundStyle(.secondary) }
            }
        }
    }
}

/// A running timer counts down by itself; a paused one shows what is left.
struct Countdown: View {
    let state: LabNestTimerAttributes.ContentState
    var body: some View {
        if let endsAt = state.endsAt {
            let now = Date()
            Text(timerInterval: min(now, endsAt)...max(now, endsAt), countsDown: true)
                .multilineTextAlignment(.trailing)
        } else {
            Text(timerText(state.remainingSeconds))
        }
    }
}

extension Color {
    static let labnestMoss = Color(red: 0.24, green: 0.36, blue: 0.30)
}
