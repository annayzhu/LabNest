/**
 * Makes one backup now, the same way the daily schedule and the Settings button do.
 *   npx tsx scripts/backup-now.ts [manual|pre-release]
 * In the container: docker exec labnest-app npx tsx scripts/backup-now.ts pre-release
 */
import { runBackup, BackupError } from "../src/lib/backup/engine.server";

const kind = process.argv[2] === "pre-release" ? "pre-release" : "manual";
runBackup(kind).then((manifest) => {
  console.log(`Backup ${manifest.id} (${kind}): database ${manifest.database.size} bytes, ${Object.keys(manifest.tables).length} tables, ${manifest.files.length} files, checked by restoring.`);
}, (error) => {
  console.error(error instanceof BackupError ? `${error.message} ${error.detail}` : error);
  process.exit(1);
});
