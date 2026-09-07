import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { prisma } from "@/lib/db";
import { resolveAttachmentPath } from "@/lib/attachments";

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean))];
  if (!ids.length || ids.length > 100 || ids.some(id => !/^[a-zA-Z0-9_-]+$/.test(id))) return Response.json({ error: "Choose 1–100 attachments." }, { status: 400 });
  const attachments = await prisma.attachment.findMany({ where: { id: { in: ids } } });
  if (attachments.length !== ids.length) return Response.json({ error: "附件缺失，未生成不完整的附件包。 / Missing attachment; package cancelled." }, { status: 409 });
  if (attachments.reduce((sum, attachment) => sum + attachment.size, 0) > 100 * 1024 * 1024) return Response.json({ error: "附件包超过 100 MB，请分批下载。 / Package exceeds 100 MB." }, { status: 413 });
  const files: Record<string, Uint8Array> = {};
  try {
    for (const id of ids) {
      const attachment = attachments.find(item => item.id === id)!;
      const name = attachment.originalFilename.replace(/[\\/\x00-\x1f]/g, "_");
      files[`${id}/${name}`] = await readFile(resolveAttachmentPath(attachment.storagePath));
    }
  } catch { return Response.json({ error: "原文件不可读取，附件包已取消。 / Original unavailable; package cancelled." }, { status: 410 }); }
  files["README.txt"] = strToU8("附件包 / Attachment package\n请与导出的 Word/PDF 文档一起分享。文件夹为稳定附件编号，内部保留原始文件名。\nShare with the exported Word/PDF. Folders identify attachments; files retain their original names. Original research files are unchanged.\n");
  return new Response(zipSync(files), { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="LabNest-attachments.zip"' } });
}
