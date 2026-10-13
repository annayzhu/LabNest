# AI 模块迁移验收

- 基线：`c79a5fc21a56a9c156cd2356f19fbd79789c18ae`。
- Provider / cancellation 专项在 `c9566b4b` 通过；其后仅关闭 AI 页及其共享导航链接预取并增加诊断日志。Protocol 在 b6431e31 重跑；最终迁移页面、静态检查、双时区及构建在下述最终实现重跑。
- 最终实现及本机生产构建：`63e4370d2ec8212ce4be1bd3064765e25dfcc19d`；后续证据提交不修改实现。
- PR：<https://github.com/annayzhu/LabNest/pull/96>。合并 SHA、正式部署和空间清理报告由发布记录补充。
- 所有写入验收均在明确命名的独立 PostgreSQL 库 `labnest_ai_module_acceptance_20261014`，使用合成历史设置、Entry 和 Protocol；未使用真实研究正文或真实模型密钥。
- Chromium / WebKit 在实际 Next.js 生产构建页面操作；本地模拟 HTTP 服务只替代外部模型。**模拟成功不表示真实 DeepSeek / Qwen / aihub 调用成功。**

## 逐项结果

| 编号 | 结果 | 实际操作与证据 |
|---|---|---|
| A01 | 通过 | 桌面导航、390px 更多菜单、页面标题为 AI；原建议记录独立保留。`evidence/migration.json`、手机菜单截图 |
| A02 | 通过 | Settings 无 API key 等第二套配置；点击 AI 设置 → 到达新页。`migration.json` |
| A03 | 通过 | `/actions`、两处旧 Settings hash、provider query、过滤后的旧建议链接逐个访问，无循环。`migration.json` |
| A04 | 通过 | 关闭后仍能进页面；1440/1024/390px 开关均在首屏。`migration.json` |
| A05 | 通过 | Chromium / WebKit 各三种宽度检查页面横向溢出与输入边界，保存实际截图。`*-ai-*.png` |
| A06 | 通过 | 焦点与 Space 操作开关、刷新读取实际保存值；本页没有折叠配置。`migration.json` |
| B01 | 通过 | AISettings 和 Provider 全字段映射见 `AUDIT.md`；非 AI 设置保持原表单与数据源，未改数据库结构 |
| B02 | 通过 | 合成历史 true/false 分别保留；删除历史 singleton 后 GET 默认 false 且不自动创建 opt-in。`migration.json` |
| B03 | 通过 | 开→关→开，provider ID、附件选择保留；密钥加密存储、编辑空密钥不覆盖原值。`cancellation.json`、`providers/report.json` |
| B04 | 通过 | 开关立即 PATCH、刷新数据库回读；相同 revision 并发更新仅一个成功，另一个 409。`migration.json` |
| B05 | 通过 | 浏览器拦截模拟写 503 与读 503，验证回退／禁用／重读；故障截图。未通过停正式数据库制造故障 |
| B06 | 通过 | 修改草稿后开关不会保存草稿；缺配置显示待配置；延迟保存期间禁止改输入，避免覆盖新草稿。`migration.json`、`review-regressions.json` |
| B07 | 通过 | 仍为部署工作空间 singleton；同源校验、跨页与多标签页状态回读；provider 停启无需刷新立即更新。`migration.json`、`review-regressions.json` |
| C01 | 通过 | 关闭后五条现有 HTTP 路径均返回 403，无上游请求；Entry、手动工作台、提取与连接测试均采用同一配置读取。`cancellation.json`、`providers/report.json`、`protocol/report.json` |
| C02 | 通过 | 重复请求排队后关闭，后续不再派发；连接测试 fallback 受同一 gate 限制。不存在后台 AI 调度器／自动重试 worker。`cancellation.json` |
| C03 | 通过 | Entry、工作台、连接测试、Protocol 提取处理中关闭，真实本地 HTTP 被取消；off→on 不复活旧请求；阻塞写入后停用 provider 产生 0 条建议。`cancellation.json` 与 `review-race-*.log` |
| C04 | 通过 | 页面打开、保存配置、开关操作均监视请求，未触发模型请求或历史扫描。`migration.json` |
| C05 | 通过 | 总开关关闭的连接测试返回 403；仅点击 Test 并实际完成测试后出现连接成功，配置完备只表示“已开启”。`providers/report.json` |
| C06 | 未验收（真实外部 API） | 本机模拟服务已走完 Entry 生成待处理建议及 Protocol 提取确认流程，但不能据此宣布真实模型通过。用户连接真实 API 后按下方步骤验收 |
| C07 | 部分通过，关联回归见 CI | 合成 Entry、附件、原建议不因关闭删除，普通 Entry 写入成功；计算器、Run、编辑器全流程由本 PR 对应 CI 单独验收，不以 AI 测试数量替代。正式数据一致性另见发布前后指纹报告 |
| D01 | 通过 | 两浏览器 × 三宽度截图、保存失败／读取失败／手机菜单，以及切换刷新数据库回读记录 |
| D02 | 通过 | 真实应用接口与独立数据库验证 gate；红绿日志保留明确失败原因。日志和截图不含真实凭据或研究正文 |
| D03 | 通过 | 本文、`AUDIT.md`、`REVIEW.md`、Git diff 与运行脚本构成文件映射／兼容／结果证据 |

生产 WebKit 曾重复报告 `/actions/review` 自动预取在导航取消时的错误；保留 `browser-production-first.log`，本机禁用 AI 页链接预取后通过；Linux CI 继续定位到手机公共导航的相同行为。最终仅在 `/ai` 禁用共享导航预取，并在两浏览器三宽度及手机更多菜单检查无 `_rsc` 请求；未过滤或忽略页面错误。前两次 CI 失败见 runs 38432940635、38434133211。

当前修复后已执行检查没有剩余失败项。历史 red 日志专门保留修复前的失败，不是当前失败。

## 自动检查与复跑

- TypeScript、Lint（0 error，12 条原有 warning）、生产 webpack build：`evidence/typecheck.log`、`lint.log`、`build.log`。
- Shanghai / UTC：各 118 文件、612 用例通过，见 `tests-shanghai.log` / `tests-utc.log`。
- 生产页面：`browser-production.log` / `migration.json`。
- 现有 provider 与 Protocol 工作流：`provider-regression.log` / `providers/report.json`、`protocol-regression.log` / `protocol/report.json`。
- CI：`.github/workflows/ai-provider.yml` 在独立数据库启动生产应用，顺序运行 provider、cancellation、migration、review-regressions。Protocol、编辑器、Entry、计算器和一致性工作流保持独立。
- 复跑脚本拒绝正式端口 3001 或不在白名单的数据库。Protocol 导入验收需新建合成数据库；不能复用已导入同名 fixture 的库，否则正确的重复导入检查会拒绝它。

## 待用户操作

1. 打开 `/ai`，在现有 DeepSeek 连接中填写真实 key 并保存，选择默认服务并保存功能设置，再打开总开关。
2. 点击 Test，确认真实连接成功；用不含研究秘密的测试 Entry 点击 Propose with AI，确认只产生待处理建议，正文未被自动改写。
3. 关闭总开关，再次尝试同一操作及 Test，确认受限；重新开启确认连接与附件选择仍在。
4. 物理手机打开同一局域网网址，检查开关和连接表单；本轮 390px 浏览器实测不代替物理手机测试。

没有实施真实外部模型请求、物理手机／软键盘、跨网络访问或证书受信任的 HTTPS 验收；不影响已验证的迁移与本机部署，但 C06 仍须真实 API 验收后才能关闭。
