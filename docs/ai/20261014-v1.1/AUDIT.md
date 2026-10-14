# AI connection testing v1.1

Baseline main and formal container: `260fd749778dcc809ef8e1ea68106412435415cc`, workspace `/Users/annayzhu/Documents/Playground/LabNest`, branch `codex/ai-connection-test-20261014`. The original migration in PR96 is retained; its field mapping and call inventory remain in `../20261014/AUDIT.md`. No schema or account-scope migration is planned. Studio remains independent.

The new attachment is v1.1. Confirmed gaps: no draft-form test; model-list responses incorrectly mean success; English API fields; changed targets can reuse a saved key. New tests observe the public adapter `testConnection`, the existing/specified HTTP test endpoints, and the actual add/edit/card forms. These are the interfaces explicitly requested in §4.4 and E03–E09, extending the previously agreed AI seams. Only external provider responses are mocked; persistence/browser tests use an isolated synthetic database.

Implementation boundary: one shared provider-input contract and target identity, existing encrypted storage, existing adapters and persisted settings gate. A draft test never saves a provider, changes defaults, or writes business records. Blank saved keys are reusable only for the same provider revision, protocol and canonical base URL. Provider settings, master switch and request cancellation continue to protect each request independently.

Skills actually loaded/applied: Matt Pocock `implement`, `tdd`, `domain-modeling`, `code-review` (installed files have no declared version; source hashes recorded with delivery); Ponytail full (no declared version), using existing adapters/gates/native controls without new dependencies; Impeccable 4.1.1 `harden` and craft-floor, preserving LabNest tokens and providing Chinese labels, bounded status, accessible validation and responsive fields. The existing session context and PRODUCT/DESIGN guidance are reused. Next 16.2.10 installed route-handler and form guides read before changes.

Official DeepSeek docs checked 2026-10-14: https://api-docs.deepseek.com/ lists `https://api.deepseek.com`, `deepseek-flash`, and `deepseek-v4-pro`. Keep the existing flash preset and allow an exact editable ID. The error-code page could not be retrieved in this environment; classification is verified with explicit protocol/status/error-code fixtures and must not be described as a real account test.

Real paid providers, account balance and private keys are not used. Formal deployment verification is read-only. Cleanup will be re-audited after release, retaining unique work, data volumes and a current rollback backup.
