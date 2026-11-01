'use client';
import { useContext, useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Editor, JSONContent } from '@tiptap/core';
import { CalendarClock, Clock, Grid3x3, Heading2, Heading3, ImagePlus, List, ListChecks, ListOrdered, Package, Paperclip, Pilcrow, Quote, Table2, TestTube, type LucideIcon } from 'lucide-react';
import { turnInto, type BlockKind } from '@/lib/editor-blocks';
import { newPlateId, newPlateLayout, plateSizeName } from '@/lib/plate-layout';
import type { RecordReference } from '@/lib/record-references';
import { useI18n } from './I18nProvider';
import { EditorCommandMenu, type CommandKeyHandler, type EditorCommand, type EditorCommandMenuState } from './EditorCommandMenu';
import { chooseFiles } from './DocumentMediaUploads';
import { openPlateEditorWhenShown } from './DocumentPlateNode';
import { ReferencePicker, ReferenceScope, type ReferencePickerKind } from './ReferencePicker';

/** Something an editor adds to Insert, e.g. an experiment record's metric or callout. */
export type WritingInsert = { id: string; label: string; hint: string; keywords: string; icon: LucideIcon; insert: (editor: Editor) => void };
type WritingChoice = BlockKind | 'image' | 'file' | 'table' | 'plate' | 'time' | 'datetime' | ReferencePickerKind | WritingInsert;
const time = (at: Date) => format(at, 'HH:mm'), dateTime = (at: Date) => format(at, 'yyyy-MM-dd HH:mm');

/** "/" in a writing editor: the blocks its document keeps, pictures and files, the editor's own inserts, samples, stock and plates, and a time stamp for observations. */
function writingCommands(now: Date, { checklist, media, inserts, references, inTable }: { checklist: boolean; media: boolean; inserts: WritingInsert[]; references: boolean; inTable: boolean }): EditorCommand<WritingChoice>[] {
  return [
    { id: 'paragraph', group: 'Basic blocks', label: 'Body', hint: 'Plain paragraph', keywords: 'zhengwen zw body text paragraph', icon: Pilcrow, choice: 'paragraph' },
    { id: 'heading', group: 'Basic blocks', label: 'Heading', hint: 'Or type # and a space at the start of a line', keywords: 'biaoti bt heading title h1 h2', icon: Heading2, choice: 'heading' },
    { id: 'subheading', group: 'Basic blocks', label: 'Subheading', hint: 'Or type ## and a space at the start of a line', keywords: 'xiaobiaoti xbt subheading h3', icon: Heading3, choice: 'subheading' },
    { id: 'quote', group: 'Basic blocks', label: 'Quote', hint: 'Excerpt, quotation or reference', keywords: 'yinyong yy quote blockquote', icon: Quote, choice: 'quote' },
    { id: 'bullet', group: 'Lists', label: 'Bullet points', hint: 'Or type - and a space', keywords: 'liebiao lb xiangmu xm bullet list ul', icon: List, choice: 'bullet' },
    { id: 'ordered', group: 'Lists', label: 'Numbered list', hint: 'Or type 1. and a space', keywords: 'bianhao bh liebiao numbered ordered list ol', icon: ListOrdered, choice: 'ordered' },
    ...(checklist ? [{ id: 'task', group: 'Lists', label: 'To-do list', hint: 'Follow-ups to tick off', keywords: 'daiban db qingdan qd todo checklist task', icon: ListChecks, choice: 'task' as const }] : []),
    ...(media ? [
      { id: 'image', group: 'Insert', label: 'Image', hint: 'Choose a photo, or drop in or paste a screenshot', keywords: 'tupian tp zhaopian zp image photo picture', icon: ImagePlus, choice: 'image' as const },
      { id: 'file', group: 'Insert', label: 'File attachment', hint: 'File or audio', keywords: 'fujian fj wenjian wj file attachment audio', icon: Paperclip, choice: 'file' as const },
    ] : []),
    { id: 'table', group: 'Insert', label: 'Table', hint: '3 × 3 with a header row', keywords: 'biaoge bg table', icon: Table2, choice: 'table' },
    // A plate is a block of its own; a table cell cannot hold one.
    ...(references && !inTable ? [{ id: 'plate', group: 'Insert', label: 'Plate layout', hint: '6–384 wells · samples and treatments per well', keywords: 'banbuju bbj kongban kb buju bj plate layout well 96 384 qpcr', icon: Grid3x3, choice: 'plate' as const }] : []),
    ...inserts.map(insert => ({ id: insert.id, group: 'Insert', label: insert.label, hint: insert.hint, keywords: insert.keywords, icon: insert.icon, choice: insert })),
    ...(references ? [
      { id: 'sample', group: 'Link a record', label: 'Sample', hint: 'A sample from the sample library', keywords: 'yangben yb biaoben bb sample specimen rna dna cells', icon: TestTube, choice: 'sample' as const },
      { id: 'inventory', group: 'Link a record', label: 'Inventory item', hint: 'A product or lot in stock', keywords: 'kucun kc wupin wp shiji sj haocai hc inventory stock reagent product lot', icon: Package, choice: 'inventory' as const },
    ] : []),
    { id: 'time', group: 'Timestamps', label: 'Current time', hint: `Insert ${time(now)}`, keywords: 'shijian sj dangqian dq time now timestamp', icon: Clock, choice: 'time' },
    { id: 'datetime', group: 'Timestamps', label: 'Date and time', hint: `Insert ${dateTime(now)}`, keywords: 'riqi rq shijian sj date today datetime', icon: CalendarClock, choice: 'datetime' },
  ];
}

function runWritingCommand(editor: Editor, menu: EditorCommandMenuState, choice: WritingChoice, draftId: string, zh: boolean) {
  const chain = editor.chain().focus();
  if (menu.mode === 'slash') chain.deleteRange({ from: menu.from, to: editor.state.selection.from });
  if (typeof choice === 'object') { chain.run(); choice.insert(editor); return; }
  if (choice === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
  else if (choice === 'plate') {
    // A new plate opens its editor at once, as an image opens the file picker.
    const block = newPlateLayout({ id: newPlateId(), name: plateSizeName(96, zh), plateSize: 96, fieldNames: zh ? ['样本', '处理'] : ['Sample', 'Treatment'] });
    openPlateEditorWhenShown(block.id);
    chain.insertContent({ type: 'documentPlate', attrs: { block } });
  }
  else if (choice === 'time') chain.insertContent(`${time(new Date())} `);
  else if (choice === 'datetime') chain.insertContent(`${dateTime(new Date())} `);
  else if (choice !== 'image' && choice !== 'file' && choice !== 'sample' && choice !== 'inventory') turnInto(editor, chain, choice);
  chain.run();
  // The picked files go where the slash was.
  if (choice === 'image') chooseFiles(editor, draftId, 'image/*');
  if (choice === 'file') chooseFiles(editor, draftId);
}

/** Tags where the slash was, several joined by "、" (", " in English), with a space after them to write on. */
function insertReferences(editor: Editor, menu: EditorCommandMenuState, references: RecordReference[], zh: boolean) {
  const chain = editor.chain().focus();
  if (menu.mode === 'slash') chain.deleteRange({ from: menu.from, to: editor.state.selection.from });
  const content: JSONContent[] = references.flatMap((reference, index) => [...(index ? [{ type: 'text', text: zh ? '、' : ', ' }] : []), { type: 'recordReference', attrs: reference }]);
  chain.insertContent([...content, { type: 'text', text: ' ' }]).run();
}

/** The "/" menu of Entry and the experiment, result, plan and report editors. "Sample" and "Inventory item" turn it into a picker in place. */
export function WritingCommandMenu({ editor, state, draftId, keyRef, onClose, checklist = true, media = true, references = false, inserts = [] }: {
  editor: Editor; state: EditorCommandMenuState; draftId: string; keyRef: CommandKeyHandler; onClose: () => void; checklist?: boolean; media?: boolean; references?: boolean; inserts?: WritingInsert[];
}) {
  const { locale } = useI18n();
  const { experimentId } = useContext(ReferenceScope);
  // The menu mounts when "/" is typed; its time stamps show that moment.
  const [openedAt] = useState(() => new Date());
  const [inTable] = useState(() => editor.isActive('tableCell') || editor.isActive('tableHeader'));
  const [picker, setPicker] = useState<ReferencePickerKind | null>(null);
  const commands = useMemo(() => writingCommands(openedAt, { checklist, media, inserts, references, inTable }), [openedAt, checklist, media, inserts, references, inTable]);
  const zh = locale === 'zh';
  if (picker) return <ReferencePicker kind={picker} anchor={state.anchor} experimentId={experimentId} onClose={onClose}
    onInsert={(chosen) => { onClose(); insertReferences(editor, state, chosen, zh); }} />;
  return <EditorCommandMenu editor={editor} state={state} commands={commands} label="Insert" searchPlaceholder="Search: heading, sample, plate, bg…" emptyText="No matching format"
    onChoose={choice => { if (choice === 'sample' || choice === 'inventory') { setPicker(choice); return; } onClose(); runWritingCommand(editor, state, choice, draftId, zh); }} onClose={onClose} keyRef={keyRef} />;
}
