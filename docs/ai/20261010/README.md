# DeepSeek connection and Protocol AI delivery

Date: 2026-10-10. Requirements: SPEC.md. Existing Protocol implementation is retained; the pending-action executor is not added.

## Connect after deployment

1. Settings → Model providers → Use DeepSeek / 使用 DeepSeek.
2. The preset selects the existing OpenAI-compatible adapter, `https://api.deepseek.com`, and `deepseek-flash`. Enter your own API key and save. The model remains editable; use one available to your account.
3. Enable AI access, choose this provider as default, save, then Test connection.
4. Protocols → Import → upload a synthetic/de-identified DOCX → Preview mapping → Extract with AI. Review source evidence and selection before Confirm import.

Defaults were checked against https://api-docs.deepseek.com/ on 2026-10-10. No real model call has been made for this release. Test connection checks connectivity; it is not evidence of extraction quality.

Studio has its own model settings, with a DeepSeek preset. LabNest's navigation link does not transmit records or credentials to it.

## Verification status

- PASS: TypeScript; lint (0 errors, 12 existing warnings); Shanghai and UTC unit tests (118 files / 612 tests each).
- PASS: synthetic DeepSeek model-list and chat requests reuse the compatible adapter and produce pending actions. See evidence/deepseek-green.log.
- PENDING: current browser validation, merge, deployment and production readback. CI workflow protocol-ai-extraction.yml runs the existing isolated DOCX flow and also checks the preset fields before substituting a mock endpoint.
- PASS: separate Next production webpack build, using versioned generated calculator assets.
- Local canonical npm build was blocked by tsx's IPC socket permission; separate Next production build status will be recorded. Do not call the canonical build passed until CI or an authorized local rerun completes it.
- NOT EXECUTED: real DeepSeek quality/speed, physical-phone validation and user trial. User will connect the real API.

Earlier 2026-10-09 browser evidence uses the earlier code and a mock. It is retained as historical evidence, not proof of the current deployment.


## Review fixes before release

- Confirmed formulas are checked again using only accepted parameters; missing dependencies and unknown IDs reject the whole confirmation before creating a Protocol.
- Parameter defaults must match their types and select options.
- Evidence must match the complete quoted text after whitespace normalization; decimal points and signs remain significant. A match establishes that text exists, not that an AI inference is scientifically correct.
- Accepted rules, result fields and step attributes now update the canonical rich document before generating database projections. Media/source blocks remain; unreviewed step ownership stays unconfirmed.
- Same-template same-key result corrections replace the prior field; omitted inventory-selection attributes preserve the existing value.
- Six new integrity regressions pass. Browser coverage now includes rejected dependency selections and edit/save/database readback, but has not run on this revision yet.

## Execution environment block

The automatic permission reviewer timed out twice for the Studio GitHub tree write and twice for local browser/server execution. No PR, merge or production change has occurred. This is not a security finding and not a functional pass. Unit tests and Next builds ran inside the permitted workspace. Resume from these local Git histories after runtime/GitHub write permissions are available; do not replace the original dirty worktrees.
