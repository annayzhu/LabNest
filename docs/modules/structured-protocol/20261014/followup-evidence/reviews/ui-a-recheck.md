# Assessment A — bounded recheck

Reviewer: /root/protocol_followup_ui_a, 2026-10-14. Independent read-only follow-up to /tmp/labnest-followup-ui-a.md. No source code, database records, AI settings or experiment progress was changed.

## Target and method

Used the exact prior confirmed synthetic experiment from followup-evidence/browser-report.json, not the subsequently updated groups-fixture.json:

http://localhost:3338/experiments/cmv7uh1or0016cgos7zmetttu/run (EXP-080).

The in-app browser was unavailable at recheck time. Created a fresh Chrome tab named “🔎 LabNest UI复核”, inspected actual DOM and screenshots at 1280×720 and 390×844, opened and closed the A-group disclosure, clicked the current-step jump, then inspected /protocols/import and /ai. Restored the viewport and closed only the created tab. No review-only service was started. No detector or peer findings were read.

## Results against original findings

| Original finding | Recheck result | Actual evidence |
|---|---|---|
| P1: confirmed preparation overwhelms Run | Resolved for this confirmed A/B fixture | Both group disclosures initially closed and explicitly say “已确认 · 查看／修改体系”, retaining selected volume and sample type. At 1280×720 preparation height is now 250.64 px, previously 1913 px. Run execution form begins at y=687.78 instead of the earlier Execution record at y=2637. The anchors are different elements, so the comparable exact reduction is the preparation section height. |
| Missing direct current-step route | Passed | “开始／继续当前步骤” is visible near the preparation heading. Clicked it on desktop and mobile; URL becomes #run-execution and scroll moves to the execution area. At 390×844 the active “核对样本” heading was visible around y=243 and the current-step completion button was visibly on screen below. No completion was submitted. |
| P2: small mobile preset/confirmation targets | Resolved for inspected controls | At 390×844, opened A group's summary and measured both preset buttons and “确认变更并保存”: each 44 px high (previously 32/32/36 px). Summary disclosures and the jump link also have 44 px height. |
| P2: duplicate identical common reference | Resolved for this fixture | Exactly one [data-run-information] section, labelled “共同参考（不计步） · A组、B组”, containing the shared text once. The separate single common execution operation remains present. |
| P2: competing template section labels | Substantially resolved | Actual import page heading is now “其他导入格式与模板（上传时自动识别格式）”. The prominent multi-system Word download remains first. Generic DOCX still says simply “模板”; adding “普通规程” would be optional copy polish, not a release blocker. |
| P3: AI workspace has two names | Resolved | Header now “AI 工作台”, contextual link “打开 AI 工作台”; both are the same consistent destination /actions/manual. |

## Design judgment after fixes

The original release-significant hierarchy concern is closed for the reviewed confirmed A/B Run. Preparation remains discoverable and traceable without demanding repeated full-form review. The direct jump brings the actual current step into view on mobile. Coalescing identical references improves the meaning of shared preparation without conflating treatment-specific quantities.

No new P0/P1 UI blocker found in this bounded recheck. Keep the remaining routine copy polish out of the critical path.

## Limits

- These are real browser interactions at simulated viewport dimensions, not a physical phone, 160% browser zoom, touch, VoiceOver or watch test.
- This round checked light mode at 1280 and 390 px. Dark mode and 244 px were inspected in the first review, but not re-run after these fixes.
- No unconfirmed/error fixture was submitted: the source keeps unconfirmed groups expanded and errors/dirty edits open, but those exceptional states need functional browser acceptance by the parent. This recheck does not certify them merely from source.
- The jump targets the execution form, whose introductory status line may sit behind the sticky header; the current step itself was visibly reachable. This does not reopen the original P1. A scroll-margin token is optional finishing detail.
- Group-specific reference content was not changed to test the negative deduplication case here; the source key includes the source group and full resolved common content, while the parent's regression tests must verify differing references remain separate.

Questions skipped: implementation is already authorized; this is the final bounded confirmation pass for the original findings.
