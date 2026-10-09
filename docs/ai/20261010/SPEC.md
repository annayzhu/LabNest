# LabNest Protocol AI and DeepSeek release

User authorization (2026-10-10): optimize the reviewed AI work, add DeepSeek, merge and deploy; the user will test with their own real API.
Base: current main 54ffc66275f8c83a8c3dfd0fdafff769acf144f0. Protocol implementation to retain: b951c5ae, 07a2a8b8.

- Preserve prior main features, real records, attachments, existing provider preferences, encrypted key storage, explicit opt-in and human selection.
- Complete delivery of the existing Protocol DOCX extraction flow: original evidence, validated and signed proposals, selected items only, no automatic inventory or experiment execution.
- Add a visible DeepSeek preset with official URL, editable model, and the existing OpenAI-compatible adapter. No new database provider enum or parallel AI system.
- Regress protocol import security and selected-item persistence using an isolated database and synthetic data/mock responses. The user's real key is never part of tests or commits.
- Keep Studio independently owned/deployed and opened through LabNest's existing link; do not pass data or keys in navigation.
- Typecheck, lint, production build, two time zones and browser acceptance before merge; verify production data preservation and routes after deployment. Report missing evidence explicitly.
