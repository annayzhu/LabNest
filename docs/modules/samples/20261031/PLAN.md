# 样本：独立模块、实验产出与外部样本库预留

日期：2026-10-31
分支：`feat/samples`（worktree `.claude/worktrees/samples`，基于 `origin/main` `c76a28b5`）
状态：S1–S16 用户确认按推荐（2026-10-31）；已在分支上实施，3003 验收通过（2026-10-31），标签栏随后按 3002 统一（第 5 节）。同日用户要求与 3002 上的库存改动一起合并到 3001 并推到 GitHub（第 6 节）。
外部样本库契约：[SAMPLE-BANK-CONTRACT.md](SAMPLE-BANK-CONTRACT.md)

## 1. 现状（2026-10-31 核对）

### 1.1 代码里已有的三处“样本”

| 位置 | 内容 | 正式库数据 |
|---|---|---|
| 库存「样本」大类 | `inventoryGroupKeys` 固定 5 个大类之一（`src/lib/inventory-types.ts`），`InventoryGroup` 有 `sample` 行；低库存提示“样本无法补充”（`src/lib/inventory.ts`） | 0 个类型、0 个产品、0 个批次 |
| 旧「样本台账」`/samples` | `Entity`（type=sample）+ `SampleProfile`（编号、类型、母样本、状态）+ `SampleLifecycleEvent`，分装是挂在同一实体上的库存物品；页面只读、无新建表单；新建菜单 “Add Sample” 指向它，侧栏没有入口 | `SampleProfile` 0、事件 0、sample 实体 0 |
| 实体登记 `/entities` | `EntityType` 含 `sample` | 0 |

库存测试库 `labnest_inventory_20261030` 同样全部为 0。库存里与“样本”接近的只有「生物材料」大类：细胞系、质粒、菌株，以及用户自建的「组织芯片TMA」（ESCC组织芯片，上海芯超 HEsoS105Su01，2 盒）。

旧台账表还被这些地方当作删除阻挡项引用：库位删除（`inventory-location-lifecycle.ts`、`inventory/locations/*`、`InventoryLocationManager.tsx`）、批次删除（`inventory-products.server.ts`）、实验删除（`experiments/actions.ts`、`record-lifecycle.ts`），以及全局搜索、`live-data.ts`、`demo-data.ts`、`prisma/seed.ts`。

### 1.2 实验里与样本有关的现状

- 「实验设置与样本」（`experimentSections` 的 `setup`）是自由文本段落。例：EXP-006 写的是“1-4: H1650 4组 / 5-8: A549 4组”。
- 分组：`ProtocolRun.executionPlanJson.groups`（最多 24 组）。在运行准备里“设置多个组”，各组可选不同体系，确认后按组拆分步骤（`RunGroupPreparation.tsx`、`structured-run.ts`）。正式库 8 个实验中只有 EXP-008 用了 2 组。
- 板布局：工具里的 qPCR / CNV / 自由排板器（静态 iframe 工具，自带样本分组、多板、配液）。实验只能把排板器的“备份项目” JSON 或图片作为 `plate_layout` 附件挂上，`PlateLayoutView` 画只读板图；`EmbeddedSampleImport` 能把一列样本名送进排板器的样本导入框。正式库目前没有孔板附件。
- 结果：`Result.sampleLabel` 是自由文本；结果模板支持“每个样本：…”逐样本表。EXP-001 的结果里就有一张「RNA QC and Storage Record Form」：10 行（A549-Mock、A549-NC-FAM、A549-siFBN2-975…），列为样本 ID、浓度 ng/µL、洗脱体积 µL、A260/280、A260/230、RIN、冰箱、盒子、孔位——这正是 RNA 样本需要登记的内容。
- 规程运行的“本次数量”里可以有“样本数”（`runQuantityLabels`）。
- 正式库里与本需求直接对应的实验：EXP-002 RNA isolation、EXP-003 RT、EXP-006 RNA isolation and RT、EXP-007 KYSE150 RNA 提取、EXP-004 全血 DNA 质量检测。

### 1.3 可复用的部分

库位树 `InventoryLocation`（冰箱 / 架子 / 盒子 / 孔板…，有父子关系）；类型表 `ScientificSchemaDefinition`（名称、前缀、字段模板、默认设置；库存页面只读 `inventoryGroupKey` 非空的类型，实体页只读 `entityType` 非空的类型）；编号计数器 `RecordCodeCounter`；单位换算 `calculators/quantities`（含 ng/µL、µg/mL 等）；`ActivityLog` 与 `ActivityHistory`；`DataTable` 的勾选与导出；表格粘贴解析 `parseSpreadsheetClipboard`。

## 2. 决定（S1–S16）

2026-10-31 用户回复“按推荐”，以下推荐全部采用。实施中与原文的出入写在第 3 节。

### S1 样本是否独立于库存

推荐：独立成「样本」模块，侧栏放在「库存」下面。划分规则：
- 库存：买来的或长期保种的物品，按批次计数，用到完为止。试剂、耗材、细胞系、质粒、菌株、组织芯片 TMA 都留在库存。
- 样本：一个个体，有来源和谱系，由采集或实验产生，又被后续实验使用。如组织、血液、血清/血浆、细胞沉淀、RNA、cDNA、DNA、蛋白裂解液。
- 两者只共用库位树。

理由：两边的核心操作不同（批次余量与流水，对比个体、谱系、位置），放在一起两边都要绕开对方的字段；外部样本库也是按个体编号同步。

### S2 旧入口和旧数据

推荐：
1. 新建 `Sample` 等表；旧的 `SampleProfile`、`SampleLifecycleEvent` 删除。迁移时若有旧数据，先按编号转入新表（正式库为 0）。
2. `/samples` 换成新模块；新建菜单的「样本」指向新模块的新建页。
3. 库存去掉「样本」大类，固定大类由 5 个变为 4 个（这改变了 Q136 的决定）。库里若有该大类的产品或类型，迁移时转为「待归类」，不删数据（正式库为 0）。
4. 实体登记不再提供 sample 类型（枚举值保留，不改历史）。
5. 原来引用旧台账的删除检查改为检查新样本：库位里有样本时不能删库位，实验用过样本时按现有规则阻止删除。

理由：只留一个入口；没有需要搬的正式数据，旧表留着只会让库位、实验的删除检查继续数一张空表。

### S3 一条样本是什么

推荐：一管（一块组织、一张切片）就是一条样本。分装出来的每一管各是一条子样本。来源个体（患者、动物、细胞系及处理）记在「来源」，派生时自动继承。

理由：位置、余量、状态、冻融都是按管的；外部样本库也是按管或编号对接。

### S4 编号和名称

推荐：
- 编号：全库唯一。默认按类型前缀自动生成（RNA-0001、CDNA-0001…），也可以手填，保存时查重。
- 名称：你们习惯的样本名（如 A549-siFBN2-975），可以重复。RNA 和由它做出的 cDNA 可以同名；同一类型内重名时提示，但不阻止。

理由：EXP-001 里的 RNA 用的是 A549-Mock 这类名称，cDNA 沿用同名很常见；唯一编号负责防错，名称负责好认。

### S5 字段与状态

推荐字段：类型、编号、名称、来源、母样本、来源实验、项目、库位（一般是盒子）、盒内位置、体积或量（数值＋单位）、浓度（数值＋单位）、生物安全等级（BSL-1/2/3，可空）、采集或制备日期、备注、按类型的自定义字段、外部来源＋外部编号。

状态：在库 / 已用完 / 已丢弃 / 已转出。离开「在库」时自动腾出盒内位置（原位置留在历史里）。

理由：覆盖 EXP-001 RNA 质检与存储表的全部列；库存 Q143 已经给生物材料和样本设了 BSL 等级。

### S6 样本类型

推荐：沿用库存的类型表（`ScientificSchemaDefinition`，`objectKind = "sample"`，不属于任何库存大类）。样本模块有自己的「类型」页：名称、编号前缀、默认单位、自定义字段。

预置 10 个类型：
- 组织：部位、病理类型、保存方式（冻存 / FFPE / RNAlater / 新鲜）
- 全血：抗凝剂
- 血清、血浆
- 细胞：细胞数
- RNA：A260/280、A260/230、RIN
- cDNA
- 基因组 DNA：A260/280、A260/230
- 蛋白裂解液
- 其他

理由：“类型＋字段模板”在库存已经有一套，不另造；库存页面只读有大类的类型，样本类型不会混进去。

### S7 库位和盒内位置

推荐：
- 共用库存的库位树，给库位加可选的「行×列」规格（9×9、10×10、8×12…）。规格在样本的盒子视图里设置，库存表单不改。
- 样本模块按盒显示格子图，位置写成 A1；有规格时校验行列范围。
- 同一格只能放一个在库样本（数据库唯一约束，冲突在保存时挡住）。
- 库存的库位页每个库位多一个「样本 N」数，点开进样本清单并按该库位筛选。

理由：一个库位能同时列出库存和样本；格位冲突不靠人眼检查。

### S8 批量新建（一批最多 500）

推荐：只有一个「新建样本」入口，内容是一张表格。一行行填写，或者用以下三种方式填满：
1. 从 Excel 粘贴多列（自动对应列名，可手动调整）。
2. 导入 CSV / XLSX（提供带下拉的模板）。
3. 按规则生成 N 行：前缀＋起始号＋位数，或「母样本编号＋后缀」。

其余规则：
- 选好盒子和起始格后自动排位置：按行，跳过已占用的格子。
- 保存前逐行校验（编号重复、格位冲突、单位、必填）。全部通过才一次写入。
- 每批记一个批次号；本批样本还没被实验使用、也没派生时，可以「撤销本批」。

理由：一个和五百个走同一条路；「撤销本批」解决批量录错。

### S9 分装（不经过实验的派生）

推荐：在样本详情或清单里选样本 →「分装」→ 打开同一张新建表格。母样本、类型、来源已预填，名称自动加 -1…-N。可选择从母样本体积中扣除分出的总量，或把母样本标为已用完。

理由：生物样本库最常见的操作，复用新建表格，不另做表单。

### S10 编辑、删除、历史、导出

推荐：
- 详情页编辑单条，显示谱系（上游到根、下游全部）、用过它的实验、产出它的实验、历史。
- 清单勾选后可批量改状态、移盒（自动排位）、改项目、导出、删除。
- 删除：没有子样本、没被实验使用的，确认后直接删除（与库存一致，不进回收站）。否则不能删，提示改为「已丢弃」。
- 改动记入现有的操作历史（`ActivityLog`）。

理由：谱系和实验记录不能断；批量录错用 S8 的「撤销本批」处理。

### S11 实验产出样本（RNA 提取产生 RNA，RT 产生 cDNA）

推荐：实验的「实验设置与样本」里有「登记产出」，打开 S8 那张表格：
- 选产出类型（如 RNA）。默认每个输入样本产出一条：母样本为该输入，名称沿用输入名称。
- 也可以不选输入，直接加 N 行（例如从培养的细胞直接提 RNA，细胞没登记成样本），名称可按「来源＋处理」填写。
- 如果本实验已有逐样本结果表（如 RNA 质检与存储表），可一键带入浓度、洗脱体积、盒子和孔位，不再重填；带入后两边各自保存，之后不自动同步。
- 产出的样本记下来源实验和母样本。RT 时同样操作：选 RNA 为输入，产出 cDNA。
- 规程本身不改：不在规程里声明产出类型。
- 已有实验不自动补登；需要时在该实验里用同一入口补登，例如 EXP-001 的 10 管 RNA。

理由：有无登记过的输入两种实际情况都能覆盖；你们已经在结果表里记浓度和位置，避免两处录入；不改规程快照规则。

### S12 在实验里选择样本

推荐：「实验设置与样本」段落开头显示本实验样本表（输入 / 产出、组、孔位）。

- 选择方式：按编号、名称或来源搜索；按类型、项目、盒子筛选；整盒选；粘贴一列编号或名称，一次选上百个。
- 顺序可调整，排板按这个顺序。
- 「用量」可选：填了就从样本余量扣减并记历史，移除选择时退回；不填只记“使用过”。
- 实验提交或审核锁定后，样本表也锁定。
- 复制实验时带上输入样本和分组，不带产出。
- 样本表同时写入实验文档，打印和导出里都有。

理由：用户说的选择、分组、排板都在这块区域；用量可选，不强制记账。

### S13 分组

推荐：
- 样本分组是实验层面的设计分组，例如对照 / 处理、肿瘤 / 癌旁、H1650 / A549。
- 在样本表里多选后「设为某组」，或粘贴「样本⇥组」两列；组可以改名、调整顺序。
- 样本分组不拆分规程步骤。
- 运行准备里的「设置多个组」保持现有含义：各组可选不同体系，会拆步骤。新建这类分组时，默认组名改为沿用样本分组。

理由：大多数实验各组走同一套步骤，不该为分组拆步骤；需要不同体系时，组名只在一处定义，不出现两套名字。

### S14 板布局

推荐：不另做排板器，复用工具里的 qPCR / CNV 排板器。
- 样本表上点「排板」，打开排板器，本实验的样本按顺序、带组名送进排板器的样本导入区。
- 排好后的布局仍作为本实验的「孔板布局」附件（现有功能），并在样本区直接显示板图；能从布局里认出样本名时，样本表的「孔位」列显示它所在的孔。

已知限制：排板器内部的结果不会自动回传，仍需在排板器里「备份项目」后附到实验。自动回传放到后续。

理由：排板器已经支持多板、重复孔、分组和配液，再做一个就是重复入口。

### S15 运行页（现场模式）与本次数量

推荐：
- 运行页的实验准备清单加一类「样本」：按盒列出要取出的样本和格位，如「盒 RNA-1：A1–A8」。
- 运行页不加样本操作，只放一个「登记产出」链接回实验页。
- 规程的本次数量里有「样本数」时，旁边提示「本实验已选 N 个样本」，可一键填入。有执行分组且组名与样本分组一致时按组填。只提示和一键填，不自动写入。

理由：在实验台前需要知道去哪个盒子取样本，但不能把注意力从步骤上拉走（现场模式原则）。

### S16 外部样本库接口预留到什么程度

推荐只做三样：
1. 样本上的「外部来源＋外部编号」，两者联合唯一。以后同步时按它更新同一条样本，不重复新建。
2. 代码里的连接器接口：发出检索请求（带请求号和回传地址）→ 对方系统检索 → 把结果推送回来，按请求号归档 → 用户查看后选择导入为样本。
3. 写成文档的 JSON 契约，包括检索请求、结果推送、错误、鉴权、幂等、每次最多 500 条，附示例；代码里有同一份校验器，测试保证文档示例都能通过校验。

现在不做界面按钮，不开放接收地址，不存连接配置。

理由：现在接上半截功能没有用，还会多出一个无人维护的入口；字段和契约先定下来，接入时只需实现连接器和接收端。


## 3. 实施（2026-10-31）

| 问题 | 做法 | 主要代码 |
|---|---|---|
| S1 | 侧栏「库存」下新增「样本」；模块三页：样本、盒子、类型 | `Sidebar.tsx`、`SampleNav.tsx`、`src/app/samples/**` |
| S2 | 新表 `Sample`、`ExperimentSample`、`ExperimentSampleGroup`；删除 `SampleProfile`、`SampleLifecycleEvent` 及两个枚举（迁移先把旧行按原 ID 转入新表）；库存固定大类减为 4 个，原“样本”大类下的产品改为待归类、其类型改为样本类型，然后删掉该大类；实体登记不再提供 sample；新建菜单「Add Sample」指向 `/samples/new`；库位、批次、实验的删除检查改数新样本 | 迁移 `20261031120000_samples`、`inventory-types.ts`、`inventory-location-lifecycle.ts`、`inventory/locations/*`、`InventoryLocationManager.tsx`、`inventory-products.server.ts`、`record-lifecycle.ts`、`experiments/actions.ts`、`entities/*`、`CreateMenu.tsx` |
| S3–S5 | 一管一条；编号全库唯一（比较时不分大小写），默认类型前缀加 4 位流水号，计数器在 `RecordCodeCounter` 的 `sample:<前缀>`；名称可重复；来源随母样本继承；状态离开“在库”时清空库位和格位，原位置写进历史 | `samples.ts`、`samples.server.ts`、`samples/actions.ts` |
| S6 | 样本类型存于 `ScientificSchemaDefinition`（`objectKind = "sample"`，不属于任何大类）；预置 10 个，RNA、DNA 的字段与 EXP-001 的质检表同名（A260/A280、A260/A230、RIN）；类型页可新建、编辑、停用、删除（有样本时不能删） | 迁移、`samples/types/*`、`SampleTypeManager.tsx` |
| S7 | `InventoryLocation` 加 `gridRows`、`gridColumns`；盒子页设规格、画格子图；`(locationId, position)` 唯一约束挡住重格位；库存库位页每行多一个「N 个样本」链接 | `samples/boxes/page.tsx`、`SampleBoxSizeForm.tsx`、`InventoryLocationManager.tsx` |
| S8 | 新建页是一张表格：逐行填、从 Excel 粘贴（自动认列名，可改）、导入 CSV/TSV/XLSX、按规则生成（前缀＋起始号＋位数＋后缀）、按行放入盒子空位；「检查」只校验，「保存」整批写入或一条不写；批次号写在样本上，列表按批次过滤时可「撤销本批」（被实验用过或在批外有子样本时不能撤销）；模板 `/api/samples/template` 双语表头，类型、盒子、生物安全等级为下拉 | `SampleEntryTable.tsx`、`samples/new/page.tsx`、`api/samples/template/route.ts`、`SampleBatchBanner.tsx` |
| S9 | 样本详情「分装…」打开同一张表格，母样本、类型、单位、浓度预填，名称加 -1…-N；可从母样本扣除分出的总量、可标为已用完 | `samples/new/page.tsx`、`saveSampleBatch` 的 `aliquotOf` |
| S10 | 详情页：事实、类型字段、谱系（上游链与派生样本）、实验（来源实验与使用记录、取用量）、历史；编辑页；删除需输入编号，有子样本或实验记录时只能标为已丢弃；清单多选可改状态、移盒（有规格时按行排空位）、改项目、导出 CSV、删除 | `samples/[id]/*`、`SampleBulkActions.tsx`、`api/exports/samples.csv` |
| S11 | 「登记产出」= 新建表格加实验上下文：每个输入一行（母样本＝输入，名称沿用），产出带上输入所在的分组；能按标题猜产出类型（RNA 提取→RNA，RT→cDNA，同时含两种时不猜）；实验有逐样本结果表时可「从结果表带入」浓度、体积、盒子、孔位和类型字段 | `samples/new/page.tsx`、`experiment-samples.ts`（`suggestedOutputType`） |
| S12 | 实验页「实验设置与样本」开头是样本区：使用的样本（搜索／粘贴编号／整盒选择、上下移动、用量）、产出的样本、孔板布局；用量与样本单位可比时扣减余量，改用量或移除时先退回原扣减；锁定或归档的实验只读；复制实验带上输入样本和分组；实验导出和报告里的「实验设置与样本」带样本表 | `ExperimentSamples.tsx`、`experiments/[id]/sample-actions.ts`、`experiment-copy.ts`、`structured-export.ts`、`reports.ts`、`ScientificDocumentView.tsx`（`sectionLeading`） |
| S13 | 设计分组：新建、改名、排序、删除，多选设组，或粘贴「样本⇥组」两列；不拆规程步骤；运行准备「设置多个组」的默认组名沿用样本分组（两组以上时） | `ExperimentSamples.tsx`、`RunGroupPreparation.tsx` |
| S14 | 「排板」打开 qPCR/CNV 排板工具，顶部一键把本实验的输入样本（按组、按顺序，重名时用编号）送进工具的样本导入框；孔板布局附件改在样本区上传（运行准备里原来的上传入口去掉，只留链接，避免两个入口）；能从布局里认出输入样本的孔位时显示在「孔位」列 | `tools/[toolId]/page.tsx`、`EmbeddedLabTool.tsx`、`EmbeddedSampleImport.tsx`、`RunSystemPreparation.tsx` |
| S15 | 结构化运行的准备清单多一类「要取出的样本」（按盒、格位区间，可勾选）；非结构化运行在步骤上方显示一行同样信息；两处都有「样本与排板」「登记产出」链接；本次数量是「样本数」时提示「填入已选的 N 个样本」 | `run-preparation.ts`、`RunPreparationChecklist.tsx`、`RunSystemPreparation.tsx`、`experiments/[id]/run/page.tsx` |
| S16 | `Sample.externalSource + externalId` 联合唯一；契约校验器、连接器接口（未接入时拒绝一切检索）、样本库记录到样本行的映射；契约文档示例由测试逐个校验 | `src/lib/sample-bank/*`、[SAMPLE-BANK-CONTRACT.md](SAMPLE-BANK-CONTRACT.md) |

与第 2 节的出入：
- 实验样本关联多存一列 `deducted`（实际扣减量，按样本单位），改用量或移除时据此退回，不受之后单位修改影响。
- 导入模板放在 `/api/samples/template`，与其他下载入口一致。
- 中文译文放在 `src/lib/i18n-samples.ts`，在 `zhUi` 开头展开（已有译文优先），动态句式在其他模块都译不了时才使用，不会抢走库存等模块的句式。

### 3.1 迁移

- 先在临时副本库（测试库的复制）放入合成数据演练：两条旧台账样本（母子）、一条事件、库存“样本”大类下的一个类型和一个产品。迁移后：两条样本按原 ID 转入且母子关系保留；`tissue` 对上「组织」，认不出的旧类型记为「其他」并在备注写明原类型；产品转为待归类；类型转为样本类型；大类剩 4 个；旧表删除。演练库随后删除。
- 测试库 `labnest_samples_20261031`（2026-10-31 由正式库 pg_dump 复制）已应用迁移。正式库未动。

### 3.2 与库存会话的协调

- 这些库存文件只改了与样本有关的行，库存会话未提交的改动没有碰到这些行：`inventory-types.ts`（去掉 sample 大类）、`inventory-location-lifecycle.ts` 及其测试、`inventory/locations/actions.ts`、`inventory/locations/page.tsx`、`InventoryLocationManager.tsx`、`inventory-products.server.ts`、`inventory.ts`（去掉 sample-event 名词）、`actions.lifecycle.test.ts`、`bulk-actions.test.ts`。
- `inventory.ts` 的 `lowStockAdvice` 仍有 `"sample"` 分支和 `inventory/[id]/page.tsx` 的 “remaining” 文案，现在不会再走到；为减少冲突没改，留给库存会话一并清理。
- 共享组件只用不改样式；`ScientificDocumentView` 加了可选的 `sectionLeading`，不影响其他调用。
- `i18n.ts` 只加三处：文件头的 import、`zhUi` 开头的展开、`translateUiText` 里的兜底调用；另把库存删除阻挡项的“样本事件”句式换成“N 个样本”，准备清单计数句式加了“样本”。

## 4. 验证（2026-10-31）

环境：worktree `feat/samples`，测试库 `labnest_samples_20261031`，开发服务器 3003（`.claude/launch.json` 的 `labnest-samples`）。截图为中文界面，桌面 1440×900、手机 390×844。

### 4.1 检查

- `npx tsc --noEmit`：0 错误。
- `npx vitest run`：198 个文件、1602 项全部通过。新增：`samples.test.ts`（17 项：编号、格位、余量扣减、批量校验、粘贴列名、模板表头、谱系、删除阻挡）、`experiment-samples.test.ts`（7 项）、`sample-bank/contract.test.ts`（4 项，含契约文档全部示例）、`i18n-samples.test.ts`（13 项）；更新 `record-lifecycle`、`inventory-location-lifecycle` 等测试。
- `npx eslint`：0 错误；12 条警告都在本分支未改动的文件里。

### 4.2 页面走查（3003）

1. 盒子页把「RNA 盒 1」设为 9×9，格子图出现。
2. 新建样本：粘贴 8 行细胞样本（表头「名称 类型 来源 日期」自动对应，“细胞”认作类型），放入组织冻存盒 A1–A8，保存为 CEL-0001…0008，列表显示本批与「撤销本批」。
3. EXP-006（RNA 提取及 RT）：粘贴编号选入 8 个样本（`NOPE-999` 提示没有找到）；粘贴两列分为 H1650 / A549；登记产出选 RNA、放入 RNA 盒 1，生成 RNA-0001…0008，母样本与分组随输入。
4. EXP-003（RT）：按类型搜索选入 8 个 RNA；给 RNA-0001 填 5 µL，余量 30 → 25 µL，详情页历史记下这次取用；登记产出时类型自动建议为 cDNA，放入 cDNA 盒 1。CDNA-0001 的谱系为 CEL-0001 → RNA-0001 → CDNA-0001，来源“H1650 · NC”逐级继承。
5. 排板：qPCR 排板工具打开时，「送入 EXP-006 的 8 个样本」把名称按组写进工具的样本导入框；附上排板 JSON 后，样本区「孔位」列显示 H1650-NC → A1, B1, C1。
6. 运行页：EXP-008（结构化）准备清单出现「要取出的样本：-80℃冰箱 A › 第2层 › cDNA 盒 1 · 4 个样本 · A1–A2, A5–A6」；EXP-006（非结构化）在步骤上方显示同一行。
7. 复制 EXP-006 得到 EXP-009：8 个输入样本、两个分组都带上，没有产出和用量。删除这类计划中的实验时，样本选择随实验删除（在回滚的事务里验证）。
8. 新建表格的「检查」：重格位与负数体积在对应行提示，中文显示。撤销一个新建批次后，列表按批次过滤为空。
9. 导入模板：双语表头，`Lists` 表含 10 个样本类型（中文）、全部库位、BSL 三级，三处下拉校验。
10. 全部 17 张截图所在页面没有横向滚动。

截图（`evidence/`）：

| 页面 | 桌面 | 手机 |
|---|---|---|
| 样本清单 | [desktop-list](evidence/desktop-list.png) | [phone-list](evidence/phone-list.png) |
| 新建样本 | [desktop-new](evidence/desktop-new.png) | [phone-new](evidence/phone-new.png) |
| 样本详情（RNA-0001） | [desktop-detail-rna](evidence/desktop-detail-rna.png) | [phone-detail-rna](evidence/phone-detail-rna.png) |
| 盒子（RNA 盒 1） | [desktop-boxes-rna](evidence/desktop-boxes-rna.png) | [phone-boxes-rna](evidence/phone-boxes-rna.png) |
| 样本类型 | [desktop-types](evidence/desktop-types.png) | — |
| EXP-006 实验设置与样本 | [desktop-experiment-exp006-setup](evidence/desktop-experiment-exp006-setup.png) | [phone-experiment-exp006-setup](evidence/phone-experiment-exp006-setup.png) |
| EXP-003 实验设置与样本 | [desktop-experiment-exp003-setup](evidence/desktop-experiment-exp003-setup.png) | [phone-experiment-exp003-setup](evidence/phone-experiment-exp003-setup.png) |
| 登记产出（EXP-006） | [desktop-outputs-exp006](evidence/desktop-outputs-exp006.png) | — |
| 运行页准备（EXP-008） | [收起](evidence/desktop-run-exp008-prep.png) · [展开](evidence/desktop-run-exp008-prep-open.png) | [phone-run-exp008-prep](evidence/phone-run-exp008-prep.png) |
| 库存库位（样本数链接） | [desktop-inventory-locations](evidence/desktop-inventory-locations.png) | — |

### 4.3 未做 / 需注意

- 本次数量「样本数」的一键填入，以及「设置多个组」沿用样本分组名：测试库没有含「样本数」的规程，也没有尚未分组且有样本分组的结构化运行，只有代码和单元测试（`runSampleCount`），未在浏览器里看到。
- 排板工具的结果不会自动回传（S14 已说明），仍需在工具里备份项目后上传。
- 从回收站恢复的实验不带回原来的样本选择（删除时选择随实验移除；有产出或用量的实验本来就不能删除）。
- 外部样本库只定契约（S16）：没有设置项、没有接收地址、没有检索入口。
- 真机（iPhone 软键盘、触控）未测；手机宽度为浏览器模拟。
- 3003 开发服务器的每日备份报过 `spawn pg_dump ENOENT`（启动配置当时没设 `LABNEST_PG_BIN`），与本功能无关；启动配置已补上 `LABNEST_PG_BIN=./scripts/pg-docker`，下次启动生效。

## 5. 验收与调整（2026-10-31）

- 用户在 3003 验收通过（`fe174693`）。
- 随后按用户要求，样本模块的「样本 / 盒子 / 类型」标签栏改成与 3002（库存会话预览）的库存标签栏一致：每个标签带图标和条数（样本数、在用库位数、样本类型数），选中的标签有浅绿底色和下边线；详情页先显示标签栏，再是「← 样本」返回链接和标题；新建页与库存的“登记库存”一样不显示标签栏。截图已重拍。
- 库存的标签栏（`InventoryNav`）在库存会话未提交的改动里，本分支没有动它；`SampleNav` 照抄了同样的结构和样式。两者以后可以合成一个共用组件，留给统一 UI 时处理。

## 6. 发布（2026-10-31）

- 用户：“先把3002和3003的改动合并到3001 并推到github”。3002 上库存会话未提交的 Q156–Q188（AI 识别入库、库存主页、序列并入产品）先单独提交，再与本分支合并，同一个提交部署到 3001。
- 迁移 `20261031120000_samples` 在 3001 启动时运行：正式库加入 10 个样本类型，去掉空的库存大类「样本」，删除空的旧表 `SampleProfile`、`SampleLifecycleEvent`。部署后在正式库上运行一次库存的序列数据步骤（14 个产品）。
- 发布步骤、核对结果和三处版本（GitHub main、开发目录、3001）记在 `.local-runtime/release-samples-inventory-20261031/DELIVERY.md`。
