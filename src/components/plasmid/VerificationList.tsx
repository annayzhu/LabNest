import Link from "next/link";
import { labDate } from "@/lib/lab-time";
import type { listVerifications } from "@/lib/plasmid/verification.server";
import { resultLabels, statusLabels, type VerificationResult, type VerificationScope, type VerificationStatus } from "@/lib/plasmid/verification";

type Row = Awaited<ReturnType<typeof listVerifications>>[number];

/**
 * 测序核查 (Q381): each check with its tube, scope and conclusion. Results stay per tube and per version; nothing here
 * adds up to "the plasmid is verified", and a check of an older version says so.
 */
export function VerificationList({ rows, currentVersionId, showTube = true }: { rows: Row[]; currentVersionId?: string | null; showTube?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted">No sequencing check yet.</p>;
  return (
    <ul className="ln-pw-badges-list">
      {rows.map((row) => {
        const scope = row.scopeJson as VerificationScope;
        return (
          <li key={row.id}>
            <Link className="font-medium text-moss underline-offset-2 hover:underline" href={`/tools/plasmid/verifications/${row.id}`}>
              {row.result ? resultLabels[row.result as VerificationResult] : statusLabels[row.status as VerificationStatus]}
            </Link>
            {row.result ? <span className="text-muted">{statusLabels[row.status as VerificationStatus]}</span> : null}
            {showTube ? <span>{row.inventoryItem ? <span data-i18n-ignore>{[row.inventoryItem.name, row.inventoryItem.lotNumber && `lot ${row.inventoryItem.lotNumber}`].filter(Boolean).join(" · ")}</span> : "No tube (analysis draft)"}</span> : null}
            <span className="text-muted"><span data-i18n-ignore={scope.kind === "feature" || undefined}>{scope.label}</span>{` · v${row.sequenceVersion.displayVersion}`}</span>
            {currentVersionId && row.sequenceVersionId !== currentVersionId ? <span className="text-warning">Older version</span> : null}
            <span className="text-muted">{labDate(row.confirmedAt ?? row.createdAt)}{row.confirmedBy ? <span data-i18n-ignore>{` · ${row.confirmedBy}`}</span> : null}</span>
          </li>
        );
      })}
    </ul>
  );
}
