# Planner UI and occasional free wells · 2026-11-03

User-confirmed decisions:
1. Generate the ordinary layout first, then add occasional manual wells.
2. Choose existing sample/assay names or type temporary names in the existing well editor. Temporary names do not become automatic input combinations; occupied wells still contribute to actual reagent/template requirements and exports.

Scope: title icons, the single sample-file importer inside the left sample panel, the current manual editor and counts for manual-only names. qPCR record workflow development belongs to the concurrent Claude work and is not changed here.

Verification boundaries: existing public Planner Session commands, saved session/output/export contracts, and real browser operations. Use synthetic data and the isolated acceptance service. No source commit, production deployment or GitHub push before user acceptance.

Delivery: maintained planner source `/Users/annayzhu/Developer/labnest-tools/qPCR-Plate-Layout-Planner`, baseline `961e641c3d2f3c59b965e64f42ab6c29e651eb36`, with an uncommitted source patch. The host title change is limited to `src/app/tools/[toolId]/page.tsx`. The 3002 runtime uses its prior image plus the scoped title/tool package changes; package metadata records the working-tree patch hash explicitly.
