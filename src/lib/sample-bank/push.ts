import type { SampleBankResultPush } from "./contract";

export type SearchStatus = "sent" | "accepted" | "rejected" | "receiving" | "complete" | "failed";
export type SearchProgress = { status: SearchStatus; pageCount: number | null; pagesReceived: number[]; total: number | null };

/** A search not finished a day after it was sent shows as timed out; pages that arrive later are still taken (S21). */
export const SEARCH_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * What a pushed page does to its search. A page already received changes nothing; the search is complete once every
 * page from 1 to pageCount has arrived, whatever order they came in, and failed as soon as a page says so.
 */
export function afterPush(search: SearchProgress, push: Pick<SampleBankResultPush, "page" | "pageCount" | "status" | "total">) {
  if (search.pagesReceived.includes(push.page)) return { duplicate: true as const };
  const pagesReceived = [...search.pagesReceived, push.page].sort((a, b) => a - b);
  const pageCount = Math.max(push.pageCount, search.pageCount ?? 0);
  const allThere = Array.from({ length: pageCount }, (_, index) => index + 1).every((page) => pagesReceived.includes(page));
  const status: SearchStatus = push.status === "failed" || search.status === "failed" ? "failed" : allThere ? "complete" : "receiving";
  return { duplicate: false as const, pagesReceived, pageCount, total: push.total ?? search.total, status };
}

/** The state to show: a search still waiting a day after it was sent reads as timed out. */
export function searchState(search: { status: SearchStatus; requestedAt: Date }, now = new Date()) {
  const waiting = search.status === "sent" || search.status === "accepted" || search.status === "receiving";
  return waiting && now.getTime() - search.requestedAt.getTime() > SEARCH_TIMEOUT_MS ? "timed_out" as const : search.status;
}

export const searchStateLabels: Record<ReturnType<typeof searchState>, string> = {
  sent: "Sent",
  accepted: "Accepted, waiting for results",
  rejected: "Refused",
  receiving: "Receiving",
  complete: "Complete",
  failed: "Failed",
  timed_out: "Timed out",
};
