# 全站正文编辑器修复与界面统一 — 验收记录

日期：2026-09-08。PR：https://github.com/annayzhu/LabNest/pull/67；问题：https://github.com/annayzhu/LabNest/issues/66。

## 版本与范围

- 基线：main `3d834d0b78e6cc6a4179c5aab495c7985b47bddc`。
- 核心修复：`f3596b6`；补充公开交互/PDF断言：`ba698a4`；打印尾页修复：`392eca9bf634595970d4c75990b0864b75fc59ae`。
- 最终本地生产构建与整套页面验收对应 `392eca9`，见 [acceptance.json](evidence/acceptance.json) 和 [构建日志](evidence/build.log)。后续提交仅保存说明、截图和验收产物。
- 隔离数据库 `labnest_editor66_acceptance`，全部为合成记录和生成的测试图片；没有回读、迁移或覆盖真实实验数据。原始附件存储、正文模型、不可变版本和历史快照逻辑继续复用。
- 本 PR 未合并、未部署正式环境。测试服务端口为 3227，正式服务未改动。

## 修复与证据

| 问题 | 修改位置 | 实际结果 |
|---|---|---|
| 中文候选确认回车被表单拦截 | `src/components/forms.ts` | 实验、结果实际表单模拟 composition Enter 和 Safari 229 均放行，普通 Enter 继续防止误提交；[事件结果](evidence/ime.json)。物理输入法另列未执行。 |
| 模板说明图片被外层 Protocol 截获 | `DocumentMediaUploads.tsx`、`ProtocolWysiwygEditor.tsx` | 粘贴/拖放按最近编辑器归属处理，嵌套点击不让外层抢占选择。公开粘贴用例曾失败，修复后保存/回读图片仍在 Instructions 内；[结果](evidence/template.json)。拖放单独交互未执行。 |
| 预览失败后无可恢复显示 | `ProtocolMediaImage.tsx`、`DocumentMediaView.tsx` | 请求故障注入：预览失败回退原图；两者失败显示明确错误，恢复网络后重试成功；[结果](evidence/image-recovery.json)。不据此推断用户原记录故障原因。 |
| 图片下方属性常驻 | `DocumentMediaNode.tsx`、`globals.css` | 非选中时仅图片与图注；选中出现紧凑工具条，尺寸/替换按需展开。键盘聚焦与 Enter 展开、文件选择替换后保存刷新通过；[结果](evidence/media-controls.json)。 |
| 打印正文被祖先隐藏，末尾空白页 | `globals.css` | 先复现隐藏祖先，再从 PDF 渲染发现隐藏控件/滚动容器占位。修复后标题、正文、目标图注与图像实际输出，14 文件/18 页没有空白页；[逐文件哈希/页数](evidence/pdf-final/files.json)。 |
| 元数据贴边/宽度不一致 | `globals.css` | 沿用 Protocol 间距参数，六入口元数据与上方导航边界对齐。实验在 1440/390 视口测量验证；其他入口截图核对；[测量](evidence/metadata.json)。 |

## 按入口验收

“通过”仅指下表明确列出的合成用例，不代表所有历史记录、所有格式或所有设备已覆盖。

| 入口 | 插图→保存→刷新→重新编辑→只读→PDF | 实际图片/图注/宽度 | 页面证据 |
|---|---|---|---|
| 实验 | 通过 | 通过，60%宽度回读；请求恢复和替换额外验证 | [桌面](evidence/experiment-editor-1440.png) · [手机](evidence/experiment-editor-390.png) · [只读PDF](evidence/experiment-view.pdf) · [编辑PDF](evidence/experiment-edit.pdf) |
| 研究计划 | 通过 | 通过，60%宽度回读 | [桌面](evidence/research-plan-editor-1440.png) · [手机](evidence/research-plan-editor-390.png) · [只读PDF](evidence/research-plan-view.pdf) · [编辑PDF](evidence/research-plan-edit.pdf) |
| 结果 | 通过 | 通过，60%宽度回读 | [桌面](evidence/result-editor-1440.png) · [手机](evidence/result-editor-390.png) · [只读PDF](evidence/result-view.pdf) · [编辑PDF](evidence/result-edit.pdf) |
| 报告 | 通过 | 通过，60%宽度回读 | [桌面深色](evidence/report-editor-1440.png) · [手机深色](evidence/report-editor-390.png) · [只读PDF](evidence/report-view.pdf) · [编辑PDF](evidence/report-edit.pdf) |
| Protocol | 通过 | 通过，60%宽度回读 | [桌面](evidence/protocol-editor-1440.png) · [手机](evidence/protocol-editor-390.png) · [只读PDF](evidence/protocol-view.pdf) · [编辑PDF](evidence/protocol-edit.pdf) |
| 随手记录 Entry | 通过 | 通过，60%宽度回读 | [桌面](evidence/entry-editor-1440.png) · [手机](evidence/entry-editor-390.png) · [只读PDF](evidence/entry-view.pdf) · [编辑PDF](evidence/entry-edit.pdf) |
| 结果模板说明 | 通过 | 通过；保存/读取/编辑时均明确断言图片位于嵌套说明内 | [桌面](evidence/template-1440.png) · [手机](evidence/template-390.png) · [只读PDF](evidence/template-view.pdf) · [编辑PDF](evidence/template-edit.pdf) |
| Run | 图片展示通过；不套用正文编辑链路 | 从实际 Protocol 步骤创建实验，桌面/手机 Step A 图片解码成功 | [结果](evidence/run.json) · [桌面](evidence/run-1440.png) · [手机](evidence/run-390.png) |

元数据截图：[实验](evidence/experiment-metadata-1440.png)、[研究计划](evidence/research-plan-metadata-1440.png)、[结果](evidence/result-metadata-390.png)、[报告深色](evidence/report-metadata-1440.png)、[Protocol](evidence/protocol-metadata-1440.png)、[Entry](evidence/entry-metadata-1440.png)。

## 测试与文件检查

- 完整单元测试：上海/纽约两个时区，各 104 文件、576 测试通过。对应核心实现 `f3596b6`；其后生产代码仅打印 CSS 调整。[上海日志](evidence/unit-shanghai.log)、[纽约日志](evidence/unit-new-york.log)。
- TypeScript 通过；生产构建通过。Lint 0 错误、11 项既有警告。[类型](evidence/typecheck.log)、[Lint](evidence/lint.log)。最终生产构建重新进行了类型检查。
- 最终页面套件 8 个行为阶段全部通过，且没有未捕获浏览器异常；数量不替代上方逐项结果。[总日志](evidence/acceptance-console.log)。
- 14 个 PDF 均检查标题、正文、对应图注、嵌入图像以及每页非空文本，再渲染检查目标蓝色 Editor 66 图片。最终 18 页：[渲染1](evidence/pdf-final/contact-1.png)、[渲染2](evidence/pdf-final/contact-2.png)、[渲染3](evidence/pdf-final/contact-3.png)。实验另有用于替换测试的 1×1 白色图片，空白区域不代表请求失败。
- `pdf-render/` 是发现空白尾页时的旧渲染；`pdf-final/` 才是最终结果。`*-red.log` 保留失败证据。早期模板测试只查整页图片，证据不足，已由嵌套归属断言替代。
- 屏幕视觉确认分两部分：前四入口使用 `ba698a4`，Protocol/Entry 使用 `392eca9`；两版本屏幕样式一致，差异仅打印样式。第一部分因选中隐藏嵌套节点导致截图脚本中止；改为可见图片定位后仅补完剩余入口，没有把脚本失败当作页面图片丢失。每入口桌面/手机无横向页面溢出。
- 远端编辑器与 Calculator CI 状态以 [PR checks](https://github.com/annayzhu/LabNest/pull/67/checks) 为准。本说明提交时最终证据提交的 CI 尚待运行，不预记通过。

## 失败与未执行

- **已知仍失败：** 最终上述自动化用例无失败。历史 red 和截图定位失败已说明原因与替代证据。
- **未执行：原始故障记录回读。** 缺少受影响记录链接/名称，不能确认其原图状态或宣称该反馈已关闭。
- **未执行：真机拼音输入法、软键盘、中英混输完整物理操作。** 模拟 composition 事件不等同完整 IME。桌面/手机截图为 Chromium 视口模拟。
- **未执行：系统打印对话框、真实打印机和非 Chromium 浏览器打印。** 已执行的是 Chromium 打印媒体与实际 PDF 文件验收。
- **未执行：旧 Run 脱敏记录、跨步骤排他归属、修改 Protocol 后回读既有冻结 Run、嵌套文件拖放、引用删除后的原文件保留专项。** 本批没有更改相关存储/快照算法；历史通过记录不能替代本次未执行项。

## 可重复运行与人工收尾

1. 准备独立 PostgreSQL 数据库 `labnest_editor66_acceptance`，设置 DATABASE_URL；附件目录也须隔离。安装项目依赖、Chromium 和 Poppler（`pdftotext`）。
2. 迁移该隔离库，构建生产版本并在 3227 启动。执行 `npm run test:editor-repair:e2e`，脚本拒绝其他库名/端口。每次新增合成记录，不清空既有数据。
3. 截图：`EDITOR_CHECK=visual node scripts/verify-editor-repair.mjs`；补充模板/Run：`node docs/editor-repair/capture-extra.mjs`。
4. 真机：在实验和结果正文插图，输入拼音、回车选词，再输入英文和中文，修改图注并保存。刷新、重新编辑、只读查看后核对内容；打开系统打印预览，确认标题/正文/图片完整且无空白尾页。
5. 原问题：拿到一条受影响记录后，回读正文引用并检查预览和原图请求，保留响应状态及浏览器截图，再判断请求故障、引用失效或原文件问题。
