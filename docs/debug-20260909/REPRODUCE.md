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

补充回归：`seed-debug-image-matrix.ts` 创建独立位置夹具后运行 `verify-debug-image-matrix.mjs`（48组合）；`verify-debug-run-history.ts` 自建合成方法/Run并通过手机尺寸表单完成步骤，回读历史来源和参数；`verify-debug-material-units.mjs`、`verify-debug-offline.mjs`、`verify-debug-containers.mjs` 分别检查单位、离线同步和已领瓶；`seed-debug-font.ts` 后运行 `verify-debug-font.mjs`、`verify-debug-font-all.mjs`；`verify-debug-relations.ts` 检查关联摘要和批量管理。

运行 `verify-debug-brief-status.mjs` 前先生成 `run-history.json`。来源优先级测试先运行 `seed-debug-method-priority.ts`，再运行 `verify-debug-method-priority.mjs`。耗材边界测试先运行 `seed-debug-material-boundaries.ts`，再运行 `verify-debug-material-boundaries.mjs` 和 `verify-debug-inventory-independent.ts`；后者会完成该合成Run。

Calculator全套脚本的输出复制到本轮 evidence/calculator；其中日志仍记录原脚本输出路径，原有历史验收文件已恢复，避免用新结果覆盖旧版本证据。每轮回归的提交与局限见 VERSION.json。README中的开发服务命令不能当作生产构建验收。
