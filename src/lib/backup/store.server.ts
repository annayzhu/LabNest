import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Attempt } from "./policy";

/**
 * The backup folder (LABNEST_BACKUP_ROOT):
 *   snapshots/<id>/manifest.json, database.dump — one per backup
 *   files/<path>                                  — attachment files, each stored once and shared by every snapshot
 *   status.json                                   — the last attempt and the last good backup
 * Unset means backups are off; there is deliberately no default, so a stray dev server never writes one.
 */
export function backupRoot() {
  const configured = process.env.LABNEST_BACKUP_ROOT;
  return configured ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured) : null;
}

/** Where the folder is on the computer, for people: inside Docker the root is a mount, so the host path is passed in. */
export function backupLocation() {
  return process.env.LABNEST_BACKUP_HOST_DIR || backupRoot();
}

export type BackupKind = "daily" | "manual" | "pre-restore" | "pre-release";

export type Manifest = {
  id: string;
  kind: BackupKind;
  createdAt: string;
  migration: string | null;
  database: { file: "database.dump"; size: number };
  /** Row counts read back from the restored copy, so they describe exactly what the dump holds. */
  tables: Record<string, number>;
  files: Array<{ path: string; size: number }>;
  verified: { at: string; ok: boolean; error?: string } | null;
};

export type BackupStatus = { lastSuccess: { id: string; at: string } | null; lastAttempt: { at: string; ok: boolean; error?: string; detail?: string } | null };

export const snapshotsDir = (root: string) => path.join(root, "snapshots");
export const filesDir = (root: string) => path.join(root, "files");
export const snapshotDir = (root: string, id: string) => path.join(snapshotsDir(root), id);

/** Complete snapshots, newest first. A folder without a manifest is an unfinished or broken backup and is ignored. */
export async function listSnapshots(root: string) {
  const names = await readdir(snapshotsDir(root)).catch(() => [] as string[]);
  const manifests: Manifest[] = [];
  for (const name of names) {
    if (!/^[\w-]+$/.test(name)) continue;
    const manifest = await readManifest(root, name);
    if (manifest) manifests.push(manifest);
  }
  return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readManifest(root: string, id: string): Promise<Manifest | null> {
  if (!/^[\w-]+$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(snapshotDir(root, id), "manifest.json"), "utf8")) as Manifest;
  } catch {
    return null;
  }
}

export async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

// The last attempt also lives in memory: when the folder itself is unreachable, status.json cannot record the failure.
const memory = globalThis as unknown as { labnestBackupAttempt?: BackupStatus["lastAttempt"] };

export async function readStatus(root: string): Promise<BackupStatus> {
  let saved: BackupStatus = { lastSuccess: null, lastAttempt: null };
  try {
    saved = JSON.parse(await readFile(path.join(root, "status.json"), "utf8")) as BackupStatus;
  } catch {}
  const remembered = memory.labnestBackupAttempt;
  const lastAttempt = remembered && (!saved.lastAttempt || remembered.at > saved.lastAttempt.at) ? remembered : saved.lastAttempt;
  return { lastSuccess: saved.lastSuccess, lastAttempt };
}

export async function recordAttempt(root: string, attempt: NonNullable<BackupStatus["lastAttempt"]>, success?: { id: string }) {
  memory.labnestBackupAttempt = attempt;
  const current = await readStatus(root);
  await writeJson(path.join(root, "status.json"), {
    lastSuccess: success ? { id: success.id, at: attempt.at } : current.lastSuccess,
    lastAttempt: attempt,
  } satisfies BackupStatus).catch(() => {});
}

export function asPolicyStatus(status: BackupStatus): { lastSuccessAt: Date | null; lastAttempt: Attempt | null } {
  return {
    lastSuccessAt: status.lastSuccess ? new Date(status.lastSuccess.at) : null,
    lastAttempt: status.lastAttempt ? { at: new Date(status.lastAttempt.at), ok: status.lastAttempt.ok } : null,
  };
}

/** Bytes used by the whole backup folder. */
export async function folderSize(folder: string): Promise<number> {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  let total = 0;
  for (const entry of entries) {
    const full = path.join(folder, entry.name);
    total += entry.isDirectory() ? await folderSize(full) : (await stat(full).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

/** Every file below `folder`, as paths relative to it with their sizes. */
export async function walkFiles(folder: string, prefix = ""): Promise<Array<{ path: string; size: number }>> {
  const entries = await readdir(path.join(folder, prefix), { withFileTypes: true }).catch(() => []);
  const files: Array<{ path: string; size: number }> = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walkFiles(folder, relative));
    else if (entry.isFile()) files.push({ path: relative, size: (await stat(path.join(folder, relative))).size });
  }
  return files;
}
