# Issue 36 branch audit

Audit base: `aa08448` (tree-equivalent to GitHub `main` after PR #35). Historical branches are evidence, not merge targets.

## Absorbed into the current base

- `codex/unified-document-toolbar`
- `codex/document-editor-hardening`
- `codex/document-workbench-motion`
- `codex/font-import-compatibility`
- `codex/toolbar-popover-visibility`
- `codex/contrast-actions-motion`
- `codex/split-cjk-latin-typography`
- `codex/traditional-contrast-themes`
- `codex/protocol-editor-ui-release`

Each tip is an ancestor of the audited base. No cherry-pick is required.

## Diverged and superseded

- `codex/toolbar-contrast-density`: its unique toolbar-sticky commit predates the current shared portal toolbar and is replaced by the Issue 36 workbench geometry.
- `codex/protocol-editor-wysiwyg-merge`: its four unique commits belong to the older Protocol-only editor tree. Current main already contains the compact searchable relations interface and later editor hardening; merging the branch would revert newer cross-module behavior.
- `codex/protocol-density-slice`: its seven unique commits are an earlier density prototype. The current centralized `--ln-*` token system and unified editor supersede the branch tree.
- `codex/protocol-editor-wysiwyg-followup`: its six branch-only commits are an older follow-up of the Protocol-only editor. Their intended toolbar, compactness, and WYSIWYG behavior is patch-equivalent to or superseded by the shared workbench in Issue 36; merging the historical commits would reintroduce obsolete component structure.

## Unrelated feature branches

Calculator, inventory, visualization, sequence, and palette branches were enumerated but are outside Issue 36. They are not merged into a document-editor repair because that would broaden scope and risk unrelated product regressions.

## Missing behavior migrated in Issue 36

- One shared formatting and popover interface for all Tiptap adapters.
- Named insert capability profiles rather than incompatible action-ID filtering.
- A real Fit geometry calculation and zoom-independent toolbar.
- Complete supported CJK/Latin font catalog plus browser-local imported families.
- Compact Research Plan protocol/record counts with concrete linked-record dialogs.
- Flattened document-property surfaces and centralized density parameters.
