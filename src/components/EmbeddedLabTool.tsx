"use client";
import { useState } from "react";
export function EmbeddedLabTool({ id, title, fullPage = false }: { id: string; title: string; fullPage?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return <section aria-label={title} className={fullPage?"flex min-h-0 min-w-0 flex-1 flex-col":"min-w-0 flex-1"}>
    {!loaded ? <p role="status" className="px-4 py-2 text-sm text-muted">正在打开工具…</p> : null}
    <iframe title={title} src={`/tools/${id}/index.html`} onLoad={() => setLoaded(true)} className={fullPage?"block min-h-0 w-full flex-1 border-0 bg-white":"block h-[calc(100dvh-12rem)] min-h-[32rem] w-full border-0 bg-white"} allow="clipboard-write" />
  </section>;
}
