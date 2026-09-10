# Typography 与覆盖记录

系统使用现有 `ln-ui-*`、`ln-page-title-size` 与控件参数，不另建主题系统。

| 角色 | 默认PC | 手机 | 实现 |
|---|---|---|---|
| H1 | 24px / 32px | 20px / 28px | PageHeader |
| H2 | 18px / 26px | 16px / 24px | CardHeader/共享section |
| H3 | 15px / 22px | 14px / 22px | ln-ui-h3-size |
| Body | 14px / 22px | 14px / 22px | ln-ui-body-font-size |
| Caption / Label | 12px / 18px | 12px / 18px | UI语义变量 |
| Button | 13px / 18px | 13px / 18px | 共享控件，触控热区独立 |

紧凑档H1 22、Body13，舒适档H1 26、Body15；手机H1分别19/22。文档字号不随UI档改写。
段落对齐、0–8级缩进、0–48pt段前段后通过既有业务转换层保存；旧内容缺属性沿用默认。
A4仍使用既有独立文档变量；派生组标题12pt、步骤11pt、确认项10pt，保留手写字号。
间距阶梯在 `globals.css` 的 `ln-space-*`；禁止通过缩放正文实现密度。

## 页面覆盖（需以最终浏览器报告补齐）
首页、列表、实验、Protocol、Run、Record、Inventory/采购、设置、工具、属性面板：共享PageHeader/Card/Button迁移；逐页实测待最终截图批次，不能仅以共享代码覆盖认定通过。
