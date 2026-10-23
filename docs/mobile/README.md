# 手机、手表与多设备

[返回文档导航](../README.md)

## 当前开发方案

[2026-10-22 两份任务书总览](device-mobile-plan-20261022/README.md)

- [任务书一：账号、跨 Wi-Fi 接入与设备管理](device-mobile-plan-20261022/01-device-connection.md)
- [任务书二：独立离线 iPhone App 与 Watch 手机同步](device-mobile-plan-20261022/02-independent-mobile-app.md)
- [已有源码与当前限制](device-mobile-plan-20261022/03-current-state.md)
- [配套架构决策](../architecture/decisions/0001-local-first-mobile-device-identity.md)

当前计划将账号纳入第一阶段；手机可在与电脑隔离、但能上网的 Wi-Fi 下访问同一套 LabNest；手表默认通过手机同步；断网操作先在本机持久保存，恢复连接后补传。**这些是开发目标，不是本次整理已实现的功能。**

## 已有设计与验证资料

| 批次 | 内容 |
| --- | --- |
| [mobile-repair](mobile-repair/README.md) | 手机网页修复与既有方案 |
| [field-mode-20261019](field-mode-20261019/FIELD-MODE.md) | 现场模式记录 |
| [watch-companion-20261019](watch-companion-20261019/QA.md) | 手表辅助端、模拟器及历史调试资料 |
| [watch-four-digit-20261020](watch-four-digit-20261020/) | 四位码连接批次与证据 |
| [mobile-app-20261021](mobile-app-20261021/MOBILE-APP.md) | 原生 App 历史需求；[原生验证记录](mobile-app-20261021/NATIVE.md) |
| [watch-device-install-20261021](watch-device-install-20261021/verification.md) | iPhone / Watch 真机安装记录 |

历史方案中的账号顺序、网络限制和手表直连安排，以 2026-10-22 v1.1 中明确替代的部分为准；原始验证结果不因此改成“已通过”。

构建与安装说明仍在源码旁：[iPhone App](../../native/LabNestMobile/README.md)、[Watch App](../../native/LabNestWatch/README.md)。
