# LabNest × 浙江大学校园 AI 创新应用大赛：工作总览

日期：2026-10-08。用途：记录参赛决策、已完成的第 1 项（真实模型适配器）、以及第 2、3 项的执行方案入口。

| 节点 | 日期 | 距 2026-10-08 |
|---|---|---|
| 报名截止 | 2026-10-18 | 10 天 |
| 作品提交截止 | 2026-10-21 | 13 天 |
| 初赛评审 | 2026-10-22 ～ 10-23 | |
| 决赛评审 | 2026-10-27 ～ 10-28 | |

赛道：学生组。应用方向：科研创新（实验方案设计、科研数据智能分析、论文图表生成）。

## 三项工作与状态

| 序号 | 内容 | 状态 | 文档 |
|---|---|---|---|
| 1 | 日志条目 → 真实模型生成拟议操作 → 人工审核后入库 | **已实现，本地验证通过** | 本文第二节 |
| 2 | Protocol DOCX 导入时由 AI 抽取参数、步骤属性、耗材规则、结果模板 | 方案已写，未开发 | [PLAN-2](PLAN-2-protocol-import-ai-extraction.md) |
| 3 | Visualization Studio 智能作图助手 | 方案已写，未开发；建议只做精简版或写入规划 | [PLAN-3](PLAN-3-studio-figure-assistant.md) |

## 第 1 项：已实现内容（分支 `claude/ai-provider-adapters-20261008`）

### 代码变更

| 文件 | 变更 |
|---|---|
| `src/lib/ai.ts` | 重写。保留手动复制粘贴模式；新增 `OpenAICompatibleProvider`（OpenAI、千问 DashScope 兼容模式、vLLM、Ollama 等）、`AnthropicProvider`、`DifyProvider`（浙大 aihub 基于 Dify）。统一 `buildProposedActionPrompt`、`parseProposedActions`，超时 60 s，错误信息带 HTTP 状态和服务端消息。 |
| `src/lib/ai-crypto.ts` | API Key 的 AES-256-GCM 加解密；密钥来自 `LABNEST_AI_ENCRYPTION_KEY`，支持 32 字节 hex/base64，其它字符串经 SHA-256 派生；检测 `.env.example` 占位符并在设置页提示。 |
| `src/lib/ai-server.ts` | 服务端：把数据库 `AIProvider` 行转换为适配器，解密密钥仅在请求内存中存在；`getAIAvailability()` 给页面判断"是否已连接模型"。 |
| `src/app/api/ai/generate/route.ts` | `POST /api/ai/generate`：接收 `entryId` 或显式标题正文，调用默认连接模型；`persist: true` 时把结果写为 `ProposedAction`（`sourceType=ai`，`sourceId=entryId`，状态 pending）并记 `ActivityLog`。 |
| `src/app/api/ai/providers/[id]/test/route.ts` | 连接测试，不发送任何记录内容。 |
| `src/app/settings/actions.ts`、`src/components/AiProviderForm.tsx`、`AiProviderTestButton.tsx`、`src/app/settings/page.tsx` | 设置页可新增/编辑/启停/删除/测试模型服务；密钥只写不读。 |
| `src/components/EntryAiProposeButton.tsx`、`src/app/entries/[id]/page.tsx` | 条目页"Propose with AI"按钮；仅在主开关打开且默认服务是已连接模型时显示。 |
| `src/components/ManualAiWorkbench.tsx`、`src/app/actions/manual/page.tsx` | 工作台新增"Ask <provider>"直连按钮，返回结果进入同一校验流程。 |
| `src/lib/entries.ts` | 条目页与列表的待审操作统计同时包含 `sourceType=entry` 与 `ai`。 |
| `src/components/ProposedActionCard.tsx` | 收件箱卡片显示来源标签（例如 `ai:<entryId>`）。 |
| `prisma/schema.prisma`、`prisma/migrations/20261008090000_ai_provider_dify` | `AIProviderType` 新增 `dify`。 |
| `src/lib/ai.test.ts`、`src/lib/ai-crypto.test.ts` | 21 个单元测试：三种适配器的请求构造、响应解析、错误处理、密钥加解密。 |

### 不变的安全边界

- AI 主开关默认关闭；关闭时所有 AI 路由返回 403。
- 只发送用户点击时明确指定的条目标题与正文；不发送附件、项目全量数据或库存。
- 模型输出只能生成 `ProposedAction`，必须由用户在收件箱接受/编辑/拒绝后才会执行；路由与提示词均不允许直接写记录。
- 密钥加密存储、不回显；服务端解密仅在单次请求内。

### 接入浙大 aihub（Dify）的步骤

1. 在 aihub.zju.edu.cn 创建一个"聊天助手"类应用，系统提示可留空（LabNest 的提示词随请求发送），发布后在"API 访问"页取得 `app-…` 密钥和 API 根地址（形如 `https://aihub.zju.edu.cn/v1`，以页面显示为准）。
2. 在 `.env` 设置真实的 `LABNEST_AI_ENCRYPTION_KEY`（例如 `openssl rand -hex 32`），重启应用。
3. LabNest → Settings → Model providers：类型选 Dify，填 Base URL 与 API key，保存后点 Test。
4. AI access：打开主开关，Default provider 选该服务，保存。
5. 任意条目页右侧"Proposed actions"出现"Propose with AI"。

如用千问 API：类型选 OpenAI-compatible，Base URL `https://dashscope.aliyuncs.com/compatible-mode/v1`，模型如 `qwen-plus`。

### 本地验证记录（2026-10-08）

- `npm run typecheck`、`npm run lint`（仅既有警告）、`npm run test`（116 文件 / 591 用例）通过。
- 用本机模拟的 OpenAI 兼容端点走通：设置页新增服务 → Test 返回"Connected. 1 models available." → 条目页 Propose with AI → 2 条 pending 操作出现在条目页与 `/actions` 收件箱 → 工作台直连返回同样结果。验证后已删除模拟服务与测试数据，AI 主开关恢复关闭。

## 演示脚本建议（≤ 6 分钟核心场景）

1. 30 s：LabNest 总览，强调记录、协议、库存、结果的 provenance。
2. 60 s：设置页展示连接浙大 aihub，Test 成功；说明密钥加密与默认关闭。
3. 120 s：打开一条真实实验日志，点 Propose with AI，收件箱出现拟议操作；逐条接受/拒绝/编辑，执行后库存事务与实验记录随之生成。
4. 60 s：若第 2 项完成，展示 DOCX 导入时的 AI 抽取与逐项采纳。
5. 60 s：Visualization Studio 现有作图能力（与第 3 项规划）。
6. 30 s：合规与伦理：本地部署、显式上下文、人工审核。

## 提交材料清单

- [ ] 申报书（报名表导出 PDF）
- [ ] 原创承诺书（负责人签字扫描）
- [ ] 作品介绍文档：名称、3～5 个关键词、概要、痛点、场景、成效
- [ ] 演示视频 MP4 ≤ 10 min、≤ 200 MB，无第三方水印
- [ ] 支撑材料（可选）：本目录文档、测试报告、部署说明
- [ ] 界面与材料中不出现校徽、校名标识
