# D Embedded tools — integration acceptance

Four internal routes reuse existing local tools; exact source and output hashes in SOURCES.json. qPCR Planner uses its existing portable release; qPCR Analysis uses the 2026-08-28 offline release. CNV Planner is bundled from its original component and calculation modules; CNV Analysis copies original HTML/scripts/vendor unchanged, including diagnostics.js required by the current source. No analysis algorithm is rewritten. Original managed URLs remain in the tool manifest as compatibility metadata.

`LABNEST_TOOL_SOURCE_ROOT=/path/to/C_材料方法 node scripts/sync-embedded-tools.mjs` reproduces the packaging. The source projects are read-only; only LabNest public assets are updated. New sample-file intake for planners explicitly selects the name column and sends it to the original sample-import control for confirmation; it performs no plate calculation.

Browser evidence file-checks.json:
- qPCR Planner: CSV names imported, layout generated, each plate confirmed, ZIP reopened and workbook contains Synthetic-A.
- CNV Planner: same sample-file flow, XLSX reopened and contains Synthetic-A.
- qPCR Analysis:12 synthetic Cq wells imported, Control calibrator selected,5-sheet calculation workbook downloaded and reopened.
- CNV Analysis:24 synthetic physical wells imported, simulated known2-copy calibrator selected, XLSX and JSON downloaded/reopened. These are synthetic fixture assumptions, not independently validated biological controls.

Production mode rerun, route/card keyboard checks and desktop/mobile screenshots pending. Hardware keyboard, real160%device, and user trial not executed.
