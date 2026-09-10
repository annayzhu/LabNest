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

## 页面覆盖
浏览器覆盖 `evidence/visual/coverage.json`：首页、实验列表、实验详情、Protocol、Run、Record列表、Inventory、采购、Settings、Tools、实验编辑器，共11类路由 × 390/1440px × 浅/深色，44张实际页面截图。

标题实测保留在JSON内。PageHeader和首页H1的默认行高为桌面32px、手机28px，额外断言防止旧mobile !important覆盖。H2/3用于系统UI；文档纸张和Tiptap正文不纳入全站覆盖规则。工具紧凑标题与文档内标题使用原有特定语义，不强行改写科研内容。

UI字重：H1/H2/H3 600、Body/Caption 400、Label/Button 500。文字、行高与点击热区独立。截图覆盖证明所列页面布局和主题，不等于每个库存/采购流程已重复操作。
