# 隔离验收复现

1. 在独立检出安装依赖，配置本机 PostgreSQL 测试数据库 `labnest_stage_a_acceptance`；不得指向正式数据库。执行既有迁移及 `prisma generate`。
2. 创建 `docs/debug-20260909/evidence/editor`，执行 `npx tsx scripts/seed-debug-fixtures.ts`。所有生成记录明确使用 Synthetic 名称；不清空数据库。
3. 用端口 3232 启动当前版本（`next dev --webpack --hostname 0.0.0.0 --port 3232`）。正式验收再以生产构建启动相同端口。
4. 依次运行 `verify-debug-origin.mjs`、`verify-debug-material-delete.mjs`、`verify-debug-material-ui.mjs`、`verify-debug-material-sessions.mjs`、`verify-debug-correction.mjs`。
5. 执行 `npx tsx scripts/seed-debug-document.ts`，运行 `verify-debug-document.mjs`；再执行 `npx tsx scripts/seed-debug-consumption.ts`、`verify-debug-consumption.mjs`。前者追加合成步骤，重复种子会生成额外步骤；建议为每轮使用新种子。
6. 编辑器复用 `verify-editor-repair.mjs`，环境变量：`LABNEST_EDITOR_TEST_URL=http://localhost:3232`、`LABNEST_EDITOR_EVIDENCE_DIR=docs/debug-20260909/evidence/editor`，分别以 `EDITOR_CHECK=roundtrip` 和 `template` 执行，然后运行 `verify-debug-pdf.mjs`。
7. 工具复用 `verify-stage-tools.mjs` 和 `verify-stage-tool-files.mjs`，设置 `LABNEST_ACCEPTANCE_URL=http://localhost:3232`、`LABNEST_TOOL_EVIDENCE_DIR=docs/debug-20260909/evidence/tools`。
8. 运行 `verify-debug-image-delete.mjs`、`verify-debug-motion.mjs` 和 `verify-debug-visual.mjs`。保留运行生成的 JSON、截图、录像及失败日志。不要把旧通过日志当作新版本证据。

本机及 Playwright 模拟手机不等于真机软键盘、160% 系统缩放或实验人员试用。实际打印机测试未执行。既有 Calculator 全套验收使用它自己的隔离数据库与端口 3221。
