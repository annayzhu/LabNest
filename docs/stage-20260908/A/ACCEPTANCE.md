# A 采购与 Inventory：实施与验收

起点 main：`1aed227f34e0dbe3558fbb30fcd503aaaef3dd4a`（PR #67）。
应用代码验证版本：`d5ba793071306f7c55d6e0b0f7ac2381ecae7af6`。后续证据提交只更新文档/测试脚本和日志，应用代码未变化。
主体提交 `d170a1fb39c4507d889254bc8cf8d331de2b20b0`；并发/盘点修复 `4c0679cf7210ca990da65193da6d9f4b0ab0032d`。

本批独立执行 Issue #68。未合并、未部署、未对生产库迁移；原工作区无关修改保留。B/C/D不因本批通过而关闭。C1图片/打印保持PR #67修复，本轮不重写。

## 实现位置

| 需求 | 位置 | 行为 |
|---|---|---|
| A1/A2 | `InventoryItemForm.tsx`、`inventory/actions.ts`、`inventory.ts`、`live-data.ts` | 信息/包装/精确模式；未知与零分开；首次盘点要求日期、登记人、来源，复用原调整账本 |
| A3/A4 | `inventory-containers.ts`、`InventoryContainers.tsx`、`InventoryBatchIssue.tsx`、containers API | 稳定瓶ID；批量登记/领用；开封/转交/归还/用完；余量观察追加而非差值扣减 |
| A5 | `run-materials.ts`、`RunMaterials.tsx`、materials API、原mobile队列 | 预计/实际/来源；可选库存或已领瓶；独立保存、显式批量扣减；待处理编辑、关联更正、离线重试 |
| A6 | `purchase-records.ts`、`PurchaseRecordForm.tsx`、`QuoteDecision.tsx`、purchases API/pages | 直接购买、候选决定、分批收货及可选入库、凭证状态、实际CSV与可回取历史快照 |
| A7 | `structured-import.ts`、`structured-files.ts`、`StructuredImportWorkspace.tsx` | CSV/XLSX、列映射、预览确认绑定、重复文件拒绝、显式库存ID、余额与到货分开 |
| 兼容 | `prisma/migrations/20260908040000_*` 至 `20260908080000_*` | 增量字段/表/关系；保留原InventoryTransaction；追溯关系禁止删除导致悬空 |

上述组件位于 `src/components/`，库位于 `src/lib/`；完整路由见PR diff。
批量领用逐瓶确认，不宣称整批原子操作；失败显示已确认数，重试固定原瓶与请求键。未识别登录身份时手填领用人，不伪造“本人”。包装数与瓶内余量不互换；跨维度缺参数不推测换算。

## 已通过

- 最终应用代码d5ba793远端 [Calculator CI](https://github.com/annayzhu/LabNest/actions/runs/34187089188)（Shanghai/Vancouver质量检查及浏览器）与 [编辑器CI](https://github.com/annayzhu/LabNest/actions/runs/34187089198) 均success，见 `remote-ci.json`。首轮CI发现3项规范错误，修复脚本变量名及下载链接后通过，未改计算算法。
- 双时区各 **105文件、577测试**；TypeScript及webpack生产构建通过。完整eslint无错误、有16条警告（含原有工具资源和未使用变量）。日志见 evidence。
- 本地产物在隔离生产服务 `localhost:3233` 验收，不是开发热更新服务，也不是正式部署。全部夹具为合成数据。
- T01—T13、T15—T19的已执行部分及证据逐项列在上级 `CHECKLIST.md`，其中子场景未执行项明确保留，不能仅依据“通过”字样扩大覆盖范围。
- 5瓶领1后4/1；重复请求仍4/1；开封转交归还保持原ID；250→180不产生70mL消耗；用完保留历史。
- 页面批量领用5瓶中的2瓶后3/2；信息库存保存刷新仍未知；采购页面创建450.50并收2件但不入库。
- Run页面修正不足行、更正草稿，后台回读原ID和扣减一致；重复更正拒绝。12次保存/确认竞争、12次订单更正/收货竞争均执行有效操作并保持约束。
- 离线保存未管理材料，恢复联网同步后同名唯一记录，刷新保留。此证据是离线保存/同步，不等于整个应用离线冷启动验收。
- 独立采购/库存CSV与XLSX，映射篡改拒绝；重复文件拒绝；显式余额180+新增到货20=200；补关联不增加库存；实际金额改价后原CSV快照内容完全一致。
- 旧模式数据库先插合成库存、分装、交易、实验和附件关系，再执行新迁移；五类旧表原字段逐一相等。未读取真实历史记录，未验证真实附件字节。

## 实际页面截图

20张：inventory、package、purchase、run、import，各含1440px桌面/390px手机及浅色/深色。文件在 `evidence/{页面}-{desktop|mobile}-{light|dark}.png`。

| 示例 | 浅色 | 深色 |
|---|---|---|
| 桌面采购 | [浅色](evidence/purchase-desktop-light.png) | [深色](evidence/purchase-desktop-dark.png) |
| 手机实物包装 | [浅色](evidence/package-mobile-light.png) | [深色](evidence/package-mobile-dark.png) |
| 手机Run | [浅色](evidence/run-mobile-light.png) | [深色](evidence/run-mobile-dark.png) |

截图来自实际页面；自动检查根页面无横向溢出、无页面异常。人工查看桌面采购、手机Run、桌面深色包装和手机浅色包装；其余截图已生成并自动检查，未逐张人工复核。本批保留原页面框架，B线全站平整布局不在这里冒充完成。

## 失败与未执行

**当前已执行自动化未留失败项。** 曾发现并复现的并发错误已修复；历史红灯日志保留。最终UTC测试曾与构建及另一时区同时运行，旧可视化性能测试耗时3.33秒超过3秒阈值；停止争用后单独重跑，保留该次失败日志 `utc-resource-contention.log`，不修改阈值或算法。早期 `run-materials-red.log` 是夹具/脚本失败，不能作为产品回归红灯证据。早期开发服务的页面异常及networkidle超时未计通过，后续独立生产服务操作无异常通过。

未执行或尚不能关闭：

- T14已补齐：复制按钮打开新实验，复制为planned/draft；不复制实际用量、交易与运行计时状态；重复请求返回同一副本。completion.json。
- 可选余量实验关联与Consumption下拉已在生产模式页面补通过，预计10mL、实际12mL分别保存，180mL估计关联实验且不产生交易。completion.json。
- 学校XLSX缺必要信息返回422；正确数据导出后逐单元格检查，改价后历史快照字节一致。库存/采购选中范围CSV、XLSX、JSON共6文件已回读；修复采购忽略选中范围导出全表的问题。实际发票文件/学校报销提交未执行。
- 真实历史旧记录、真实打印机、真机软键盘、真机最高160%缩放、实验人员试用；手机截图是浏览器视口模拟。
- GitHub当前OAuth凭据缺少workflow权限，新增CI工作流推送被服务器拒绝；配置保留为inventory-ci.yml，启用未执行。已有远端CI状态以PR检查为准，本地通过不替代远端通过。
- B共享UI、C剩余字号/属性面板、D站内工具按总清单继续独立交付。

这些缺口影响对应场景的最终验收，不应将整个A或四工作线宣称全部完成。已完成实现可独立审查。

## 复现

仅使用独立 `labnest_stage_a_acceptance` 数据库；脚本会拒绝其他库名。配置DATABASE_URL后迁移、生产构建，在3233启动；运行：

```sh
npx prisma migrate deploy
npm run build -- --webpack
npm run start -- --port 3233
# 另一终端
LABNEST_ACCEPTANCE_URL=http://localhost:3233 node scripts/verify-inventory-all.mjs
node scripts/verify-inventory-legacy.mjs
TZ=Asia/Shanghai npm test
TZ=UTC npm test
npm run typecheck
```

legacy脚本建立并保留独立带时间戳数据库，仅合成记录。CI配置保存在本目录 `inventory-ci.yml`。具备workflow权限的维护者可将其放到 `.github/workflows/inventory.yml` 后启用；本次未绕过权限限制。

真机验收步骤：打开测试版本，缩放至160%；用中文输入领用人、余量和Run材料，确认软键盘不挡按钮；5瓶领1再转交归还；断网保存Run材料后恢复联网，刷新确认一次同步；由实验人员按实际习惯完成一次收货→领用→Run收尾并记录阻碍。不要在生产库存中使用合成验收数字。

## 本轮自动验收补齐

新增代码：experiment-copy及copy路由/按钮；school-template校验与快照；structured-export采购选中范围与库存ID。新增3个验证脚本已纳入verify-inventory-all。隔离生产3233新增脚本及原A完整浏览器链路通过；类型检查、webpack生产构建通过。红灯日志保留copy 404、学校缺字段200、采购选中导出74行，修复后分别通过。
