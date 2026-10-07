# Protocol → Experiment execution consistency

Baseline: `3264c0fcda1847d9091c6c3d1e948b35a5117147` (2026-10-07). Issue: #88.

Confirmed source of the reported extra controls: the former projection treated each top-level rich-text node and each checklist item as a separate `ProtocolStep`, then persisted those rows at creation. `PRT-100023` currently projected 36 entries; `EXP-007` captured an earlier document with 37. These are two different source snapshots, not an inconsistent counter. The frozen source preserves the dose table although it has no saved step row.

The canonical Protocol document now stores explicit source-block ownership (operation/detail/information), stable source IDs and an author confirmation flag. It projects into the existing `ProtocolStep`/`ExperimentStep` contract. Formatting provides a reviewable proposal only. No confirmed operation means no fabricated completion. The visible organizer persists decisions; existing frozen unmarked experiments retain their legacy projection.

Preview, Run and export read the same captured full blocks. Information has no completion checkbox; nested details stay with their operation. Exact leading generated titles are removed within the operation only. Repeated operations and different doses remain separate. Persistent creation keys prevent duplicate rows on request replay. Draft reordering changes ordinal fields, not instance IDs or execution evidence.

Library and historical repair CLIs default to dry-run, require every source block and saved step to have an explicit mapping, and save private originals/diffs. Library repairs create new draft versions; they do not grant scientific approval. Historical repairs are restricted to planned Drafts with no completion, running/paused timers, events or inventory transactions. The affected Draft is repaired from its own frozen source; newer library prose cannot replace it. Notes and related files retain provenance.

Reproduce on an isolated database whose name contains `protocol_consistency`: migrate, build/start on port 3332, seed synthetic fixtures, run `verify-protocol-consistency-db.ts` and `verify-protocol-consistency.mjs`. Local current-library audit uses a private production clone; CI uses synthetic fixtures and does not claim to audit private production records.

See `ACCEPTANCE.md` for the final results and explicit unexecuted cases. Six original DOCXs were found in managed attachments and fingerprint checked, including TRIzol. CCK-8 empty Steps/ResultTemplates/ConsumptionRules are recovered into a new Draft from its exact original. PRT-100008 rev1 original DOCX and physical device/printer testing remain unexecuted. Recovery with unresolved embedded images is rejected in dry-run and apply; use the existing reviewed image import pipeline.
