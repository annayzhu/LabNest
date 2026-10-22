import SwiftUI
import UserNotifications

@main struct LabNestMobileApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    var body: some Scene {
        WindowGroup { RootView(app: AppState.shared) }
    }
}

/// The server the app shows, and what happens around its pages: setup, links into the app, and the Watch.
@MainActor @Observable final class AppState {
    static let shared = AppState()
    static let serverKey = "labnest.server"

    private(set) var address: ServerAddress?
    /// The setup screen over the pages (更换服务器).
    var setupShown = false
    /// A camera-scanned watch pairing link, waiting for the user to confirm it.
    var watchLink: WatchLinkRequest?
    var notice: String?
    @ObservationIgnored let web = WebModel()
    @ObservationIgnored let phone = PhoneConnection()
    @ObservationIgnored let timers = TimerCenter()

    private init() {
        address = UserDefaults.standard.string(forKey: Self.serverKey).flatMap { try? ServerAddress($0) }
        web.app = self
        if let address { web.load(address.origin) }
    }

    /// Keep the origin; open the scanned page, or the home page when the server changed.
    func save(_ next: ServerAddress) {
        let changed = address?.origin != next.origin
        UserDefaults.standard.set(next.origin.absoluteString, forKey: Self.serverKey)
        address = try? ServerAddress(next.origin.absoluteString, allowLoopback: true)
        setupShown = false
        if let page = next.page { web.load(page) } else if changed || web.webView.url == nil { web.load(next.origin) }
    }

    func open(_ url: URL) {
        guard url.scheme?.lowercased() == "labnest" else { return }
        switch url.host {
        case "watch-pair":
            do { watchLink = WatchLinkRequest(link: try PairingLink(url: url)) } catch { notice = error.localizedDescription }
        case "open":
            let target = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "url" }?.value
            guard let page = target.flatMap(URL.init(string:)), address?.contains(page) == true else { return }
            setupShown = false
            web.load(page)
        default:
            break
        }
    }

}

struct WatchLinkRequest: Identifiable {
    let id = UUID()
    let link: PairingLink
}

struct RootView: View {
    @Bindable var app: AppState
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if app.address != nil {
                WebScreen(app: app)
            } else {
                ServerSetupView(app: app, cancellable: false)
            }
        }
        .tint(.labnestMoss)
        .fullScreenCover(isPresented: $app.setupShown) { ServerSetupView(app: app, cancellable: true) }
        .sheet(item: $app.watchLink) { request in WatchLinkSheet(app: app, link: request.link) }
        .alert("LabNest", isPresented: Binding(get: { app.notice != nil }, set: { if !$0 { app.notice = nil } })) {
            Button("好", role: .cancel) { app.notice = nil }
        } message: { Text(app.notice ?? "") }
        .onOpenURL { app.open($0) }
        .onChange(of: scenePhase) { _, phase in if phase == .active { app.phone.updateStatus() } }
    }
}

struct WebScreen: View {
    let app: AppState
    var body: some View {
        WebViewHost(webView: app.web.webView)
            // The status bar keeps the page's colour; the page reaches the bottom edge and pads its own bar.
            .ignoresSafeArea(.container, edges: .bottom)
            .background(app.web.pageColor.ignoresSafeArea())
            .overlay {
                if let error = app.web.loadError {
                    VStack(spacing: 16) {
                        Image(systemName: "wifi.exclamationmark").font(.system(size: 40)).foregroundStyle(.secondary).accessibilityHidden(true)
                        Text("打不开 LabNest").font(.title3.bold())
                        Text(error).font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        Button("重试") { app.web.retry() }.buttonStyle(.borderedProminent).accessibilityIdentifier("retry")
                        Button("更换服务器") { app.setupShown = true }.accessibilityIdentifier("change-server")
                    }
                    .padding(28)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(uiColor: .systemBackground))
                }
            }
            #if DEBUG
            .task {
                // Simulator QA only: `-LabNestEval <script>` runs a script in the loaded page (e.g. posting a bridge
                // message), then prints whatever the page left in window.__labnestQA.
                let arguments = ProcessInfo.processInfo.arguments
                guard let index = arguments.firstIndex(of: "-LabNestEval"), index + 1 < arguments.count else { return }
                try? await Task.sleep(for: .seconds(4))
                _ = try? await app.web.webView.evaluateJavaScript(arguments[index + 1] + "\n;'posted'")
                try? await Task.sleep(for: .seconds(3))
                print("LabNest QA:", (try? await app.web.webView.evaluateJavaScript("String(window.__labnestQA || 'none')")) ?? "nil")
            }
            #endif
    }
}

/// A watch pairing link scanned with the camera: the user checks the server before the Watch is pointed at it.
struct WatchLinkSheet: View {
    let app: AppState
    let link: PairingLink
    @Environment(\.dismiss) private var dismiss
    @State private var result: (ok: Bool, message: String)?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("服务器", value: link.server.absoluteString)
                    LabeledContent("配对码", value: link.code)
                } footer: { Text("确认这是你的 LabNest。手表会连接这个地址上的实验；配对码只能用一次，10 分钟内有效。") }
                Section {
                    Label(app.phone.watchStatus, systemImage: app.phone.reachable ? "checkmark.circle" : "applewatch")
                    Button {
                        Task { result = await app.phone.send(link) }
                    } label: {
                        HStack { if app.phone.busy { ProgressView() }; Text(app.phone.busy ? "正在等待手表…" : "发送到 Apple Watch") }.frame(maxWidth: .infinity)
                    }
                    .disabled(app.phone.busy || result?.ok == true)
                    .accessibilityIdentifier("send-to-watch")
                    if let result { Text(result.message).font(.footnote).foregroundStyle(result.ok ? Color.secondary : Color.orange) }
                }
            }
            .navigationTitle("连接 Apple Watch")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(result?.ok == true ? "完成" : "取消") { dismiss() } } }
            .onAppear { app.phone.updateStatus() }
        }
    }
}

/// Timer notifications show while the app is open too, and a tap opens the experiment.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let page = response.notification.request.content.userInfo["url"] as? String, let link = labnestOpenURL(page) else { return }
        await MainActor.run { AppState.shared.open(link) }
    }
}

extension Color {
    static let labnestMoss = Color(red: 0.24, green: 0.36, blue: 0.30)
}
