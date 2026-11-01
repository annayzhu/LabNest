import { z } from "zod";
import { exportOrganizedDraftDocx } from "@/lib/protocol-docx-template";
import { acceptsRequestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

const body = z.object({ habitText: z.string().min(1).max(400_000), title: z.string().max(200).optional() });

/** 下载为 Word 模板: the organized draft on the page, as the import template; no AI, nothing saved. */
export async function POST(request: Request) {
  if (!acceptsRequestOrigin(request)) return Response.json({ error: "Origin mismatch" }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "There is no draft to download" }, { status: 400 });
  const { bytes, filename } = exportOrganizedDraftDocx(parsed.data.habitText, parsed.data.title);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
