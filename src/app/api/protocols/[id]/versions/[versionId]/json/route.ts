import { protocolVersionTransferExport } from "@/lib/structured-export";

export const runtime = "nodejs";

/** The version on screen as the file another LabNest imports: the same file the Protocol list exports. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await context.params;
  try {
    const exported = await protocolVersionTransferExport(id, versionId);
    if (!exported) return Response.json({ error: "Protocol version not found." }, { status: 404 });
    return new Response(exported.body, { headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The export could not be generated." }, { status: 400 });
  }
}
