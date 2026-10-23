# iPhone / Apple Watch 配套 App 验收记录

日期：2026-10-19（UTC）；Xcode 26.6，iOS / watchOS 26.5 模拟器。

## 已完成

- 新建 `native/LabNestMobile/LabNestMobile.xcodeproj`，包含 iPhone target、内嵌 Watch target 和共享源码；保留原独立手表工程。
- iPhone 接收配对链接并填入信息，用户确认后通过 WatchConnectivity 交给手表。未安装、未就绪和连接失败有对应提示。
- 网页 Apple Watch 卡片增加 iPhone 配对二维码和打开 App 的链接。临时码有效期仍由现有服务端控制。
- 手机不持久化配对码或实验令牌；手表 Keychain 保存凭据，成功后才给手机回执。配对失败保留旧凭据和实验；存在待同步操作时拒绝切换。

## 已验证

| 检查 | 结果与证据 |
|---|---|
| iPhone + Watch 模拟器编译 | 通过；`build-simulator-unsigned.log` |
| Xcode 临时签名的模拟器构建 | 通过；`build-simulator-signed.log` |
| iPhone + Watch 真机架构编译 | 未签名编译通过；`build-device-unsigned.log`，不等于真机安装 |
| 原独立 Watch 工程 | 编译通过；`build-standalone-watch.log` |
| Web 链接单元测试 | 7 项通过；`src/lib/field-mode.test.ts` |
| 原生链接检查 | 地址归一化、码空格处理及 12 个非法输入通过；`native/LabNestMobileTests/PairingLinkChecks.swift` |
| TypeScript / 定向 ESLint / diff 空白检查 | 通过 |
| 手机深链接填入 | 模拟器实际打开链接，地址与码填入，不自动配对 |
| 无效码处理 | 实际现有服务端拒绝虚构无效码；`iphone-invalid-code.png` |
| 手机到手表配对 | 隔离服务接到一次配对 POST，随后手表 GET 实验；`fixture-requests.jsonl`、`iphone-paired.png`、`watch-paired.png` |
| 失败重配与重启 | 换无效码后显示失败，重启手表仍能读取先前实验；`iphone-repair-rejected.png`、`watch-repair-restart.png` |
| 未同步操作保护 | 在模拟器 App 注入一条明确标注的软件测试待处理记录，连接被拒绝，无新增配对 POST，原文件 ID 保留；`iphone-pending-protected.png` |

成功配对使用 **隔离的合成 HTTP 服务**，标题为“连接测试 · 非真实实验”，不是实际科研实验。该测试验证原生通信、凭据保存及请求流程，不替代现有后端的完整回归测试。没有修改真实实验进度。

## 尚需验证和发布

- 真机 iPhone / Watch 安装与完整连接：本机设备列表仍为 `No devices found`；需要用户连接设备并在 Xcode 选择开发团队。
- 真机相机扫码、锁屏通知、计时精度和后台行为。
- 丢失回执的故障注入：幂等重试代码已实现，尚未做故障注入测试。
- 新二维码 UI 尚未部署到现有 3001 服务；当前网页仍可生成码并手动填在 iPhone App 中，无需手表输入。
- TestFlight 尚未上传或发布。黑白 App 图标已完成（见下方补充记录），其余发布素材尚未准备；这是一版可编译、已运行验证的本地开发版本。
- 当前仓库有此前多个任务的未提交改动。本次只修改原生连接与配对入口相关文件，未把这些改动合并发布；没有把本地开发验证写成已安装或已发布。

## 模拟器签名说明

直接对未签名产物手工重签曾导致模拟器拒绝启动。最终采用 Xcode 构建时的逐 target 临时签名，两个 bundle 分别使用对应的 `application-identifier`，安装、启动、Keychain 和 WatchConnectivity 均通过。

临时 entitlement 文件位于 `/tmp`，不放进正式工程。真机必须使用实际开发团队生成的签名与描述文件，不能套用模拟器的临时 identifier。

精确源码摘要和机器可读结果见 `verification.json`。用户安装指引见 `native/LabNestMobile/README.md`。

## 黑白 App 图标补充验收

- 按用户要求，采用黑底白色回纹；图形复用网页原始 SVG 路径。用户指出第一版回纹过大后，已按截图恢复留白：围绕中心缩放至第一版的 50%，白色图形约占整幅宽度的 30.3%。
- `native/SharedAssets.xcassets/AppIcon.appiconset` 同时接入 iPhone、配套 Watch 和独立 Watch target。
- 1024 × 1024 RGB PNG，检查无透明通道、所有像素 R/G/B 相等；系统生成尺寸和遮罩。
- iPhone + Watch 模拟器签名构建与原独立 Watch 构建均成功；日志为 `build-icons-simulator.log`、`build-icons-standalone.log`。没有图标编译警告；其余既有提示涉及未使用 AppIntents、传统 headermap 和已签名二进制未剥离。
- 第一版安装后的截图保留为 `iphone-black-white-icon.png`、`watch-black-white-icon.png`；缩小后 iPhone + Watch 构建通过，日志为 `build-icons-small-simulator.log`。重新安装后已检查手机主屏幕及手表应用网格，小回纹比例正确；新截图为 `iphone-small-icon.png`、`watch-small-icon.png`。独立 Watch 工程配置未变，本次仅重新构建配套工程中的两个 target。
- 原验收包保留；最新原生源码包为 `LabNest-iPhone-Watch-0.1-black-white-icons-source.zip`，新增源码摘要见 `icons-verification.json`。图标改动未新增或变更连接逻辑，仍需真机安装验证。
