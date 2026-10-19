'use client';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Editor } from '@tiptap/core';
import { CalendarClock, Clock, Heading2, Heading3, ImagePlus, List, ListChecks, ListOrdered, Paperclip, Pilcrow, Quote, Table2, type LucideIcon } from 'lucide-react';
import { turnInto, type BlockKind } from '@/lib/editor-blocks';
import { EditorCommandMenu, type CommandKeyHandler, type EditorCommand, type EditorCommandMenuState } from './EditorCommandMenu';
import { chooseFiles } from './DocumentMediaUploads';

/** Something an editor adds to Insert, e.g. an experiment record's metric or callout. */
export type WritingInsert = { id: string; label: string; hint: string; keywords: string; icon: LucideIcon; insert: (editor: Editor) => void };
type WritingChoice = BlockKind | 'image' | 'file' | 'table' | 'time' | 'datetime' | WritingInsert;
const time = (at: Date) => format(at, 'HH:mm'), dateTime = (at: Date) => format(at, 'yyyy-MM-dd HH:mm');

/** "/" in a writing editor: the blocks its document keeps, pictures and files, the editor's own inserts, and a time stamp for observations. */
function writingCommands(now: Date, { checklist, media, inserts }: { checklist: boolean; media: boolean; inserts: WritingInsert[] }): EditorCommand<WritingChoice>[] {
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
    ...inserts.map(insert => ({ id: insert.id, group: 'Insert', label: insert.label, hint: insert.hint, keywords: insert.keywords, icon: insert.icon, choice: insert })),
    { id: 'time', group: 'Timestamps', label: 'Current time', hint: `Insert ${time(now)}`, keywords: 'shijian sj dangqian dq time now timestamp', icon: Clock, choice: 'time' },
    { id: 'datetime', group: 'Timestamps', label: 'Date and time', hint: `Insert ${dateTime(now)}`, keywords: 'riqi rq shijian sj date today datetime', icon: CalendarClock, choice: 'datetime' },
  ];
}

function runWritingCommand(editor: Editor, menu: EditorCommandMenuState, choice: WritingChoice, draftId: string) {
  const chain = editor.chain().focus();
  if (menu.mode === 'slash') chain.deleteRange({ from: menu.from, to: editor.state.selection.from });
  if (typeof choice === 'object') { chain.run(); choice.insert(editor); return; }
  if (choice === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
  else if (choice === 'time') chain.insertContent(`${time(new Date())} `);
  else if (choice === 'datetime') chain.insertContent(`${dateTime(new Date())} `);
  else if (choice !== 'image' && choice !== 'file') turnInto(editor, chain, choice);
  chain.run();
  // The picked files go where the slash was.
  if (choice === 'image') chooseFiles(editor, draftId, 'image/*');
  if (choice === 'file') chooseFiles(editor, draftId);
}

/** The "/" menu of Entry and the experiment, result, plan and report editors. */
export function WritingCommandMenu({ editor, state, draftId, keyRef, onClose, checklist = true, media = true, inserts = [] }: {
  editor: Editor; state: EditorCommandMenuState; draftId: string; keyRef: CommandKeyHandler; onClose: () => void; checklist?: boolean; media?: boolean; inserts?: WritingInsert[];
}) {
  // The menu mounts when "/" is typed; its time stamps show that moment.
  const [openedAt] = useState(() => new Date());
  const commands = useMemo(() => writingCommands(openedAt, { checklist, media, inserts }), [openedAt, checklist, media, inserts]);
  return <EditorCommandMenu state={state} commands={commands} label="Insert" searchPlaceholder="Search: heading, checklist, image, bg…" emptyText="No matching format"
    onChoose={choice => { onClose(); runWritingCommand(editor, state, choice, draftId); }} onClose={onClose} keyRef={keyRef} />;
}
