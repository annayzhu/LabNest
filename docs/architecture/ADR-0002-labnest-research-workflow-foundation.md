# ADR-0002：LabNest 科研工作流基础架构

- 状态：Accepted
- 日期：2026-08-08
- 适用版本：LabNest foundation branch
- 替代内容：ADR-0001 中 `Project -> Experiment` 的直接主线及看板优先的页面假设

## 1. 决策

LabNest 的科研主线确定为：

```text
Project
└── Research Plan (one or more)
    ├── General Protocol reference
    ├── Project-adapted Protocol
    │   └── immutable ProtocolVersion(s)
    ├── Experiment run 1
    ├── Experiment run 2
    └── Results / Entries / Reports
```

同一 ProtocolVersion 可以被多个 Experiment 重复使用。每个 Experiment 保存主 ProtocolVersion，并可以关联若干 supporting ProtocolVersion。Project 不再作为 Experiment 唯一且直接的科学组织层；Research Plan 表达研究目的、假设、理由和实验设计。

## 2. Protocol 治理

- `Protocol.scope` 区分 `general` 与 `project`。
- General Protocol 可以派生 Project Protocol；`derivedFromVersionId` 记录跨 Protocol 的来源版本，`adaptationRationale` 记录适配理由。
- 同一 Protocol 内的修订使用 `previousVersionId`，不再用一个含义模糊的来源字段同时表达修订与派生。
- `availability`（draft / active / retired / archived）与 `reviewStage`（draft / ready_for_review / reviewed）分离。
- 数据库内部使用单调递增的 `revision` 保证唯一性；界面使用 `displayVersion`（例如 0.1、1.0）。
- Experiment 引用不可变的版本快照，不引用会继续变化的 Protocol 抽象记录。

## 3. 信息架构

主导航固定为：

```text
Overview
Entries
Projects
Research Plans
Protocols
Experiments
Results
Reports

Inventory
Tools
```

Search、AI review、Settings 是辅助入口，不与科研主线争夺同等导航面积。Samples、Entities、Purchases、Attachments、Exports 等已有能力暂不删除，但从主导航降级为可搜索或后续上下文入口。

Overview 只展示少量可行动的计数与最近记录，不使用大幅 hero、装饰图或占满页面的 KPI 看板。LabNest 是现场工具，不是管理驾驶舱。

## 4. 结构化内容与大表格

Protocol、Result 与 Inventory 必须支持网页编辑、保存、导入和导出。结果内容采用“稳定大类 + 灵活内容块”：文字、图片、文件、表格、视频和领域专用块可以组合，但身份、来源、版本、时间、状态和关联关系必须结构化。

超大表格不应直接作为一个 JSON 字段整体渲染或保存。后续实现采用独立数据集对象、列模式、分块或对象存储、服务端分页和虚拟滚动；Result 只保存摘要、模式、校验状态和来源链接。原始文件保持不可变，清洗和分析形成新版本。

## 5. Tools 边界

Tools 是类似 NEB Interactive Tools 的实验工具目录，不是杂项功能集合。首批目录项：

- qPCR Plate Layout Planner
- TaqMan CNV Plate Planner
- qPCR Analysis Studio
- CNV Analyzer

每个工具独立开发、测试、部署和版本化。LabNest 使用 manifest 描述名称、版本、输入、输出和启动地址，默认新标签页打开，不以 iframe 强耦合。后续通过受控上下文参数启动，并把导出文件登记为 Result 或 Attachment；Tool 不直接写 LabNest 核心表。

## 6. AI 边界

- AI 总开关持久化在数据库，默认 `false`。
- 关闭时，提示词生成与模型结果导入 API 返回 403；核心工作流完全可用。
- 开启总开关不等于授权发送整个 Project。
- 每次调用仍需用户明确选择文本、记录或附件；默认策略为 `explicit_context`。
- AI 输出只能形成 ProposedAction 或草稿，不能自动修改实验、库存、Protocol、Result 或审核状态。
- API provider、密钥加密和真实模型适配器在后续阶段实现。

## 7. 本次实现范围

本次 foundation 包含：

- Prisma 模型与无损迁移。
- 旧 Project 数据的一对一初始 Research Plan 回填。
- 旧 Experiment Protocol 关系迁移为主版本与关联表。
- 新主导航与紧凑 Overview。
- 数据库驱动的 Projects、Research Plans、Protocols、Experiments、Reports 页面。
- Tools manifest 与目录页。
- 数据库驱动的 AI 总开关及 API 拦截。

完整 Protocol 富文本编辑器、DOCX 模板导入、General -> Project Protocol 适配向导、大表格引擎、工具结果回传、完整 CRUD 与权限系统不属于本次 foundation，按模块继续实现。

## 8. 验收

- Prisma 迁移在现有 PostgreSQL 数据库无损执行。
- `Project -> ResearchPlan -> ProtocolVersion -> Experiment` 可从数据库查询。
- Protocol availability 与 review stage 可分别显示。
- 主导航与本 ADR 一致。
- Overview 保持紧凑。
- Tool 未配置端点时明确显示 Not connected。
- AI 默认关闭且服务端强制执行。
- lint、typecheck、unit tests、production build 通过。
