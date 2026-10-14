# Assessment A — independent design review

Reviewer: /root/protocol_followup_ui_a. Reviewed 2026-10-14 on the uncommitted codex/protocol-followup-20261014 working tree. This is Assessment A only; no detector output or peer findings were read. No code or application data was changed. The parent must synthesize Assessment B separately.

## Scope and evidence

- Read FOLLOWUP.md, repository AGENTS.md, Impeccable SKILL.md and critique guidance, relevant components and existing Button tokens. Reused the parent session's already-loaded product context rather than rerunning context.mjs.
- Viewed groups-light/dark-1440, groups-light-390/244, authoring-entrances, ai-entrances, import-template-desktop screenshots.
- Opened a fresh hidden browser tab on isolated http://localhost:3338 and inspected the A/B synthetic Run at /experiments/cmv7uh1or0016cgos7zmetttu/run, plus /ai. Used 1280×720 and 390×844 viewports. The screenshots and viewport checks are simulated browser widths, not physical phone or 160% browser zoom tests.
- Browser tab closed and viewport override reset. No server was started for this review. No live overlay was attempted by Assessment A. No ignore.md exists.

## Design specificity verdict

This is a recognizable laboratory execution workspace, not a generic dashboard reskin. The retained restrained blue-gray shell, source-version context, per-group reagent amounts, separate actual-value entry and timer/completion semantics fit the product. The new authoring buttons and Word template entry resolve genuine discoverability problems. The main weakness is workflow hierarchy: an already-prepared Run continues to lead with two full editing forms, so making configuration visible has displaced the actual experiment task.

## Priority findings

### P1 — Already-confirmed preparation pushes the current step several screens down

Evidence: RunSystemPreparation.tsx:28–49 always renders the entire form, and line 54 renders every VersionSelection without collapsed adopted state. In the live 1280×720 viewport, the preparation section starts at y=266 and is 1913 px tall; Execution record begins at y=2637. Both groups are already confirmed. Each group form is 908 px tall. The 390 px screenshots similarly put the current-step card after several screens of unchanged settings.

Impact: a researcher returning to continue a timed or interrupted run must repeatedly scroll through configuration. This recreates the user's “entry is hidden” problem for the task they now need to execute, and scales badly toward the allowed 24 groups.

Fix: show a compact, always-visible group summary once the group's selection/calculation receipts are current, with explicit “查看／修改体系”. Auto-expand groups that are unconfirmed, invalid or changed; keep errors and unapplied changes visible. Place a visible “开始／继续当前步骤” anchor or action near the page heading. Do not hide unconfirmed blockers merely to shorten the page. Suggested command: Impeccable distill/layout.

### P2 — New Run touch controls remain smaller than the intended mobile target

Evidence: live 390×844 inspection measured preset buttons at 32 px high and “确认变更并保存” at 36 px. RunSystemPreparation.tsx:34 uses Button size=sm; line 44 uses the default md size. Existing Button.tsx tokens enforce fixed heights. These are actionable controls in the new preparation path; the batch checkbox labels correctly already use min-h-11.

Impact: the new controls are readable but less forgiving one-handed; narrow screenshots show enough available space to enlarge their hit targets without shrinking text.

Fix: at mobile widths use min-height 44 px for preset and confirmation controls, allow labels to wrap when necessary, retain desktop compact sizing. Do not globally enlarge every desktop toolbar. Suggested command: Impeccable adapt.

### P2 — Identical common reference text repeats per treatment group

Evidence: ProtocolRunProgressForm.tsx:190,201 groups reference content by the scoped treatment-version key. The screenshot and live DOM show two initially open sections, “规程说明与参考（不计步） · A组/B组”, each containing the identical “共同准备：核对标签和记录编号。”; the execution section separately has the actual single common operation.

Impact: this does not establish duplicate completion counting—the UI explicitly says “不计步”—but adds visual repetition and makes the sentence “共同准备只计一次” harder to interpret.

Fix: coalesce truly identical resolved common reference content from the same source version into one section labelled “适用于 A组、B组”, preserving separate sections whenever content differs. Alternatively keep each group association but default identical reference sections collapsed. Do not merge actual group-specific operations or infer common content from parse failure. Suggested command: Impeccable distill/clarify.

### P2 — Import template chooser has two competing concepts of “template”

Evidence: import-template-desktop.png presents a strong “下载多体系 Word 模板”, two adjacent Word links, then “选择结构化格式” with JSON/Markdown/DOCX cards, each with another “模板” action. None of the three cards is a format selection control.

Impact: a first-time user can reasonably think they must choose a format after downloading Word, or may choose the generic DOCX template and miss the multi-system example they came for.

Fix: keep the new multi-system download primary; relabel the lower section “其他导入格式与模板”, mark generic DOCX as ordinary/basic, and state that uploading detects the format automatically. This is small copy/IA refinement, not a new import system. Suggested command: Impeccable clarify.

### P3 — Same AI destination has two different visible names

Evidence: AI page header says “手动工作台” (src/app/ai/page.tsx:26), while the new “使用 AI” section says “打开 AI 工作台” (AISettingsPanel.tsx:66), both /actions/manual.

Fix: choose one user-facing name (for example “AI 工作台”) and explain manual copy/paste as an alternate method inside the workspace. Keep the server route stable. This is not a functional blocker.

## Strengths

1. The editor now has explicitly named “实验体系与参数 / 步骤整理 / 多体系模板” controls immediately before the document; this is materially more discoverable than an obscure lower-page panel. The default state is collapsed in source; the provided screenshot intentionally shows expanded panels.
2. Group choices and adopted values are labelled by A/B and source version; copied-to-other-group controls are opt-in, with a clear “仅勾选的组” legend. The parameter table displays units and source, while actual recording remains a distinct action.
3. AI setup states the next required step and makes the four useful destinations visible together. Import clearly says normal import does not require AI. Light and dark Run screenshots retain consistent surface hierarchy and readable labels; no clipped names or whole-page horizontal overflow was observed at the inspected mobile width.

## Heuristic scores (limited to reviewed surfaces)

| Heuristic | Score /4 | Basis |
|---|---:|---|
| Visibility of system status | 3 | Adopted timestamp, source and pending/error roles are explicit. |
| Match to real world | 3 | Groups, reagent units, actual values and common preparation are understandable; duplicate common-reference framing needs work. |
| User control and freedom | 3 | Existing back routes, reversible panel opening, explicit confirmation; read-only review did not exercise persisted undo. |
| Consistency and standards | 2 | Same AI destination has two names; template section wording implies a selection that is not present. |
| Error prevention | 3 | Batch targets explicit, actual values required, existing-history protection described; runtime failure paths not submitted in this review. |
| Recognition over recall | 3 | Newly visible authoring and AI entries; current Run execution is too far below adopted settings. |
| Flexibility and efficiency | 2 | Batch settings help, but confirmed forms dominate every return to Run. |
| Aesthetic/minimalist design | 2 | Coherent quiet shell, excessive expanded preparation/reference content. |
| Error recognition/recovery | 3 | Source shows role=alert/status and actionable continuation wording; actual error interactions were not run here. |
| Help/documentation | 3 | Contextual scope and template help are present, with some duplicated terms. |
| Total | 27/40 | Acceptable; fix the Run hierarchy before release. |

Scores are design judgments from limited read-only evidence, not a claim that all error/recovery or accessibility flows passed functional acceptance.

## Cognitive load

Fails 3/8 checklist items in an already-confirmed Run: single focus, visual hierarchy, progressive disclosure. The choice counts within each individual group are manageable; the problem is simultaneous repetition across groups, with presets, selectors, actual input, parameter table, calculator receipt, batch target and confirmation all visible before the current step. The import page offers 6 template actions in two different groupings. AI's four contextual destinations are appropriately bounded.

## Emotional journey and personas

- Jordan / first-time author: obvious system and template entries provide reassurance. A second format-template section can interrupt confidence about which file to start with.
- Casey / distracted mobile researcher: returning to a Run opens configuration first, rather than the next pending step; the current-step action is several screens away. Small preset controls add avoidable precision demands. Browser-width checks are not real-device touch verification.
- Alex / experienced operator: explicit batch application is useful, but repeating full confirmed forms for every group costs attention. A summary/edit model would preserve traceability and materially speed return visits.

The strongest emotional valley is the moment after setup: the researcher has confirmed both groups, yet the page still looks like setup rather than a ready-to-run experiment.

## Questions for parent synthesis

- Can “ready to execute” be visible in the first viewport after all groups are confirmed, while unconfirmed groups still expose every blocker?
- Can common references identify all applicable groups without duplicating the same content?

Questions skipped for the user: this is an authorized independent implementation review; the parent already has permission to make concrete fixes and is continuing development.
