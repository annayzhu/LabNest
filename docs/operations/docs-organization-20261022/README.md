# 文档整理记录 · 2026-10-22

[返回文档导航](../../README.md) · [返回部署与维护](../README.md)

## 做了什么

- 根目录由 28 项资料入口收敛为 9 个分类目录，加 1 个总导航页；系统隐藏文件不计入入口。
- 按 22 条目录／文件映射移动 6,273 个文件。整理前的全部 6,715 个文件均保留，总计 680,518,841 字节（约 649 MiB）。
- 没有删减、去重或压缩截图、视频、日志、PDF、DOCX、表格、ZIP 和失败证据；日期、版本号和各批次内部层级保留。
- 原有文档／补充脚本中有 36 个文件仅修正路径与链接，其余 6,679 个原文件逐字节保持一致。
- 176 个目录外文件更新必要路径；其中项目首页还增加文档导航链接。涉及测试脚本、CI、忽略规则、原生 App 说明及协作资料，不修改业务逻辑。
- 原先已存在的未提交修改保留。本批没有提交、推送、部署或重启服务，没有读写业务数据库和附件库。

## 旧位置与新位置

下面均相对于 `docs/`。历史日志、JSON 报告或聊天里出现旧路径时，按此替换开头；其余相对后缀不变。

| 旧位置 | 新位置 |
| --- | --- |
| `adr/` | [`architecture/decisions/`](../../architecture/decisions/) |
| `agents/` | [`development/agents/`](../../development/agents/) |
| `issue-36-branch-audit.md` | [`development/issue-36-branch-audit.md`](../../development/issue-36-branch-audit.md) |
| `ai/` | [`modules/ai/`](../../modules/ai/) |
| `appearance/` | [`modules/appearance/`](../../modules/appearance/) |
| `calculator/` | [`modules/calculator/`](../../modules/calculator/) |
| `editor-repair/` | [`modules/editor-repair/`](../../modules/editor-repair/) |
| `structured-protocol/` | [`modules/structured-protocol/`](../../modules/structured-protocol/) |
| `visualization/` | [`modules/visualization/`](../../modules/visualization/) |
| `tools-entrypoints-20261020/` | [`modules/tools-entrypoints-20261020/`](../../modules/tools-entrypoints-20261020/) |
| `device-mobile-plan-20261022/` | [`mobile/device-mobile-plan-20261022/`](../../mobile/device-mobile-plan-20261022/) |
| `mobile-app-20261021/` | [`mobile/mobile-app-20261021/`](../../mobile/mobile-app-20261021/) |
| `mobile-repair/` | [`mobile/mobile-repair/`](../../mobile/mobile-repair/) |
| `field-mode-20261019/` | [`mobile/field-mode-20261019/`](../../mobile/field-mode-20261019/) |
| `watch-companion-20261019/` | [`mobile/watch-companion-20261019/`](../../mobile/watch-companion-20261019/) |
| `watch-device-install-20261021/` | [`mobile/watch-device-install-20261021/`](../../mobile/watch-device-install-20261021/) |
| `watch-four-digit-20261020/` | [`mobile/watch-four-digit-20261020/`](../../mobile/watch-four-digit-20261020/) |
| `debug-20260909/` | [`qa/history/debug-20260909/`](../../qa/history/debug-20260909/) |
| `debug-20260910/` | [`qa/history/debug-20260910/`](../../qa/history/debug-20260910/) |
| `stage-20260908/` | [`qa/history/stage-20260908/`](../../qa/history/stage-20260908/) |
| `verification/` | [`qa/verification/`](../../qa/verification/) |
| `tools-deployment.md` | [`operations/tools-deployment.md`](../../operations/tools-deployment.md) |

原有 `architecture/`、`product/`、`operations/`、`releases/`、`qa/`、`templates/` 保留；模块自己的证据与原方案一起移动。原始机器日志、JSON、校验清单中的历史路径不改写，以保留当时的记录。

## 检查结果与适用范围

- 已按本地原文件清单 `inventory-before.json` 检查每一文件的新位置及 SHA-256；该完整清单仅保存在本机，GitHub 保留本页摘要和检查结果。
- 已检查总导航、分类索引、既有文档中的本地 Markdown 链接，没有因本次移动引入新的缺失目标。
- 修正 Labguru 架构记录中原有的 3 处错误链接。
- 仍保留 1 处原有历史源码引用：`docs/qa/entry-richtext-acceptance.md` 指向 `src/components/DocumentWysiwygToolbar.tsx`。该源码文件已不存在，不能猜测另一组件并把旧验收证据改指过去；回溯时应结合该批次对应的源码版本。
- 路径受影响的 134 个 JavaScript、34 个 TypeScript、1 个 Python 文件完成语法检查；4 份 CI YAML 完成解析检查。
- 根级 Git 忽略规则对原有全部文档的匹配结果不变；相关 Docker 排除路径一起更新。
- 受影响的当前脚本和配置中没有继续引用已搬走的本仓库文档根目录；独立 Studio 仓库的 `docs/ai/README.md` 不属于此次迁移。
- 差异空白检查通过；完整机器检查记录见[verification.json](verification.json)。
- 本次没有重跑会创建实验或访问数据库的业务测试。语法与路径检查不等同于应用端到端验收；本次也不对历史脚本中的旧服务地址作可用性保证。

源码基线：`601f815b4fc1c93b3d139aaf3a78100f248df3a1`。此记录描述文档整理，不是应用功能发布。未暂存时，Git 可能将搬家显示为旧路径删除和新路径未跟踪；应结合上述映射核对，不能据此判断资料丢失。

## 以后避免再乱

新批次先归主题，在该主题内保留计划、验收与证据。只有跨模块集中调试才放 `qa/`；需要保存过往批次时用 `qa/history/`。不要用复制整个证据目录的方式制作导航，也不要仅因为文件旧、名字相似就删除。
