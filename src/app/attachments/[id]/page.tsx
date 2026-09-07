import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProtocolMediaImage } from "@/components/ProtocolMediaImage";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AttachmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) notFound();
  const href = `/api/attachments/${encodeURIComponent(id)}`;
  const preview = `${href}?inline=1`;
  const image = /^image\/(png|jpeg|gif|webp|avif)$/.test(attachment.mimeType);
  const audio = attachment.mimeType.startsWith("audio/");
  const video = attachment.mimeType.startsWith("video/");
  return <AppShell><main className="mx-auto max-w-5xl space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-3">
      <div className="min-w-0"><h1 className="break-all text-lg font-semibold text-ink">{attachment.originalFilename}</h1><p className="text-sm text-muted">{attachment.mimeType} · {Math.ceil(attachment.size / 1024)} KB</p></div>
      <a href={href} download className="inline-flex min-h-11 items-center gap-2 text-sm text-moss"><Download className="h-4 w-4" aria-hidden />下载原文件 / Download original</a>
    </header>
    {image ? <ProtocolMediaImage href={preview} label={attachment.originalFilename} /> : audio ? <audio controls preload="metadata" src={preview} className="w-full">浏览器无法播放，请下载原文件。 / Download to play.</audio> : video ? <video controls preload="metadata" src={preview} className="max-h-[70vh] w-full">浏览器无法播放，请下载原文件。 / Download to play.</video> : attachment.mimeType === "application/pdf" ? <iframe src={preview} title={attachment.originalFilename} className="h-[75vh] w-full border border-hairline" /> : <p className="py-8 text-sm text-muted">此格式不支持在线预览，请下载后打开。 / Download this format to open it.</p>}
    <p className="text-sm text-muted">正文中的尺寸调整不改变原文件。离线分享请同时提供文档和附件。 / Display resizing keeps the original intact. Include attachments when sharing offline.</p>
  </main></AppShell>;
}
