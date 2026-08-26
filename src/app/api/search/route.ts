import { searchLabNestRecords, type GlobalSearchResult } from "@/lib/global-search";

export const runtime = "nodejs";

function response(results: GlobalSearchResult[], query: string) {
  return Response.json({
    query,
    count: results.length,
    results,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  if (!query) {
    return response([], query);
  }

  return response(await searchLabNestRecords(query, limit), query);
}
