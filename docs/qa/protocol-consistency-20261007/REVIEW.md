# Independent review of 62e6f57c against 3264c0fc

## Standards

The independent reviewer reported four documented defects: parent-only historical repair locking did not coordinate timer writes; private backups omitted original Entry/Result step bindings; merged notes omitted deviationAt; plain-title deduplication could delete subscript/link semantics or rich body formatting. It also suggested extracting duplicated explicit mapping validation as a possible code smell, not a hard violation. Frozen legacy projection is intentional compatibility code.

Corrections: timer mutations share the parent lock; repair also locks all saved step rows; backups include exact Entry/Result bindings; single-source note timestamps transfer and multiple-note text preserves each actual timestamp; conflicting deviation categories require manual review. Deduplication retains semantic marks, and audited prefix trimming preserves the remaining rich runs.

## Spec

The independent reviewer confirmed three defects: paragraph childContent could create two steps with one source ID during editor roundtrip; visible Word XML lost formatted text/checklist bodies despite metadata roundtrip; a documentation-only Protocol in a mixed experiment was missing from Run reference UI.

Corrections: child nodes retain their source block and parent ownership through editor serialization; Word renders formatted blocks, nested text, scripts and real hyperlink relationships; Run reference navigation traverses every frozen version independently of progress groups. New tests and browser checks cover these paths.

Original review total: Standards 4 documented findings plus 1 heuristic; Spec 3 implementation findings. Follow-up verification is recorded in ACCEPTANCE.md. The axes remain separate; test totals do not replace either review.

## Follow-up review

Standards: the ordinary progress action also locks the parent before its first read; semantic marks inside a generated title prefix are preserved; dry-run and apply consistently reject recovery with unresolved embedded media. The reviewer found no remaining defect in this corrected scope. Concurrency was verified by lock-order inspection, not race injection.

Spec: additional heading-owned multi-paragraph/nested cases exposed another split and title duplication. Corrected in ee6cfbeb and 5a57bdd0: one stable source ID, only exact first generated title text removed, children and all following paragraphs retained. The reviewer confirmed rich_text/text/heading cases and scientific scripts/links/code preservation, with no remaining finding in that scope. Final real browser results are separate in ACCEPTANCE.md and browser-report.json.
