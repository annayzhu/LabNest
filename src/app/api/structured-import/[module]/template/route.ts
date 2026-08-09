import { buildStructuredTemplate } from "@/lib/structured-files";
import { formatFromFilename, isStructuredModuleKey, structuredModules, type StructuredFileFormat } from "@/lib/structured-modules";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  if (!isStructuredModuleKey(module)) return Response.json({ error: "Unknown structured import module." }, { status: 404 });
  const requested = new URL(request.url).searchParams.get("format") ?? "";
  const format = formatFromFilename(`template.${requested}`) as StructuredFileFormat | undefined;
  if (!format || !structuredModules[module].importFormats.includes(format)) return Response.json({ error: "Unsupported template format." }, { status: 400 });
  try {
    const template = await buildStructuredTemplate(module, format);
    const body = template.body instanceof Uint8Array
      ? template.body.buffer.slice(template.body.byteOffset, template.body.byteOffset + template.body.byteLength) as ArrayBuffer
      : template.body;
    return new Response(body, { headers: {
      "Content-Type": template.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(template.filename)}`,
      "Cache-Control": "no-store, max-age=0",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The template could not be generated." }, { status: 400 });
  }
}
