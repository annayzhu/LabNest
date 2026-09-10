# Sep10 逐项验收

本报告仅对 VERSION.json 所列应用版本和合成夹具范围负责。**PR #77，未合并、未正式部署。** 最新 main/原部署基线为 `4f93dc8910cdc2b9f55914e632a82154f470caa8`；原目录的无关修改保留。

“通过”指下面明确写出的检查；不包含真机、所有历史数据、所有业务路径或未经执行的跨系统键位。自动化与页面证据分别给出，测试数量不能替代页面验收。旧失败日志保留用于追踪，最终结果以本表指向的报告和 VERSION.json 为准。

|编号|项目|状态|实际结果与边界|证据（本目录相对路径）|
|---|---|---|---|---|
|N01|版本与原要求|通过|隔离分支基于最新 main 4f93dc8；应用版本、CI 与实际部署分开记录；历史遗留逐项保留。|VERSION.json、OLD-REQUIREMENTS.md|
|N02|执行记录层级|通过|组12pt、步骤11pt、确认10pt；PC缩进16px、手机12px；多行文字保留。|evidence/execution-browser.json、execution-390.png|
|N03|偏差标签|通过|只有“偏差/异常”标签描边；保留处理文字、影响与记录人，普通步骤无整框。|evidence/execution-browser.json、execution.pdf|
|N04|完成语义|通过|真实合成例1项完成、2项未完成；正文保存后勾选不变；完成Run必须显式确认。|evidence/execution-browser.json、database.json；experiment action 回归|
|N05|执行记录保存/打印|通过|保存→刷新→重编→只读→PDF，原手写18pt内容保留；派生内容不成为可覆盖的历史源。|evidence/execution-final.log、execution.pdf|
|N06|基本文字与快捷键|通过|当前macOS Chromium实际选区B/I/U、剪切、撤销/重做及复制菜单通过；跨系统键位边界见KEYBOARD.md。|evidence/paragraph-browser.json、clipboard-browser.json、editor-hardening.log|
|N07|四种对齐|通过|普通段落及四个单元格逐项设置、保存、刷新、重编与PDF；纯文本单段落单元格另有独立回归。|evidence/paragraph-browser.json、paragraph-four-alignments.pdf|
|N08|普通段落缩进|通过|混合选区、四段一起缩进、0–8上限/下限、撤销/重做、保存往返；段前后由相同schema保留。|evidence/paragraph-browser.json；protocol-tiptap.test.ts|
|N09|列表/表格Tab|通过|列表Tab/Shift+Tab改变层级，表格Tab进入下一单元格；没有全局劫持Tab。|evidence/paragraph-browser.json、editor-hardening.log|
|N10|格式/纯文本粘贴|通过|真实浏览器剪贴板HTML和纯文本；标题、加粗、列表、表格、中文/科研符号；权限拒绝时内容不变；Entry表格保存回读。|evidence/clipboard-browser.json、entry-pasted-table.pdf|
|N11|全文字号作用域|通过|六入口整篇18pt含图片图注；单格、两格、行、整表不越界，混合字号和保存后字号已查。|evidence/fonts/text.json、font-all.json；fonts/*pdf|
|N12|六入口及模板|通过|Protocol、研究计划、实验、结果、报告、随手记录共用格式；模板独立schema保留对齐/缩进/子内容与粘贴表格。|evidence/format、template-format.json、template-pasted-table.pdf|
|N13|紧凑工具栏|通过|手机单行滚动，PC紧凑；实际菜单与原选区操作，正文不被多行Ribbon挤占。|evidence/editor-after-390.png、editor-hardening.log|
|N14|新Run实际创建|通过|由真实创建页面保存Protocol与实验，不向当前步骤DOM注入假表；逐项核对表内数据和图片decode。|evidence/synthetic-run.json、run-browser.json|
|N15|表格归属|通过|步骤A/B分别显示其数据；同名标题按源身份，公共表在规程参考，Checklist后内容按冻结规则归属。|evidence/run-browser.json；run-step-content.test.ts|
|N16|旧Run兼容|通过|合成旧分组快照严格按同一锁定版本恢复；无法核对者保留文本和缺失提示。原故障记录未确认，不能泛化。|evidence/legacy-browser.json、database.json|
|N17|宽/长表可达|通过|320/360/390/430、横屏844和1440；25行8列的末行末列真实可达，横向滚动限于表内。|evidence/run-browser.json、run-320.png、run-844.png|
|N18|参数/注释/单位|通过|真实行列数值、µL、表后说明与参数值核对；冻结材料区保留，未知参数不猜测。|evidence/run-browser.json、calculator 回归 run-compat/integration|
|N19|手机短步骤同屏|通过|同一合成Run、390×844前后位置测量与截图；正文起点明显提前。极长内容仍按需滚动。|evidence/density.json、density-before.png、density-after.png|
|N20|Record与草稿|通过|观察/测量/结果收纳；测量关闭重开和刷新恢复，提交后清空；偏差/计时/输入往返与离线重试另测。|evidence/legacy-browser.json、database.json；calculator 离线/Run报告|
|N21|属性区域|通过|Protocol标签和值同行，附件收起可展开；六入口元数据边界与窄屏保存按钮已查。|evidence/properties-after-390.png、editor/metadata.json、editor-hardening.log|
|N22|全站文字角色|通过|统一标题/正文/标签/按钮大小、字重、行高和间距；修正旧手机important行高覆盖；文档pt独立。|TYPOGRAPHY.md、evidence/visual/coverage.json|
|N23|全站覆盖|通过|11类路由×390/1440×浅/深色共44页；逐页页面响应、标题实测及截图，不将此认定为所有业务流程复测。|evidence/visual/coverage.json、visual/*.png|
|N24|动效与减少动态效果|通过|保留统一控件/面板动效，去除折叠正文反复入场；减少动态效果下44页及交互不依赖动画完成。|evidence/visual/coverage.json、clipboard-browser.json、editor-hardening.log|
|N25|A4与图片回归|通过|六正文及模板真实图片保存/刷新/只读/重编，预览失败回退；PDF逐文件A4/非空/图像检查，宽表末行末列。|evidence/editor/final-phases.json、pdf-audit.json；各PDF|
|N26|真机IME/软键盘/160%|未执行|本机模拟IME、视口不替代手机中文选词、触控、软键盘与160%实际缩放。|MANUAL-ACCEPTANCE.md|
|N27|历史与独立业务保护|通过|冻结快照hash与步骤身份/完成状态不变；测量回读与重复提交数=1；Calculator 22阶段；未改库存交易或迁移。|evidence/database.json、calculator-final.log、OLD-REQUIREMENTS.md|
|N28|实体打印/实验人员|未执行|PDF输出不等于物理打印，自动操作不等于实验人员试用。|MANUAL-ACCEPTANCE.md|
|N29|移除冗余卡片|通过|默认去除Step review、全零Evidence、重复身份及Offline pages标题；参考/离线入口仍可展开。|evidence/density-after.png、run-browser.json|
|N30|进度/完成去重|通过|一处进度；当前选中步骤和完成数区分；完成勾选不等于直接结束Run。|evidence/run-browser.json、calculator Run回归|
|N31|空统计/失败语义|通过|删除误导性的空统计面板，不将读取失败显示成0；记录入口与保存失败提示保留。|evidence/legacy-browser.json、calculator 离线失败报告|
|N32|条件性提示|通过|正常在线不铺离线管理；未同步/失败仍提示；真正缺失的旧内容明确标记。|evidence/legacy-unverified.png、calculator 离线报告|
|N33|手机密度与语言|通过|同内容/视口前后对照，中文工具/草稿提示不重复中英；完整方法按需查看，打印单独渲染。|evidence/density.json、visual/run-390-dark.png、execution.pdf|

## 修改位置

- Run历史/表格/参数：`src/lib/run-step-content.ts`、`protocol-tiptap.ts`、`src/app/experiments/[id]/run/page.tsx`。
- 正文保存与执行记录：`src/app/experiments/actions.ts`、`src/lib/experiment-document.ts`、`src/components/ScientificBlockView.tsx`。
- 对齐/缩进/字号：`document-paragraph-layout.ts`、`scientific-tiptap.ts`、`protocol-document.ts`、`tiptap-table-serialization.ts`、`result-templates.ts`。
- 共享操作与轻量表格：`CompactRichTextTiptapEditor.tsx`、`DocumentWysiwygToolbar.tsx`、`ScientificTableView.tsx`、`EntryContentView.tsx`；Entry沿用现有Markdown字段，用校验过的既有Scientific table表达富单元格，并复用只读/打印组件。
- 手机Run/Record：`ProtocolRunProgressForm.tsx`、`MobileMeasurementCapture.tsx`；UI角色及属性区：`globals.css`、`PageHeader.tsx`、`ui/Card.tsx`、`forms.ts`、`ProtocolDocumentView.tsx`。

## 未执行及不扩大结论

- N26、N28：真机中文输入、软键盘/触控、160%缩放、实体打印、人员试用。未执行不自动转为通过；短步骤见 MANUAL-ACCEPTANCE.md。
- 原用户故障记录身份尚未确定；只读检查五份生产快照，不写入生产、不公开原始内容。合成旧Run恢复结果不等于全部历史记录恢复。
- Inventory独立workflow未启用：正常Git推送曾因当前凭据缺少workflow权限被拒绝；未绕过。采购/库存原有单元回归通过，未重做真实采购、报销、扣减、发票与业务人员试用。
- macOS Chromium之外的真实Windows/Linux快捷键、Word应用自身复制来源、物理打印驱动未执行；本轮HTML剪贴板用标准富文本夹具。
- A4 PDF可表达版式；CSV无法表达字号/对齐，核对的是内容。模板新粘贴表格PDF已查，跨软件DOCX视觉保真未逐份执行。
- 真实手机内网HTTP不是可信HTTPS离线验收；局部localhost离线回归不能替代证书及手机网络环境验收。

## 曾失败后修复

本轮先后复现了旧分组Run缺表、表格单段落对齐保存丢失、实验正文保存清除勾选、模板schema丢格式、Entry粘贴表格被压平；各自有红例和修复后回归。浏览器脚本的旧菜单名称、隐藏节点、导入路由误选和已迁移属性面板定位已修正；早期服务器构建目录错误及负载干扰不记为产品通过。
