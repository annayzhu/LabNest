"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { settleHeldContainer } from "@/app/inventory/home-actions";
import { useI18n } from "@/components/I18nProvider";
import { formInlineInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { newClientMutationId } from "@/lib/client-mutation-id";
import type { HeldContainer } from "@/lib/inventory-home.server";

/**
 * What people have taken out and not finished (Q196), by who has it. Each container is marked used up, returned to
 * the store or handed over right here; using it in an experiment is never required. The 领用中 alert scrolls here.
 */
/** `placesList` is the id of the page's datalist of storage places, offered when a container goes back. */
export function InventoryInUse({ containers, placesList }: { containers: HeldContainer[]; placesList: string }) {
  const groups = [...Map.groupBy(containers, (container) => container.holder)];
  return (
    <section id="in-use" aria-labelledby="in-use-title" className="scroll-mt-20 overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-hairline px-4 py-2.5">
        <h2 id="in-use-title" className="text-sm font-semibold text-ink"><span>In use</span> <span className="text-xs font-normal tabular-nums text-muted">{containers.length}</span></h2>
        <p className="text-xs text-muted">Mark each one used up, return it or hand it over.</p>
      </header>
      <ul className="divide-y divide-hairline">
        {groups.map(([holder, held]) => (
          <li key={holder} className="px-4 py-2.5">
            <p className="text-xs font-medium text-muted"><span>{holder || "No recipient recorded"}</span> · <span className="tabular-nums">{held.length}</span></p>
            <ul className="divide-y divide-hairline/70">
              {held.map((container) => <HeldRow key={container.id} container={container} placesList={placesList} />)}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeldRow({ container, placesList }: { container: HeldContainer; placesList: string }) {
  const router = useRouter();
  const dialog = useModalDialog();
  const { t } = useI18n();
  const [form, setForm] = useState<"return" | "transfer" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function settle(action: "empty" | "return" | "transfer", value = "") {
    setBusy(true);
    setError("");
    const result = await settleHeldContainer({
      itemId: container.itemId,
      containerId: container.id,
      action,
      clientMutationId: newClientMutationId(),
      ...(action === "transfer" ? { holder: value } : action === "return" && value ? { place: value } : {}),
    }).catch(() => ({ error: "The network failed." }));
    setBusy(false);
    if (result.error) { setError(t(result.error)); return; }
    setForm(null);
    router.refresh();
  }

  async function usedUp() {
    if (await dialog.confirm({ title: t("Mark it used up?"), description: t("It leaves the in-use list; its history stays."), confirmLabel: t("Used up") })) await settle("empty");
  }

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <Link href={`/inventory/${container.itemId}`} className="font-medium text-ink hover:text-moss">{container.name}</Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {container.lotNumber ? <span>{t(`Lot ${container.lotNumber}`)}</span> : null}
            {container.label ? <span>{container.label}</span> : null}
            <span className="tabular-nums">{t(`Taken out ${container.since.slice(5)}`)}</span>
            {container.place ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{container.place}</span></span> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button type="button" size="sm" disabled={busy} onClick={() => void usedUp()}>Used up</Button>
          <Button type="button" size="sm" disabled={busy} aria-expanded={form === "return"} onClick={() => setForm(form === "return" ? null : "return")}>Return to store</Button>
          <Button type="button" size="sm" disabled={busy} aria-expanded={form === "transfer"} onClick={() => setForm(form === "transfer" ? null : "transfer")}>Hand over</Button>
        </div>
      </div>
      {form ? (
        <form
          key={form}
          onSubmit={(event) => { event.preventDefault(); void settle(form, String(new FormData(event.currentTarget).get("value") ?? "").trim()); }}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <input
            name="value"
            autoFocus
            required={form === "transfer"}
            maxLength={form === "transfer" ? 120 : 240}
            list={form === "return" ? placesList : undefined}
            aria-label={form === "transfer" ? "Recipient" : "Put back at (optional)"}
            placeholder={t(form === "transfer" ? "Recipient" : "Put back at (optional)")}
            className={`${formInlineInputClass} h-8 min-w-0 flex-1 text-sm sm:max-w-xs`}
          />
          <Button type="submit" size="sm" variant="primary" disabled={busy} aria-busy={busy}>
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}{form === "transfer" ? "Hand over" : "Return to store"}
          </Button>
        </form>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-sm text-error">{error}</p> : null}
    </li>
  );
}
