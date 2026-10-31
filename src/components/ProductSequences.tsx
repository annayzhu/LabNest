import Link from "next/link";
import { Download } from "lucide-react";
import { CopyTextButton } from "@/components/CopyTextButton";
import { strandFacts } from "@/lib/product-sequences";
import type { MoleculeType } from "@/lib/sequence";

type Strand = { role: string; label: string; sequence: string; molecule: MoleculeType };

/** A product's sequences: each strand with its numbers, a copy button and, for nucleic acids, its reverse complement (Q185). */
export function ProductSequences({ productId, strands }: { productId: string; strands: Strand[] }) {
  if (!strands.length) {
    return <p className="text-sm text-muted"><span>No sequence yet.</span> <Link href={`/inventory/products/${productId}/edit`} className="font-medium text-moss hover:underline">Add it in Edit</Link></p>;
  }
  return (
    <div className="space-y-4">
      {strands.map((strand) => {
        const facts = strandFacts(strand.sequence, strand.molecule);
        const long = strand.sequence.length > 240;
        return (
          <div key={strand.role} className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-ink">{strand.label}</h3>
              <CopyTextButton text={strand.sequence} label="Copy sequence" />
            </div>
            <p className={`mt-1 break-all font-mono text-sm leading-6 tracking-wide text-ink ${long ? "editorial-scrollbar max-h-36 overflow-y-auto pr-1" : ""}`}>{strand.sequence}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
              <span><span>Length</span> <span className="tabular-nums text-graphite">{facts.length}</span> <span>{strand.molecule === "Protein" ? "aa" : "nt"}</span></span>
              {facts.gc !== undefined ? <span>GC <span className="tabular-nums text-graphite">{facts.gc.toFixed(1)}%</span></span> : null}
              {facts.tm !== undefined ? <span>Tm <span className="tabular-nums text-graphite">{facts.tm.toFixed(1)} °C</span></span> : null}
              <span>MW <span className="tabular-nums text-graphite">{Math.round(facts.weight).toLocaleString("en-US")}</span> g/mol</span>
            </p>
            {facts.reverseComplement ? (
              <details className="mt-1 text-xs">
                <summary className="focus-ring w-fit cursor-pointer rounded-[var(--ln-radius-control-sm)] text-moss">Reverse complement</summary>
                <p className={`mt-1 break-all font-mono text-sm leading-6 tracking-wide text-graphite ${long ? "editorial-scrollbar max-h-36 overflow-y-auto pr-1" : ""}`}>{facts.reverseComplement}</p>
              </details>
            ) : null}
          </div>
        );
      })}
      <a href={`/api/inventory/products/sequences?ids=${productId}&format=fasta`} className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] text-sm font-medium text-moss hover:underline">
        <Download className="h-4 w-4" aria-hidden />Download FASTA
      </a>
    </div>
  );
}
