"use client";
import { EmbeddedSampleImport } from "./EmbeddedSampleImport";
import { useCallback, useEffect, useRef, useState } from "react";

export function EmbeddedLabTool({ id, title, fullPage = false, samples }: { id: string; title: string; fullPage?: boolean; samples?: { label: string; names: string[] } }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const responsive = fullPage && id === "qpcr-plate-layout";
  const primeSamples = useCallback(() => {
    if (id !== "qpcr-plate-layout" || !samples?.names.length) return;
    const win = frame.current?.contentWindow as (Window & typeof globalThis) | null;
    const input = frame.current?.contentDocument?.querySelector<HTMLTextAreaElement>('textarea[aria-label="批量粘贴样本"], textarea[aria-label="Paste samples in bulk"]');
    // Keep a restored draft or anything the user has already pasted.
    if (!win || !input || input.value) return;
    Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(input, samples.names.join("\n"));
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
  }, [id, samples]);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.protocol !== "labnest-tool-v1" || event.data.type !== "TOOL_READY") return;
      setLoaded(true);
      primeSamples();
    };
    window.addEventListener("message", ready);
    if (frame.current?.contentDocument?.readyState === "complete" && frame.current.contentDocument.URL !== "about:blank") {
      setLoaded(true);
      primeSamples();
    }
    return () => window.removeEventListener("message", ready);
  }, [primeSamples]);
  return <section aria-label={title} className={responsive ? "flex min-h-0 min-w-0 flex-1 flex-col" : "min-w-0 flex-1"}>
    {id.endsWith("plate-layout") && id !== "qpcr-plate-layout" ? <EmbeddedSampleImport frame={frame} toolId={id} preset={samples} /> : null}
    {!loaded ? <p role="status" className="py-2 text-sm text-muted">正在打开工具…</p> : null}
    <iframe ref={frame} title={title} src={`/tools/${id}/index.html`} onLoad={() => { setLoaded(true); primeSamples(); }} className={responsive ? "block min-h-0 w-full flex-1 border-0 bg-white" : fullPage ? "block h-[calc(100dvh-5rem)] min-h-[32rem] w-full border-0 bg-white" : "block h-[calc(100dvh-12rem)] min-h-[32rem] w-full border-0 bg-white"} allow="clipboard-write" />
  </section>;
}
