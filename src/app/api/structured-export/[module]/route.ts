import { buildStructuredExport } from "@/lib/structured-export";
import { formatFromFilename, isStructuredModuleKey, structuredModules, type StructuredFileFormat } from "@/lib/structured-modules";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!isStructuredModuleKey(module)) return Response.json({ error: "Unknown structured export module." }, { status: 404 });
  const searchParams = new URL(request.url).searchParams;
  const requested = searchParams.get("format") ?? "";
  const format = formatFromFilename(`export.${requested}`) as StructuredFileFormat | undefined;
  if (!format || !structuredModules[module].exportFormats.includes(format)) return Response.json({ error: "Unsupported export format." }, { status: 400 });
  try {
    const requestedScope = searchParams.get("exportScope") ?? "all";
    if (!["all", "filtered", "selected"].includes(requestedScope)) return Response.json({ error: "Unsupported export scope." }, { status: 400 });
    const ids = [...new Set(searchParams.getAll("id").filter(Boolean))];
    if (ids.length > 500) return Response.json({ error: "A selected export is limited to 500 records." }, { status: 400 });
    if (requestedScope === "selected" && !ids.length) return Response.json({ error: "Select at least one record before exporting." }, { status: 400 });
    const filters = Object.fromEntries(
      [...searchParams.entries()]
        .filter(([key, value]) => !["format", "exportScope", "id"].includes(key) && value.length <= 240)
        .slice(0, 20),
    );
    const exported = await buildStructuredExport(module, format, {
      scope: requestedScope as "all" | "filtered" | "selected",
      ids,
      filters,
    });
    return new Response(exported.body, { headers: {
      "Content-Type": exported.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The export could not be generated." }, { status: 400 });
  }
}
