"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formInputClass } from "./forms";
export function QuoteDecision({
  id,
  status,
  reason,
}: {
  id: string;
  status: string;
  reason?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [text, setText] = useState(reason ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch("/api/purchases/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: value, reason: text }),
          });
          const result = await r.json();
          if (!r.ok) throw new Error(result.error);
          setMessage("已保存");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "保存失败");
        } finally {
          setBusy(false);
        }
      }}
    >
      <select
        aria-label="采购决定"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={formInputClass}
        disabled={busy || status === "converted"}
      >
        <option value="candidate">候选</option>
        <option value="selected">选用</option>
        <option value="not_selected">不选用</option>
        {!["candidate", "selected", "not_selected"].includes(status) ? (
          <option value={status}>{status}</option>
        ) : null}
      </select>
      <input
        aria-label="决定理由"
        className={formInputClass}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy || status === "converted"}
      />
      <button
        type="submit"
        className="focus-ring min-h-11 text-moss"
        disabled={busy || status === "converted"}
      >
        保存决定
      </button>
      {message ? <span role="status">{message}</span> : null}
    </form>
  );
}
