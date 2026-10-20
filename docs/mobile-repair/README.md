# 手机实验台修复

本次按已确认的操作流程调整手机网页，继续使用现有主题、Entry 保存机制和统一库存后端。

- 首页：现场模式、快速记录、计算器、工具四个大触控入口，下面直接显示今日实验；跨日仍在进行的实验优先显示。
- 记录：主页、底部导航、“更多”中的快速记录都进入 `/entries/new?mode=capture`。历史浏览保留为“记录历史”和“全部记录”。
- 菜单：共用导入/导出、筛选、页面更多、规程导出及记录归属菜单使用原生 popover 顶层，并在可见视口内定位；保留筛选表单归属和键盘操作。
- 库存：支持拍照后在浏览器本地解码，识别结果仅用于查找。核对物料、批次、包装后才执行库存操作。支持展开完整搜索结果，分别筛选余量和有效期状态，不把未登记数量显示为零。详情先展示适用操作，再展示物料资料。

## 验证方法

请只在本机专用数据库 `labnest_mobile_qa` 运行以下流程：

```sh
npm ci
npx prisma migrate deploy
npm run prisma:seed
npx tsx scripts/seed-mobile-repair.ts
npm run build
npm run start -- --port 3219
# 另一个终端，连接同一测试数据库
node scripts/verify-mobile-repair.mjs
```

`DATABASE_URL` 必须显式设置为专用本机测试库。`seed-mobile-repair.ts` 和浏览器脚本会拒绝其他数据库。通用 `prisma:seed` 会重建示例数据，因此绝不能对真实数据运行。浏览器脚本会领用合成库存，用数据库回读确认扣减结果。

验收覆盖 WebKit/Chromium、320/390/430/1440 px、中英文、深浅外观、列表/详情菜单、筛选提交、记录入口一致性、跨日进行中实验、数量未登记、搜索结果展开、库存操作顺序，以及 HTTP 局域网环境下的二维码、Code 128、EAN-13、Data Matrix 图片解码。

样图位于 `scripts/fixtures/mobile-barcodes/`，全部为合成条码。网页相机入口使用系统拍照或图片选择器，不提供实时取景扫描。自动化浏览器图片上传验证不等于实体 iPhone 相机、对焦和真实标签照片的实测。
