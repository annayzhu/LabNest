"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { useI18n } from "./I18nProvider";
import { UsedUpCheckbox } from "./InventoryDetail";
import { formInputClass, formLabelClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";

/** Freeze bottle IDs and retry keys before issuing, so a lost response cannot issue extra bottles. */
export function InventoryBatchIssue({ itemId, available, placesList }: { itemId: string; available: string[]; placesList: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [quantity, setQuantity] = useState("1");
  const [holder, setHolder] = useState("");
  const [location, setLocation] = useState("");
  const [usedUp, setUsedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState<{ holder: string; location: string; usedUp: boolean; rows: { id: string; key: string }[] } | null>(null);
  async function issue(event: React.FormEvent) {
    event.preventDefault();
    const count = Number(quantity);
    if (!attempt && (!Number.isInteger(count) || count < 1 || count > available.length)) {
      setMessage(t(`Take out a whole number from 1 to ${available.length}.`)); return;
    }
    const batch = attempt ?? { holder, location, usedUp, rows: available.slice(0, count).map(id => ({ id, key: newClientMutationId() })) };
    setAttempt(batch); setBusy(true); setMessage("");
    let completed = 0;
    try {
      for (const row of batch.rows) {
        const response = await fetch(`/api/inventory/${itemId}/containers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "issue", containerId: row.id, clientMutationId: row.key, holder: batch.holder, location: batch.location, usedUp: batch.usedUp }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        completed++;
      }
      setMessage(t(batch.usedUp ? `Took out ${completed} and marked them used up.` : `Took out ${completed}; none was marked opened or empty.`)); setAttempt(null);
    } catch (error) {
      setMessage(`${t(`${completed} of ${batch.rows.length} taken out.`)} ${error instanceof Error ? t(error.message) : t("The network failed.")} ${t("Retrying takes the same containers, so none is taken twice.")}`);
    } finally { setBusy(false); router.refresh(); }
  }
  return <form onSubmit={issue} onKeyDown={preventImplicitEnterSubmit} className="flex flex-wrap items-end gap-3 border-b border-hairline py-3">
    <label className="w-24"><span className={formLabelClass}>How many</span><input className={formInputClass} type="number" min="1" max={available.length} step="1" value={quantity} disabled={busy || !!attempt} onChange={e => setQuantity(e.target.value)} required /></label>
    <label><span className={formLabelClass}>Recipient</span><input className={formInputClass} value={holder} disabled={busy || !!attempt} onChange={e => setHolder(e.target.value)} required /></label>
    <label><span className={formLabelClass}>Put at (optional)</span><input className={formInputClass} list={placesList} value={location} disabled={busy || !!attempt} onChange={e => setLocation(e.target.value)} placeholder="B302 bench" /></label>
    <UsedUpCheckbox className="h-[var(--ln-control-height-md)]" checked={usedUp} disabled={busy || !!attempt} onChange={setUsedUp} />
    <Button type="submit" disabled={busy || (!attempt && !available.length)}>{attempt ? "Retry the same batch" : "Take out"}</Button>
    {attempt && !busy ? <Button type="button" onClick={() => { setAttempt(null); setMessage(t("Stopped; what was taken out stays recorded.")); }}>Stop this batch</Button> : null}
    {message ? <p role="status" className="basis-full text-sm">{message}</p> : null}
  </form>;
}
