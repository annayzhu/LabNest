# Sep10 交付

[PR #77](https://github.com/annayzhu/LabNest/pull/77)，**未合并、未正式部署**。验证应用提交 `98a7f02519c70bd63b3e3056962206b9a8dad7c8`；最终证据提交仅更新验收脚本和文档，源码树一致性见[版本记录](VERSION.json)。

已完成执行记录层级/偏差标签、普通段落与表格格式往返、严格旧Run表格恢复、手机Run收纳与草稿保护、共享文字角色。实际验收还修复正文保存清除勾选、模板schema丢格式、Entry粘贴表格压平、表内图片关联及纯文本粘贴快捷键。

- [N01–N33逐项清单](ACCEPTANCE.md)：31项在注明的自动化/浏览器范围通过，N26/N28真机及人员项目未执行；子项边界逐条列出。
- [双时区625项×2](evidence/tests-final-shanghai.log)、[Vancouver](evidence/tests-final-vancouver.log)、[TypeScript](evidence/typecheck-final.log)、[生产构建](evidence/build-final.log)、[Lint（0错误、10项既有警告）](evidence/lint-final.log)。
- [11组本轮页面操作](evidence/final-browser-phases.json)、[8组编辑器回归](evidence/editor/final-phases.json)、[Calculator 22阶段](evidence/calculator/calculator/v1.3/evidence/acceptance-run.json)。
- [数据库回读](evidence/database.json)：快照hash/步骤身份/勾选不变，测量重放数量1，表内图片关联数量1。
- [40份PDF、61页检查](evidence/pdf-audit.json)：自动核查A4、非空文本及预期图像；另抽看实际渲染，未替代物理打印。
- [编辑器CI](https://github.com/annayzhu/LabNest/actions/runs/34443367979)、[Calculator双时区与浏览器CI](https://github.com/annayzhu/LabNest/actions/runs/34443368017)均通过。

## 实际页面与PDF

[桌面浅色](evidence/visual/editor-1440-light.png) · [桌面深色](evidence/visual/editor-1440-dark.png) · [手机浅色Run](evidence/visual/run-390-light.png) · [手机深色Run](evidence/visual/run-390-dark.png) · [44页覆盖](evidence/visual/coverage.json)

[同视口修改前](evidence/density-before.png) · [修改后](evidence/density-after.png) · [位置测量](evidence/density.json)：390×844同一合成Run，正文起点由701.5px提前到340.8px。

[执行记录PDF](evidence/execution.pdf) · [宽表PDF](evidence/wide-protocol.pdf) · [Entry实际粘贴表格与图片PDF](evidence/entry-pasted-table.pdf) · [模板说明表格PDF](evidence/template-pasted-table.pdf)

## 失败、未执行及影响

本轮最终自动功能回归没有未关闭失败。Inventory独立workflow的正常推送曾被凭据权限拒绝，仍未启用；不将此记为通过。原用户故障记录、真实Windows/Linux键位、Word来源、真机中文/软键盘/触控/160%、物理打印和实验人员试用未执行。手机HTTP不能替代可信HTTPS离线验收。这些限制影响对应场景的最终确认，详见[手动步骤](MANUAL-ACCEPTANCE.md)、[键位边界](KEYBOARD.md)及[旧要求去向](OLD-REQUIREMENTS.md)。

[复现方法](REPRODUCE.md) · [独立审查及红例说明](REVIEW.md) · [文字角色与覆盖](TYPOGRAPHY.md)。旧Calculator验收文件已恢复，新结果归档在本目录，没有用新截图覆盖历史版本证据。
