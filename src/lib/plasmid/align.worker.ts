/// <reference lib="webworker" />
import { createAligner, type AlignmentOutcome } from "./align";
import type { SangerRead, Topology } from "./model";

/** What the page sends: one reference and the reads to place on it (Q364). Traces stay on the page. */
export type AlignRequest = { reference: string; topology: Topology; reads: Array<Pick<SangerRead, "name" | "bases" | "quality">> };
export type AlignResponse = { outcomes: AlignmentOutcome[] };

// Aligning many reads to a 10 kb reference takes seconds; doing it here keeps the page responsive.
self.onmessage = (event: MessageEvent<AlignRequest>) => {
  const { reference, topology, reads } = event.data;
  const aligner = createAligner(reference, topology === "circular" ? "circular" : "linear");
  const outcomes = reads.map((read) => aligner.align({ ...read, peaks: null, traces: null, metadata: {} }));
  self.postMessage({ outcomes } satisfies AlignResponse);
};
