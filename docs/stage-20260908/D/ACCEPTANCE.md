# D 四个站内工具验收

PR #73，依赖C #72。联合应用代码071df83，隔离生产3235。

| 工具/场景 | 结果与证据 |
|---|---|
| qPCR排板 | 通过：原工具示例+CSV两名称导入，生成、逐板确认、ZIP下载；解包其中XLSX含Synthetic-A。 |
| CNV排板 | 通过：CSV名单→原导入→生成→XLSX下载并回读样本名称。 |
| qPCR分析 | 通过：12个合成Cq记录→打开分析→选择Control校准→五工作表XLSX实际下载回读Treatment。 |
| CNV分析 | 通过：24物理孔/双靶标合成数据，明确勾选已知2拷贝校准样本；XLSX和JSON下载回读。 |
| 导航/卡片 | 通过：四工具同站iframe、返回目录；键盘Enter打开卡片，Preview独立弹窗不跳转。原目录没有收藏按钮，未新增或冒称收藏验收。 |
| 视口 | 通过：4工具×桌面/手机×浅色/深色16截图，根页面无溢出。嵌入内容保留各原工具自己的主题。 |
| 真机/人员 | 未执行。未声称所有原工具未保存分析状态跨导航自动恢复。 |

下载证据 evidence/file-checks.json 及对应5份ZIP/XLSX/JSON；截图{id}-{desktop|mobile}-{light|dark}.png。脚本 verify-stage-tool-files、verify-stage-tools。

原工具路径、固定输入版本、SHA256见SOURCES.json，sync-embedded-tools.mjs可重复同步；不修改原目录或算法。补齐CNV分析原有diagnostics.js依赖；新增名单文件读取仅将明确选择的列送入原导入控件，导入后收起上方区并定位到工具。真实用户文件未读取。
