import { redirect } from "next/navigation";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
export default async function ActionsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const filters = new URLSearchParams();
  for (const key of ["status", "type"]) { const value = firstSearchParam(params, key); if (value) filters.set(key, value); }
  redirect(filters.size ? `/actions/review?${filters}` : "/ai");
}
