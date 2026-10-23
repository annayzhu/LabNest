# AI 连接测试 v1.1 验收

基线 main：`260fd749778dcc809ef8e1ea68106412435415cc`。最终应用源码：`7c78d7092096e95893589d153b8773119fcb6233`。PR：[LabNest #98](https://github.com/annayzhu/LabNest/pull/98)。后续提交仅补充验收证据；合并及正式发布状态以 PR 和部署回执为准。

本轮保留 PR96 的 AI 迁移及 PR97 的结构化规程功能，新增草稿连接测试、中文字段解释、实际模型生成验证、错误分类、目标变更密钥保护、测试取消及修订检查。无数据库结构迁移。全部写入验收使用独立 PostgreSQL 库 `labnest_ai_connection_20261014` 与合成记录；只将外部服务替换成本地 HTTP 模拟，不访问真实密钥或研究内容。

## 逐项结果

| 编号 | 结果 | 实际验证与证据 |
|---|---|---|
| A01 | 通过 | 桌面/手机导航与 AI 标题；建议记录保留。`evidence/regression/migration.json` |
| A02 | 通过 | Settings 无第二套 API 表单，AI 设置链接可达。migration |
| A03 | 通过 | `/actions`、Settings 两个旧锚点、provider 查询和审核筛选链接逐一打开。migration |
| A04 | 通过 | 关闭时仍可进入；三种宽度总开关在首屏。migration |
| A05 | 通过 | Chromium/WebKit，1440/1024/390px，明暗页面检查文档与输入边界并截图。`draft-report.json`、`*-light-*.png`、`*-dark-*.png` |
| A06 | 通过 | 键盘 Space 切换、焦点和刷新回读；本页无需折叠。migration |
| B01 | 通过 | 原字段映射沿用 `../20261014/AUDIT.md`；单一 AISettings/AIProvider，非 AI 设置未改。Git diff；部署数据指纹另见发布回执 |
| B02 | 通过 | 合成旧设置 true/false 保留；无记录 GET 默认关闭，不自动授权。migration |
| B03 | 通过 | 关闭再开保留 provider/附件选项；加密保存、空密钥同目标编辑保留密文。`adapters/report.json`、`regression/cancellation.json` |
| B04 | 通过 | 即时保存/刷新，并发同 revision 仅一个更新成功。migration |
| B05 | 通过 | 模拟读取及保存 503，禁用/回退/重读，不误报开启。migration，读写失败截图 |
| B06 | 通过 | 切开关不提交草稿；延迟保存期间输入保护；缺配置有提示。migration、`review-regressions.json` |
| B07 | 通过 | 沿用工作空间范围、来源校验、多页同步；provider 停启即时更新。migration、review-regressions |
| C01 | 通过 | 原五条 AI HTTP 路径及新增草稿端点关闭时无上游请求。cancellation、draft-report |
| C02 | 通过 | 排队重复任务、关闭限制和服务端 gate；现有架构无独立后台 AI worker。cancellation |
| C03 | 通过 | Entry/工作台/测试/提取处理中关闭，取消 HTTP、阻止晚返回发布；off→on 不恢复旧任务。cancellation |
| C04 | 通过 | 打开页面、保存配置、启用开关不扫描历史、不发送附件或自动推理。migration、draft-report |
| C05 | 通过 | 卡片与草稿测试均受总开关；“配置齐备”不表示真实模型正常。adapters、draft-report |
| C06 | 未验收：真实外部 API | 原 Entry 生成→待处理建议、手动工作台、Anthropic/Dify 业务已通过实际应用+模拟服务；真实 DeepSeek/AIHub 等尚未调用。不得用模拟成功关闭该项 |
| C07 | 通过（本地相关路径）；全站以独立 CI 为准 | 关闭后合成记录仍在，普通 Entry 保存正常，待处理建议未被自动应用。adapters；本 PR Calculator/Entry/Protocol/编辑器独立 CI 不由 AI 用例数替代 |
| D01 | 通过 | 两浏览器三宽度明暗截图；开关、刷新、故障恢复均实际操作。evidence |
| D02 | 通过 | HTTP 请求计数、固定消息、数据库回读、发布取消记录；全部假密钥。evidence 与验收脚本 |
| D03 | 通过 | 本文、AUDIT、REVIEW、SPEC、skills.json、Git diff；正式合并/部署/清理以发布回执补充 |
| E01 | 通过 | 中文标签与协议说明；Dify 模型只为说明；手动模式隐藏联网字段。draft-report |
| E02 | 通过 | DeepSeek 快捷配置地址/flash 原样保留，可填 V4 Pro ID；明确另行选默认并保存。draft-report |
| E03 | 通过 | 添加、编辑、卡片均有测试；关闭/停用明确禁用原因；无需先选默认。adapters、draft-report |
| E04 | 通过 | 当前草稿发起请求；前后 provider/Entry/Experiment/ProposedAction 数量及 AISettings 完整值一致。draft-report |
| E05 | 通过 | 原目标空密钥复用；新 key 未保存可测试；切换地址/协议清空已输入 key；旧密钥目标/版本双检查；响应脱敏。draft-report、unit |
| E06 | 通过 | 模型列表可达但模型报错不算成功；HTML/空对象/空正文拒绝；无需 `/models`；返回模型与请求不同明确显示。draft-report、unit |
| E07 | 通过（协议模拟） | 固定消息、OpenAI/兼容/Anthropic 各自输出限制与总超时；鉴权、余额、模型、403、404、429、500、网络/超时分类。`ai-connection.test.ts`、unit；真实服务兼容性待验收 |
| E08 | 通过 | 重复点击禁用、编辑取消、主开关取消、服务其他页变更拒绝、焦点刷新停用陈旧表单。draft-report |
| E09 | 通过 | 固定无业务文本；Dify `/chat-messages` 生成，不冒充模型列表健康；手动草稿不联网；原业务回归 28 项。draft-report、adapters |
| E10 | 通过（证据边界） | 明确区分模拟/静态/真实 API；三套技能实际使用和来源 hash 见 AUDIT/skills/REVIEW；真实服务未验收 |

## 可重复验证

- `npm run typecheck`，`npm run lint`（0 错误、12 项原有警告）。
- `TZ=Asia/Shanghai npm test` 与 `TZ=UTC npm test`：各 123 文件、642 项通过。
- 生产构建日志 `evidence/build.log`。本机实际生产服务端口 3338；Docker 候选镜像从干净的上述 Git 提交构建，构建及发布回执单独记录。
- 按顺序运行 `scripts/verify-ai-provider-adapters.mjs`、`verify-ai-switch-cancellation.mjs`、`verify-ai-module-migration.mjs`、`verify-ai-review-regressions.mjs`、`verify-ai-provider-draft.mjs`。必须使用脚本允许的独立合成数据库；正式 3001 禁止用于这些写入用例。
- 结果：原业务 28 项，取消保护 8 项，入口/保存迁移 29 项，旧问题回归 2 项，新草稿连接及页面 33 项，规程上传/提取/确认/回读 9 项。每个 JSON 都有逐项结果；数量不替代其实际操作。
- CI 已加入新草稿脚本，保留原双时区、构建及其他独立工作流。最终结论查看 PR 对应最新提交的 Checks。

## 失败记录和限制

红灯日志 01/03/05/07 记录修复前问题。浏览器日志 10 包含测试侧数据库时区读取误差；改为读取表单实际 revision 后解决。12–18 的 WebKit 强制二次导航访问控制报错，在实际“保存→点击编辑”路径不复现；未过滤 pageerror，另保留刷新测试。定位依据及上游问题见 AUDIT。Protocol AI CI 首轮因旧英文按钮定位失败（run38504514429），更新中文定位后本机完整提取流程 9 项通过；最新 CI 另行确认。最终本机执行结果中无未修复失败；真实外部 API 不在“通过”范围。

未执行：真实 DeepSeek/AIHub/Qwen/OpenAI/Anthropic 账号调用、余额/权限实测；物理手机软键盘；跨网络和受信任 HTTPS。390px 浏览器不代表真实手机验收。这些不阻止本轮本地功能发布，但 C06 与真实服务兼容性仍待用户验收。

## 用户验收步骤

1. 打开 `/ai`，开启“启用 AI”，点击“使用 DeepSeek”。
2. 填入真实密钥；按账号填写精确模型 ID，使用 V4 Pro 时填 `deepseek-v4-pro`。
3. 在表单内点击“测试连接”，查看本次结果；测试不会保存。随后“添加服务”。
4. 在“默认使用的 AI 服务”选择该连接，再点“保存功能设置”。
5. 用不含私密研究数据的测试 Entry 发起现有 AI 操作，检查只产生待处理建议；关闭 AI 后确认不能再次调用。

已有连接可点击“编辑”，同一目标密钥留空保留；更换目标/协议须重新填入密钥。不要把真实密钥发到聊天或截图。
