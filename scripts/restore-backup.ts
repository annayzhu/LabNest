/**
 * Restores LabNest to one backup: the database as it was, and every attachment file that backup lists.
 *
 *   npx tsx scripts/restore-backup.ts <backup-id> --yes          (list ids: npx tsx scripts/restore-backup.ts)
 *   In the container: docker exec -it labnest-app npx tsx scripts/restore-backup.ts <backup-id> --yes
 *
 * Before touching anything it backs up the current state ("before restore"), so a restore can itself be undone.
 * Then it closes other database connections, empties the public schema, loads the backup, copies back missing or
 * different attachment files (files added later are left alone), and runs pending migrations so an older backup
 * matches the current code. A backup folder unpacked from a downloaded .zip works the same way: point
 * LABNEST_BACKUP_ROOT at it.
 */
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { getAttachmentRoot } from "../src/lib/attachments";
import { checkByRestoring, missingFiles, runBackup } from "../src/lib/backup/engine.server";
import { databaseTarget, restoreDatabase, tableCounts, withClient } from "../src/lib/backup/postgres.server";
import { backupRoot, filesDir, listSnapshots, readManifest, snapshotDir } from "../src/lib/backup/store.server";

async function main() {
  const root = backupRoot();
  if (!root) throw new Error("LABNEST_BACKUP_ROOT is not set.");
  const [id] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!id) {
    for (const snapshot of await listSnapshots(root)) console.log(`${snapshot.id}  ${snapshot.kind}  ${snapshot.verified?.ok ? "checked" : "NOT CHECKED"}`);
    return;
  }
  const manifest = await readManifest(root, id);
  if (!manifest) throw new Error(`No backup ${id} in ${root}.`);
  if (!manifest.verified?.ok && !process.argv.includes("--force")) throw new Error(`Backup ${id} failed its check; pass --force to restore it anyway.`);
  await assertComplete(root, id, manifest.files);
  if (!process.argv.includes("--yes")) {
    console.log(`This replaces the current database with backup ${id} (${manifest.createdAt}). Run again with --yes to go ahead.`);
    return;
  }

  const target = databaseTarget();
  // A nonempty dump can still be corrupt. Prove it restores before making any change to the target database.
  const checked = await checkByRestoring(target, path.join(snapshotDir(root, id), "database.dump"), Object.keys(manifest.tables));
  if (Object.entries(manifest.tables).some(([table, count]) => checked.tables[table] !== count)) {
    throw new Error("The backup's restored row counts do not match its manifest.");
  }
  const listedFiles = new Map(manifest.files.map(file => [file.path, file.size]));
  if (checked.attachments.some(file => listedFiles.get(file.storagePath) !== file.size)) {
    throw new Error("The backup does not contain every attachment referenced by its database.");
  }
  const hasData = await withClient(target, async (client) => (await client.query("select to_regclass('public._prisma_migrations') as name")).rows[0].name !== null);
  if (hasData) {
    const before = await runBackup("pre-restore", { protect: [id] });
    console.log(`Current state saved as backup ${before.id}.`);
  }
  // Checked again right before the database is emptied: nothing past this point may find the backup incomplete.
  await assertComplete(root, id, manifest.files);

  await withClient(target, async (client) => {
    await client.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()");
    await client.query("drop schema public cascade");
    await client.query("create schema public");
  });
  await restoreDatabase(target, path.join(snapshotDir(root, id), "database.dump"));

  const attachments = getAttachmentRoot();
  let copied = 0;
  for (const file of manifest.files) {
    const destination = path.join(attachments, file.path);
    if ((await stat(destination).catch(() => null))?.size === file.size) continue;
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(filesDir(root), file.path), destination);
    copied++;
  }

  const counts = await withClient(target, tableCounts);
  const differing = Object.entries(manifest.tables).filter(([table, count]) => counts[table] !== count);
  if (differing.length) throw new Error(`Restored row counts differ from the backup: ${differing.map(([table]) => table).join(", ")}`);

  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
  if (migrate.status !== 0) throw new Error("prisma migrate deploy failed after the restore.");
  console.log(`Restored backup ${id}: ${Object.keys(counts).length} tables match the backup, ${copied} attachment files copied back. Restart the app container to clear cached pages.`);
}

async function assertComplete(root: string, id: string, files: Array<{ path: string; size: number }>) {
  if (!(await stat(path.join(snapshotDir(root, id), "database.dump")).catch(() => null))?.size) throw new Error(`Backup ${id} has no database dump.`);
  const missing = await missingFiles(root, files);
  if (missing.length) throw new Error(`Backup ${id} is missing ${missing.slice(0, 5).join(", ")}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
