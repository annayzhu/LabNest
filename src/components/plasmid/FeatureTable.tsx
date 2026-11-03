"use client";

import { clockwiseSegments, formatSegments } from "@/lib/plasmid/layout";
import { featureLength, type SequenceRecord } from "@/lib/plasmid/model";
import { X } from "lucide-react";
import { featureColor, strandArrow, strandName } from "@/lib/plasmid/workbench";

const evidenceLabels = { file: "From the file", user: "Added by hand", "reference-match": "Reference match", prediction: "Prediction" } as const;

/**
 * Every feature, even those the map has no room to label (F03). Rows select like the map does. Features from `auto.from`
 * on were found by the library this time; they say how close the match is and can be taken out.
 */
export function FeatureTable({ record, selectedFeature, onSelectFeature, auto }: {
  record: SequenceRecord;
  selectedFeature?: number;
  onSelectFeature: (index: number) => void;
  auto?: { from: number; identities: number[]; onRemove: (index: number) => void };
}) {
  if (!record.features.length) return <p className="ln-pw-note">This sequence has no annotated features.</p>;
  return (
    <div className="ln-pw-table-wrap">
      <table className="ln-pw-table">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Type</th>
            <th scope="col">Location</th>
            <th scope="col">Strand</th>
            <th scope="col">Length</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {record.features.map((feature, index) => (
            <tr key={index} data-selected={index === selectedFeature || undefined} onClick={() => onSelectFeature(index)}>
              <td>
                <button type="button" className="ln-pw-table-name">
                  <span className="ln-pw-swatch" style={{ background: featureColor(feature) }} aria-hidden />
                  <span data-i18n-ignore>{feature.name}</span>
                </button>
              </td>
              <td data-i18n-ignore>{feature.type}</td>
              <td className="ln-pw-mono">{formatSegments(clockwiseSegments(feature))}</td>
              <td aria-label={strandName(feature.strand)}>{strandArrow(feature.strand)}</td>
              <td className="ln-pw-mono">{`${featureLength(feature).toLocaleString("en-US")} bp`}</td>
              <td>
                {auto && index >= auto.from ? (
                  <span className="ln-pw-auto">
                    <span>{auto.identities[index - auto.from] < 1 ? `Detected · ${(Math.floor(auto.identities[index - auto.from] * 1000) / 10).toFixed(1)}%` : "Detected"}</span>
                    <button type="button" className="ln-pw-link" aria-label="Remove this detected feature" onClick={(event) => { event.stopPropagation(); auto.onRemove(index); }}><X className="h-3 w-3" aria-hidden /></button>
                  </span>
                ) : evidenceLabels[feature.evidence]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
