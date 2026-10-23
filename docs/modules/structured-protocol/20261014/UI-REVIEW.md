Method: dual-agent (A: /root/structured_ui_design_a · B: /root/structured_ui_evidence_b)

# Structured Protocol UI critique

Target: src/components/ProtocolSystemsEditor.tsx plus RunSystemPreparation and StructuredStepRecord. Original evaluation application e65e4e5f. Both agents independently opened their own browser tab and did not read one another’s results. A finished before B findings entered parent synthesis.

## Design specificity and impression

Product-specific: system choices, values with units and sources, explicit confirmation and immutable history suit laboratory work. The largest opportunity is distinguishing saved facts from local draft state and bringing the current operation ahead of already-confirmed preparation on phones. No visual redesign is needed.

## Design health — original assessment, not rescored after fixes

| # | 启发式 | 评分 | 依据 |
|---|---|---:|---|
| 1 | 系统状态可见性 | 3/4 | 体系确认时间、采用值、来源、完成/跳过/待确定均可见；实际值草稿与已保存标记没有分离，见 A1。 |
| 2 | 系统与现实世界匹配 | 3/4 | “裂解体积”“实际用量”“孵育时长”和单位符合实验语境；“维度”“互斥组”“作用内容”仍需要理解配置模型。 |
| 3 | 用户控制与自由 | 2/4 | 可展开/折叠、跳过可撤销、有原记录链接；体系编写删除或切换来源直接替换局部状态，未看到对应的局部撤销。 |
| 4 | 一致性与标准 | 3/4 | 外壳、页签、表单和用色保持一致；新增中文区域在 EN 界面仍为中文，时间有本地格式与原始 UTC 两套表达。 |
| 5 | 错误预防 | 3/4 | 明确人工确认、完成后的实际值禁用、危险变更转继续实例；未通过本次只读检查重新验证服务端保护。 |
| 6 | 识别而非回忆 | 2/4 | 参数来源与体系标签可直接识别；长目标选择器和无名称的历史实际量值要求额外记忆，见 A3/A4。 |
| 7 | 灵活性与效率 | 2/4 | 预设和 native select 缩短输入；确认后准备区持续占据长页面，长规程目标无检索/定位入口。 |
| 8 | 美观与简约 | 3/4 | 安静、对比清晰、无装饰性负担，表单移动重排正确；确认后的准备资料缺少收束，见 A2。 |
| 9 | 错误识别与恢复 | 3/4 | 源码有 alert/status、变更说明、继续位置和取消计时器说明；本次没有提交无效数据测试实际恢复路径。 |
| 10 | 帮助与文档 | 2/4 | 参数、条件、预设、继续位置均有就地短说明；缺少针对“依赖参数”和“互斥组”的具体示例及目标预览。 |
| **总计** | **全部 10 项适用** | **26/40** | **Acceptable；优先解决状态可信度与操作定位。** |


## Strengths

- Preparation stays outside operation counts; unknown, skipped and completed remain distinct.
- Units and source receipts accompany adopted values; scientific methods are reused.
- Continuation names the start and links original records, protecting scientific history.

## Priority findings and disposition

1. **P1 actual-value save trust**: an edited value could retain an old “saved” receipt. Independent follow-up also found revision remounts and in-flight reason edits could lose drafts. Fixed in33d4b679/42d6e321: explicit dirty state, stable per-step storage, server-acknowledged value reconciliation, conflict review and pending-input protection. New real-browser case covers50→55, other-step save, reload, blocked in-flight editing and preserved reason. Final production verification is recorded in ACCEPTANCE.md. Suggested skill: harden, then polish.
2. **P2 phone preparation density**: confirmed preparation measured1016px high at390px viewport; summary/progressive disclosure remains a follow-up. Suggested skill: distill/adapt.
3. **P2 authoring target recognition**: a long flat list and internal fallback labels make similar blocks difficult to distinguish. Group/search and meaningful labels remain a follow-up. Suggested skill: clarify/optimize.
4. **P2 history and accessible field context**: history values need captured field labels; accessible names should include units and requirement. Existing data are preserved; this presentation improvement remains open. Suggested skill: clarify/harden.
5. **P2/P3 consistency**: complete tab keyboard relationships, larger secondary mobile actions, EN fixed labels and12px minimum system text remain follow-ups. Suggested skill: harden/typeset, then polish.

## Cognitive load and emotional journey

Three setting tabs and four value-source types are reasonable chunks. Long flat target lists, a full preparation block above current operations and unnamed historic quantities increase recall and scrolling. Explicit confirmation and protected continuation establish trust; the draft/save ambiguity was the release-priority trust defect.

## Persona red flags

- First-time author: similar target labels demand cross-reference with the document.
- Interrupted phone user: excessive setup scrolling, and previously ambiguous saved state.
- Keyboard/screen-reader user: native fields help, but tabs and unit naming need fuller semantics; no physical assistive-technology pass is claimed.

## Deterministic and browser evidence

Assessment B scoped CLI scan returned0 findings, exit0, with file hashes/command/version in evidence/impeccable-detector-b-meta.json. No false positives to classify. This does not certify accessibility. Live390px page had no horizontal overflow; selected-label contrast7.08:1, presets7.38:1 and input text14.54:1 on the measured light view. Deep/dark full-page contrast was not measured.

## Questions for later design work

Can confirmed preparation become a one-line summary? Can conditions be set directly beside the target block? Can every observed quantity expose planned, saved and draft state without relying on memory?

Questions skipped: user authorized implementation and release; these P2 refinements remain an explicit backlog, not a new permission gate.

## Final run notes

Target slug `src-components-protocolsystemseditor-tsx`; no ignore file. A/B independent, CLI0 findings with recorded targets; browser visibility false, no overlay injected because the exposed evaluate surface is read-only. Actual screenshots/AX/DOM measurement used as fallback. No Impeccable live server started. Each review tab closed and viewport reset; shared3339 validation server will stop after formal release. Snapshot stored under `.impeccable/critique/`; trend first observation26/40, no post-fix rescore. Temporary snapshot body deleted. Final application42d6e321 production9 browser+2 authoring+3 media cases passed, including A1. A independently confirmed all three state risks closed. P2/P3 findings remain open.
