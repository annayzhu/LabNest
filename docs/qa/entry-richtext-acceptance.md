# 2026-10-06 快速记录与富文本验收

本报告对应用户提供的 [任务书](entry-richtext-spec.md)。基线 main `bc3f3408b68a4d3d9346c1ae490f7d5a673a77e9`，开发 PR [#87](https://github.com/annayzhu/LabNest/pull/87)。本报告不将历史验收、页面存在或代码合并当作功能通过。

## 用户问题对照

| 用户问题 | 根因与证据 | 本轮修改 | 实际验收 | 未闭环范围 |
|---|---|---|---|---|
| 表格选项错乱 | 插入菜单将表格选项错误展开；窄屏列被压缩 | 6×8 选择网格，默认 3×4；共享菜单定位；单元格最小宽度，宽表只在本容器滚动 | 实际按钮插入、中文单元格、增行增列、保存回读；1440/1366/820/390/360 | 真机软键盘与 125% 真实浏览器缩放待测 |
| H2 跳转 | 共享工具栏 focus 默认滚动；本地回声重复替换整篇内容；块拆分沿用相同 ID | preventScroll，沿用现有 JSON/Markdown 适配器并跳过本地回声；拆分块生成不同 ID，明确格式撤销边界 | 长文中部和底部各十次 H2↔正文、撤销重做；焦点/视口/继续输入断言与可重放 trace | 中文候选输入仍待真机验证；慢图片/慢上传与标题组合另已实测 |
| 四图显示七文件 | 七个原件含四个当前内联原件、三个历史原件；旧计数把历史关联当当前附件 | 按当前内联与显式独立附件的原件 ID 集合计数；历史/派生/临时节点排除；不按文件名或 hash 删除 | 原记录只读核验；四图刷新回读仍四个；四图+PDF+URL+同图两处仍五个 | 原历史每次导入手势无法由现有日志恢复，不能认定七个都是误上传 |
| 图片移动失效或重复 | 内部 ProseMirror 拖动被外部上传路径接管；移动和撤销缺少独立边界 | 分流内部移动与外部导入；同节点/附件身份移动；上下移作为手机等价入口 | 内部拖动零新上传；一次撤销重做；原位/取消/无效落点；390px 上下移十次 | 真机触摸拖动及键盘遮挡待测 |
| 快速记录难整理 | 原关系缺少主要归属表达，正文可能被复制，时间语义混用 | 复用 Entry/ItemLink/ActivityLog；已有/新建 Experiment/Result；保存后归入；主关系唯一；原创建时间、事件精度、归入时间分别处理 | 手机真实归入、已有/新建结果、取消/改归属；响应丢失重试；数据库并发、旧时间保留；来源修改与冻结历史 | 项目现无登录/逐用户 ACL，不能宣称新增多用户权限管理 |
| 慢保存可丢最后输入 | 在请求发出后正文/固定属性栏仍可改，成功导航会丢弃晚输入；门户浮层不继承 form inert | 六类表单提交时暂停编辑，属性侧栏/格式菜单同步所属表单保存状态；陈旧版本服务器拒绝 | 正文、真实保存按钮下的固定侧栏、打开菜单的原生 submit 回归；跨记录未保存正文与图片恢复 | 菜单 submit 用例为原生事件辅助测试，不冒称手工点击；真正离线未作为本任务验证 |

## 环境、版本与证据边界

- 隔离数据库 `labnest_entry_richtext_test_20261006`；测试资料全部为合成“测试”记录。所有写入脚本限制该数据库或 3331 测试端口。没有将真实记录复制到公开证据。
- 原故障记录只读访问，七个原件、关联和当前正文实际核对；私有 ID、文件名、正文、原图只留在 Git 忽略的 `.local-runtime/entry-richtext/`，不上传 GitHub、不进入 Docker 镜像。
- 主环境 macOS Darwin 25.6.0 / Apple M4 Max / Node 22；Chromium 149.0.7827.55。Firefox 151.0、自动化 WebKit 26.5 完成核心表格/四图/移动/归入/旧保存冲突检查；自动化 WebKit 不等同于真机 Safari。
- 完整生产构建、类型检查、lint（0 错误，11 条既存警告）；109 文件 / 539 测试在 Asia/Shanghai 和 America/Los_Angeles 各通过。应用验证提交、各批证据版本与 CI 链接见 [release.json](evidence/entry-richtext/release.json)。
- 两轮：123 个真实路由 × 桌面/手机 = 246 次基础输入与宽度审计；随后六类正文各走桌面和手机完整操作，及关联/冲突/媒体专项。完整清单见 [入口审计](entry-richtext-input-audit.md)。基础输入审计不等同于每个业务字段保存回读，C08 如实保留待测。
- 1440×900、1366×768、820×900、390×844、360×844 已执行；100% 实测。125% 桌面快捷键尝试未改变真实浏览器缩放，原生桌面访问受锁屏限制，因此 **125% 未执行**，不以 viewport、DPR 或 CSS 缩放替代。

## 完整追踪包获取

截图、结果 JSON、日志、PDF/DOCX/Markdown 保存在本目录。较大的 Playwright trace.zip 原件保存在本机私有 `.local-runtime/entry-richtext/full-traces/`，不删除。最终 PR 的 Entry rich text acceptance CI 会生成 `entry-richtext-browser-evidence` 可下载包，其中包含本轮可重放的页面、焦点、拖动等 trace（GitHub Actions 按平台期限保留）。公开基线截图保留，基线追踪原件可在本机核对。完整包位置和最终 CI 版本以 PR 的交付回执为准。

## 逐项矩阵

状态使用任务书允许的“通过／失败／待测／阻塞／不适用”。“待测”包含已经通过的子用例，但整行仍有必要部分未执行；它不等于整行通过。

| 编号 | 状态 | 修改位置 / 验证动作与结果 | 证据 / 未执行部分 |
|---|---|---|---|
| A01 | 通过 | EntryComposer/API；不选目标保存文字和图片；未分类默认值 | [core](evidence/entry-richtext/interaction-report.json)、[手机新建](evidence/entry-richtext/advanced/report.json) |
| A02 | 通过 | entry-assignment.server / EntrySourceCards；真实归入已有实验，同一 source ID 与附件，目标原正文不改 | core、[来源页](evidence/entry-richtext/experiment-source.png) |
| A03 | 通过 | 原子新建 Experiment + ItemLink；手机“保存并归入”进入实际目标；并发重试一个目标 | advanced、[数据库](evidence/entry-richtext/relations.json) |
| A04 | 通过 | 已有 Result 的父实验重新校验；实际选择已有结果，原结果正文保持 | advanced、relations |
| A05 | 通过 | 对选定实验新建 Result；质量默认未评估；请求提交后响应丢失，再次提交仍同一目标 | advanced、relations |
| A06 | 通过 | entryType 可为 unclassified/experiment/observation/idea，分类与主归属独立；混合正文不自动拆分 | draft-switch 实际选择 idea/observation 并保存回读；advanced 整篇正文归入 |
| A07 | 通过 | 更改/取消主 ItemLink；source正文与 createdAt 不变 | advanced、relations |
| A08 | 通过 | 全局来源事务锁、部分唯一索引、稳定 mutation ID；重复/竞争归入不生成第二主关系 | advanced 响应丢失真实对话框；relations 并发数据库回读 |
| A09 | 通过 | createdAt 原始记录时间与 updatedAt/assignedAt 分开；不以目标新建时间替代来源 | relations、双时区单元日志；date-los-angeles.json |
| A10 | 通过 | 日期精度独立，空事件时间不伪造；日期编辑不退一天 | [日期真页面](evidence/entry-richtext/date-los-angeles.json)、advanced |
| A11 | 通过 | 目标动态读取同一 Entry；提交时冻结来源版本；后续编辑不改已提交/已审核来源 | advanced 的步骤来源提交→修改来源→审核→目标全文无新正文→重新打开链，relations、[步骤冻结数据库](evidence/entry-richtext/step-freeze.json) |
| A12 | 通过 | 服务端检查归档/回收/父实验/版本；冻结来源只按已有重新打开机制更新 | advanced 实际失效目标与锁定错误；用户 ACL 不适用（现有本机信任边界） |
| B01 | 通过 | 真实 Insert 3×4 菜单，视口内定位；支持默认表格与网格选择 | core、[其他视口](evidence/entry-richtext/viewports/report.json)、六页链 |
| B02 | 通过 | 中文/数字/单位输入，Tab 切单元格，增行增列，撤销重做 | viewports、[六页](evidence/entry-richtext/pages/report.json) |
| B03 | 通过 | 六类正文保存、离开、刷新、重新编辑、只读、PDF；8×12 宽表不撑整页 | pages、[长文混合](evidence/entry-richtext/mixed/report.json) |
| B04 | 通过 | 万字长文中部/底部各十次 H2，保留原段落及视口 | [focus](evidence/entry-richtext/focus/report.json) / trace.zip |
| B05 | 通过 | H2↔Body↔Undo↔Redo，各位置十次；块 ID 回归 | focus、scientific/protocol split-ID 单元测试 |
| B06 | 通过 | 自动草稿保存、H2 操作与延迟图片读取/上传完成组合，段落位置、选区、继续输入和保存回读保持 | [慢媒体](evidence/entry-richtext/media-loading/report.json)、focus；不冒称初次本地预览解码性能或真实输入法 |
| B07 | 待测 | 浏览器直接中文字符输入及组合事件保护回归不等于输入法候选确认 | 真机拼音候选、回车确认、中英混输未执行 |
| B08 | 通过 | Entry Markdown、ScientificDocument、Protocol 三种实现实际 Enter/Shift+Enter/Backspace 合并/Delete/Undo/Redo、列表 Tab/Shift+Tab、保存回读；表格/图片边界另有专项 | [keyboard](evidence/entry-richtext/keyboard/report.json)、pages、drag；正常键入撤销按既有时间分组 |
| B09 | 通过 | 七个共用菜单桌面/手机 Enter、方向键、Home、Escape 与焦点恢复；实际字体/字号/加粗/斜体/下划线/对齐/行距/颜色/链接保存回读；保存时浮层 inert | [格式菜单](evidence/entry-richtext/toolbar/report.json)、[pending](evidence/entry-richtext/pending-save/report.json)；菜单全套在 Entry 实测，三种编辑器完整键盘链另见 keyboard |
| B10 | 待测 | 已读取原记录逐个原件和全部关联；4 当前 + 3 历史；无文件删除 | 下方匿名 A1–A7 表；三个 download 的原导入手势日志缺失 |
| B11 | 通过 | 四图实际上传/保存/刷新/回读仍四个有效原件 | core、[四图](evidence/entry-richtext/four-images-readback.png) |
| B12 | 通过 | 四图 + PDF + 纯 URL + 同图两位置 = 五个原件 | mixed |
| B13 | 通过 | 原生内部拖动同节点，零附件 POST，旧位置消失 | [drag](evidence/entry-richtext/drag/report.json) / trace.zip |
| B14 | 通过 | 一次拖动一次 Undo/Redo；手机等价移动十次 | drag |
| B15 | 通过 | 原位、落到非编辑区域、Escape 取消，身份/数量保持，无新上传 | drag |
| B16 | 通过 | 批量文件选择、截图粘贴、外部 File 拖入事件、一次 HTML+File 单路径上传，各原件只登记一次 | [外部导入](evidence/entry-richtext/external-import/report.json)、core、pages；系统拖入用浏览器 DragEvent 模拟，未冒称实体 OS 鼠标操作 |
| B17 | 通过 | 两图一次失败→真实重试→成功项不重传；两条记录草稿各自恢复图片 | advanced、[切换](evidence/entry-richtext/draft-switch/report.json) |
| B18 | 待测 | 390px 上下移、Undo/Redo 十次已通过 | 真机触摸、软键盘显示/收起遮挡未执行 |
| B19 | 通过 | 六类 60% 尺寸保存回读；宽图延迟加载与上传完成时段落位置实测 | pages、media-loading；共用可选像素尺寸，旧图稳定默认框不写历史 |
| B20 | 通过 | 删除本处两次引用，其他 Entry 仍有一处原件且原图请求 200 | mixed |
| B21 | 通过 | download 和无名 File 实际导入保存；两份同字节原件 ID 不同，分别回读/原图请求 200；不按名称删除 | external-import；原历史导入手势缺失另记 B10，未据名字推断 |
| C01 | 待测 | 网页式 HTML 表格/列表、PNG、既有附件复制及 TSV 纯文本保留行序/单位通过 | mixed；原生 Word/Excel 剪贴板未执行；TSV 已作为纯文本可靠降级，不宣称全格式无损 |
| C02 | 通过 | 六类正文各桌面/手机完整编辑、离开、回读；归入实际目标可立即导航 | pages、advanced |
| C03 | 通过 | 稳定请求身份、服务器版本条件；慢返回期间正文/门户浮层不可改；晚请求不重覆盖 | pending、relations、entry-save-identity/draft-store 单元测试 |
| C04 | 通过 | A/B 各输入未保存正文、上传不同图片→离开→恢复草稿→分别保存→回读 | draft-switch（节点 ID 与附件 ID 分别核对） |
| C05 | 通过 | 旧页面打开→另一请求更新→旧页面实际保存报冲突，旧草稿保留；Protocol 版本指纹 | core、relations、document/protocol-save-version 单元测试 |
| C06 | 待测 | 合成旧时间、旧精度、旧草稿兼容测试及原故障记录只读通过 | S5 为合成记录；授权原故障记录未执行编辑保存，更多脱敏历史格式样本未提供 |
| C07 | 通过 | 六类只读/打印图像及文字、实验同源显示；Protocol DOCX/JSON、报告 Markdown 实际菜单下载逐文件检查 | pages、[导出](evidence/entry-richtext/exports/report.json)、core；实体打印机未执行 |
| C08 | 待测 | 123 真路由 × 两视口基础审计全部有结果/截图；六类正文完整链 | [入口清单](entry-richtext-input-audit.md) 另补项目/库存/序列/集合普通字段保存回读；隐藏对话框、采购/工作流编辑和 iframe 内部输入未完整持久化 |
| C09 | 待测 | 五视口、桌面/手机共享表格和正文页面无整页横向溢出；PDF 实际渲染检查 | 真实 125% 缩放未执行，不能将此项完全关闭 |
| C10 | 待测 | 鼠标、菜单 Escape、键盘正文与手机等价图片操作已执行 | 真机触摸、软键盘、iOS/Android 未执行 |
| C11 | 通过 | ~万字、12图、8×12表格保存回读；中部/底部20次格式；20次输入反馈测量 | mixed、focus、[反馈](evidence/entry-richtext/feedback/report.json)；性能仅适用于注明设备与负载 |
| C12 | 通过 | 原件/关系只读诊断清单；显示投影无需历史写入；可重复投影回归；部署前数据库备份与原件清单 | 下方处理与回滚；未对任何真实历史关联执行自动重分类 |

## 原七附件匿名核对

原数据只读；下表代号映射保存在私有诊断中，不公开真实 ID/文件名/正文。

| 代号 | 原件/派生 | 当前正文位置数 | 关联类型 | 当前有效 | 来源结论 |
|---|---|---:|---|---|---|
| A1 | 原件 | 1 | entry_content + embedded_document_media | 是 | 当前图片；旧导入手势不由文件名推定 |
| A2 | 原件 | 0 | entry_content + document_media_history | 否 | 历史图片被旧路径加到独立附件；保留历史文件 |
| A3 | 原件 | 0 | entry_content + document_media_history | 否 | 同上；不同 ID 不因同 hash 合并 |
| A4 | 原件（名为 download） | 0 | document_media_history | 否 | 历史原件；具体粘贴/拖放/上传手势无证据 |
| A5 | 原件 | 1 | embedded_document_media | 是 | 当前图片 |
| A6 | 原件（名为 download） | 1 | embedded_document_media | 是 | 当前图片；不是仅凭名字认定的垃圾文件 |
| A7 | 原件（名为 download） | 1 | embedded_document_media | 是 | 当前图片；仍保留自己的原件 ID |

七个原件、十条关联、四个当前原件、三个历史原件。没有派生原件计入当前数；没有删除、按 hash 去重或改写历史创建时间。

处理策略：优先更正有效附件显示投影，历史关联和文件不写入。`scripts/diagnose-entry-attachments.ts` 为只读诊断，输出历史关联重分类的可选建议和反向关联恢复说明，但不执行它。此记录有两条可选的 entry_content→history 建议；当前显示修复不依赖执行建议。

回滚：可回退应用代码恢复旧显示而不动文件；新增 classification/precision 列保留，不以删除列方式丢弃新偏好。主关系迁移回填保留 original createdAt，事务锁与唯一索引防止两个主关系。必须回退数据库时使用部署前私有备份，停写后恢复并核对原件清单；本轮未演练覆盖真实数据库的恢复操作。

## 性能与失败记录

[feedback/report.json](evidence/entry-richtext/feedback/report.json) 记录实际 beforeinput→DOM 变化→下一动画帧，以及真实标题菜单点击→下一帧；包含设备、浏览器、样本和 p50/p95。该合成长文测量不包括真实输入法候选、网络持久化或图片解码；focus 的 visibleFormatMs 另含菜单/自动化开销。两者不能混作同一性能指标。

调试中曾发现并修复：旧版本慢保存侧栏未 inert；移动后首次点击保存因图注/工具条高度变化未命中；生成文件导出未触发下载；已提交实验的步骤汇总泄漏来源新版本；慢宽图加载把下方段落移动约 377 px；小图片控制条覆盖下一图片。对应红日志保存在私有验收目录，最终公开 JSON 对应重跑后的实际结果；[新增失败→修复日志](evidence/entry-richtext/logs/) 可核对步骤冻结和媒体尺寸的回归。测试脚本曾将图片节点 ID 与附件 ID 混淆、将图片页当空白页、忽略 PDF 自动断词、检查一条短暂状态文案；另外修正了多图网络失败时重试按钮未限定到目标图注、已选中图片仍试图点击被自身工具条覆盖的像素。这些是测试修正，未把它们包装成应用修复。

## 可直接操作的真机待测步骤

1. 手机与电脑同网络打开正式 `/entries/new`；拼音输入两段中文，中英混输，以回车确认候选，停留等草稿保存后继续输入，确认无提前提交/重复/丢字。
2. 手机选相册四图，改变图注与尺寸，上下移动一图并撤销/重做；开/关软键盘，横竖屏切换，确认保存和返回控件可见。
3. 保存→离开→刷新→重新编辑→只读；打开“归入…”选择一个测试实验或其结果，再取消归入；原文、四图和首次记录时间保持。
4. 电脑浏览器菜单设置真实 125%，重复表格、H2、图片设置、保存流程；从 Word/Excel 粘贴含表头/合并单元格/图片的测试内容，观察支持结构和明确降级。
5. 用真实打印机打印一份包含图注、图片和表格的测试文档；不得以浏览器 PDF 替代实体打印机结果。

影响：这些待测项影响输入法、键盘遮挡、实际触摸、缩放和外部剪贴板的最终体验验收，不能自动记为通过；不阻止已经获得独立证据的数据保护和同源归入修复交付。未执行的自动化扩展项已逐行写明，不能用本轮测试总数替代。

## 主要修改位置

- [当前原件计数](../../src/lib/entry-content.ts)、[内部移动/上传分流](../../src/components/DocumentMediaUploads.tsx)、[图片移动与简洁设置](../../src/components/DocumentMediaNode.tsx)。
- [共享格式菜单](../../src/components/DocumentWysiwygToolbar.tsx)、[本地回声](../../src/components/MarkdownRichTextEditor.tsx)、[门户保存保护](../../src/components/usePortalFormPending.ts)、[属性栏](../../src/components/ContextProperties.tsx)。
- [创建/保存身份](../../src/lib/entry-save-identity.ts)、[归入事务](../../src/lib/entry-assignment.server.ts)、[同源与冻结历史](../../src/lib/entry-assignment.server.ts)、[归入对话框](../../src/components/EntryAssignmentControl.tsx)、[同源展示](../../src/components/EntrySourceCards.tsx)。
- [草稿保存](../../src/lib/entry-draft-store.ts)、[旧版本保护](../../src/lib/document-save-version.ts)、[Protocol 版本保护](../../src/lib/protocol-save-version.ts)、[生命周期边界](../../src/lib/entry-lifecycle.ts)。
- [原生文件导出](../../src/components/ProtocolExportMenu.tsx)、[JSON 下载](../../src/app/api/protocols/[id]/versions/[versionId]/json/route.ts)、[Markdown 图注](../../src/app/api/reports/[id]/markdown/route.ts)。
- [完整浏览器验收 CI](../../.github/workflows/entry-richtext.yml)，沿用 Calculator 与 Document editor CI。
