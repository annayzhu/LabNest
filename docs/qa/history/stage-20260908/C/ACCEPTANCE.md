# C 正文与表格字号验收

PR #72，依赖B #71。联合应用代码071df83，隔离生产3235，全部记录为合成记录。

| 项目 | 结果及证据 |
|---|---|
| 全文字号 | 通过：实验、研究方案、结果、报告、Protocol、随手记录六入口18pt覆盖标题/正文/列表/表格/图注，保存→刷新→只读→重新编辑；evidence/font-all.json、12份font PDF。 |
| 表格范围 | 通过：单格12pt、整行14pt、整表20pt、多格16pt、混合字号指示，保留其他单元格和数值；保存重开；evidence/text.json。 |
| 嵌套说明 | 通过：外层全文命令覆盖结果模板说明；从嵌套说明执行全文也修改外层正文；保存回读与DOCX解包检查。evidence/nested.json、nested.docx。 |
| 图片与打印回归 | 保留PR67算法；本轮重跑六正文、结果模板和Run图像实际decode，预览故障回退原图、替换与中文图注模拟事件；编辑/只读PDF非空含图像。../../editor-repair/evidence/acceptance.json逐阶段。 |
| 硬件和原记录 | 未执行：原故障记录、真实打印机、完整真机中文IME、真机160%、人员试用。未声称全部历史丢图恢复。 |

复用原C工作区改动并保留原工作区。主要代码 document-text-formatting、DocumentWysiwygToolbar、Protocol/Scientific Tiptap、文档视图和DOCX导出。图注和嵌套说明字号通过现有结构持久化，不另建文档系统。截图复用 B/evidence/coverage-{入口}-edit-{desktop|mobile}-{light|dark}.png；本目录PDF逐文件经文本/图像检查，真实打印机另验。

复现顺序：seed-stage-text → verify-stage-text → verify-stage-font-all → verify-stage-nested-font → verify-editor-repair-all。LABNEST_ACCEPTANCE_URL及LABNEST_EDITOR_TEST_URL设http://localhost:3235，DATABASE_URL必须是独立合成库。


最终单位菜单修复应用 `20e8855f56b252297ecd98d96da0be74f3493d4b`；仅限制已有账本可选维度，C/D代码未变。该版本生产构建、类型、双时区各577测试、eslint、共享交互与库存/Run单位页面回读重新通过。全面C/D页面及文件验收版本仍为071df83，不能混淆两个验证批次。日志ledger-final-*与ledger-unit-menu.json。
