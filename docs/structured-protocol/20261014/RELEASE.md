# PR97 follow-up release

Application source: `6db0fd869515e9e4e3d4ab2f42916b752f698dd4`, based on main `15faef6c7a3b63dbdf66f98f16aa7ee1885fb99a`. Candidate image `labnest-app:protocol-followup-6db0fd86` was built from the committed Git tree and served against an isolated database on port3341. No secret environment file was packaged.

## Completed local acceptance

- UTC and Asia/Shanghai each653 tests/125 files; TypeScript passed; lint0errors and12existing warnings. Production Alpine/webpack build passed.
- Actual container pages: original9 lifecycle cases,2 author cases,3 media cases; new3 multi-group/entry-point/copy cases, long editor continuous typing/table paste,3 offline/clock/legacy cases,2 Entry freeze/conflict cases; direct transaction/database readback and replay checks. Six editor routes plus result-template instructions and desktop/mobile Run image paths pass. Logs and individual assertions are in followup-evidence/validation.json and reports; these counts do not replace the49-item matrix.
-18PDFs/31pages visually inspected, including converted DOCX, multi-system template, Protocol/experiment print and editor/template paths. Chinese, quantities, source, tables and images are visible. CJK rendering initially required explicit font configuration; this is recorded as a rendering-environment correction.
- New real container acceptance caught403 on legacy copy/reorder routes. They now reuse the existing Host/Origin guard; both failing tests were observed before the fix and pass after. Final container copy and reordered legacy offline timer/note/photo/completion pass. Foreign origins still rejected.
- Native Watch unsigned build and shared server API tests pass. User screenshot confirms watchOS26.5 simulator download in progress; no physical watch version inferred. At that earlier cutoff no runtime was available; the additional simulator validation below supersedes that runtime observation only.

## Boundaries

ACCEPTANCE.md:40passed,0current failures,9unexecuted composite physical-device requirements. No paid model evaluation, physical IME/camera/lockscreen/160%zoom, actual Watch installation/notifications, original private incident record or physical printer test. Web Push is not enabled; current local LAN HTTP does not prove mobile offline/notification support. Web deployment does not install the native watch app.

## Merge/deployment gate

PR creation, remote CI, merge and formal deployment follow this local evidence commit. Their final receipts will be attached to the PR and saved in the local deployment report. Formal rollout preserves the existing environment, database and attachment volume, compares every table field and file hash, and uses the exact tested application layers with a final merge label.

## CI corrections and final candidate

Web application source `603067b8c2caacb6f3b96674f4a35b37e9164e78`; production image `labnest-app:protocol-followup-603067b8`, manifest `sha256:9f41df886404da047b66e2c935f761f051aa7d160371f06b3eb8545648d41a8b`. Native source `c73febadacef8424644770107d7b96f9e869a07e` is built and tested separately; web deployment does not install it.

The first CI pass found two issues. AI destination links triggered background RSC prefetch, violating the existing no-record-prefetch contract; all four links now disable prefetch. The clipboard test selected the last paragraph inside an existing table, so pasted a nested table on Linux; it now targets a standalone prose paragraph and explicit caret. Row/column assertions remain unchanged. Local Chromium/WebKit at1440/390 confirm no background request and successful explicit navigation; the fresh representative editor paste/save/reopen case passes. Evidence: followup-evidence/ci-fixes. Remote corrected runs [AI provider](https://github.com/annayzhu/LabNest/actions/runs/38544998102) and [Protocol consistency](https://github.com/annayzhu/LabNest/actions/runs/38544998140) passed on603067b8. Final-head CI remains a merge gate.

## Additional native simulator evidence

watchOS26.5 is now available. The Series11(46mm) simulator passed native installation, Run-code pairing, full quantity display, explicit completion, timer start/pause, restart, offline pending persistence and reconnect with one DB event. A collapsed wheel picker was fixed to a full-screen selection list; signing failures now have an actionable Chinese message. Keychain testing used a simulator-only app identifier, never a real signing account. Screenshots/build log/DB readback are in followup-evidence/watch-simulator. Physical Watch installation, Dynamic Type and lockscreen notification delivery remain unexecuted;49-item totals remain40passed/9unexecuted composite requirements.
