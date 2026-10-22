import SwiftUI
import UIKit
import WebKit

/// The LabNest pages of the chosen server in one web view. Pages of other sites open in Safari; downloads go to the share
/// sheet; alert/confirm/prompt and print use the system's own dialogs. Only the server's own main frame may talk to the app.
@MainActor @Observable final class WebModel: NSObject {
    @ObservationIgnored let webView: WKWebView
    @ObservationIgnored weak var app: AppState?
    /// Shown over the page when it could not be loaded.
    var loadError: String?
    /// The page's own background, behind the status bar.
    var pageColor = Color(uiColor: .systemBackground)
    @ObservationIgnored private var downloads: [WKDownload: URL] = [:]
    @ObservationIgnored private var colorObservation: NSKeyValueObservation?
    @ObservationIgnored private var lastRequested: URL?

    /// Runs before any page script: tells the page it is in the app, and routes window.print() to the system print sheet.
    static let injectedScript = """
    window.labnestNative = Object.freeze({ version: 1 });
    window.print = function () { window.webkit.messageHandlers.labnest.postMessage({ type: 'print' }); };
    """

    override init() {
        let configuration = WKWebViewConfiguration()
        let scripts = WKUserContentController()
        scripts.addUserScript(WKUserScript(source: Self.injectedScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController = scripts
        configuration.allowsInlineMediaPlayback = true
        configuration.applicationNameForUserAgent = "Mobile/15E148 LabNestApp/1"
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        scripts.add(WeakScriptHandler(self), name: "labnest")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        // The page lays out its own bottom bar with env(safe-area-inset-bottom).
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        #if DEBUG
        webView.isInspectable = true
        #endif
        colorObservation = webView.observe(\.underPageBackgroundColor, options: [.initial, .new]) { [weak self] view, _ in
            let color = view.underPageBackgroundColor
            Task { @MainActor in if let color { self?.pageColor = Color(uiColor: color) } }
        }
    }

    func load(_ url: URL) {
        loadError = nil
        lastRequested = url
        webView.load(URLRequest(url: url))
    }

    func retry() {
        if let url = webView.url ?? lastRequested ?? app?.address?.origin { load(url) }
    }

    /// App → page: `window.dispatchEvent(new CustomEvent('labnest-native', { detail }))`.
    func dispatch(_ detail: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: detail), let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('labnest-native', { detail: \(json) }))")
    }

    func printPage() {
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = webView.title?.isEmpty == false ? webView.title! : "LabNest"
        controller.printInfo = info
        controller.printFormatter = webView.viewPrintFormatter()
        controller.present(animated: true)
    }

    private func isOwn(_ url: URL) -> Bool { app?.address?.contains(url) ?? false }

    private func openOutside(_ url: URL) {
        guard url.scheme != "javascript" else { return }
        UIApplication.shared.open(url)
    }

    private func share(_ file: URL) {
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = webView
        topController()?.present(sheet, animated: true)
    }

    private func topController() -> UIViewController? {
        var controller = webView.window?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        return controller
    }

    private func ask(_ alert: UIAlertController) {
        guard let controller = topController() else { return }
        controller.present(alert, animated: true)
    }
}

extension WebModel: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, let app,
              let sender = URL(string: "\(origin.protocol)://\(origin.host)\(origin.port == 0 ? "" : ":\(origin.port)")"), isOwn(sender),
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        NativeBridge.handle(type, body, web: self, app: app)
    }
}

extension WebModel: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if action.shouldPerformDownload { return .download }
        if ["about", "blob", "data"].contains(url.scheme?.lowercased() ?? "") || isOwn(url) { return .allow }
        // A frame inside a page (an embedded tool) may come from elsewhere; the page itself stays on the server.
        if action.targetFrame?.isMainFrame == false { return .allow }
        openOutside(url)
        return .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        if let http = response.response as? HTTPURLResponse,
           http.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().hasPrefix("attachment") == true { return .download }
        return response.canShowMIMEType ? .allow : .download
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loadError = nil }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let failure = error as NSError
        // Cancelled by the next navigation, or handed over to a download.
        if failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled { return }
        if failure.domain == "WebKitErrorDomain" && failure.code == 102 { return }
        loadError = "连不上 \(app?.address?.origin.host ?? "LabNest 服务器")。请确认电脑上的 LabNest 正在运行，手机和电脑在同一网络或已打开 Tailscale。\n（\(failure.localizedDescription)）"
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

extension WebModel: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent(suggestedFilename.isEmpty ? "LabNest" : suggestedFilename)
        downloads[download] = file
        return file
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let file = downloads.removeValue(forKey: download) { share(file) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads[download] = nil
        app?.notice = "下载未完成：\(error.localizedDescription)"
    }
}

extension WebModel: WKUIDelegate {
    /// target="_blank": the server's pages stay in the app, other sites open in Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { if isOwn(url) { webView.load(action.request) } else { openOutside(url) } }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "好", style: .default) { _ in done.resume() })
            guard topController() != nil else { return done.resume() }
            ask(alert)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in done.resume(returning: false) })
            alert.addAction(UIAlertAction(title: "确定", style: .default) { _ in done.resume(returning: true) })
            guard topController() != nil else { return done.resume(returning: false) }
            ask(alert)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo) async -> String? {
        await withCheckedContinuation { (done: CheckedContinuation<String?, Never>) in
            let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in done.resume(returning: nil) })
            alert.addAction(UIAlertAction(title: "确定", style: .default) { [weak alert] _ in done.resume(returning: alert?.textFields?.first?.text ?? "") })
            guard topController() != nil else { return done.resume(returning: nil) }
            ask(alert)
        }
    }
}

/// WKUserContentController keeps its handlers alive; this keeps the model from being kept alive by it.
final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

struct WebViewHost: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
