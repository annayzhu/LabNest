# Calculator UI 2026-10-07 验收

基线main：`91fc4b6e9159687f529215266654a096fc0c8053`。最终应用源与全部本地自动验收：`81813d5950ff2d7ae454866fb15c918a0e28be63`（之后仅证据/验收脚本修改）；隔离生产构建 `sttEqHmQvAEua_yHuTpSd`。实际目录 `/Users/annayzhu/Documents/Playground/LabNest`，next start端口3221，隔离合成数据库。部署前正式3001的CalculatorWorkspace/globals.css运行hash与基线一致，保证修改前截图来自真实旧版。

## 逐项结果

| 项 | 结论 | 实际结果及证据 |
|---|---|---|
| A01 | 通过 | 当前31独立、2别名、6独立孔板适配器；TOOL_MATRIX.md |
| A02 | 通过 | 132个实际页面组合；空白、示例、计算、逐区点击；无异常或页面横向溢出 |
| A03 | 通过 | Tools/Today/真实合成Run抽屉/孔板/FreePlate共用关系；entries/report.json |
| A04 | 通过 | comparable16张同例、同视口、同主题前后图；state的8份录屏/trace覆盖反应配液和稀释 |
| B01 | 通过 | icons-small.png查看16/20/24px和反白；透明镂空检查 |
| B02 | 通过 | 46SVG，31专属工具映射；附件16SVG逐文件hash一致 |
| B03 | 通过 | 组分、组、样品、曲线点的增加按钮在所属标题右侧，逐页记录 |
| B04 | 通过 | 主计算、次操作、管理、增加、删除、radio、disclosure采用不同语义 |
| B05 | 通过：模拟窄屏 | 390/320/768/1280 CSS像素；窄屏控件44px；真机另列 |
| B06 | 通过 | radio键盘、Escape回焦、安全收起、真实上传控件可见焦点 |
| C01 | 通过 | 真正单组/多组radio、可见当前选中状态 |
| C02 | 通过 | 54历史模式实际恢复、计算、输出值/历史回读；多选项保持原生select |
| C03 | 通过 | 3×2+1计数保留；多组独立保留；多组-only须选择来源；空当前模式可刷新恢复备用组 |
| C04 | 通过 | 修改/校验失败移除当前结果、复制、导出；旧快照保护及拒写回归 |
| C05 | 通过 | 原生radio ArrowLeft实际改变选中；fieldset/legend语义 |
| D01 | 通过 | 所有实际select appearance none、右留40px、箭头距右12px |
| D02 | 通过 | µL/mL及长选项、两浏览器桌面/窄屏、独立版同规范 |
| D03 | 通过 | 真正输入1e禁用单位；聚焦/错误/禁用箭头位置不变；type-ahead键盘切换生效 |
| D04 | 桌面/模拟通过；真机未执行 | Chromium/WebKit鼠标、键盘可用；未将模拟记为手机OS弹层验收 |
| E01 | 通过 | 删除余量重复容器，作用范围移到字段旁；其他说明按内容保留 |
| E02 | 通过 | 设备、步进、还原剂、来源、警告、单位及组分差异保留；科学核心11文件hash不变 |
| E03 | 通过 | 所有实际可见disclosure点击，computed 0s、getAnimations 0 |
| E04 | 通过 | 普通no-preference系统动效下立即显示，父容器无动画 |
| E05 | 通过 | 两浏览器/两宽度/两主题，8帧标题x/y稳定且scroll不变 |
| E06 | 通过 | 下限1、步进0.5保留；Escape回焦；收起摘要可见；稀释0.5同样保留 |
| F01 | 通过 | 120组修改前后真实数字token一致；54模式独立输出断言；科学hash不变 |
| F02 | 通过 | 空白、示例、预设、草稿、重复展开、切换；修复嵌套转染及备用模式恢复 |
| F03 | 通过 | 设备未设置/设置/重复开启，漏报误报/舍入回归；无默认算法变更 |
| F04 | 自动化通过；真机IME未执行 | 复制/CSV/XLSX/JSON/PDF、中文字符串、单位、窄屏结果及错误定位；真实软键盘另列 |
| F05 | 通过 | 此表、失败分析、未执行项分列；验证源81813d59 |

## 证据与页面

- [全部工具矩阵](TOOL_MATRIX.md)、[逐控件巡检](evidence/after/inventory.json)、[入口34项](evidence/entries/report.json)。
- [验证版本](evidence/validation-version.json)、[实际数字120组](evidence/numeric-comparison.json)、[54模式的输入/输出回读](evidence/modes/report.json)。数字token比较仅证明渲染内容一致，不替代54用例及算法测试中的独立数值断言。
- [状态、焦点、字号和稳定标题80项](evidence/state/report.json)。state中8个trace.zip和videos中的8份webm同时录制反应配液/稀释；可用 `npx playwright show-trace <trace.zip>` 回放。静态图不充当动画证据。
- [选择器状态/键盘](evidence/selectors/report.json)、[图标来源](evidence/icon-provenance.json)、[小尺寸及反白](evidence/icons-small.png)、[科学核心hash](evidence/math-source-hashes.json)。
- [25组回归及每组日志](evidence/regression/acceptance-run.json)。双时区各559项/114文件通过，TypeScript通过，lint0错误/12已有警告，生产构建通过；日志在evidence/quality。测试数量不替代逐项页面结果。
- formal-exports的CSV/XLSX/JSON嵌套快照与独立DB回读逐值相等；PDF2页文本包含数值、单位、组分、来源及警告，第一页实际渲染查看。[PDF回读](evidence/regression/regression/v13/formal-exports/pdf-readback.json)。
- 旧Run/旧快照、离线同步/重复提交/数据库回读沿用科学和保护断言重跑，见regression/core、v12、v13、blockers。使用明确标记的合成记录，未访问原用户故障记录。

同一内置反应配液例题、相同CSS视口及主题的实际viewport截图：

| 场景 | 修改前 | 修改后 |
|---|---|---|
| Chromium桌面浅色 | [前](evidence/comparable/before-chromium-1440-light.png) | [后](evidence/comparable/after-chromium-1440-light.png) |
| WebKit桌面深色 | [前](evidence/comparable/before-webkit-1440-dark.png) | [后](evidence/comparable/after-webkit-1440-dark.png) |
| Chromium窄屏浅色 | [前](evidence/comparable/before-chromium-390-light.png) | [后](evidence/comparable/after-chromium-390-light.png) |
| WebKit窄屏深色 | [前](evidence/comparable/before-webkit-390-dark.png) | [后](evidence/comparable/after-webkit-390-dark.png) |

## 失败与处理

最终自动验收失败项：无。首次回归的旧文案/选择器定位和旧图标PNG断言失败，已更新为当前radio/disclosure和Settings仍支持的旧资源fallback；科学数值及保护断言保留。旧合成梯度草稿没有单位，保护规则正确拒绝；只为已知单位夹具补充µM，没有绕过真实旧记录确认。别名用例曾尝试保存示例，被写保护拒绝；改为从空白实际输入并回读本机历史。200.00000000000003µL使用1e-9µL浮点容差，没有改变应用输出。

54模式页面测试检出基线仅含嵌套转染对象时不提供恢复草稿；已修复并重跑全部54用例。双轴审查还补齐“当前模式为空、备用模式有输入”的恢复保护；见[REVIEW.md](REVIEW.md)。首轮科学计算测试失败与后来修复后的通过分别保留，未把失败覆盖成原本通过。

## 未执行及影响

- 真实手机OS选择器弹层、软键盘/拼音候选回车、实际触控、实验人员试用：未执行。390px/WebKit是模拟自动验收；D04/F04真机部分仍开放。
- 最终81813d59的原生桌面200%复测：未执行。此前449ec041在用户Chrome真实200%缩放下计算26反应/514.8µL/18µL、无横向溢出；随后Mac锁定，最终截图、复位及更新后的复测无法完成。[原始receipt](evidence/native-zoom.json)明确保留旧验证版本，没有改标成最终版。最终版320px/768px拥挤布局已重测。
- 真实打印机/OS打印对话框、原用户故障历史记录：未执行，不以合成PDF/记录代替。

真机快速验收：同局域网打开正式计算器→反应配液载入示例→拼音编辑中文组分→单/多组往返并刷新恢复草稿→展开移液设置输入1和0.5、收起再开→切换单位→计算、复制→手机放大至160%，检查文字完整及无页面横向滚动。桌面用浏览器真实200%重复计算和展开，结束复位100%。记录设备、浏览器、缩放与异常。

## 复现

`LABNEST_BUILD_DIR=.next/calculator-ui-20261007-production LABNEST_TSCONFIG_PATH=tsconfig.calculator.json npm run build`；启动隔离环境 `node scripts/calculator-acceptance-server.mjs`。设置 `LABNEST_E2E_BASE_URL=http://localhost:3221`，运行verify-calculator-v13-acceptance、ui-consistency-20261007、ui-state-20261007、ui-entries-20261007、ui-selectors-20261007、ui-modes-20260915脚本。

v13用`CALCULATOR_EVIDENCE_DIR`隔离报告，mode用`CALCULATOR_MODE_EVIDENCE_DIR`隔离报告。旧版截图脚本要求明确提供已经核验的旧运行地址/版本；正式部署后不得把当前地址标为旧版。

GitHub精确HEAD CI、合并、正式部署源hash和LAN入口验证另记RELEASE.md。源码存在、页面存在、PR合并均不代替运行验收。
