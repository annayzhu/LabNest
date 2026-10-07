# 正式交付记录（2026-10-07）

[PR #89](https://github.com/annayzhu/LabNest/pull/89) 已合并；功能合并提交为 `25a4f5428e890c1f63835848ff46f97e64dc619b`。GitHub 页面确认 Merged、六个检查通过，Issue #88 已关闭。最终受测 PR head 为 `bd133b4d40ce5ed0f9cf11b06cfffbe184181392`；合并时 main 未发生额外变更，合并提交与受测提交的 Git tree 完全相同。

## 最终 CI

| 验收 | 结果 | 日志及合成证据 |
|---|---|---|
| Protocol → Experiment | 通过 | [Actions 37585776865](https://github.com/annayzhu/LabNest/actions/runs/37585776865)：双时区各 554 项、lint、TypeScript、生产构建、数据库保护、浏览器流程和 PDF。 |
| 正文编辑器 | 通过 | [Actions 37585776851](https://github.com/annayzhu/LabNest/actions/runs/37585776851)：保存刷新、图片、打印、中文确认事件及 Run。 |
| 随手记录富文本 | 通过 | [Actions 37585776907](https://github.com/annayzhu/LabNest/actions/runs/37585776907)。 |
| Calculator | 通过 | [Actions 37585776985](https://github.com/annayzhu/LabNest/actions/runs/37585776985)：两时区质量检查及完整 25 组浏览器回归。 |

前两轮失败仍保留在 Actions 中；作者确认步骤补入旧验收流程后，最终整套回归通过，没有通过削弱创建保护或改动正确算法来跳过失败。

## 正式迁移与部署

正式写入前再次备份并确认记录未变化。执行迁移 `20261007060000_experiment_creation_key`，原迁移历史条目保留。正式应用更新期间短暂停止旧应用，避免旧编辑器与新步骤结构同时写入；数据库和附件继续使用原数据卷。

| 正式核对 | 结果 |
|---|---|
| 原 ProtocolVersion | 8 个原版本逐字段一致。 |
| 新规程结构 | 新增 7 个 Draft；各规程操作数为 5、7、5、7、7、6、12，具体代码及来源见 [ACCEPTANCE.md](ACCEPTANCE.md)。未自动授予科研批准。 |
| CCK-8 | 从原 DOCX 三重指纹核对后恢复 7 步、1 个结果模板、7 条耗材规则；原空白版本保留。 |
| EXP-007 草稿 | 自己的冻结来源 37→12，12 个 keeper 原 ID 保留，全部仍未完成，状态仍为 planned/draft。 |
| 已完成实验 | 6 个原实验及其 75 个步骤逐字段一致，原快照、备注和计时证据保留。 |
| 正式实验数量 | 仍为 7；没有在正式库创建合成测试实验。 |
| 附件 | 原 49 个文件逐文件 SHA-256 一致，附件卷不变。 |
| 运行源码 | 860 个应用源码／脚本／Prisma／配置文件与合并后的 main 指纹一致。 |
| 生产编译 | 通过；Next.js 16.2.10，Prisma 7.8.0，构建 ID `0qwM7-_qqhVuMKchOCjFx`。 |
| 容器 | running/healthy；镜像 `sha256:3d7f22c79c71882c442098c3b2edbed6ec58081481746aa46288457ff5456ee2`。 |
| 实际页面 | localhost 和当前内网入口各验证 7 个实验、7 份规程及创建预览；12 步正确、历史冻结来源保持，图片实际加载，无 pageerror；1440px 和 390px 截图已读取检查。 |

正式回读、真实规程截图、备份、干跑差异及部署日志保留在私有 `.local-runtime/protocol-consistency/`：`release-data-report.json`、`release-source-report.json`、`release-after/desktop-browser-report.json`、`release-after/lan-browser-report.json`、`production-library/`、`production-draft/`。公开仓库不上传真实实验全文或内网地址。完整逐项结果与公开合成截图见 [ACCEPTANCE.md](ACCEPTANCE.md)。

## 未执行及边界

已执行用例没有未关闭失败。未执行：PRT-100008 旧 rev1 原 DOCX 核对（文件未找到）、真机软键盘、160% 真机缩放、人员试用、实体打印机、数据库竞态注入及数据恢复演练。窄屏验收来自浏览器视口；本轮内网检查来自电脑浏览器，不能记为真机通过。

发布前保存数据库与附件备份，并由旧运行应用文件系统保存本地回退镜像、读取确认原构建 ID。原 Docker 镜像在本地索引中不可直接取用，回退副本采用文件系统 export/import。尚未做回退启动或数据库恢复演练；真实执行产生后不得用旧整库备份覆盖新记录。两条旧迁移历史在现用 main 不含原目录，本次只保留历史条目、追加上述新迁移，没有改写这些旧条目。
