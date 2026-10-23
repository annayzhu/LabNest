# Appearance foundation maintenance

## Single preference source

`AppearanceProvider` / `appearance.ts` remain the only Appearance writer. Keep `labnest.appearance` schemaVersion 1; optional `densityId` uses compact/standard/comfortable, with standard preserving the existing 1rem card padding. Old `uiScaleId` IDs retain their values and only their user-facing labels clarify Small/Standard/Large. Missing new density is compatible; unknown values/future structures remain protected. Bootstrap and hydrated application use the same accepted IDs. Older clients may protect the new unknown field instead of overwriting it.

## Shared skin parameters

Reuse existing `--ln-radius-control-*`, `--ln-radius-panel*` and `--ln-shadow-panel`. The new `--ln-border-width`, `--ln-content-padding`, `--ln-content-gap`, `--ln-decoration-opacity` and `--ln-icon-plate` cover shared card framing, spacing and decoration. Density updates spacing tokens, never font tokens. Existing UI sizing and document-specific layout tokens remain intact; this is a foundation, not a rewrite of every historical hard-coded style.

Future approved “简洁工作台 / 纸感实验簿 / 柔和实验室” variants should select a controlled token preset through this same provider, with defaults, migration and visual acceptance. Do not create three parallel component trees or expose unfinished skin choices. Full variants await approved visuals.

## Color and content boundaries

`resolvedThemeTokens` owns UI light/dark palettes for all seven existing IDs. Navigation selection, success, warning and error are separate semantics; retain textual status cues and contrast tests. `SystemThemePicker` uses resolved tokens for swatches instead of the light-only colors list. Lab-soft retains its six alpha assets and a small neutral dark-mode plate; `TaskIcon` handles load/decoding failure. Other tasks use the line fallback.

Scientific chart palettes and sample-group mappings remain in their existing domain settings. Appearance must not rewrite figure data, group colors, protocol rich-text marks, A4 document styles or formal exports. The preview uses shared UI cards and document-block rendering on a UI surface; it is explicitly an example, not a recorded calculation or real timer.

## Verification

`verify-calculator-appearance.mjs` invokes the foundation browser checks, so the existing production-browser workflow exercises this feature without a second CI system. Keep old preference/storage/WB checks and visual contrast tests. Physical device, real browser zoom and people-based usability evidence remain separate from Playwright viewports.
