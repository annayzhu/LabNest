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
                        Button("配对本次实验") { Task { await model.pair(code: code); await model.refresh(); settings = false } }.disabled(model.busy || model.pending != nil)
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
                            Button(step.completed ? "已完成" : "确认完成操作") { confirming = step }.disabled(!step.canComplete || model.busy || model.pending != nil)
                            if !step.canComplete && !step.completed { Text("必填记录、体系或计时状态不满足时，请在手机核对。").font(.footnote) }
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
