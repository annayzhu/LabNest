import SwiftUI
import WidgetKit

@main struct LabNestWatchWidgets: WidgetBundle {
    var body: some Widget { LabNestStepWidget() }
}

/// A complication and Smart Stack card: the current step and its countdown, written by the watch app.
struct LabNestStepWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LabNestStep", provider: StepProvider()) { entry in
            StepWidgetView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("LabNest 当前步骤")
        .description("正在进行的实验步骤和计时。")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .accessoryCorner])
    }
}

struct StepEntry: TimelineEntry {
    var date: Date
    var state: WatchWidgetState?
}

struct StepProvider: TimelineProvider {
    func placeholder(in context: Context) -> StepEntry {
        StepEntry(date: .now, state: WatchWidgetState(experimentTitle: "实验", stepTitle: "37 °C 孵育", endsAt: .now.addingTimeInterval(600)))
    }

    func getSnapshot(in context: Context, completion: @escaping (StepEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : StepEntry(date: .now, state: WatchWidgetState.load()))
    }

    /// The app reloads the face whenever it changes; the only change the face makes itself is a timer reaching zero.
    func getTimeline(in context: Context, completion: @escaping (Timeline<StepEntry>) -> Void) {
        let state = WatchWidgetState.load()
        let now = Date.now
        var entries = [StepEntry(date: now, state: state)]
        if let end = state?.endsAt, end > now { entries.append(StepEntry(date: end, state: state)) }
        completion(Timeline(entries: entries, policy: .never))
    }
}

struct StepWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StepEntry

    private var running: Date? { entry.state?.endsAt.flatMap { $0 > entry.date ? $0 : nil } }
    private var timeUp: Bool { entry.state?.endsAt.map { $0 <= entry.date } ?? false }

    var body: some View {
        switch family {
        case .accessoryInline: inline
        case .accessoryCircular: circular
        case .accessoryCorner: corner
        default: rectangular
        }
    }

    @ViewBuilder private var rectangular: some View {
        if let state = entry.state {
            VStack(alignment: .leading, spacing: 1) {
                Text(state.experimentTitle).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                Text(state.finished ? "步骤已全部完成" : state.stepTitle ?? "").font(.headline).lineLimit(1)
                if let running {
                    Text(timerInterval: entry.date...running, countsDown: true).font(.body.monospacedDigit()).foregroundStyle(.green)
                } else if timeUp {
                    Text("计时结束").foregroundStyle(.orange)
                } else if let paused = state.pausedSeconds {
                    Text("已暂停 \(clock(paused))").foregroundStyle(.secondary)
                } else if !state.finished {
                    Text("下一步").foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("LabNest").font(.headline)
                Text("未连接实验").foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder private var circular: some View {
        if let running {
            VStack(spacing: 0) {
                Image(systemName: "timer").font(.caption)
                Text(timerInterval: entry.date...running, countsDown: true).font(.system(size: 12, weight: .semibold).monospacedDigit()).multilineTextAlignment(.center)
            }
        } else {
            Image(systemName: timeUp ? "bell.fill" : "testtube.2").font(.title3)
        }
    }

    @ViewBuilder private var corner: some View {
        Image(systemName: running == nil ? "testtube.2" : "timer")
            .font(.title3)
            .widgetLabel {
                if let running { Text(timerInterval: entry.date...running, countsDown: true) }
                else { Text(entry.state?.stepTitle ?? "LabNest") }
            }
    }

    @ViewBuilder private var inline: some View {
        if let state = entry.state, let step = state.stepTitle {
            if let running { Text("\(Text(timerInterval: entry.date...running, countsDown: true)) \(step)") }
            else { Text(timeUp ? "计时结束 · \(step)" : step) }
        } else {
            Text(entry.state?.finished == true ? "实验步骤已完成" : "LabNest")
        }
    }

    private func clock(_ seconds: Int) -> String {
        let value = max(0, seconds)
        return value >= 3600 ? String(format: "%d:%02d:%02d", value / 3600, value % 3600 / 60, value % 60) : String(format: "%d:%02d", value / 60, value % 60)
    }
}
