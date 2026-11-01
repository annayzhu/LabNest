"use client";

import { useEffect, useState } from "react";
import type { RecordReferenceKind } from "@/lib/record-references";
import type { ReferenceDetails } from "@/lib/record-references.server";

// Every tag on a page asks once; the asks of one moment go out as one request. An answer is reused for a minute.
type Entry = { at: number; done: boolean; value: ReferenceDetails | null | undefined; listeners: Set<() => void> };
const entries = new Map<string, Entry>();
const FRESH_MS = 60_000;
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function settle(key: string, value: ReferenceDetails | null | undefined) {
  const entry = entries.get(key);
  if (!entry) return;
  Object.assign(entry, { done: true, value, at: Date.now() });
  entry.listeners.forEach((listener) => listener());
}

function flush() {
  const keys = [...queue];
  queue = new Set();
  timer = null;
  for (let start = 0; start < keys.length; start += 100) {
    const chunk = keys.slice(start, start + 100);
    fetch(`/api/references?refs=${encodeURIComponent(chunk.join(","))}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ results: Record<string, ReferenceDetails | null> }> : Promise.reject(new Error(String(response.status))))
      // Offline or failed: the state stays unknown (undefined), never "deleted".
      .then(({ results }) => chunk.forEach((key) => settle(key, key in results ? results[key] : undefined)), () => chunk.forEach((key) => settle(key, undefined)));
  }
}

function request(key: string) {
  const entry = entries.get(key);
  if (entry && (!entry.done || Date.now() - entry.at < FRESH_MS)) return entry;
  const next: Entry = { at: Date.now(), done: false, value: entry?.value, listeners: entry?.listeners ?? new Set() };
  entries.set(key, next);
  queue.add(key);
  timer ??= setTimeout(flush, 20);
  return next;
}

/** How a referenced sample or stock record stands now: `missing` once it is deleted, `details` undefined while unknown. */
export function useRecordReferenceDetails(kind: RecordReferenceKind, id: string) {
  const key = `${kind}:${id}`;
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!id) return;
    const entry = request(key);
    const listener = () => setVersion((version) => version + 1);
    entry.listeners.add(listener);
    return () => { entry.listeners.delete(listener); };
  }, [key, id]);
  const entry = entries.get(key);
  return { loading: !entry?.done, details: entry?.value ?? undefined, missing: Boolean(entry?.done && entry.value === null) };
}
