# 2026-09-08 统一实施与验收清单

起点 main：`1aed227f34e0dbe3558fbb30fcd503aaaef3dd4a`。附件作为需求依据；2026-09-08最新用户校正优先。

C1图片保存/打印：**修复已合并，保留回归验收，核对原故障记录**。不重复修改已正确的算法/打印规则。PR #67 的14份PDF/18页及用户独立26项测试是已提供证据，原记录与真实打印机仍未执行。

A采购/Inventory、B共享UI、C字号/编辑器、D嵌入工具分别实施并提交PR。A计划见 A/PLAN.md。当前没有本轮合并、部署或生产数据操作授权。

| 编号 | 场景 | 初始现状 | 修改位置/验证版本 | 本轮方法与结果 | 证据/剩余问题 |
|---|---|---|---|---|---|
| T01 | 只记录实验 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-completion.json；无采购库存的合成Run在手机页面完成；创建用隔离DB夹具，非表单创建验收 |
| T02 | 只用采购 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/purchases.json, imports.json, xlsx.json, edge-cases.json; independent purchase/import/receipt and quote decision save/reload/download passed. |
| T03 | 只用库存 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/imports.json / xlsx.json；独立库存导入，起始余额用adjust而非假造到货；无需采购来源 |
| T04 | 同次Run混合管理 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-materials.json；未管理与精确库存同行记录，只有确认的精确用量扣减；已领瓶逻辑用接口和代码复核 |
| T05 | 数量未知 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/pages.json / unknown-green.log；信息模式保存刷新显示数量未记录，未知0不误报缺货；首次盘点见followup.json |
| T06 | 5瓶领出1瓶 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json / pages.json；5瓶领1→4/1，重试不重复；真实页面批量领2→3/2 |
| T07 | 开封、转交与归还 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；开封、转交、归还接口回读保留ID、开封日期和余量；批量领用在页面验证 |
| T08 | 估计余量 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；估计余量保存并回读登记人、时间及历史；可选实验关联已补页面验收：completion.json |
| T09 | 估计250变180 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；250→180不生成-70事务，不改变瓶数 |
| T10 | 用完 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/containers.json；用完后状态empty，原瓶和事件保留 |
| T11 | 预计与实际不同 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-materials.json / followup.json；预计10µL与实际12000µL分别保存；执行12mL；页面编辑失败行和更正后回读账本 |
| T12 | 不足或换算缺参数 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/run-materials.json, run-completion.json, edge-cases.json; insufficient stock or missing concentration remains pending; Run can complete without deduction. |
| T13 | 重复点击与同步重试 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/browser-final.log / pages.json；扣减和领用重试一次执行；12+12并发成功执行断言；离线行同步后数量为1 |
| T14 | 失败实验、复制Run、更正 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表；本轮补齐见A/ACCEPTANCE.md | 通过 | A/evidence/followup.json, edge-cases.json; explicit correction and failed-status edit preserve ledger; completion.json: copy button creates new planned draft, no actual use/transactions; retries return same copy. |
| T15 | 分批采购收货 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/purchases.json / pages.json；2件不入库+3件新入库，累计5；发票待补独立；页面部分收货回读通过 |
| T16 | 独立导入与重复导入 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/imports.json / xlsx.json / browser-final.log；CSV/XLSX独立导入，映射更改使确认失效，同文件重导拒绝；余额180+到货20=200 |
| T17 | 后补采购库存关联 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/followup.json；后补采购库存关联前后库存数相同 |
| T18 | 报销与报价不同 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/purchases.json / followup.json；实际CSV按真实金额导出、候选排除，改价后旧快照字节一致；school-export.json及export-formats.json已补学校XLSX和采购/库存CSV、XLSX、JSON逐文件回读 |
| T19 | 老数据兼容 | 已有实现并补验证 | d5ba793071306f7c55d6e0b0f7ac2381ecae7af6；A/ACCEPTANCE.md位置表 | 通过 | A/evidence/legacy.json；35项迁移，5类合成旧记录逐字段比较；旧ID/交易/实验/分装/附件引用保留；非真实旧记录或附件字节测试 |
| T20 | 全站平整布局 | 需要修改 | 待逐线核对 | 未执行 | 主页面、侧栏及弹出面板无装饰性卡片嵌套 |
| T21 | 上下文属性切换 | 需要修改 | 待逐线核对 | 未执行 | 一个主要面板，设置对应选中对象，草稿不丢 |
| T22 | 大量关联Protocol | 需要修改 | 待逐线核对 | 未执行 | 摘要可控，搜索与批量管理可用，解除不删除 |
| T23 | 紧凑数值单位 | 需要修改 | 待逐线核对 | 未执行 | 各入口对齐、可编辑，180mL换单位物理量不变 |
| T24 | 输入边界与手机 | 需要修改 | 待逐线核对 | 未执行 | 空值、科学计数、中文输入、键盘及160%缩放可用 |
| T25 | 图片保存全流程 | 已完成且有证据 | 待逐线核对 | 未执行 | 保存刷新、只读和再编辑后图片实际加载 |
| T26 | 中文图注 | 需要修改 | 待逐线核对 | 未执行 | 输入法确认、混输与保存正常，属性不常驻正文下方 |
| T27 | 全文字号 | 部分实现并验证 | C 分支未提交工作区，基于 1aed227 | 实验编辑页及保存刷新通过；其他入口未执行 | C/evidence/text.json；嵌套说明、跨入口、导出仍待验收 |
| T28 | 表格字号 | 部分实现并验证 | C 分支未提交工作区，基于 1aed227 | 单格、整行、整表页面操作通过；多格未执行 | C/evidence/text.json；不能据此关闭整项 |
| T29 | 打印与正式导出 | 已有实现但缺验证 | 待逐线核对 | 未执行 | 编辑及只读输出非空，图片、表格、字号正确 |
| T30 | 四个嵌入工具 | 需要修改 | 待逐线核对 | 未执行 | 逐一站内打开，导入、下载、尺寸与返回正常 |
| T31 | 卡片入口 | 需要修改 | 待逐线核对 | 未执行 | 整卡可进入，收藏不误跳转，键盘可用 |
| T32 | 共享修改回归 | 已有实现但缺验证 | 待逐线核对 | 未执行 | 已合入Calculator及其他共用入口无对应功能回归 |
