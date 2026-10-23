# Calculator 重构验收记录

日期：2026-09-06。分支：`codex/calculator-main-integration`，基于最新 main `43cf9d1`。

已完整读取并保存原规格，按基础重构、复用与批量计算、实验集成三阶段实现。逐项范围、旧入口映射及方法边界见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。本记录区分自动验收与仍待现场验收的事项。

| 检查 | 结果 | 保存证据 |
| --- | --- | --- |
| 全仓自动测试 | 87 个测试文件、458 项通过；含 NUM-01…33 独立数值期望 | evidence/tests.log |
| TypeScript / 生产构建 | 通过；使用隔离构建目录与完整源代码检查配置 | evidence/build.log |
| Lint | 0 errors，11 warnings；未将全部 warnings 声称为原有问题 | evidence/lint.log |
| 旧入口与迁移 | 31 个旧入口可用；原始存储备份、历史快照、模糊单位确认、旧 URL 参数通过 | evidence/legacy-report.json |
| 主工作流与窄屏 | 八类任务在 360/390px 完成示例计算，控件不裁切；草稿、单位转换、示例禁存、离线重载通过 | evidence/browser-report.json |
| 数字与单位同行 | 主表单及配方、Master Mix 浓度输入在 360/390/1280px 同行，截图复核通过 | evidence/compact-ui-report.json |
| 实验记录与离线队列 | 断网排队、重连记录、UUID 重放、只读结果页与错误上下文拒绝通过；数据库读回仅各一条 Result、步骤事件及活动日志 | evidence/integration-report.json |
| 孔板回写 | 12 个选定孔只计一次；0.5mL 输入按 500µL 回写并保留原输入，总量 6.6mL | evidence/plate-report.json |

预览：[本地验收版](http://localhost:3221/tools/calculator)。该服务使用独立的合成验收数据库，不是正式实验数据库；未替换当前正式部署。

## 尚不能判定为完成的验收

- 3–5 位真实使用者试用，以及真实手机键盘、旋转、系统字体放大和读屏测试。
- 现有应用没有已认证的多用户权限层；已验证来源、实验步骤、归档状态和结果一致性，不等同于多用户权限验收。
- 离线启动只覆盖主动缓存的页面及 HTTPS/localhost；未访问页面和 LAN HTTP 不在保证范围内。
- 方法与功能范围：BCA 线性拟合、TCID50 明确标注近似、4PL 算法适用边界、仅定终体积稀释支持移液步进回算、P2 外部化学品检索未实现。详见实施报告。

因此，代码与主要自动验收已交付，但不将整份规格的全部 P0/P1 或现场验收声明为完成。PR 合并与部署状态见关联 Issue #52；本报告记录合并前验证。

## main 集成复核

从 main 建立干净工作树，仅移入 Calculator 改动。DocumentEditorViewport、DocumentEditorWorkspace、ScientificDocumentEditor 和 globals.css 与 main 完全一致。保留 main 的文档打印、目录、旧值展示、重复字段保护、步骤推进逻辑、局域网 UUID 及旧计算历史表格恢复。

文档编辑器浏览器验收在 1440、1100、820、390px 通过：页面无横向溢出，工具栏不裁切、不重叠，手机保存按钮在底部导航上方；截图已复核。证据位于 `evidence/editor-main/`。Calculator 浏览器与数据库读回均在 main 集成版本重新验证。
