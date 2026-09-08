"use client";
import { EmbeddedSampleImport } from "./EmbeddedSampleImport";
import { useRef, useState } from "react";
export function EmbeddedLabTool({ id, title }: { id: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  return <section aria-label={title} className="min-w-0">
    {id.endsWith("plate-layout") ? <EmbeddedSampleImport frame={frame} toolId={id} /> : null}
    {!loaded ? <p role="status" className="py-2 text-sm text-muted">正在打开工具…</p> : null}
    <iframe ref={frame} title={title} src={`/tools/${id}/index.html`} onLoad={() => setLoaded(true)} className="block h-[calc(100dvh-12rem)] min-h-[32rem] w-full border-0 bg-white" allow="clipboard-write" />
  </section>;
}
