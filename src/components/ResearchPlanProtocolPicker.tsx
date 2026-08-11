"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { formInputClass, formLabelClass } from "@/components/forms";
import { useI18n } from "@/components/I18nProvider";
import { filterProtocolPickerOptions, type ResearchPlanProtocolOption } from "@/lib/research-plan-protocol-picker";

export function ResearchPlanProtocolPicker({
  protocols,
  initialSelectedIds = [],
  initialPrimaryProtocolId,
}: {
  protocols: ResearchPlanProtocolOption[];
  initialSelectedIds?: string[];
  initialPrimaryProtocolId?: string;
}) {
  const { t } = useI18n();
  const listboxId = useId();
  const protocolMap = useMemo(() => new Map(protocols.map((protocol) => [protocol.id, protocol])), [protocols]);
  const [selectedIds, setSelectedIds] = useState(() => {
    const requested = new Set([...initialSelectedIds, ...(initialPrimaryProtocolId ? [initialPrimaryProtocolId] : [])]);
    return protocols.filter((protocol) => requested.has(protocol.id)).map((protocol) => protocol.id);
  });
  const [primaryProtocolId, setPrimaryProtocolId] = useState(
    initialPrimaryProtocolId && protocolMap.has(initialPrimaryProtocolId) ? initialPrimaryProtocolId : "",
  );
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedProtocols = selectedIds.flatMap((id) => {
    const protocol = protocolMap.get(id);
    return protocol ? [protocol] : [];
  });
  const matches = filterProtocolPickerOptions(protocols, selectedIds, query);

  function addProtocol(protocolId: string) {
    setSelectedIds((current) => current.includes(protocolId) ? current : [...current, protocolId]);
    setQuery("");
    setIsOpen(false);
  }

  function removeProtocol(protocolId: string) {
    setSelectedIds((current) => current.filter((id) => id !== protocolId));
    if (primaryProtocolId === protocolId) setPrimaryProtocolId("");
  }

  return (
    <details className="group rounded-[12px] border border-hairline bg-surface shadow-paper">
      <summary className="focus-ring flex h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] px-4 [&::-webkit-details-marker]:hidden">
        <h2 className="font-serif text-[17px] font-medium leading-tight text-ink">{t("Protocol set")}</h2>
        <span className="flex items-center gap-3 text-xs font-medium text-muted">
          <span aria-live="polite">{t("Linked protocols")}: {selectedProtocols.length}</span>
          <span className="flex items-center gap-1.5"><span className="group-open:hidden">{t("Expand")}</span><span className="hidden group-open:inline">{t("Collapse")}</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-hairline/80 p-4">
        <div
          className="relative max-w-2xl"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
          }}
        >
          <label htmlFor={`${listboxId}-search`} className={formLabelClass}>{t("Add from Protocol library")}</label>
          <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-muted" />
          <input
            id={`${listboxId}-search`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            value={query}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setIsOpen(false);
              if (event.key === "ArrowDown" && isOpen) {
                event.preventDefault();
                document.getElementById(`${listboxId}-option-0`)?.focus();
              }
            }}
            placeholder={t("Search protocol code or title…")}
            className={`${formInputClass} pl-9`}
          />
          {isOpen ? <div id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-[9px] border border-hairline bg-surface p-1.5 shadow-soft">
            {matches.length ? matches.map((protocol, index) => (
              <button
                key={protocol.id}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => addProtocol(protocol.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    document.getElementById(`${listboxId}-option-${index + 1}`)?.focus();
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (index === 0) document.getElementById(`${listboxId}-search`)?.focus();
                    else document.getElementById(`${listboxId}-option-${index - 1}`)?.focus();
                  }
                  if (event.key === "Escape") {
                    setIsOpen(false);
                    document.getElementById(`${listboxId}-search`)?.focus();
                  }
                }}
                className="focus-ring flex w-full items-start justify-between gap-3 rounded-[7px] px-3 py-2 text-left hover:bg-sage-surface"
              >
                <span className="min-w-0"><strong className="block truncate text-sm font-medium text-ink">{protocol.humanCode ?? protocol.title}</strong><span className="block truncate text-xs text-muted">{protocol.humanCode ? `${protocol.title} · ` : ""}{protocol.scope}</span></span>
                <span className="shrink-0 text-xs font-medium text-moss">{t("Add")}</span>
              </button>
            )) : <p className="px-3 py-4 text-center text-sm text-muted">{t(protocols.length === selectedProtocols.length ? "All available Protocols are already selected." : "No matching Protocols.")}</p>}
          </div> : null}
        </div>

        <div>
          <p className={formLabelClass}>{t("Selected Protocols")}</p>
          {selectedProtocols.length ? <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
            {selectedProtocols.map((protocol) => <div key={protocol.id} className="flex min-h-10 items-start gap-2 rounded-[7px] border border-hairline bg-warm/70 px-2.5 py-2 text-xs text-graphite">
              <input type="hidden" name="protocolIds" value={protocol.id} />
              <span className="min-w-0 flex-1"><strong className="block truncate font-medium text-ink">{protocol.humanCode ?? protocol.title}</strong><span className="block truncate text-[11px] text-muted">{protocol.humanCode ? `${protocol.title} · ` : ""}{protocol.scope}</span></span>
              <button type="button" onClick={() => removeProtocol(protocol.id)} aria-label={`${t("Remove protocol")}: ${protocol.humanCode ?? protocol.title}`} title={t("Remove protocol")} className="focus-ring rounded p-0.5 text-muted hover:bg-error-surface hover:text-error"><X className="h-3.5 w-3.5" /></button>
            </div>)}
          </div> : <p className="mt-2 rounded-[7px] border border-dashed border-hairline px-3 py-3 text-sm text-muted">{t("No Protocols selected yet.")}</p>}
        </div>

        <label className="block max-w-2xl"><span className={formLabelClass}>{t("Primary protocol")}</span><select name="primaryProtocolId" value={primaryProtocolId} onChange={(event) => setPrimaryProtocolId(event.target.value)} disabled={!selectedProtocols.length} className={formInputClass}><option value="">{t("No primary protocol")}</option>{selectedProtocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.humanCode ?? protocol.title} · {protocol.title}</option>)}</select></label>
      </div>
    </details>
  );
}
