# Calculator UI, 2026-09-15

Baseline main and prior production: c69e06806a79f65c9c1d609f8254c7a03b1be3da.
Branch: codex/calculator-ui-20260915. Original dirty checkout preserved.

## Design and boundaries

Operate mode, preservation of LabNest tokens. DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 7. The supplied landing-page skill is outside scope for data tables and multistep tools; no marketing hero, decorative imagery or additional design system is introduced.

Layout: task → relevant inputs → primary result → actions → details. Shared presentation metadata classifies simple, recipe, batch, curve, transfection and image surfaces. Units and engine values remain authoritative. Workspaces use desktop columns and explicit mobile input/result selection; short fields may share rows, tables scroll locally.

## Implementation locations

- `workspace-presentation.ts`, `workspace.css`, `CalculatorWorkspace.tsx`: task layout, short fields, relevant equipment settings, nearby calculate action, mobile panes, CFU option, actual supported converter units.
- `StructuredInputs.tsx`: continuous Master Mix rows, concentration subrows, current reaction group, staged paste, sample/curve/TCID50 columns, focus on new rows, removal confirmation.
- `ResultPanel.tsx`: primary values/table first, current result group, secondary output and operations disclosure, semantic invalid-result save guard. Full stored/exported data is unchanged.
- `TransfectionEditor.tsx`: current group and mobile tube navigation, unchanged material/mixing reset semantics with contextual notice, stock unit conversion preserving physical quantity.
- `FitPlot.tsx`: actual linear/log axis description and concentration unit.
- `[toolId]/page.tsx`, `EmbeddedLabTool.tsx`: four large tools occupy the browser content page, with return and existing sample import.

## Tool source audit

Calculator already linked to the current in-repository route. The four qPCR/CNV routes loaded embedded copies, and the source audit found these copies were not all current. Source snapshots and hashes are in `evidence/tools-source-audit.json` and `tools-synchronized.json`.

Updated qPCR layout from the supplied current 20260915 portable archive; CNV analysis from clean cb3b9cf; CNV planner from the current static build associated with clean f71ebd7 (asset paths made relative); qPCR analysis regenerated with its own offline packager from clean 7e812fc. The standalone source projects were not edited. Toolkit algorithm validation remains owned by those projects; embedded loading/import checks are recorded separately.

## Verification seams

The attachment explicitly requests existing calculation compatibility tests and browser-visible input/result/persistence behavior. Those are the test seams used, with no spacing snapshot tests. Added a failing-then-passing rendered-result test for Tm priority. Logs are retained.

Shanghai suite: 626 passed initially. Vancouver initial run: 625 passed, one existing visualization wall-clock threshold failed at 3159 ms during concurrent compilation. Isolated rerun of the unchanged file: 11 passed. This is recorded as a timing failure and rerun, not omitted.

Before screenshots were taken from production port 3000. Initial after screenshots are development evidence, not production acceptance. `candidate` screenshots use the production build fixture server. Fixture records are synthetic. Real device soft keyboard, real OS zoom and researcher trial are not automated browser evidence.

Final targeted review also fixed reagent-object error focus, optional CFU clearing, complete table access, curve column units, and full-width mobile tool intake. The sample-file adapter explicitly selects the qPCR sample textarea, preserving the separate gene input. See ACCEPTANCE.md and VERSION.json for exact evidence boundaries.
