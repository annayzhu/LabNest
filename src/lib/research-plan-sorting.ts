import type { Prisma } from "@/generated/prisma/client";

export const researchPlanSortOptions = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "title_asc", label: "Name A–Z" },
  { value: "experiments_desc", label: "Most experiments first" },
  { value: "status_asc", label: "Status" },
] as const;

export type ResearchPlanSort = (typeof researchPlanSortOptions)[number]["value"];

export function normalizeResearchPlanSort(value?: string): ResearchPlanSort {
  return researchPlanSortOptions.some((option) => option.value === value)
    ? value as ResearchPlanSort
    : "updated_desc";
}

export function researchPlanOrderBy(value?: string): Prisma.ResearchPlanOrderByWithRelationInput[] {
  const sort = normalizeResearchPlanSort(value);
  if (sort === "title_asc") return [{ title: "asc" }, { code: "asc" }];
  if (sort === "experiments_desc") return [{ experiments: { _count: "desc" } }, { title: "asc" }];
  if (sort === "status_asc") return [{ status: "asc" }, { title: "asc" }];
  return [{ updatedAt: "desc" }, { title: "asc" }];
}
