# Protocol 执行步骤与正文约定

`contentJson` 是完整正文；`stepsJson` 是同一正文的执行投影。二者属于现有 Protocol 模型，不是两套记录系统。

- 一个可独立确认的操作只有一个稳定 `source_ref`。短标题之外的段落、列表、表格、图片、警告和工具说明归入其 `content_blocks`。
- 正文块 `execution.role` 为 `step`、`detail` 或 `info`。`detail.stepId` 指向操作的稳定来源 ID；`info` 不计步。格式、中文关键词及源复选框不自动确认科研含义。
- 无标记的旧正文只形成待确认建议。编辑页的「执行步骤划分」支持拆分顶层项、合并归属及标为说明；确认并保存后才可创建新实验。嵌套列表是所属操作的说明。
- 修改顺序不改变步骤身份。新实验另建实例 ID，所有完成状态从 false 开始；快照锁定实际选择的版本。旧实验只读取冻结内容。
- 新增普通正文块会再次要求确认；零操作文档保留原文，不能自动算作已完成实验。
- 默认空白 DOCX 保持空白。`/api/protocols/template/docx?example=execution` 提供已划分的结构示例，不能作为真实科研方案。
- LabNest 导出的 DOCX 包含正文结构记录及可见 XML 校验。内容未经 Word 修改时可恢复归属与富文本；可见内容被改动后使用实际可见正文，并要求重新确认。内嵌图重新导入附件，不能沿用其他环境的附件 ID。

历史修复脚本默认只生成私有备份和差异。`apply-protocol-execution-plan.ts` 对逐块审核的清单创建新 ProtocolVersion；不会重写原版本。`repair-draft-protocol-execution.ts` 只接受未开始的 planned/draft，所有旧 ID 必须显式映射，保留操作实例 ID、备注和附件，并拒绝已执行、计时启动或库存交易证据。运行中、已完成及提交/审核记录不得重建。
