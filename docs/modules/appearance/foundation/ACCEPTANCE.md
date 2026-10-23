# 第二批：Appearance 基础体验独立验收

PR #58；独立从 main `4ad14fca3d17805749a8aafdcf15ea204579e984` 建分支，不包含第一批修复。源码 `4b3ab5fc33b8d17049f79309c7a323e960875d83`。本批成功不能替代 PR #57 的关闭证据。

| 需求 | 状态 | 证据与边界 |
|---|---|---|
| 明暗、配色、图标、字体、字号、间距分组 | 通过 | AppearanceSettings 实际页面六组；四张settings截图 |
| 字号与间距独立 | 通过 | uiScaleId保持旧语义，densityId仅影响padding/gap；页面测量字体不变而padding变化，report.json |
| 旧偏好与合理默认值 | 通过 | v1无densityId默认standard；配色、字体、comfortable字号均保留；未知值仍保护，不覆盖计算历史 |
| 真实预览内容 | 通过 | 复用Card及ProtocolContentBlockView，展示选中导航、实验卡、步骤正文、配液表、计算器/计时器、成功/警告/错误。按钮为明确示例，不写实验数据 |
| 桌面并排、手机单列可收起 | 通过 | 1440×1000和390×844，布局列数断言；手机折叠/展开实际点击 |
| 当前明暗模式对应配色 | 通过 | 七套方案×两模式色值记录；色卡data-preview-mode与选择一致；system响应和explicit模式回归 |
| 所有已有配色深色版 | 通过 | system-theme.ts逐套明确深色accent/selection/paper，保留原ID；十四组合颜色/对比测试及页面测量 |
| 选中、成功、警告、错误区分 | 通过 | 各有独立语义token与文字，四种背景不同；成功/错误与正文对比≥4.5，既有控件/焦点阈值通过 |
| 深色实验图标与fallback | 通过 | 共用中性小底板，复用已有资源；失败图片实际拦截后回退线性图标，标签和六个链接不变 |
| 图标覆盖说明 | 通过 | 设置注明仅六项常用计算；其他工具回退经典线性，Today/首页/工具标题同组件 |
| 手机六项3×2及大字号 | 通过（模拟视口） | 既有320/360/390中英半屏检查；default/comfortable六项、触控与无溢出断言，放大不隐藏标签 |
| 皮肤统一基础 | 通过（本批基础） | 复用ln-radius/ln-shadow，加入ln-border-width/content-padding/content-gap/decoration-opacity/icon-plate；作用于共享Card与预览/色卡，详见MAINTENANCE.md |
| 三套完整新皮肤 | 未执行 | 按用户范围，待视觉稿确定后接入；本批不提供假皮肤选项 |
| 科研图表/分组色/正式导出隔离 | 通过（工程与已测文档） | 本批未修改图表映射或导出器；真实实验编辑器paper的HTML/字体/背景/颜色跨设置变更不变。全部导出格式逐文件比对未执行 |
| 旧存储异常保护/恢复/跨标签页 | 通过 | storage-browser-report.json；旧key字节保留，外观不解除Calculator保护 |
| WB/单位/记录/独立工具继承回归 | 通过 | appearance-browser-report.json、standalone-report.json、wb.csv/xlsx，真实Result链路 |
| 双时区测试、类型、Lint、生产构建 | 通过 | 每时区92文件523测试；类型/构建0退出；Lint 0错误11既有警告 |
| 最新源码浏览器CI | 通过 | run 34077599962：双时区quality与browser全部success，完整结果CI.json |
| 桌面/手机/浅色/深色页面截图 | 通过（自动化） | evidence/settings-{desktop,mobile}-{light,dark}.png，实际Next生产服务；不是视觉稿 |
| 真机键盘 | 未执行 | 未连接真实手机 |
| 真实200%浏览器缩放 | 未执行 | CSS zoom补充检查不等同真实缩放 |
| 实验人员试用 | 未执行 | 无虚构用时、错误率或反馈 |

初次扩展脚本对隐藏radio强制点击导致定位不稳定，改为点击用户可见标签；既有单按钮预览断言更新为新的指定按钮及警告样式。没有通过删除对比度或历史不变量检查掩盖失败。最终本机相关流程全部通过，远端最终状态独立核对。

环境与命令见evidence/INDEX.json。测试脚本默认输出到既有v1.1 evidence目录供现有CI上传，本批复制到此处并恢复旧历史证据。正式运行部署未更新，本轮只提交两个PR供分别审查。

Linux CI 初次发现新预览按钮默认焦点描边在深色模式对比不足（ci-initial-failure.txt）。源码4b3ab5f已复用项目focus-ring，未降低对比度阈值；重新生产构建、foundation与visual浏览器流程本机通过。
