import { exportProtocolDocxTemplate, protocolDocxTemplateFilename } from "@/lib/protocol-docx-template";

/** The one Word template; links to the older ones (?example=…) get it too. */
export async function GET() {
  const bytes = exportProtocolDocxTemplate();
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${protocolDocxTemplateFilename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
