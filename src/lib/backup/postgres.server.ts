import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { Client } from "pg";

/**
 * The database behind DATABASE_URL. Command-line tools get `url` (no password) and read PGPASSWORD, so the password never
 * shows in a process list; the in-process client uses `connection`. Prisma's `?schema=` parameter is dropped because libpq rejects it.
 */
export function databaseTarget(databaseUrl = process.env.DATABASE_URL, database?: string) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  const url = new URL(databaseUrl);
  url.search = "";
  if (database) url.pathname = `/${database}`;
  const connection = url.toString();
  const password = decodeURIComponent(url.password);
  url.password = "";
  return { url: url.toString(), connection, password, database: decodeURIComponent(url.pathname.slice(1)) };
}

type Target = ReturnType<typeof databaseTarget>;

export async function withClient<T>(target: Target, work: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: target.connection });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function tableNames(client: Client) {
  const tables = await client.query<{ name: string }>(
    "select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  return tables.rows.map(row => row.name);
}

/** Row count of every table in the public schema, by table name. */
export async function tableCounts(client: Client) {
  const counts: Record<string, number> = {};
  for (const name of await tableNames(client)) {
    const result = await client.query<{ count: string }>(`select count(*) as count from "${name.replaceAll('"', '""')}"`);
    counts[name] = Number(result.rows[0].count);
  }
  return counts;
}

export async function latestMigration(client: Client) {
  const result = await client.query<{ name: string }>(
    "select migration_name as name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by finished_at desc limit 1",
  );
  return result.rows[0]?.name ?? null;
}

/** pg_dump of the whole database in custom (compressed) format, written to `file`. */
export function dumpDatabase(target: Target, file: string) {
  return runTool("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--dbname=${target.url}`], target, { output: file });
}

/** Loads a dump made by dumpDatabase into the (empty) database `target`; stops at the first error. */
export function restoreDatabase(target: Target, file: string) {
  return runTool("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", `--dbname=${target.url}`], target, { input: file });
}

/**
 * Runs a Postgres client tool, streaming files through stdin/stdout rather than passing paths, so the tool may run
 * elsewhere: LABNEST_PG_BIN can point at wrappers that run it inside the database container (scripts/pg-docker).
 */
function runTool(name: string, args: string[], target: Target, io: { input?: string; output?: string }) {
  const folder = process.env.LABNEST_PG_BIN;
  const command = folder ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), folder, name) : name;
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, PGPASSWORD: target.password },
      stdio: [io.input ? "pipe" : "ignore", io.output ? "pipe" : "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr!.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-2000); });
    const written = io.output ? finished(child.stdout!.pipe(createWriteStream(io.output))) : Promise.resolve();
    if (io.input) createReadStream(io.input).on("error", reject).pipe(child.stdin!);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`${name} exited with ${code}: ${stderr.trim() || "no message"}`));
      written.then(() => resolve(), reject);
    });
  });
}
