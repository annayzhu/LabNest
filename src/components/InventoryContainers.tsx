"use client";
import {newClientMutationId} from "@/lib/client-mutation-id";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formInputClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";

type Bottle = {
  id: string;
  state: string;
  holder: string | null;
  location: string | null;
  openedAt: string | null;
  observations: {
    remaining: number;
    unit: string;
    quality: string;
    performedBy: string;
    createdAt: string;
  }[];
  events: {
    id: string;
    action: string;
    createdAt: string;
    performedBy: string | null;
  }[];
};
const actions = {
  issue: "领用",
  open: "开封",
  transfer: "转交",
  return: "归还",
  empty: "用完",
  observe: "登记余量",
};
export function InventoryContainers({
  itemId,
  containers,
}: {
  itemId: string;
  containers: Bottle[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<keyof typeof actions>("issue");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Per-bottle form values survive selection changes; a submit retains its original target.
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const bottle = containers.find((c) => c.id === selected);
  const draft = selected ? (drafts[selected] ?? {}) : {};
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  function edit(name: string, value: string) {
    if (selected)
      setDrafts((current) => ({
        ...current,
        [selected]: { ...current[selected], [name]: value },
      }));
    setMutationKey(null);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const target = selected;
    setBusy(true);
    setMessage("");
    const key = mutationKey ?? newClientMutationId();
    setMutationKey(key);
    try {
      const response = await fetch(`/api/inventory/${itemId}/containers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          containerId: target,
          clientMutationId: key,
          ...(draft.holder ? { holder: draft.holder } : {}),
          ...(draft.location ? { location: draft.location } : {}),
          ...(draft.openedAt ? { openedAt: draft.openedAt } : {}),
          ...(action === "observe"
            ? {
                remaining:
                  draft.remaining === "" || draft.remaining === undefined
                    ? undefined
                    : Number(draft.remaining),
                unit: draft.unit ?? "mL",
                quality: draft.quality ?? "estimated",
                performedBy: draft.performedBy,
              }
            : {}),
          ...(draft.performedBy ? { performedBy: draft.performedBy } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMutationKey(null);
      setMessage("已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，可重试");
    } finally {
      setBusy(false);
    }
  }
  const field = (name: string, label: string, type = "text") => (
    <label className="min-w-0 text-sm">
      {label}
      <input
        aria-label={label}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        className={formInputClass}
        value={draft[name] ?? ""}
        onChange={(e) => edit(name, e.target.value)}
        required={["holder", "openedAt", "remaining", "performedBy"].includes(
          name,
        )}
      />
    </label>
  );
  return (
    <section className="border-t border-hairline py-4" aria-label="实物包装">
      <h2 className="text-lg font-semibold">实物包装</h2>
      <p className="my-2 text-sm">
        仓库可领 {containers.filter((c) => c.state === "warehouse").length} ·
        持有 {containers.filter((c) => c.state === "held").length} · 已用完{" "}
        {containers.filter((c) => c.state === "empty").length}
      </p>
      <div className="divide-y divide-hairline">
        {containers.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSelected(c.id);
                setAction(c.state === "warehouse" ? "issue" : "observe");
                setMessage("");
                setMutationKey(null);
              }}
              className="focus-ring min-h-11 text-left"
            >
              <span className="block text-sm">{c.id}</span>
              <span className="text-sm text-muted">
                {c.state === "empty"
                  ? "已用完"
                  : c.holder
                    ? `${c.holder}持有`
                    : "仓库"}{" "}
                · {c.openedAt ? `已开封 ${c.openedAt.slice(0, 10)}` : "未开封"}{" "}
                · {c.location ?? "位置未记录"}
              </span>
            </button>
            <span className="text-sm">
              {c.observations[0] ? (
                <>
                  {c.observations[0].quality === "estimated" ? "约剩" : "实测"}{" "}
                  {c.observations[0].remaining} {c.observations[0].unit} ·{" "}
                  {c.observations[0].createdAt.slice(0, 10)}
                </>
              ) : (
                "余量未记录"
              )}
            </span>
          </div>
        ))}
      </div>
      {bottle ? (
        <div className="border-t border-hairline pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="break-all font-semibold">{bottle.id}</h3>
            <button
              type="button"
              className="focus-ring min-h-11 px-3"
              onClick={() => setSelected(null)}
              disabled={busy}
            >
              收起
            </button>
          </div>
          {bottle.state !== "empty" ? (
            <form
              onSubmit={submit}
              onKeyDown={preventImplicitEnterSubmit}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <label className="text-sm">
                操作
                <select
                  aria-label="实物操作"
                  className={formInputClass}
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value as keyof typeof actions);
                    setMutationKey(null);
                  }}
                >
                  {Object.entries(actions)
                    .filter(
                      ([key]) =>
                        key === "observe" ||
                        key === "empty" ||
                        (key === "open" && !bottle.openedAt) ||
                        (bottle.state === "warehouse"
                          ? key === "issue"
                          : ["transfer", "return"].includes(key)),
                    )
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              {["issue", "transfer"].includes(action)
                ? field("holder", "接收人")
                : null}
              {["issue", "transfer", "return"].includes(action)
                ? field("location", "位置")
                : null}
              {action === "open" ? field("openedAt", "开封日期", "date") : null}
              {action === "observe" ? (
                <>
                  <div className="flex min-w-0 items-end gap-1">
                    {field("remaining", "余量", "number")}
                    <label className="text-sm">
                      单位
                      <select
                        className={formInputClass}
                        value={draft.unit ?? "mL"}
                        onChange={(e) => edit("unit", e.target.value)}
                      >
                        {["mL", "µL", "L", "mg", "g"].map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="text-sm">
                    依据
                    <select
                      className={formInputClass}
                      value={draft.quality ?? "estimated"}
                      onChange={(e) => edit("quality", e.target.value)}
                    >
                      <option value="estimated">估计</option>
                      <option value="measured">实测</option>
                    </select>
                  </label>
                  {field("performedBy", "登记人")}
                </>
              ) : null}
              <Button type="submit" disabled={busy}>
                {busy ? "保存中…" : `确认${actions[action]}`}
              </Button>
            </form>
          ) : null}
          {message ? (
            <p role="status" className="mt-3 text-sm">
              {message}
            </p>
          ) : null}
          <details className="mt-4">
            <summary className="cursor-pointer py-2">流转与余量历史</summary>
            <ul className="space-y-2 text-sm">
              {bottle.events.map((e) => (
                <li key={e.id}>
                  {e.createdAt} ·{" "}
                  {actions[e.action as keyof typeof actions] ?? e.action} ·{" "}
                  {e.performedBy ?? "操作者未识别"}
                </li>
              ))}
              {bottle.observations.map((o, i) => (
                <li key={i}>
                  {o.createdAt} · {o.quality === "estimated" ? "估计" : "实测"}{" "}
                  {o.remaining} {o.unit} · {o.performedBy}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
}
