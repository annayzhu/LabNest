# Release verification

A release is acceptable only when the scientific registry, responsive interface, static exports, and production server pass together.

## Automated gate

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build:webpack
npm run test:e2e
NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH=/visualization-studio npm run build:webpack
npm run test:deployment
```

The tests enforce:

- all 82 module IDs are unique and registry-owned
- every module has input roles, example/template data, guidance, and methodological references; scientific boundaries remain explicit in guidance and validation
- every bundled example validates and produces finite SVG geometry
- default 340 × 340 output, Arial, 柴染棕, restrained heatmap colors, and black semantic chart text
- direct numeric editing without an extra apply button
- desktop sticky/aligned panels and automatic preview positioning after plot selection
- collapsed mobile selectors that retain the current plot and palette
- SVG and 600 dpi PNG download integrity
- pixel safety for dense labels, legends, tracks, marks, error bars, and scientific annotations

## Manual smoke check

- Start with a clean browser profile so saved palette preferences do not mask defaults.
- Check Bar, clustered heatmap, PCA, KM, network, Circos, UpSet, ROC, and one specialized enrichment view.
- Use both bundled examples where a module exposes more than one accepted input form.
- Confirm that empty axis titles stay empty and that automatic domains contain every mark and uncertainty interval.
- Confirm that guidance includes a definition, suitable data, intended question, references, and any method-specific boundary needed to interpret the figure.
- Test a 390 px-wide mobile viewport and a 1440 px desktop viewport.
- Open exported SVG and PNG files outside the browser and confirm typography, color keys, and label boundaries.

## Deployment smoke check

- Root deployment: request `/` and its Next.js assets.
- Sub-path deployment: build with the final `NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH`, then request that exact path and its prefixed assets.
- Standalone runtime: confirm the build prepared `.next/standalone/.next/static` as described in [Engineering integration](engineering-integration.md).
- Iframe integration: verify Content Security Policy, downloads, responsive height, and same-origin behavior.

Record the commit SHA, Node version, command results, and deployment base path with the release. A green unit suite without a successful production build and real-browser export test is not a completed release.

CI also runs a dedicated production smoke test: it builds with `/visualization-studio`, starts the prepared standalone server, requests the canonical prefixed HTML without silently following redirects, and verifies that a real prefixed Next.js asset is non-empty.
