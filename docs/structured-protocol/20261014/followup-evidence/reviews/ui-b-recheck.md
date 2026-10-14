# Independent UI assessment B — bounded confirmation pass

Date: 2026-10-14. Target: isolated `http://localhost:3338/experiments/cmv7uh1or0016cgos7zmetttu/run`, obtained from `docs/structured-protocol/20261014/followup-evidence/browser-report.json`; plus `/ai`.

I did not read Assessment A's first or second report. This is one focused confirmation pass of my four original issues, not a new open-ended polish cycle. No code edits, database writes, AI calls, timer starts or step completions were performed. In-app browser was unavailable on retry; browser inventory showed Chrome, so I created a separate Chrome tab. The language control was temporarily switched from Chinese to English solely to confirm the long-label fix, then restored to Chinese. Temporary viewport override was reset and the tab closed.

| Original issue | Result | Actual evidence |
| --- | --- | --- |
| P1 confirmed preparation obscured execution | **PASS** | Both groups now start collapsed, each retaining group name, 已确认, 查看／修改体系 and adopted volume/sample. At390×844 preparation height is **287.3 px**, down from previous **2157.6 px**. The `开始／继续当前步骤` link measures44 px high; clicking it navigates to `#run-execution` and shows the current step with tools. |
| P2 32px system preset actions | **PASS** | Expanded A group through its actual summary. Both350/600 µL preset buttons measure **44 px high**, labels remain full, and no selection/save was made. |
| P2 English narrow-view labels overflow/clipped | **PASS** | At244×844 tools resolve into **two columns** (81.5px each). After English switch and page refresh, Calculator/Timer/Record each has clientWidth80=scrollWidth80 and clientHeight42=scrollHeight42 (44px border box). Calculator visibly wraps as Calcul/ator without missing letters. Primary `Confirm step completion` wraps to two lines: clientWidth169=scrollWidth169; height52=scrollHeight52 (54px border box). Screenshot visually confirms all words. Chinese label also fits, with no extra horizontal scroll. Document width229 <= viewport244. |
| P2 inconsistent AI-workbench naming | **PASS** | `/ai` header now says **AI 工作台**, and the use section says **打开 AI 工作台**, both targeting `/actions/manual`. The previous contradictory “手动工作台” destination name is absent. |

390 and244 refer to CSS viewport sizes, not physical devices or actual browser zoom. The244px test is only the390/1.6 narrow-width approximation. Physical iPhone/iPad/Apple Watch, real160%zoom, soft keyboard, touch accuracy, VoiceOver, lock-screen and notification validation remain **NOT EXECUTED**.

No additional blocker found in this bounded pass. No new detector scan or overlay injection was needed: the previous detector had0 findings and these four issues required real geometry/visual checks. Original deterministic and read-only-overlay limitations still apply. Questions skipped: all four targeted fixes are confirmed and no preference decision is required.
