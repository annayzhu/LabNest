/** Real PostgreSQL round-trip checks. Run only against the disposable labnest_backup_qa database. */
import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { runBackup } from "../src/lib/backup/engine.server";
import { databaseTarget, withClient } from "../src/lib/backup/postgres.server";
import { readStatus, snapshotDir } from "../src/lib/backup/store.server";

async function main() {
  const target = databaseTarget();
  assert.equal(target.database, "labnest_backup_qa", "Only the disposable backup QA database is allowed.");
  assert(["localhost", "127.0.0.1"].includes(new URL(target.connection).hostname));
  const root = await mkdtemp(path.join(tmpdir(), "labnest-backup-qa-"));
  process.env.LABNEST_BACKUP_ROOT = path.join(root, "backups");
  process.env.LABNEST_ATTACHMENT_ROOT = path.join(root, "attachments");
  const attachment = Buffer.from("synthetic attachment for backup round-trip");
  const id = `backup-qa-${Date.now()}`;
  const body = async () => withClient(target, async client => (await client.query('select body from "Entry" where id=$1', [id])).rows[0]?.body);
  const restore = (snapshot: string) => spawnSync(process.execPath, ["--import", "tsx", "scripts/restore-backup.ts", snapshot, "--yes"], { env: process.env, encoding: "utf8" });
  try {
    await mkdir(process.env.LABNEST_ATTACHMENT_ROOT, { recursive: true });
    await writeFile(path.join(process.env.LABNEST_ATTACHMENT_ROOT, `${id}.txt`), attachment);
    await prisma.entry.create({ data: { id, title: "Synthetic backup test", body: "before" } });
    await prisma.attachment.create({ data: { id, filename: `${id}.txt`, originalFilename: "synthetic.txt", mimeType: "text/plain", size: attachment.length, storagePath: `${id}.txt` } });
    await prisma.$disconnect();
    const snapshot = await runBackup("manual");
    assert(snapshot.verified?.ok);
    const dumpPath = path.join(snapshotDir(process.env.LABNEST_BACKUP_ROOT, snapshot.id), "database.dump");
    const dump = await readFile(dumpPath);
    await withClient(target, client => client.query('update "Entry" set body=$1 where id=$2', ["after", id]));
    await writeFile(dumpPath, "a nonempty but corrupt dump");
    assert.notEqual(restore(snapshot.id).status, 0);
    assert.equal(await body(), "after", "A corrupt backup must leave the current database intact.");
    await writeFile(dumpPath, dump);
    await rm(path.join(process.env.LABNEST_ATTACHMENT_ROOT, `${id}.txt`));
    await assert.rejects(runBackup("manual"), /attachment files are missing/);
    assert.equal((await readStatus(process.env.LABNEST_BACKUP_ROOT)).lastSuccess?.id, snapshot.id);
    await writeFile(path.join(process.env.LABNEST_ATTACHMENT_ROOT, `${id}.txt`), attachment);
    const result = restore(snapshot.id);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(await body(), "before");
    assert.deepEqual(await readFile(path.join(process.env.LABNEST_ATTACHMENT_ROOT, `${id}.txt`)), attachment);
    const scratch = await withClient(target, client => client.query("select datname from pg_database where datname like 'labnest_backup_check_%'"));
    assert.equal(scratch.rowCount, 0, "Scratch databases must be removed after success and failure.");
    console.log("PASS: backup, corrupt-dump refusal without data changes, missing-original refusal, restore, attachment readback, scratch cleanup");
  } finally {
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
