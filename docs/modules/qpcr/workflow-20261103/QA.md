# qPCR acceptance verification

Acceptance target: 3002 only. Production 3001 and remote main are outside this acceptance release. Database `labnest_qpcr_acceptance` and a separate attachment copy isolate this round from production.

## Observed checks

- Planner: 110 public-behavior unit tests passed. Portable packaging checks passed. At 1366×768 the complete current 96-well plate fits its viewport (446 px high, no vertical overflow). Ordinary wheel handler removed; explicit zoom retained.
- Analyzer: 96 unit tests passed. Five offline browser workflows passed (Cq edits/undo/apply, ΔCq, ΔΔCq, 45 samples, Tm-only).
- Host: new tests cover output insertion/retry/revision conflicts, independent paragraph merge, and preservation of custom sections. Main full suite initially found a LAN-HTTP UUID compatibility issue; fixed to use the existing mutation-ID helper. Final suite result recorded below after review.
- Public API synthetic check: revision1→revision2→replay revision1 preserves revision2; stale mutation rejected; custom manual text retained.
- New Result browser workflow: typed title/manual paragraph → 45-category ΔΔCq import → return → refresh → restore → insert all8 facets/45 rows → refresh → final save succeeds on a formal Result URL. Minimum measured visible chart text14.2 CSS px at desktop.
- Full saved print:11 A4 pages, final Sample-45 present in extracted PDF text. SVG resources and result table retained; no iframe dependency for saved printing.
- Independent design reviewer found two issues (export controls preceding chart; y-axis title/tick overlap). Both fixed and scored resolved. Final disposition `ship` applies to those two fixes.

## Known baseline constraint

Planner's repository-wide TypeScript command reports existing errors in generic narrowing, Cloudflare types and older tests. An archive of baseline8fd1ce7 reproduces the same error set. Planner's110 behavioral tests and portable build pass; this acceptance change does not claim the preexisting TypeScript debt was repaired.

## Reproduce

Use an isolated acceptance database. `scripts/seed-qpcr-acceptance.ts` refuses any database name other than `labnest_qpcr_acceptance` and writes synthetic IDs to `/private/tmp/qpcr-fixtures.json`.

1. Seed with `DATABASE_URL=... npx tsx scripts/seed-qpcr-acceptance.ts`.
2. Run `node scripts/verify-qpcr-workflow.mjs` to save a synthetic planner layout.
3. Run `node scripts/verify-qpcr-api.mjs` and `node scripts/verify-qpcr-draft.mjs` against3002.
4. Run `npm test` and `npm run typecheck` in LabNest. Apply source/*.patch to each documented tool baseline for tool checks.

Source patches contain the tool commits. `public/tools/*/release.json` records source revision, lock hash and exact embedded/offline artifact hashes. No numerical algorithms or significance tests were introduced; identity handling and presentation were extended. Offline package-to-record import remains P1.

## Final regression and review

LabNest:234 test files passed;1,971 tests passed,7 skipped. Typecheck passed. Analyzer:96 unit tests and all5 offline browser workflows passed; typecheck passed. Planner:110 tests and portable packaging passed.

Focused code reviews found2 standards-axis lifecycle issues and5 spec-axis issues (one overlapping). Fixed and reviewers marked all original findings resolved at source-review level. Browser regression additionally passed distinct new drafts, saved-plan cleanup, and preservation of unfinished edits across two output blocks. Analysis inputs now retain stable ID/name separation, applied-input revision and supplied-source provenance.

Design review report: both visual fixes resolved; scope-limited disposition ship. All reports refer to synthetic test data.

Plan metadata restoration was additionally verified through the visible metadata drawer: title, selected project and manual document survive refresh, then formal save clears the draft. Experiment drafts restore controlled title/date/status/method fields and protocol selection. Repeated form values are retained as arrays. Final host suite remains1,971 passed/7 skipped; typecheck passes.

## User acceptance corrections · 2026-11-03

Reproduced fixed qPCR actions and slash insertion returning to the wrong section. The slash browser check now passes. Reproduced TBP selection closing its own settings in the prior offline bundle; the new browser test verifies persistent settings, fit of 384 wells, zoom, mouse movement, P24 selection, preservation of a deselected chart and a 390 px layout without page overflow. Analysis: 96 unit tests and 6 browser flows passed. Package verification passed. Shared workspace tests encountered one unrelated in-progress plasmid reliability failure; release checks use committed source excluding that work.

The deployed nonempty-paragraph flow exposed a caret reset: a local editor update was re-imported as an external document. The editor now ignores its own emitted document while still accepting restored drafts and inserted outputs. The full 45-category / 8-facet draft restore and final-save flow passed on the correction. The isolated committed release passed all 234 test files (1,971 tests, 7 skipped) and TypeScript.
