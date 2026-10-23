# Assessment B — Detector / Browser Evidence

Method: isolated Assessment B (`/root/structured_ui_evidence_b`); 未读取 Assessment A 的分析、报告或结论。仅与父代理协调共享浏览器视口。

日期：2026-10-14。检查模式：只读界面复核，不修改应用代码，不提交规程、实验或执行记录。

## 范围与来源

- 三个目标：`src/components/ProtocolSystemsEditor.tsx`、`src/components/RunSystemPreparation.tsx`、`src/components/StructuredStepRecord.tsx`。
- 视觉依据：当前 `PRODUCT.md`、`DESIGN.md`、`ProtocolSystems.css`、共享 Button 与实际计算样式；本界面属于 Operate。
- 实看服务：父任务提供的隔离生产构建 `http://localhost:3339`。
- Run：`/experiments/cmv7ghlmp000846osj0h5b46v/run`，对应 `evidence/fixtures.json` 的 EXP-037。
- 编辑器：从对应 Protocol 详情的 **Edit Protocol** 链接进入 `/protocols/cmv7ghllf000646os6vbc2qb2/versions/cmv7ghlli000746os6vjks36e/edit`，展开体系设置，查看参数页签。
- 新建独立 IAB tab；桌面实看 1280 × 720，手机实测 390 × 844。没有复用另一代理的标签页。
- 补充截图：既有 `final-run-light/dark-1440/390.png` 属于 `browser-report.json` 中 EXP-041，不是本次 EXP-037；仅用于同一功能的深浅主题与执行记录布局补充观察。未把既有自动化报告当作本代理重新执行的测试。

## 自动检测

原有 `evidence/impeccable-detector.json` 内容为 `[]`，但没有命令或目标范围元数据。父代理确认无法核对原命令，明确要求补一次三个组件的限定扫描。本代理只运行以下一次；未扩大到全仓库，也未反复扫描：

```text
node /Users/annayzhu/.agents/skills/impeccable/scripts/detect.mjs --json src/components/ProtocolSystemsEditor.tsx src/components/RunSystemPreparation.tsx src/components/StructuredStepRecord.tsx
```

- Impeccable skill：4.1.1；Node：v22.23.1。
- 结果：退出码 **0**，JSON **[]**，发现 **0**，规则名称与发现文件位置均为空，stderr 为空。
- 输出：`evidence/impeccable-detector-b.json`。
- 命令、时间、三个目标文件 SHA-256、入口文件 SHA-256：`evidence/impeccable-detector-b-meta.json`。
- 误报：无可归类误报，因为没有返回 finding。
- 边界：TSX 采用静态模式匹配；没有浏览器注入检测。结果不证明触摸尺寸、完整 ARIA 交互、可访问名称或所有主题均合格。

## 浏览器证据

| 检查 | 观测结果 | 证据 |
|---|---|---|
| Run 390px 重排 | 两个选择框与输入单列，page scrollWidth 375 ≤ viewport 390，没有页面级横向溢出 | `review-b-run-mobile.jpg/json` |
| Run 桌面准备区 | 体系选择并排，实际输入、参数表、来源、计算器分层显示；已确认状态与确认时间可见 | `review-b-run-desktop.jpg`、AX |
| 当前体系色彩 | 色彩旁有完整“维度：选项”文本与形状；未仅靠颜色传意 | `review-b-run-mobile.json` |
| 局部对比 | 当前体系文字 #315d78 / 白底 **7.08:1**；预设按钮文字 **7.38:1**；输入文字 **14.54:1** | `review-b-contrast.json`，由实测 RGB 计算；不是全页面认证 |
| 编辑器控制尺寸 | 页签 44px 高，条件删除图标 44 × 44；部分小按钮仅 32px 高 | `review-b-editor.json` |
| 编辑器焦点 | 参数页签有可见蓝色焦点边框；ArrowRight 后焦点与选中页签仍停在“参数” | `review-b-tab-keyboard.json`、实看 screenshot |
| 保存的实际值 | AX 显示“实际 Proteinase K”50，完成状态下输入 disabled；保存时间与单位在可视标签中 | 当前 Run AX；既有 1440px 执行截图补充 |
| 深浅主题 | 既有四张截图中，实验体系、步骤标题、用量与状态可辨；附件原图保留自身浅底 | 既有 `final-run-*.png`；未实测深色全部文本对比 |
| 页面 console | 本次 tab 捕获的 error 列表为空 | CUA `tab.dev.logs({ levels: ['error'] })`；不等同于全生命周期无错误 |

## 独立发现与优先级

### B1 — [P2] 已确认准备区仍占用手机约一屏以上，操作入口被推迟

在已确认状态下，390 × 844 页面中的 `.protocol-system-preparation` 高 **1016.34px**，从 y=226.83 到 y=1243.17；该区域保持全部展开，第一屏仍停留在参数表上部。日常打开已确认 Run 时，研究者必须先越过体系、参数表、计算器才能到操作步骤。不是溢出或数据缺失，但明显增加重复执行时的滚动。

建议：确认后默认显示体系摘要、采用时间与“查看／变更准备”展开入口；待确定或预览变更时展开详细信息，保留可见的未保存提示。关联：`RunSystemPreparation.tsx:30`、`:37`、`:52`。建议命令：`$impeccable distill`。

### B2 — [P2] 手机关键体系选择仍有 32px 高按钮

390px 实测“350 µL · 普通样本”“600 µL · 高脂样本”按钮为 **115.73 × 32px**；两个选择框与实际输入为 **40px** 高。编辑器的“添加条件”“删除参数”等也为 32px 高，而条件删除图标与页签已经达到 44px。规则应用不一致，湿实验场景与单手触屏容易误触。

建议：对体系准备和结构化记录的小按钮设移动端最小 44px 触摸高度，保持文字与界面密度；不必改变全站桌面小按钮。关联：`RunSystemPreparation.tsx:33`、`ProtocolSystemsEditor.tsx:56`、`StructuredStepRecord.tsx:37`；后者保存按钮在本 fixture 完成状态未呈现，32px 来自共享样式，不声称已实际点击验证。建议命令：`$impeccable adapt`。

### B3 — [P2] 实际数值输入的可访问名称丢失单位与必填信息

视觉标签显示“目标终浓度 · µM”“实际 Proteinase K · µL · 必填”，但 `aria-label` 仅为参数名称，覆盖了外层 `<label>`。AX 实际返回的名称也是“目标终浓度”“实际 Proteinase K”；required 状态没有传给输入。读屏用户不能从控件名称获得本次填写的单位、必填要求。

建议：采用完整可访问 label，并用 `required`/`aria-required` 表达必填；必要时用 `aria-describedby` 引用单位和保存状态。避免只留下 `{field.label}` 的 aria-label。关联：`RunSystemPreparation.tsx:35`、`StructuredStepRecord.tsx:35`。建议命令：`$impeccable harden`。

### B4 — [P2] 页签宣告 tab 语义，但未提供对应键盘模式和面板关联

三个按钮都有 `role="tab"` 与 `aria-selected`，但全部 `tabIndex=0`，没有 `aria-controls`，页面没有 `role="tabpanel"`。聚焦“参数”按 ArrowRight，选中页签与焦点均不变。Tab + Enter 仍能访问，因此不是操作阻断；问题是读屏与键盘用户预期的页签行为不一致。

建议：补 roving tabindex、方向键/Home/End、tab/tabpanel id 关联，或明确改成普通的分区切换按钮。关联：`ProtocolSystemsEditor.tsx:50`。建议命令：`$impeccable harden`。

### B5 — [P2] EN 模式下新增控制文案仍全为中文

本次浏览器保留当前 EN 模式，外层显示 Runs / Edit Protocol / Save Protocol；新增组件同时显示“实验准备／体系选择／保存实际值／跳过操作”等中文。用户提供的规程名与样本名可以保留原文，但产品固定控件应服从语言设置。三个目标组件中的这些文案是硬编码。

建议：将固定控件、状态和错误引导接入现有语言机制，用户内容仍保持原文。建议命令：`$impeccable clarify`。

### B6 — [P3] 当前体系标签略小于设计体系的界面字号底线

390px 实测 `.protocol-system-choice` 为 **11.7px**（`.9em × 13px`），比 `DESIGN.md` 界面最小 12px 略小。对比度足够，所以不是低对比问题。建议改用最小 12px 的语义字号，特别是持续显示的执行体系摘要。关联：`ProtocolSystems.css` 的 `.protocol-system-choice`。建议命令：`$impeccable typeset`。

## 未发现或未证明的事项

- 本次限定观察没有发现 P0/P1 阻断；不据此替代数据完整性或业务验收。
- 实际值有视觉单位，参数来源明确，完成／待确定／跳过通过文字表达。没有把这些正确表现误报成“完全缺少标签”或“仅颜色表达状态”。
- 不把已完成输入的禁用、原图浅底、测试规程的长 ID 认定为新增组件缺陷。
- 没有修改选项、实际值、跳过原因，没有点击保存、确认、完成、计时器或删除；服务器拒绝／恢复错误状态沿用主任务其他证据，本复核不宣称再次测试。
- 未完成屏幕阅读器实际朗读、200% 缩放、所有主题全元素对比、编辑器390px全流程测试；上述发现仅使用已说明的实测与源码证据。

## 注入、清理与限制

- target slug：`src-components-protocolsystemseditor-tsx`（storage helper 实际解析成功）；本文件是 B 的输入报告，合并 snapshot 和 trend 由父任务处理。
- ignore list：`.impeccable/critique/ignore.md` 不存在，没有过滤发现。
- 独立性：未查看 A 内容，只协调共享 IAB viewport 的使用时间。
- browser visibility：实测 `false`，保持后台；没有宣称存在 `[Human]` 展示页。
- mutable preflight / overlay：**未执行**。文档明确 `playwright.evaluate` 是只读页面范围，未尝试设置 title 或添加 script，也未绕过限制。
- browser detector console：**未执行**，不能把空 error 日志当成 Impeccable 浏览器扫描通过。
- fallback：实际截图、AX、只读 DOM 几何／计算样式、源码与有范围元数据的 CLI 结果。
- Impeccable live-server：未启动，因此无该进程清理任务。`:3339` 是父任务持有的已有验证服务，本代理没有停止；最终服务清理由父任务负责，不能报告为已关闭。
- 390px override：已 reset；独立临时 tab：已 close。未创建临时转存脚本；截图、JSON 作为正式证据保留。
- Questions skipped: 本代理只提供隔离 Assessment B，综合提问与后续选择由父任务负责。

## 本次新增证据索引

- `evidence/impeccable-detector-b.json`
- `evidence/impeccable-detector-b-meta.json`
- `evidence/review-b-run-desktop.jpg`
- `evidence/review-b-run-mobile.jpg`
- `evidence/review-b-run-mobile.json`
- `evidence/review-b-editor-parameters.jpg`
- `evidence/review-b-editor.json`
- `evidence/review-b-tab-keyboard.json`
- `evidence/review-b-contrast.json`
