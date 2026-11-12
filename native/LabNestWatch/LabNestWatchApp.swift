import SwiftUI
@main struct LabNestWatchApp: App {
    @StateObject private var model = WatchModel()
    var body: some Scene { WindowGroup { WatchRunView().environmentObject(model) } }
}
struct WatchRunView: View {
    @EnvironmentObject var model: WatchModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var selected = ""
    @State private var settings = false
    @State private var confirming: RunStep?
    @State private var discard = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if model.credential == nil {
                        Text("连接实验").font(.headline)
                        Text("用 iPhone 扫码连接。").foregroundStyle(.secondary)
                        Button("连接设置") { settings = true }.buttonStyle(.borderedProminent).foregroundStyle(.black)
                    }
                    if let snapshot = model.snapshot {
                        if !model.connected { StatusCapsule(text: "离线 · 数据待同步", symbol: "wifi.slash") }
                        let done = snapshot.steps.filter(\.completed).count
                        // Where the run stands: finished steps out of all of them.
                        VStack(alignment: .leading, spacing: 3) {
                            Text("已完成 \(done) / \(snapshot.steps.count)").font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                            ProgressView(value: Double(done), total: Double(max(snapshot.steps.count, 1))).tint(Color.labnestAccent)
                        }.accessibilityElement(children: .combine)
                        // A wheel picker collapses inside a watch ScrollView; use a full-screen list.
                        Picker("当前操作", selection: Binding(get: { snapshot.steps.contains(where: { $0.id == selected }) ? selected : snapshot.steps.first?.id ?? "" }, set: { selected = $0 })) {
                            ForEach(snapshot.steps) { step in Text("\(step.group) · \(step.title)").tag(step.id) }
                        }.pickerStyle(.navigationLink).frame(minHeight: 44)
                        if let step = snapshot.steps.first(where: { $0.id == selected }) ?? snapshot.steps.first {
                            Text(step.instruction ?? step.text).fixedSize(horizontal: false, vertical: true)
                            if step.blocked { StatusCapsule(text: "请在手机确认参数", symbol: "iphone") }
                            if let reason = step.skipped { Text("已跳过：\(reason)").font(.footnote).foregroundStyle(.secondary) }
                            if let duration = step.timer.durationSeconds {
                                TimelineView(.periodic(from: .now, by: 1)) { context in
                                    let left = model.remaining(step, now: context.date)
                                    TimerRing(remaining: left, duration: duration, running: step.timer.startedAt != nil)
                                }
                                HStack(spacing: 8) {
                                    Button { Task { await model.operate(step.timer.startedAt == nil ? "start" : "pause", step: step) } } label: { Image(systemName: step.timer.startedAt == nil ? "play.fill" : "pause.fill").frame(maxWidth: .infinity) }
                                        .accessibilityLabel(step.timer.startedAt == nil ? "开始" : "暂停")
                                    Button { Task { await model.operate("finish", step: step) } } label: { Image(systemName: "stop.fill").frame(maxWidth: .infinity) }
                                        .accessibilityLabel("结束计时")
                                }.disabled(model.busy || !model.connected || !step.canTime || model.pending != nil)
                            }
                            ForEach(step.mixes ?? []) { mix in
                                if mix.stale { Text("\(mix.title)：\(mix.note ?? "请在手机上确认。")").foregroundStyle(.orange).font(.footnote).fixedSize(horizontal: false, vertical: true) }
                                else { NavigationLink { MixPagerView(stepId: step.id, mixId: mix.id).environmentObject(model) } label: { Label("配液卡 · \(mix.title)", systemImage: "list.bullet.rectangle") }.frame(minHeight: 44) }
                            }
                            // The one filled button on the screen.
                            Button { confirming = step } label: { Label(step.completed ? "已完成" : "完成步骤", systemImage: step.completed ? "checkmark.circle.fill" : "checkmark").frame(maxWidth: .infinity) }
                                .buttonStyle(.borderedProminent).foregroundStyle(.black).disabled(!step.canComplete || model.busy || model.pending != nil)
                            if !step.canComplete && !step.completed && !step.blocked && step.skipped == nil && step.timer.startedAt == nil {
                                Text("请在手机核对记录与配液").font(.footnote).foregroundStyle(.orange)
                            }
                            if let instruction = step.instruction, instruction != step.text {
                                NavigationLink("备注与详情") {
                                    ScrollView { Text(step.text).fixedSize(horizontal: false, vertical: true).padding(.horizontal, 6) }
                                        .navigationTitle(step.title)
                                }
                            }
                        }
                    }
                    if !model.message.isEmpty { Text(model.message).font(.footnote).fixedSize(horizontal: false, vertical: true) }
                    if let pending = model.pending {
                        StatusCapsule(text: "本机待同步：\(["complete": "完成操作", "start": "开始计时", "pause": "暂停计时", "finish": "结束计时"][pending.request.intent] ?? "实验操作")", symbol: "arrow.triangle.2.circlepath")
                        if let conflict = pending.conflict { Text(conflict).font(.footnote); Button("丢弃本机未同步操作", role: .destructive) { discard = true } }
                    }
                }.padding(.horizontal, 6)
            }
            .navigationTitle(model.snapshot?.title ?? "LabNest").navigationBarTitleDisplayMode(.inline)
            // Sync and connection live behind the gear, so the screen stays on the current step.
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { settings = true } label: { if model.syncing { ProgressView().controlSize(.small) } else { Image(systemName: "gearshape").foregroundStyle(.white) } }.tint(Color(white: 0.28)).accessibilityLabel("同步与连接设置").accessibilityIdentifier("open-settings") } }
        }
        .tint(Color.labnestAccent)
        .task { model.startPhoneConnection(); await model.refresh() }
        .onChange(of: selected) { _, id in model.focusStepId = id.isEmpty ? nil : id }
        .sheet(isPresented: $settings) { WatchSettingsView().environmentObject(model) }
        .onChange(of: model.credential?.pairingRequestId) { _, id in if id != nil { settings = false } }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await model.refresh() } } }
        .confirmationDialog("确认已经完成此实验操作？", isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } })) { if let step = confirming { Button("确认完成") { Task { await model.operate("complete", step: step) }; confirming = nil } } }
        .confirmationDialog("此操作尚未同步。确认删除本机副本？", isPresented: $discard) { Button("确认丢弃", role: .destructive) { model.discardPending() } }
    }
}

extension Color {
    /// LabNest's dai-cyan at the lightness its dark theme uses, readable on the watch's black.
    static let labnestAccent = Color(red: 0.49, green: 0.76, blue: 0.71)
}

/// A state that needs attention, as one small pill with its icon.
struct StatusCapsule: View {
    let text: String
    let symbol: String
    var body: some View {
        Label(text, systemImage: symbol).font(.footnote).foregroundStyle(.orange)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(Color.orange.opacity(0.16), in: Capsule())
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The countdown as a ring: the arc is what is left, the figure in the middle is the time.
struct TimerRing: View {
    let remaining: Int
    let duration: Int
    let running: Bool
    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.14), lineWidth: 7)
            Circle().trim(from: 0, to: CGFloat(min(1, max(0, Double(remaining) / Double(max(duration, 1))))))
                .stroke(remaining == 0 ? Color.orange : Color.labnestAccent, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(remaining / 60):\(String(format: "%02d", remaining % 60))")
                    .font(.system(size: 30, weight: .semibold, design: .rounded)).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
                Text(remaining == 0 ? "计时结束" : running ? "剩余" : "未开始").font(.footnote).foregroundStyle(.secondary)
            }.padding(.horizontal, 12)
        }
        .frame(width: 112, height: 112).frame(maxWidth: .infinity).padding(.vertical, 2)
        .accessibilityElement(children: .ignore).accessibilityLabel("剩余 \(remaining) 秒")
    }
}

struct WatchSettingsView: View {
    @EnvironmentObject var model: WatchModel
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if model.credential != nil {
                        Button { Task { await model.refresh() } } label: {
                            HStack {
                                if model.syncing { ProgressView().controlSize(.small) } else { Image(systemName: "arrow.triangle.2.circlepath") }
                                Text(model.syncing ? "正在同步…" : "同步")
                            }.frame(maxWidth: .infinity)
                        }.buttonStyle(.borderedProminent).foregroundStyle(.black).disabled(model.busy).accessibilityIdentifier("sync-run")
                        if let syncedAt = model.lastSyncedAt {
                            Text("上次同步：\(syncedAt.formatted(date: .omitted, time: .standard))").font(.footnote).foregroundStyle(.secondary)
                        }
                        Divider()
                    }
                    TextField("服务器地址", text: $model.baseURL).textContentType(.URL).disabled(model.busy)
                    TextField("4 位数字配对码", text: $code).textContentType(.oneTimeCode).disabled(model.busy)
                    Button("配对本次实验") {
                        Task { if await model.pair(code: code) { await model.refresh(); dismiss() } }
                    }.disabled(model.busy || model.pending != nil)
                    if let error = model.pairingError { Text(error).foregroundStyle(.orange).font(.footnote).fixedSize(horizontal: false, vertical: true) }
                    if model.pending != nil { Text("请先处理未同步操作").foregroundStyle(.orange).font(.footnote) }
                    Button("启用计时提醒") { Task { await model.enableReminders() } }
                    Text(model.notificationStatus).font(.footnote).foregroundStyle(.secondary)
                }.padding(.horizontal, 6)
            }.navigationTitle("同步与连接")
        }.tint(Color.labnestAccent)
    }
}

/// One component per screen, name and this run's total in large type. Turn the crown or double tap for the next one;
/// tap to cross it off (shared with the phone, not progress). The last screen is the aliquot instruction.
struct MixPagerView: View {
    @EnvironmentObject var model: WatchModel
    let stepId: String
    let mixId: String
    @State private var page = 0
    var body: some View {
        let step = model.snapshot?.steps.first { $0.id == stepId }
        if let step, let mix = step.mixes?.first(where: { $0.id == mixId }), let lines = mix.lines {
            TabView(selection: $page) {
                ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                    VStack(spacing: 6) {
                        Text("\(index + 1) / \(lines.count)").font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                        Text(line.name).font(.headline).multilineTextAlignment(.center).strikethrough(line.struck).fixedSize(horizontal: false, vertical: true)
                        Text(line.total).font(.system(size: 34, weight: .semibold, design: .rounded)).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1).strikethrough(line.struck)
                        Text(line.mode == "separate" ? "每\(mix.per)单独加 \(line.perReaction)" : "每\(mix.per) \(line.perReaction)").font(.footnote).foregroundStyle(.secondary)
                        Label(line.struck ? "已加" : "轻点标记已加", systemImage: line.struck ? "checkmark.circle.fill" : "hand.tap").font(.footnote).foregroundStyle(line.struck ? Color.secondary : Color.labnestAccent)
                    }
                    .opacity(line.struck ? 0.55 : 1)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture { Task { await model.strike(mix, step: step, line: line) } }
                    .tag(index)
                }
                VStack(spacing: 6) {
                    Text("分装").font(.headline)
                    Text(mix.aliquot ?? "").multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }.tag(lines.count)
            }
            .tabViewStyle(.verticalPage)
            .navigationTitle("\(mix.title) · \(String(format: "%g", mix.quantity ?? 0)) \(mix.per)")
            .toolbar { ToolbarItem(placement: .bottomBar) { NextPageButton { page = min(page + 1, lines.count) } } }
        } else {
            Text("配液卡已变化或未确认，请在手机上核对。").font(.footnote)
        }
    }
}

/// Double tap (watchOS 11 and later) advances, so a gloved hand need not touch the screen.
struct NextPageButton: View {
    let action: () -> Void
    var body: some View {
        if #available(watchOS 11.0, *) { Button("下一项", action: action).handGestureShortcut(.primaryAction) }
        else { Button("下一项", action: action) }
    }
}
