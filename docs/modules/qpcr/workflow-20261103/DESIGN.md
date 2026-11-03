---
name: LabNest qPCR workflow
description: Record-bound plate planning and chart-led analysis in the existing LabNest Operate workspace.
colors:
  planner-canvas: "#f5f7f4"
  planner-action: "#3f625d"
  planner-border: "#dfe5e1"
  analysis-canvas: "#f5f7f8"
  analysis-ink: "#243438"
  analysis-action: "#345f71"
  analysis-border: "#dce3e5"
  surface: "#ffffff"
rounded:
  planner-panel: "8px"
  control: "6px"
---

# Design System: qPCR workflow

## Overview

**Creative North Star: “The Scientific Workbench” — Operate.**

This module extends the established [LabNest design system](../../../../DESIGN.md) and [product commitments](../../../../PRODUCT.md). It keeps the record as the working context: open a full workspace, inspect or change the scientific output, then explicitly save it back. Compact controls, quiet disclosures and legible output carry the task; the refinement introduces no new visual identity.

This is a built-state description for the [3002 acceptance scope](PLAN.md), dated 2026-11-03. The finish review reported both reviewed fixes resolved and a **ship** disposition at those fixes’ scope. That disposition does not establish complete workflow acceptance, scientific validation, publication to main or deployment to 3001.

## Colors

The record wrapper uses the application's current semantic tokens. The embedded planner uses moon-white surfaces and dai-cyan actions; the analyzer currently retains a cooler blue-gray palette through its own CSS aliases. The extracted values above describe these two implementations, not automatic inheritance of every LabNest appearance preference.

Use quiet surface and border contrast for grouping. Selected tabs and decisive actions carry the accent. Scientific chart and plate colors identify data and remain distinct from interface state; retain textual legends and labels.

## Typography

The record wrapper and saved output use LabNest's interface font role. Embedded tools retain their existing sans-serif stacks with Chinese fallbacks. The result heading is 20px; workflow controls and disclosure text are generally 13px; saved captions and tables are 12px on screen and 9pt in print. Reuse established hierarchy and control patterns rather than introducing display typography.

Long sample names wrap in chart labels. A display-name disclosure permits presentation names while preserving source labels in the working state; duplicate presentation names receive distinguishing suffixes.

## Layout

**Task-order rule.** Planning proceeds through inputs → full plate → mix → save. Above 1180px, the planner keeps a 320px input column beside the plate. The plate viewport has a bounded, adjustable working area; the mix summary follows it in normal content flow. Zoom, fit, readable-size and expanded-view controls support inspection without replacing the complete plate with a thumbnail.

Analysis gives the chart the main visual area. Settings, calculation source/method and display/export controls remain accessible through compact disclosure rows. The reference-target setup opens when no reference is selected. A target selector and single-chart/multiple-chart switch precede the figure; the figure toolbar owns insertion selection, facet navigation, expansion and all-facet export.

Each chart facet contains at most six eligible categories, in the selected sample order, and uses the shared axis domain for that target. The working view displays one facet at a time. Charts retain a 640px minimum working width with local scrolling on narrow viewports; the desktop chart container is capped at 760px. Saved figures instead scale to the record width and offer **查看大图** for readable inspection.

The full workspace occupies the viewport above the still-mounted editor. Its header carries **返回记录**, record title and one primary save/insert action. Returning after draft persistence restores focus to the launch element. A successful insertion closes the workspace and scrolls the saved output into view.

Visual evidence is limited to the supplied captures: [desktop analysis](../../../../.impeccable/review/desktop.png), [1366px planner](../../../../.impeccable/review/planner-1366.png), [tablet analysis](../../../../.impeccable/review/tablet.png) and [mobile saved result](../../../../.impeccable/review/mobile.png). These captures are examples, not coverage of all viewport sizes or interaction states.

## Elevation & Depth

Static workflow regions use surface changes and hairlines. The full workspace and enlarged-image dialog are genuine overlays; do not add decorative shadows to ordinary output blocks or disclosure groups.

## Shapes

Preserve the planner's gently rounded panels and compact controls. The record wrapper uses shared radius tokens. Scientific tables use simple dividing rules; plate wells retain their domain-specific shape. These local patterns do not redefine the root design system.

## Components

- **Record actions:** Planning uses **保存到计划**; analysis uses **插入结果**, or **应用并插入** when changes await application. The primary action is disabled while loading, saving or awaiting required sample-mapping confirmation. Save errors stay next to the action context; a revision conflict offers **另存为新版本**.
- **Plate and mix:** The complete plate remains the primary inspection surface. The mix row exposes **查看配液** and **复制配液**. Clipboard failure exposes selectable text rather than silently discarding the copy request.
- **Disclosures:** Loading settings, plate details, analysis settings, source/method, display/export and display names retain their existing content behind named controls. Do not replace them with persistent instruction banners in the normal working state.
- **Chart selection and facets:** Viewing a target and selecting it for insertion are separate states. Insertion collects every facet of each selected target, including facets hidden in the current view. **导出全部分面** likewise includes all facets; navigation must never limit the saved output to the visible page.
- **Saved output:** Each revision references its saved session, figure attachments and full data table. The document renders all saved figures, a compact result table and a visible method statement; **数据与方法** links to the complete session/processing record, dataset and source attachments where present. Reopening edits the working session; the saved figures remain the revision's snapshots until an explicit save creates the next output revision.
- **Print:** Render the saved figures and tables, repeat table headers and keep individual figures together where possible. Hide workspace controls, image enlargement and download disclosures. Preserve method text and figure captions. The full dataset remains attached even when the document shows a compact table.

Implementation sources: [record integration](../../../../src/components/QpcrRecordIntegration.tsx), [saved output](../../../../src/components/QpcrOutput.tsx), [application styles](../../../../src/app/globals.css), [output persistence](../../../../src/app/api/qpcr-workflow/route.ts), and the acceptance clones at `/private/tmp/labnest-qpcr-planner-20261103/app` and `/private/tmp/labnest-qpcr-analysis-20261103/app`. The temporary paths identify inspected source, not durable release locations.

## Do's and Don'ts

- **Do** preserve input → plate → mix → save order and chart-led analysis hierarchy.
- **Do** keep units, method qualifications, source context and technical-replicate meaning attached to scientific outputs.
- **Do** preserve all selected chart facets and full attached data across saving, reopening and document rendering.
- **Don't** equate a visible facet, compact table or current target with the complete saved analysis.
- **Don't** imply technical wells are independent biological samples, or a successful UI review validates scientific assumptions.
- **Don't** promote module-local palette aliases or screenshot-specific observations into claims of global theme or responsive coverage.
