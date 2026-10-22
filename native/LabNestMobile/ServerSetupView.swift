import SwiftUI
import VisionKit

/// First launch, and 更换服务器: scan the code in 现场模式 → 其他设备 on the computer, or type the address.
/// The address is saved only after /api/health answers as LabNest.
struct ServerSetupView: View {
    let app: AppState
    let cancellable: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""
    @State private var scanning = false
    @State private var busy = false
    @State private var error: String?

    private var canScan: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Image(systemName: "qrcode.viewfinder").font(.system(size: 36)).foregroundStyle(Color.labnestMoss).accessibilityHidden(true)
                        Text("连接你的 LabNest").font(.title2.bold())
                        Text("在电脑上打开 LabNest，进入「现场模式」，点任一实验的「其他设备」，扫描那里的二维码。").foregroundStyle(.secondary)
                    }.padding(.vertical, 6)
                }
                if canScan {
                    Section {
                        Button { error = nil; scanning = true } label: { Label("扫描二维码", systemImage: "camera.viewfinder").frame(maxWidth: .infinity) }
                            .disabled(busy).accessibilityIdentifier("scan-server")
                    }
                }
                Section {
                    // Verbatim: a string literal here would turn the example address into a link.
                    TextField("服务器地址", text: $typed, prompt: Text(verbatim: "例如 http://192.168.1.10:3001"))
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .submitLabel(.go).onSubmit { connect(typed) }
                        .accessibilityLabel("LabNest 服务器地址").accessibilityIdentifier("server-address")
                    Button { connect(typed) } label: {
                        HStack { if busy { ProgressView() }; Text(busy ? "正在连接…" : "连接") }.frame(maxWidth: .infinity)
                    }.disabled(busy || typed.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityIdentifier("connect-server")
                } header: { Text(canScan ? "或者填写地址" : "服务器地址") } footer: {
                    Text("填电脑的局域网地址或 Tailscale 地址，不能填 localhost。手机和电脑要能互相访问。")
                }
                if let error {
                    Section { Text(error).foregroundStyle(.orange).accessibilityIdentifier("setup-error") }
                }
            }
            .navigationTitle("LabNest")
            .toolbar { if cancellable { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } } }
            .onAppear {
                if typed.isEmpty { typed = app.address?.origin.absoluteString ?? "" }
                #if DEBUG
                // Simulator QA only: `-LabNestSetupAddress <address>` connects as if it had been typed.
                if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-LabNestSetupAddress"), index + 1 < ProcessInfo.processInfo.arguments.count {
                    connect(ProcessInfo.processInfo.arguments[index + 1])
                }
                #endif
            }
            .sheet(isPresented: $scanning) {
                QRScanner { payload in scanning = false; connect(payload) }
                    .ignoresSafeArea()
                    .overlay(alignment: .topTrailing) {
                        Button("取消") { scanning = false }.buttonStyle(.borderedProminent).padding()
                    }
            }
        }
    }

    private func connect(_ input: String) {
        guard !busy else { return }
        error = nil
        let address: ServerAddress
        do { address = try ServerAddress(input) } catch { self.error = error.localizedDescription; return }
        typed = address.origin.absoluteString
        busy = true
        Task {
            defer { busy = false }
            if let problem = await Self.check(address.origin) { error = problem; return }
            app.save(address)
        }
    }

    /// Nil when the address answers as LabNest.
    static func check(_ origin: URL) async -> String? {
        var request = URLRequest(url: origin.appendingPathComponent("api/health"))
        request.timeoutInterval = 8
        request.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            struct Health: Decodable { var status: String }
            guard (response as? HTTPURLResponse)?.statusCode == 200, (try? JSONDecoder().decode(Health.self, from: data))?.status == "ok" else {
                return "\(origin.host ?? "这个地址") 有回应，但不是正常运行的 LabNest。请核对地址和端口。"
            }
            return nil
        } catch let failure as URLError where failure.code == .appTransportSecurityRequiresSecureConnection {
            // iOS only lets the app itself (not its pages) use plain HTTP on local addresses; the page will show any problem.
            return nil
        } catch {
            return "连不上 \(origin.host ?? "这个地址")。请确认电脑上的 LabNest 正在运行，手机和电脑在同一网络或已打开 Tailscale。"
        }
    }
}

/// The system QR scanner: the first code read is handed back once.
struct QRScanner: UIViewControllerRepresentable {
    let found: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])], qualityLevel: .balanced, isHighlightingEnabled: true)
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {
        if !controller.isScanning { try? controller.startScanning() }
    }

    func makeCoordinator() -> Coordinator { Coordinator(found: found) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let found: (String) -> Void
        private var done = false
        init(found: @escaping (String) -> Void) { self.found = found }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !done else { return }
            for item in items {
                if case .barcode(let code) = item, let payload = code.payloadStringValue {
                    done = true
                    scanner.stopScanning()
                    found(payload)
                    return
                }
            }
        }
    }
}
