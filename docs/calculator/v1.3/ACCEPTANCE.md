# Calculator v1.0–v1.3 本轮验收

## 版本与范围

- PR：[#59](https://github.com/annayzhu/LabNest/pull/59)。本轮交付可审查 PR，未合并或更新在用部署。
- 原工作区 HEAD：`3d140158`（保留其无关未提交修改）；隔离分支从最新 main `446bb9bf6ea5dd4f672bc5acd365dc8e4e3808b8` 开始，最终再次获取 main 仍为此版本。
- 实际应用代码：`9e58196c1baf692f02e88f8aa268e603bfdf2b15`。后续提交仅验收脚本、日志与文档；具体执行 SHA 由每份 JSON 记录。生产构建使用该代码，在 `localhost:3223` 验收；在用 `localhost:3000` 仍为 main 基线，仅用于只读环境与性能对照。
- 已完整阅读仓库 AGENTS、四份 Spec、PR #57/#58 对应验收记录及实际 Next 16.2.10 / read-excel-file 9 依赖文档。附件作为本轮用户授权的需求依据；历史“通过”没有覆盖此次用户反馈。
- [统一逐项清单](REQUIREMENTS.md)：A=已有证据并回归；B=补验证；C=本轮修复/实现。旧 200% 要求全部由本轮最高 160% 取代。

## 实际修改

| 问题 | 修改位置与行为 |
|---|---|
| 复制失败或假成功 | `clipboard.ts`、`CopyPanel.tsx`、`CalculatorWorkspace.tsx`、独立包：原生复制→检查返回值的兼容复制→完整手动全选面板；输入、重算、显示单位变化均作废旧复制内容。 |
| 缓存不完整、更新失败和等待 | `offline.ts`、`OfflineCalculator.tsx`、`worker.js`：明确主页/当前页及依赖清单、分阶段状态、配额/资源/注册/超时区分；清除失败不报成功，清理异常不阻断重试或删除已发布缓存；原子发布、完整响应及总超时、并发串行、旧 v4 回退；Run 图片精确允许清单。 |
| 返回与响应慢 | `CalculatorCatalog.tsx`、`CalculatorNavigation.tsx`、`useCalculatorState.ts`、`catalog.ts`：搜索/位置恢复，Run 上下文保留，离线文档导航；小型路由反馈；目录与计算代码拆开，草稿节流并在离开前保存。 |
| 手机 Today 入口不完整 | `TodayCalculators.tsx`：补计算器主页入口；六项默认工具均可从 Today 两次点击进入。 |
| 31 页与首页不统一 | 共用 Tile/Heading/Field/Back、`globals.css`：六类 Bento，常用 3×2，标题图标帮助固定同排，数值与单位紧凑同排，PC 双列/手机单列；批量错误与警告仍可见；帮助气泡只显示当前项。 |
| 图片计数错误处理 | `ColonyCounterWorkspace.tsx`：无效新文件保留原图并阻止确认/保存；异步旧图片不覆盖新图。 |
| Run 参数表缺少实际编辑验证 | `RunParameterEditor.tsx`、`run-parameters.ts`、既有 `actions.ts`：使用已有 parametersJson，在实际页面编辑、冲突检查与审计；未提交参数离开后恢复，不新建实验记录系统。 |
| 正式打印宽表不可读 | `CalculationSnapshot.tsx`、`LiquidOperations.tsx`：显示来源与操作；打印将宽 WB 表逐行转换为字段/值布局，屏幕表和科研数值保持。 |
| 25 张附件未接入 | `assets/calculator-icons-v1.3` 保留原图；构建脚本派生 128px 透明 PNG；31 项统一映射、31 个语义线性替代图，主应用、Appearance、独立包及缓存共用。31 PNG 合计 78,556 bytes。 |

既有数量/单位、WB、移液检查、并行梯度、富文本步骤归属、历史迁移保护及 Appearance 偏好系统沿用；无数据库结构迁移、无新的主题或计算系统。三套完整皮肤按 v1.3 范围说明继续等待视觉稿。

## 验收结论与证据

**已通过**：最终应用代码的生产构建、TypeScript、lint（0错误，11条既有警告）、上海与温哥华各542项断言，以及本地19组完整浏览器验收。页面验收以 [逐组日志](evidence/acceptance-run.json)、下表实际操作及文件/数据库回读为依据。

**失败**：最终本地回归没有未解决失败。过程中手机Today主页入口缺失、帮助气泡叠加、输出单位变化后的旧复制面板已修复；CI两处过早读取恢复状态的断言改为等待实际恢复，未删除断言；一次并行构建导致既有聚类测试3056ms超过3000ms，独立重跑通过，未放宽门槛。[失败原始日志](evidence/failures/)保留。

**未执行**：真机与人员项目见后文，不能据工程通过宣布完整现场验收完成。

先前应用版本 `f813ef6` 的 [GitHub CI](https://github.com/annayzhu/LabNest/actions/runs/34103604474) 已通过双时区和浏览器作业；最新缓存修复版本 `9e58196` 的 [CI运行](https://github.com/annayzhu/LabNest/actions/runs/34105684516) 与最终证据提交检查均可从PR核对。

| 项目 | 结果与证据 |
|---|---|
| 正确性与数据保护 | 数值回归包含 100 µM→10/20 µM 各100 µL：原母液10/20 µL、稀释液90/80 µL；WB 10/5/1/4 µL、批量/百分浓度/定容警告。`pipetting-v12`、`refactor`、`storage-appearance` 页面流程与数量/操作单元断言。 |
| 实际复制 | [粘贴文本](evidence/clipboard-pasted.txt)、[UX报告](evidence/ux-report.json)：通过系统剪贴板和键盘粘贴至独立文本框；API不存在、兼容失败、手动全选、显示单位变化重新复制。 |
| 31 个工具 | UX报告逐工具列默认几何、无效输入和 CSV/XLSX；图片计数另有 [colony-report](evidence/colony-report.json)，实际合成图片检测/确认/保存及坏文件保护。 |
| Run 内容与状态 | [run-v12日志](evidence/logs/run-v12.log)、[Run报告](evidence/regression/v12/run-browser-report.json)：富文本标题下表A/表B各自归属，图片/列表/说明顺序；参数未提交13、备注和第二步计时状态往返恢复；后续UI参数保存12并独立数据库回读。 |
| 旧 Run 兼容 | [合成旧记录报告](evidence/regression/blockers/run-compat.json)：缺少块副本时使用对应冻结内容，纯文本旧记录明确格式丢失，不凭空补表。仅合成记录；未使用生产旧记录。 |
| 完整离线与同步 | [离线往返](evidence/regression/blockers/offline.json)、[integration](evidence/regression/core/integration-report.json)、[数据库](evidence/regression/v11/database-report.json)：离线 Run→主页→工具→原Run；断网新标签打开；恢复网络后真实 API 入库，重复 mutation 只返回同一 Result。全部写入隔离合成数据库。 |
| 旧缓存升级 | [cache-upgrade](evidence/cache-upgrade.json)：GET-only 同源临时代理加载实际旧版；更新资源503后离线旧页仍可计算，重试成功才发布v5并移除v4。worker单元测试另覆盖错误MIME、配额、超时、并发、回收和清理失败；[清除失败UI](evidence/cache-clear-report.json)验证负应答不假报成功，随后实际重试清除。没有变更在用站点部署。 |
| 输出与正式文件 | [UX报告](evidence/ux-report.json)中30工具的60个CSV/XLSX逐单元格一致；[正式格式报告](evidence/formal-exports/report.json)中Result CSV/XLSX/JSON的完整嵌套快照均与独立数据库读取一致；PDF已文字回读并逐页渲染查看。 |
| 图标与 Appearance | [映射报告](evidence/icons/report.json)：31资源、七配色明暗、32/40px实页、31个独立SVG故障回退；`appearance`/`standalone-v11`覆盖偏好、字体/间距、主应用与独立包。32/40px尺寸压力不当作缩放。 |

正式导出范围是计算器 CSV/XLSX 与保存 Result 的 CSV/XLSX/JSON、打印/PDF；仓库没有该流程的 DOCX 导出入口。PDF来自真实记录页的 Chromium print renderer，并非操作系统打印对话框。60份工具文件覆盖全部30个公式工具；图片计数工具已有保存数值/设置功能，不虚构其不存在的下载格式。

## 性能实测

性能原始对照版本为 `f813ef6`。随后 `63b8bb0` / `9e58196` 只修复缓存错误应答和失败清理；31工具交互/计算代码保持，最终19组页面回归另在最新版本执行。没有把之前的测量SHA改写成新版本。

[原始前后样本及哈希](evidence/performance-summary.json)、[环境](evidence/environment.json)。同机生产模式、相同例题，每工具10轮，期间没有并行构建/测试。数字是 Playwright 操作计时，不是手机输入延迟或原生 INP。常规扫描保留浏览器缓存；冷开/禁用缓存与弱网单列。30个公式工具CSV哈希完全相同，方法、结果和警告未因布局重构改变。

| 动作 | 旧版中位/最大 ms | 新版中位/最大 ms | 样本/阶段 |
|---|---:|---:|---:|
| 打开文档/控件 | 40.85 / 118.31 | 35.30 / 260.66 | 310 |
| 输入并恢复原值 | 6.79 / 14.20 | 6.53 / 32.52 | 300 |
| 示例计算 | 22.03 / 37.22 | 21.36 / 40.12 | 300 |
| 恢复草稿 | 23.09 / 62.85 | 22.85 / 65.36 | 300 |
| 返回目录 | 44.38 / 60.17 | 47.79 / 67.69 | 310 |

新版打开中位数减少；返回中位数和部分最大值没有改善，不宣称全面提速。所有常规扫描最大值仍在对应建议目标内。原始报告逐工具列出最慢项；图片工具的输入/检测另以同一900×900、225圆形合成图片前后各10轮，见 [image报告](evidence/performance-image.json)，计数均为225。

| 独立场景 | 冷开主页 ms | 打开/返回工具 ms | 图片检测 ms |
|---|---:|---:|---:|
| cold-local | 639.6 | 115.3 / 58.3 | 40.4 |
| weak-4g-cpu4 | 3843.3 | 461.3 / 451.3 | 76.4 |

弱网条件为150ms延迟、下载200000 B/s、上传90000 B/s、CPU4倍限速；主混液/单位换算/拟合另列计算时间。该合成图像尚未触发300ms门槛，未据此引入另一套Worker计算；不能推及所有手机或所有图片。`evidence/performance/`保存两份Playwright trace.zip与两份Chrome devtools.timeline JSON.gz，可复查网络、任务和操作；报告中的 longTasks 只对应最后一页，不能解释为整条流程没有长任务。

## 实页截图

截图来自实际生产模式页面。手机为自动化视口，不能代替真实手机；长截图中的固定导航仍处于当时视口位置。

| 场景 | 浅色 | 深色 |
|---|---|---|
| 桌面首页1440×900 | [查看](evidence/home-1440-light.png) | [查看](evidence/home-1440-dark.png) |
| 手机视口390×844 | [查看](evidence/home-390-light.png) | [查看](evidence/home-390-dark.png) |
| Run桌面 | [查看](evidence/regression/blockers/run-desktop-light.png) | [查看](evidence/regression/blockers/run-desktop-dark.png) |
| Run手机视口 | [查看](evidence/regression/blockers/run-mobile-light.png) | [查看](evidence/regression/blockers/run-mobile-dark.png) |

另有 [参数编辑为12的实页](evidence/run-parameters-12.png)、[WB输入与结果](evidence/tool-wb-loading.png)、[Today入口](evidence/icons/today-mobile.png)、[独立离线新标签](evidence/offline-new-tab.png)、[PDF第一页](evidence/formal-exports/saved-wb-1.png)、[PDF第二页](evidence/formal-exports/saved-wb-2.png)。31页图片命名为 `tool-<id>.png`；七配色32/40px的28张实际页面图片在 `evidence/icons/`。

## 尚未执行及验收影响

- **未执行**：真实手机软键盘、Safari/Chrome复制、100%与最高160%缩放、受信任HTTPS证书和真机离线、独立实验人员试用。本轮早先PC原生100%与150%已检查，最终版本复验因浏览器调试连接不可用未执行；精确160%未执行。见 [原生缩放记录](evidence/native-zoom.json)。原生桌面150%与CSS/手机模拟均不冒充真机160%。
- 用户确认没有已有HTTPS域名/证书。已交付 [HTTPS配置说明](HTTPS.md) 与 opt-in Caddy 配置，并验证 Compose 配置可解析；未启用证书或改变设备信任。
- [可直接操作的验收步骤](MANUAL.md)列出所需设备、预期数值和记录方法。这些未执行项阻止宣称完整现场验收关闭；不阻止其余已授权工程任务、PR审查。
- 仓库目前无账号/退出切换系统，CA-05该子项不适用；明确站点工作区共享语义，未添加未经要求的身份系统。
- 已修复过程中发现的问题见提交；最终仍失败项和CI状态以本报告汇总及日志为准。

## 复现

```sh
npm ci
npx prisma generate
TZ=Asia/Shanghai npm test
TZ=America/Vancouver npm test
npm run typecheck
npm run lint
LABNEST_BUILD_DIR=.next/calculator-production LABNEST_TSCONFIG_PATH=tsconfig.calculator.json npm run build
# DATABASE_URL 必须指向本机测试实例；启动器创建专用 acceptance 数据库。
node scripts/calculator-acceptance-server.mjs
# 另一个终端：
LABNEST_E2E_BASE_URL=http://localhost:3221 node scripts/verify-calculator-v13-acceptance.mjs
```

缓存升级、前后性能脚本默认旧版3000/新版3223，可通过 LABNEST_OLD_BASE_URL / LABNEST_E2E_BASE_URL覆盖；需要同时存在两份真实生产模式构建。性能扫描使用 PHASE=before/after，各31×10；图片计数使用相同225圆形合成图片单独10轮。
