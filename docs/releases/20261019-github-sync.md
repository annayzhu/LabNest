# 3001 version review and GitHub synchronization

Review date: 2026-10-19 (America/Los_Angeles).

## Version and scope

- GitHub baseline: `09f226d6ce044a03123ab73520bd10873f681e93`.
- Running application: `4fa202b516fbf7840cb0ddda41e5c00ed475dedf`, image `labnest-app:all-4fa202b5`.
- The 27 local commits add Protocol step blocks, parameter chips and system selection; preparation and execution views; method search/design and source recognition; revised editors and AI entry points; English UI text; calculator changes; portable tools and CNV analysis; report/preparation exports; and native iPhone/Watch companion sources.
- This review does not redeploy the service or change production records, attachments, AI settings or database migrations. Existing untracked reports and screenshots are excluded from this synchronization.

## Verification performed in this review

| Check | Result |
| --- | --- |
| Current unit tests (`npm test`) | 162 files, 1,324 tests passed |
| TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | 0 errors, 12 warnings |
| Running image revision and health | Revision above; healthy; database reachable |
| Source/runtime SHA-256 comparison | 1,268 tracked files under src, prisma, public, scripts and package/config files compared; four generated-file differences investigated below |
| HTTP smoke checks | Health plus nine routes returned 200 without an application-error page |
| Actual browser inspection | New Protocol editor rendered; writing help expanded; method-design form and explicit external-search controls rendered |
| Native pairing parser | Normalization/origin stripping and 12 invalid-link checks passed |
| iPhone + embedded Watch compilation | Generic iOS Simulator Debug build succeeded with signing disabled; no device installation |

HTTP routes: `/api/health`, `/protocols/new`, `/protocols/design`, `/protocols/import/recognize`, `/experiments/new`, `/entries/new`, `/results/new`, `/tools`, `/tools/calculator`, `/tools/cnv-analysis/index.html`.

The initial native build could not access CoreSimulator under the restricted shell. Repeating the same unsigned build with simulator-service access succeeded. Build success does not demonstrate WatchConnectivity, Keychain behavior or physical-device operation.

## Generated-file correction

The checked-in `public/tools/free-plate-layout/calculator-engine.js` was stale relative to its current TypeScript inputs. The deployed image had already rebuilt it. Running `node scripts/build-calculator-standalone.mjs` regenerated the checked-in artifact; byte comparison with the running container passed. This synchronizes quantity formatting and theme output without changing domain source or the deployed behavior.

The remaining runtime differences are `normalization.png` in the main and plate icon directories and the corresponding byte counts in `v1.3-manifest.json`. These files are produced by `scripts/build-calculator-icons.mjs` during the image build. The manifest's source hash and dimensions agree; its derived PNG size differs (2,409 versus 2,538 bytes). The platform-generated icon outputs were not copied back into source.

## Findings and verification limits

- The English new-Protocol screen still includes Chinese document tabs, placeholder text and default table labels. This review records that visible localization gap; it does not claim complete English coverage.
- The existing batch diff contains six extra-blank-line-at-EOF notices. No unrelated formatting cleanup was performed.
- The native project currently tracks two Xcode user-state files and a development-team setting. These are portability/housekeeping follow-ups; signing credentials and provisioning profiles were not added by this review.
- This is a source/runtime reconciliation and focused regression review, not an exhaustive line-by-line audit of all 414 changed files. This turn did not repeat all historical editor save/readback, media movement, Word/PDF rendering, offline synchronization or multi-device acceptance workflows. Earlier batch reports are historical evidence only.
- Source-number matching and passing synthetic recognition tests do not validate scientific parameter attribution or real-provider output. No paid or external model request was made.
- Physical iPhone/iPad/Watch input, camera, lockscreen notifications and real-device pairing remain outside this verification. The existing native compiler headermap warnings remain.
- GitHub CI and merge status must be read from the associated pull request; local tests and an upload do not prove remote CI or a merge to main.

Review guidance: project `AGENTS.md` and `labnest-editor-qa`. Local command logs and the UI screenshot were retained under `/tmp/labnest-20261019-*`; screenshots of production content were not added to the public repository.

## PR #103 CI repair verification (2026-10-19)

Candidate: the CI-repair commit on `codex/review-3001-20261019`, based on `f1864d53b70d23e75f2da13440f3101da7e9eff3`. The exact pushed revision and remote results are recorded by [PR #103](https://github.com/annayzhu/LabNest/pull/103). This section supersedes the earlier review's test coverage only for the checks listed here.

- Updated browser checks to exercise the current slash menu, contextual image/table controls, two-stage system confirmation/calculation, explicit legacy-version conversion, current icons, and English/Chinese labels. Assertions still check saved values, stable IDs, original asset references, and actual exports, including their Protocol code and version.
- Fixed print-time editor render recursion, missing template instructions in printed output, save-time interaction through editor portals, nested emphasis in saved Entry links, and narrow calculator task controls.
- Restricted the Protocol editor root to sections that the serializer stores. A real upload-failure/retry test reproduced an image outside a section disappearing on save; after the fix, retry, deletion/undo, save and refresh retain all five image references. A schema regression test prevents root-level paragraphs.
- Unit tests: 163 files / 1,326 tests passed. Production build and its TypeScript check passed. ESLint has no errors; existing warnings remain.
- Local isolated synthetic acceptance passed for AI adapters/cancellation/migration/review/drafts, Entry editing and saving, six document entry points, template images and both PDF views, calculator modes and all-tool responsive UI, and offline replay/timer calibration/stable-step identity with database readback. The final Protocol browser run also passed all nine groups: preview, system confirmation and calculation, responsive drafts, save reconciliation, stale tabs, timer lifecycle, continuation, JSON/Markdown/CSV/XLSX/DOCX/PDF exports and light/dark layout.
- No production database or attachments were used. Local application ports were 3338, 3332, 3331, 3227 and 3221; synthetic PostgreSQL used port 5543. Port 3001 was not redeployed. No real-provider calls or physical-device acceptance was performed.
- Current synthetic screenshots, traces and PDF files are archived locally under `/tmp/pr103-ci-evidence.tar.gz`; local command logs are `/tmp/pr103-*.log`. Historical checked-in evidence remains historical. GitHub uploads fresh evidence for each new CI run.

Local success is not a claim of GitHub CI success or merge. Merge is conditional on all checks completing successfully on the exact PR head.

### Calculator first-edit persistence

A later remote run exposed an intermittent first-render race: loading an example before the initial storage read/visit write finished could lose the first draft or trigger the existing concurrent-change protection. Slow-render reproduction observed 14 missing drafts in 20 attempts. `CalculatorWorkspace.tsx` now keeps the workbench inert until initialization completes; storage conflict checks remain unchanged. `verify-calculator-transfection.mjs` adds four fresh slow-render sessions that must persist and restore the first nested draft. After the fix, all 20 slow-load attempts saved a draft without a false conflict; the four-session regression, full transfection flow, storage-failure protection, production build and all 1,326 unit tests passed. CI must pass again on that exact revision.

The embedded calculator now sends its ready message only after that initialization has completed. The prior signal was observed while `aria-busy=true` and the form was inert, causing WebKit plate integration failures. The new DOM-observed readiness assertion failed on the old build and passes on the fix; the complete Chromium/WebKit suite (four embedded tools plus desktop/mobile plan save, reopen, backup, export, offline and stale-plan checks) passed with zero failures. Evidence: `/tmp/pr103-plate-ready-before` and `/tmp/pr103-plate-ready-after`. Production build and all 1,326 unit tests passed again.

The legacy plate adapter acceptance also waits for the workbench to finish initialization before filling fields. Delayed-render reproduction confirmed the old test attempted input while `aria-busy=true` and lost a value; the corrected test retains the selected 12 wells, converts 0.5 mL to 500 µL, and sends the expected 6.6 mL batch result. This changes test synchronization only.
