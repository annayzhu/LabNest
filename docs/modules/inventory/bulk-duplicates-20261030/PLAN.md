# 库存：批量操作、重复检查与产品合并

日期：2026-10-30
前一批：[分类、产品层与完整的增删改](../classification-20261030/PLAN.md)（已发布 `371acda7`）
状态：Q151–Q158 用户确认按推荐（2026-10-30）；本批做 Q151–Q155，已于 2026-10-30 发布到 3001（`c76a28b5`）；Q156–Q157（AI 识别入库）按 Q158 放到下一批

## 1. 已确认的决定

| 问题 | 决定 |
|---|---|
| Q151 列表批量操作 | 库存和产品列表勾选后，表格上方出现操作栏。库存：归档 / 恢复、换库位（自动记转移流水）、改负责人。产品：改类型或大类、加 / 去管控等级、归档 / 恢复。不做批量改数量，数量只经流水改 |
| Q152 批量删除 | 沿用 Q149：只删没有引用的，其余自动改为归档；确认框先列出“删除 N 条、改为归档 M 条”和原因，并要求输入所选条数 |
| Q153 确认与留痕 | 执行前列出影响；执行后逐条显示结果（已改、已归档、已删除、跳过及原因）；整批写一条活动记录，含全部条目 ID。不做整批一键撤销 |
| Q154 相同的判定 | 完全一致：品牌相同（忽略大小写）且货号去掉空格、连字符、忽略大小写和全半角后相同，视为同一产品，登记库存、导入、采购入库时自动归到已有产品，新建产品时拒绝重复。疑似重复（货号相同但品牌不同、CAS 相同、名称相同）只提示。批次从不自动合并：同产品、同批号、同位置的两条在册批次标为“疑似重复登记” |
| Q155 产品合并 | 合并页：选保留的一方，另一方的批次、文档、组分、管控等级并入，空产品删除；安全库存不一致时由人选。“重复检查”页列出疑似重复的产品和批次，可逐对合并，或标记“不是重复” |
| Q156–Q157 | 下一批：任意表格的 AI 列对应；发票、送货单、试剂标签识别成入库草稿 |
| Q158 | 不做聊天式助手；AI 只提议、人确认；先做不依赖 AI 的 Q151–Q155 |

## 2. 设计

### 2.1 规则（纯函数）

- `catalogKey`：NFKC、转小写、去掉空白和各种连字符；空串视为没有货号。
- `duplicateProductPairs`：同 `catalogKey`（品牌也相同时为“完全一致”）、同 CAS、同名（NFKC、小写、去空白和标点后相同，中英文名都比）的产品两两成对，去掉已标记“不是重复”的对。
- `duplicateLotGroups`：同产品、同批号（去空白、忽略大小写）、同库位的在册批次。
- `bulkStockPlan` / `bulkProductPlan`：每条记录的结果（修改、删除、改为归档、跳过及原因）。
- `mergeProductPlan`：保留方的字段优先，缺的从另一方补；管控等级取并集；备注两段都留；安全库存都设了且不同则需要选择。

### 2.2 服务端

- `productWithCatalog`：按品牌 + `catalogKey` 找已有产品，`linkInventoryProduct` 与新建、编辑产品的查重共用。
- `previewStockBulk` / `applyStockBulk`、`previewProductBulk` / `applyProductBulk`：先算计划，执行时在同一事务里重新计算并执行，返回逐条结果，写一条 `inventory_item_bulk` / `inventory_product_bulk` 活动记录。删除复用单条删除的步骤。
- `mergeInventoryProducts`：一个事务完成合并，批次随后按保留方的名称、品牌、货号同步。
- `setNotDuplicate`：在 `InventoryDuplicateDismissal` 记下一对或一组 ID（按 ID 排序存成对）。

### 2.3 数据

- 新表 `InventoryDuplicateDismissal(firstId, secondId, createdAt)`，主键为两者；产品和批次共用（ID 不会重复）。迁移只加表，不改现有数据。

### 2.4 页面

- `DataTable` 的 `selection` 增加 `actions` 和全选；有操作时，操作栏在表格上方，导出放进操作栏。没有操作的列表不变。
- 产品列表开启勾选；工具栏加“重复检查”，有疑似重复时显示条数。
- `/inventory/products/duplicates`：疑似重复的产品对和批次组。
- `/inventory/products/merge?keep=…&other=…`：两边对照，可交换，安全库存冲突时选择；产品页 ⋯ 增加“合并另一个产品…”。

## 3. 测试接缝（沿用上一批确认的 A + B + C）

- A：`inventory-duplicates.test.ts`、`inventory-bulk.test.ts`。
- B：批量操作、合并、“不是重复”的服务端动作（假数据库）。
- C：迁移在 3002 测试库执行；内置浏览器中文界面逐项操作；只读截图脚本。

## 4. 实施（2026-10-30）

| 问题 | 实施 | 主要文件 |
|---|---|---|
| Q151 | 库存列表：换库位（每条记一笔转移流水）、改负责人（回车即应用）、归档、恢复、导出所选。产品列表：改类型或大类（收起时显示“大类 · 未细分”）、加 / 去管控等级（化学管控；BSL 仍在产品表单里设）、归档、恢复。表头加全选；每次最多 500 条 | `InventoryBulkActions.tsx`、`DataTable.tsx`、`SelectAllRows.tsx`、`bulk-actions.ts`、`inventory-bulk.ts` |
| Q152 | 删除放在操作栏最右侧，红色。预览列出“将删除 N 条、N 条仍被引用将改为归档”和原因；要输入所选条数，服务端也核对。删除复用单条删除的步骤（`deleteStockItem`、`deleteProductRecord`） | 同上、`inventory-products.server.ts` |
| Q153 | 先预览再执行，执行时在同一事务里重新计算；结果与预览不同时再弹出逐条结果。整批写一条 `inventory_item_bulk` / `inventory_product_bulk` 活动记录，含每条的结果 | `bulk-actions.ts` |
| Q154 | `catalogKey`：NFKC、小写、去空白和各种连字符。`productWithCatalog` 供登记库存、采购入库、导入归并到已有产品，也供新建、编辑产品时拒绝重复。疑似重复：货号相同（品牌也相同时标“品牌和货号都相同”）、CAS 相同、中英文名相同；同产品同批号同库位的在册批次标为“可能重复登记” | `inventory-duplicates.ts`、`inventory-products.server.ts` |
| Q155 | 合并页两边对照，可交换保留方；安全库存都设了且不同时要选择；确认后在一个事务里迁移批次、文档（去掉同一文件的重复链接）、组分（排在保留方之后），删除另一方，批次同步保留方的名称、品牌、货号。并入后若含剧毒或易制毒，所有批次必须是精确用量。产品页 ⋯ 增加“把另一个产品并入这个…”。重复检查页逐对“合并…”或“不是重复”；产品列表工具栏和库存列表提示条显示疑似重复的数量 | `products/actions.ts`、`products/merge/page.tsx`、`ProductMergeForm.tsx`、`products/duplicates/page.tsx`、`NotDuplicateButton.tsx` |
| 数据 | 新表 `InventoryDuplicateDismissal`，迁移 `20261030200000_inventory_duplicate_dismissals` 只加表 | `schema.prisma`、迁移 |

顺带修了两处已有的问题：

- 列表勾选后的“导出所选…”从来没有出现过：按钮用的是 `group-has-[…]:flex`，而表单是具名分组 `group/selection`，规则匹配不上。改为 `group-has-[…]/selection:flex`，所有可勾选的列表都恢复了导出按钮。
- 下拉框里的分组标题（`<optgroup label>`）在中文界面下仍是英文：运行时翻译只处理 placeholder、aria-label 和 title。现在也翻译 `<optgroup>` 的 `label`，已发布的登记库存、产品表单里的大类分组随之变成中文。

## 5. 验证（2026-10-30）

- `npx tsc --noEmit` 通过；`npx vitest run`：1566 项全部通过（本批新增 39 项）。
  - A：`inventory-duplicates.test.ts`（12）、`inventory-bulk.test.ts`（8）。
  - B：`bulk-actions.test.ts`（6）、`products/merge.test.ts`（4）；原有的产品、物品删除测试改用新的查重和删除函数后照常通过。
  - 中文：`i18n-inventory.test.ts` 新增 9 条。
  - 相关文件 eslint 无错误；impeccable 检测器无发现。
- C，数据：迁移只在 3002 测试库 `labnest_inventory_20261030` 执行，正式库没有这张表；测试数据 `evidence/seed-duplicates.sql`（旧条目“anti CD3 (old entry)”、同 CAS 的“叠氮化钠”、重复登记的 CD3 批次）。
- C，3002 中文界面逐项操作：
  - 重复检查：列出 CD3 一对（品牌和货号都相同）、叠氮化钠一对（CAS 号相同）、CD3 批号 B312451 两条；“不是重复”后该对消失。
  - 合并：安全库存冲突时出现选择（单位显示为“2 支”）；确认后旧产品删除，其批次改挂并改名为“Anti-human CD3 (OKT3)”，备注补入，写一条合并记录。
  - 库存批量：删除时输错条数被拒（“请输入 2 确认。”）；输入 2 后删除 1 条、归档 1 条，一条批量记录；恢复；换库位（两条各记一笔转移流水）；改负责人。
  - 产品批量：加“剧毒”时已有的跳过并说明原因；改为“试剂与化学品 · 未细分”；删除时空产品删除、有批次的改为归档；恢复。
  - 全选、清空；`/projects` 勾选后出现“导出所选…”；产品页 ⋯ 的合并入口。
- 截图：`scripts/verify-inventory-classification.mjs`（加入重复检查页和合并页，可指定证据目录）只读打开 10 个页面，1440 和 390 宽度共 20 次，均无横向溢出；另有勾选两行后的操作栏截图 `stock-selected-1440.png`、`products-selected-1440.png`。

### 5.1 未做 / 需注意

- 手机宽度的库存页是实验台视图，没有表格，所以没有批量操作；产品列表在手机上可以勾选。
- 品牌别名表没有做：不同品牌的同一货号已经会列为疑似重复。
- 批次永不合并；重复登记的批次在重复检查页列出，需要打开批次逐条处理。
- 发布时需执行迁移 `20261030200000_inventory_duplicate_dismissals`（只加表，不改现有数据）。
