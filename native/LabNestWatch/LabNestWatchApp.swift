import SwiftUI
@main struct LabNestWatchApp: App {
    @StateObject private var model = WatchModel()
    var body: some Scene { WindowGroup { WatchRunView().environmentObject(model) } }
}
struct WatchRunView: View {
    @EnvironmentObject var model: WatchModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var code = ""
    @State private var selected = ""
    @State private var settings = false
    @State private var confirming: RunStep?
    @State private var discard = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if model.credential == nil || settings {
                        Text("在手机 Run 中生成配对码").font(.headline)
                        TextField("服务器地址", text: $model.baseURL).textContentType(.URL).disabled(model.busy)
                        TextField("12 位配对码", text: $code).disabled(model.busy)
                        Button("配对本次实验") { Task { if await model.pair(code: code) { await model.refresh(); settings = false } } }.disabled(model.busy || model.pending != nil)
                        if let error = model.pairingError { Text(error).foregroundStyle(.orange).font(.footnote).fixedSize(horizontal: false, vertical: true) }
                        Text("使用手表可访问的内网地址或受信任 HTTPS；localhost 指的是手表自身。").font(.footnote)
                    }
                    if let snapshot = model.snapshot {
                        Text(snapshot.title).font(.headline).fixedSize(horizontal: false, vertical: true)
                        Text(model.connected ? "当前服务器快照" : "离线快照 · 可能已变化").foregroundStyle(model.connected ? Color.secondary : Color.orange)
                        // A wheel picker collapses inside a watch ScrollView; use a full-screen list.
                        Picker("当前操作", selection: Binding(get: { snapshot.steps.contains(where: { $0.id == selected }) ? selected : snapshot.steps.first?.id ?? "" }, set: { selected = $0 })) {
                            ForEach(snapshot.steps) { step in Text("\(step.group) · \(step.title)").tag(step.id) }
                        }.pickerStyle(.navigationLink).frame(minHeight: 44)
                        if let step = snapshot.steps.first(where: { $0.id == selected }) ?? snapshot.steps.first {
                            Text(step.group).font(.subheadline)
                            Text(step.title).font(.headline).fixedSize(horizontal: false, vertical: true)
                            Text(step.text).fixedSize(horizontal: false, vertical: true)
                            if step.blocked { Text("参数待确认，请回到手机处理。").foregroundStyle(.orange) }
                            if let reason = step.skipped { Text("已跳过：\(reason)") }
                            if step.timer.durationSeconds != nil {
                                TimelineView(.periodic(from: .now, by: 1)) { context in Text("计时 \(model.remaining(step, now: context.date) / 60):\(String(format: "%02d", model.remaining(step, now: context.date) % 60))").monospacedDigit() }
                                Text("计时到零不会完成实验步骤。").font(.footnote)
                                HStack { Button(step.timer.startedAt == nil ? "开始" : "暂停") { Task { await model.operate(step.timer.startedAt == nil ? "start" : "pause", step: step) } }; Button("结束计时") { Task { await model.operate("finish", step: step) } } }.disabled(model.busy || !model.connected || !step.canTime || model.pending != nil)
                            }
                            ForEach(step.mixes ?? []) { mix in
                                if mix.stale { Text("\(mix.title)：\(mix.note ?? "请在手机上确认。")").foregroundStyle(.orange).font(.footnote).fixedSize(horizontal: false, vertical: true) }
                                else { NavigationLink("配液卡 · \(mix.title)") { MixPagerView(stepId: step.id, mixId: mix.id).environmentObject(model) }.frame(minHeight: 44) }
                            }
                            Button(step.completed ? "已完成" : "确认完成操作") { confirming = step }.disabled(!step.canComplete || model.busy || model.pending != nil)
                            if !step.canComplete && !step.completed { Text("必填记录、配液卡、体系或计时状态不满足时，请在手机核对。").font(.footnote) }
                        }
                    }
                    Text(model.message).font(.footnote).fixedSize(horizontal: false, vertical: true)
                    if let pending = model.pending {
                        Text("本机待同步：\(["complete": "完成操作", "start": "开始计时", "pause": "暂停计时", "finish": "结束计时"][pending.request.intent] ?? "实验操作")").foregroundStyle(.orange)
                        if let conflict = pending.conflict { Text(conflict).font(.footnote); Button("丢弃本机未同步操作", role: .destructive) { discard = true } }
                    }
                    Button("刷新与同步") { Task { await model.refresh() } }.disabled(model.busy)
                    Button("在此表启用计时提醒") { Task { await model.enableReminders() } }
                    Text(model.notificationStatus).font(.footnote)
                    Button("连接设置") { settings.toggle() }
                }.padding(.horizontal, 6)
            }.navigationTitle("LabNest")
        }.task { await model.refresh() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await model.refresh() } } }
        .confirmationDialog("确认已经完成此实验操作？", isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } })) { if let step = confirming { Button("确认完成") { Task { await model.operate("complete", step: step) }; confirming = nil } } }
        .confirmationDialog("此操作尚未同步。确认删除本机副本？", isPresented: $discard) { Button("确认丢弃", role: .destructive) { model.discardPending() } }
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
                        Text(line.name).font(.headline).multilineTextAlignment(.center).strikethrough(line.struck).fixedSize(horizontal: false, vertical: true)
                        Text(line.total).font(.system(size: 34, weight: .semibold, design: .rounded)).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1).strikethrough(line.struck)
                        Text(line.mode == "separate" ? "每\(mix.per)单独加 \(line.perReaction)" : "每\(mix.per) \(line.perReaction)").font(.footnote).foregroundStyle(.secondary)
                        Text(line.struck ? "已加 · 轻点撤销" : "加完轻点划掉").font(.footnote).foregroundStyle(line.struck ? Color.secondary : Color.accentColor)
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
