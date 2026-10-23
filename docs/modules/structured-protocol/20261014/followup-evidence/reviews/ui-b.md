# LabNest PR97 follow-up — independent assessment B

Date: 2026-10-14. Assessment B (detector + browser evidence), performed independently without reading Assessment A or older critique reports. Mode: Operate. Code baseline in supplied browser report: `15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a`, dirty follow-up implementation; not a committed release receipt.

## Scope and method

- Read FOLLOWUP.md and relevant REQUIREMENTS.md sections; read Impeccable 4.1.1 SKILL and critique guidance. Parent session already ran context setup; no duplicate context run.
- Viewed supplied actual screenshots: `groups-light-1440.png`, `groups-light-390.png`, `groups-dark-244.png`, `ai-entrances.png`, `import-template-desktop.png`, `authoring-entrances.png` in `docs/modules/structured-protocol/20261014/followup-evidence/`.
- Created a separate hidden in-app browser tab and inspected only isolated `http://localhost:3338`. Opened synthetic experiment `cmv7uh1or0016cgos7zmetttu/run`, `/ai`, `/protocols/import`. Read DOM geometry at default 1280×720, 390×844, and 244×844. No database writes, setting changes, real API calls, completion clicks, or production port 3001 interaction.
- 244 CSS pixels is a narrow viewport approximation of 390/1.6, **not real 160% browser zoom**. No physical phone, iPad, Apple Watch, IME, keyboard, camera, lock-screen, VoiceOver or notification test performed.

## Deterministic detector

Command: `node /Users/annayzhu/.agents/skills/impeccable/scripts/detect.mjs --json src/components/RunSystemPreparation.tsx src/components/RunGroupPreparation.tsx src/components/ProtocolSystemsEditor.tsx src/components/ProtocolImportForm.tsx src/components/AISettingsPanel.tsx src/components/ProtocolDocumentEditor.tsx`

Exit 0. JSON `[]`: 0 findings, no rule names or file locations. This is not proof of usable responsive behavior: the concrete issues below were found by browser/manual review.

## Priority findings

### P1 — Confirmed preparation forms bury the actual experiment operation

Evidence: both groups are already marked 已确认. At 1280×720, the preparation section is **1913.3 px tall**, begins at y266, and Execution record is at **y2637**. At 390 width it is **2157.6 px tall**, and at 244 width **2837 px**. The supplied full-page mobile screenshot likewise places the first actionable step after both entire parameter tables, calculator receipts, batch checkboxes and repeated confirm buttons.

Location: `src/components/RunSystemPreparation.tsx:28-49` and `:54` render every VersionSelection expanded on every visit. All quantities and provenance are important, but they need not occupy the top of every already-prepared Run.

Impact: a technician returning to a confirmed experiment must scroll several screens before they can see the current step or timer. This undermines the user's stated requirement that AI/system entrances become more obvious while keeping mobile execution practical. It also scales poorly beyond two groups.

Recommendation: keep the experiment/group/system summary immediately visible; automatically show preparation when unconfirmed or erroneous, but collapse confirmed selections into an explicit “查看／修改本次体系” section. Preserve a visible edit path and all provenance in the expanded section. Add a direct “继续执行” anchor when preparation is long.

### P2 — New system preset buttons are only 32 px tall on mobile

Evidence: real 390 viewport gives each `350 µL · 普通样本` and `600 µL · 高脂样本` button 115.7×32 px. Current step Calculator and Timer correctly measure 44 px tall, so the newly emphasized selection controls are smaller than the execution controls.

Location: `src/components/RunSystemPreparation.tsx:34` uses Button size sm; `src/components/ui/Button.tsx:19` supplies its 32 px control token.

Impact: recurring, consequential system selection is unnecessarily difficult with one thumb, particularly in the lab. No physical touch mis-tap claimed.

Recommendation: apply min-height 44 px to system preset actions on touch/mobile widths, preserve compact desktop styling if desired.

### P2 — English narrow-view action labels overflow or clip despite no whole-page overflow

Evidence: at width244 the Calculator button has clientWidth50 but scrollWidth65, overflow visible; the main “Confirm step completion” button has clientWidth169 but scrollWidth179, white-space nowrap and overflow hidden. Thus document scrollWidth229 <= viewport244 is not sufficient acceptance: a label still escapes its button and the primary completion label clips. Chinese supplied screenshots wrap compact labels; the live browser used the existing English preference.

Location: `src/components/ProtocolRunProgressForm.tsx:220` fixed three-column tool row and `:261` primaryButton class without wrapping override. Shared button styling includes whitespace-nowrap. Inspect the nested calculator control as well.

Impact: at increased scale/narrow windows a researcher cannot read the complete action, especially when choosing whether a click completes a step. This is a language-responsive layout issue, not a calculation error.

Recommendation: permit primary action text to wrap with adequate vertical padding; make tool rows two/one-column at the smallest effective width or allow safe word wrapping. Assert individual visible control scrollWidth/clientWidth, not only document width.

### P2 — AI destination is labeled both “手动工作台” and “打开 AI 工作台”

Evidence: `/ai` page header link is 手动工作台, while the new prominent use section calls the same `/actions/manual` destination 打开 AI 工作台. Both are visible in `ai-entrances.png`; DOM confirms identical destination.

Location: `src/app/ai/page.tsx:26`, `src/components/AISettingsPanel.tsx:66`.

Impact: the user explicitly could not find where an enabled model takes effect. Two different names for the same destination preserve unnecessary uncertainty about whether one is an AI action and the other excludes AI.

Recommendation: choose one user-facing destination name, e.g. AI 工作台, and describe manual copy/paste inside that page if needed.

## Strengths and validated bounds

- New AI section gives four concrete destinations. At 390 these links are 44 px high and wrap without document overflow. State messaging correctly says model/default must be configured; no automatic historical-record processing is promised.
- Multi-system Word download is visually dominant and 44 px high, with ordinary/step templates as secondary choices. The supplied authoring screenshot exposes 实验体系与参数 and 步骤整理 directly above document body.
- A/B groups have explicit headings, separate 50/80 µL values and unchecked batch target checkboxes. Shared operation is identified separately and the displayed denominator is five; this review does not independently re-execute the writes or audit the calculation algorithm.
- Dark screenshot preserves readable text/group labels and visible light-on-dark primary buttons; status remains expressed in text, not only color. A numeric WCAG contrast audit was not performed, so this is a visual observation, not an AA conformance claim.
- 390 and 244 inspection did not find whole-document horizontal overflow on the inspected pages. The narrower button issue above demonstrates why that check alone is insufficient.

## Run notes / limitations

- Target slug: `src-components-runsystempreparation-tsx`.
- Ignore list: `.impeccable/critique/ignore.md` absent; no prior critique content read.
- Independence: separate sub-agent and new tab; no Assessment A output read.
- Browser visibility: hidden. Tab was closed and temporary viewport override reset.
- Overlay injection: **not executed**. Available CUA evaluate interface is explicitly read-only, and assignment is a read-only review; no mutable-script injection surface was available. No live detector overlay claimed. This is a documented manual-browser fallback.
- Live server: none started; existing isolated development server reused and left running for parent task.
- Temporary cleanup: no generated browser files; this report is the only requested /tmp output.
- Questions skipped: parent is implementing an already authorized scope and will synthesize the two independent critiques; no new product preference blocks the specific corrections above.
