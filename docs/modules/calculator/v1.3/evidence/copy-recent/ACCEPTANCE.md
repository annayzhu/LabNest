# 复制与最近使用补充验收

应用提交：971d79bcd0ab2060d3aab69847c7f45f4fe3a641。

本补充按用户最新要求替代历史报告中“复制默认携带警告和追溯信息”的要求。正式 CSV/XLSX 及内部快照继续保留这些内容。

| 要求 | 结果 | 位置与证据 |
| --- | --- | --- |
| 单值名称、数值、显示单位；多值逐行 | 通过 | result-presentation.ts；copy-recent.test.ts；browser.json 中 30 个工具的实际剪贴板全文 |
| 配液组分、用量、必要操作及梯度来源 | 通过 | 30 工具示例页面复制；gradient-source.test.ts 保留 10+90、20+80 回归；不复制内部 JSON |
| 无效结果不正常复制 | 通过 | 部分无效结果禁用按钮；格式化入口拒绝 partial、非有限数；原输入校验继续清除无效结果 |
| 页面警告、假设和内部结构保留 | 通过 | ResultPanel 保持；导出使用独立 resultAuditText；旧导出回归继续通过 |
| 最近最多6项、去重、时间排序 | 通过 | 导入乱序及重复记录测试；浏览器注入7个工具及重复记录，显示6项，最新项第一 |
| 仅图标短名、整卡链接、规则网格 | 通过 | desktop.png、phone.png；实测等宽、图标、无摘要；手机两列 |
| 窄视口不截断、无横向滚动 | 通过（模拟） | narrow-zoom-equivalent.png；244px视口单列，不能等同真机缩放 |
| 空记录隐藏 | 通过 | browser.json 的 emptyHidden |
| 双时区测试、类型、生产构建、定向lint | 通过 | shanghai.log、vancouver.log，各545项；typecheck.log、build.log、lint.log |
| 真机160%缩放 | 未执行 | 手机上打开首页，使用至少6个工具后返回；缩放到160%，确认名称完整、可点、无横向滚动 |

浏览器复现：生产构建启动后设置 LABNEST_E2E_BASE_URL，运行 scripts/verify-calculator-copy-recent.mjs。此次使用 localhost:3225 的生产构建。图片计数工具没有既有复制按钮，不计入30项复制页面验收。原生失败后的兼容和手动复制沿用原有实现，本次没有重跑全部离线、Run与数据库验收。

本次无未解决的测试失败。代码更新到 PR #59；未合并、未替换正式3000端口部署。
