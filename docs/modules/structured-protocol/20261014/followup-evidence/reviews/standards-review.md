## Standards

Reviewed commit `0e4136ee` against `15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a` using `git diff 15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a...HEAD`. Read AGENTS.md, local issue-tracker instructions, both project skills and CONTRACT/CONTEXT. No source edits; tooling-enforced formatting/types omitted.

### Documented-standard breach

**P1 — Legacy offline completions now fail source validation.** `CONTRACT.md` requires historical Runs to retain their captured/legacy path; the structured-protocol skill requires stable captured-source ownership across boundaries. New `ProtocolRunProgressForm.tsx:148` queues `sourceRef=stepId` whenever `structured.steps[stepId]` is absent. New `api/mobile/step-completions/route.ts:42` nevertheless compares it to `step.protocolStepRef ?? step.id`. Ordinary Protocol-derived steps have `versionId:source_ref` (`experiment-planning.ts:106`); manual steps have `manual:1` (`experiments.ts:148`). Thus an ordinary/legacy Run completed offline is rejected after reconnect despite unchanged provenance. Pass the actual captured protocolStepRef through RunStep, or explicitly preserve the legacy contract. Add an isolated ordinary-Run offline regression.

### Concrete safety defect (not a naming/style rule)

**P1 — Watch credentials are not bound to their issuing server.** `native/LabNestWatch/WatchModel.swift:55–65` resolves every request against mutable `baseURL` and attaches the existing Bearer token; `:77` does this even for pairing. `LabNestWatchApp.swift:19–21` lets an already paired user enter another server, while the old credential remains. Switching server A→B and clicking Pair (or foreground refresh while editing) transmits A's experiment credential to B before successful re-pairing. This contradicts the documented scoped/trusted-workspace security boundary in the native README. Bind the credential to its origin, send pairing unauthenticated, and prevent old snapshot/queued operations from using an edited destination.

### Judgement-only smell

**Possible Primitive Obsession:** scoped source identities are assembled/split as strings in `structured-run.ts`, `structured-run.server.ts:120`, `StructuredStepRecord.tsx:69`, and `ProtocolRunProgressForm.tsx:148`. A small shared source/scope formatter/parser would reduce inconsistent fallback semantics; this is a heuristic, not a mandatory repository rule.

Summary: one documented compatibility breach, one concrete credential-safety defect, one optional smell. No claim of full behavioral validation or real-device testing.
