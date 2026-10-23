# LabNest 文档导航

这里按用途查文档，不再按一次次开发日期堆在同一层。日期、版本号和原始验收资料仍保留在各自主题内。

## 当前优先阅读

- [手机与手表开发总览（2026-10-22，v1.1）](mobile/device-mobile-plan-20261022/README.md)
- [任务书一：第一阶段账号、跨 Wi-Fi 接入与设备管理](mobile/device-mobile-plan-20261022/01-device-connection.md)
- [任务书二：独立离线 iPhone App 与 Watch 手机同步](mobile/device-mobile-plan-20261022/02-independent-mobile-app.md)
- [这次任务的源码事实与证据](mobile/device-mobile-plan-20261022/03-current-state.md)

上述任务书是待实施方案，不代表账号、跨 Wi-Fi 和完整离线能力已经上线。

## 按用途查找

| 目录 | 放什么 |
| --- | --- |
| [产品设计 · product](product/README.md) | 产品体验、工作方式与功能设计 |
| [架构与决策 · architecture](architecture/README.md) | 领域模型、架构决策、Benchling / Labguru 参考 |
| [功能模块 · modules](modules/README.md) | Protocol、AI、计算器、编辑器、外观、工具与可视化 |
| [手机与手表 · mobile](mobile/README.md) | 多设备开发计划、现场模式、原生 App 和真机验证 |
| [部署与维护 · operations](operations/README.md) | 本地服务、Tools 部署、文档整理记录 |
| [发布记录 · releases](releases/README.md) | 已记录的发布批次、提交与验证说明 |
| [测试与验收 · qa](qa/README.md) | 跨模块验收、截图、报告及历史调试批次 |
| [开发协作 · development](development/README.md) | 领域约定、任务追踪和分支核查 |
| [模板与约定 · templates](templates/README.md) | 可复用的文档与执行约定 |

项目安装与使用见[项目首页](../README.md)，核心术语见[术语表](../CONTEXT.md)。

## 后续怎么存放

1. 新资料先找主题目录；不要再在 `docs/` 根目录新增 `debug-日期`、`stage-日期` 或某次手机调试文件夹。
2. 同一模块的持续方案放在模块内；一次开发批次再用 `YYYYMMDD-简短主题/` 区分，保留原来的版本号。
3. 方案、验收记录和相应 `evidence/` 放在一起。某个模块的证据不用再复制到全局 `qa/`；跨模块测试才放那里。
4. 文档写明“计划 / 已实施 / 已验证 / 尚未验证”；文件日期较新或目录名含 release，不等于功能已完成。
5. 新文档优先用相对链接。日志中的历史路径不改写，需要查找时用[迁移对照与整理记录](operations/docs-organization-20261022/README.md)。
6. 不在文档或测试证据中新增真实样本身份、凭据、数据库备份。保留本地资料不等于已批准公开上传。

本次只调整文件组织与路径引用，不删除历史资料、不修改产品功能。
