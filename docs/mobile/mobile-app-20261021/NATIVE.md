# 手机 App 与手表 App · 原生部分（2026-10-21）

对应决定 Q104、Q105、Q110，见 `MOBILE-APP.md`。网页与 App 之间的约定写在 `src/lib/native-bridge.ts`，本文件只记原生这一侧。

## 做了什么

### iPhone App 改成网页容器（Q104）

- **打开 App。** 已保存服务器时，整屏显示该服务器的 LabNest 网页；没有保存时，显示「连接你的 LabNest」。
- **旧入口删掉。** 原来的「服务器地址 + 配对码」表单和「在手机打开 LabNest」按钮已删除，没有第二条路。
- **连接服务器：**
  - 扫电脑「其他设备」里的二维码：只保存地址，扫到的实验页面打开一次；
  - 手动填写地址：没写 `http://` 时自动补上；
  - 手表配对链接：取其中的服务器。
  - 保存前先访问 `/api/health`，回应为 `status: ok` 才保存。
  - 真机拒绝 localhost，模拟器允许。
- **网页容器：**
  - 页面开始执行脚本之前，App 先注入 `window.labnestNative = { version: 1 }`；
  - 左滑返回；页面自己处理底部安全区；状态栏背景取页面底色；
  - 别的网站、`mailto:` 等交给 Safari；
  - 下载（`Content-Disposition: attachment` 或页面显示不了的类型）存进临时文件夹后弹出分享面板；
  - 网页的 `alert / confirm / prompt` 换成系统对话框（不接的话 `confirm` 永远返回 false）；
  - `window.print()` 改走系统打印面板（App 内部多一条 `print` 消息，只在注入脚本里用）；
  - 打不开服务器时显示「重试」「更换服务器」。
- **谁能给 App 发消息。** 只有当前服务器自己的主页面（按 scheme、主机名和端口判断）可以给 App 发消息。
- **两种 `labnest://` 链接：**
  - `labnest://open?url=…`：打开同一服务器上的页面，实时活动和通知点开时用它；
  - `labnest://watch-pair?…`：相机扫手表卡片时用，先让用户核对服务器，再发给手表。
- **权限说明。** Info.plist 补了相机、相册、本地网络的用途说明，以及 `NSSupportsLiveActivities`。ATS 允许本地网络，网页内容允许 HTTP，局域网的 `http://IP:3001` 也能打开。

### 桥接消息（Q105）

| 消息 | App 做什么 |
|---|---|
| `haptic` | `light / medium / success` 三种震动 |
| `timers` | 一个实验的全部计时。App 据此开始、更新或结束这个实验的实时活动，并重排通知；列表为空时全部撤掉 |
| `watchPair` | 先核对地址属于当前服务器，再经 WatchConnectivity 交给手表，结果以 `labnest-native` 事件 `{ type: 'watchPair', ok, message }` 回给页面 |
| `changeServer` | 打开「连接你的 LabNest」 |
| `print`（只在注入脚本里用） | 系统打印面板 |

### 锁屏和灵动岛计时（Q105）

新 target `LabNestTimers`（iOS 小组件扩展）：

- **显示什么：** 一个实验一个实时活动，显示最先结束的计时；没有在走的计时时，显示第一个暂停的计时，标「已暂停」。
- **其余计时：** 写成「另有 N 个计时」。
- **灵动岛：** 紧凑、最小、展开三种样式都有。
- **点开：** 回到实验页。
- **到点以后：** 倒计时停在 0:00，系统把它显示为过时。
- **通知：** 每个在走的计时排一条，标题「<步骤> 计时结束」，正文是实验名。第一次收到计时时请求通知权限。App 在前台时也显示横幅。

### 表盘小组件（Q110）

新 target `LabNestWatchWidget`（watchOS 小组件扩展），有矩形、圆形、角落、单行四种。

- **显示什么：**
  - 有计时在走：显示那个步骤和倒计时；
  - 没有：显示手表上选中的步骤（或下一个未完成的步骤），暂停的计时显示剩余时间；
  - 全部完成：显示「步骤已全部完成」；
  - 没有配对：显示「LabNest」。
- **数据来源：** 手表 App 在每次同步（同步失败时用本机快照）、每次操作、换选步骤后，把一小段 JSON 写进 App Group `group.org.labnest.mobile`。内容变了才刷新表盘。

## 文件

- iPhone：`native/LabNestMobile/`
  - 改写：`LabNestMobileApp.swift`、`PhoneConnection.swift`、`Info.plist`、`README.md`；
  - 新增：`ServerAddress.swift`、`ServerSetupView.swift`、`WebContainer.swift`、`NativeBridge.swift`、`TimerCenter.swift`、`TimerActivity.swift`（App 与扩展共用）、`LabNestTimers/`。
- 手表：`native/LabNestWatch/`
  - 新增：`WatchWidgetState.swift`、`LabNestWatch.entitlements`；
  - 修改：`WatchModel.swift`（`publishWidget`、`focusStepId`）、`LabNestWatchApp.swift`（选中步骤告诉模型）、`README.md`。
  - 新增目录 `native/LabNestWatchWidget/`。
- 工程：
  - `LabNestMobile.xcodeproj` 增加两个扩展 target，分别嵌入 iPhone App 和 Watch App；Debug 加了 `SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG`。
  - 独立的 `LabNestWatch.xcodeproj` 只加了 `WatchWidgetState.swift`，不含小组件。
- 检查：`native/LabNestMobileTests/ServerAddressChecks.swift`。

App 内部仍沿用其他会话未提交的四位配对码改动（`PairingLink.swift`、`WatchModel.swift`、`WatchPhoneReceiver.swift`），本批没有改动它们的逻辑。

## 已验证（模拟器：Xcode 26.6，iOS / watchOS 26.5；iPhone 17 Pro 与 Apple Watch Series 11 46mm 配对）

证据在 `native-evidence/`。

| 检查 | 结果与证据 |
|---|---|
| iPhone 模拟器未签名构建（含两个扩展和手表 App） | 通过，`build-simulator-unsigned.log` |
| iPhone 真机架构未签名构建 | 通过，`build-device-unsigned.log`。这不等于真机安装 |
| LabNestWatch scheme（watchOS 模拟器）未签名构建 | 通过，`build-watch-scheme-unsigned.log` |
| 独立 Watch 工程未签名构建 | 通过，`build-standalone-watch.log` |
| 模拟器临时签名构建（每个 bundle 各自一份只给模拟器用的 entitlements，放在会话临时目录，不进工程） | 通过，`build-simulator-signed.log` |
| 地址解析检查：扫到的页面、手填地址、配对链接、localhost 规则、同源判断，12 个非法输入 | 通过，`ServerAddressChecks.swift` |
| 原有配对链接检查 | 通过，`PairingLinkChecks.swift` |
| 第一次打开显示连接页（模拟器不支持扫码，所以没有扫码按钮） | `iphone-setup-first-launch.png` |
| 连不上的地址给出中文提示，不保存 | `iphone-setup-unreachable.png` |
| 连接 `http://localhost:3002/protocol-run`：只保存地址，并打开该页面 | `iphone-web-run-mode.png`；容器里存的是 `http://localhost:3002` |
| 页面经桥接发来 `timers`，灵动岛出现倒计时；再发空列表，倒计时消失 | `iphone-dynamic-island-compact.png`、`iphone-timers-start-then-end.png` |
| 第一次收到计时时请求通知权限 | `iphone-timers-foreground.png` |
| `watchPair`：页面收到 `labnest-native` 回执。localhost 地址被手表规则拒绝；别的服务器的地址被拒绝 | 控制台输出，见下 |
| `changeServer` 打开连接页（可取消） | `iphone-change-server.png` |
| `labnest://open?url=…/settings` 打开设置页 | `iphone-open-link-settings.png` |
| `labnest://watch-pair?…` 弹出核对页，显示服务器与配对码 | `iphone-watch-link-sheet.png` |
| 页面的 `confirm()` 显示为系统对话框 | `iphone-js-confirm.png` |
| 手表小组件扩展已被系统识别（`pluginkit` 列出 `org.labnest.mobile.watch.widget`） | 是 |
| 手表 App 把当前步骤写进 App Group 文件 | 写入 `{"experimentTitle":"验证用 · 非真实实验","stepTitle":"裂解与孵育","finished":false}`（来自模拟器里以前合成测试留下的快照，不是真实实验） |

`watchPair` 的两次回执：

```
{"ok":false,"type":"watchPair","message":"请填写手机和手表可访问的 http:// 或 https:// 地址；不能使用 localhost。"}
{"ok":false,"type":"watchPair","message":"配对信息与当前服务器不一致，请在这台手机上重新生成配对码。"}
```

截图中的计时都是模拟器测试数据（「计时示例（模拟器测试，非真实实验）」），没有改动任何实验的进度。

## 没有验证的

- **锁屏上的实时活动、灵动岛展开样式。** 模拟器的触控权限没有拿到，没法锁屏或长按。只看到了紧凑样式。
- **表盘小组件的实际外观。** 加复杂功能要在表盘上操作，同样受限于触控权限。
- **通知送达。** 模拟器里的通知权限对话框没人点。真机上的送达、锁屏后计时准确度都没有验证。
- **手机到手表的完整配对。**
  - 本批改的是调用方式：页面通过 App 发码。WatchConnectivity 的消息格式和手表端都没改。
  - 页面生成配对码要点击网页，这次没有做。
  - localhost 的码被手表的地址规则拒绝，用局域网地址才能走完。以前用合成服务做过完整配对（`docs/mobile/watch-companion-20261019/`）。
- **相机扫码、震动。** 模拟器不支持。
- **其他：** 真机下载与分享、打印的分页效果。
- **Q109：** 手表靠 iPhone 联网时，能否访问 Tailscale 地址。
- **Personal Team 下的 App Groups。** 按 Apple 的规则，免费团队通常不能用；若 Xcode 拒绝，用 README 里的临时办法。加入付费账号（Q111）后再在真机上确认。

模拟器里通过不等于真机可用。以上各项需要在真机上补做。
