# PR97 follow-up release

Application source: `6db0fd869515e9e4e3d4ab2f42916b752f698dd4`, based on main `15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a`. Candidate image `labnest-app:protocol-followup-6db0fd86` was built from the committed Git tree and served against an isolated database on port3341. No secret environment file was packaged.

## Completed local acceptance

- UTC and Asia/Shanghai each653 tests/125 files; TypeScript passed; lint0errors and12existing warnings. Production Alpine/webpack build passed.
- Actual container pages: original9 lifecycle cases,2 author cases,3 media cases; new3 multi-group/entry-point/copy cases, long editor continuous typing/table paste,3 offline/clock/legacy cases,2 Entry freeze/conflict cases; direct transaction/database readback and replay checks. Six editor routes plus result-template instructions and desktop/mobile Run image paths pass. Logs and individual assertions are in followup-evidence/validation.json and reports; these counts do not replace the49-item matrix.
-18PDFs/31pages visually inspected, including converted DOCX, multi-system template, Protocol/experiment print and editor/template paths. Chinese, quantities, source, tables and images are visible. CJK rendering initially required explicit font configuration; this is recorded as a rendering-environment correction.
- New real container acceptance caught403 on legacy copy/reorder routes. They now reuse the existing Host/Origin guard; both failing tests were observed before the fix and pass after. Final container copy and reordered legacy offline timer/note/photo/completion pass. Foreign origins still rejected.
- Native Watch unsigned build and shared server API tests pass. User screenshot confirms watchOS26.5 simulator download in progress; no physical watch version inferred. No attached iPhone/Watch or installed watchOS runtime was discovered at evidence cutoff.

## Boundaries

ACCEPTANCE.md:40passed,0current failures,9unexecuted composite physical-device requirements. No paid model evaluation, physical IME/camera/lockscreen/160%zoom, actual Watch installation/notifications, original private incident record or physical printer test. Web Push is not enabled; current local LAN HTTP does not prove mobile offline/notification support. Web deployment does not install the native watch app.

## Merge/deployment gate

PR creation, remote CI, merge and formal deployment follow this local evidence commit. Their final receipts will be attached to the PR and saved in the local deployment report. Formal rollout preserves the existing environment, database and attachment volume, compares every table field and file hash, and uses the exact tested application layers with a final merge label.
