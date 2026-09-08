# 2026-09-08 统一实施与验收清单

起点 main：`1aed227f34e0dbe3558fbb30fcd503aaaef3dd4a`。附件作为需求依据；2026-09-08最新用户校正优先。

C1图片保存/打印：**修复已合并，保留回归验收，核对原故障记录**。不重复修改已正确的算法/打印规则。PR #67 的14份PDF/18页及用户独立26项测试是已提供证据，原记录与真实打印机仍未执行。

A采购/Inventory、B共享UI、C字号/编辑器、D嵌入工具分别实施并提交PR。A计划见 A/PLAN.md。当前没有本轮合并、部署或生产数据操作授权。

| 编号 | 场景 | 初始现状 | 修改位置/验证版本 | 本轮方法与结果 | 证据/剩余问题 |
|---|---|---|---|---|---|
| T01 | 只记录实验 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-completion.json；无采购库存的合成Run在手机页面完成；创建用隔离DB夹具，非表单创建验收 |
| T02 | 只用采购 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/purchases.json, imports.json, xlsx.json, edge-cases.json; independent purchase/import/receipt and quote decision save/reload/download passed. |
| T03 | 只用库存 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/imports.json / xlsx.json；独立库存导入，起始余额用adjust而非假造到货；无需采购来源 |
| T04 | 同次Run混合管理 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-materials.json；未管理与精确库存同行记录，只有确认的精确用量扣减；已领瓶逻辑用接口和代码复核 |
| T05 | 数量未知 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/pages.json / unknown-green.log；信息模式保存刷新显示数量未记录，未知0不误报缺货；首次盘点见followup.json |
| T06 | 5瓶领出1瓶 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json / pages.json；5瓶领1→4/1，重试不重复；真实页面批量领2→3/2 |
| T07 | 开封、转交与归还 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；开封、转交、归还接口回读保留ID、开封日期和余量；批量领用在页面验证 |
| T08 | 估计余量 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；估计余量保存并回读登记人、时间及历史；可选实验关联已补页面验收：completion.json |
| T09 | 估计250变180 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；250→180不生成-70事务，不改变瓶数 |
| T10 | 用完 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；用完后状态empty，原瓶和事件保留 |
| T11 | 预计与实际不同 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-materials.json / followup.json；预计10µL与实际12000µL分别保存；执行12mL；页面编辑失败行和更正后回读账本 |
| T12 | 不足或换算缺参数 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-materials.json, run-completion.json, edge-cases.json; insufficient stock or missing concentration remains pending; Run can complete without deduction. |
| T13 | 重复点击与同步重试 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/browser-final.log / pages.json；扣减和领用重试一次执行；12+12并发成功执行断言；离线行同步后数量为1 |
| T14 | 失败实验、复制Run、更正 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表；本轮补齐见A/ACCEPTANCE.md | 通过 | A/evidence/followup.json, edge-cases.json; explicit correction and failed-status edit preserve ledger; completion.json: copy button creates new planned draft, no actual use/transactions; retries return same copy. |
| T15 | 分批采购收货 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/purchases.json / pages.json；2件不入库+3件新入库，累计5；发票待补独立；页面部分收货回读通过 |
| T16 | 独立导入与重复导入 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/imports.json / xlsx.json / browser-final.log；CSV/XLSX独立导入，映射更改使确认失效，同文件重导拒绝；余额180+到货20=200 |
| T17 | 后补采购库存关联 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/followup.json；后补采购库存关联前后库存数相同 |
| T18 | 报销与报价不同 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/purchases.json / followup.json；实际CSV按真实金额导出、候选排除，改价后旧快照字节一致；school-export.json及export-formats.json已补学校XLSX和采购/库存CSV、XLSX、JSON逐文件回读 |
| T19 | 老数据兼容 | 已有实现并补验证 | 7bc8b4c（A补齐）；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/legacy.json；35项迁移，5类合成旧记录逐字段比较；旧ID/交易/实验/分装/附件引用保留；非真实旧记录或附件字节测试 |
| T20 | 全站平整布局 | 保留正确实现并补齐 | 联合应用071df83 | 通过：30路由四视口/模式组合；平整分组、设置导航 | B/evidence/coverage.json；截图不是逐页功能验收 |
| T21 | 上下文属性切换 | 保留正确实现并补齐 | 联合应用071df83 | 通过：单一portal属性面板、原表单所有权、草稿、固定、手机覆盖 | B/evidence/shared.json；C图片保存回读 |
| T22 | 大量关联Protocol | 保留正确实现并补齐 | 联合应用071df83 | 通过：8个Protocol摘要3项，批量增删后7关联8原记录 | B/evidence/shared.json；保留既有其他关联计数分页 |
| T23 | 紧凑数值单位 | 保留正确实现并补齐 | 联合应用071df83 | 通过：同排控件；180mL=180000µL；旧包装与首次盘点、复合自定义单位 | B/evidence/unit-compat.json |
| T24 | 输入边界与手机 | 保留正确实现并补齐 | 联合应用071df83 | 部分通过／未执行：空值、指数、负数与CSS160%通过；真机IME/键盘/160%未执行 | B/evidence/coverage.json；模拟不是硬件证据 |
| T25 | 图片保存全流程 | 保留正确实现并补齐 | 联合应用071df83 | 通过／原记录未执行：六正文+结果模板保存刷新重编实际decode，Run图片，预览失败回退 | docs/editor-repair/evidence/acceptance.json；原故障记录未访问 |
| T26 | 中文图注 | 保留正确实现并补齐 | 联合应用071df83 | 部分通过／未执行：中文图注模拟组合事件、保存、替换、键盘选中属性通过 | 真实拼音候选完整输入未执行 |
| T27 | 全文字号 | 保留正确实现并补齐 | 联合应用071df83 | 通过：六入口全字号、嵌套说明双向全文、保存回读 | C/evidence/font-all.json、nested.json |
| T28 | 表格字号 | 保留正确实现并补齐 | 联合应用071df83 | 通过：单格、多格、整行、整表与混合字号；数值保持 | C/evidence/text.json |
| T29 | 打印与正式导出 | 保留正确实现并补齐 | 联合应用071df83 | 通过／真机未执行：12字号PDF、共享图片编辑/只读PDF逐文件文本图像检查、Protocol DOCX解包 | C/evidence与docs/editor-repair/evidence；真实打印机未执行 |
| T30 | 四个嵌入工具 | 保留正确实现并补齐 | 联合应用071df83 | 通过：四工具真实导入与下载回读，排板保存返回重开 | D/evidence/file-checks.json、16截图；未承诺分析工具未保存状态跨导航恢复 |
| T31 | 卡片入口 | 保留正确实现并补齐 | 联合应用071df83 | 通过：整卡链接键盘Enter，Preview独立，返回目录 | D/evidence/tools-inventory.json；原卡片无收藏按钮 |
| T32 | 共享修改回归 | 保留正确实现并补齐 | 联合应用071df83 | 通过：生产构建/类型/双时区/Calculator及编辑器浏览器 | evidence/最终日志；远端B/C/D两工作流均success，精确SHA与运行ID见DELIVERY.md |

最终联合应用757a5b6；完整22阶段Calculator验收本地与远端均通过。T32以DELIVERY.md最终版本表为准，前述071df83为页面/PDF初验批次。
