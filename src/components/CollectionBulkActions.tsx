"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Download, Pencil, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { getCollectionSelection, getCollectionBulkPreview, submitCollectionBulk } from "@/app/collections/bulk-actions";
import { collectionStatuses, type BulkMessage, type BulkSnapshot, type CollectionBulkRequest, type CollectionKind } from "@/lib/collection-bulk";
import type { BulkPreview } from "@/lib/collection-bulk.server";
import { isRecordLocked } from "@/lib/record-lifecycle";
import { newClientMutationId } from "@/lib/client-mutation-id";
import "./collection-bulk.css";

const statusZh: Record<string, string> = { active: "启用", paused: "暂停", completed: "已完成", archived: "已归档", draft: "草稿", retired: "停用", planned: "计划中", running: "运行中", failed: "失败", inactive: "停用" };
const outcomes: Record<string, BulkMessage> = { edit: { en: "Modify", zh: "将修改" }, archive: { en: "Archive", zh: "将归档" }, restore: { en: "Restore", zh: "将恢复" }, recycle: { en: "Move to Recycle Bin", zh: "移入回收站" }, retain_recycle: { en: "Recycle, keeping associations", zh: "保留关联回收" }, skip: { en: "Skip", zh: "跳过" }, noop: { en: "No change", zh: "无变化" } };
const fields: Record<string, BulkMessage> = { title: { en: "Title", zh: "名称／标题" }, status: { en: "Status", zh: "管理状态" }, tags: { en: "Tags", zh: "标签" }, notes: { en: "Notes", zh: "备注" }, runStatus: { en: "Run status", zh: "运行对象状态" } };

/** The table owns selection; this one entry point owns preview and confirmation. */
export function CollectionBulkActions({ kind, resetKey }: { kind: CollectionKind; resetKey: string }) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const say = (en: string, cn: string) => zh ? cn : en;
  const translate = (message: BulkMessage) => message[zh ? "zh" : "en"];
  const statusName = (status: string) => zh ? statusZh[status] ?? status : status;
  const router = useRouter();
  const anchor = useRef<HTMLSpanElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<CollectionBulkRequest>();
  const [records, setRecords] = useState<BulkSnapshot[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [tagMode, setTagMode] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [restoreStatuses, setRestoreStatuses] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<BulkPreview>();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<BulkMessage>();
  const [changed, setChanged] = useState(false);
  const [completed, setCompleted] = useState<string>();
  const batchId = useRef("");
  const inputs = () => [...(anchor.current?.closest("form")?.querySelectorAll<HTMLInputElement>("input.selection-checkbox") ?? [])];
  const clearSelection = () => {
    const form = anchor.current?.closest("form");
    inputs().forEach(input => { input.checked = false; });
    form?.dispatchEvent(new Event("change", { bubbles: true }));
  };
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const sync = () => setCount([...form.querySelectorAll<HTMLInputElement>("input.selection-checkbox:checked")].length);
    // The table's filter key remounts its inputs on navigation; keep clicks made during hydration.
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, [resetKey]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  const close = () => {
    if (busy) return;
    dialog.current?.close(); setOpen(false);
    opener.current?.focus();
  };
  async function start(operation: CollectionBulkRequest["operation"]) {
    const ids = inputs().filter(input => input.checked).map(input => input.value);
    if (!ids.length || ids.length > 500) return;
    opener.current = document.activeElement as HTMLElement;
    const next = { kind, ids, operation, titles: [], restoreStatuses: {} } satisfies CollectionBulkRequest;
    setRequest(next); setTitles({}); setStatus(""); setTagMode(""); setTags(""); setNotes(""); setRestoreStatuses({}); setConfirmation(""); setError(undefined); setCompleted(undefined); setChanged(false); setPreview(undefined); setRecords([]);
    batchId.current = newClientMutationId(); setOpen(true); setBusy(true);
    try {
      if (operation === "edit") {
        const result = await getCollectionSelection({ kind, ids });
        if (result.error) setError(result.error);
        else { setRecords(result.records); setTitles(Object.fromEntries(result.records.map(row => [row.id, row.title]))); }
      } else {
        const result = await getCollectionBulkPreview(next);
        if (result.error) setError(result.error); else { setPreview(result.preview); setRecords(result.preview.records); }
      }
    } catch { setError({ en: "Connection failed. Try again.", zh: "连接失败，请重试。" }); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    if (!request) return;
    const next: CollectionBulkRequest = request.operation === "edit" ? {
      kind: request.kind, ids: request.ids, operation: request.operation, restoreStatuses: {}, titles: records.filter(row => titles[row.id]?.trim() && titles[row.id].trim() !== row.title).map(row => ({ id: row.id, title: titles[row.id].trim() })),
      ...(status ? { status } : {}), ...(tagMode ? { tags: { mode: tagMode as "add" | "remove" | "replace", values: [...new Set(tags.split(/[,，\n]/).map(value => value.trim()).filter(Boolean))] } } : {}), ...(notes.trim() ? { appendNotes: notes.trim() } : {}),
    } : { ...request, restoreStatuses };
    setBusy(true); setError(undefined); setChanged(false);
    try {
      const result = await getCollectionBulkPreview(next);
      if (result.error) setError(result.error); else { setRequest(next); setPreview(result.preview); setRecords(result.preview.records); setConfirmation(""); batchId.current = newClientMutationId(); }
    } catch { setError({ en: "Connection failed. Try again.", zh: "连接失败，请重试。" }); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!request || !preview) return;
    setBusy(true); setError(undefined);
    try {
      const response = await submitCollectionBulk(request, preview.token, batchId.current, confirmation);
      if (response.error) setError(response.error);
      else if (response.result.applied) {
        setCompleted(response.result.batchId); setPreview({ ...preview, rows: response.result.rows }); clearSelection(); router.refresh();
      } else {
        setPreview(response.result.preview); setRecords(response.result.preview.records); setChanged(true); setConfirmation(""); batchId.current = newClientMutationId();
      }
    } catch { setError({ en: "Connection failed. You can retry this same batch safely.", zh: "连接失败，可以安全重试本批操作。" }); }
    finally { setBusy(false); }
  }
  const title = request?.operation === "edit" ? say("Modify selected records", "修改所选记录") : request?.operation === "archive" ? say("Archive selected records", "归档所选记录") : request?.operation === "restore" ? say("Restore archived records", "恢复归档记录") : say("Delete selected records", "删除所选记录");
  const changedCount = preview?.rows.filter(row => !["skip", "noop"].includes(row.outcome)).length ?? 0;
  const needsStatus = preview?.rows.some(row => row.needsStatus);
  const display = (key: string, value: unknown) => Array.isArray(value) ? value.join(" · ") || say("Empty", "空") : key === "status" || key === "runStatus" ? statusName(String(value)) : String(value ?? say("Empty", "空"));
  return <>
    <span ref={anchor} data-i18n-ignore className="ln-bulk-selection-count">{say(`${count} selected`, `已选 ${count} 项`)}</span>
    <div data-i18n-ignore className="contents">
      <Button type="button" size="sm" disabled={count > 500} onClick={() => void start("edit")}><Pencil size={14} aria-hidden />{say("Modify…", "修改…")}</Button>
      <Button type="button" size="sm" disabled={count > 500} onClick={() => void start("archive")}><Archive size={14} aria-hidden />{say("Archive", "归档")}</Button>
      <Button type="button" size="sm" disabled={count > 500} onClick={() => void start("restore")}><ArchiveRestore size={14} aria-hidden />{say("Restore", "恢复")}</Button>
      <Button type="submit" size="sm" disabled={count > 500}><Download size={14} aria-hidden />{say("Export", "导出")}</Button>
      <Button type="button" size="sm" variant="destructive" disabled={count > 500} onClick={() => void start("delete")}><Trash2 size={14} aria-hidden />{say("Delete…", "删除…")}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>{say("Clear selection", "清空选择")}</Button>
      {count > 500 ? <span role="alert" className="text-sm text-error">{say("Select at most 500 records per batch.", "单次最多 500 条，请缩小选择范围。")}</span> : null}
    </div>
    {open ? createPortal(<dialog ref={dialog} data-i18n-ignore className="ln-bulk-drawer" aria-labelledby="ln-bulk-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header><div><h2 id="ln-bulk-title">{title}</h2><p>{say(`${request?.ids.length ?? 0} selected`, `已选 ${request?.ids.length ?? 0} 项`)}</p></div><Button aria-label={say("Close", "关闭")} type="button" size="icon" variant="ghost" disabled={busy} onClick={close}><X size={18} /></Button></header>
      <div className="ln-bulk-body" aria-busy={busy}>
        {error ? <p role="alert" className="ln-bulk-notice is-error">{translate(error)}</p> : null}
        {changed ? <p role="alert" className="ln-bulk-notice">{say("Records changed after the preview. Nothing was written. Review the refreshed preview and confirm again.", "预览后记录发生变化，本次没有写入。请核对已刷新的预览，再次确认。")}</p> : null}
        {completed ? <p role="status" className="ln-bulk-notice">{say(`Completed: ${changedCount} changed. Batch: ${completed}`, `已完成：${changedCount} 项发生变化。批次：${completed}`)}</p> : null}
        {busy && !records.length && !preview ? <p role="status">{say("Loading records…", "正在读取记录…")}</p> : null}
        {!preview && request?.operation === "edit" && records.length ? <>
          <div className="ln-bulk-fields">
            {["project", "research_plan", "protocol"].includes(kind) ? <label>{kind === "protocol" ? say("Availability", "可用状态") : say("Management status", "管理状态")}<select value={status} onChange={event => setStatus(event.target.value)}><option value="">{say("Do not modify", "不修改")}</option>{collectionStatuses[kind].map(value => <option key={value} value={value}>{statusName(value)}</option>)}</select></label> : null}
            {kind !== "result" ? <><label>{say("Tags", "标签")}<select value={tagMode} onChange={event => setTagMode(event.target.value)}><option value="">{say("Do not modify", "不修改")}</option><option value="add">{say("Add", "添加")}</option><option value="remove">{say("Remove", "移除")}</option><option value="replace">{say("Replace", "替换")}</option></select></label>{tagMode ? <label>{say("Tags separated by commas", "标签，以逗号分隔")}<input value={tags} onChange={event => setTags(event.target.value)} /></label> : null}</> : <label>{say("Append notes (blank leaves unchanged)", "追加备注（留空不修改）")}<textarea value={notes} maxLength={10000} rows={3} onChange={event => setNotes(event.target.value)} /></label>}
          </div>
          <h3>{say("Names / titles", "名称／标题")}</h3>
          <div className="ln-bulk-title-list">{records.map(row => <label key={row.id}><span>{row.title}</span><textarea aria-label={say(`New title: ${row.title}`, `新标题：${row.title}`)} value={titles[row.id] ?? row.title} maxLength={180} rows={2} disabled={Boolean(row.recycled || row.recordStatus && isRecordLocked(row.recordStatus))} onChange={event => setTitles({ ...titles, [row.id]: event.target.value })} />{row.recordStatus && isRecordLocked(row.recordStatus) ? <small>{say("Read-only: submitted / reviewed", "只读：已提交／已审核")}</small> : null}</label>)}</div>
        </> : null}
        {preview ? <>
          <div className="ln-bulk-summary">{Object.entries(outcomes).map(([key, label]) => { const amount = preview.rows.filter(row => row.outcome === key).length; return amount ? <span key={key}>{translate(label)}：{amount}</span> : null; })}</div>
          {request?.operation === "delete" && !completed ? <p className="text-sm text-muted">{say("Linked records and original attachment files are retained. Recovery is available in the Recycle Bin.", "关联条目和附件原文件会保留。移入回收站的条目可在回收站恢复。")}</p> : null}
          <ol className="ln-bulk-preview">{preview.rows.map(row => <li key={row.id}>
            <div className="ln-bulk-preview-heading"><strong>{row.title}</strong><span>{translate(outcomes[row.outcome])}</span></div>
            {row.reason ? <p>{translate(row.reason)}</p> : null}
            {row.needsStatus ? <label>{say("Restore status", "恢复状态")}<select aria-label={say(`Restore status: ${row.title}`, `恢复状态：${row.title}`)} value={restoreStatuses[row.id] ?? ""} onChange={event => setRestoreStatuses({ ...restoreStatuses, [row.id]: event.target.value })}><option value="">{say("Choose a status", "请选择状态")}</option>{collectionStatuses[kind].filter(status => status !== "archived").map(status => <option key={status} value={status}>{statusName(status)}</option>)}</select></label> : null}
            {row.before && row.after && !["skip", "noop"].includes(row.outcome) ? <dl>{Object.keys(row.after).filter(key => JSON.stringify(row.before?.[key as keyof typeof row.before]) !== JSON.stringify(row.after?.[key as keyof typeof row.after])).map(key => <div key={key}><dt>{translate(fields[key])}</dt><dd><span>{display(key, row.before?.[key as keyof typeof row.before])}</span><span aria-hidden> → </span><strong>{display(key, row.after?.[key as keyof typeof row.after])}</strong></dd></div>)}</dl> : null}
          </li>)}</ol>
        </> : null}
      </div>
      <footer>
        {request?.operation === "delete" && preview && !completed ? <label className="ln-bulk-confirm-count">{say(`Type ${request.ids.length} to confirm`, `输入 ${request.ids.length} 确认`)}<input aria-label={say("Selected count confirmation", "所选条数确认")} inputMode="numeric" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label> : null}
        <div className="ln-bulk-footer-actions"><Button type="button" disabled={busy} onClick={close}>{completed ? say("Close", "关闭") : say("Cancel", "取消")}</Button>
          {!completed ? !preview || needsStatus ? <Button type="button" variant="primary" disabled={busy || !records.length || Boolean(needsStatus && preview?.rows.some(row => row.needsStatus && !restoreStatuses[row.id])) || Boolean(!preview && tagMode && !tags.trim())} onClick={() => void showPreview()}>{say("Preview changes", "预览变更")}</Button> : <><Button type="button" disabled={busy} onClick={() => { setPreview(undefined); setChanged(false); }}>{request?.operation === "edit" ? say("Back to edit", "返回修改") : say("Refresh preview", "重新预览")}</Button><Button type="button" variant={request?.operation === "delete" ? "destructive" : "primary"} disabled={busy || !changedCount || request?.operation === "delete" && confirmation !== String(request.ids.length)} onClick={() => void apply()} aria-busy={busy}>{say("Confirm changes", "确认执行")}</Button></> : null}
        </div>
      </footer>
    </dialog>, document.body) : null}
  </>;
}
