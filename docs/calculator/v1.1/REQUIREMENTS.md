# Calculator v1.1 逐项核对与验收

## 基线与边界

- 原工作目录 HEAD：`3d140158da0b8a685e74fb054fe55d4c0d89b673`，另有用户的 CSS、研究计划和 i18n 修改。本轮未改动该工作目录。
- 本轮干净工作树基于 main：`bb99faac59b0b7d4b36054c117f75b790147d6ca`；分支 `codex/calculator-appearance-v11`。已再次 fetch 核实该 main。
- 实现提交：`18b1db80152f1f7a02799e377fb4440f8443ec30`；展示与偏好保护补丁：`c4c806fe5d81e6db569e8757badc3a4c7666c0da`；焦点对比度补丁：`fc019e690e685418654cfb1c35aa58cc86b8aad3`。最终测试 HEAD、命令、退出码见 [run-summary.json](evidence/run-summary.json)。后续证据提交只增加文档与日志，不改运行代码。
- 已完整阅读 [v1.0](../spec-v1.0.md)、[v1.1](../spec-v1.1.md) 和适用 AGENTS.md。文档作为用户指定的需求材料，不作为额外授权来源。
- 实际依赖：Next 16.2.10 / React 19.2.7 / Prisma 7.8.0 / Vitest 4.1.10 / Playwright 1.61.1 / write-excel-file 4.1.1，Node v22.23.1、npm 10.9.8。见 [依赖记录](evidence/dependencies.log)。使用已安装 Next 的 use-client、Script 文档及 write-excel-file/browser 的实际导出 API。
- 沿用既有计算引擎、quantities、Result、同步队列、system-theme ID 与 ui-scale。未新增平行计算、单位、账号或实验记录系统。Appearance 仅参考官方 [Settings 说明](https://learn.chatgpt.com/docs/reference/settings) 的分组方式，不声称逐像素复刻，也不把图标套件称为 Codex 原有功能。

## 需求核对

| 需求 | 基线 / 复用 | 本轮实现与证据 | 状态 |
|---|---|---|---|
| SAFE-01 | 原备份失败保护不足；保留原存储 key 与历史结构 | Storage 实例的粘性保护、原字节备份读回、显式恢复、源版本比对；损坏单条记录也不静默丢弃。S01–S08 单测及真实浏览器故障注入 | 已实现；自动验收通过 |
| WB-01 | 复用 batchPlan 和 Result | 独立 wbPlan 记录四组分、还原剂名称/定义/原液条件、总量；明确 Buffer 是否已含；无效行空值；旧不完整快照标记 | 已实现；V02/V03/I06 通过 |
| PIP-01 | 复用 quantities；移除按显示单位/字段后缀猜测操作 | 结构化 add/transfer/dispense，统一 µL 比较；理论/实际分离；非零舍入为0不可执行；汇总量不作为移液操作 | 已实现；V04/V05 通过 |
| UNIT-01 | 复用原量纲校验和未舍入规范值 | 输出及批量列的显示单位、数值字符串转换、科学计数法；历史仅临时转换，草稿可恢复 | 已实现；V06/V09/I01 通过 |
| COPY-01 | 复用单一结果对象与同步队列 | 页面、复制、CSV、XLSX、实验快照共享输出；保留状态/方法/输入/关联/警告/假设；手动复制回退；服务器拒绝删警告的伪造快照 | 已实现；V07/V08/I03–I06 通过 |
| HOME-01 | 保留默认顺序、既有收藏与全部工具 | 默认六格；3×2/6×1；按钮排序；八项收藏不截断；主动清空不恢复默认 | 已实现；U01–U03/U10 通过 |
| HELP-01 | 复用任务说明与方法元数据 | 300ms hover/focus、可移入 tooltip、Escape；原生 dialog 加显式 Tab 循环与返回焦点 | 已实现；U05–U07 通过 |
| ICON-01 | 保留 Lucide 回退 | 六个独立 Image Gen 图案，原图/提示词/哈希留档，统一解析、同尺寸回退；Today/首页/标题一致 | 已实现；U08/U09/U15/I07 通过 |
| APP-01 | 保留旧主题、字号 key 和 ID | 单一 Provider；明暗/方案分离；UI/数据字体；本机迁移、跨标签页、系统变化、未知数据保护、只重置外观；科学图保持固定可读画布和数据配色 | 已实现；U11–U16 自动部分通过 |
| VERIFY-01 | v1.0 数值用例、31 旧入口、原离线/孔板/编辑器验收复用 | 隔离数据库、下载解析、数据库回读、队列拒绝、两时区全仓测试、CI 工作流及日志 | 本机核心通过；全仓时区门槛有既有失败；人工与 CI 状态另列 |

## 用例与证据索引

| 用例 | 证据 | 结论 |
|---|---|---|
| V01 / S01–S08 | `src/lib/calculators/v11-safety.test.ts`；[存储浏览器报告](evidence/storage-browser-report.json)；[故障原文](evidence/protected-original.json) | 单测全部通过；备份故障→恢复写能力→换工具→临时计算→拒绝保存→显式恢复的浏览器链路通过 |
| V02–V05 | `v11-safety.test.ts`；[WB CSV](evidence/wb.csv) / [WB XLSX](evidence/wb.xlsx) | 10+5+1+4=20 µL；0.1 µL 低于 1 µL；等值/零/负值/舍入边界通过 |
| V06–V09 | `v11-output.test.ts`；[浏览器报告](evidence/appearance-browser-report.json)；[补充操作报告](evidence/followup-report.json) | 20 次往返；警告稳定；旧快照字节不变；重算新建关联记录；输入无效立即撤销复制/保存 |
| V10 | [旧入口报告](evidence/v1.0-regression/legacy-report.json)；最终全仓单测日志 | v1.0 数值回归、31 旧 ID、旧收藏/深链接通过；不以 HTTP 存在替代所有计算用例 |
| U01–U03 | [逐格几何数据](evidence/appearance-browser-report.json)；`home-en-*` / `home-zh-*` 截图 | 中英文 320×568、360×640、390×844、768×900、1440×900 通过；小屏满足半屏公式 |
| U04 | [视觉报告](evidence/visual-report.json)；横屏/200% CSS zoom 截图；编辑器回归 | 横屏、大字体及 CSS zoom 模拟覆盖；真实浏览器缩放与手机软键盘仍待人工 |
| U05–U07 | [浏览器报告](evidence/appearance-browser-report.json) | hover、移入、Escape、逐项键盘 focus、Enter、dialog Tab 循环和焦点返回通过 |
| U08–U10 | [浏览器报告](evidence/appearance-browser-report.json)；[补充报告](evidence/followup-report.json) | 三处图标资源一致；损坏图即时回退且几何不变；缺专用资源使用线性图标；8/2/0 收藏通过 |
| U11–U15 | [存储报告](evidence/storage-browser-report.json)；[补充报告](evidence/followup-report.json)；[视觉报告](evidence/visual-report.json) | 刷新/换页/跨标签、系统与显式模式、迁移/未知结构/写失败、仅外观重置、前三帧 root 属性通过；A4 真实 DOM/字体/颜色保持 |
| U16 | `src/lib/appearance.test.ts`；[实际颜色与截图报告](evidence/visual-report.json) | 7方案×2模式；正文/按钮/警告≥4.5，必要控件≥3；不是完整无障碍认证 |
| I01–I02 | [原流程回归](evidence/v1.0-regression/browser-report.json) | 输入单位/草稿恢复；在线缓存后断网刷新和计算通过，仅承诺已缓存页面 |
| I03–I04 | [同步报告](evidence/v1.0-regression/integration-report.json)；[数据库报告](evidence/database-report.json) | 离线意图保留 nL 显示和结构化警告；重连落库；相同 mutation 恰一条关联 Result |
| I05 | [拒绝报告](evidence/rejection-report.json)；同步报告 | 步骤不存在、实验归档、来源拒绝、伪造快照拒绝；本机冲突意图保留且原因可见。现有 API 无登录账号/RBAC 层，不声称通过账号切换权限测试 |
| I06 | [数据库报告](evidence/database-report.json)；CSV/XLSX与 WB 截图 | 页面→复制→文件解析→真实隔离数据库回读一致 |
| I07 | [独立版报告](evidence/standalone-report.json) | 六模块真实按钮计算；移液警告/单位；本来源图标偏好；独立缓存后断网刷新再计算 |

## 图标资产

六个正式 PNG 均为 128×128，真实 alpha；归一化到一致透明留白，合计 **10,358 bytes**，每个远低于 30 KB。源图与修订记录见 [生成记录](icons-generation.json)，含真实工具 `image_gen.imagegen`；后台模型未由工具提供，不推测版本。反应配液图顶部裁切曾被发现并重新生成，未将该裁切版本用于正式资源。

[资产校验](evidence/icon-assets.json)记录尺寸、alpha 比例、边界、字节数、SHA256。已实际查看 [28/32/40px 明暗对照](evidence/icon-contact-sheet.png)，没有用六宫格裁切替代单图资产。深色采用统一中性底板，未反色图案。

## 测试门槛与尚未验证

- Lint：退出0，11 warnings / 0 errors；Typecheck：退出0；生产 Build：退出0。
- 全仓 Asia/Shanghai：90 files / **490 tests passed**，0 skipped。
- 全仓 America/Vancouver：89 files passed、1 failed；**489 tests passed / 1 failed**，0 skipped。失败为库存到期日期，未修改或缩小测试来隐藏。
- 基线 `bb99faa` 同一库存用例已复现，见 [基线日志](evidence/baseline-vancouver.log) 与 [Issue #54](https://github.com/annayzhu/LabNest/issues/54)。原因是 date-only 字符串解析为 UTC 零点后与本地零点比较，负时区可能提前判定到期。它影响全仓双时区门槛，不是 Calculator 数值回归。
- 最终核心浏览器/数据库验收退出0；核心用例无条件静默跳过数0。焦点检测首次沿用鼠标输入状态，没有进入 `:focus-visible`；原失败保留，修正为键盘输入状态后14种组合重跑通过，见 run-summary 的 rechecks。每条实际命令、退出码和耗时以 [run-summary.json](evidence/run-summary.json) 为准。
- CI 已实际运行：[run 34004968337](https://github.com/annayzhu/LabNest/actions/runs/34004968337)，源码 HEAD `5d502a0890bdaae86c71691bc013940fac19fe26`。上海 quality 成功；温哥华 quality 因同一库存用例失败（489通过/1失败）。browser 作业被前置门槛阻止而跳过，因此**远端浏览器验收未运行，不能声称 CI 通过**。见 [CI记录](evidence/ci-report.json) 与 [实际失败日志](evidence/ci-vancouver-tests.log)。后续证据提交的运行代码相同。
- **待人工**：真实 iOS Safari / Android Chrome 及软键盘遮挡，真实浏览器200%缩放；3–5名实验人员体验试用。没有编造设备、使用时间或成功率。
- 图表类别映射和文档内容未改；Calculator 科学图的配色与固定可读画布已验证。未执行 Visualization Studio 全产品回归，不声称其所有独立发布目标已验收。

## 重跑

使用 Node 22、锁文件安装依赖并生成 Prisma。数据库必须是本机合成验收库；`scripts/calculator-acceptance-server.mjs` 将连接切换到 `labnest_calculator_acceptance_20260906` 后迁移并创建固定实验/步骤，核心 fixture 缺失会失败。操作人是 `Acceptance fixture operator`，对应现有 API 的明确用户录入字段，不是虚构登录账号。

```sh
npm ci
npx prisma generate
npm run lint
npm run typecheck
TZ=Asia/Shanghai npm test
TZ=America/Vancouver npm test
LABNEST_BUILD_DIR=.next/calculator-production LABNEST_TSCONFIG_PATH=tsconfig.calculator.json npm run build
node scripts/calculator-acceptance-server.mjs
```

另一个终端设置 `LABNEST_E2E_BASE_URL=http://localhost:3221`，按 run-summary 中顺序执行对应脚本；`verify-calculator-database.mjs` 必须在 appearance 与 integration 脚本之后，因为它严格读取本轮生成的 Result ID。补充验收可运行 `node docs/calculator/v1.1/evidence/followup-checks.mjs`。只重建图标可运行 `node scripts/build-calculator-icons.mjs`；它使用已提交原图，不再次请求生成。

## 交付状态

[PR #55](https://github.com/annayzhu/LabNest/pull/55) 为草稿，尚未合并。代码与证据在 `codex/calculator-appearance-v11`。验收环境端口3221只用合成数据库。正式端口3000仍为已部署 main `bb99faac59b0b7d4b36054c117f75b790147d6ca`；本轮未将验收环境冒充正式部署，也未覆盖原工作目录的其他功能修改。

发布关联：`ca93c18d88d2a44496abfdf5a92ef8a6e4de723d` 合入同内容 CI 配置；`5d502a0890bdaae86c71691bc013940fac19fe26` 仅修正焦点测试的键盘输入状态。src/public/依赖/CI 的树哈希与全量验收提交相同，见 run-summary.runtimeTreeEquivalence。证据提交不改变运行代码。
