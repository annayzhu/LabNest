"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { formInputClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";

/** Freeze bottle IDs and retry keys before issuing, so a lost response cannot issue extra bottles. */
export function InventoryBatchIssue({ itemId, available }: { itemId: string; available: string[] }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("1");
  const [holder, setHolder] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState<{ holder: string; location: string; rows: { id: string; key: string }[] } | null>(null);
  async function issue(event: React.FormEvent) {
    event.preventDefault();
    const count = Number(quantity);
    if (!attempt && (!Number.isInteger(count) || count < 1 || count > available.length)) {
      setMessage("领用数量应为当前可领实物范围内的整数。"); return;
    }
    const batch = attempt ?? { holder, location, rows: available.slice(0, count).map(id => ({ id, key: newClientMutationId() })) };
    setAttempt(batch); setBusy(true); setMessage("");
    let completed = 0;
    try {
      for (const row of batch.rows) {
        const response = await fetch(`/api/inventory/${itemId}/containers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "issue", containerId: row.id, clientMutationId: row.key, holder: batch.holder, location: batch.location }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        completed++;
      }
      setMessage(`已领用 ${completed} 个实物；未自动开封或耗尽。`); setAttempt(null);
    } catch (error) {
      setMessage(`本批已确认 ${completed}/${batch.rows.length}；${error instanceof Error ? error.message : "网络失败"}。重试保留原瓶编号，不重复领用。`);
    } finally { setBusy(false); router.refresh(); }
  }
  return <form onSubmit={issue} onKeyDown={preventImplicitEnterSubmit} className="flex flex-wrap items-end gap-3 border-b border-hairline py-3">
    <label className="text-sm">领用数量<input className={formInputClass} type="number" min="1" step="1" value={quantity} disabled={busy || !!attempt} onChange={e => setQuantity(e.target.value)} required /></label>
    <label className="text-sm">领用人<input className={formInputClass} value={holder} disabled={busy || !!attempt} onChange={e => setHolder(e.target.value)} required /></label>
    <label className="text-sm">领用位置<input className={formInputClass} value={location} disabled={busy || !!attempt} onChange={e => setLocation(e.target.value)} /></label>
    <Button type="submit" disabled={busy || (!attempt && !available.length)}>{attempt ? "重试原批领用" : "确认批量领用"}</Button>
    {attempt && !busy ? <Button type="button" onClick={() => { setAttempt(null); setMessage("未继续执行本批剩余操作；已领用实物及历史保留。"); }}>结束本批</Button> : null}
    {message ? <p role="status" className="basis-full text-sm">{message}</p> : null}
  </form>;
}
