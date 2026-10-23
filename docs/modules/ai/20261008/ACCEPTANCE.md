# AI provider adapters — release acceptance

Scope: `claude/ai-provider-adapters-20261008`, original commit `4f7eebfe6e666322a29da04c2e5ba8d3945a9f11`, based on main `461844ce7c088800d59f8f30937aa2f46dda8f35`.

This release adds provider configuration and connection tests, explicitly requested entry/workbench generation, and pending suggestion storage. The inbox displays suggestions; accept/edit/reject and business execution are **not implemented**. Protocol AI extraction and Studio AI assistance remain plans.

## Pre-release repairs

- Reject the public encryption placeholder; redact configured tokens before shortening upstream errors, including plain-text tokens crossing the 300-character display boundary. A public-adapter regression first failed then passed.
- Require same-origin JSON for generation and connection tests.
- Bound context and output sizes; validate schemas, requested action subset, nonempty payloads and AI attribution. Type-specific executable payload validation is deferred with the absent executor.
- Persist each client request once under a request lock and cache its response, including zero-action results.
- Publish pending suggestions only after locking and comparing the current source entry. Reject removed/changed sources; protect entries with AI suggestions from deletion.
- Preserve the HTTP-compatible request UUID fallback; retry definitive conflicts with a new request ID.
- Correct documentation to distinguish pending suggestions from executable actions.

Spec and Standards reviewers independently reread these changes; both report no remaining blocking code findings. Their reviews do not constitute browser or database acceptance.

## Verification

The submitted browser screenshots/report verify application code `dd18fb677b616abd71058e9ce0d22705a59349ce`; the final error-boundary repair is covered by an additional failing-then-passing unit regression and the extended mock browser script. Final-head browser/CI and deployed results will be recorded in RELEASE.md. Tests use synthetic entries, fake credentials and a local mock endpoint only. The dedicated database is `labnest_ai_provider_acceptance_20261008`; production records are not used as fixtures.

Repeatable commands: `npm run typecheck`, `npm run lint`, `TZ=Asia/Shanghai npm test`, `TZ=UTC npm test`, `npm run build`, and `DATABASE_URL=<isolated localhost database> node scripts/verify-ai-provider-adapters.mjs`. The browser script refuses other database names/hosts. CI workflow: `.github/workflows/ai-provider.yml`.

- [x] Shanghai and UTC each: 117 test files / 598 cases passed. TypeScript passed. Lint: zero errors, 12 existing warnings. Clean-source Docker production build passed.
- [x] Chromium and WebKit, 1440px desktop and 390px mobile: real Settings create/edit/disable/delete, connection test, blank-key credential preservation and encrypted DB readback.
- [x] Real entry button creates exactly two pending AI suggestions; DB readback and inbox display verified. Experiment count remains zero.
- [x] Concurrent same-ID requests call the model once and persist once; later retry replays. Empty results also replay. Changes/deletion during a held model call return 409 without writes. A stale deletion dialog cannot delete an entry with AI suggestions.
- [x] Foreign/missing Origin and text/plain requests are rejected before any model call. Malformed schema, 51 actions and types outside the requested subset return 422 without writes. An upstream error echoing the fake credential returns a redacted error.
- [x] Workbench submits only explicit synthetic text and writes no suggestions. OpenAI-compatible, Anthropic and Dify paths verified through real Settings and local mock HTTP. Mobile UUID fallback works with crypto.randomUUID removed.
- [x] Exact PR head CI, merge and deployed runtime passed. Final versions, fixed-commit CI links, screenshots and unchanged-data checks: [RELEASE.md](RELEASE.md).

Browser report: [28 checks, zero failures](evidence/browser/report.json); screenshots in the same directory. Unit/type/lint/build logs: [evidence/logs](evidence/logs). The first browser run stopped at a test selector that expected an exact label despite inline help text; corrected locator and complete rerun passed. This was not an application failure.

## Not executed

- Live OpenAI/compatible vendor, Anthropic or campus Dify authentication and model output; no user credential was supplied or real provider invoked.
- Physical phone/soft keyboard, actual mobile zoom and user trial. Browser mobile viewport evidence is not physical-device evidence.
- Pending action accept/edit/reject/execution, Protocol AI extraction and Studio AI assistance: not implemented in this branch.
