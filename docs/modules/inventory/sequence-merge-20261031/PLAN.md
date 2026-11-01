# 库存：序列并入产品（Q185–Q187）

日期：2026-10-31
前一批：[库存主页](../home-20261031/PLAN.md)（未发布，与本批一起在 3002 验收，分两次发布）
状态：Q185–Q188 用户确认按推荐（2026-10-31）；已实施；同日用户要求把 3002 上的改动与样本模块一起合并到 3001 并推到 GitHub。发布时需在正式库上运行一次数据步骤（见 §4）。已于 2026-10-31 随样本模块发布到 3001（`19ad19a3`）。

## 1. 已确认的决定

| 问题 | 决定 |
|---|---|
| Q185 序列放在哪里 | 序列是产品的一部分：每对引物、每个 siRNA 双链是一个产品（类型“引物”“siRNA”），一对引物不拆成两个产品；探针、gRNA、质粒、蛋白质产品各有一条序列。产品页有“序列”一节，显示每条链及长度、GC、Tm、分子量，可复制、看反向互补、下载 FASTA；登记 / 编辑这些类型的产品时可直接填序列；原来的靶基因、物种成为引物和 siRNA 类型的字段 |
| Q186 保留哪些功能 | 保留：序列校验与计算、引物对 / 双链、从 Excel 粘贴或 FASTA / CSV / TSV / XLSX 导入（直接建成产品）、按所选产品导出 FASTA / CSV。不再提供：序列集合、工作流记录、版本历史页面、实体与研究记录关联、设计类型的元数据模板。原数据表保留，不删除数据 |
| Q187 迁移和入口 | 正式库的 14 条（6 对引物、8 个 siRNA）建成产品，原序列记录不动；左侧导航去掉“序列”；旧的 `/sequences` 链接转到对应产品页，或“有序列”的产品列表；全局搜索的序列结果改为打开产品 |

## 2. 实施

| 部分 | 实施 | 主要文件 |
|---|---|---|
| 数据关系 | 不改数据库结构：产品 → 实体（`InventoryProduct.entityId`）→ 实体序列链接（`EntitySequenceLink.role` 记 forward / reverse / sense / antisense / primary）→ 序列版本。`sequenceKinds` 按类型键定义每类产品有哪些链 | `product-sequences.ts` |
| 保存与读取 | `saveProductSequences`：第一条序列时建实体；修改的链新建一个版本（旧版本保留）；清空的链解除链接。`readProductSequences` 按类型顺序读出 | `product-sequences.server.ts`、`inventory/products/actions.ts` |
| 产品页与表单 | 产品页“序列”面板（复制、反向互补、FASTA）；表单按类型显示各链的输入框，序列类型不再显示“来源设计”下拉 | `ProductSequences.tsx`、`CopyTextButton.tsx`、`InventoryProductForm.tsx`、`products/[id]/page.tsx`、`products/[id]/edit/page.tsx` |
| 导入 / 导出 | 导入页新增“序列”：引物对 / siRNA 双链 / 单条序列（选产品类型），粘贴或选 FASTA、CSV、TSV、XLSX，预览后导入；同名同类型的已有产品跳过。产品列表批量“导出序列…”（FASTA / CSV），筛选“有序列”，搜索可用序列片段（6 个字母以上）；库存主页搜索也匹配序列片段 | `SequenceProductImport.tsx`、`import/sequence-actions.ts`、`api/inventory/products/sequences/route.ts`、`InventoryBulkActions.tsx`、`products/page.tsx`、`inventory-search.ts` |
| 入口 | 导航去掉“序列”；`src/app/sequences/[[...path]]` 只做跳转；删除序列模块的页面、动作、API 和只被它们使用的组件与库（`sequence-entry`、`sequence-registry`）；全局搜索的序列结果指向产品（同一产品只出一次） | `Sidebar.tsx`、`sequences/[[...path]]/page.tsx`、`global-search.ts` |
| 迁移 | `scripts/merge-sequences-into-inventory.ts`：默认只列出计划；`--apply` 写入；正式库还需 `--formal`；为引物和 siRNA 类型补“靶基因”“物种”字段；已链接到产品的序列跳过，可重复运行 | `scripts/merge-sequences-into-inventory.ts` |

## 3. 验证（2026-10-31，3002 测试库 `labnest_inventory_20261030`）

- `npx tsc --noEmit` 通过（`.next/types` 中已删页面的生成类型由开发服务器重建）；`npx vitest run` 1616 项全部通过（新增 `product-sequences.test.ts` 3 项、中文 5 条；随删除的库一起删去其测试）；eslint 无错误；impeccable 检测器无发现。
- 迁移：正式库试运行（不写入）列出 14 条；测试库 `--apply` 建出 14 个产品，再运行一次为 0 条。
- 产品页 hGAPDH：上游 / 下游引物各显示长度 20 nt、GC 50.0%、Tm 51.8 °C、MW；编辑上游引物后成为第 2 版，第 1 版保留，下游不变。
- 导入：粘贴 hACTB 和 hGAPDH 两行引物，预览识别上游 / 下游；导入后新建 hACTB，hGAPDH 因已存在而跳过。
- 导出：3 个产品的 FASTA 和 CSV 正确；“有序列”筛选列出 15 个产品；搜 `aaggtcatccct` 找到 hGAPDH。
- 跳转：`/sequences` → 有序列的产品列表；`/sequences/pairs/<hGAPDH>` → 产品页；`/sequences/new` → 新建产品；`/sequences/import` → 导入页序列；`/sequences/workflows` → 有序列的产品列表。导航中已无“序列”。
- 截图脚本 15 页 × 2 宽度无横向溢出（含导入页“序列”和 hGAPDH 产品页）。

## 4. 发布注意

- 无数据库结构迁移；发布后、确认 3001 健康之后，在正式库上运行一次（备份之后）：
  `DATABASE_URL=<正式库> npx tsx scripts/merge-sequences-into-inventory.ts --apply --formal`
  先不带 `--apply` 看计划（应为 14 条），并在发布记录里写明结果。
- 原计划主页一批和本批分两次提交；因用户要求一起发布，AI 识别入库、主页和本批合成一个提交（`src/lib/i18n.ts`、`InventoryBulkActions.tsx`、`products/page.tsx`、`products/[id]/page.tsx` 不再按块拆分）。

### 4.1 未做 / 需注意

- 序列版本只在数据库中保留，没有查看历史的页面。
- 未用于产品的单条序列（正式库 0 条）留在原表中，只能通过搜索跳到“有序列”的产品列表。
- 旧的验证脚本（如 `verify-sequence-library-ui.mjs`）仍访问 `/sequences`，现在会被跳转。
