import Link from "next/link";
import { ChevronRight, Dna, FlaskConical, Scissors, Sparkles } from "lucide-react";

const choices = [
  { title: "Primer", description: "One target with Forward and Reverse sequences", category: "primer", icon: Dna, emphasis: true },
  { title: "siRNA duplex", description: "One target with Sense and Antisense strands", category: "sirna-duplex", icon: Dna, emphasis: true },
  { title: "DNA / RNA sequence", description: "Plasmid, linear fragment, or RNA transcript", category: "dna-rna", icon: FlaskConical },
  { title: "Probe / oligo", description: "Probe, adapter, barcode, capture, or blocking oligo", category: "probe-oligo", icon: Sparkles },
  { title: "CRISPR guide", description: "Guide sequence with PAM recorded separately", category: "crispr-guide", icon: Scissors },
  { title: "shRNA", description: "Hairpin design with loop and target context", category: "shrna", icon: Dna },
  { title: "Protein / peptide", description: "Amino-acid sequence recorded N → C", category: "amino-acid", icon: FlaskConical },
] as const;

export function SequenceTypeChooser({ projectId }: { projectId?: string }) {
  return (
    <section aria-labelledby="sequence-type-heading" className="mx-auto max-w-4xl">
      <div className="mb-3">
        <h2 id="sequence-type-heading" className="text-lg font-semibold text-ink">What are you recording?</h2>
        <p className="mt-1 text-sm text-muted">Choose the scientific object first. Each type opens the fields and terminology it needs.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const Icon = choice.icon;
          const search = new URLSearchParams({ category: choice.category });
          if (projectId) search.set("projectId", projectId);
          return (
            <Link key={choice.category} href={`/sequences/new?${search.toString()}`} className={`focus-ring group flex min-h-20 items-center gap-3 rounded-[10px] border p-3 transition hover:border-sage hover:bg-sage-surface/40 ${"emphasis" in choice && choice.emphasis ? "border-sage/70 bg-sage-surface/25" : "border-hairline bg-surface"}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-warm text-moss"><Icon className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-ink">{choice.title}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{choice.description}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-moss" aria-hidden />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
