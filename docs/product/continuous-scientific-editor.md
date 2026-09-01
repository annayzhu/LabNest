# Continuous scientific editor and experiment result report

## Product intent

LabNest document editing must feel like one compact scientific document rather than a stack of disconnected form cards. The editor keeps record metadata and relevant linked items outside the body, while the body uses one continuous WYSIWYG surface with one shared formatting toolbar.

Experiment results are recorded at experiment level. One report may aggregate the result templates selected from multiple Protocol versions used by the experiment; users should not have to create or maintain a separate report for every Protocol unless they explicitly choose to.

## Acceptance criteria

### Continuous document editing

- Protocol, Research Plan, Experiment, Result, Report, and Entry rich-text surfaces use the shared Tiptap formatting Module through a small Adapter for each persisted document schema.
- A document uses one compact sticky toolbar. Formatting controls do not repeat above every paragraph or block.
- Bold, italic, underline, font family, font size, line spacing, headings, lists, links, text color, undo, and redo remain available.
- The insert menu preserves scientific blocks where the document family supports them: checklist, table, callout, media/file, metric, dataset/result structure, timer, result template, and Plate Planner.
- Tables are resizable, support smaller text, wrap long cell text, and accept tabular paste from Excel without expanding the page or print canvas beyond its width.
- `Command+Z`/`Ctrl+Z` reverses text and block edits while focus remains in the editor.
- Existing JSON, Markdown, `ProtocolDocument`, and `ScientificDocument` values open without a database migration and serialize back through the existing form actions.

### Protocol workspace

- Management metadata (identifier, titles, version, lifecycle/review status, scope, tags, revision note) is compact and visually separate from the Protocol body.
- Relevant items (plans, projects, experiments, results, attachments, history, and Plate Planner) are compact and visually separate from both metadata and body.
- The Protocol body retains structured scientific blocks, print rendering, DOCX export/import, checklist steps, timers, tables, result templates, and consumption rules.

### Experiment result report

- The primary result-recording surface appears before analysis, interpretation, and limitations.
- A report created from an experiment aggregates the selected Protocol result-template snapshots and keeps their provenance.
- Structured result fields, dataset tables, file evidence, and template instructions are directly fillable in the report; schema definitions are not shown as a substitute for data-entry controls.
- Analysis, interpretation, and quality/limitations remain available but do not force repetitive narrative for routine experiments.
- Result controls remain in a compact right-side properties area on desktop and a content-first collapsible area on mobile.

### Layout and design system

- Desktop and mobile layouts avoid a narrow document section followed by an unrelated full-width section.
- Toolbar controls, metadata, relevant items, tables, and scientific widgets use centralized `--ln-*` tokens and the LabNest design system instead of component-local hard-coded dimensions.
- Default rich-text line spacing is 1.6; printed Protocol pages retain safe top and side margins and do not inherit editor-only overflow.
- The editor remains usable at 390 px without document-level horizontal overflow.

## Verification

- Unit-test both schema-to-Tiptap and Tiptap-to-schema Adapters, including legacy data and structured widgets.
- Run type checking, lint, the full unit-test suite, and a production build.
- Browser-check Protocol, Research Plan, Experiment, Result, Report, and Entry editors at desktop and mobile widths.
- Verify text editing, `Command+Z`, scientific insertion, table resizing/paste behavior, saving, printing, and the Docker health endpoint.
