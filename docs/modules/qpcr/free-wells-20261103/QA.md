# Acceptance evidence

## Verified

- Test-first: manual-only genes were missing from mix rows; manual-only samples were missing from template rows. Fixed by retaining all actual entries in the counted maps; calculation formulas are unchanged.
- Complete manual-only names are exempt from the automatic combination/replicate matrix. Incomplete assignments, known assay roles and required setup combinations retain their validation.
- Test-first: `ntc`/whitespace variants are normalized to the existing `NTC`; repeated temporary assay names retain one role. Review rechecked the template/replacement-water Excel behavior.
- Planner full suite: 113 unit tests, 6 rendered-HTML checks, and 4 portable-package checks passed. Shared LabNest suite: 240 files, 2,002 tests passed, 7 skipped.
- Planner TypeScript: the baseline and changed source have the same 12 existing diagnostics after normalizing shifted line numbers. No new diagnostic was introduced. The shared host check encounters a stale generated `.next/types` reference to the concurrently deleted qPCR route; the clean acceptance-image build succeeds.
- Real 3002 browser path: title SVG, importer inside the left Samples panel, file column selection/direct import, generate 384-well layout, edit empty P24 with new names, unchanged automatic input lists, copied mix, explicit save/reload, confirm and download Excel. The new well raises the example reaction count from 96 to 97 and actual plate sample count from 8 to 9; its mix/template volumes agree with the downloaded workbook.
- Excel `Well_Detail`, `Gene_Requirements`, and `Sample_cDNA` data are identical at 1,366- and 1,920-pixel window widths.
- Added a full 384-occupied-well display check at 1440×900 with synthetic samples.
- Screenshots inspected at 1366×768, 1440×900 and 1920×1080, with 834×1194 and 390×844 editor checks. No page-level horizontal overflow in those checks. Editor width is 420 px on desktop; full names wrap when needed. Minimum visible editor font: 12 px. Existing plate fit scales measured 39%, 52% and 70% at the three desktop sizes.

## Limits and remaining work

- Browser full-screen entry/exit was verified after waiting for its native state transition; the full 384-well state was also inspected.
- The full record-to-analysis/print workflow under concurrent Claude development was not re-tested or modified. Public output objects and Excel data were checked; no new end-to-end record printing claim is made.
- Main-plate layout, its default fit scales and unrelated page hints are retained. These checks do not claim a complete redesign of that workspace.
- Regenerating still asks before replacing manual edits; this implementation does not pin them across regeneration.

Runtime screenshots, numeric measurements, workbook downloads and source snapshots: `.local-runtime/qpcr-free-wells-20261103/`. Real-operation script: `scripts/verify-qpcr-free-wells.mjs`. Source package/patch hashes are in `public/tools/qpcr-plate-layout/release.json`. Changes remain uncommitted pending user acceptance.
