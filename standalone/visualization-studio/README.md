# Visualization Studio

A browser-local scientific visualization workspace for creating compact, publication-ready figures from CSV, TSV, XLS, and XLSX data.

## Highlights

- Publication-oriented defaults with Arial typography and compact figure dimensions
- Eighty-two registry-owned modules spanning comparison, distribution, association, dimension reduction, matrix, enrichment, survival, clinical prediction, sets, flow/circular views, typed biological networks, genomic context, cancer alteration, sequence motifs, composition, hierarchy, and specialized omics displays
- Distinct pie, donut, rose, waffle, treemap, sunburst, radar, polar-profile, and population-pyramid contracts with scientific suitability guidance and references
- A unified Box, Violin, Beeswarm, Raincloud, Histogram, Density, and Ridge layer system with deterministic binning, KDE, quartiles, SD, SEM, Student t confidence intervals, pairing, facets, and orientation controls
- Line uncertainty as pointwise SD, SEM, or supplied 95% CI half-widths, displayed as bars or ribbons
- Association views spanning points, marginals, 2D density, hexbin counts, covariance ellipses, convex hulls, three-variable pair matrices, orthographic 3D, and ternary compositions, with linear, polynomial, or LOESS fits
- A unified PCA, PCoA, UMAP, t-SNE, and NMDS display system with color/shape mappings, covariance ellipses, convex hulls, centroids, optional orthographic 3D, supplied PERMANOVA annotations, and PCA scree/loading views
- Heatmaps with row/column z-scaling, Euclidean or correlation distance, average/complete/single linkage, dendrograms, reproducible cluster cuts, stable-ID annotation tracks, triangular correlations, circular layouts, and coordinated row summaries
- Adjustable labels, dimensions, line weights, marks, grids, legends, uncertainty bars, palettes, and plot-specific parameters
- Built-in journal-inspired and traditional Chinese color palettes
- SVG, 600 dpi PNG, and reproducible JSON configuration export
- Example datasets and downloadable input templates
- Browser-local processing: uploaded data is not sent to a server
- Responsive desktop and mobile layouts

## Run locally

```bash
npm ci
npm run dev
```

Open [http://localhost:3400](http://localhost:3400). Visualization Studio uses this fixed local port so it does not collide with other LabNest tools.

For a production-style local run:

```bash
npm run build
npm run start:local
```

The production-style local address is also [http://localhost:3400](http://localhost:3400).

For production deployment, reverse-proxy integration, a standalone runtime, or embedding the unchanged interface inside another application, see [Engineering integration](docs/engineering-integration.md).

## Validation

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build:webpack
```

`npm run verify` runs type checking, linting, unit tests, and the production webpack build. Browser acceptance remains a separate `npm run test:e2e` step because it starts a real Chromium instance. The complete release gate is documented in [Release verification](docs/release-verification.md).

## Module contract

Every plot type is registered through one module contract containing its input roles, one or more resettable examples, downloadable template data, adjustable settings, validation rules, renderer, basic definition, suitable data, intended scientific question, and methodological references. Method boundaries are stated in the guidance, input hints, and actionable validation warnings. The browser test suite renders every bundled example, while registry tests prevent an incomplete module from shipping.

## Scientific scope

The application focuses on visualization and deterministic browser-side transformations. Correlation panels can optionally calculate two-sided P values using the conventional t approximation (Pearson product-moment or Spearman rank, as labeled); they do not adjust for multiple testing. Linear confidence ribbons describe mean-response uncertainty, not prediction intervals. Other modules do not invent P values or substitute unreported statistical summaries. Users remain responsible for selecting methods appropriate to their study design and for reporting whether uncertainty represents SD, SEM, confidence intervals, or another statistic.

### Palette provenance and accessibility

The nine Chinese Traditional themes use named HEX anchors from the MIT-licensed [zhongguo-traditional-colors](https://github.com/nevertoday/zhongguo-traditional-colors) master list. The project records those names as provenance, then independently calibrates sequential and diverging scales for compact white-background scientific figures; poetic harmony relationships are not treated as evidence that a combination is suitable for quantitative encoding. Axes, ticks, legends, and annotations use near-black semantic text rather than inheriting a data color. Where color separation is insufficient, use outlines, shapes, direct labels, or patterns as a second channel.
The default 柴染棕 theme records 梧枝绿 `#69A794` as the canonical source and uses `#5FA88F` as a small white-background accessibility adjustment for its fourth categorical mark, so the standard four-group figure passes the built-in deuteranopia separation threshold.

### Heatmap data contract

Heatmap matrices use the first column as a unique row identifier and all remaining columns as numeric matrix values. Optional row and column annotation tables are TSV/CSV text whose first column contains stable identifiers; they are joined by exact ID rather than row order. Declare track semantics in headers such as `batch[categorical]` or `age[continuous]`; undeclared numeric tracks are inferred as continuous with an explicit warning. Duplicate identifiers and invalid continuous declarations block rendering, while missing and extra identifiers are reported explicitly. Browser previews are capped at 250 × 100 cells for rectangular layouts and 80 × 60 for circular layouts, with an additional size-aware minimum ring-width check. Scaling, distance, linkage, cluster-cut counts, view mode, and palettes are preserved in the JSON configuration export.

### Ordination data contract

PCA accepts a wide feature-by-observation matrix plus optional observation metadata joined by exact sample ID, and records filtering, transformation, centering, optional feature scaling, explained variance, scores, and all selected-feature loadings. Auto detection is deliberately conservative: only `_count`/`_counts` and `_tpm`/`_fpkm` column suffixes select a raw-count or abundance transform; other numeric matrices are treated as already normalized unless the user explicitly chooses a layer. Counts use `log2(CPM + 1)` after a documented low-count filter, non-negative abundance uses `log2(value + 1)`, and normalized continuous data are not silently transformed. PCA uses a deterministic NIPALS solver and is capped at 300 observations and one million selected feature-by-observation cells in the browser; larger studies should import externally computed, documented coordinates. PCoA, UMAP, t-SNE, and NMDS accept precomputed coordinates only and never refit an embedding in the browser. A third coordinate is required only for the optional orthographic 3D projection, whose independently min-max-scaled axes are descriptive rather than metric. Compact ordination legends support up to 12 color groups. PCoA variance percentages, NMDS stress, upstream method notes, and PERMANOVA statistics are displayed only when supplied; PERMANOVA requires a tested group and a method note and is not recomputed from plotted coordinates. Preserve the upstream distance, preprocessing, random seed, constraints/strata, and convergence settings in the analysis record.

### Network and hierarchy data contract

General, PPI, ceRNA, miRNA-target, Cnet, and enrichment-map views use explicit `node` and `edge` records. Every edge endpoint must also have one node record, which preserves node grouping/type/value and permits true isolated nodes. Edge weight, direction, sign, and evidence/type remain separate encodings; the renderer never infers regulation or biological evidence from correlation or topology. Circular, grouped-layer, and degree-centered radial layouts are deterministic for the exported integer seed, but their coordinates are not biological distances. Compact previews are capped at 120 nodes and 400 edges and additionally require sufficient pixels per visible node/label. Tree and dendrogram modules use a different single-root parent-child contract: ordinary tree branch length represents level only, while dendrogram branch positions use supplied non-negative merge heights with parent height no lower than child height. Input sibling order is retained, and neither hierarchy is converted to a generic network.

## Privacy

Input files are parsed in the browser. The standalone application has no database and no upload API.

## License

No open-source license has been granted yet. The source is publicly viewable, but reuse rights remain reserved by the repository owner unless a license is added later.
