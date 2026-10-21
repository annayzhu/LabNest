export async function register() {
  // The daily backup runs inside the Node.js server process; it needs the file system and the Postgres tools.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupSchedule } = await import("./lib/backup/schedule.server");
    startBackupSchedule();
  }
}
