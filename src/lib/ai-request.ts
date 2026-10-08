/** Browser-only AI calls require same-origin consent and JSON, even while AI is enabled. */
export function validateAIRequest(request: Request): { error: string; status: number } | undefined {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: "AI requests require application/json.", status: 415 };
  }
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const host = request.headers.get("host") ?? new URL(request.url).host;
    if (!["http:", "https:"].includes(origin.protocol) || origin.host !== host || origin.username || origin.password) throw new Error("origin");
  } catch {
    return { error: "AI calls require an explicit request from the LabNest page on this origin.", status: 403 };
  }
}
