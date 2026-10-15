'use client';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Editor } from '@tiptap/core';
import { CalendarClock, Clock, Heading2, Heading3, ImagePlus, List, ListChecks, ListOrdered, Paperclip, Pilcrow, Quote, Table2, type LucideIcon } from 'lucide-react';
import { turnInto, type BlockKind } from '@/lib/editor-blocks';
import { EditorCommandMenu, type CommandKeyHandler, type EditorCommand, type EditorCommandMenuState } from './EditorCommandMenu';
import { chooseFiles } from './DocumentMediaUploads';

/** Something an editor adds to 插入, e.g. an experiment record's metric or callout. */
export type WritingInsert = { id: string; label: string; hint: string; keywords: string; icon: LucideIcon; insert: (editor: Editor) => void };
type WritingChoice = BlockKind | 'image' | 'file' | 'table' | 'time' | 'datetime' | WritingInsert;
const time = (at: Date) => format(at, 'HH:mm'), dateTime = (at: Date) => format(at, 'yyyy-MM-dd HH:mm');

/** "/" in a writing editor: the blocks its document keeps, pictures and files, the editor's own inserts, and a time stamp for observations. */
function writingCommands(now: Date, { checklist, media, inserts }: { checklist: boolean; media: boolean; inserts: WritingInsert[] }): EditorCommand<WritingChoice>[] {
  return [
    { id: 'paragraph', group: '文字', label: '正文', hint: '普通段落', keywords: 'zhengwen zw body text paragraph', icon: Pilcrow, choice: 'paragraph' },
    { id: 'heading', group: '文字', label: '标题', hint: '也可在行首输入 # 和空格', keywords: 'biaoti bt heading title h1 h2', icon: Heading2, choice: 'heading' },
    { id: 'subheading', group: '文字', label: '小标题', hint: '也可在行首输入 ## 和空格', keywords: 'xiaobiaoti xbt subheading h3', icon: Heading3, choice: 'subheading' },
    { id: 'quote', group: '文字', label: '引用', hint: '摘录、原话或参考', keywords: 'yinyong yy quote blockquote', icon: Quote, choice: 'quote' },
    { id: 'bullet', group: '列表', label: '项目列表', hint: '也可输入 - 和空格', keywords: 'liebiao lb xiangmu xm bullet list ul', icon: List, choice: 'bullet' },
    { id: 'ordered', group: '列表', label: '编号列表', hint: '也可输入 1. 和空格', keywords: 'bianhao bh liebiao numbered ordered list ol', icon: ListOrdered, choice: 'ordered' },
    ...(checklist ? [{ id: 'task', group: '列表', label: '待办清单', hint: '可勾选的后续事项', keywords: 'daiban db qingdan qd todo checklist task', icon: ListChecks, choice: 'task' as const }] : []),
    ...(media ? [
      { id: 'image', group: '插入', label: '图片', hint: '选择照片；也可拖入或粘贴截图', keywords: 'tupian tp zhaopian zp image photo picture', icon: ImagePlus, choice: 'image' as const },
      { id: 'file', group: '插入', label: '附件', hint: '文件或音频', keywords: 'fujian fj wenjian wj file attachment audio', icon: Paperclip, choice: 'file' as const },
    ] : []),
    { id: 'table', group: '插入', label: '表格', hint: '3 × 3，带表头', keywords: 'biaoge bg table', icon: Table2, choice: 'table' },
    ...inserts.map(insert => ({ id: insert.id, group: '插入', label: insert.label, hint: insert.hint, keywords: insert.keywords, icon: insert.icon, choice: insert })),
    { id: 'time', group: '记录', label: '当前时间', hint: `插入 ${time(now)}`, keywords: 'shijian sj dangqian dq time now timestamp', icon: Clock, choice: 'time' },
    { id: 'datetime', group: '记录', label: '日期与时间', hint: `插入 ${dateTime(now)}`, keywords: 'riqi rq shijian sj date today datetime', icon: CalendarClock, choice: 'datetime' },
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
  return <EditorCommandMenu state={state} commands={commands} label="插入" searchPlaceholder="搜索：标题、清单、图片、bg…" emptyText="没有匹配的格式"
    onChoose={choice => { onClose(); runWritingCommand(editor, state, choice, draftId); }} onClose={onClose} keyRef={keyRef} />;
}
