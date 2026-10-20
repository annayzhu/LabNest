"use server";

import { revalidatePath } from "next/cache";
import { BackupError, runBackup } from "@/lib/backup/engine.server";

export type BackupNowState = { ok: boolean; message: string; detail?: string } | null;

export async function backUpNow(): Promise<BackupNowState> {
  try {
    await runBackup("manual");
    return { ok: true, message: "Backup made and checked." };
  } catch (error) {
    const failure = error instanceof BackupError ? error : new BackupError("The backup failed.", String(error));
    return { ok: false, message: failure.message, detail: failure.detail };
  } finally {
    revalidatePath("/settings");
    revalidatePath("/");
  }
}
