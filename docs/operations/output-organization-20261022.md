# 输出资料整理 · 2026-10-22

[返回部署与维护](README.md) · [文档整理记录](docs-organization-20261022/README.md)

原 `output/` 与 `outputs/` 已统一使用 `outputs/`。本页记录分类规则、脚本路径与检查结果；备份、成品、制作素材和逐文件私有清单仅保存在本地。

## 分类与查找

| 目录 | 内容 |
| --- | --- |
| `outputs/backups/` | 历史数据库与附件备份 |
| `outputs/documents/` | 文档、导入模板、课程与试点材料 |
| `outputs/deliveries/` | 展示评审交付包及历史版本 |
| `outputs/presentations/` | 演示文稿与制作资料 |
| `outputs/design/` | UI 设计与品牌素材 |
| `outputs/media/` | 宣传截图、视频与录制素材 |
| `outputs/tools/` | 离线工具及打包产物 |
| `outputs/reviews/` | 本地审核资料 |
| `outputs/_maintenance/` | 整理清单、校验和恢复记录 |

本机打开 `outputs/README.md` 查分类导航，`outputs/DELIVERABLES.md` 查成品与版本索引。它们链接到本机成品，因此随整个输出目录保存在本地。

## 脚本路径

以下四个脚本的默认离线工具位置统一为 `outputs/tools/portable-tools`：

- [build-portable-tools.mjs](../../scripts/build-portable-tools.mjs)
- [finalize-portable-tools.mjs](../../scripts/finalize-portable-tools.mjs)
- [build-offline-tools.ts](../../scripts/build-offline-tools.ts)
- [validate-portable-tools.mjs](../../scripts/validate-portable-tools.mjs)

本机旧 `outputs/portable-tools` 保留为兼容链接。已有工具书签可继续使用；浏览器本地草稿可能按访问地址保存，切换地址前应先导出重要草稿。

## 保留与清理结果

- 25 个资料包或分类目录完成归档；备份、不同版本成品、制作源文件、素材和视频帧序列保留。
- 525 个同一资料包内字节完全相同的重复预览，以及 14 个可重建缓存，移入本机专用废纸篓目录；合计约 187.25 MiB，未永久删除。
- 原 3471 个文件或链接均有可追踪去向；237 个受保护的备份、成品及 Office、视频、压缩文件通过逐字节校验。
- 四个现有离线工具通过隔离断网环境中的打开检查；视频列表的 701 条帧路径存在。
- 首页、Protocols、Tools、健康接口检查正常，数据库可达；整理期间没有重启服务。这些是本批检查结果，不代表全部功能的回归验收。

完整恢复位置、原路径映射和机器记录保存在本机 `outputs/_maintenance/organization-20261022/`。不把不同版本或视频重复帧当作可删除的重复文件。

## Git 同步范围

GitHub 同步文档分类、导航、必要的脚本及配置路径修正。原来已跟踪的验收资料按原内容迁移，以保持历史文档链接；不新增上传本地备份、交付成品、录制素材或私有文件清单。

`output/`、`outputs/` 的 Git 与 Docker 排除规则继续保留。重要备份和成品应另行备份；推送代码不等于备份这些本地资料。本批是文件组织与路径维护，不发布应用功能。
