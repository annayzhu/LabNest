import { randomBytes } from "node:crypto";
import { copyFile, mkdir, open, rename, rm, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { getAttachmentRoot } from "@/lib/attachments";
import { snapshotsToKeep } from "./policy";
import { databaseTarget, dumpDatabase, latestMigration, restoreDatabase, tableCounts, tableNames, withClient } from "./postgres.server";
import { backupRoot, filesDir, listSnapshots, recordAttempt, snapshotDir, snapshotsDir, walkFiles, writeJson, type BackupKind, type Manifest } from "./store.server";

/** A failure people can read (`message`, a fixed sentence) with the technical cause kept apart (`detail`). */
export class BackupError extends Error {
  constructor(message: string, readonly detail = "") { super(message); }
}

const running = globalThis as unknown as { labnestBackupJob?: Promise<Manifest> };

/**
 * Makes one backup: dumps the database, copies new attachment files, restores the dump into a scratch database to
 * prove it loads, then deletes backups the retention policy no longer keeps. Records the outcome in status.json.
 * Only one runs at a time per process; a lock file also keeps a second process off the same folder. `protect` keeps
 * named backups through the pruning (the one a restore is about to load).
 */
export async function runBackup(kind: BackupKind, options: { protect?: string[] } = {}): Promise<Manifest> {
  const root = backupRoot();
  if (!root) throw new BackupError("Backups are not set up.", "LABNEST_BACKUP_ROOT is not set.");
  if (running.labnestBackupJob) throw new BackupError("A backup is already running.");
  const startedAt = new Date();
  const job = (async () => {
    const release = await lock(root);
    try {
      const manifest = await createSnapshot(root, kind, startedAt);
      await recordAttempt(root, { at: startedAt.toISOString(), ok: true }, { id: manifest.id });
      // Pruning only frees space; a failure there must not turn a good backup into a failed one.
      await prune(root, options.protect ?? []).catch((error) => console.error("[LabNest] Pruning old backups failed:", error));
      return manifest;
    } catch (error) {
      const failure = error instanceof BackupError ? error : new BackupError("The backup failed.", String(error));
      await recordAttempt(root, { at: startedAt.toISOString(), ok: false, error: failure.message, detail: failure.detail });
      throw failure;
    } finally {
      await release();
    }
  })();
  running.labnestBackupJob = job;
  try {
    return await job;
  } finally {
    running.labnestBackupJob = undefined;
  }
}

export const backupRunning = () => Boolean(running.labnestBackupJob);

async function createSnapshot(root: string, kind: BackupKind, startedAt: Date): Promise<Manifest> {
  const id = await freeId(root, startedAt);
  const partial = `${snapshotDir(root, id)}.partial`;
  try {
    await mkdir(partial, { recursive: true });
    await mkdir(filesDir(root), { recursive: true });
  } catch (error) {
    throw new BackupError("The backup folder cannot be written.", `${root}: ${String(error)}`);
  }
  const source = databaseTarget();
  const dump = path.join(partial, "database.dump");
  await dumpDatabase(source, dump).catch((error) => { throw new BackupError("The database could not be exported.", String(error)); });
  const files = await copyAttachments(root);
  const manifest: Manifest = {
    id, kind, createdAt: startedAt.toISOString(), migration: null,
    database: { file: "database.dump", size: (await stat(dump)).size },
    tables: {}, files, verified: null,
  };
  let failure: BackupError | null = null;
  try {
    const restored = await checkByRestoring(source, dump);
    Object.assign(manifest, { tables: restored.tables, migration: restored.migration });
    const copied = new Map(files.map(file => [file.path, file.size]));
    const absent = restored.attachments.filter(file => copied.get(file.storagePath) !== file.size);
    if (absent.length) throw new BackupError("Some attachment files are missing from the backup.", absent.slice(0, 5).map(file => file.storagePath).join(", "));
    const missing = await missingFiles(root, files);
    if (missing.length) throw new BackupError("Some attachment files are missing from the backup.", missing.slice(0, 5).join(", "));
    manifest.verified = { at: new Date().toISOString(), ok: true };
  } catch (error) {
    failure = error instanceof BackupError ? error : new BackupError("The backup could not be checked by restoring it.", String(error));
    manifest.verified = { at: new Date().toISOString(), ok: false, error: failure.message };
  }
  await writeJson(path.join(partial, "manifest.json"), manifest);
  await rename(partial, snapshotDir(root, id));
  if (failure) throw failure;
  return manifest;
}

/** Attachment files are never changed after upload, so a file already in the backup with the same size is the same file. */
async function copyAttachments(root: string) {
  const source = getAttachmentRoot();
  const files = await walkFiles(source);
  try {
    for (const file of files) {
      const target = path.join(filesDir(root), file.path);
      const existing = await stat(target).catch(() => null);
      if (existing?.size === file.size) continue;
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(source, file.path), target);
    }
  } catch (error) {
    throw new BackupError("Attachment files could not be copied.", String(error));
  }
  return files;
}

/** Restores the dump into a throwaway database; returns what it holds. Fails if a table is missing or the load errors. */
export async function checkByRestoring(source: ReturnType<typeof databaseTarget>, dump: string, expectedTables?: string[]) {
  const scratch = databaseTarget(undefined, `labnest_backup_check_${randomBytes(4).toString("hex")}`);
  const expected = await withClient(source, async (client) => {
    await client.query(`create database "${scratch.database}"`);
    return expectedTables ?? tableNames(client);
  });
  try {
    await restoreDatabase(scratch, dump).catch((error) => { throw new BackupError("The backup could not be checked by restoring it.", String(error)); });
    return await withClient(scratch, async (client) => {
      const tables = await tableCounts(client);
      const absent = expected.filter((name) => !(name in tables));
      if (absent.length) throw new BackupError("The restored backup is missing tables.", absent.join(", "));
      const attachments = tables.Attachment === undefined ? [] : (await client.query<{ storagePath: string; size: number }>('select "storagePath", size from "Attachment"')).rows;
      return { tables, attachments, migration: await latestMigration(client) };
    });
  } finally {
    await withClient(source, (client) => client.query(`drop database if exists "${scratch.database}" with (force)`)).catch(() => {});
  }
}

/** Listed attachment files that are absent from the backup folder or have a different size. */
export async function missingFiles(root: string, files: Manifest["files"]) {
  const missing: string[] = [];
  for (const file of files) {
    const copy = await stat(path.join(filesDir(root), file.path)).catch(() => null);
    if (copy?.size !== file.size) missing.push(file.path);
  }
  return missing;
}

/**
 * Keeps what snapshotsToKeep chooses among checked backups, plus failed ones newer than the newest good one (so a
 * failure stays visible until a good backup follows); then deletes attachment copies no kept snapshot lists.
 */
async function prune(root: string, protect: string[]) {
  const snapshots = await listSnapshots(root);
  const good = snapshots.filter((snapshot) => snapshot.verified?.ok);
  const keep = snapshotsToKeep(good.map((snapshot) => ({ id: snapshot.id, createdAt: new Date(snapshot.createdAt) })), protect);
  const newestGood = good[0]?.createdAt ?? "";
  for (const snapshot of snapshots) {
    if (keep.has(snapshot.id) || (!snapshot.verified?.ok && snapshot.createdAt > newestGood)) continue;
    await rm(snapshotDir(root, snapshot.id), { recursive: true, force: true });
  }
  for (const name of await readdir(snapshotsDir(root)).catch(() => [] as string[])) {
    if (!name.endsWith(".partial")) continue;
    const folder = path.join(snapshotsDir(root), name);
    const info = await stat(folder).catch(() => null);
    if (info && Date.now() - info.mtimeMs > 24 * 60 * 60 * 1000) await rm(folder, { recursive: true, force: true });
  }
  const referenced = new Set((await listSnapshots(root)).flatMap((snapshot) => snapshot.files.map((file) => file.path)));
  for (const file of await walkFiles(filesDir(root))) {
    if (!referenced.has(file.path)) await rm(path.join(filesDir(root), file.path), { force: true });
  }
}

async function freeId(root: string, at: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const base = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  for (let suffix = 0; ; suffix++) {
    const id = suffix ? `${base}-${suffix}` : base;
    if (!await stat(snapshotDir(root, id)).catch(() => null)) return id;
  }
}

/** A lock file older than three hours is left over from a crash and is taken over. */
async function lock(root: string) {
  const file = path.join(root, ".running");
  await mkdir(root, { recursive: true }).catch((error) => { throw new BackupError("The backup folder cannot be written.", `${root}: ${String(error)}`); });
  const info = await stat(file).catch(() => null);
  if (info && Date.now() - info.mtimeMs > 3 * 60 * 60 * 1000) await rm(file, { force: true });
  const handle = await open(file, "wx").catch(() => { throw new BackupError("A backup is already running."); });
  await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`);
  await handle.close();
  return () => rm(file, { force: true });
}
