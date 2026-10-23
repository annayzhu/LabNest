# 方案 3：Visualization Studio 智能作图助手

编制日期：2026-10-08。状态：**已于 2026-10-09 实现**，代码在 Studio 仓库 `annayzhu/Visualization-studio` 分支 `claude/studio-ai-assistant-20261009`（工作树 `/Users/annayzhu/Documents/Playground/Visualization-studio-ai-20261009`，基于 main `4eece79`），说明见该仓库 `docs/ai/README.md`。

实现与本方案的差异：

- AI-00 至 AI-06 全部实现，不止精简版。可调设置为 20 个展示类键（标题、轴标签、字体、尺寸、字号、线宽、点、透明度、网格、图例位置、轴交换、标签、点显示），统计类设置一律排除。
- 模型连接设置保存在浏览器 sessionStorage（勾选"记住"时为 localStorage），而非 IndexedDB；密钥只作为请求头发给 Studio 自己的代理路由。
- 代理增加 `STUDIO_AI_PROXY=off` 与 `STUDIO_AI_ALLOWED_HOSTS` 两个部署开关，用于防止共享部署被用来访问内网。
- 撤销使用组件内快照栈（最多 10 步），未写入 `StudioProject.history`；后者只记录数据集准备历史。
- AI-05 出版检查为本地确定性规则（单栏 85 mm 下最小字号、颜色数、图例、灰度明度），结果同时作为上下文发给模型。
- AI-06 评测：10 个固定用例与真实模型运行入口 `npm run eval:assistant` 已就绪，参考答案 10/10、错误答案 0/10 已验证；**真实模型得分尚未测得**。
- 未处理五-3 的残留目录 `LabNest/standalone/visualization-studio`（仅 node_modules），未部署到 3400 端口；线上仍是 10-01 的发布快照。

原方案如下。补充并落实 [2026-09-30 的 AI 集成评估](../../visualization/20260930/AI_INTEGRATION_REVIEW.md)；本文以代码核对结果为准，评估文中与现状冲突的条目在二中标明。

## 一、目标与边界

在独立产品 Visualization Studio 内提供一个助手：用户用自然语言描述需求，助手基于**当前数据的列概况**和**已注册的图形模块目录**提出结构化方案（图形类型、列映射、少量设置变更、图注草稿），经 Studio 的现有校验后预览并一键应用、一步撤销。科学计算、渲染、导出仍由现有程序完成；模型不执行代码、不直接改状态。

Studio 与 LabNest 的边界不变：Studio 独立部署，自有模型设置；LabNest 仅链接跳转，不传数据和凭证（`src/lib/visualization-link.ts`、`tool-manifest.ts:104-113`）。LabNest 第 1 项的适配器代码不作为 Studio 的运行依赖，但其接口形状（`OpenAICompatibleProvider` / `DifyProvider` 的请求构造与 JSON 提取）可以复制到 Studio 作为独立实现。

## 二、代码现状（2026-10-08 核对）

| 事项 | 结论 |
|---|---|
| 线上源码 | 端口 3400 由 `/Users/annayzhu/Documents/Playground/Visualization-studio-release-20261001/.next/standalone` 提供，**该目录不是 git 仓库**，是 P0 发布快照（`DEPLOYMENT.json`：main `4eece79`，部署 `b9a7f0f`）。 |
| 开发检出 | `/Users/annayzhu/Documents/Playground/Visualization-studio-20260920`，分支 `codex/studio-project-p0-20260930`，HEAD `5631672`（9-20），有未提交 P0 改动与未跟踪文件；本地 `origin/main` 过期。 |
| 框架 | Next 16.3.1、React 19.2、TypeScript 5；`dev` 127.0.0.1:3400；构建为 standalone。**只有一个路由 `src/app/page.tsx`，没有任何 API 路由。** |
| AI 代码 | 两个检出的 `src` 均无 AI 相关代码。 |
| 模块目录 | `src/lib/plot-module-registry.ts`（148 行）：`definition{id,name,family,summary,inputHint,roles[],defaultMapping,sampleData}`、`guidance`、`capabilities{dataShape,settingKeys,…}`；`createPlotModuleRegistry` 只校验结构与 settingKeys 白名单，**无参数类型/范围/枚举**。 |
| 图形实例 | `src/lib/visualization-studio.ts`：`PlotType` 82 个 ID（:48）；`commonSettingKeys` :3544、`specializedSettingKeys` :3550；`inferPlotMapping` :4012、`validatePlotDataset` :4058。`VisualizationSettings` :315 仅 TS 类型，无运行时 schema。 |
| 主组件 | `src/components/VisualizationStudio.tsx`（1428 行）：多个 `useState`（plotType :425、rawData :426、mapping :427、settings :431）；`restoreSnapshot` :594；`selectPlot` :670 **已保留当前数据**（评估文第 3 节第 1 条已过时）；`exportConfig` :890 **仍含 `data: rawData`**（评估文第 2 条仍成立）。 |
| 项目存储 | `src/lib/studio-project.ts` `StudioProject`（数据集含校验和、figures、history），IndexedDB 持久化。 |
| LabNest 内残留 | `LabNest/standalone/visualization-studio` 只含 `node_modules`（约 523 MB），无源码，为安装残留；可删除。 |

## 三、设计

### 3.1 凭证与调用路径

Studio 没有数据库，也不应新增。推荐：

- 模型连接设置（接入方式、Base URL、密钥、模型名）保存在**浏览器 IndexedDB**（与项目同库，独立 store），不上传。
- 新增 Next 路由处理器 `src/app/api/ai/plan/route.ts` 作为**透传代理**：浏览器把密钥放在请求头 `x-studio-provider-key`，服务端不存储、不记录，仅转发到模型端点并返回结果。目的：避开 CORS、统一超时与错误格式、保证请求体只含 `AIContext`。
- standalone 构建包含路由处理器；需在 AI-04 验证 `.next/standalone/server.js` 确实提供 `/api/ai/plan`。
- 备选：若校内 aihub 允许浏览器直连（CORS 放行），可省略代理，但仍保留同一请求构造函数。

### 3.2 `AIContext`（发送内容，默认最小）

```ts
type AIContext = {
  columns: { name: string; kind: "number"|"category"|"label"|"unknown"; distinct?: number; min?: number; max?: number; missing: number }[];
  rowCount: number;
  sampleRows?: Record<string, string|number>[];   // 默认关闭，用户勾选后最多 5 行
  current: { plotType: PlotType; mapping: Record<string,string>; settingKeys: string[] };
  catalog: { id: PlotType; name: string; family: string; summary: string; roles: {key:string; kind:string; required:boolean}[]; dataShape: string }[]; // 由 registry 生成
  request: string;                                 // 用户自然语言
  locale: "zh"|"en";
};
```

`exportConfig` 的整份 JSON **不得**作为上下文发送。

### 3.3 `FigurePlan`（模型输出）

```ts
type FigurePlan = {
  plotType: PlotType;
  mapping: Record<string, string>;                 // roleKey -> column
  settingsPatch: Partial<Record<AllowedSettingKey, string|number|boolean>>;
  caption: { zh: string; en: string };
  rationale: string;
  questions: string[];                             // 信息不足时先问，不猜
};
```

### 3.4 校验链（全部在 Studio 内、模型之外）

1. `plotType` 必须在 registry 中；`mapping` 的列名必须存在于当前表头；必填 role 不能为空。
2. `settingsPatch` 的键必须在该图形的 `commonSettingKeys ∪ specializedSettingKeys`；值类型用新增的轻量运行时 schema（AI-00 产出）校验；越界值丢弃并提示。
3. 以候选 `plotType/mapping/settings` 调 `validatePlotDataset`；有 `errors` 则不允许应用，仅显示原因。
4. 统计类设置（如 bar 的 `barAnalysisMode`、显著性标记）在 `questions` 非空或配对定义缺失时禁止自动应用。

### 3.5 应用与撤销

- 应用前显示 diff（图形类型、映射、设置项）与模型 rationale。
- 应用 = 一次 `restoreSnapshot` 兼容的快照写入；撤销 = 恢复应用前快照；写入 `StudioProject.history`。
- 图注草稿只放入可编辑文本框，不自动写入导出。

### 3.6 界面

- 标题栏"智能作图"按钮切换右栏"图形参数 / 智能助手"；移动端底部面板。
- 助手面板：模型设置入口（未配置显示"连接模型"）、上下文开关（是否附 5 行样例）、输入框、方案卡片（应用 / 撤销 / 提问回答）。
- 模型配置、失败、关闭均不影响普通作图。

## 四、任务清单（沿用评估文编号）

| ID | 任务 | 主要文件（开发检出） | 验收 |
|---|---|---|---|
| AI-00 | 能力目录与运行时 schema：从 registry 生成 `catalog`；为 `commonSettingKeys` 与高频 specialized keys 写值类型/范围 | `src/lib/studio-ai-catalog.ts`（新）、`plot-module-registry.ts` | 单测：82 个图形全部有目录项；非法设置值被拒 |
| AI-01 | `buildAIContext()`，列概况统计，样例行开关，字符上限 | `src/lib/studio-ai-context.ts`（新） | 单测：默认不含原始数据；开关后 ≤ 5 行 |
| AI-02 | `FigurePlan` zod schema、校验链 3.4、快照应用/撤销 | `src/lib/studio-ai-plan.ts`（新）、`VisualizationStudio.tsx` | 单测：无效列、未知设置键、`validatePlotDataset` 报错三类都不可应用；撤销恢复原状 |
| AI-03 | 助手面板 UI 与"手动协议"验证：先用手动粘贴 JSON 方案跑通面板，再接模型 | `src/components/StudioAssistantPanel.tsx`（新） | 不配置模型也能粘贴 `FigurePlan` 并应用 |
| AI-04 | 模型连接：IndexedDB 设置 store、`/api/ai/plan` 透传代理、OpenAI 兼容与 Dify 两种请求构造 | `src/lib/studio-ai-provider.ts`、`src/app/api/ai/plan/route.ts`（新） | 本地 mock 端点连通；standalone 构建含该路由；密钥不出现在任何日志 |
| AI-05 | 出版检查建议与图注草稿（灰度/色觉检查结果作为上下文） | `studio-ai-context.ts` 扩展 | 可选，比赛前不强求 |
| AI-06 | 固定用例评测：10 个（数据集, 需求, 期望 plotType/mapping）用例 | `scripts/eval-studio-assistant.mjs` | ≥ 8/10 通过校验链并与期望一致 |

### 比赛前精简版（建议）

截止 10-21 只做 **AI-00（仅 commonSettingKeys）、AI-01、AI-02、AI-03、AI-04**，`settingsPatch` 先限制为标题、标签、图例位置、配色方案 ID 四类；AI-05/06 写入规划。精简版可演示"说一句话 → 推荐图形 + 列映射 + 图注草稿 → 应用/撤销"。

## 五、前置整理（必须先做）

1. 在开发检出 `git fetch origin` 并与 GitHub main（`4eece79`）对齐；决定是在 `codex/studio-project-p0-20260930` 上继续还是从 main 新开 `codex/studio-ai-assistant-20261008`。未提交 P0 改动先提交或暂存。
2. 不要在 `Visualization-studio-release-20261001` 快照上开发。
3. 删除 `LabNest/standalone/visualization-studio` 残留目录（仅 node_modules）。
4. 读取开发检出实际版本的 `node_modules/next/dist/docs/` 中 route handlers 与 standalone output 指南。

## 六、工作量与排期

| 批次 | 内容 | 估时 |
|---|---|---|
| 第 0 天 | 五中的前置整理 | 0.5 天 |
| 第 1 ～ 2 天 | AI-00、AI-01、AI-02 | 2 天 |
| 第 3 天 | AI-03（手动协议） | 1 天 |
| 第 4 天 | AI-04 + 构建验证 + 部署到 3400 | 1 天 |
| 第 5 天 | 真实模型联调、用例、录屏 | 1 天 |

共约 5.5 天，与方案 2 串行则占满 10-21 前全部时间。因此优先级为：方案 2 完成后仍有 ≥ 5 个工作日再启动方案 3 精简版；否则方案 3 只写入申报材料"下一步规划"。

## 七、风险

- **仓库状态混乱**（线上为非 git 快照、开发分支落后、origin 过期）：先做五中的整理，否则改动无法合并和部署。
- **standalone 构建不含 API 路由或部署流程未更新**：AI-04 必须包含一次完整 `build → standalone 启动 → curl /api/ai/plan` 验证。
- **设置键无类型定义**：AI-00 只覆盖高频键，其余键一律拒绝写入，避免模型写入无效值破坏预览。
- **模型猜测统计检验**：`questions` 机制 + 3.4 第 4 条；提示词明确"信息不足先问"。
- **许可**：figures4papers 为 CC BY-NC 4.0，只借鉴原则，不复制代码或文档。
