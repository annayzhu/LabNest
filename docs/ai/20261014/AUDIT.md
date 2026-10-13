# AI module migration audit — 2026-10-14

Baseline main / production: `c79a5fc21a56a9c156cd2356f19fbd79789c18ae`.
Development checkout: `.local-runtime/labnest-ai-deepseek-20261010`, branch `codex/ai-module-migration-20261014`.
Production: Docker `labnest-app`, port 3001; independent Studio port 3400 is outside this migration.

## Existing scope and routes

- `Sidebar.tsx` shares desktop/mobile utility items: AI review → `/actions`. The page reads real `ProposedAction` records. It has filters and a manual workbench; proposal execution controls are explicitly not implemented. Preserve records/list and manual workflows, do not claim an existing approval executor.
- New `/ai` is the primary management entry. `/actions` without filters redirects there; `/actions/review` preserves the record list. Existing status/type links redirect to the filtered list. `/actions/manual` remains functional.
- `/settings?provider=…`, `#ai-access`, `#providers` keep provider selection/anchor compatibility. Settings retains only a lightweight AI link; non-AI appearance, typography, backup and reference connectors stay.
- Existing settings are deployment/workspace-wide: singleton PostgreSQL `AISettings.id=default`, not browser or per-user. No authentication/role system exists for these settings. Preserve that scope; validate same-origin mutations; do not introduce accounts.
- Keys use existing AES-GCM encryption via `LABNEST_AI_ENCRYPTION_KEY`; never return stored ciphertext or plaintext to the browser. No schema/storage-key migration is needed.

## Complete field mapping

| Existing value | New home | Save behavior |
|---|---|---|
| AISettings.enabled (default false) | `/ai` Enable AI switch | Immediate, enabled-only patch; compare saved revision; failure rollback |
| defaultProviderId | `/ai` Function settings | Explicit save, independent of switch |
| attachmentsEnabled (default false) | `/ai` Function settings | Preserve even when AI is off; explicit save |
| externalDataPolicy=explicit_context | `/ai` scope/help text | Preserve; not expanded to project-wide upload |
| Provider name, type, baseUrl, defaultModel | `/ai#providers` existing provider editor | Existing explicit save and validation |
| Provider API key, capabilitiesJson | Same encrypted provider row and type-derived capabilities | Existing encryption/blank-key preservation; never export secrets |
| Provider enabled / disable / delete | `/ai#providers` existing provider controls | Existing separate provider state; no forced re-enable |

The prior settings form clears defaultProviderId and attachmentsEnabled on disable. This will be corrected by separate switch/config mutations.

## Actual call paths and test seams

The supplied specification explicitly requests tests at these boundaries: rendered pages, settings persistence HTTP interface, and existing AI request interfaces. Use these seams for red/green regressions.

- `POST /api/ai/generate`: Entry button and Manual workbench; model result may create pending suggestions only with explicit persistence request.
- `POST /api/ai/protocol-extraction`: previewed Protocol document, suggestions only, manual import confirmation later.
- `POST /api/ai/providers/:id/test`: explicit connection test.
- `POST /api/ai/manual/prompt`, `/parse`: local prompt/output handling, already gated by AI switch.
- Shared connected adapter resolution is `src/lib/ai-server.ts`. Add persisted revision checks before dispatch and publication; abort in-flight HTTP when disabled/config changed, and reject late responses.
- `saveAIProposals` serializes duplicate requests with advisory locks. Recheck inside queued generation and lock/recheck settings before publishing. No background AI scheduler or automatic retry worker exists. Provider connection fallback must also pass the shared gate.
- Browser state refreshes from the same DB-backed endpoint on focus/visibility and same-origin change notification. Draft settings are independent of saved switch state.

## Acceptance boundaries

Use isolated PostgreSQL and synthetic old settings / entries / Protocols. Local mock provider validates actual HTTP paths and cancellation, not scientific output quality or a real paid model. Real external API success remains unverified unless a user-provided test key is explicitly available for this task. Production checks remain read-only. Cleanup follows merge/deployment and an audited list of recoverable old copies/build caches; preserve live deployments, unique local work, data volumes and current recovery backup.
