# Spec review — P0/P1

Boundary: `git diff 65500d2e940e1b861ac9ec78950eeb14c7292fdc`, including the 2026-10-14 working tree; HEAD `6776c7dca98d684adfd3740d0dd63b0a6617c932`. Read-only review and pure-function probes; no database mutations. Requirement references: [REQUIREMENTS.md](REQUIREMENTS.md).

## Correctness findings: closed

The Calculator history issue (requirements 162,173,186) is closed. `structured-protocol.ts:117–125,161–170` matches captured inputs/bindings/output/unit independently of engine version. A matching receipt supplies the adopted value. `ProtocolCalculationPreview.tsx:15–27` renders its notes/warnings/method without recomputation.

Independent reproduction: a completed step using a legacy fingerprint (`previous-method`, no bindings), confirmed **9.99 µL**, and prior warning now returns `Take 9.99 µL`, `blocked:false`, preserving method/warning. Changing target concentration from 10 to 20 µM returns `unknown`, without a reusable value.

Reviewed SHA-256: structured-protocol.ts `ea7fabf0bd2814a999400288abcacaa13d37155d35a9dd7531f7c3a3f8d338dd`; ProtocolCalculationPreview.tsx `abb694d65b6ee0758298b2d2392912cbd7bd5a508ea6c686310bd49bd70967e4`.

Earlier title-dependency, ambiguous-unit, continuation-history/start, rich-row-caption and local-preview findings remain closed. Display units and source units are explicitly separate; empty input stays missing.

## Remaining delivery boundaries

- **13.1:** author-report proves real empty-editor authoring, saving/reopening, Experiment creation and adopted 50 µL. Other browser runs cover completion/timer/continuation. Latest `34-browser.log` stops locating Resume; a final successful timer/result/readback run remains necessary. This is an unresolved acceptance result, not an independently reproduced new logic defect.
- **C01/C03/C07/C08/C10:** long-source authoring stopped because the properties panel intercepted Save; the revised test closes it but needs a successful rerun. Fixture: 70 background blocks, 4 images, 1 table; requirement asks multiple tables. Move/copy, deletion/undo and genuine IME need separate evidence; programmatic Chinese typing is not composition.
- **P0/F08:** `EDITOR-INVENTORY.txt` is a search listing. Complete route/field→editor→format→preview→result inventory and actual skill-use evidence. Remaining entrance migration belongs to P2.
- **F03/F04:** the earlier export 400 occurred requesting unsupported Experiment TSV. Mark unsupported, then inspect supported exports and rendered DOCX/PDF. File existence is insufficient.
- **E02/E03:** real iPhone/iPad input, touch/camera and lock-screen recovery remain unexecuted absent separate evidence. Desktop widths establish responsive views only. Multi-group/offline/Entry-version/watch work remains P2/P3.

UTC/Shanghai logs each report 624 passes. `32-db-lifecycle.log` and inspected script establish forged status-update rejection; these do not replace page evidence. No remaining code blocker or scope creep identified in this focused review. This is not unconditional P0/P1 acceptance or 49-item completion.
