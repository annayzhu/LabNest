# ADR-0003：Protocol 文档、版本与 DOCX 导入模型

- 状态：Accepted
- 日期：2026-08-09
- 适用范围：LabNest Protocol 模块

## 决策

Protocol 采用双层表示：

1. `contentJson` 保存面向研究者的完整文档，顶层固定为 Description、Purpose、Background、Material、Steps、Result Templates、Consumption Rules。
2. 每个固定区块内部允许 heading、text、checklist、table、callout 五类内容块，并保留顺序。
3. `materialsJson`、`stepsJson`、`resultTemplatesJson` 和 `consumptionRulesJson` 是供实验生成、计算和检索使用的机器可读投影，不替代完整文档。

这避免把复杂 Protocol 压扁成几个 textarea，也避免仅保存不可计算的富文本。

## 版本规则

- Draft 和 Ready for review 版本可以在原版本上继续编辑。
- Reviewed 版本不可原地覆盖；任何修改必须创建新的 `ProtocolVersion`，并通过 `previousVersionId` 连接。
- General Protocol 适配为 Project Protocol 时创建新的 Protocol 记录，通过 `derivedFromVersionId` 记录来源版本，通过 `adaptationRationale` 记录适配理由。
- Experiment 始终引用明确的 ProtocolVersion。

## DOCX 导入规则

- 解析 Word 正文中的段落与表格，按七个固定标题路由到内容区块。
- 保留检查清单、表格和关键警告，不只提取纯文本。
- 保存来源文件名、SHA-256、导入时间和来源类型。
- 文件名编号、正文编号、Availability 或必需区块不一致时保留 warning。
- 已存在的 Protocol 编号或完全相同的来源文件必须阻止导入，不静默覆盖。

已验证的模板目录包含 16 份文件。两份存在文件名和文档内部编号不一致：

- `PRT-100009_...` 的正文编号为 `PRT-100012`。
- `PRT-100010_...` 的正文编号为 `PRT-100013`。

系统保留正文编号并显示差异警告，最终编号需由用户确认。

## 大表格边界

Protocol 内普通方法表格使用横向滚动、固定表头和有限高度容器。大量实验结果不应长期嵌入 Protocol `contentJson`；后续以独立 Dataset/Result 数据对象、服务端分页和虚拟滚动实现。

## 后续范围

- DOCX 导出与打印版式。
- 行内富文本、图片和附件块。
- DOCX 导入预览与逐项确认。
- Result Template 和 Consumption Rule 的专用可视化编辑器。
- Protocol 批量导入及编号冲突解决工作台。
