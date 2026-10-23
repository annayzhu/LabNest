# LabNest iPhone App

App 里打开的就是你电脑上的 LabNest 网页，页面和网页版是同一套。网页做不好的几件事由 App 自己做：

- 第一次打开时扫码连接服务器；
- 计时显示在锁屏和灵动岛，到点发通知；
- 把配对码直接交给 Apple Watch；
- 震动反馈、下载和打印。

手表端仍是原生 App，代码在 `../LabNestWatch/`。

## 安装

1. 用 Xcode 打开 `LabNestMobile.xcodeproj`，选择 **LabNestMobile** scheme。
2. 在四个 target 的 Signing & Capabilities 中选同一个开发团队：LabNestMobile、LabNestTimers（锁屏计时）、LabNestWatch、LabNestWatchWidget（表盘小组件）。
   - 默认 bundle ID 是 `org.labnest.mobile`、`.timers`、`.watch`、`.watch.widget`。改 ID 时，扩展的 ID 必须以所在 App 的 ID 开头，Watch 的 `WKCompanionAppBundleIdentifier` 必须等于 iPhone 的 ID。
3. iPhone 先通过系统 Watch App 和手表配对。iPhone 接入 Mac、解锁并信任电脑，按 Xcode 提示打开开发者模式。
4. 选真机 iPhone，Build & Run。如果手表上没有自动装好 LabNest，到 iPhone 的 Watch App 里安装；也可以在 Xcode 里选配对的手表，运行 LabNestWatch。

最低系统：iOS 17、watchOS 10。工程里没有签名账号、证书或描述文件。

**App Group（只影响表盘小组件）。** 手表 App 通过 `group.org.labnest.mobile` 把当前步骤交给表盘小组件，这需要 App Groups 能力。Apple 的免费 Personal Team 通常不支持这项能力，Xcode 会拒绝生成描述文件。

在付费开发者账号生效前，可以用命令行构建时加 `CODE_SIGN_ENTITLEMENTS=`，或在 Xcode 中删掉 LabNestWatch 和 LabNestWatchWidget 的 App Groups。这样其余功能照常，只是小组件一直显示"LabNest"。iPhone 的锁屏计时不需要 App Group。

**签名有效期。** Personal Team 签名约 7 天过期，到期要重装。加入 Apple Developer Program 后签名一年有效，也可以用 TestFlight 安装。

## 第一次打开：连接服务器

1. 在电脑上打开 LabNest，进入「现场模式」，点任一实验的「其他设备」。
2. 在 App 里点「扫描二维码」，扫那里的二维码。App 记住这台电脑的地址，并直接打开那个实验。
3. 也可以手动填写地址，例如 `http://192.168.1.10:3001` 或 Tailscale 的 `https://….ts.net`。

保存前 App 会先访问 `/api/health`，确认对方是正在运行的 LabNest。

手机上的 `localhost` 指的是手机自己，不能用。电脑换了网络、IP 变了，就再扫一次。页面发 `changeServer` 消息时，App 回到这个设置页。

只有这台服务器自己的页面会在 App 里打开，其他网站的链接交给 Safari。导出的 DOCX、XLSX 等文件走系统分享面板，打印走系统打印面板。打不开服务器时，App 显示「重试」和「更换服务器」。

## 计时

执行页把这个实验的全部计时发给 App（`timers` 消息），每次都发完整的一组。App 据此维护一个实时活动：

- 显示最先结束的那个计时；没有在走的计时时，显示第一个暂停的计时。
- 其余计时写成「另有 N 个计时」。
- 每个在走的计时安排一条本地通知，到点提醒「<步骤> 计时结束」。
- 点实时活动或通知，回到这个实验。
- 列表为空时，实时活动和通知一起撤掉。

第一次收到计时时，App 会请求通知权限。计时到点不会自动完成步骤。

## 发送到 Apple Watch

在 App 里，执行页的「其他设备 → 手表」由网页生成一次性配对码，App 通过 WatchConnectivity 交给手表（`watchPair` 消息），再把结果告诉页面。

- App 只接受当前服务器的配对码，不会把手表指向别的地址。
- 手表要打开 LabNest 并亮屏。

用 iPhone 相机扫手表卡片的二维码（`labnest://watch-pair?...`）仍然可用：App 先请你核对服务器，再发给手表。

也可把服务器地址和 4 位数字配对码填在手机上，前导零需要保留。网页、手机和手表 App 需要一起更新为此版本。配对码只能使用一次，有效期 10 分钟；未连接成功时可重试，过期后重新生成。同一服务器 10 分钟内累计 5 次无效配对后，暂时停止接受配对；需等待最多 10 分钟，已有连接不受影响。

## 只有真机才能确认的

模拟器里能看到的结果，不代表真机行为。下面这些必须在真机上验收：

- 锁屏上的实时活动、通知是否按时送达、锁屏后计时是否准确；
- 震动反馈；
- 相机扫码（模拟器不支持 VisionKit 扫码）；
- 手表靠 iPhone 联网时能否访问 Tailscale 地址（Q109）。

## 编译与检查

在仓库根目录执行：

```sh
xcodebuild -project native/LabNestMobile/LabNestMobile.xcodeproj \
  -scheme LabNestMobile -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/labnest-mobile-build CODE_SIGNING_ALLOWED=NO build

xcrun swiftc -module-cache-path /tmp/labnest-swift-modules \
  native/LabNestWatch/PairingLink.swift native/LabNestMobileTests/PairingLinkChecks.swift \
  -o /tmp/labnest-pairing-checks && /tmp/labnest-pairing-checks
xcrun swiftc -module-cache-path /tmp/labnest-swift-modules \
  native/LabNestMobile/ServerAddress.swift native/LabNestWatch/PairingLink.swift \
  native/LabNestMobileTests/ServerAddressChecks.swift \
  -o /tmp/labnest-server-address-checks && /tmp/labnest-server-address-checks
```

**模拟器 QA（只在 Debug 构建中有效）：**

- `-LabNestSetupAddress <地址>`：按手动填写的流程连接服务器。
- `-LabNestEval <脚本>`：页面加载后执行一段脚本，例如向 App 发一条桥接消息；随后打印页面写入 `window.__labnestQA` 的内容。

验收记录：`../../docs/mobile/mobile-app-20261021/NATIVE.md`。

验收记录与截图见 `../../docs/mobile/watch-companion-20261019/`。 [2026-10-21 真机安装记录](../../docs/mobile/watch-device-install-20261021/verification.md)已验证 iPhone 与 Apple Watch 的签名安装和启动；本次安装会话尚未验证实际实验配对、真实计时和通知送达。完整通过标准包括真机安装、扫码填入、手表保存并读取正确实验、失败时保留旧连接、重试不重复消费配对码、未同步操作阻止切换。未通过的项目必须在验收记录中保留。
