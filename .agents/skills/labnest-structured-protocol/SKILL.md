---
name: labnest-structured-protocol
description: Use when changing LabNest Protocol structure, system dimensions, conditional parameters or content, execution progress, frozen snapshots, migration, or experiment instances. Verify the repository contract and public behavioral seams before changing runtime semantics.
---

# LabNest Structured Protocol

Resolve the repository root from this project's `.agents/skills` location. Read `docs/modules/structured-protocol/20261014/CONTRACT.md`, `CONTEXT.md` and the applicable requirements sections 4–8 and 13. These files and the implementation are authoritative; do not copy their rules into a second schema.

Inspect the affected path through `src/lib/protocol-document.ts`, `protocol-tiptap.ts`, `protocol-execution.ts`, `structured-protocol.ts`, `experiments.ts`, `run-step-content.ts`, the Protocol edit actions, and Run write actions. Record the current commit and the actual serialized schema. Stable IDs and captured source ownership must survive every changed boundary.

Use the user-confirmed public tests in `src/lib/structured-protocol.test.ts` and isolated synthetic persistence/browser fixtures. The baseline lookup example is 350/600 µL giving 50/80 µL Proteinase K, never inferred proportional scaling. Also exercise unknown sample properties, conflicting lookup rows, independent conditions, illegal combinations, unit mismatch and stale writes. Reuse Calculator quantities and formulas.

Before changing selection or progress, inspect recorded effects, active timers and the expected revision. Verify history and per-instance isolation after refresh. Keep old records on their captured/legacy path; never silently migrate or update formal data. Read the requirement's phase boundaries before claiming offline, multi-group or device support.

Update the single acceptance matrix with source paths, tested commit, logs, actual screenshots and unexecuted real-device checks. PR merge is not a functional test.
