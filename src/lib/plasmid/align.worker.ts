/// <reference lib="webworker" />
import { runAlignRequest, type AlignmentOutcome, type AlignRequest } from "./align";

export type AlignResponse = { outcomes: AlignmentOutcome[] };

// Aligning many reads to a 10 kb reference takes seconds; doing it here keeps the page responsive. Traces stay on the page.
self.onmessage = (event: MessageEvent<AlignRequest>) => {
  self.postMessage({ outcomes: runAlignRequest(event.data) } satisfies AlignResponse);
};
