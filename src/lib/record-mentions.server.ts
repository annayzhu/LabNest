import { prisma } from "./db";

/** A record whose text names a sample, product or lot: by a "/样本" or "/库存物品" tag, or in a plate layout (Q253). */
export type RecordMention = { kind: "entry" | "experiment" | "result" | "research_plan" | "report"; id: string; title: string; code: string | null; at: Date; archived: boolean; href: string };

const paths: Record<RecordMention["kind"], string> = { entry: "/entries", experiment: "/experiments", result: "/results", research_plan: "/research-plans", report: "/reports" };

/**
 * The Entries, experiments, results, plans and reports whose saved text holds any of these IDs, newest first.
 * Looked up when the page opens, from the documents themselves: nothing is stored, so a deleted or restored record is
 * simply found or not. Tags and plate wells both keep the record's ID in the text.
 */
export async function recordMentions(ids: string[]): Promise<RecordMention[]> {
  const patterns = [...new Set(ids)].filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id)).map((id) => `%${id.replace(/[\\%_]/g, "\\$&")}%`);
  if (!patterns.length) return [];
  const rows = await prisma.$queryRaw<Array<Omit<RecordMention, "href">>>`
    SELECT 'entry' AS kind, id, title, NULL AS code, "occurredAt" AS at, ("archivedAt" IS NOT NULL) AS archived FROM "Entry" WHERE "contentJson"::text LIKE ANY(${patterns})
    UNION ALL SELECT 'experiment', id, title, "runCode", "date", ("status" = 'archived') FROM "Experiment" WHERE "contentJson"::text LIKE ANY(${patterns})
    UNION ALL SELECT 'result', id, title, NULL, "updatedAt", ("status" = 'archived') FROM "Result" WHERE "contentJson"::text LIKE ANY(${patterns})
    UNION ALL SELECT 'research_plan', id, title, code, "updatedAt", ("status" = 'archived') FROM "ResearchPlan" WHERE "contentJson"::text LIKE ANY(${patterns})
    UNION ALL SELECT 'report', id, title, NULL, "updatedAt", ("status" = 'archived') FROM "Report" WHERE "contentJson"::text LIKE ANY(${patterns})
    ORDER BY at DESC LIMIT 200`;
  return rows.map((row) => ({ ...row, href: `${paths[row.kind]}/${row.id}` }));
}
