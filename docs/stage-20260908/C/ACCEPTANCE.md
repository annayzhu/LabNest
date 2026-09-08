# C Document formatting — integration in progress

Reused prior C worktree formatting implementation on main1aed227, with B shared context properties. Added nested result-template instructions to whole-document scope after a browser regression showed unchanged13.333px instead of24px. Nested save/read and DOCX passed. Six document entrances full-font/save/refresh/reedit/image/PDF passed (font-all.json;12 PDFs). Multi-cell selection shows mixed size, applies16pt to two selected cells, leaves other cells unchanged and persists (text.json).

Property panels escape document zoom transforms through one shared portal; controls retain explicit native form ownership. Browser save/readback caught HTMLFormElement named-id shadowing and it was corrected with getAttribute. User drafts remain tied to their original form.

Final version production validation and shared regression still pending; original failing record, real printer, physical IME/160% device and personnel trial not executed.
