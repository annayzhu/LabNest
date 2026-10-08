# AI provider adapters — release acceptance

Scope: `claude/ai-provider-adapters-20261008`, original commit `4f7eebfe6e666322a29da04c2e5ba8d3945a9f11`, based on main `461844ce7c088800d59f8f30937aa2f46dda8f35`.

This release adds provider configuration and connection tests, explicitly requested entry/workbench generation, and pending suggestion storage. The inbox displays suggestions; accept/edit/reject and business execution are **not implemented**. Protocol AI extraction and Studio AI assistance remain plans.

## Pre-release repairs

- Reject the public encryption placeholder; redact configured tokens in upstream errors.
- Require same-origin JSON for generation and connection tests.
- Bound context and output sizes; validate schemas, requested action subset, nonempty payloads and AI attribution. Type-specific executable payload validation is deferred with the absent executor.
- Persist each client request once under a request lock and cache its response, including zero-action results.
- Publish pending suggestions only after locking and comparing the current source entry. Reject removed/changed sources; protect entries with AI suggestions from deletion.
- Preserve the HTTP-compatible request UUID fallback; retry definitive conflicts with a new request ID.
- Correct documentation to distinguish pending suggestions from executable actions.

Spec and Standards reviewers independently reread these changes; both report no remaining blocking code findings. Their reviews do not constitute browser or database acceptance.

## Verification

Final version and results are recorded after the isolated acceptance run. Tests use synthetic entries, fake credentials and a local mock endpoint only. The dedicated database is `labnest_ai_provider_acceptance_20261008`; production records are not used as fixtures.

Repeatable commands: `npm run typecheck`, `npm run lint`, `TZ=Asia/Shanghai npm test`, `TZ=UTC npm test`, `npm run build`, and `DATABASE_URL=<isolated localhost database> node scripts/verify-ai-provider-adapters.mjs`. The browser script refuses other database names/hosts. CI workflow: `.github/workflows/ai-provider.yml`.

- [ ] Final dual-timezone unit tests, TypeScript, lint and production build.
- [ ] Chromium and WebKit desktop/mobile real Settings CRUD, connection, blank-key preservation and encrypted DB readback.
- [ ] Explicit entry generation, pending DB readback and inbox display; no Experiment creation.
- [ ] Concurrent/ambiguous retries, empty-result replay, source modification/deletion and stale deletion dialog protection.
- [ ] Same-origin/JSON rejection, malformed/oversized/disallowed output rejection, upstream-token redaction.
- [ ] Explicit workbench context, three protocol adapters, mobile HTTP UUID fallback.
- [ ] Exact PR head CI, merge and deployed runtime.

## Not executed

- Live OpenAI/compatible vendor, Anthropic or campus Dify authentication and model output; no user credential was supplied or real provider invoked.
- Physical phone/soft keyboard, actual mobile zoom and user trial. Browser mobile viewport evidence is not physical-device evidence.
- Pending action accept/edit/reject/execution, Protocol AI extraction and Studio AI assistance: not implemented in this branch.
