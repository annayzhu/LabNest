# Actual editing entrances and staged coverage

2026-10-14. `EDITOR-INVENTORY.txt` records the source search; this table maps the actual callers. P1 expands only Protocol configuration and its execution projection. Other existing editors remain in place, not migrated or declared universally tested.

| Route / field | Editor and persistence | Read path | This batch |
|---|---|---|---|
| `/protocols/new`, `/protocols/[id]/versions/[versionId]/edit` / seven sections | ProtocolDocumentEditor → ProtocolWysiwygEditor; ProtocolVersion.contentJson, derived stepsJson | ProtocolDocumentView, version JSON/DOCX | Real empty-author flow, long source, table/parameter/media, save/reopen; full new P1 configuration |
| `/protocols/[id]`, experiment creation preview | Same source document, selected/all projection; no execution writes | ProtocolDocumentView / ProtocolExecutionPreview | Browser preview and frozen-selection readback |
| `/experiments/new`, `/experiments/[id]/edit` / purpose, design, body | ExperimentForm → ScientificDocumentEditor; contentJson | ScientificDocumentView + experimentExecutionDocument | New experiment browser creation; structured status protected in UI/server; remaining editor migration P2 |
| `/experiments/[id]/run` / steps, actual values, deviations, quick notes | ProtocolRunProgressForm, StructuredStepRecord; existing steps/events plus executionPlanJson | Same frozen source and deterministic resolution | Desktop/mobile/tablet widths, actuals, stale tabs, timers, calculator return and DB readback |
| `/research-plans/new`, `/research-plans/[id]/edit` / body | ResearchPlanForm → ScientificDocumentEditor; contentJson | ScientificDocumentView | Existing editor preserved; full fresh browser sweep deferred P2 |
| `/results/new`, `/results/[id]/edit` / body | ResultForm → ScientificDocumentEditor; contentJson and structured result values | ScientificDocumentView / ResultTemplateView | Existing editor preserved; full fresh browser sweep deferred P2 |
| `/reports/[id]/edit` / body | ReportEditForm → ScientificDocumentEditor; contentJson | ScientificDocumentView | Existing editor preserved; full fresh browser sweep deferred P2 |
| `/entries/new`, `/entries/[id]/edit`, quick entry in Run / body | EntryComposer → MarkdownRichTextEditor → CompactRichTextTiptapEditor; entry content JSON/Markdown bridge | Entry content + DocumentMediaView | Existing routes preserved, unit regressions; physical IME and fresh route-specific sweep unexecuted |
| Protocol result-template configuration / description and field help | ResultTemplateConfigEditor, DraftTextInput; result template definition JSON | ResultTemplateView | Plain metadata retained; not automatically made executable |
| ScientificDocumentEditor rich blocks, Protocol rich cells | Shared CompactRichTextTiptapEditor and DocumentWysiwygToolbar; typed JSON arrays | Shared scientific rich-content views | Formatting/identity/compatibility tests; no second editor |
| Project descriptions, Inventory notes, Sequence descriptions, deviations | Existing bounded textareas/DraftTextInput; record-specific strings | Existing metadata views | Plain-text capability is intentional; no forced rich-text migration |
| Calculator numeric fields / batch text / copy panel; AI prompt fields | Existing calculator and AI components | Existing tools | Outside authoring migration; existing full test suite retained |

No chat, generic workflow engine or watch editor is created. Source references are separate from file ownership; removing a node does not physically delete original attachments.

## Data path

Protocol editor → `protocol-tiptap.ts` → `protocolDocumentSchema` / compatibility gate → existing Protocol action → version contentJson → frozen Experiment protocolSnapshotJson → `structuredRunView` → Run and export. New `ProtocolRun.executionPlanJson` is additive and nullable. Legacy records use their original path; no batch parser rewrite or status conversion occurs.

Media upload → existing `/api/attachments` idempotent upload → DocumentMedia node referencing attachment ID → document media association → original/preview request with fallback. Copy creates a unique node ID sharing one asset; moves retain node ID. Unknown rich node types block destructive editing/export and retain readable original JSON.
