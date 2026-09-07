# Shared document media — Issue #63

## Page coverage inventory

| Surface | Editing route / module | Persisted representation | Read-only / execution path | Status |
|---|---|---|---|---|
| Protocol | new; version edit / ProtocolWysiwygEditor | ProtocolDocument and immutable versions | ProtocolDocumentView; Run snapshots | Pending |
| Research plan | new; edit / ScientificDocumentEditor | ScientificDocument | ScientificBlockView | Pending |
| Experiment body | new; edit / ScientificDocumentEditor | ScientificDocument | ScientificBlockView; execution view | Pending |
| Entry / quick capture | new; edit / EntryComposer + MarkdownRichTextEditor | Markdown + entry attachments | Markdown rendering; EntryMediaGrid | Pending |
| Result | new; edit / ScientificDocumentEditor | ScientificDocument + Result sources | ScientificBlockView | Pending |
| Report | create; edit / ScientificDocumentEditor | ScientificDocument | Report preview / print / Markdown export | Pending |
| Run | ProtocolRunProgressForm; locked rich-text instruction blocks | detached snapshots; execution notes | ProtocolContentBlockView | Pending |
| Nested rich-text instructions | ResultTemplateConfigEditor / ProtocolRichTextEditor | ProtocolRichTextNode arrays | rich-text instruction render | Pending audit |
| Attachments | shared upload; preview; download; unlink | originals + AttachmentLink | attachment detail | Pending |

Run's currently editable deviation/impact/quick-note fields are plain text, not rich-text document regions; keep simple fields unchanged. Run's formatted instructions and media snapshots must render shared media correctly. Recheck for other rich-text recording routes before closing the matrix.

## Confirmed acceptance seams

User confirmed: actual editor-to-record workflows; attachment preview/download/reference removal; Markdown/Word/PDF import-export. Use isolated fixtures, real save/read interfaces and visible image assertions. Database-only URL checks do not count as acceptance. Record physical phone camera/system-picker checks not executed separately from mobile viewport automation.

## Safety

Preserve existing dirty worktree and source data. No unsolicited remote-image fetch. Pending blob URLs live only in transient memory. Unlink never deletes originals; physical deletion checks persisted references and immutable snapshots. Resizing changes presentation, not original bytes.
