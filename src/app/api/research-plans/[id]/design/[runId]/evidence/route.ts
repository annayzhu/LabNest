import { z } from "zod";
import { validateAIRequest } from "@/lib/ai-request";
import { prepareDesignStep } from "@/lib/copilot/plan-design/deps.server";
import { relations } from "@/lib/copilot/plan-design/evidence";
import { evidenceDesignRun, type EvidenceRequest } from "@/lib/copilot/plan-design/runs.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const request = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("terms") }),
  z.object({ kind: z.literal("search") }),
  z.object({ kind: z.literal("read"), key: z.string().max(40) }),
  z.object({ kind: z.literal("add"), identifier: z.string().trim().min(4).max(200), quote: z.string().max(1200).default(""), target: z.string().max(24), relation: z.enum(relations), system: z.string().max(300).default("") }),
  z.object({ kind: z.literal("quote"), entryId: z.string().max(12), quote: z.string().max(1200) }),
]);
const MAX_PDF = 40 * 1024 * 1024;

/**
 * A request on the design's evidence ledger: draft search terms, search Europe PMC (PubMed when it fails), read one
 * result, add a paper by PMID, PMCID or DOI (multipart, with an optional PDF), or check an edited quote again.
 */
export async function POST(incoming: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const multipart = incoming.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data") ?? false;
  const boundary = validateAIRequest(incoming, multipart ? "multipart/form-data" : "application/json");
  if (boundary) return Response.json({ error: boundary.error }, { status: boundary.status });
  let body: unknown, pdf: File | undefined;
  if (multipart) {
    const form = await incoming.formData().catch(() => null);
    const file = form?.get("pdf");
    if (file instanceof File && file.size) {
      if (file.size > MAX_PDF || !/\.pdf$/i.test(file.name)) return Response.json({ error: "Attach a PDF of at most 40 MB" }, { status: 400 });
      pdf = file;
    }
    body = form ? Object.fromEntries([...form.entries()].filter(([key]) => key !== "pdf")) : null;
  } else body = await incoming.json().catch(() => null);
  const parsed = request.safeParse(body);
  if (!parsed.success) return Response.json({ error: "无效的请求" }, { status: 400 });
  const { id, runId } = await params;
  const evidence: EvidenceRequest = parsed.data.kind === "add" ? { ...parsed.data, pdf } : parsed.data;
  try { return Response.json({ run: await evidenceDesignRun(id, runId, evidence, purpose => prepareDesignStep(id, purpose)) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "没有完成" }, { status: 409 }); }
}
