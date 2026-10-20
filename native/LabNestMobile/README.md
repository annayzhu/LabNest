# LabNest iPhone 配套 App

第一版只负责把网页上的实验连接交给 Apple Watch。手表使用原生界面，不需要浏览器。实验步骤、计时、配液卡和离线待同步操作复用 `../LabNestWatch/`，不另建一套实验逻辑。

## 首次安装

1. 用 Xcode 打开 `LabNestMobile.xcodeproj`，选择 **LabNestMobile** scheme。
2. 在 **LabNestMobile** 与 **LabNestWatch** 两个 target 的 Signing & Capabilities 中选择同一个开发团队。默认 bundle ID 为 `org.labnest.mobile`、`org.labnest.mobile.watch`；如需更改，Watch 的 `WKCompanionAppBundleIdentifier` 必须与 iPhone ID 一致，Watch ID 以 iPhone ID 为前缀。
3. iPhone 先通过系统 Watch App 与手表配对。iPhone 接入 Mac、解锁并信任电脑；按 Xcode 提示启用需要的开发者模式。
4. 选择真机 iPhone，Build & Run。iPhone 的 Watch App 中若尚未自动安装 LabNest，在可用 App 中安装；也可在 Xcode 选择配对手表运行 Watch target。

最低系统：iOS 17、watchOS 10。工程不含签名账号、开发证书或描述文件。模拟器 `.app` 不能直接装到真机。TestFlight 尚未发布；首次真机安装仍需 Xcode 签名。将来发布 TestFlight 可简化安装，不会替代 LabNest 服务器连接。

## 日常连接

1. 确认 iPhone 和手表能访问 LabNest 所在网络；`localhost` 不能指向 Mac。
2. LabNest 网页进入实验的“其他设备”，生成配对码。
3. 用 iPhone 系统相机扫描 **Apple Watch 卡片中的二维码**；或在 iPhone 网页点“在此 iPhone 的 LabNest App 中连接”。这要求 iPhone App 已安装。
4. 手机只会填入信息。核对服务器地址，打开手表上的 LabNest、保持亮屏，然后在手机点“连接 Apple Watch”。
5. 手机显示“手表已保存连接”后，在手表查看实验是否成功同步。保存连接不等于服务器当前可达。

也可把服务器地址和 4 位数字配对码填在手机上，前导零需要保留。网页、手机和手表 App 需要一起更新为此版本。配对码只能使用一次，有效期 10 分钟；未连接成功时可重试，过期后重新生成。同一服务器 10 分钟内累计 5 次无效配对后，暂时停止接受配对；需等待最多 10 分钟，已有连接不受影响。

## 方法说明

- `labnest://watch-pair?server=…&code=…` 只携带临时配对码，不携带长期访问凭据。自定义链接不是已验证的网站身份，因此必须由用户在手机确认目标服务器；不自动联网或配对。
- `WCSession.sendMessage` 只在配对手表可达时发送。没有后台自动重试或后台排队，防止旧请求晚到后切换实验。
- iPhone 只在内存中保留配对码和重试 ID；不保存实验令牌。Watch 向现有 `/api/watch/pair` 请求授权，在 Keychain 保存凭据，并把该请求 ID 一同保存。
- 手表只有在钥匙串保存成功后才回执。丢失回执后可凭相同请求 ID 确认已保存的连接，无需再次消费一次性码。
- 手表忙碌或有未处理的离线操作时拒绝切换。配对失败保留旧连接。成功后再读取实验；服务器不可达时展示未同步状态。
- 数据读取和实验操作仍由 Watch 通过现有 HTTP API 完成。这一版不增加 iPhone 网络代理，不保证离线或后台传输。通知送达和真实计时仍需真机验证。

## 编译与检查

在仓库根目录执行：

```sh
xcodebuild -project native/LabNestMobile/LabNestMobile.xcodeproj \
  -scheme LabNestMobile -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/labnest-mobile-build CODE_SIGNING_ALLOWED=NO build

xcrun swiftc -module-cache-path /tmp/labnest-swift-modules \
  native/LabNestWatch/PairingLink.swift \
  native/LabNestMobileTests/PairingLinkChecks.swift \
  -o /tmp/labnest-pairing-checks
/tmp/labnest-pairing-checks
npx vitest run src/lib/field-mode.test.ts
npm run typecheck
```

未签名编译只检查代码，不能证明 Keychain 或 WatchConnectivity 可运行。模拟器临时签名只用于本地 QA，不能用于真机安装。

验收记录与截图见 `../../docs/watch-companion-20261019/`。完整通过标准包括真机安装、扫码填入、手表保存并读取正确实验、失败时保留旧连接、重试不重复消费配对码、未同步操作阻止切换。未通过的项目必须在验收记录中保留。

参考：[Apple WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity/wcsession)、[TestFlight 安装说明](https://testflight.apple.com/)。
