# Visualization Studio 历史界面需求核查与遗漏清单

核查日期：2026-09-20。性质：只读审计及后续执行清单；本次未修改应用代码。

## 1. 结论和核查边界

用户记忆有直接依据。Notion「LabNest」需求单2026-09-04记录了两条原始要求，可拆为三个验收点：

1. 右侧 Figure parameters 展示窗口拉长。
2. 下方“图形定义与适用场景”整块可以收起。
3. 中国传统配色保留“中国红”，其余全部重新配色。

截至本次读取的 LabNest main，这三个验收点分别为：**部分已有实现但未闭环、未实现、未实现**。不能用8月的配色更新、图表功能同步或其他计算器验收替代这批9月需求。

核查基线：

- LabNest：`2200db8f03ed46554cc7cef232f0fd33ccc3c125`，main最新提交为2026-09-16合并PR #80。
- 独立仓库 Visualization-studio：`e5173126cceb3379e5137df65549bdced2696aa0`。
- 已读取原始Notion需求、历史上下文、相关任务文档片段、当前源码、文件提交历史及相关PR。
- 用户运行入口已知为 `http://localhost:3000/tools/visualization`。本次无法读取用户电脑的启动目录、未提交改动或浏览器实际运行版本，因此以下结论针对远端已提交代码；未宣称真机或本机界面实测。
- 找回的直接原始记录包含上述三点。历史检索没有提供足以核实更多同轮Visualization特定要求的原文，不能声称已穷尽所有历史会话。

## 2. 原始需求逐项核查

| ID | 原要求 | 当前证据 | 判定 |
|---|---|---|---|
| VIS-01 | Figure parameters展示窗口拉长 | 当前有基于窗口高度的侧栏布局、内部滚动和伸展容器；但说明区仍与参数卡片共享右栏高度，不能收起。该布局逻辑只在xl断点启用 | 部分已有实现；需要结合VIS-02完成实际可用高度验收 |
| VIS-02 | “图形定义与适用场景”可以缩回 | 外层仍为常驻aside；标题没有折叠按钮，定义/适用数据/适用问题直接渲染。只有内部“方法由来”“方法学参考文献”使用details | 未实现；子项折叠不等于整块折叠 |
| VIS-03 | 保留中国红，其余中国传统配色全部重配 | 调色板所在文件最后变更为2026-08-28；其后没有落实9月4日重配要求的变更。当前仍有9套中国传统主题，即中国红之外8套需重新设计 | 未实现；此前“提亮所有配色”不能视为本条完成 |

### VIS-01/02 代码定位与实施验收

定位：`src/components/VisualizationStudio.tsx`。

- `mainGridStyle`计算 `--visualization-panel-height`，值为扣除顶部区域后的100dvh。
- `data-visualization-panel="parameters"`下同时排列参数卡片和说明aside。
- 参数CardBody已有`xl:flex-1`及`xl:overflow-y-auto`，说明目前并非完全没有长参数栏实现。
- `data-plot-guidance`外层没有折叠状态；内部两个details不能满足整块收起要求。
- 同仓库standalone副本也存在同样的常驻说明；独立仓库组件blob与该standalone副本一致。因此该问题不是“独立版已修好但LabNest漏同步”。

后续补齐要求：

1. 整块说明提供清楚的展开/收起入口；收起后保留短标题和展开按钮。
2. 收起释放的空间由参数区域实际使用，不能仅隐藏文字而保留空白高度。
3. 原始要求没有指定首次进入默认状态。建议默认收起作为本轮实现选择，并在交付中标明；不要伪称这是原始原话。
4. 桌面长参数图、低高度窗口和窄屏均可访问所有参数；展开说明不能导致底部内容被裁切。
5. 保留现有方法说明、参考文献及统计含义，不以删掉内容代替折叠。
6. 对用户实际LabNest入口提供同视口的展开/收起截图；至少记录窗口尺寸、参数可见高度、可滚动范围。
7. 检查键盘操作、焦点和切换图表后的状态；折叠不应更改数据、图形设置或导出内容。

### VIS-03 配色实施验收

定位：`src/lib/visualization-studio.ts`中`paletteSeries`与`journalThemes`。

当前中国传统主题ID：
`cn-beihai`、`cn-imperial-orange`、`cn-wisteria`、`cn-sunset`、`cn-hutong`、`cn-dragon`、`cn-coral`、`cn-autumn`、`cn-vermilion`。

- 保留中国红（`cn-vermilion`）；其余8套逐套重配，提供真实渲染前后对照。
- 延续原有主题标识和合法保存配置；不要让配色改动静默破坏已保存图形。
- 预览、导出、LabNest内置组件和独立版本应使用一致的预设定义。
- 以分类柱状图/散点图、连续或发散热图检验实际效果，不仅检查色块卡片。
- 分组可辨认性、背景上的可读性与科学含义保持一致；不借UI调整更改计算、分组、统计检验或数值。
- “好看”属于视觉验收，不能仅用单元测试通过宣布用户认可。

## 3. 附带发现：避免误归为原始遗漏

| 项目 | 现状与处理 |
|---|---|
| 参数控件仍可进一步紧凑 | 标签/下拉框多为上下排列，滑条为下一行；RangeControl的标签与可编辑数值已经同排。可作为本轮细化建议，但尚无足够原文证明“所有参数必须同排”是9月4日的原要求 |
| 数值能否直接输入 | 当前RangeControl已有数值输入、Enter提交、Escape取消；不应再列成“完全未开发” |
| 参数分组 | 当前已有Labels、Compact layout、Marks & axes及图表专属分组；分组存在不等于密度已经合适 |
| 顶部栏和图表选择 | 当前已有sticky顶部栏、图表搜索与分类；本次未找到足以核实其全部历史验收标准的原文，不据此宣布完整验收或重新下发 |
| LabNest与独立版布局 | LabNest入口调用根组件并由AppShell包裹；独立仓库使用独立入口。两边主组件存在差异，但上述说明不折叠是双方共同缺口 |
| 主要计算/渲染/配色同步 | 比对当前树中的文件blob，相关同名核心文件一致的事实只能证明源码一致，不能证明用户电脑运行的是该版本 |
| 软件首次导航、可选demo data | 在同一Notion页面的8月30日记录中出现，但属于LabNest全站需求；本次不将其混作Visualization专项遗漏 |

## 4. 为什么之前看起来“做过”，现在仍不符合要求

时间顺序是关键：

1. 2026-08-28：PR #7刷新既有配色；PR #13同步内置版图表功能。这两项早于9月4日反馈。
2. 当前主组件最后直接变更于2026-09-01，主题/计算文件最后变更于2026-08-28；后续计算器调整不能自动证明本组件已修改。
3. 2026-09-04：用户提出新的右栏与配色要求。
4. 2026-09-06：Calculator v1.1文档明确“不纳入 Visualization Studio 参数栏、中国传统图表调色板重设计”。
5. 当前代码仍缺整块说明折叠和非红色中国传统主题重配。

因此，证据支持“需求没有在后续专项中完整落实”。没有证据表明仅刷新页面或同步现有main就能获得尚未实现的功能。也不能把该缺口概括为全部Visualization功能都未同步。

## 5. 给本机Codex的执行交接

请以VIS-01～03为原始需求补齐范围；第3节的附带发现须区分已有功能与新建议。

1. 读取仓库规范，记录启动3000端口的实际目录、分支、HEAD和未提交改动，对照本报告基线；保护用户数据和未提交工作。
2. 先复现用户实际入口，再修改根组件；不要只修改standalone副本。
3. 同步相关独立交付源，并检查是否存在生成/复制流程覆盖新代码的风险。
4. 补齐整块说明折叠、释放右栏高度、8套非红主题重配。
5. 提供逐项对照、实际截图和未验证事项。保留现有数值输入、图表计算、配色保存、导入导出能力。
6. 本报告是核查与执行依据，不是已修复证明；本次没有创建issue/PR、合并或部署。

## 6. 可追溯来源

- [Notion原始需求单：2026-09-04](https://app.notion.com/p/3b365cd5a9da808897fed2caaf89968c)
- [本次LabNest核查提交](https://github.com/annayzhu/LabNest/commit/2200db8f03ed46554cc7cef232f0fd33ccc3c125)
- [内置界面组件](https://github.com/annayzhu/LabNest/blob/2200db8f03ed46554cc7cef232f0fd33ccc3c125/src/components/VisualizationStudio.tsx)
- [配色与图表配置](https://github.com/annayzhu/LabNest/blob/2200db8f03ed46554cc7cef232f0fd33ccc3c125/src/lib/visualization-studio.ts)
- [LabNest入口](https://github.com/annayzhu/LabNest/blob/2200db8f03ed46554cc7cef232f0fd33ccc3c125/src/app/tools/visualization/page.tsx)
- [独立版界面组件](https://github.com/annayzhu/Visualization-studio/blob/e5173126cceb3379e5137df65549bdced2696aa0/src/components/VisualizationStudio.tsx)
- [9月6日任务范围排除条款](https://github.com/annayzhu/LabNest/blob/2200db8f03ed46554cc7cef232f0fd33ccc3c125/docs/calculator/spec-v1.1.md)
- [早期配色PR #7](https://github.com/annayzhu/LabNest/pull/7)
- [早期内置同步PR #13](https://github.com/annayzhu/LabNest/pull/13)

