# Calculator v1.0 task: implementation and acceptance

## Scope and baseline

- User supplied specification: `spec-v1.0.md` (unchanged copy of the Downloads document).
- Inspected repository baseline: `27fa6f4` (not the document's historical `43cf9d1`).
- Working branch: `codex/calculator-refactor-v1`.
- Unrelated in-progress typography, global CSS, research-plan and translation edits are excluded from this change.
- No production deployment, PR merge, Issue closure, or historical-data deletion is part of this delivery.

## Phased implementation

| Phase | Delivered implementation | Evidence |
| --- | --- | --- |
| 1: foundations | Controlled quantities; full-precision math; strict scalar/count parsing; mode-dependent fields; six pinned tasks; six collapsed categories; aliases; independent recent visits; explicit drafts and examples; all old routes retained | `quantities.ts`, `task-definitions.ts`, `CalculatorWorkspace.tsx`, numeric and browser tests |
| 1: P0 corrections | Molarity validates known quantities only; transfection includes DNA stock volume; hydrogel/WB/freezing reject impossible compositions; no silent integer flooring; invalid input invalidates result immediately | `calculator-engine.ts`, `spec-acceptance.test.ts` |
| 1: compatibility | v1 bytes backed up before migration; damaged/unknown storage cannot be overwritten; favorites de-duplicated in order; ambiguous concentration units require confirmation; original historical snapshots not recomputed | `calculator-storage.ts`, `migration-acceptance.test.ts` |
| 2: reuse | Reagent resuspension; per-row batch normalization/WB; structured mixtures and recipes; PCR separate templates and independently prepared groups; concentration-driven components; optional two-tube transfection; CSV export | `planning.ts`, `StructuredInputs.tsx`, engine and browser tests |
| 2: gradients and equipment | Mixed versus retained volumes; backward planning; first tube from stock or prepared solution; linear/custom parallel dilutions; specified retained requirement; configurable equipment minimum; explicit dilution rounding with concentration deviation | `planning.ts`, `pipetting.ts`, independent worked examples |
| 3: integration | Step launcher, desktop dialog and mobile route; original-step return; existing Result/step-event/activity models; existing IndexedDB mutation queue; UUID replay handling; server recomputation and snapshot validation; read-only Result snapshots | `StepCalculator.tsx`, `/api/mobile/calculations`, `CalculationSnapshot.tsx`, integration fixture |
| 3: professional tools | Strict sequence/count/curve inputs; geometry-aware counting; container-area-aware passage; explicit molecular-weight estimate; titer types separated; descending 4PL, convergence/range information and curves; labeled approximate TCID50 retained | Current calculator catalog and regression tests |
| 3: offline | Explicit per-page caching with calculator-scoped worker; cached production page reload and draft restoration tested offline | `OfflineCalculator.tsx`, worker and browser report |

## Requirements cross-check

| Spec section | Current state | Scope / evidence |
| --- | --- | --- |
| 3.1 discovery | Implemented | Six defaults, stable user ordering with move buttons, recent list, collapsed categories, recipe/history entrances |
| 3.2 Today and step entry | Implemented; test evidence is bounded | Existing Today calculator entrance retained; six tasks are the next click; desktop dialog/mobile full page; explicit experiment/step IDs |
| 3.3 aliases | Implemented | Chinese/English/old names; antibody, folds, seeding, oligo, nucleic concentration, centrifuge and assay aliases |
| 4 old modules | All 31 registered | Mapping table below; aliases and old routes retained, not replaced with empty pages |
| 5 inputs/results | Implemented | String editing, explicit examples, conditional validation, immediate invalidation, operations generated from one result; advanced/method/history sections collapsed |
| 6 quantities | Implemented | Case-sensitive controlled dimensions; aliases; affine temperature; molecular-weight bridge; no automatic titer equivalence |
| 7.1 dilution | Implemented | Final-volume, add-to-existing, stock/target folds, 1:N and a:b, MW bridge |
| 7.2 gradient | Implemented | Geometric serial and linear/custom parallel; starting preparation; mixed/retained conservation; need/sufficiency columns |
| 7.3 weighing | Implemented | Molarity inverse solves, explicit mass purity, w/v, v/v, w/w; final-volume wording |
| 7.4 resuspension | Implemented | Amount→molar, mass→mass, mass+MW→molar; no invented solvent/storage recommendation |
| 7.5 recipes | Implemented within stated modes | Baseline scaling, stock/target concentration rows, final-volume or existing-base mode, auto final-volume instruction. Target-concentration rows require final-volume mode; conflicting definitions are rejected |
| 7.6 cells | Implemented with separate task paths | Standard/custom counting, viability calculation, direct viable-cell seeding, count-to-seeding transfer, 3D balance, passage-area option, whole-vial and leftover output |
| 7.7 reactions | Implemented | Actual sample/repeat/control count; fractional premix equivalents; independent templates; groups; two-tube volume accounting |
| 7.8 normalization | Implemented | Duplicate IDs, low stock concentration, insufficient available volume, blank invalid volumes and ordered export |
| 7.9 WB | Implemented | Single/batch; buffer and separate reducing agent balance; no double addition when buffer already contains reducing agent |
| 7.10 specialist tools | Implemented / method-limited | DNA/RNA length models explicitly estimated; Tm refuses ambiguous bases; OD empirical; functional MOI excludes VG equivalence; TCID50 explicitly approximate |
| 8 fits | Implemented / method-limited | Structured points and paste; repeats retained; finite inputs required; no silent zero-point removal; 4PL direction/convergence and graph; measured-sample range checked before dilution correction |
| 9 one contract | Implemented | Schema v2 result has mode, raw/normalized quantities, full outputs/table, method version, status, notes/warnings; same object copied, exported and saved |
| 10 persistence | Implemented | Distinct recent/draft/preset/history; debounced drafts with page-hide flush; immutable snapshots; recalculation is a new record |
| 11 record and queue | Implemented within existing access model | Context/lifecycle/origin/snapshot checks, durable queue, replay handling, Result and audit data. **No authenticated multi-user identity layer exists in the inspected application.** Operator is explicitly user-entered; multi-user authorization cannot be claimed |
| 12 legacy compatibility | Implemented with explicit ambiguity | v1 backup, no unit-size guessing, old factor conflict rejected, incomplete old snapshots labeled, route parameter whitelist; old results retained |
| 14 numeric checks | Automated | All NUM-01…33 represented by independent expectations; internal values retain precision; additional group/rounding/curve/bridge tests |
| 15 UX checks | Automated subset plus explicit limits | See JSON browser/integration evidence. Actual mobile OS keyboard/rotation and physical device trials are not equivalent to viewport emulation |
| 16 delivery | This directory | Specification, mapping, implementation notes, tests, screenshots and evidence |

## Complete old-ID mapping

| Old ID | Current destination / mode |
| --- | --- |
| hemocytometer | Cell counting; standard or custom geometry |
| seeding | Viable-cell seeding; explicit selected-well count |
| hydrogel | 3D seeding; suspension-fraction feasibility |
| split | Passage estimate; same/different container areas |
| freezing | Whole vials, leftover cells and validated recipe |
| transfection | Reaction preparation; combined/two-tube transfection |
| kill-curve | Screening concentration gradient |
| viability | Total cells plus viability; live/dead and resuspension |
| od600 | Empirical OD estimate |
| cfu | Colony concentration; explicit dilution fraction |
| colony-counter | Image-assisted count and manual confirmation |
| reagent-dosing | Dilution/dosing; concentration mode; validated legacy factor |
| dilution | Dilution/dosing; concentration mode; old unspecified units require confirmation |
| fold-dilution | Dilution/dosing; fold mode |
| serial-dilution | Serial or parallel gradient plan |
| molarity | Weigh/prepare; mass, concentration or volume |
| percent-solution | Weigh/prepare; w/v, v/v or w/w |
| media-recipe | Structured medium recipe |
| buffer-recipe | Structured buffer recipe |
| ic50-ec50 | Dose-response analysis; relative 4PL midpoint |
| master-mix | Reaction preparation; single or separate groups |
| ligation | Insert:vector molar-ratio calculation |
| tm | Method-limited primer estimate |
| dna-rna-conversion | Explicit dsDNA/ssDNA/RNA length model |
| bradford-bca | Linear protein standard curve within validated range |
| elisa-4pl | 4PL standard curve and inversion |
| wb-loading | Single/batch protein loading |
| moi | Functional-titer MOI and theoretical Poisson estimates |
| virus-titer | PFU or explicitly approximate endpoint |
| unit-converter | Shared unit registry |
| centrifuge | Radius-dependent RPM↔RCF |

New routes: `resuspension`, `normalization`. The standalone plate's six calculator modules now use a generated bundle of the same engine, regenerated by `npm run build`.

## Reproduction

```sh
npm test
npm run lint
npx tsc --project tsconfig.calculator.json --noEmit
LABNEST_BUILD_DIR=.next/calculator-production LABNEST_TSCONFIG_PATH=tsconfig.calculator.json npm run build
node scripts/calculator-acceptance-server.mjs
LABNEST_E2E_BASE_URL=http://localhost:3221 npm run test:calculator:e2e
LABNEST_E2E_BASE_URL=http://localhost:3221 npm run test:calculator:integration
```

The acceptance-server helper only permits localhost PostgreSQL and creates a separate `labnest_calculator_acceptance_20260906` database with synthetic fixtures. It does not reset or seed the working laboratory database. It leaves the test database in place for inspection.

The default typecheck initially encountered pre-existing duplicated generated `.next/types/* 3.ts` declarations. `tsconfig.calculator.json` checks all application TypeScript against an isolated build; no source check is disabled. The default config and unrelated generated caches were not deleted.

## Explicit limits / remaining acceptance

- Real 3–5 person trial: **not performed; pending user trial**. No completion times or success rates have been invented.
- Viewport tests cover 360/390 CSS px. Real on-screen keyboard, device rotation, screen reader and OS font enlargement still need physical-device acceptance.
- This is the application's existing single-user model. Foreign origin, missing/mismatched step, archived experiment and forged result are rejected, but this does not establish authenticated multi-user ownership/ACL enforcement.
- Offline support is **per explicitly cached page**, on HTTPS/localhost, with cached build assets. It is not a promise that every unvisited route or LAN HTTP page can start offline, nor a cross-device sync claim.
- 4PL is the existing coordinate-search method, now with direction, finite-input, range and convergence checks. It is not a validated clinical assay package; BCA's supported path remains linear within a validated range. TCID50 remains an approximate endpoint, not a newly validated Reed–Muench/Spearman–Kärber implementation.
- Explicit pipetting-increment back-calculation currently supports final-volume dilution modes. Other modes preserve theory and clearly report that rounding was not applied; no rounded recipe is silently substituted.
- P2 chemical-form lookup, external reagent catalogues and automatic solvent recommendations are not implemented.

These limits must remain visible when assessing strict specification completion. The document does **not** declare all P0/P1 acceptance complete merely because the application builds.

## Additional UI requirement (2026-09-06)

Numeric inputs and editable units remain on one unbroken row. Main quantity groups are capped at 18rem rather than expanding across the entire form; the gap is reduced to 6px. Structured stock/target concentration pairs use a compact numeric field and a 64px unit selector, including recipe and Master Mix editors. No maximum numeric character count or precision restriction was introduced. `verify-calculator-compact-ui.mjs` checks actual control rectangles at 360, 390 and 1280 CSS px; screenshots were inspected.
