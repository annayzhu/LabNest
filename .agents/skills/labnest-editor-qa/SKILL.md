---
name: labnest-editor-qa
description: Use when editing LabNest text inputs, rich text, Protocol scientific nodes, image upload or movement, tables, toolbar selection, save/readback or print. Check actual route callers and distinguish browser emulation from physical-device evidence.
---

# LabNest Editor QA

Read `docs/structured-protocol/20261014/REQUIREMENTS.md` sections 3, 9–13 and C/E/F acceptance, `DESIGN.md`, and the current `EDITOR-INVENTORY.txt`. Regenerate the route/component inventory when callers change. Do not assume every use of the shared editor is already covered.

Trace the real editor → serializer → action/schema → database → readonly/export renderer. Inspect `ProtocolWysiwygEditor`, `ScientificDocumentEditor`, `CompactRichTextTiptapEditor`, `DocumentMediaNode`, `DocumentMediaUploads`, `DocumentMediaView`, `protocol-tiptap.ts` and applicable table serializers. Preserve unknown historical content and original asset references.

On an isolated test service create a representative long document, multiple tables, images and conditional parameters. Exercise H2, bold, lists, selection, component panel opening/closing, undo/redo, and save → refresh → edit → readonly. Move an image (same node ID) separately from explicit copy (new node ID, same asset); verify reference/original-file counts through DB readback. Test upload failure/retry without duplicating assets. The user confirmed the previous 4-photo/7-file incident resolved on 2026-10-14; retain regression rather than assert a new root cause.

Capture desktop, phone-width and tablet-width pages, keyboard focus, local table scroll and absence of full-page overflow. Use existing Playwright scripts with real operations, retain logs/trace/screenshots. Simulated composition events do not prove full Chinese IME; physical keyboard, touch, camera, lockscreen and watch checks must be explicitly unexecuted unless actually performed.

For every affected real route update the staged acceptance matrix. Keep original records, uploads and secrets out of public artifacts. Check exported Word/PDF by rendering whenever those formats change; HTML screenshots alone are insufficient.
