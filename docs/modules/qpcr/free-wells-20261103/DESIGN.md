# Occasional free-well editing

Mode: Operate. Preserve the established LabNest/tool layout and icons.

- Keep one file-import control in the left Samples panel, next to pasted sample input. Use the tool's existing button/select styles and current language. After column/header selection, import directly into the sample list.
- Keep the existing selected-well editor. Sample and assay controls allow existing suggestions and new typed values; the assay role is explicit. Names that overflow their input receive a full, wrapped value beneath it, measured again on resize.
- Reuse known names without case/whitespace variations. Existing global assay roles and other wells using the same manual assay determine its shared role. Editing all selected instances together permits a consistent role change.
- Manual-only names remain outside setup and its automatic replicate matrix. Complete free wells do not create unregistered-name or automatic-replicate warnings; partial assignments and missing required setup reactions still do. Calculate requirements by the actual well/name maps, preserving setup order and appending actual manual-only names.
- Editor labels and wrapped names use at least 12 px; editable inputs use 13 px. Brief status messages move above the editor rather than covering its actions.
- Regeneration retains the existing warning that it overwrites manual edits. This task does not introduce reserved wells or an automatic avoidance algorithm.
