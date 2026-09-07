# Shared document media — Issue #63

## Page coverage inventory

| Surface | Editing route / module | Persisted representation | Read-only / execution path | Status |
|---|---|---|---|---|
| Protocol | new; version edit / ProtocolWysiwygEditor | ProtocolDocument and immutable versions | ProtocolDocumentView; Run snapshots | PASS import creation, edit/paste/save/reload/re-edit/read-only; manual new form not separately exercised |
| Research plan | new; edit / ScientificDocumentEditor | ScientificDocument | ScientificBlockView | PASS new form/paste/save/reload; multi-drop while typing; PDF and Markdown export |
| Experiment body | new; edit / ScientificDocumentEditor | ScientificDocument | ScientificBlockView; execution view | PASS edit/paste/save/reload/re-edit/read-only; fixture created through service, new form not separately exercised |
| Entry / quick capture | new; edit / EntryComposer + MarkdownRichTextEditor | Markdown + entry attachments | Markdown rendering; EntryMediaGrid | PASS new/edit, audio picker, quick-capture mobile viewport, failed/retry, reload/reselect, save/read-only |
| Result | new; edit / ScientificDocumentEditor | ScientificDocument + Result sources | ScientificBlockView | PASS edit/paste/save/reload/re-edit/read-only; new form not separately exercised |
| Report | create; edit / ScientificDocumentEditor | ScientificDocument | Report preview / print / Markdown export | PASS edit/paste/save/reload/re-edit/read-only; generated-report creation not separately exercised |
| Run | ProtocolRunProgressForm; locked rich-text instruction blocks | detached snapshots; execution notes | ProtocolContentBlockView | PASS detached Protocol image display after later Protocol edits |
| Nested rich-text instructions | ResultTemplateConfigEditor / ProtocolRichTextEditor | ProtocolRichTextNode arrays | rich-text instruction render | PASS Word import/re-export embeds instruction and table images; decoded instruction image in browser |
| Attachments | shared upload; preview; download; unlink | originals + AttachmentLink | attachment detail | PASS preview, original retrieval, audio playback/no autoplay, offline ZIP, unlink and concurrent save/delete |

Run's currently editable deviation/impact/quick-note fields are plain text, not rich-text document regions; keep simple fields unchanged. Run's formatted instructions and media snapshots must render shared media correctly. Recheck for other rich-text recording routes before closing the matrix.

## Confirmed acceptance seams

User confirmed: actual editor-to-record workflows; attachment preview/download/reference removal; Markdown/Word/PDF import-export. Use isolated fixtures, real save/read interfaces and visible image assertions. Database-only URL checks do not count as acceptance. Record physical phone camera/system-picker checks not executed separately from mobile viewport automation.

## Safety

Preserve existing dirty worktree and source data. No unsolicited remote-image fetch. Pending blob URLs live only in transient memory. Unlink never deletes originals; physical deletion checks persisted references and immutable snapshots. Resizing changes presentation, not original bytes.

## Executed evidence (2026-09-07)

- `verify-document-media.mjs`: real new Research Plan screenshot paste, decoded stored image, save/reload, formal link, separate thumbnail, unlink preserves original.
- `verify-document-media-pages.ts`: Protocol, Experiment, Result, Report, Entry edits through actual buttons; Run detached image; replacement/caption/display-width and unlink preservation.
- `verify-document-media-mobile.mjs`: iPhone-sized Quick capture, failed local preview, reload recovery via native file chooser, saved image after refresh. Earlier iteration also passed retry without reload.
- `verify-document-media-order.mjs`: two simultaneous dropped images; source order, caption edited during upload and continuing text survive completion.
- `verify-document-media-audio.mjs`: actual Insert file chooser; Chinese filename; saved named link; one-second WAV plays only on attachment page; ZIP bytes equal original.
- `verify-document-media-concurrency.mjs`: eight concurrent record-save/original-delete attempts; both cannot succeed; accepted records retain accessible files.
- `verify-document-media-import.ts`: Word preview/confirmation/actual stored images, including table and template instructions; three images re-export with original bytes. No unresolved import keys persist.
- `verify-document-media-markdown.ts`: selected Research Plan Markdown export and parse retains attachment identity.
- `verify-document-media-render.ts`: actual PDF contains image objects; desktop/mobile visual batch in `/private/tmp/labnest-media63-visual`. Black rectangles are deliberately synthetic test images, not scientific observations.
- Full suite executed once: 99 files / 549 cases, initially 545 passed and four obsolete fixture/implementation-coupled assertions failed. Those were corrected (Entry private-prop assertion replaced by real file-picker coverage); targeted rerun passed 7 cases. Subsequent affected media/conversion/import tests: 44 passed across 8 files. Production build and typecheck passed.
- Standards and Spec reviews each identified three findings; all were corrected and independently rechecked. Legacy-reference existence checks remain a conservative database-scan fallback, not an indexed migration.

## Not executed / limits

- Physical iPhone/Android system photo library and camera capture; viewport automation does not prove OS permissions or camera hardware.
- Manual new-form submission for every module (see route matrix), all operating-system/browser combinations, physical printing and offline Word desktop opening.
- External images remain legacy-readable online but are not silently fetched for Word export; their originals must first be uploaded.
- Unfinished inline uploads in a restored Entry draft require source-file reselection; the UI states this explicitly. Successful managed uploads do not need reselection.
- No changes to existing Protocol states, historical versions, Run snapshots, production records or original image pixels were part of the acceptance fixtures.
