import { ManualCopyPasteProvider, manualCopyPasteProviderConfig } from "@/lib/ai";
import { z } from "zod";

export const runtime = "nodejs";

const parseRequestSchema = z.object({
  rawResponse: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const parsed = parseRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
    const actions = provider.parseResponse(parsed.data.rawResponse);

    return Response.json({
      status: "validated",
      count: actions.length,
      actions,
      note: "These are proposed actions only. LabNest has not mutated any record.",
    });
  } catch (error) {
    return Response.json(
      {
        status: "invalid",
        error: error instanceof Error ? error.message : "Could not parse manual AI response.",
      },
      { status: 400 },
    );
  }
}
