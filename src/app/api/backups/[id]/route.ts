import { createReadStream } from "node:fs";
import path from "node:path";
import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { backupRoot, filesDir, readManifest, snapshotDir } from "@/lib/backup/store.server";

export const runtime = "nodejs";

const readme = `LabNest backup / LabNest 备份

This archive has the same layout as the backup folder, holding one backup:
  snapshots/<id>/manifest.json, snapshots/<id>/database.dump, files/...
To restore, unpack it, point LABNEST_BACKUP_ROOT at the unpacked folder and run
  npx tsx scripts/restore-backup.ts <id> --yes
AI keys are not included: enter them again in AI settings after restoring on another computer.

本压缩包与备份文件夹结构相同，只含这一份备份。恢复时解压，把 LABNEST_BACKUP_ROOT 指向解压后的文件夹，再运行上面的命令。
备份不含 AI 密钥的解密钥匙：在另一台电脑上恢复后，请在 AI 设置里重新填写 API 密钥。
`;

/** One backup as a .zip in the backup folder's own layout, streamed file by file. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const root = backupRoot();
  const { id } = await context.params;
  const manifest = root ? await readManifest(root, id) : null;
  if (!root || !manifest) return Response.json({ error: "Backup not found." }, { status: 404 });

  const entries: Array<[string, string]> = [
    [`snapshots/${id}/manifest.json`, path.join(snapshotDir(root, id), "manifest.json")],
    [`snapshots/${id}/database.dump`, path.join(snapshotDir(root, id), "database.dump")],
    ...manifest.files.map((file): [string, string] => [`files/${file.path}`, path.join(filesDir(root), file.path)]),
  ];
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (error) return controller.error(error);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        const note = new ZipPassThrough("README.txt");
        zip.add(note);
        note.push(strToU8(readme), true);
        for (const [name, file] of entries) {
          // Stored, not deflated: the dump is already compressed and most attachments are images.
          const entry = new ZipPassThrough(name);
          zip.add(entry);
          for await (const chunk of createReadStream(file)) entry.push(chunk as Uint8Array);
          entry.push(new Uint8Array(0), true);
        }
        zip.end();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="labnest-backup-${id}.zip"`, "Cache-Control": "no-store" },
  });
}
