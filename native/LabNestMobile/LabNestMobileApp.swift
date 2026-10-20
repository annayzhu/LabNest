import SwiftUI

@main struct LabNestMobileApp: App {
    @State private var connection = PhoneConnection()
    var body: some Scene {
        WindowGroup {
            ConnectionView(connection: connection)
                .onOpenURL { connection.receive($0) }
        }
    }
}

struct ConnectionView: View {
    @Bindable var connection: PhoneConnection
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    private let moss = Color(red: 0.24, green: 0.36, blue: 0.30)

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "applewatch.radiowaves.left.and.right").font(.system(size: 36)).foregroundStyle(moss).accessibilityHidden(true)
                        Text("把实验带到手腕上").font(.title2.bold())
                        Text("手机确认连接，手表查看步骤、计时与配液卡。无需在手表输入网址。").foregroundStyle(.secondary)
                    }.padding(.vertical, 8)
                }
                Section("Apple Watch") {
                    Label(connection.watchStatus, systemImage: connection.reachable ? "checkmark.circle" : "applewatch")
                        .accessibilityIdentifier("watch-status")
                }
                Section {
                    TextField("例如 http://192.168.1.10:3001", text: $connection.server)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .accessibilityLabel("LabNest 服务器地址").accessibilityIdentifier("server-address")
                    TextField("4 位数字配对码", text: $connection.code)
                        .keyboardType(.numberPad).textContentType(.oneTimeCode).autocorrectionDisabled()
                        .accessibilityLabel("配对码").accessibilityIdentifier("pairing-code")
                } header: { Text("连接信息") } footer: {
                    Text("在电脑的「其他设备」中生成配对码，用 iPhone 相机扫码即可填入。也可以在此手动输入；请确认地址属于你的 LabNest。")
                }.disabled(connection.busy)
                Section {
                    Button { Task { await connection.connect() } } label: {
                        HStack { if connection.busy { ProgressView() }; Text(connection.busy ? "正在连接…" : "连接 Apple Watch") }
                            .frame(maxWidth: .infinity)
                    }.disabled(connection.busy).accessibilityIdentifier("connect-watch")
                    Text(connection.message).font(.footnote)
                        .foregroundStyle(connection.failed ? Color.orange : Color.secondary)
                        .accessibilityIdentifier("connection-result")
                }
                Section {
                    Button("在手机打开 LabNest", systemImage: "safari") {
                        if let link = try? PairingLink(server: connection.server, code: "0000") { openURL(link.server) }
                    }.disabled((try? PairingLink(server: connection.server, code: "0000")) == nil)
                } footer: { Text("首次安装：在 iPhone 的 Watch App 中确认 LabNest 已安装到手表。连接时让手表上的 LabNest 保持打开。") }
            }
            .navigationTitle("LabNest")
            .tint(moss)
            .onChange(of: scenePhase) { _, phase in if phase == .active { connection.updateStatus() } }
        }
    }
}

#Preview { ConnectionView(connection: PhoneConnection()) }
