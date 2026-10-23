# Standards review — structured Protocol

- Reviewed baseline: `65500d2e940e1b861ac9ec78950eeb14c7292fdc`.
- Reviewed implementation: `6776c7dca98d684adfd3740d0dd63b0a6617c932` plus the working-tree corrections present on 2026-10-14.
- Sources: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/development/agents/domain.md`, `CONTRACT.md`, the two project skills, ADR-0003, and the installed Next.js Server Actions guide.
- This is a read-only code review except for this report. It is not a browser, device, deployment or full regression pass. In-progress browser evidence remains unverified here.

## Lifecycle finding — closed after focused re-review

**Previously P1 — The general Experiment editor bypassed the new execution lifecycle.**

The earlier path allowed a recorded structured execution to change `completed` → `running`, or an incomplete execution to change `planned` → `completed`, through the general document form. This conflicted with the documented ownership: “Completion belongs to Run actions.”

The correction is now independently inspected:

- `src/app/experiments/actions.ts:112–117` obtains the parent lock, rereads the persisted snapshot/run/steps and rejects any submitted status different from the persisted status when the snapshot has systems. The decision uses server data rather than a hidden client flag. The transaction rolls back on rejection.
- `src/components/ExperimentForm.tsx` renders the execution status as read-only for structured executions, while retaining the current hidden value. A forged form is still rejected by the server guard.
- `src/lib/experiments.ts:97` rejects new structured executions whose initial status is not `planned`; the new-page picker carries `hasSystems` to the form.
- `scripts/verify-structured-run-transactions.ts` invokes the actual `updateExperiment` public action for both `planned` → `completed` and `completed` → `running`, checks the specific guard error, and reads back the unchanged persisted status. Its dedicated synthetic-database check precedes writes.
- Existing execution evidence [32-db-lifecycle.log](evidence/32-db-lifecycle.log) completes successfully. The reviewer inspected the assertions and log; the log was generated after the script modification. This review did not independently rerun the database script. Its PostgreSQL deprecation warning is recorded, not suppressed.

The lifecycle bypass finding is closed. The new-creation non-planned guard is confirmed statically; this focused review does not claim a separate runtime test of that branch.

## Earlier findings: corrections inspected

1. **Stale whole-form writes:** execution saves, timer writes and mobile completions now advance the shared execution revision inside the Experiment lock. This addresses the inspected lost-update path. The actual two-window behavioral test is still required.
2. **First Organizer split:** missing original IDs are now detected and the Steps section is replaced transactionally; the editor remains mounted. The prior static identity mismatch is addressed. First organization → further typing → save/readback and selection/undo preservation still require browser evidence.
3. **Units and blanks:** display units are now separate from source quantity units; empty numeric inputs persist as `null` and resolve unknown. The inspected 50 µL/0.05 mL mislabel path is addressed.
4. **Whole-form event IDs (found during re-review):** a UUID previously reused across all changed step events would violate the unique index when saving two steps together. The current correction writes it only for explicit single-step requests; whole-form replay is guarded by revision. Two-step save evidence is pending.

## Judgment-based smells

No additional smell-only finding is raised. Reuse of the existing document schema, Calculator engine, quantity conversion, snapshots, timers and events is visible; introducing a second implementation was avoided. Dense UI mappings merit future readability work but are not classified as release blockers without a demonstrated failure.

## Review boundary

No remaining confirmed P0, P1 or P2 finding in this Standards review. This is bounded to the inspected changes and follow-up corrections, not a claim that all phased requirements pass. Static correction review and the inspected lifecycle log do not establish acceptance for the remaining checklist items, physical devices, or replace the separate Spec-axis review. The browser checks noted above remain outside this reviewer’s independently executed evidence.
