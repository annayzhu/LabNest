# 重复验收

使用独立本地数据库 `labnest_debug_20260910`，不要对生产数据库运行 seed/故障注入脚本。依赖使用仓库 lockfile；本机 Node 22.23.1、Chromium 149。生产构建用 `npm run build -- --webpack`，随后 `npm run start -- --port 3240`。

所有 TypeScript 脚本使用 `node --import dotenv/config --import tsx scripts/文件名.ts`。

1. 执行 `scripts/seed-debug10-context.ts`，再运行 `scripts/prepare-debug10-run.mjs`，从实际创建页面建立 Protocol/实验和冻结步骤。
2. 以 `LABNEST_EDITOR_EVIDENCE_DIR=docs/debug-20260910/evidence/format` 执行 `scripts/seed-editor-repair.ts`。依次运行 `verify-debug10-editors.mjs`、`verify-debug10-paragraphs.mjs`、`verify-debug10-clipboard.mjs`。重复整轮时重新 seed，避免把上次测试内容当成空白夹具。
另执行 `seed-debug10-font.ts` → `verify-debug10-font.mjs` → `verify-debug10-font-all.mjs`，依次验证作用域及六入口全文字号/PDF。

3. 执行 `seed-debug10-execution.ts`、`verify-debug10-execution.mjs`；执行 `seed-debug10-legacy.ts`、`verify-debug10-legacy.mjs`、`verify-debug10-database.ts`。前者验证编辑正文不清除勾选；后者比对冻结快照 SHA256、步骤引用，并回读测量值及重放数量。
4. 以 `LABNEST_EDITOR_EVIDENCE_DIR=docs/debug-20260910/evidence/editor` 重新 seed 编辑器。对 `verify-editor-repair.mjs` 依次设置 `EDITOR_CHECK=print/ime/media-controls/metadata/image-recovery/roundtrip/template/run`，以及 `LABNEST_EDITOR_TEST_URL=http://localhost:3240`。不要与修改相同夹具的其他脚本并行执行。
5. `verify-debug10-run.mjs` 检查六个视口；`verify-debug10-visual.mjs` 检查11类页面×2宽度×2明暗模式；`verify-debug10-template-format.mjs` 验证嵌套模板；`verify-debug10-print.mjs`生成宽表PDF并审核全部PDF的A4尺寸和非空页。
6. Calculator 使用既有 `LABNEST_BUILD_DIR=.next LABNEST_TSCONFIG_PATH=tsconfig.json node scripts/calculator-acceptance-server.mjs`，它创建独立的 `labnest_calculator_acceptance_20260906` 数据库并在3221启动生产服务；运行 `LABNEST_E2E_BASE_URL=http://localhost:3221 node scripts/verify-calculator-v13-acceptance.mjs`。不要与生产端口混用。22阶段包括离线往返、重连、数据库重放、移液、WB和正式导出。
7. `TZ=Asia/Shanghai npm test`、`TZ=America/Vancouver npm test`、`npm run typecheck`、`npm run lint`。测试脚本与日志不能替代页面/PDF证据。

对照截图额外需要基线 main `4f93dc8` 的只读实例3241，连接同一合成数据库。`verify-debug10-comparison.mjs` 和 `verify-debug10-density.mjs` 不执行保存操作。基线实例不用于生产数据。

`evidence/*red.log`保留真实失败回归。早期开发模式中断、选择器修正及过时报告不能覆盖最终报告。所有旧记录夹具均为合成记录；生产只读审计未复制原记录正文到本目录。
