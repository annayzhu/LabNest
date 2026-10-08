# 方案 2：Protocol DOCX 导入的 AI 结构化抽取

编制日期：2026-10-08。状态：执行方案，尚未开发。前置：第 1 项（真实模型适配器）已合入，`resolveConnectedAdapter()` 可用。

## 一、目标

用户导入 Protocol DOCX 时，在现有"预览 → 确认"两步之间插入一个可选的 AI 抽取步骤：模型阅读已解析的文档文本，提出**参数、步骤执行属性、耗材规则、结果模板字段**的结构化建议；用户逐项采纳后，采纳项随确认请求写入新的 `ProtocolVersion`。不采纳则导入结果与现状完全一致。

要解决的真实痛点（来自代码现状，见二）：

- 当前导入**从不写入 `parametersJson`**，协议参数全靠事后手填。
- 耗材规则、结果模板、步骤角色都靠表头与关键字启发式猜测；猜错时只有 `executionNeedsReview` 一个总开关。

## 二、代码现状（2026-10-08 核对）

| 环节 | 位置 | 要点 |
|---|---|---|
| 导入页 | `src/app/protocols/import/page.tsx` → `src/components/StructuredImportWorkspace.tsx` | 共享的客户端工作区；`preview` 状态、`confirmImport()`（:201-210）提交 `file / mapping / checksum / confirmationToken` |
| 预览 API | `src/app/api/structured-import/[module]/preview/route.ts` | `parseStructuredFile` → `validateStructuredImport` → `createImportConfirmation` |
| 确认 API | `src/app/api/structured-import/[module]/confirm/route.ts` | 重解析、校验 checksum 与确认令牌、建 Attachment、`commitStructuredImport` |
| 解析 | `src/lib/protocol-docx.ts`（`ParsedProtocolDocx` :25-46，`parseProtocolDocumentXml` :163-330） | 输出 `document: ProtocolDocument` 与 description/purpose/background/materials/equipment/steps/resultTemplates/consumptionRules；**没有 parameters 字段** |
| 派生 | `src/lib/protocol-document.ts` `projectProtocolDocument` :422-535 | 从 Material/Result/Consumption 表启发式推导；`src/lib/protocol-execution.ts` `proposeExecutionRoles` 猜步骤角色 |
| 写库 | `src/lib/structured-import.ts` `commitStructuredImport` :513，协议分支 :549-566 | 一次 `protocol.create` 嵌套 `versions.create`，写 materials/equipment/steps/resultTemplates/consumptionRules/contentJson；`parametersJson` 未写 |
| 确认令牌 | `src/lib/structured-import-confirmation.ts` | HMAC-SHA256 签 `{module, format, fileName, checksum, decisions, mapping, expiresAt}`，30 分钟有效 |
| 数据形状 | `src/lib/types.ts` `ProtocolParameter` :31、`ProtocolStep` :48、`ConsumptionRule` :58、`ResultTemplate` :145 | 纯 TS 类型；zod 仅有 `resultTemplateInputSchema`（`result-templates.ts:108`）、`protocolDocumentSchema` |
| 公式 | `src/lib/protocol.ts` `evaluateFormula` :227 | 可用来验证 AI 给出的耗材公式是否能对参数求值 |
| 审核 UI | `StructuredImportWorkspace` `PreviewPanel` :300-350、`PreviewRecord` :363 | 只读展示；唯一可编辑的事后审核是 `ProtocolExecutionOrganizer` |

结论：没有现成的"逐字段采纳"界面，也没有触碰协议定义的 `ProposedActionType`。本方案**不扩展 ProposedAction**，而是把 AI 建议作为导入确认请求的一部分签入确认令牌，复用现有防篡改机制。

## 三、设计

### 3.1 数据流

```mermaid
flowchart LR
    A[DOCX 预览解析] --> B[用户点击 AI 抽取]
    B --> C[/api/structured-import/protocols/ai-extract]
    C --> D[模型返回 ProtocolExtractionProposal]
    D --> E[zod 校验 + 公式求值 + 与启发式结果比对]
    E --> F[预览页逐项采纳]
    F --> G[confirm 请求携带 acceptedExtraction 并签入令牌]
    G --> H[commitStructuredImport 合并写入 ProtocolVersion]
```

### 3.2 发送给模型的上下文（显式、最小）

- 文档各节的纯文本（由 `ProtocolDocument.sections[].blocks` 展平；表格转为 Markdown 表），不含嵌入图片、不含附件二进制。
- 当前启发式已得到的 materials、steps 标题、consumptionRules、resultTemplates，作为"已识别内容"供模型补全而非重复。
- 允许的参数类型枚举、耗材规则公式语法说明、结果模板字段类型枚举。

### 3.3 模型输出：`ProtocolExtractionProposal`

```ts
type ProtocolExtractionProposal = {
  parameters: { name: string; type: "number"|"text"|"select"|"entity"|"boolean"; default?: string|number|boolean; unit?: string; required?: boolean; options?: string[]; evidence: string }[];
  consumptionRules: { material_name: string; formula: string; unit: string; requires_inventory_selection?: boolean; evidence: string }[];
  stepAttributes: { order: number; requires_confirmation?: boolean; allows_deviation?: boolean; timer_minutes?: number; evidence: string }[];
  resultTemplateFields: { template_title: string; fields: { key: string; label: string; type: string; unit?: string }[]; evidence: string }[];
  warnings: string[];
};
```

每项必须带 `evidence`（原文片段），前端展示时高亮来源；没有 evidence 的项直接丢弃。

### 3.4 服务端校验（拒绝优先）

1. zod 校验整体结构（新增 `protocolExtractionProposalSchema` 于 `src/lib/validation.ts`）。
2. `consumptionRules[].formula` 用 `evaluateFormula` 以参数默认值试算；失败的规则标记 `invalid` 并给出原因，不可采纳。
3. `consumptionRules[].material_name` 必须能匹配启发式 materials 或文档文本中出现的名称，否则标记 `unmatched`。
4. `stepAttributes[].order` 必须存在于已解析 steps。
5. 与启发式结果重复的项标记 `duplicate`，默认折叠。

### 3.5 采纳与写入

- `StructuredImportWorkspace` 的 `confirmImport()` 增加 `acceptedExtraction`（只含用户勾选的项）。
- `createImportConfirmation` 的签名内容增加 `extractionHash`（采纳集合的 SHA-256）；用户改动勾选后令牌失效，与现有"预览已变更"行为一致。
- `commitStructuredImport` 协议分支：
  - `parametersJson` ← 采纳的 parameters；
  - `consumptionRulesJson` ← 启发式结果 ∪ 采纳规则（按 material_name 去重，采纳项优先）；
  - `stepsJson[i]` 合并 `requires_confirmation / allows_deviation`；
  - `resultTemplatesJson` 合并字段；
  - `changeSummary` 追加 "AI-assisted extraction: n accepted / m rejected"；
  - `activityLog.metadataJson.protocolImport.ai = { provider, model, promptHash, accepted, rejected, invalid }`。
- 不改 `ProtocolVersion` 表结构。`sourceType` 仍为 `docx_import`。

### 3.6 界面

- `PreviewRecord` 内新增 `ProtocolExtractionPanel`（客户端组件）：
  - 未连接模型时按钮禁用并提示到设置页；
  - 四个分组（参数 / 耗材规则 / 步骤属性 / 结果模板），每项一个复选框 + 原文证据 + 状态徽标（ok / invalid / unmatched / duplicate）；
  - 顶部显示"已采纳 n 项，将写入新版本；其余不写入"；
  - 预览数据被重新上传或映射改变时清空建议。

## 四、任务清单

| ID | 任务 | 主要文件 | 验收 |
|---|---|---|---|
| AIP-00 | 文档文本展平与上下文构造 `buildProtocolExtractionContext()` | `src/lib/protocol-ai-context.ts`（新） | 单测：表格转 Markdown、图片块被跳过、字符上限截断并提示 |
| AIP-01 | 提示词与输出 schema | `src/lib/ai.ts`（新增 `buildProtocolExtractionPrompt`）、`src/lib/validation.ts` | 单测：合法/非法输出；无 evidence 项被丢弃 |
| AIP-02 | 适配器通用补全接口 | `src/lib/ai.ts` | `ConnectedProvider.complete(system,user)` 已存在，公开为 `completeStructured<T>(prompt, schema)`；三种适配器各一测 |
| AIP-03 | 抽取路由 `POST /api/structured-import/protocols/ai-extract` | `src/app/api/structured-import/protocols/ai-extract/route.ts`（新） | 主开关关闭 403；输入 file+checksum 与预览一致；返回带状态标记的建议 |
| AIP-04 | 校验与比对 | `src/lib/protocol-extraction.ts`（新） | 单测覆盖 3.4 的 5 条规则 |
| AIP-05 | 采纳 UI | `src/components/ProtocolExtractionPanel.tsx`（新）、`StructuredImportWorkspace.tsx` | 390 px 可用；键盘可操作；勾选变化后确认令牌重新签发 |
| AIP-06 | 写入合并与审计 | `structured-import.ts`、`structured-import-confirmation.ts` | 单测：采纳集合哈希进入令牌；合并去重；activityLog 记录 |
| AIP-07 | 端到端脚本 | `scripts/verify-protocol-ai-extraction.mjs` | 用本地 mock 端点跑通导入→抽取→采纳→新版本含参数 |

顺序：AIP-00 → 01 → 02 → 03/04（可并行）→ 05 → 06 → 07。

## 五、工作量与排期

| 批次 | 内容 | 估时 |
|---|---|---|
| 第 1 天 | AIP-00 ～ 02 | 1 天 |
| 第 2 天 | AIP-03、04 | 1 天 |
| 第 3 天 | AIP-05 | 1 天 |
| 第 4 天 | AIP-06、07、录屏 | 1 天 |

建议 10-12 前完成，留 10-13 ～ 10-18 做真实 aihub 联调、提示词微调与视频。

## 六、风险与应对

- **模型编造参数或公式**：evidence 必填 + 公式试算 + 名称匹配；默认不勾选 invalid/unmatched 项。
- **aihub（Dify）输出夹带解释文字**：`extractJsonPayload` 已能从围栏或首尾括号中提取；提示词要求"只返回 JSON"。
- **长文档超上下文**：AIP-00 设字符上限（建议 24k 字符），超出时按节截断并提示用户分节导入。
- **与现有启发式冲突**：采纳项优先，但 UI 必须显示"将覆盖启发式结果"。
- **数据合规**：只发送文档文本；嵌入图片不发送；按通知第十一条，演示用协议须为团队自有或脱敏。

## 七、演示要点

1. 导入一份真实 DOCX，预览页显示启发式结果：参数为空。
2. 点"AI 抽取"，几秒后出现 6～10 项建议，各带原文证据；一条公式故意写错，显示 invalid。
3. 勾选采纳，确认导入；新版本页展示参数与耗材规则；活动记录显示 AI 辅助导入的审计信息。
4. 从该协议创建 Protocol Run，耗材计算直接可用。
