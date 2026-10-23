# Protocol import state and historical warnings — Issue #60

## Policy

Every supported Protocol import (DOCX, JSON/batch, Markdown, legacy form) uses the unified preview/confirmation flow and persists availability Draft and scientific review Draft independently. Source declarations remain evidence, not permission to activate or approve. Later changes use the existing Protocol workflow.

The signed confirmation binds filename, source SHA-256, module, format, per-row state decisions and a 30-minute expiry. Confirmation reparses and revalidates the original file; the transaction checks the decision again and serializes duplicate sources.

New imports have immutable ActivityLog evidence linked to the source attachment and target version. Old recognized availability conflicts are archived by `scripts/backfill-protocol-import-history.ts` during Docker startup. It appends deterministic audit records with an empty upsert update, preserving original text and unknown resolution. No Protocol, version, or Run snapshot is updated. The historical import time is kept separate from the archival event time.

## Verification

- Full unit suite: 95 files, 540 tests passed.
- Deployment follow-up: reproduced UTC-container/Asia-Shanghai-browser hydration mismatch in the history timestamp; fixed with explicitly labelled UTC display. Two timestamp regression tests cover bilingual formatting and invalid/missing historical dates. Browser tests explicitly use Asia/Shanghai against a UTC server.
- TypeScript checking and production build are release gates.
- `scripts/verify-protocol-import-state.ts`: isolated API + PostgreSQL + browser acceptance. Covers state mismatch, consistent exported state, invalid/missing declarations, DOCX/JSON batch/Markdown, real Draft/Draft persistence, forged actor/state/confirmation and changed file/filename rejection, duplicate/concurrent submission, normal later activation with unchanged history, export/reimport with a new identity, existing-identity duplicate protection, additive legacy backfill idempotence, retained unrelated warnings and unchanged version/current state.
- `scripts/verify-protocol-import-ui.ts`: Chinese desktop (1440px) and English mobile (390px), actual file chooser/preview, explicit source/final state comparison, default-collapsed Metadata history, expansion, no horizontal overflow or browser errors.
- Impeccable targeted detector: no findings in the two new components. The existing visual system is retained; history uses one compact disclosure, without adding a nested card.
- Standards and Spec reviews: archive survivability and persisted-JSON validation findings corrected. The operator limitation below remains explicit.

The acceptance scripts refuse the production database/port. Run the development server on 127.0.0.1:3210 with the dedicated `labnest_import60_acceptance` database, then run the two scripts with the same DATABASE_URL. They create clearly named acceptance records only in that isolated database.

## Identity limitation

The current application has no authenticated-user resolver. Actor is therefore server-recorded as null and shown as unidentified; uploaded/client-supplied identity is never trusted. Capturing a real authenticated operator requires an authentication feature, not an inferred username. No past user confirmation is fabricated.

## Deployment safety

Before deploying, take a database backup and compare hashes/counts of Protocol, ProtocolVersion, ProtocolRun and ExperimentProtocolVersion before/after the archival startup task. Preserve the existing PostgreSQL and attachment volumes. Verify the running container and LAN URL, not merely the Git checkout.
