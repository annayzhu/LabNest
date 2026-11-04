import { z } from "zod";
import { isRecordLocked } from "@/lib/record-lifecycle";

export const collectionKinds = ["project", "research_plan", "protocol", "experiment", "result"] as const;
export type CollectionKind = typeof collectionKinds[number];
export const collectionPaths: Record<CollectionKind, string> = { project: "/projects", research_plan: "/research-plans", protocol: "/protocols", experiment: "/experiments", result: "/results" };
export const collectionStatuses: Record<CollectionKind, readonly string[]> = {
  project: ["active", "paused", "completed", "archived"],
  research_plan: ["draft", "active", "paused", "completed", "archived"],
  protocol: ["draft", "active", "retired", "archived"],
  experiment: ["planned", "running", "completed", "failed", "archived"],
  result: ["active", "inactive", "archived"],
};
const id = z.string().min(1).max(160);
export const collectionSelectionSchema = z.object({ kind: z.enum(collectionKinds), ids: z.array(id).min(1).max(500) }).strict().refine(value => new Set(value.ids).size === value.ids.length, "Duplicate record IDs.");
export const collectionBulkSchema = z.object({
  kind: z.enum(collectionKinds),
  ids: z.array(id).min(1).max(500),
  operation: z.enum(["edit", "archive", "restore", "delete"]),
  titles: z.array(z.object({ id, title: z.string().trim().min(1).max(180) }).strict()).max(500).default([]),
  status: z.string().optional(),
  tags: z.object({ mode: z.enum(["add", "remove", "replace"]), values: z.array(z.string().trim().min(1).max(48)).min(1).max(100) }).strict().optional(),
  appendNotes: z.string().trim().max(10000).optional(),
  restoreStatuses: z.record(id, z.string()).default({}),
}).strict().superRefine((value, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(value.ids).size !== value.ids.length) fail("Duplicate record IDs.");
  if (new Set(value.titles.map(row => row.id)).size !== value.titles.length || value.titles.some(row => !value.ids.includes(row.id))) fail("Titles must belong to selected records, once per record.");
  if (value.operation !== "edit" && (value.titles.length || value.status !== undefined || value.tags || value.appendNotes)) fail("Edit fields require the edit operation.");
  if (value.status !== undefined && (!["project", "research_plan", "protocol"].includes(value.kind) || !collectionStatuses[value.kind].includes(value.status))) fail("This status cannot be edited in bulk.");
  if (value.tags && value.kind === "result") fail("Results do not have tags.");
  if (value.appendNotes && value.kind !== "result") fail("Notes can only be appended to Results.");
  for (const [key, status] of Object.entries(value.restoreStatuses)) {
    if (value.operation !== "restore" || !value.ids.includes(key) || status === "archived" || !collectionStatuses[value.kind].includes(status)) fail("Invalid restore status.");
  }
});
export type CollectionBulkRequest = z.infer<typeof collectionBulkSchema>;
export type BulkMessage = { en: string; zh: string };
export type BulkSnapshot = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  tags?: string[];
  notes?: string | null;
  recordStatus?: string;
  runStatus?: string;
  previousStatus?: string;
  previousRunStatus?: string;
  recycled?: boolean;
  nameConflict?: boolean;
  deletion?: { mode: "physical" | "soft" | "archive"; reason?: BulkMessage; counts: Record<string, number>; versionIds?: string[] };
};
export type BulkValues = { title: string; status: string; tags?: string[]; notes?: string | null; runStatus?: string };
export type BulkRow = {
  id: string;
  title: string;
  outcome: "edit" | "archive" | "restore" | "recycle" | "retain_recycle" | "skip" | "noop";
  reason?: BulkMessage;
  needsStatus?: boolean;
  before?: BulkValues;
  after?: BulkValues;
};
const message = (en: string, zh: string): BulkMessage => ({ en, zh });
export function bulkValues(row: BulkSnapshot): BulkValues {
  return { title: row.title, status: row.status, ...(row.tags ? { tags: row.tags } : {}), ...(row.notes !== undefined ? { notes: row.notes } : {}), ...(row.runStatus !== undefined ? { runStatus: row.runStatus } : {}) };
}

/** The same plan drives the preview and the transaction. Scientific fields never enter the patch. */
export function planCollectionBulk(request: CollectionBulkRequest, snapshots: BulkSnapshot[]): BulkRow[] {
  const byId = new Map(snapshots.map(row => [row.id, row]));
  const titles = new Map(request.titles.map(row => [row.id, row.title]));
  return request.ids.map(id => {
    const row = byId.get(id);
    if (!row || row.recycled) return { id, title: row?.title ?? id, outcome: "skip", reason: message("Missing or already in the Recycle Bin.", "记录已不存在或已在回收站。") };
    const before = bulkValues(row);
    const after = { ...before };
    const base = { id, title: row.title, before, after };
    let outcome: BulkRow["outcome"] = request.operation === "delete" ? "recycle" : request.operation;
    let reason: BulkMessage | undefined;
    if (request.operation === "edit") {
      if (row.recordStatus && isRecordLocked(row.recordStatus)) return { ...base, outcome: "skip", reason: message("Submitted or reviewed; reopen from the record page first.", "记录已提交或已审核；需先在详情页填写原因并重开。") };
      if (row.nameConflict) return { ...base, outcome: "skip", reason: message("Another Project uses this name.", "已有其他项目使用此名称。") };
      after.title = titles.get(id) ?? before.title;
      after.status = request.status ?? before.status;
      if (request.tags && before.tags) {
        const values = [...new Set(request.tags.values)];
        after.tags = request.tags.mode === "replace" ? values : request.tags.mode === "add" ? [...new Set([...before.tags, ...values])] : before.tags.filter(tag => !values.includes(tag));
      }
      if (request.appendNotes) after.notes = [before.notes, request.appendNotes].filter(Boolean).join("\n\n");
    } else if (request.operation === "restore") {
      if (row.status !== "archived") return { ...base, outcome: "noop", reason: message("This record is not archived.", "此记录未归档。") };
      const status = row.previousStatus ?? request.restoreStatuses[id];
      if (!status || status === "archived" || !collectionStatuses[request.kind].includes(status)) return { ...base, outcome: "skip", needsStatus: true, reason: message("No reliable prior status. Choose a restore status.", "缺少可靠的归档前状态，请选择恢复状态。") };
      after.status = status;
      if (row.runStatus !== undefined) after.runStatus = row.previousRunStatus ?? status;
    } else if (request.operation === "delete") {
      if (!row.deletion) throw new Error("Deletion dependencies were not loaded.");
      reason = row.deletion.reason;
      if (row.deletion.mode === "archive") { outcome = "archive"; after.status = "archived"; }
      else if (row.deletion.mode === "physical") return { ...base, after: undefined, outcome: "recycle", ...(reason ? { reason } : {}) };
      else { outcome = "retain_recycle"; after.status = "archived"; }
    } else {
      if (row.status === "archived") return { ...base, outcome: "noop", reason: message("Already archived.", "已归档。") };
      after.status = "archived";
    }
    if (after.status === "archived" && before.status !== "archived" && outcome === "archive" && row.runStatus !== undefined) after.runStatus = "archived";
    if (!["recycle", "retain_recycle"].includes(outcome) && JSON.stringify(before) === JSON.stringify(after)) outcome = "noop";
    return { ...base, outcome, ...(reason ? { reason } : {}) };
  });
}
