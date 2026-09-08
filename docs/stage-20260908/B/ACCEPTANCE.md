# B 共享界面验收

PR #71，依赖 A #69。联合应用代码验证版本 071df83；后续合并仅整理相同代码和证据，应用目录差异为空。

| 项目 | 结果及实际证据 |
|---|---|
| 平整布局 | 通过：共用 Card 分隔线、设置分类导航；30个路由×桌面/手机×浅色/深色，HTTP200、无根页面溢出或页面异常，evidence/coverage.json。截图不是逐页功能验收，功能项另列。 |
| 单一属性面板 | 通过：关闭/重开保留物料草稿，固定状态、手机覆盖层；图片和元数据通过保存/回读；portal 控件仍归属原 form。evidence/shared.json、properties-mobile.png。 |
| 大量关联 | 通过：8个合成 Protocol，摘要3项，搜索/筛选/批量添加/解除，未保存标题保留；保存后7条关联、8个原始 Protocol。历史 Run 版本未改写。 |
| 数值单位 | 通过：180mL→180000µL，未完成指数保留但不能提交，负数非法，空值仍空。既有5bottle保存仍5；未知余额首次盘点建立180mL并回读；支持空量时选择质量或自定义单位。evidence/unit-compat.json。 |
| 原有 Calculator/表格 | 保留原有单位和表格系统；Calculator 浏览器回归见总报告；多格字号不改数值见C。 |
| 真机 | 未执行：物理键盘/中文候选完整过程、真机160%缩放、实验人员试用。CSS160%只是模拟，不代替真机。 |

主要代码：ContextProperties、QuantityInput、DocumentEditorLayout/Workspace、ResearchPlanProtocolPicker、InventoryItemForm/Containers、PurchaseRecordForm、RunMaterials、Card、settings/page。低频供应与追溯字段折叠；高频实际量和余量仍在主界面。跨维度不臆造换算，需清空数量再明确设置新材料单位。

覆盖表由 coverage.json 提供逐路由状态，coverage-*.png 为实际页面。已人工查看采购桌面浅色、设置桌面深色、实验手机、手机属性面板；其余图生成并自动检查，未逐张人工审美复核。复现脚本 verify-stage-properties、verify-stage-shared、verify-stage-unit-compat、verify-stage-coverage；仅隔离3235和合成数据库。


最终单位菜单修复应用 `20e8855f56b252297ecd98d96da0be74f3493d4b`；仅限制已有账本可选维度，C/D代码未变。该版本生产构建、类型、双时区各577测试、eslint、共享交互与库存/Run单位页面回读重新通过。全面C/D页面及文件验收版本仍为071df83，不能混淆两个验证批次。日志ledger-final-*与ledger-unit-menu.json。
