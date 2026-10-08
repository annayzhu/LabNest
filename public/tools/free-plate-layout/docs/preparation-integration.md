# Preparation integration — Issue 42

## Scope and ownership

The independent repository owns the plate UI, local persistence, current-plan lifecycle,
project summaries, and exports. LabNest supplies a small, pinned calculation kernel, not
a second application state model. `preparation-core.js` returns numeric results and
contributions; `preparation-ui.js` owns editable input rows and result presentation.

The first delivery adds editable Master Mix, batch concentration normalization, and
final-volume / add-to-existing / fold / 1:N / parts dilution. Existing fixed-ratio,
weighing, transfection, serial dilution and drug layouts remain. New staged multi-plan
workflows, seeding/hydrogel integration in the independent app, and advanced stock
preparation remain out of scope. Existing LabNest-only calculators must be preserved
by its host adapter, without copying their state logic into the independent app.

## Scientific contracts

- Wells define the reaction count exactly once. Grouping partitions selected wells.
- A recipe specifies a named make-up liquid. Templates/samples unchecked as premix
  are dispensed individually; they never enter a pooled Master Mix total.
- Cross-plate Master Mix merging is opt-in. Same group name, full component recipe,
  stock concentration definitions and per-reaction quantities must match. Different
  units may conservatively keep equivalent recipes separate; units are not inferred.
  This describes the independent Reaction editor. The LabNest host preserves its
  existing Calculator rule: identical premix components/volumes/concentration
  definitions pool across group/template labels; separately added templates never
  pool or receive overage. Its verified typed contributions carry that distinction.
- Normalization uses one explicit concentration unit for all rows. Every row maps
  to one well; invalid rows retain their identity and cannot publish a partial plan.
  No sample overage is introduced by the cross-plate summary.
- Adding stock to existing liquid uses `(target-initial)*existing/(stock-target)`.
  Existing liquid is informational, not new reagent demand. Preparation overage
  changes how much stock is prepared, never the dose delivered to each well.
- One current plan per plate. Editing a calculation invalidates its preview but
  does not overwrite the saved revision until explicitly saved. Saving replaces
  the current plan, including when switching calculator types.

## Reproducible kernel and delivery

`node scripts/sync-preparation-kernel.mjs /path/to/LabNest` rebuilds the vendored
kernel. The provenance JSON records the source commit, individual input hashes and
bundle hash. No network, LabNest service or React dependency is required at runtime.

After committing and testing, run `node scripts/build-release.mjs /new/output/path`.
It refuses uncommitted assets and existing destinations. `release.json` records the
commit and every shipped file hash. Desktop and LabNest should consume these exact
assets; the sole HTML insertion point is `<!-- host-integration -->`.

Verification: `npm test`; browser journeys via `scripts/visual-smoke.mjs` with
`PLAYWRIGHT_MODULE_URL` pointing to an installed Playwright module and
`ACCEPTANCE_BASE_URL` pointing to a local HTTP server. `ACCEPTANCE_JOURNEYS=preparation`
runs the new behavior, persistence and exported-workbook readbacks in isolation.

Browser data is stored locally, not inside the HTML folder. Before changing local
file paths or browser origins, export a project backup and import it in the new
version. Moving an old bundle to Trash does not transfer its browser data.
