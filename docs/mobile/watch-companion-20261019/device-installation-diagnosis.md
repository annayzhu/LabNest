# 真机安装排查

检查时间：2026-10-18 晚，America/Los_Angeles。

## 已确认

- 真实 iPhone 已连接 Mac，安装了 `org.labnest.mobile` 0.1.0（build 1）。
- Xcode 本地最新真机产物包含 `Watch/LabNestWatch.app`，其 bundle ID 为 `org.labnest.mobile.watch`，伴随 App ID 为 `org.labnest.mobile`；最低 watchOS 10。
- 在沙箱外使用 `codesign --verify --deep --strict` 检查，iPhone 和嵌入的 Watch App 签名均有效。
- 解析两个 App 的 `embedded.mobileprovision` 后发现：两份描述文件的 `ProvisionedDevices` 都只有同一部 iPhone，没有真实 Apple Watch。Watch App 的描述文件创建于 2026-10-18 22:31 PDT，尚未过期。
- 最初 `devicectl`、`xcdevice` 和 Xcode 的 LabNestWatch 运行目标列表都没有列出真实手表。重启重连后的进展见下文。
- 用户报告 watchOS 26.6（23U67），在 iPhone Watch App 中安装失败，手表隐私设置中没有开发者模式。
- 用户随后提供 iPhone Watch App 的错误截图：LabNest 已出现在可安装列表；弹窗完整文字为 `This app could not be installed at this time.` / `Could not install at this time.`。这是通用失败提示，未包含具体底层错误代码。

## 当前判断与下一步

缺少手表设备登记是已确认的安装阻碍；截图未提供具体底层错误，尚不能将它认定为唯一原因。收到截图后再次检查，本地两份描述文件仍只包含 iPhone，设备列表仍未列出真实手表。无需修改图标或实验连接代码。

下一步是让 Xcode 与真实 Apple Watch 建立开发连接，完成手表上的信任与开发者模式确认，再为 `LabNestWatch` 自动签名生成包含该手表的描述文件，重新构建和安装。应在安装前重新核对 `ProvisionedDevices`，不能仅凭手机构建成功判断手表可安装。

重新插接 iPhone 后，Mac 日志于 22:47 检测到真实手表，并尝试通过 MobileDevice 建立配对；随后返回 `kAMDPairingDialogResponsePendingError`，等待信任确认回执。用户随后报告已在手表确认 `Trust / Allow`，但仍找不到 `Developer Mode`。后续读取尚未发现手表配对成功记录，`devicectl` 仍仅列出 iPhone；用日志中真实手表 UDID 调用官方 `devicectl manage pair` 返回设备未找到。

用户确认在手机 Watch App 和手表本体均未找到 Developer Mode；同时澄清，安装错误截图来自重启前，尚未执行普通重启和重连。因此目前不能认定重启重连方案已经失败。当前等待用户普通重启并解锁手表，再重新插接 iPhone 数据线，以刷新开发连接。尚未取消手机与手表配对、抹除设备、清除系统配对记录或重启系统服务。手表尚未完成真机安装。

依据：[Apple 安装失败排查](https://developer.apple.com/library/archive/technotes/tn2319/)、[Apple 开发者模式说明](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)、[Apple 工程师关于重新插接 iPhone 触发信任提示的回复](https://developer.apple.com/forums/thread/813066)。

## 重启重连后的进展

用户随后确认已完成手表普通重启、解锁和 iPhone 数据线重连。22:57 的 Mac 日志明确记录真实手表 `setupManualPairing` 成功，后续 `verifyManualPairing` 也成功。`devicectl` 现在列出真实手表，状态为 `available (paired)`；Xcode 显示 Apple Watch Series 8。

当前阻碍转为开发网络连接：`tunnelState` 为 `disconnected`，Xcode 显示 `Timed out while attempting to establish tunnel using negotiated network parameters`。尚不能读取 watchOS 版本或 Developer Mode 状态。`xcodebuild -showdestinations` 中版本字段为空，因此其“与 watchOS 10.0 不匹配”提示不能作为真实系统版本过低的证据。

网络日志显示手表 `_rp-tunnel._tcp.local.` 的 Bonjour 连接使用 `utun7`（标记为 `proxy`）后超时；系统同时报告 Shadowrocket VPN 已连接。这提示代理可能干扰本地开发连接，但尚未通过对照测试确认因果。已准备只临时断开并自动恢复该 VPN 的本地诊断脚本，等待用户授权后才执行。另已请用户在配对成功后重新查看手表本体的 Developer Mode。

## 经授权的 VPN 对照检查

用户明确同意临时断开 Shadowrocket 后恢复，并确认配对成功后手表仍没有 Developer Mode。23:03 执行短时检查，脚本确认 VPN 已断开；随后查询真实手表，仍返回连接无法建立、`pairingState: paired`、`tunnelState: disconnected`。脚本约 15 秒后恢复 VPN，脚本状态及独立 `scutil --nc list` 均确认 Shadowrocket 为 `Connected`。

这段时间的日志确认 Bonjour 请求从代理接口切换到 `en0[802.11]`，不再带 `proxy` 标记，但仍停在服务解析并超时。这说明本次断开 VPN 没有解决连接，不能把 VPN 认定为唯一原因，也未证明其完全无影响。

Mac 系统设置显示当前 Wi-Fi 为 `office-16f`，用户随后确认手表和 iPhone 也连接该网络。Mac 的 Privacy & Security → Local Network 页面显示 Xcode 权限为开启，未修改权限。

一次 15 秒的 `_rp-tunnel._tcp` Bonjour 浏览只发现接口 `en13` / `en11` 上的服务；其实例名称与同时段手表日志请求的实例不一致，未确认发现手表所需服务。重新查询真实手表仍为已配对但连接断开。现有证据不能确定是办公网络服务发现受限还是设备本身问题。

已向用户提出 iPhone 个人热点对照检查：用户在手机开启热点并使手表加入后，Mac 临时连接同一热点，检查后恢复 `office-16f`，并说明可能使用手机流量。目前尚未切换 Wi-Fi、修改路由或 VPN 配置，也未重置配对记录。真实手表 App 仍未安装。
