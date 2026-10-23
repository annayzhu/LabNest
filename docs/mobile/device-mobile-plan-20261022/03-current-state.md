# 源码事实与证据

核查日期：2026-10-22。本地源码：`/Users/annayzhu/Developer/LabNest`，提交 `601f815b4fc1c93b3d139aaf3a78100f248df3a1`。

本文件的源码事实来自此前只读检查，不是本轮的真机故障复现报告。v1.1 仅更新产品决定与证据适用说明，没有据此宣称功能已修复；没有查看实验内容、导出数据库、生成配对码或修改网络设置。

## 1. 关键事实

| 当前事实 | 证据 | 不能由此推断的结论 |
|---|---|---|
| 设备组件必须传入 experimentId | [FieldDevices.tsx:18](../../../src/components/FieldDevices.tsx:18)；[现场模式入口:79](../../../src/app/protocol-run/page.tsx:79) | 把按钮复制到侧栏，就已经完成了全局设备注册 |
| 左侧导航没有独立设备入口 | [Sidebar.tsx:40](../../../src/components/Sidebar.tsx:40) | 必须先新建实验才是合理的产品限制 |
| localhost 场景从 localStorage 读取手填地址 | [FieldDevices.tsx:29](../../../src/components/FieldDevices.tsx:29) | 浏览器已经自动找到了手机可用的地址 |
| 地址函数只验证 URL 格式 | [field-mode.ts:10](../../../src/lib/field-mode.ts:10) | 地址可访问，或访问到的是原来的 LabNest |
| 默认主机端口映射为 3001:3000 | [docker-compose.yml:37](../../../docker-compose.yml:37) | 容器网卡地址、容器 3000 端口可直接给手机使用；实际部署端口仍需运行时核对 |
| 手机二维码是实验网页链接 | [FieldDevices.tsx:62](../../../src/components/FieldDevices.tsx:62)；[field-mode.ts:23](../../../src/lib/field-mode.ts:23) | 手机已经取得可撤销的设备身份 |
| Watch 使用一次码和 bearer grant | [watch-execution.server.ts:26](../../../src/lib/watch-execution.server.ts:26) | grant 可直接扩大为永久的整个数据库访问权限 |
| 一次码 10 分钟；grant 30 天；grant 绑定一个实验 | [watch-execution.server.ts:56](../../../src/lib/watch-execution.server.ts:56) | 短暂断网一定会删除配对关系 |
| “Watch connected”依据是有效 grant | [watch-execution.server.ts:47](../../../src/lib/watch-execution.server.ts:47)；[FieldDevices.tsx:135](../../../src/components/FieldDevices.tsx:135) | 手表此刻在线、收到了最新步骤或已同步记录 |
| Watch GET 把多种异常统一返回 401 | [Watch API:6](../../../src/app/api/watch/runs/[id]/route.ts:6) | 每次出现“重新配对”都是真的凭据失效 |
| iPhone 是 SwiftUI＋WKWebView，页面来自服务器 | [WebContainer.swift:7](../../../native/LabNestMobile/WebContainer.swift:7)；[AppState:26](../../../native/LabNestMobile/LabNestMobileApp.swift:26) | 已具备完整原生本地业务数据库 |
| 设置页健康检查在 ATS 拦截分支也返回成功 | [ServerSetupView.swift:84](../../../native/LabNestMobile/ServerSetupView.swift:84) | 保存了地址就代表服务可用 |
| 网页已有 IndexedDB 待同步队列 | [mobile-mutation-queue.ts:4](../../../src/lib/mobile-mutation-queue.ts:4) | 全部业务模块已有离线读写与增量同步 |
| 网页已有单实验离线快照 | [ProtocolRunProgressForm.tsx:349](../../../src/components/ProtocolRunProgressForm.tsx:349)；[offline.ts:5](../../../src/lib/calculators/offline.ts:5)；[worker.js:6](../../../public/tools/calculator/worker.js:6) | 普通 HTTP 局域网地址可可靠启用 Service Worker；或能离线打开所有页面 |
| Watch 有 Keychain、本地快照和一条 pending | [WatchModel.swift:17](../../../native/LabNestWatch/WatchModel.swift:17) | Watch 能连续执行整个离线实验 |
| Watch 离线计时控制受限，地址变化要求重新配对 | [WatchModel.swift:79](../../../native/LabNestWatch/WatchModel.swift:79)；[WatchModel.swift:147](../../../native/LabNestWatch/WatchModel.swift:147) | 所有失败都来自 Wi-Fi 不稳定 |
| WatchConnectivity 目前只转发配对消息 | [PhoneConnection.swift:31](../../../native/LabNestMobile/PhoneConnection.swift:31)；[WatchPhoneReceiver.swift:17](../../../native/LabNestWatch/WatchPhoneReceiver.swift:17) | iPhone 已经替手表转发业务请求 |
| iPhone 与 Watch 已有本地通知相关代码 | [TimerCenter.swift:5](../../../native/LabNestMobile/TimerCenter.swift:5)；[WatchModel.swift:190](../../../native/LabNestWatch/WatchModel.swift:190) | 真机锁屏、系统限制、取消提醒传播已全部验收 |
| 当前没有完整 User／Workspace／Membership 模型 | [schema.prisma](../../../prisma/schema.prisma)；[固定 actor:189](../../../src/lib/mobile-mutation-queue.ts:189) | 已支持可靠的多人身份、权限隔离或公开部署 |

## 2. 可复用的现有积累

- Web 的八种待同步操作：Entry、库存流水、测量、步骤完成、附件、计算、Run 材料、步骤记录。
- `clientMutationId` 幂等键、实验 revision、前序操作回执链，以及部分接口的事务校验和审计。
- SwiftUI 工程、扫码、原生计时提醒、Live Activity、Watch 本地快照与凭据保存。
- 现有中英文翻译、紧凑导航、文档数据结构与富文本编辑器。不能因新移动端而建立含义不同的 Protocol/Experiment。
- 已有单实验网页离线准备功能应保留为过渡；旧 origin 下的未同步记录必须有恢复路径，不能通过“清缓存”掩盖连接故障。

## 3. 与昨天方案的关系

来源：[MOBILE-APP.md:15](../mobile-app-20261021/MOBILE-APP.md:15)。

| 历史决定 | 本轮处理 |
|---|---|
| Q103 首先 Apple 设备 | 用户 Q4 再次确认，保留 |
| Q104／Q116 首先远程网页容器，以后逐块原生化 | 本轮要求独立离线与大部分功能，必须扩展数据层；单纯网页容器不能作为最终验收 |
| Q106 Tailscale 固定私有 HTTPS | 作为手机跨隔离 Wi-Fi 的优先验证路径；需机构允许及 Mac/iPhone 配置，不宣称已可用 |
| Q107 暂无账号 | 被本轮确认替代：账号、工作区与全路径后端授权进入 P1，不再新建无账号试用流程；仍不默认公开服务 |
| Q108 Mac 继续作为服务器 | 用户 Q1 确认本地优先；未来可以迁到常开服务器，不引入第二套业务数据源 |
| Q109 Watch 直接连服务器，必要时才手机转发 | 本轮确认默认手机持久转发，同网也如此；无 Watch 蜂窝为必测；旧直连仅受保护兼容，源码尚未因此改变 |
| Q112–Q115 手机交互规则 | 尽量继承，不在本批顺带重做整体 UI |

## 4. 用户后续澄清与当前计划

- 已确认网络事实：二楼电脑与一楼手机分别接入两个可上网、但设备不能互访的 Wi-Fi。仅自动获取 LAN IP 无法满足需求，跨网必须真机验证。
- 已确认手表事实：手机随身，Watch 不以开通蜂窝套餐为前提；默认手机业务转交，不单独配服务器或要求继承手机 VPN。
- 账号纳入第一阶段；旧 Q8 的无账号先行安排被明确替代。身份、设备、网络与离线同步是同一产品的不同职责。
- P1 联合交付任务书一的接入/权限与任务书二 M0–M1 的核心离线链路；P2 扩展全部主要模块。源码事实表不是已完成清单。
- v1.1 修订前 fetch 后本地 HEAD 与 origin/main 为同一提交，ahead/behind 0/0；未核对本次运行服务或真机状态，不把源码同步当作功能上线。

## 5. 官方资料核验

- Docker Desktop 的网络层与主机不同，手机访问应使用主机发布的服务地址，而不是容器内部地址。[Docker 网络说明](https://docs.docker.com/desktop/features/networking/)
- Tailscale Serve 用于私有 tailnet 内服务，不应为方便连接改成公开的 Funnel。[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- iOS 局域网访问需要相应使用说明与权限处理；若使用 Bonjour，需要声明实际服务类型，并测试拒绝权限后的恢复。[Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- WatchConnectivity 的即时消息、最新状态和排队传输有不同用途；业务操作不能仅用会覆盖旧状态的 application context 代替队列。[WCSession](https://developer.apple.com/documentation/watchconnectivity/wcsession)
- `transferUserInfo` 必须在配对真机上测，不能用模拟器证明后台转交可靠。[Apple transferUserInfo](https://developer.apple.com/documentation/watchconnectivity/wcsession/transferuserinfo(_:))
- iOS 决定后台任务何时获得运行机会，因此要求“前台恢复必同步，后台尽力补传”，不承诺定时后台永远运行。[Apple 后台策略](https://developer.apple.com/documentation/BackgroundTasks/choosing-background-strategies-for-your-app)
- 本地通知可由系统在 App 不运行时处理，但系统不保证每次通知均及时送达；需要明确通知权限与实验提醒的使用限制。[本地通知](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app)，[User Notifications](https://developer.apple.com/documentation/usernotifications)

- 账号认证不代替每次访问的授权校验；旧/新数据路径和静态附件都在检查范围内。[OWASP 授权](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- Web/原生会话需要安全存储、过期、更新和撤销机制，不能只做登录页面。[OWASP 会话管理](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- Watch 可通过蓝牙或 Wi-Fi 与配对 iPhone 通信；这一点不等于 LabNest 业务队列已实现。[Apple 连接方式](https://support.apple.com/en-us/109319)

这些资料支持工程约束，不证明当前 LabNest 真机已经具备相应行为。
