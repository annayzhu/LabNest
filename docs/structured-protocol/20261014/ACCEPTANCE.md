# Structured Protocol acceptance — PR97 follow-up

This is the single49-item acceptance matrix for the original specification and its follow-up. Baseline `15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a`; candidate application source `6db0fd86` (full hash in `followup-evidence/validation.json`). Prior PR97 evidence remains history, not a substitute for the new checks. The user confirmed the three public test interfaces and that the old4-photo/7-file incident is resolved. All new test records are synthetic in an isolated database; no private original record was used.

| Item | Requirement | Result | Evidence / remaining work |
|---|---|---|---|
| A01 | 同一规程的两个体系使用一致的文字、形状和颜色，黑白显示仍可辨认。 | 通过 | ProtocolSystemLabels, shared theme tokens; all-system + selected browser preview and print legends use shape and text. Browser color-vision simulation is not physical color-vision testing. |
| A02 | 通用预览完整显示所有差异；仅切换预览不会修改实验选择。 | 通过 | browser-report: preview choices do not alter captured Run plan; all/selected projections. |
| A03 | 示例参数按350 µL／600 µL分别得到50／80 µL，不进行比例猜测。 | 通过 | structured-protocol.test.ts, DB and actual Run: 350→50 µL; 600→80 µL. No proportional inference. |
| A04 | 样本条件独立于体积体系；未填写时显示待确定，不误判为不适用。 | 通过 | Resolver unknown/negation tests and Run disabled-state browser verification; independent sample dimension. |
| A05 | 不合法组合、单值参数缺值／多重匹配、互斥分支冲突能被检出；独立条件允许同时适用。 | 通过 | Resolver tests: missing/ambiguous values, illegal combinations, exclusivity, cycles, unit mismatch. |
| A06 | 不适用内容默认收起且可查看；源文档未删除，执行按钮不可用。 | 通过 | Run browser: nonapplicable details collapsed and inspectable; source retained; no execution controls. |
| A07 | 条件参数、条件段落、条件步骤和表格行过滤分别正确，单位与表头不丢失。 | 通过 | Resolver and rich-cell tests; real table shows selected quantities, conditional rows and headers; source/display units saved separately. |
| A08 | 共同步骤仅出现一次；资料说明、普通checkbox和表格不会新增执行步骤。 | 通过 | Real empty-author workflow and creation: 4 explicit operations; ordinary shared checklist/table do not add steps. |
| B01 | 第一条依赖体系的操作前必须确认选择；不能用推荐项冒充用户选择。 | 通过 | Real experiment creation starts unconfirmed; dependent completion disabled until confirmation. |
| B02 | 步骤重排后，完成、照片、备注和计时器仍绑定正确步骤ID。 | 通过 | followup-evidence/offline-report.json + database-readback.json: synthetic legacy Run reordered through the real editor; stable IDs, timer, offline note, photo and completion remain attached to the selected original step after refresh/reconnect. |
| B03 | 模板修改不影响已创建实验；旧版本和本次采用参数可回溯。 | 通过 | DB unchanged protocolSnapshotJson after selections, real source edit/readback; legacy method receipt regression. |
| B04 | 步骤标题与正文不重复；跨步骤引用仍能找到正确来源。 | 通过 | followup browser case3: one owned step title; expanded captured reference exposes Proteinase K source. Shared reference is deduplicated across A/B groups; screenshot frozen-reference.png. |
| B05 | 已完成、跳过、不适用和待确定分开显示；必需步骤人工跳过后仍保留在分母，不误报100%完成。 | 通过 | structured-run tests and DB required skip with reason; completed=false after skip; count keeps required skipped steps. |
| B06 | 已执行受影响操作后改体系，按第7.2节处理；旧记录保留，新实例可见此前处理与继续位置，活动计时器不被静默覆盖。 | 通过 | DB rejects overwrite and implicit active timer cancellation; explicit cancellation audited and replay-safe; linked continuation UI shows old 50 µL and explicit remaining start. |
| B07 | 执行时记录实际值不会回写模板；不同实验的计时器和结果互不串用。 | 通过 | Isolated DB and browser actual value/notes/timer writes; parent snapshot fixed; separate experiment IDs. |
| B08 | P2多组采用不同体系时各自正确；批量应用只改变明确选中的组，共享步骤不重复计数或任取某组参数。 | 通过 | verify-structured-groups.ts + real Run browser: A/B resolve50/80 independently; explicit batch rolls back atomically on invalid destination; one shared preparation; actual value isolation, protected continuation and fresh group copy. |
| C01 | 在长文中修改H2、列表、粗体和参数后，光标与视野无异常跳转。 | 通过 | editor-report.json: representative long document, H2/list/bold/parameter edits and500-character continuous typing; caret remains in original paragraph and visible. Paragraph-height scrolling is distinguished from selection jumps. |
| C02 | 中文输入、标点、撤销重做、工具浮层开关及自动保存不丢字、不重复。 | 未执行 | Browser Chinese text and punctuation, undo/redo pass. Real pinyin composition/candidate confirmation and device autosave interaction unexecuted. |
| C03 | 表格菜单对齐；编辑、粘贴和保存回读后行列及内容正确。 | 通过 | editor-report.json: real HTML clipboard table paste3×2, add row/column4×3, inspector bounds, save/reopen cell content. Existing table merge/split serialization regressions retained; not an exhaustive editor-combination claim. |
| C04 | 同文档拖动图片只移动一次；明确复制产生新节点且资产关系正确。 | 通过 | media-report: native pointer drag, visible move, clipboard copy, unique node IDs, same asset IDs; delete undo/redo. |
| C05 | 4张照片的图片引用数和原始文件数正确；原“7文件”问题逐项查明。 | 通过 | 4 real synthetic uploads; 4 unique original IDs and references; duplicate callbacks return same IDs. User confirmed original incident already solved; original private record was not inspected. |
| C06 | 上传失败、重试、删除、撤销及恢复不制造重复文件或不可见占位。 | 通过 | media-report: first upload deliberately returns503; visible failure/retry; one successful asset; remove/undo/save/reopen images actually load. |
| C07 | 打开／关闭组件编辑面板不丢失选区；触屏不用悬停也能完成相同操作。 | 未执行 | Desktop close-panel preserves insertion point; physical touch selection/panel controls remain unexecuted. |
| C08 | 保存后重新打开、只读预览及复制后内容语义一致；未知旧节点可保留查看。 | 通过 | Author save/reopen and media copy preserve IDs/semantics; protocol-compatibility tests retain unknown nodes through read-only original data gate. |
| C09 | 每一个真实文本入口都已登记并按其能力配置检查，不能只测一个共享演示页。 | 通过 | EDITOR-INVENTORY.md + followup-evidence/editors: all six real body routes save/reopen/read/image/print; result-template instructions and desktop/mobile Run separately verified. Bounded plain-text metadata deliberately remains plain text. |
| C10 | 选取一份具有长正文、多个表格、图片及条件节点的代表性文档，记录长度与测试设备；连续输入和保存无明显卡顿，不能以空白短文代替性能验收。 | 通过 | editor-report.json records document bytes,71 background blocks, multiple tables and5 images, Chromium149, macOS Apple M4 Max. Continuous500 characters, input-frame p95/max, long tasks and save latency recorded. Physical-device performance remains unexecuted. |
| D01 | 参数保留数值、单位及来源；不把rpm直接当作×g、不擅自缩放时间。 | 通过 | Existing quantities conversion reused; unit tests, 50µL displayed0.05mL without changing source; rpm/g unsupported conversion rejected. |
| D02 | 计算器使用既有公式，保存输入和结果版本；修改输入后旧结果失效，依赖它的待执行操作须重新计算并确认才能继续。 | 通过 | Existing dilution engine; full adopted snapshot, input/binding signature; historic method9.99 retained; changed input becomes unknown until re-adopted. |
| D03 | 计时器编辑／预览不启动；刷新、暂停、恢复及重复点击不重建多个实例。 | 通过 | Browser start/refresh/pause/resume/finish and persisted facts; expanded timer survives server refresh; repeated Start server no-op. |
| D04 | 计时结束不自动完成步骤；时钟变化和返回前台后的状态经过验证。 | 通过 | offline-report.json: timer expiry never completes step; deliberate browser Date +1hour marks clock uncertain and disables control; foreground recalibration restores server-derived timing. Not a physical OS clock/lockscreen test. |
| D05 | Entry归入后保留原始记录时间和附件，归入时间独立保存。 | 通过 | verify-entry-followup.ts + entry-browser-report.json: original created/observed timestamps, separate filing timestamp and original attachment association retained through actual filing and readback. |
| D06 | P2确认结果固定来源Entry版本；后续修改不会悄悄改写已确认记录。 | 通过 | Entry result and experiment receipts: submit→edit source→review retains BEFORE content and actually loaded image; later source changes do not rewrite confirmed receipt; explicit reopen sees latest source. |
| D07 | AI关闭时，体系、参数、步骤、计时、计算和记录全部正常。 | 通过 | All new isolated fixtures and actual P1 browser operations use AI_ENABLED=false. |
| E01 | 桌面、iPad横竖屏／分屏、手机均能清楚看到当前组、体系与步骤；无整页横向溢出。 | 未执行 | Chromium desktop/1024/768/600/390/320 layouts and dark/light screenshots pass. Real iPad split-view remains unexecuted. |
| E02 | 真实iPhone／iPad的中文键盘、触控选择、拍照上传和面板定位通过测试；P1覆盖核心执行交互，P2覆盖其余迁移入口，桌面模拟不能替代。 | 未执行 | Physical iPhone/iPad keyboard, touch, camera and panel positioning not executed. |
| E03 | 网页后台、锁屏和重新打开后按时间恢复；不以后台回调准时运行作为前提。 | 未执行 | Browser reload and timestamp-based timer pass; physical lockscreen/background/reopen test not executed. |
| E04 | P2离线操作和照片分别显示本机／待同步状态，刷新后仍可恢复。 | 通过 | offline-report.json: explicit full Run cache, offline refresh, actual/completion/photo persisted locally; local/pending labels; reconnect and foreground retry; deliberate first503 withholds dependent actions, later sync succeeds. |
| E05 | P2重复提交不重复记录；两设备冲突不静默覆盖正文或完成状态。 | 通过 | verify-structured-groups.ts + offline-report/database-readback + entry-browser-report: duplicate mutation produces one event/file association; exact same-device predecessor receipt; other writer rejected; stale body retains both comparison drafts without silent overwrite. Simulated independent writers, not physical devices. |
| E06 | P2通知权限关闭、主屏幕安装差异、断网、取消旧计时器和多设备提醒经过能力验证。 | 未执行 | Implemented truthful web capability status and native local notification permission/scheduling/cancel logic keyed by experiment/step/revision. Web Push is not enabled. Physical home-screen/denied-permission/lockscreen/multi-device notification delivery and deduplication unexecuted. |
| E07 | P3手表操作同一实验实例；断连重连可恢复，关键参数不因短摘要被截掉。 | 未执行 | Native SwiftUI Apple Watch client and shared guarded server API implemented; unsigned SDK compilation and real server pairing/scope/revoke/completion tests pass. Later watchOS26.5 / Series11(46mm) simulator install, pairing from Run, full quantities, step list, explicit completion, timer start/pause, restart, offline queue/reconnect and single-event DB readback pass (watch-simulator/report.json). Physical Watch/iPhone installation and interaction remain unexecuted. |
| E08 | P3手表收到通知与在手表完成步骤分别验收，不混为已实现。 | 未执行 | Native notification scheduling and explicit completion are separate paths. Server completion/replay and actual native simulator completion tested. Actual notification arrival and completion on a physical watch remain two distinct unexecuted checks. |
| F01 | 转换有原文快照与映射；重复执行不制造重复节点、附件或实验。 | 通过 | Explicit Organizer confirmation, stable node IDs, version snapshot and idempotent creation/upload/continuation tests; no bulk migration. |
| F02 | 旧实验完成状态、备注、结果、原始时间未因新解析逻辑错位。 | 通过 | Synthetic legacy snapshots and compatibility regressions; no private historical production records changed or claimed audited. |
| F03 | 通用规程与执行记录的复制／已有导出内容正确，清楚标明体系及源版本。 | 通过 | Actual Protocol JSON/MD/XLSX/DOCX and experiment JSON/MD/CSV/XLSX plus print PDFs checked for source and quantities. Real Copy as new experiment retains two groups/frozen source and resets execution. Ordinary Protocol has no separate clipboard-copy command; no new export format claimed. |
| F04 | 新导出Word／PDF若纳入本阶段，已按相应skill渲染核查；未实现不写成完成。 | 通过 | followup-evidence/rendered/report.json lists each PDF/page/hash. Rendered DOCX, multi-system template, Protocol/experiment print PDFs and six editor routes plus template instruction PDFs visually inspected. CJK font configuration is required for local LibreOffice; native Word/physical printer unexecuted. |
| F05 | 两项专项skill已创建并验证、可被实施环境使用；真实使用记录和未具备能力说明齐全。 | 通过 | Two project skills created, validated and actually used; BASELINE.json and SKILLS-USAGE.md. |
| F06 | 关键条件逻辑、迁移和状态转换有必要自动化检查；跳转、拖动、软键盘和锁屏有实际交互证据。 | 未执行 | Meaningful logic/DB/drag/copy/navigation regressions pass. Physical keyboard and lockscreen interaction evidence not available. |
| F07 | 交付包含真实改动文件、迁移范围、版本、阶段验收及已知限制，未修改和未测试部分明确列出。 | 通过 | FOLLOWUP.md, RELEASE.md and this single49-item matrix identify source, scripts, UI/code reviews, final checks and physical limitations. No new database migration in this follow-up; original PR97 additive migration remains unchanged. |
| F08 | Matt Pocock、Impeccable、Ponytail 已在对应阶段实际加载并应用；记录来源、版本、使用任务、产物与验证证据，未运行或不适用部分明确说明；仅安装、阅读或列链接不算完成。 | 通过 | Prior SKILLS-USAGE.md plus FOLLOWUP.md and followup-evidence/reviews: Matt Pocock implementation/TDD/two-axis review, Impeccable independent visual critique and Ponytail applied. Review findings fixed and rechecked; no device validation inferred from reading or compilation. |

## Result boundary

**40通过 / 0当前失败 / 9未执行（复合要求中仍有真机环节）**. This is implementation and automated acceptance, not full physical mobile/watch acceptance. Each “未执行” row names verified subparts. No paid AI request was made; core workflows were exercised with AI disabled. Model credentials and preferences are preserved.

Final candidate checks, source hash, image identity, logs and browser reports are indexed in `followup-evidence/validation.json`. Remote CI and formal deployment are recorded separately in `RELEASE.md`; a passed build or merged PR is not treated as page acceptance.

## Reproduce

Use an isolated PostgreSQL database guarded by the scripts. Run the existing structured transaction/browser/author/media suites, then `verify-structured-groups.ts`, `verify-watch-execution.ts`, `verify-protocol-followup.mjs`, `verify-protocol-editor-followup.mjs`, `verify-protocol-offline.mjs`, `verify-protocol-followup-readback.ts`, `verify-entry-followup.ts/.mjs`. `protocol-consistency.yml` defines the same order. For route-specific media use `seed-editor-repair.ts` and `verify-editor-repair.mjs` with roundtrip/template/run phases. All fixture IDs are synthetic and intentionally saved for readback.

The old P1 matrix had28 passed/21 unexecuted; twelve automated gaps are now closed. Legacy intermediate failure logs/screenshots are retained under `followup-evidence/interim/` or prior Git history and are not final passing evidence. Review findings fixed include legacy source references, predecessor retry ordering, photo ownership, group-copy consistency and watch origin-bound credentials.

## Physical acceptance still required

1. iPhone/iPad: open a disposable experiment, select two groups and confirm350/600µL systems. Check full tables/images and controls in split view and up to160% zoom. Use pinyin candidate Return, mixed Chinese/English, selection and camera upload; save and reopen.
2. Add a note and actual value. Run→Calculator→tool→Run must preserve step/input. Start a2minute timer, switch app/lock screen, return; timeout must not complete the step.
3. On a trusted HTTPS/mobile-capable origin, explicitly download the experiment. Go offline, add an observation/photo and complete a permitted step, refresh, reconnect and check pending count clears and no duplicates. Desktop localhost offline tests do not establish iPhone LAN-HTTP capability.
4. Apple Watch: connect paired iPhone/Watch to Xcode, select your signing team and install `native/LabNestWatch`. Pair from Run, check full quantities and larger text, execute/refresh once, disconnect/reconnect. Separately test allowed/denied notification permission, a timer notification and cancellation. Web deployment does not install this app.

Xcode discovery found only the Mac, no attached iPhone/Watch. Unsigned native compilation is recorded, not substituted for installation or notifications. Native Word, physical printing and original private fault records were not tested.

## Data protection

No new schema migration or bulk historical rewrite. Existing executionPlanJson stores additive groups, adopted values, receipts and watch grants. Source version identity is distinct from treatment-group identity. Actuals never write back to the source. Copy keeps source/group topology with fresh step IDs and clears execution. Shared work is explicitly authored and compatible across selected groups. The deployment preservation report compares all existing database fields and attachment hashes.

## PR #103 verification refresh — 2026-10-19

The original matrix and evidence above describe their historical revisions. The current repair candidate is based on `f1864d53` on `codex/review-3001-20261019`; see [the CI repair record](../../releases/20261019-github-sync.md) for source changes, test coverage, exact-commit CI links and local logs. Fresh browser screenshots, traces and rendered PDF evidence are retained in `/tmp/pr103-ci-evidence.tar.gz`. Physical iPhone/iPad/Watch, hardware input/camera and real-provider checks remain unexecuted.
