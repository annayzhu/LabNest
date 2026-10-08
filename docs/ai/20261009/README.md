# 方案 2 实现记录：Protocol DOCX 导入的 AI 抽取

日期：2026-10-09。分支：`claude/protocol-ai-extraction-20261009`（基于第 1 项分支）。

## 用户流程

1. Protocols → Import，上传 DOCX，点 Preview mapping。
2. 每条可导入的 Protocol 记录下出现 **AI extraction** 面板。未连接模型时按钮禁用并提示到设置页。
3. 点 Extract with AI：只发送该文档的文字（表格转 Markdown，图片与嵌入工具不发送），模型返回参数、耗材规则、步骤属性、结果字段，每项附原文证据。
4. 服务端逐项检查并标记状态，默认只勾选 `ok` 项：

| 状态 | 含义 | 可否勾选 |
|---|---|---|
| ok | 通过全部检查 | 默认勾选 |
| duplicate | 与导入器已识别内容重复；勾选则覆盖 | 默认不勾 |
| unmatched | 材料不在文档中，或证据在原文中找不到 | 默认不勾 |
| invalid | 参数名不能被公式引用、默认值类型错、公式无法用默认值求值、步骤不存在等 | 禁止 |

5. Confirm import 时，只有勾选项写入新 `ProtocolVersion`：`parametersJson`、合并后的 `consumptionRulesJson`、`stepsJson` 的确认/偏离标记、`resultTemplatesJson` 新字段；`changeSummary` 与 `ActivityLog.metadataJson.protocolImport.ai` 记录模型、采纳与未采纳项。

## 与原方案的差异

- 没有把采纳集合签入导入确认令牌，而是给 AI 建议单独签名（HMAC，30 分钟有效，排序键 JSON 防止往返改序）。确认时服务端校验签名、文件校验和与记录序号，再只应用勾选项。这样不改动原有令牌，且客户端无法注入未经检查的条目。
- 路由放在 `/api/ai/protocol-extraction`，与其它 AI 路由共用同源检查；共享的请求守卫增加了 multipart 模式。
- 步骤属性只覆盖 `requires_confirmation` 与 `allows_deviation`；`ProtocolStep` 没有计时字段，方案中的 `timer_minutes` 未实现。

## 代码

| 文件 | 作用 |
|---|---|
| `src/lib/protocol-extraction.ts` | 上下文构造、提示词、输出 schema、逐项检查、签名与校验、合并 |
| `src/app/api/ai/protocol-extraction/route.ts` | 重新解析文件、核对校验和、调用模型、返回签名建议 |
| `src/components/ProtocolExtractionPanel.tsx` | 预览中的逐项采纳界面 |
| `src/components/StructuredImportWorkspace.tsx`、`src/app/protocols/import/page.tsx` | 面板接入与确认请求携带 `aiExtractions` |
| `src/lib/structured-import.ts` | 提交时校验并合并；拒绝不对应任何记录的 AI 选择 |
| `scripts/build-protocol-ai-fixture.ts` | 生成合成转染 Protocol DOCX（仅演示结构，非验证方法） |
| `scripts/verify-protocol-ai-extraction.mjs` | 隔离库 + 模拟模型的浏览器验收 |

## 验证

- `npm run typecheck` 通过；`npm run test` 118 个文件 607 个用例通过，其中新增 9 个（抽取 8 个、请求守卫 1 个）。
- 浏览器验收（Chromium，隔离库 `labnest_protocol_ai_extraction_20261009`，模拟 OpenAI 兼容端点）8/8 通过，报告与截图在 `evidence/`：
  - 未连接模型时面板禁用并提示；
  - 跨源、JSON 请求体、错误校验和、AI 关闭时均不调用模型；
  - 发给模型的内容包含文档文字，不含密钥与附件地址；
  - 篡改建议、错配记录序号、勾选 invalid 项均被拒绝且不创建 Protocol（此项首次运行发现"错配序号被静默忽略"的缺陷，已修复）；
  - 390 px 无横向滚动；
  - 界面采纳 10/14 项后导入，数据库中参数、耗材规则、步骤标记、结果字段与审计记录逐项核对一致。

重跑：

```bash
npx tsx scripts/build-protocol-ai-fixture.ts
DATABASE_URL="postgresql://labnest:labnest@localhost:5432/labnest_protocol_ai_extraction_20261009?schema=public" LABNEST_E2E_BASE_URL=http://localhost:3339 node scripts/verify-protocol-ai-extraction.mjs
```

应用须以同一数据库、端口 3339 启动；验收前数据库中不能已有该夹具的导入。

## 未验证

- 未连接真实模型（aihub 或千问）。真实模型的输出质量、证据引用习惯与耗时需在联调时观察，可能需要调整提示词。
