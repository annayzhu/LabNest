# Calculator v1.2 验收报告

日期：2026-09-07（Asia/Shanghai）。结论：核心移液修复及已执行工程验证通过；完整 v1.2 尚未通过，逐项缺口见 REQUIREMENTS.md 和 RUN-ACCEPTANCE.md。

## 提交与环境

- 原工作区 HEAD：`3d140158da0b8a685e74fb054fe55d4c0d89b673`，未覆盖其无关未提交修改。
- 核对的 main 基线：`d794c0ee01e5b513ced9def1c27a7061dfffd31d`。
- 库存日期最小修复：`6a22c98`；Calculator/Run：`3640ad688bb20aa55ed80e2faf92404837da056c`。
- 本轮全部最终运行源码：`0d01169b990293cf4857a9ba72a44ca11c465fdd`，包含共享独立工具构建产物。
- PR：https://github.com/annayzhu/LabNest/pull/56 （草稿）。此后证据提交只包含 docs，不声称新提交自身跑过全套CI。
- Node v22.23.1、npm10.9.8，依赖依package-lock.json；使用npm ci。读取适用AGENTS及已安装Next依赖文档；未替换主题、单位、计算或实验记录系统。
- 测试应用：真实 Next 生产构建，`http://localhost:3221`。数据库 `labnest_calculator_acceptance_20260906`，仅合成项目、Protocol、实验及结果。没有使用伪造成功API。
- 本轮没有合并或更新3000端口正式部署；测试应用与生产部署严格区分。

## 执行结果

| 检查 | 结果 | 原始证据 |
|---|---|---|
| npm run build | 通过 | evidence/build.log |
| npm run typecheck | 通过 | evidence/typecheck.log |
| TZ=Asia/Shanghai npm test | 92文件508测试通过 | evidence/tests-shanghai.log |
| TZ=America/Vancouver npm test | 92文件508测试通过 | evidence/tests-vancouver.log |
| npm run lint | 0错误，11条既有警告 | evidence/lint.log |
| 14个浏览器/数据库脚本 | 最终通过 | evidence/run-summary.json；回归重试日志 |
| 补充输出单位20轮、503重试、旧历史外观变更 | 通过 | evidence/followup-report.json |
| GitHub双时区quality＋browser | 三作业success | evidence/remote-ci.json |

远端实际运行：https://github.com/annayzhu/LabNest/actions/runs/34070885943 ，验收 SHA 与上述源码一致。该browser作业包含production build、Run表格、移液、真实数据库、独立工具及既有回归，不能简化成“页面存在”。

首次本机refactor脚本使用错误默认端口3220，纠正环境变量后通过；补充脚本图标控件定位错误，改为真实radio后通过。失败分别保留在 regression.log / followup-initial-failure.log。基线库存失败和移液错误在 baseline-*。未掩盖失败或改成跳过测试。

## 重跑

在此工作树安装锁定依赖，并提供仅本机的数据库连接环境。先执行 npm ci、npm run typecheck、两个TZ的npm test和npm run lint。执行生产构建：

```sh
LABNEST_BUILD_DIR=.next/calculator-production LABNEST_TSCONFIG_PATH=tsconfig.calculator.json npm run build
node scripts/calculator-acceptance-server.mjs
```

fixture服务器会建立/迁移独立验收数据库；不得改接生产库。服务器启动细节和端口以脚本为准。另一个终端按 run-summary.json 顺序运行 scripts/verify-calculator-*.mjs，所有浏览器脚本显式设置 `LABNEST_E2E_BASE_URL=http://localhost:3221`。新增Run→pipetting→v12-database顺序有依赖，不能并行。补充脚本 `node docs/calculator/v1.2/evidence/followup.mjs` 依赖前面的报告。

旧回归脚本会写入v1.0/v1.1默认证据目录；本轮已复制到 evidence/regression-v1 和 regression-v11，并恢复旧历史证据。副本包含旧脚本未覆盖的原有文件；仅以 run-summary 中实际执行的脚本及其更新报告作为本轮证据，不能把目录全部文件都视作本轮生成。

## 限制与待执行

完整需求状态见 REQUIREMENTS.md，包括T01–T26；Run逐项见 RUN-ACCEPTANCE.md。实际手机/键盘、真实200%浏览器缩放、3–5位实验人员试用未执行。CSS zoom模拟不冒充真实缩放。旧Run浏览器兼容、完整离线往返、全部工具全部模式组合及表内参数真实页面尚缺专项证据。没有因这些未执行项宣布P0或整体范围全部关闭。

本轮保存的ID和快照均为合成验收数据。系统现有操作员字段不等于登录账户权限系统；未声称完成账号权限验收。
