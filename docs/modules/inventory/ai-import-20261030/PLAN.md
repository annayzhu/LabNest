# 库存：AI 识别入库（表格列对应、发票 / 送货单 / 标签、粘贴文字）

日期：2026-10-30
前一批：[批量操作、重复检查与产品合并](../bulk-duplicates-20261030/PLAN.md)（已发布 `c76a28b5`）
状态：Q156–Q157（前一批 Q158 定为下一批）及细节 Q159–Q165 用户确认按推荐（2026-10-30）；追加 Q166–Q171（领用、库位、导入模板、类型字段中文）、Q172–Q178（数量小数位、浓度、登记已有产品、类型标签）按推荐；Q173/Q174 并入库存主页的设计（Q179 起）；其余均已实施；2026-10-31 用户要求把 3002 上的改动与样本模块一起合并到 3001 并推到 GitHub，与主页、序列并入产品同一个提交发布。已于 2026-10-31 随样本模块发布到 3001（`19ad19a3`）。

## 1. 已确认的决定

| 问题 | 决定 |
|---|---|
| Q159 入口 | 都在“导入库存”页：表格（模板或任意表格）、发票 / 送货单 / 标签（图片或 PDF，最多 10 个）、粘贴文字；不另开页面 |
| Q160 入库方式 | 识别结果是一张可逐行修改的入库草稿；确认后走现有导入的校验与写入：每行按“到货”记入库流水，按品牌 + 货号或所选产品归到产品，同一文件不能导入两次，原文件作为导入来源保存 |
| Q161 AI 列对应 | 先用表头别名；AI 只为没认出的列建议字段，只发表头和前 5 行；建议填进现有的列对应下拉，再重新预览。合并单元格、多行表头、需要拆分的列不自动处理 |
| Q162 产品匹配 | 品牌 + 货号完全一致的直接选中已有产品；货号相同品牌不同、或同名的列为候选，可选或新建；没有货号按名称新建 |
| Q163 采购衔接 | 导入页草稿只入库，发票号写进入库流水说明；采购单“到货”表单加“识别发票”，读出批号、数量、有效期、发票号填进表单，仍由采购到货入库；原文件挂在采购上 |
| Q164 AI 不可用 | 表格照常手动对应；识别按钮置灰并说明原因；扫描版 PDF 提示改用拍照或截图 |
| Q165 文件与隐私 | 图片和文字只发给 AI 页里设置的服务；原文件存为附件；活动记录只写文件名、大小、行数和模型 |

### 1.1 追加：领用、库位、导入模板（Q166–Q171，2026-10-30 按推荐）

| 问题 | 决定 |
|---|---|
| Q166 列表批量领用 | 库存列表勾选后的操作栏加“领用…”：每条领用 N 个（默认 1）、领用人必填、放到哪里可选；只对按包装管理且在库数量足够的库存执行，其余跳过并写明原因；先预览再执行，每个实物照详情页的单个领用记录 |
| Q167 领用位置 | 改名“放到哪里（可选）”，输入时提示已有库位的完整路径，也可手写；详情页批量领用、单个实物的领用 / 转交 / 归还、添加实物都一样 |
| Q168 温度 | 库位温度只填数字，单位固定 °C，另有“室温”勾选；保存为“4 °C”或“Room temperature”；旧的“4 ℃”“RT”编辑时自动读成数字或室温，列表统一显示为“4 °C”；无法读成一个数字的旧值（如范围）照原样显示 |
| Q169 上级位置 | 标签改为“放在哪个位置里（可选）”，表单上方说明“先建冰箱，再在它里面建各层”；库位页、库存表单、库存详情页、批量移动都显示完整路径（如“冰箱 A / 第 1 层”），库位页按路径排序 |
| Q170 导入模板 | 表头用系统里的名称、中英双语（“库位 / Storage location”），必填列标 *；类型或大类、单位、库位、导入含义、管理方式、状态有下拉（选项放在隐藏的 Lists 页）：类型和单位可填其他内容（只提示），其余只能从下拉选；选项中英双语，导入时中文、英文、双语和原代码都认；说明页每列一行：列名、是否必填、怎么填（中英）、可选值；旧模板的英文字段名表头仍可导入 |
| Q171 类型字段中文 | 类型页的字段名逐个显示，按界面语言翻译（“用途 · 预期 Tm (°C)”）；补上“Heat inactivated”；用户自建的字段照原样显示 |

### 1.2 追加：数量、登记与类型（Q172–Q178，2026-10-30 按推荐）

| 问题 | 决定 |
|---|---|
| Q172 小数位 | 按个数计的单位（瓶、盒、支、管、包、钢瓶、个、反应）只能填整数；L、mL 最多 3 位，µL 1 位，g 4 位，mg 3 位，µg 1 位，其他单位 3 位。记录库存流水（含离线同步）、登记和编辑库存、产品安全库存、表格导入和 AI 草稿、登记余量都检查，浏览器先拦，服务器再查；显示按同样位数、去掉末尾的 0，太小显示为“<0.001”。实验扣减（按方案算出的用量）不受限，所以余量可能比单位更细：出库时填显示的数量（4.473 mL 对 4.4725 mL）就清空这一批 |
| Q173 返回 / Q174 标签 | 用户随后提出做库存主页（2026-10-30），标签的组成和“返回”去哪都取决于主页，并入主页的设计，不单独做 |
| Q175 序列库标签 | 类型列表不再显示；删除确认里照旧说明“会留在序列库” |
| Q176 浓度 | 从登记 / 编辑表单、批次详情、导入模板去掉；数据库字段保留（正式库无数据） |
| Q177 选已有产品登记 | 产品下方列出已有批次（批号、数量、库位、“给这个批次入库”），并说明这里是新建批次；填的批号与已有批次相同时提示并给出那个批次的链接，不拦下 |
| Q178 新批次的数量 | 新增“这批是：新到货 / 已有库存（盘点）”，新到货记入库，盘点记调整；两种说明都以“Opening balance”开头，删除时仍算作期初余额 |
| 单位写法（随 Q172 发现） | 中文界面的单位下拉原来保存翻译后的字（瓶、支），与导入的 bottle、vial 混用，产品合计和库存不足只算同一写法的批次。现在下拉保存单位代码、显示中文；比较单位时“瓶”和 bottle、“个”和 piece 视为同一单位（产品合计、安全库存、采购入库、实验扣减），已有数据不改写 |

## 2. 实施

| 部分 | 实施 | 主要文件 |
|---|---|---|
| 识别规则 | 提示词要求逐项照印刷内容、未印出的填 null；解析时丢掉无名称的行；单位统一（盒→box、支→vial、bottles→bottle、kit→box、μ→µ 等）；日期统一为 YYYY-MM-DD，只有月份时取当月最后一天；`purchaseLine` 为采购挑出对应的一行 | `inventory-recognition.ts` |
| 产品匹配 | `productMatches`：品牌 + 货号（货号不分大小写、空格、连字符）；行里没写品牌时，供应商名包含已有产品的品牌也算（“Qiagen GmbH”对 Qiagen）；否则同货号或同名的最多 5 个候选 | `inventory-duplicates.ts` |
| 读取 | `readPurchaseDocuments`：图片交给读图服务，PDF 读出文字后交给默认服务，粘贴文字同；单个文件失败只记一条提示，其余照常；活动记录不含内容 | `inventory-recognition.server.ts` |
| 列对应 | `readColumnSamples`（与预览共用文件读取）；`columnPrompt` / `parseColumnReply` 只接受真实字段、每个字段只用一次、不覆盖已认出的列 | `structured-files.ts`、`column-suggestion.ts` |
| 导入 | 库存导入新增可选列“已有产品 ID”（`productId`）；草稿 → 导入记录（到货、精确用量、规格写进备注）→ 现有校验与提交；多张图片都挂到新库存上；发票号进流水说明“Arrival: 文件 · invoice 号” | `structured-modules.ts`、`structured-import.ts`、`inventory/import/actions.ts` |
| 页面 | 导入页三个来源；表格预览里的“AI 建议对应”；草稿表格（产品、名称、品牌、货号、规格、数量、单位、批号、有效期、库位，可删行）；采购页“识别发票”、“填入收货”、“写入发票编号”，新建库存时可填批号和有效期，页内列出发票与送货单文件 | `inventory/import/page.tsx`、`InventoryDocumentImport.tsx`、`StructuredImportWorkspace.tsx`、`PurchaseRecordForm.tsx`、`purchases/[id]/page.tsx`、`purchase-records.ts` |

| 领用（Q166–Q167） | `bulkStockPlan("takeOut")`：已归档、不按包装管理、在库不足的跳过并说明；单个实物命令抽成 `applyContainerCommand(tx, …)`，批量领用在同一事务里按入库先后逐个领用；`InventoryBatchIssue` 改为英文原文 + 中文翻译 | `inventory-bulk.ts`、`inventory-containers.ts`、`inventory/bulk-actions.ts`、`InventoryBulkActions.tsx`、`InventoryBatchIssue.tsx`、`InventoryContainers.tsx` |
| 库位（Q168–Q169） | `readLocationTemperature` / `locationTemperature` / `temperatureLabel`、`locationPaths`；`stockFormLocations` 给库存表单和列表提供路径名 | `inventory-location-lifecycle.ts`、`InventoryLocationManager.tsx`、`inventory/locations/*`、`inventory-products.server.ts`、`inventory/[id]/page.tsx` |
| 导入模板（Q170） | `structured-template.ts`：`bilingual`、`columnHeader`、`headerNames`、`templateChoices`、`choiceValue`；表头查找改为保存完整字段定义；`inventoryTemplateLists` 读出类型 / 大类、单位、库位；字段定义新增 `optionLabels`、`choices`；导入页的选项与预览值显示名称而非代码；模板版本号 6 | `structured-template.ts`、`structured-files.ts`、`structured-modules.ts`、`api/structured-import/[module]/template/route.ts`、`StructuredImportWorkspace.tsx` |
| 类型字段（Q171） | 字段名逐个渲染 | `InventoryTypeManager.tsx`、`i18n.ts` |

| 数量与单位（Q172） | `stockUnit` 移到 `inventory.ts`；`quantityDecimals`、`quantityPrecisionProblem`、`formatStockQuantity`、`movementAmount`、`sameUnit`；`QuantityInput` 的 `checkPrecision`（只查改过的值）和以单位代码为值的选项；流水表单按单位设 step | `inventory.ts`、`inventory/actions.ts`、`products/actions.ts`、`api/mobile/inventory-transactions/route.ts`、`structured-import.ts`、`inventory-containers.ts`、`QuantityInput.tsx`、`InventoryTransactionForm.tsx`、`InventoryDetail.tsx`、`MobileInventoryBench.tsx`、`purchase-records.ts`、`run-materials.ts` |
| 登记（Q176–Q178） | `inventoryFormOptions` 带出每个产品的未归档批次；表单的批次列表、同批号提示、“这批是”；表单里“库位”“具体位置”分开命名 | `InventoryItemForm.tsx`、`inventory-products.server.ts`、`inventory/actions.ts`、`inventory/[id]/page.tsx`、`structured-modules.ts` |
| 类型标签（Q175） | 去掉列表里的“序列库” | `InventoryTypeManager.tsx` |

## 3. 验证（2026-10-30）

- `npx tsc --noEmit` 通过；`npx vitest run`：1588 项全部通过（本批新增 21 项）。
  - A：`inventory-recognition.test.ts`、`column-suggestion.test.ts`、`inventory-duplicates.test.ts`（`productMatches`）。
  - B：`inventory-recognition.server.test.ts`（假的 AI 服务和数据库：图片走读图、PDF 走文字、扫描件提示、日志不含内容、没有读图服务时说明原因）。
  - 中文：`i18n-inventory.test.ts` 新增 7 条。
  - eslint 无错误；impeccable 检测器无发现。
- 3002（测试库 `labnest_inventory_20261030`，AI 为 DeepSeek 文本模型，未配置读图服务），使用自造的样例数据：
  - 粘贴文字：读出 3 行；叠氮化钠（货号印作 S-2002）和 CD3 直接匹配已有产品，PBS 给出同名候选；补填发票号后导入 3 行，各记一笔入库流水，说明为“到货：pasted-text.txt · 发票 DN-2026-1031”，原文作为导入来源挂在 3 条库存上，活动记录只有字数、行数和模型。
  - 表格：6 列里只认出“单位”，“AI 建议对应”补上品名、货号、订购数量、备注，“规格”保持不导入，并自动重新预览。
  - 图片：选了图片后“AI 识别”置灰，说明“请选择能识别图片的服务……”。
  - PDF：读出供应商、发票号和两行明细；据此补了复数单位和带公司后缀的供应商名两条规则（先写测试）。
  - 采购（测试数据 `evidence/seed-purchase.sql`）：识别发票读出发票号、数量 3、批号、有效期；“填入收货”后选新建库存保存，新库存带上批号和有效期并挂到已有产品；“写入发票编号”后发票为已备齐；PDF 留在采购上。
- 截图：只读脚本打开 13 个页面（含导入页三个来源），1440 和 390 宽度共 26 次，均无横向溢出，截图在 `evidence/`。

### 3.0 追加部分的验证（Q166–Q171）

- `npx tsc --noEmit` 通过；`npx vitest run`：1601 项全部通过（追加 13 项：温度与路径、领用计划、批量领用写入、双语模板与读回、中文）。
- 3002：
  - 库位：新建“Shelf 1”放在 Freezer A 里、温度 -20，保存为“-20 °C”，列表显示“Freezer A (-20 °C) / Shelf 1”；测试库里改成“4 ℃”的库位编辑时读成 4，“RT”读成室温。
  - 列表领用：勾选滤嘴吸头、CD3、RNeasy（在库 0），预览“将修改 2 条，跳过 RNeasy：库房里只有 0 个”；执行后两个实物为使用中 · QA · B302 bench，活动记录有领用人和去处。
  - 详情页批量领用：标签为数量 / 接收人 / 放到哪里（可选），提示列出 5 个库位路径。
  - 模板：从 3002 下载，表头双语，Lists 页隐藏，类型和单位为提示式下拉、库位等为限制式下拉；填一行（耗材、到货、精确用量、5 瓶、Shelf 1、启用）后上传，27 列全部识别，预览显示“到货”“精确用量”，导入后为精确用量、5 bottle、Shelf 1、耗材、入库流水。
  - 类型页：显示“用途 · 预期 Tm (°C)”“PAM · 靶区域”。
  - 截图脚本 13 页 × 2 宽度无横向溢出（`evidence/`）；手机宽度下库存页是现场视图，没有批量操作栏。

### 3.0.1 Q172–Q178 的验证

- `npx tsc --noEmit` 通过；`npx vitest run`：1611 项全部通过（新增：单位位数、单位写法、出库清空余量、开封批次的两种记账）。
- 3002：“Template buffer”（瓶）记录 2.000001 被浏览器拦下，绕过后服务器返回“瓶：只能填整数。”；登记 CD3 时列出 4 个批次，填 b312451 提示“这个产品的批号 B312451 已经登记过”；数量 1.25 支提示“支：只能填整数。”，改为 2 后消失；单位下拉显示“支”、保存 vial；导入 2.5 瓶被标为需要修正；批次页没有浓度；类型页没有“序列库”；13 页 × 2 宽度无横向溢出。

### 3.1 未做 / 需注意

- 读图在 3002 上没有真实跑过（测试库没有读图服务），由单元测试覆盖；正式环境若要识别照片，需在 AI 页选一个能读图的服务。
- 新建的产品没有类型，导入后在产品列表“改类型”批量归类。
- 合并单元格、多行表头、“500 mL × 2”这类列仍需手动整理后再导入。
- 发布时无数据库迁移；导入模板多了一列“已有产品 ID”（可选），表头改为中英双语（旧的英文字段名表头仍能导入）。
- 库位温度已有的文字值不批量改写，编辑保存时才变成“数字 °C”。
- 其他模块的模板表头也变成双语（翻译来自界面的中文），选项仍是原代码。
- 模板里的库位按名称导入，不按路径；同名库位本来就不允许。
- 已保存为中文的单位（正式库 1 条“个”）不改写，按同一单位比较；以后新登记的保存代码。
- 采购单本身的数量没有加小数位限制（不在 Q172 范围）。
