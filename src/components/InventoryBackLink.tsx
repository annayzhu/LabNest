"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

// A detail page's back link returns to the inventory page the user came from: the home, or a list with the search
// and filters it had (Q173). The place is kept for this browser tab only.
const storageKey = "labnest.inventory.return";
type ReturnPoint = { href: string; label: string };

/** Marks this page, with its search and filters, as where inventory detail pages go back to. */
export function InventoryReturnPoint({ href, label }: ReturnPoint) {
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ href, label })); } catch { /* storage may be blocked; the back link falls back */ }
  }, [href, label]);
  return null;
}

/** Back to the inventory page the user came from, or to the given page when there is none. */
export function InventoryBackLink({ href, label }: ReturnPoint) {
  // The server renders the given page; the browser then reads where this tab came from.
  const saved = parse(useSyncExternalStore(unchanging, readReturnPoint, () => null));
  const target = typeof saved?.href === "string" && saved.href.startsWith("/inventory") && saved.label ? saved : { href, label };
  return (
    <Link href={target.href} className="focus-ring -ml-1 inline-flex min-h-8 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] px-1 text-sm text-graphite hover:text-moss">
      <ArrowLeft className="h-4 w-4" aria-hidden /><span>{target.label}</span>
    </Link>
  );
}

const unchanging = () => () => {};

function readReturnPoint() {
  try { return sessionStorage.getItem(storageKey); } catch { return null; }
}

function parse(raw: string | null) {
  try { return raw ? JSON.parse(raw) as ReturnPoint : null; } catch { return null; }
}
