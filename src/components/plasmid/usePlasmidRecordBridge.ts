"use client";
import { useEffect, useRef } from "react";
import { mapSnapshot } from "./MapExport";

const protocol = "labnest-tool-v1";
type Saved = { productId: string; versionId: string };

/** The map is drawn only on its own view, so it may take a moment to appear after switching to it. */
async function waitForMap() {
  for (let tries = 0; tries < 30; tries++) {
    const svg = mapSnapshot();
    if (svg) return svg;
    await new Promise((done) => setTimeout(done, 50));
  }
  return undefined;
}

/**
 * Connects the workbench opened from a record ("/" → Plasmid workbench): the open plasmid's version goes back as a
 * reference with a snapshot of its map. Only a saved version can be referred to, so unsaved files are refused.
 */
export function usePlasmidRecordBridge({ active, saved, showMap, zh }: { active: boolean; saved?: Saved; showMap: () => void; zh: boolean }) {
  const latest = useRef({ saved, showMap, zh });
  latest.current = { saved, showMap, zh };
  const session = useRef("");
  useEffect(() => {
    if (!active || window.parent === window) return;
    const send = (message: object) => window.parent.postMessage({ protocol, sessionId: session.current, ...message }, window.location.origin);
    const state = () => latest.current.saved ? { ...latest.current.saved, zh: latest.current.zh } : null;
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.protocol !== protocol) return;
      const message = event.data;
      if (message.type === "CONTEXT_INIT") {
        session.current = message.sessionId;
        document.documentElement.dataset.labnestEmbedded = "true";
        const wanted = message.state as Saved | null | undefined;
        if (wanted?.productId && wanted.productId !== latest.current.saved?.productId) {
          window.location.replace(`/tools/plasmid?embed=record&product=${encodeURIComponent(wanted.productId)}`);
          return;
        }
        send({ type: "CONTEXT_READY" });
      } else if (message.sessionId !== session.current) return;
      else if (message.type === "REQUEST_DRAFT") send({ type: "DRAFT_FLUSH", state: state() });
      else if (message.type === "REQUEST_OUTPUT") {
        const current = state();
        const { zh } = latest.current;
        if (!current) { send({ type: "SAVE_ERROR", error: zh ? "这条序列还没保存：请先在工作台里保存到库存的质粒，再插入图谱" : "This sequence is not saved yet: save it to a plasmid in inventory, then insert the map" }); return; }
        latest.current.showMap();
        const svg = await waitForMap();
        if (!svg) { send({ type: "SAVE_ERROR", error: zh ? "这条序列没有图谱：请打开质粒序列后再插入" : "This sequence has no map: open the plasmid sequence, then insert" }); return; }
        send({ type: "OUTPUT_SUBMIT", state: current, output: { label: "", images: [{ svg, caption: zh ? "质粒图谱" : "Plasmid map" }], table: { headers: [], rows: [] }, method: "" } });
      }
    };
    window.addEventListener("message", receive);
    send({ type: "TOOL_READY" });
    return () => window.removeEventListener("message", receive);
  }, [active]);
  const productId = saved?.productId, versionId = saved?.versionId;
  useEffect(() => {
    if (!active || !session.current || !productId) return;
    window.parent.postMessage({ protocol, type: "DRAFT_CHANGED", sessionId: session.current, state: { productId, versionId, zh } }, window.location.origin);
  }, [active, productId, versionId, zh]);
}
