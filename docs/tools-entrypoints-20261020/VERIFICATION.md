# Tools 入口验收 · 2026-10-20

关联任务：[LabNest #106](https://github.com/annayzhu/LabNest/issues/106)。

## 交付行为

- Free Plate Layout、qPCR Plate Layout、TaqMan CNV Plate Planner、Calculator、qPCR Analysis 和 CNV Analysis 均随 LabNest 部署，保持当前域名、端口和标签页。
- qPCR 内置程序来自上游提交 `8fd1ce7ef032eacdc6d0c2313bb9d7fc35d02524`，经上游便携版构建打包；算法未改写。来源和文件 SHA-256 见 `public/tools/qpcr-plate-layout/release.json`，许可随文件保留。
- 旧 qPCR HTML 地址直接提供内置程序，不再被重定向回 iframe 宿主页。
- 旧四项外部工具 URL 变量不再改变六个内置入口。
- Visualization Studio 保持独立部署，由 `VISUALIZATION_STUDIO_URL` 配置。未配置时显示提示，配置后目录打开新标签页；兼容入口保留旧配色导出。
- Studio 过渡页不再加载侧栏，避免立即离站时中断侧栏预取。旧偏好导出后仍留在浏览器中。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 上游 qPCR 便携包检查 | 4/4 通过；单文件 HTML、许可、ZIP 路径和内容验证 |
| LabNest 完整单元测试 | 163 个文件，1,331 项通过 |
| 最终入口、Studio 和翻译回归 | 19/19 通过 |
| TypeScript 与生产构建 | 通过；最终使用 webpack 生产构建 |
| ESLint | 无错误；完整检查保留 12 项原有警告，改动文件检查无警告 |
| Docker Compose 配置解析 | 通过；未执行 Docker 镜像构建 |
| Chromium、WebKit 实际浏览器 | 48 项通过，0 页面错误，0 外部网络请求 |
| 屏幕宽度 | 1440、834、390 px；三个排板工具内外页面均无横向溢出 |
| qPCR 操作 | 中文和英文样本导入；生成、确认、Excel 下载回读、保存刷新恢复通过 |
| 导出回读 | 每个浏览器均得到 2 个虚构样本 × 2 个检测基因 × 3 个技术复孔，共 12 个有效孔 |
| Studio 配置与迁移 | 未配置提示、配置后新标签页、兼容跳转、旧配色下载及原数据保留均通过 |

使用 Node.js `v22.23.1`、Next.js `16.2.10`，在隔离的本地测试数据库上验证，未使用真实科研数据。Studio 跳转目标是本地测试端点，仅证明 LabNest 配置和跳转正确，不代表某个生产 Studio 已部署。手机和平板为浏览器尺寸模拟，未进行物理设备验收。

完整逐项结果见 [report.json](evidence/report.json)。截图与虚构样本导出保存在同一 evidence 目录。复现浏览器检查需分别启动未配置 Studio、已配置 Studio 的两个本地 LabNest 服务，以及本地测试目标，再运行：

```bash
LABNEST_E2E_BASE_URL=http://127.0.0.1:3340 \
LABNEST_STUDIO_TEST_BASE_URL=http://127.0.0.1:3341 \
LABNEST_STUDIO_TEST_URL=http://127.0.0.1:3342/studio/ \
node scripts/verify-tool-entrypoints.mjs
```

两个 LabNest 服务使用相同生产构建；第二个服务启动时设置 `VISUALIZATION_STUDIO_URL=http://127.0.0.1:3342/studio/`。本次还在两个服务中显式设置了旧四项外部 URL 为不可达测试域名，确认入口忽略这些旧配置。

升级和 Studio 独立部署步骤见 [Tools 部署说明](../tools-deployment.md)。公网部署需要由该服务器拉取更新并重建应用；不能用本地验收结果代替公网验收。
