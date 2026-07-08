"use client";

import { CheckCircle2, Clipboard, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

const exampleEntry = {
  title: "Adjusted seeding density before GFP transfection",
  body:
    "Cells looked slightly over-confluent in two wells. Plan to reduce seeding density by 15% and document whether expression improves at 24 h.",
};

type ParseResult = {
  status: "idle" | "valid" | "invalid";
  message?: string;
  json?: string;
};

export function ManualAiWorkbench() {
  const [entryTitle, setEntryTitle] = useState(exampleEntry.title);
  const [entryBody, setEntryBody] = useState(exampleEntry.body);
  const [prompt, setPrompt] = useState("");
  const [rawResponse, setRawResponse] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult>({ status: "idle" });
  const [isBusy, setIsBusy] = useState(false);
  const canCreatePrompt = useMemo(() => entryTitle.trim() && entryBody.trim(), [entryTitle, entryBody]);

  async function createPrompt() {
    setIsBusy(true);
    setParseResult({ status: "idle" });

    try {
      const response = await fetch("/api/ai/manual/prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryTitle, entryBody }),
      });
      const data = (await response.json()) as { prompt?: string; error?: unknown };

      if (!response.ok || !data.prompt) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not create prompt.");
      }

      setPrompt(data.prompt);
    } catch (error) {
      setParseResult({
        status: "invalid",
        message: error instanceof Error ? error.message : "Could not create prompt.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function parseManualResponse() {
    setIsBusy(true);

    try {
      const response = await fetch("/api/ai/manual/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawResponse }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not parse response.");
      }

      setParseResult({
        status: "valid",
        message: `${data.count} proposed action${data.count === 1 ? "" : "s"} validated. Nothing was executed.`,
        json: JSON.stringify(data.actions, null, 2),
      });
    } catch (error) {
      setParseResult({
        status: "invalid",
        message: error instanceof Error ? error.message : "Could not parse response.",
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function copyPrompt() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setParseResult({ status: "valid", message: "Prompt copied." });
  }

  function reset() {
    setEntryTitle(exampleEntry.title);
    setEntryBody(exampleEntry.body);
    setPrompt("");
    setRawResponse("");
    setParseResult({ status: "idle" });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Entry title</span>
          <input
            value={entryTitle}
            onChange={(event) => setEntryTitle(event.target.value)}
            className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Entry body</span>
          <textarea
            value={entryBody}
            onChange={(event) => setEntryBody(event.target.value)}
            className="focus-ring mt-2 min-h-40 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={createPrompt} disabled={!canCreatePrompt || isBusy} variant="primary">
            <Sparkles className="h-4 w-4" aria-hidden />
            Make Prompt
          </Button>
          <Button onClick={reset} disabled={isBusy}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Prompt</span>
          <textarea
            readOnly
            value={prompt}
            className="focus-ring mt-2 min-h-40 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 font-mono text-xs leading-5 text-ink"
            placeholder="Create a prompt, then paste it into ChatGPT or Claude."
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyPrompt} disabled={!prompt || isBusy}>
            <Clipboard className="h-4 w-4" aria-hidden />
            Copy
          </Button>
        </div>
      </div>

      <div className="space-y-4 xl:col-span-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Pasted AI JSON</span>
          <textarea
            value={rawResponse}
            onChange={(event) => setRawResponse(event.target.value)}
            className="focus-ring mt-2 min-h-44 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 font-mono text-xs leading-5 text-ink"
            placeholder='[{"sourceType":"ai","actionType":"create_experiment","reason":"...","payload":{}}]'
          />
        </label>
        <Button onClick={parseManualResponse} disabled={!rawResponse.trim() || isBusy} variant="primary">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Validate Actions
        </Button>
        {parseResult.status !== "idle" ? (
          <div
            className={
              parseResult.status === "valid"
                ? "rounded-[10px] border border-success/30 bg-success-surface p-3 text-sm text-ink"
                : "rounded-[10px] border border-error/30 bg-error-surface p-3 text-sm text-ink"
            }
          >
            <p className="font-semibold">{parseResult.message}</p>
            {parseResult.json ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-[8px] border border-hairline bg-surface p-3 font-mono text-xs leading-5 text-graphite editorial-scrollbar">
                {parseResult.json}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
