# 第一批：v1.2 阻断修复验收

基线 main `4ad14fca3d17805749a8aafdcf15ea204579e984`。源码 `78fe8e07cbaf9b25da18218eb0a02cc0d22bd855`；PR #57。原工作区无关修改保留。本批不包含 Appearance。

| 需求 | 状态 | 实现与证据 |
|---|---|---|
| 线性、自定义并行来源 | 通过 | operations从同一结果表source字段读取；100 µM→10/20 µM，100 µL，独立断言10+90/20+80；gradient-source.test.ts及browser.json |
| 连续模式来源 | 通过 | 从原母液制备第一管，后续分别Tube 1/Tube 2，独立单测 |
| 表、操作、复制、CSV一致 | 通过 | 页面计算后读真实历史snapshot、系统剪贴板与下载CSV；gradient-clipboard.txt/gradient.csv |
| 普通与富文本标题归属 | 通过 | heading/heading2/heading3一致；标题后的表、图片、列表、说明按源顺序。run-step-content.test.ts；真实Run测试使用rich_text标题保存Protocol并创建实验 |
| 真正公共准备 | 通过 | 投影显式commonBlocks，仅标题前公共内容共享；不以“未匹配节点”推定公共内容 |
| 手机完整步骤、同排按钮 | 通过 | 320/360/390，完整表及宽表末列/末行，44px工具入口；run-browser-report.json及截图 |
| 主页入口与返回状态 | 通过 | 非首步骤→主页→工具→Run；步骤ID、未保存备注和计时保持，原完成状态不被提交 |
| 旧Run兼容 | 通过（合成旧记录） | 缺block副本从冻结同版本内容恢复；纯文字明确缺格式、不伪造表。run-compat.json。未修改生产历史 |
| 参数化表格 | 通过 | 隔离库设置tube_count=12，真实Run显示12，pending占位保留；原参数/快照在finally恢复。该夹具不证明参数编辑UI |
| 离线完整往返 | 通过（已缓存） | 原主页缺缓存入口，补复用组件；Run→主页→稀释→原步骤全程离线。offline.json；未缓存首次访问不承诺可用 |
| 实验写入与数据库回读 | 通过 | 实际UI入队→真实API→Result，exact operations/warnings/step及幂等计数1；v12-database-report.json |
| 双时区测试/TS/生产构建 | 通过 | 每时区93文件515测试；typecheck/build退出0；lint 0错误11既有警告 |
| 浏览器CI | 通过 | 源码run 34076969656：双时区quality与真实生产browser均success；CI.json |
| 桌面、手机、浅色、深色截图 | 通过（自动化页面） | gradient-{desktop,mobile}-{light,dark}.png；run同组合；run-320/360/390.png |
| 真机键盘 | 未执行 | 未连接真实手机；模拟视口不是实测 |
| 真实200%浏览器缩放 | 未执行 | 不用CSS zoom冒充 |
| 用户试用 | 未执行 | 未招募实验人员、不编造反馈 |

方法版本提升为serial-dilution-v3；旧历史不重写，当前重算产生新结果。旧Run恢复只使用实验冻结内容的稳定source_ref；纯序号记录只有标题/描述/顺序能核对时才恢复。

复现命令、环境、输入来源和证据分类见evidence/INDEX.json。所有实验与快照均为隔离库合成数据；旧快照测试的数据库改写只是兼容夹具，UI→API→数据库写入由另一独立链路验证。

初次CSV导出脚本定位使用错误按钮名已修正；初次完整离线往返发现主页缓存入口缺失并实际修复。原失败日志保留。没有未解决的已执行工程失败；外部人工条件仍明确未执行。
