# Structured Protocol staged acceptance

Baseline: `65500d2e940e1b861ac9ec78950eeb14c7292fdc`. In progress; no release claim. User confirmed three public testing seams. All new test records are synthetic in an isolated database. On 2026-10-14 the user confirmed the 4-photo/7-file issue is resolved.

| Item | Requirement | Result | Evidence / remaining work |
|---|---|---|---|
| A01 | 同一规程的两个体系使用一致的文字、形状和颜色，黑白显示仍可辨认。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A02 | 通用预览完整显示所有差异；仅切换预览不会修改实验选择。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A03 | 示例参数按350 µL／600 µL分别得到50／80 µL，不进行比例猜测。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A04 | 样本条件独立于体积体系；未填写时显示待确定，不误判为不适用。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A05 | 不合法组合、单值参数缺值／多重匹配、互斥分支冲突能被检出；独立条件允许同时适用。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A06 | 不适用内容默认收起且可查看；源文档未删除，执行按钮不可用。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A07 | 条件参数、条件段落、条件步骤和表格行过滤分别正确，单位与表头不丢失。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| A08 | 共同步骤仅出现一次；资料说明、普通checkbox和表格不会新增执行步骤。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B01 | 第一条依赖体系的操作前必须确认选择；不能用推荐项冒充用户选择。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B02 | 步骤重排后，完成、照片、备注和计时器仍绑定正确步骤ID。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B03 | 模板修改不影响已创建实验；旧版本和本次采用参数可回溯。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B04 | 步骤标题与正文不重复；跨步骤引用仍能找到正确来源。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B05 | 已完成、跳过、不适用和待确定分开显示；必需步骤人工跳过后仍保留在分母，不误报100%完成。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B06 | 已执行受影响操作后改体系，按第7.2节处理；旧记录保留，新实例可见此前处理与继续位置，活动计时器不被静默覆盖。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B07 | 执行时记录实际值不会回写模板；不同实验的计时器和结果互不串用。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| B08 | P2多组采用不同体系时各自正确；批量应用只改变明确选中的组，共享步骤不重复计数或任取某组参数。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C01 | 在长文中修改H2、列表、粗体和参数后，光标与视野无异常跳转。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C02 | 中文输入、标点、撤销重做、工具浮层开关及自动保存不丢字、不重复。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C03 | 表格菜单对齐；编辑、粘贴和保存回读后行列及内容正确。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C04 | 同文档拖动图片只移动一次；明确复制产生新节点且资产关系正确。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C05 | 4张照片的图片引用数和原始文件数正确；原“7文件”问题逐项查明。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C06 | 上传失败、重试、删除、撤销及恢复不制造重复文件或不可见占位。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C07 | 打开／关闭组件编辑面板不丢失选区；触屏不用悬停也能完成相同操作。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C08 | 保存后重新打开、只读预览及复制后内容语义一致；未知旧节点可保留查看。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C09 | 每一个真实文本入口都已登记并按其能力配置检查，不能只测一个共享演示页。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| C10 | 选取一份具有长正文、多个表格、图片及条件节点的代表性文档，记录长度与测试设备；连续输入和保存无明显卡顿，不能以空白短文代替性能验收。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D01 | 参数保留数值、单位及来源；不把rpm直接当作×g、不擅自缩放时间。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D02 | 计算器使用既有公式，保存输入和结果版本；修改输入后旧结果失效，依赖它的待执行操作须重新计算并确认才能继续。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D03 | 计时器编辑／预览不启动；刷新、暂停、恢复及重复点击不重建多个实例。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D04 | 计时结束不自动完成步骤；时钟变化和返回前台后的状态经过验证。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D05 | Entry归入后保留原始记录时间和附件，归入时间独立保存。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D06 | P2确认结果固定来源Entry版本；后续修改不会悄悄改写已确认记录。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| D07 | AI关闭时，体系、参数、步骤、计时、计算和记录全部正常。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E01 | 桌面、iPad横竖屏／分屏、手机均能清楚看到当前组、体系与步骤；无整页横向溢出。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E02 | 真实iPhone／iPad的中文键盘、触控选择、拍照上传和面板定位通过测试；P1覆盖核心执行交互，P2覆盖其余迁移入口，桌面模拟不能替代。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E03 | 网页后台、锁屏和重新打开后按时间恢复；不以后台回调准时运行作为前提。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E04 | P2离线操作和照片分别显示本机／待同步状态，刷新后仍可恢复。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E05 | P2重复提交不重复记录；两设备冲突不静默覆盖正文或完成状态。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E06 | P2通知权限关闭、主屏幕安装差异、断网、取消旧计时器和多设备提醒经过能力验证。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E07 | P3手表操作同一实验实例；断连重连可恢复，关键参数不因短摘要被截掉。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| E08 | P3手表收到通知与在手表完成步骤分别验收，不混为已实现。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F01 | 转换有原文快照与映射；重复执行不制造重复节点、附件或实验。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F02 | 旧实验完成状态、备注、结果、原始时间未因新解析逻辑错位。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F03 | 通用规程与执行记录的复制／已有导出内容正确，清楚标明体系及源版本。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F04 | 新导出Word／PDF若纳入本阶段，已按相应skill渲染核查；未实现不写成完成。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F05 | 两项专项skill已创建并验证、可被实施环境使用；真实使用记录和未具备能力说明齐全。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F06 | 关键条件逻辑、迁移和状态转换有必要自动化检查；跳转、拖动、软键盘和锁屏有实际交互证据。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F07 | 交付包含真实改动文件、迁移范围、版本、阶段验收及已知限制，未修改和未测试部分明确列出。 | 未执行 | Implementation / verification pending; follow phase in requirement |
| F08 | Matt Pocock、Impeccable、Ponytail 已在对应阶段实际加载并应用；记录来源、版本、使用任务、产物与验证证据，未运行或不适用部分明确说明；仅安装、阅读或列链接不算完成。 | 未执行 | Implementation / verification pending; follow phase in requirement |
