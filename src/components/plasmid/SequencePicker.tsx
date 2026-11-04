"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PlasmidChoice } from "@/lib/plasmid/store.server";
import type { OpenDocument } from "./DocumentTabs";

/** Picks a second sequence from what is open, from inventory, or from a file; each ends on the same place. */
export function SequencePicker({ title, note, documents, plasmids, onPick, onPickPlasmid, onOpenFiles }: {
  title: string;
  note?: string;
  documents: Array<OpenDocument & { length: number }>;
  plasmids: PlasmidChoice[];
  onPick: (key: string) => void;
  /** Resolves to an error message when the plasmid could not be opened. */
  onPickPlasmid: (productId: string) => Promise<string | undefined>;
  onOpenFiles: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <section className="ln-pw-picker" aria-label={title}>
      <h3>{title}</h3>
      {note ? <p className="ln-pw-note">{note}</p> : null}
      {documents.length ? (
        <ul>
          {documents.map((document) => (
            <li key={document.key}>
              <Button type="button" variant="secondary" size="sm" onClick={() => onPick(document.key)}><span data-i18n-ignore>{document.name}</span></Button>
              <small>{`${document.length.toLocaleString("en-US")} ${document.kind === "read" ? "nt" : "bp"}`}</small>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="ln-pw-actions">
        {plasmids.length ? (
          <select className="ln-pw-input ln-pw-narrow" value="" disabled={pending} aria-label="Choose a plasmid from inventory" onChange={async (event) => {
            const id = event.target.value;
            if (!id) return;
            setPending(true);
            setError(await onPickPlasmid(id));
            setPending(false);
          }}>
            <option value="">{pending ? "Opening…" : "Choose a plasmid from inventory…"}</option>
            {plasmids.map((plasmid) => <option key={plasmid.id} value={plasmid.id}>{plasmid.name}</option>)}
          </select>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={onOpenFiles}><FileUp className="h-3.5 w-3.5" aria-hidden />Open a file</Button>
      </div>
      {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
    </section>
  );
}
