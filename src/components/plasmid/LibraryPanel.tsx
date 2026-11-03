"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToLibrary, removeFromLibrary } from "@/app/tools/plasmid/actions";
import { Button } from "@/components/ui/Button";
import type { LibraryElement } from "@/lib/plasmid/feature-library";

const types = ["misc_feature", "promoter", "CDS", "rep_origin", "polyA_signal", "protein_bind", "primer_bind", "enhancer", "terminator"];

/** Adds the selected bases, or the translation of the selected CDS, to the lab's own feature library (Q362). */
export function AddToLibrary({ bases, protein }: { bases: string; protein?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState(protein ? "CDS" : "misc_feature");
  const [kind, setKind] = useState<"dna" | "protein">(protein ? "protein" : "dna");
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [pending, startTransition] = useTransition();
  if (!open) return <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>Add to the feature library</Button>;
  const save = () => startTransition(async () => {
    const result = await addToLibrary({ name, type, kind, sequence: kind === "protein" ? protein : bases });
    if (result.error) setMessage({ error: result.error });
    else {
      setMessage({ ok: "Added. Every plasmid opened from now on is searched for it." });
      router.refresh();
    }
  });
  return (
    <div className="ln-pw-save" role="dialog" aria-label="Add to the feature library">
      <input className="ln-pw-input" value={name} placeholder="Name" aria-label="Name" onChange={(event) => setName(event.target.value)} />
      <select className="ln-pw-input" value={type} aria-label="Feature type" data-i18n-ignore onChange={(event) => setType(event.target.value)}>
        {types.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      {protein ? (
        <select className="ln-pw-input" value={kind} aria-label="Match by" onChange={(event) => setKind(event.target.value as "dna" | "protein")}>
          <option value="protein">Match the protein in any frame</option>
          <option value="dna">Match these bases</option>
        </select>
      ) : null}
      {message.ok ? <p className="ln-pw-ok" role="status">{message.ok}</p> : null}
      {message.error ? <p className="ln-pw-error" role="alert">{message.error}</p> : null}
      <div className="ln-pw-actions">
        <Button type="button" variant="primary" size="sm" disabled={pending || !name.trim() || Boolean(message.ok)} onClick={save}>{pending ? "Saving…" : "Add"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </div>
  );
}

/** The lab's own entries, found next to the built-in elements; anyone can take one out. */
export function LibraryList({ entries }: { entries: LibraryElement[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!entries.length) return null;
  const remove = (id: string) => startTransition(async () => {
    const result = await removeFromLibrary(id.replace(/^lab-/, ""));
    if (result.error) setError(result.error);
    else router.refresh();
  });
  return (
    <section className="ln-pw-library" aria-label="The lab's feature library">
      <h3>{`The lab's own entries (${entries.length})`}</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <span data-i18n-ignore>{entry.name}</span>
            <small data-i18n-ignore>{`${entry.type} · ${entry.sequence.length} ${entry.kind === "protein" ? "aa" : "bp"}`}</small>
            <button type="button" className="ln-pw-icon" aria-label="Remove from the library" disabled={pending} onClick={() => remove(entry.id)}><X className="h-3 w-3" aria-hidden /></button>
          </li>
        ))}
      </ul>
      {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
    </section>
  );
}
