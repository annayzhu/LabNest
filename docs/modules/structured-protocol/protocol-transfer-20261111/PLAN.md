# Protocol 跨 LabNest 迁移：选中导出，对方导入后自动编号

日期：2026-11-11
来源：用户需求（第 1 节）
基线：`main` 43498af1，开发目录与 `origin/main` 为 0/0
状态：用户 2026-11-11 回复“按推荐”。已实现（第 5 节），已在两套测试 LabNest 之间实测（第 6 节）。用户 2026-11-11 回复“验收通过，发布”。

## 1. 用户需求（2026-11-11）

> Protocol 中已经保存的文档，是否可以进行选择和导出，然后把这个导出的文件给别人，别人登录他们的 labnest，导入这个文件，就会出现自动编号的 protocol，能完整迁移 protocol 的参数和格式。

## 2. 现状（源码事实，未在两套 LabNest 之间实测）

已有的路径：Protocol 列表勾选 → 导出 → JSON；对方在 Protocol 列表 → 导入 → 选这个 JSON → 预览 → 确认。JSON 里带完整正文 `contentJson`（步骤块、参数块、体系、条件、配液卡、程序卡、来源），导入时原样读回，所以参数和格式本身能带过去。

跨 LabNest 时会出问题的地方：

| # | 问题 | 位置 |
|---|------|------|
| 1 | 编号不是自动生成。文件里带原编号：对方没用过这个号就沿用原号，用过就报“PRT-… already exists”，整条拦住 | `src/lib/structured-import.ts` 372–374、595 |
| 2 | 正文里有图片时导入失败。JSON 只存附件 ID，不带图片文件；对方库里没有这个附件，确认时报“部分附件不存在，正文未保存” | `src/lib/document-media.server.ts` 11 |
| 3 | 属于某个项目、或关联了研究方案的 Protocol 会被拦住：对方没有同名项目或方案编号就报错 | `src/lib/structured-import.ts` 378–385 |
| 4 | 详情页“导出 → JSON”是另一种格式（`schemaVersion: 1`，`protocol/version/document`），导入页读不了，会报缺标题 | `src/app/api/protocols/[id]/versions/[versionId]/json/route.ts` |
| 5 | `/api/exports/protocols.json` 是更早的全量导出，页面上已没有入口 | `src/app/api/exports/protocols.json/route.ts` |
| 6 | 只导出当前版本，历史版本不带；导入后一律是草稿、待审核 | `src/lib/structured-export.ts` 90、`protocol-import-state.ts` |

## 3. 开放问题与推荐

**Q438 文件形式。** 推荐：仍然是一个 JSON 文件，图片原件直接写进同一个文件里，发给别人只需要发这一个文件。导入时图片存成对方 LabNest 的附件，正文指向新附件。文件带格式版本号；对方 LabNest 版本太旧读不了时，预览里直接说“请先升级 LabNest”，不导入半份内容。

备选：zip 包（JSON + 图片文件夹）。文件更小，但多一种格式，导入页要多支持一种。

**Q439 编号。** 推荐：导入时一律用对方 LabNest 的下一个编号，不沿用文件里的编号，也不再因为编号重复报错。原编号、原版本号、来源文件名记在这条 Protocol 的“导入历史”里。同一个 LabNest 导入自己导出的文件，得到一条新编号的副本。

**Q440 项目和研究方案关联。** 推荐：跨 LabNest 导入时不带这些关联，Protocol 进入通用 Protocol 库；预览里说明一次“原属项目 ××，未带入”。对方库里恰好有同名项目也不自动挂上，由接收人自己决定。

**Q441 版本和审核状态。** 推荐：只带导出时的当前版本，版本号沿用（例如 1.2），历史版本不带。导入后是草稿、待审核，由接收人自己审核后启用（现状）。

**Q442 指向本机记录的内容。** 正文里的库存物品、样本标签，以及“相关项目／实验／结果／附件”，指向的是导出方库里的记录。推荐：标签保留当时写下的名称，变成普通文字，不留打不开的链接；“相关条目”不带。文献、网页等来源照常带过去。

**Q443 入口去重。** 推荐：
- 详情页“导出 → JSON”改为输出同一种可导入的文件，旧格式删除。
- 删除没有入口的 `/api/exports/protocols.json`。
- 导出页 JSON 的说明改成一句：可以发给别人，在他们的 LabNest 里导入。
- 列表勾选导出、导入页入口保持不变，不新增按钮。

## 4. 文件格式

列表导出和详情页导出写出同一种 JSON：

```json
{
  "schemaVersion": "labnest.structured-export/v1",
  "module": "protocols",
  "protocolTransferVersion": 1,
  "exportedAt": "…",
  "records": [{ "humanCode": "PRT-…", "canonicalTitle": "…", "displayVersion": "1.2", "contentJson": { … }, … }],
  "media": [{ "attachmentId": "…", "filename": "gel.png", "mimeType": "image/png", "sha256": "…", "base64": "…" }]
}
```

- `media` 是正文里所有图片和附件的原件。导入时存成对方的附件，正文里的附件 ID 换成新的。
- `protocolTransferVersion` 大于导入方支持的版本、或正文含导入方读不了的内容时，整条拒绝并提示先升级。
- 文件连同图片不能超过 25 MB（导入上限）；超过时导出直接报错并说明原因。

## 5. 实现

| 问题 | 做法 | 位置 |
|------|------|------|
| Q438 | 导出写入图片原件和格式版本；导入读出图片并校验 SHA-256；版本过新、内容读不了、图片缺失或损坏都在预览阶段拦住 | `src/lib/protocol-transfer.ts`、`protocol-transfer.server.ts`、`structured-files.ts`、`structured-import.ts` |
| Q439 | 所有格式（JSON、Markdown、Word）导入一律取本机下一个编号；文件里的编号写进导入日志，“导入历史”显示“原编号 PRT-… · v…”；预览里“实验规程编号”显示“导入时自动生成（文件中为 PRT-…）”，不可编辑 | `structured-import.ts`、`structured-import-edits.ts`、`protocol-import-history.ts`、`ProtocolImportHistory.tsx` |
| Q440 | LabNest 导出文件导入时不读项目、范围、研究方案，进入通用库，预览里说明一次原属项目；接收人在预览里自己填了项目的，按他填的来 | `structured-import.ts` |
| Q441 | 只导出当前版本（详情页导出的是正在看的版本），版本号沿用，导入为草稿（未改动原逻辑） | `structured-export.ts` |
| Q442 | 指向原 LabNest 页面（`/samples/…`、`/inventory/…`、`/experiments/…` 等）的链接去掉链接、保留文字，预览里说明处数；“整理自哪些实验／识别来源”不带；相关条目存在别的表里，本来就不在文件中；文献和网页来源照常带 | `protocol-transfer.ts` |
| Q443 | 详情页“导出 → JSON”改为同一种文件（说明改为“可导入的文件，含图片”），旧格式删除；删除 `/api/exports/protocols.json`；导出页 JSON 说明改为“一个文件，含完整正文和图片。发给别人，在他们的 LabNest 里导入。”；没有新增按钮 | `api/protocols/[id]/versions/[versionId]/json/route.ts`、`ProtocolExportMenu.tsx`、`StructuredExportWorkspace.tsx` |

顺带改动：
- 旧版本（没有正文文档、只有字段）的 Protocol 导出时先转成文档再写入文件。
- `scripts/verify-protocol-consistency.mjs` 读详情页 JSON 的两处改为新格式（`records[0].contentJson`）。
- “来源与依据”的类型标签和修订标签字号原为 10.4 px，改为不小于 12 px（`protocol-knowledge.css`）。检查脚本量字号时发现。
- 预览里记录的标题不再带编号（编号此时还没有）。

## 6. 验证（2026-11-11，基线 43498af1 + 未提交改动）

环境：A = 3006，库 `labnest_transfer_a_20261111`（day-record 测试库的副本，加一条合成 Protocol PRT-200005）；B = 3007，库 `labnest_transfer_b_20261111`（只有表结构，预先放一条同为 PRT-200005 的合成 Protocol），两边附件目录分开。

合成 Protocol：项目范围、关联研究方案 RP-901、两个版本（1.1、1.2）、体系和 6 个条件维度、正文图片 1 张、表格单元格图片 1 张、配液卡、程序卡、3 处指向本机记录的链接、1 条 DOI 来源、长标题。

| 项 | 结果 |
|----|------|
| 单元测试 | 新增 `protocol-transfer.test.ts` 10 项；全量 246 个文件、2092 项通过，7 项跳过 |
| 类型检查、lint | 通过（`.next/types` 里一条与本次无关的旧报错；lint 4 条旧警告） |
| 页面路径 `scripts/verify-protocol-transfer.mjs` | 7 项全部通过：A 列表勾选 2 条 → 导出 → JSON；A 详情页导出；B 预览；B 确认导入；B 页面与正文比对；B 导入历史；同一文件再次导入被拒绝 |
| 文件 | 2 条记录、2 张图片，288,497 字节 |
| 编号 | 文件中 PRT-200005、PRT-200004；B 原有 PRT-200005 不变，新得 PRT-200006、PRT-200007（首次导入） |
| 正文比对 | 导入后的 `contentJson` 与原文相比只有 5 处不同：`provenance` 去掉、3 处本机链接变文字、2 个附件 ID 换新；体系、条件、参数、配液卡、程序卡、表格完全一致 |
| 图片 | B 的附件目录里有两张原图；页面上两张图原始尺寸 900×520，1440 宽下显示 331×191 和 105×61（B 实测）；与 A 的截图对照位置和大小一致 |
| 导入结果 | 草稿、通用、无项目、无研究方案、只有 1 个版本（1.2）；导入历史显示“原编号 PRT-200005 · v1.2” |
| 字号和滚动 | 导出页、Protocol 页、导入预览在 1366×768、1440×900、1920×1080 下最小字号 12 px，无横向滚动条 |
| 异常文件（接口预览） | 旧格式导出（无图片）→“有图片不在文件里”；版本更新的文件 →“由更新版本的 LabNest 导出”；图片损坏 → 拒绝；缺一张图片 → 拒绝；未知内容块 →“还读不了的内容”；手写 JSON 带已存在的编号 → 可导入、编号自动生成 |
| 其他格式 | Word 模板、Markdown 导出文件的预览正常；Markdown 仍按文件里的项目名关联本机项目 |

截图在 `evidence/`：`a-export-*`、`a-protocol-*`、`b-import-preview-*`、`b-import-preview-record-*`、`b-import-preview-notes-1440`、`b-protocol-*`、`a-protocol-part-*` 与 `b-protocol-part-*`（图片、配液卡、程序卡对照）、`b-import-history-1440`、`b-import-again-1440`，以及 `browser-report.json`。

未验证或不满意的地方：
- 没有在平板和手机宽度下看；这次没有改布局。
- 没有旧版本（只有字段、没有正文文档）的测试数据，这条导出路径只过了类型检查。
- 超过 25 MB、图片原文件丢失这两种导出失败，浏览器里看到的是一段 JSON 报错，不是页面上的提示。
- 导入预览里标签显示成 `["合成","迁移测试"]`，是原有显示方式，没有改。
- 导入后版本说明是英文“Imported from JSON.”，原有文案，没有改。
- 已发布的旧版 LabNest（3001 当前版本）导入新文件时不认识图片，带图片的会失败；两边都要升级到这一版。

## 7. 发布前审查（2026-11-11）

用户授权发布后，请一个没看过开发过程的审查者只读检查这批改动，重点是会不会丢内容。没有发现来回导入会丢内容的问题；发现的 6 处都在发布前改掉：

| # | 问题 | 处理 |
|---|------|------|
| 1 | 含本机读不了内容的版本，XLSX 和 Markdown 导出的材料、步骤等文字列变成空的（这次改动引入的回归） | 文字列仍按能读出的内容导出；`contentJson` 保持原样 |
| 2 | “链接变文字”匹配得太宽：正文里任何形如 `[x](/y)` 的文字都会被改，代码样式的文字也会 | 只认记录和附件页面的地址（`/samples/<id>`、`/inventory/<id>`、`/experiments/<id>` 等）；代码样式和代码块里的文字不动；每套 LabNest 都有的页面（`/inventory/list`、`/protocols/new`）不动 |
| 3 | 接收人在预览里只填了项目、没改范围时，项目被悄悄忽略；预览里新增的记录也被当成对方文件里的记录 | 填了项目就按项目范围导入；预览里新增的记录按填写的内容处理 |
| 4 | 另外三个旧检查脚本还在读详情页 JSON 的旧格式 | 已改为新格式或直接读库；其中“同一 Protocol 再导入必须报编号重复”的断言按 Q439 改成“可以导入” |
| 5 | 文件里同一张图片列两次时会多存一份没人用的附件 | 这样的文件在预览阶段拒绝 |
| 6 | 导出时遇到读不了的图片信息，报错不说是哪条 Protocol | 报错带上 Protocol 编号 |

审查确认没有问题的部分：Word、Markdown、手写 JSON 的导入除了自动编号以外没有变化；其他模块的导入不受影响；文件名不会造成越权写文件；图片类型不在允许内联的范围时只能下载，不会被当成网页打开；一张图被两条记录共用或用两次，只存一份并分别关联；预览里移除的记录，它的图片不会存。

没有核实的一点：表格单元格里如果有“记录标签”节点（Protocol 编辑器目前不提供这个入口），导入时会按“有读不了的内容”整条拒绝，不会导入半份。

这三个旧脚本（`verify-structured-protocol-authoring.mjs`、`verify-protocol-consistency.mjs`、`verify-protocol-import-state.ts`）依赖各自当年的测试库和样例文件，这次只改了读取方式，没有重新跑。
