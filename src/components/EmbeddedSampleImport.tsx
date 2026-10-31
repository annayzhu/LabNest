"use client";
import { useState, type RefObject } from "react";
import { parseSpreadsheetClipboard } from "@/lib/result-dataset-paste";

/** File intake only: send an explicit name column into the original planner's own import control; an experiment's samples (S14) go the same way. */
export function EmbeddedSampleImport({ frame, toolId, preset }: { frame: RefObject<HTMLIFrameElement | null>; toolId: string; preset?: { label: string; names: string[] } }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<string[][]>([]);
  const [column, setColumn] = useState(0);
  const [header, setHeader] = useState(true);
  const [message, setMessage] = useState("");
  const names = rows.slice(header ? 1 : 0).map(row => row[column]?.trim()).filter(Boolean);
  const send = (list: string[]) => {
    const win = frame.current?.contentWindow as (Window & typeof globalThis) | null;
    const input = frame.current?.contentDocument?.querySelector<HTMLTextAreaElement>(toolId === 'qpcr-plate-layout' ? 'textarea[aria-label="批量粘贴样本"], textarea[aria-label="Paste samples in bulk"]' : 'textarea.bulk-input');
    if (!input || !win) { setMessage('工具尚未就绪，请稍后重试。'); return; }
    Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype,'value')!.set!.call(input,list.join('\n')); input.dispatchEvent(new win.Event('input',{bubbles:true})); setOpen(false); requestAnimationFrame(() => frame.current?.scrollIntoView({block:'start'})); setMessage('已送入下方样本导入区，请在工具中确认导入。');
  };
  return <div className="border-y border-hairline py-2">
    {preset ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-sm"><button type="button" disabled={!preset.names.length} className="focus-ring min-h-11 font-medium text-moss disabled:text-muted" onClick={() => send(preset.names)}>{`送入 ${preset.label} 的 ${preset.names.length} 个样本`}</button><span className="text-xs text-muted">{preset.names.length ? `按分组和实验中的顺序：${preset.names.slice(0, 6).join('、')}${preset.names.length > 6 ? '…' : ''}` : '这个实验还没有选择样本。'}</span></div> : null}
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary className="focus-ring min-h-11 cursor-pointer py-2 text-sm">导入样本名单文件</summary>
    <label className="block text-sm">CSV / TSV / XLSX<input type="file" aria-label="样本名单文件" accept=".csv,.tsv,.txt,.xlsx" className="block min-h-11 max-w-full py-2" onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { if (file.size > 10 * 1024 * 1024) throw Error('名单文件不能超过10MB');
        const data = file.name.toLowerCase().endsWith('.xlsx') ? (await (await import('read-excel-file/browser')).readSheet(file)).map(row => row.map(value => value == null ? '' : String(value))) : parseSpreadsheetClipboard(await file.text(), /\.(tsv|txt)$/i.test(file.name) ? '\t' : ',');
        setRows(data.filter(row => row.some(value => value.trim()))); setColumn(0); setMessage('');
      } catch(error) { setRows([]); setMessage(error instanceof Error ? error.message : '文件读取失败'); }
    }} /></label>
    {rows.length ? <><label className="mr-3 text-sm"><input type="checkbox" checked={header} onChange={e => setHeader(e.target.checked)} /> 第一行为标题</label><label className="text-sm">样本名称列<select aria-label="样本名称列" className="ml-2 min-h-11 border border-hairline bg-surface" value={column} onChange={e => setColumn(Number(e.target.value))}>{rows[0].map((cell,index)=><option key={index} value={index}>{index+1} · {header ? cell : '列'}</option>)}</select></label><p className="py-2 text-sm">{names.length} 个名称：{names.slice(0,6).join('、')}{names.length>6?'…':''}</p><button type="button" disabled={!names.length} className="focus-ring min-h-11 text-moss" onClick={() => send(names)}>送入样本导入区</button></> : null}
    </details>
    {message ? <p role="status" className="py-2 text-sm">{message}</p> : null}
  </div>;
}
