# Structured Protocol contract and implementation boundary

Baseline and installed dependencies/skills: [BASELINE.json](BASELINE.json). Authoritative requirements: [REQUIREMENTS.md](REQUIREMENTS.md). This is software acceptance data, not a validated extraction protocol.

## Domain decisions

- **Protocol source** is the existing versioned `ProtocolVersion.contentJson`; its seven sections remain canonical. Optional `systems.schemaVersion=1` extends the existing document schema without rewriting historical documents.
- **Selection dimension** (volume, sample property, plate format) has stable option IDs. A preset bundles explicit choices; it is not a confirmation.
- **Conditional parameter** has one authored source. Fixed and lookup values carry units and provenance. Missing and conflicting values cannot be inferred by proportional scaling.
- **Execution scope** is a single experiment in P1. Existing `ExperimentStep.groupKey` means source Protocol version, NOT an experimental treatment group; do not repurpose it.
- **Execution snapshot** remains `Experiment.protocolSnapshotJson`; source documents are frozen at creation. Selected systems, resolution and revision belong to the instance. Execution observations belong to step events/records, never the template.
- **Applicability** is applicable / not-applicable / unknown. Unknown input under negation stays unknown. Independent conditions may overlap; declared exclusive alternatives may not.
- **Identity** is an explicit stable ID. Position and headings are display only. Table rows that carry conditions require persisted row IDs.

## Public seams confirmed by the user

1. Protocol save → reopen → preview (existing actions/editor/renderer).
2. `resolveProtocolSystem` / document projection: deterministic authored selections, quantities, unknowns and conflicts; shared by preview, Run and output.
3. Experiment create → confirm selection → timer / completion / actual observations → database readback; isolated synthetic records only.

## Reuse and data safety

Reuse Tiptap 3, `protocol-tiptap.ts`, `protocol-execution.ts`, `run-step-content.ts`, existing Calculator `calculate` / `quantities.convert`, persistent step timer columns and event history. No separate editor, expression engine, unit registry, AI dependency or bulk historical rewrite.

Historical runs keep their captured source/legacy grouping. A changed active plan requires a reviewed difference; affected recorded work must remain in its previous execution instance. Submitted/reviewed records remain locked. Cross-device writes require expected revision checks and parent row locking.

## Representative interaction (Impeccable shape/adapt)

Author dimensions and explicit values in a compact disclosure alongside the existing document editor. Insert parameter references at the current selection; component editing must not remount the editor. All-system reading shows differences once with a shape and text as well as color. Execution starts with a preparation choice outside step numbering, then a persistent context strip and current operation. Missing choices explain the required input next to disabled actions. Other-system content remains inspectable without execution controls.

Reuse DESIGN.md and global tokens. Desktop keeps the document workbench; tablet and mobile reflow controls with local table scrolling, visible units and 44px primary touch targets. No forced mobile layout on desktop. No animation or color may suggest a choice was confirmed.

## Phases

P0 inventory, regression baseline, compatibility and project skills; P1 single-scope complete lifecycle. P2 multiple experimental groups, all editing entrances, immutable Entry-version links, complete exports/offline/conflicts/device notifications. P3 real watch execution and synchronization. Each item remains separately tracked in ACCEPTANCE.md; simulated device widths do not satisfy physical-device tests.

## Sources used for implementation

Installed Next.js 16.2.10 route-handler/server-action guides, local Tiptap source, and [Tiptap schema documentation](https://tiptap.dev/docs/editor/core-concepts/schema) (2026-10-14). Strict editor schemas require an explicit compatibility path; unrecognized content must not silently disappear.
