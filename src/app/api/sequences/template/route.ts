import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";

const headers = [
  "name", "designType", "moleculeType", "sequence", "status", "validationStatus",
  "validationSummary", "targetName", "organism", "description", "topology",
  "strandedness", "displayVersion", "featuresJson", "modificationsJson",
];

const sample: Record<string, string> = {
  name: "FBN2 qPCR forward primer",
  designType: "primer",
  moleculeType: "DNA",
  sequence: "ATGCTGACCTGAACTG",
  status: "draft",
  validationStatus: "unverified",
  validationSummary: "",
  targetName: "FBN2",
  organism: "Homo sapiens",
  description: "Replace or remove this example row before importing.",
  topology: "linear",
  strandedness: "single",
  displayVersion: "1.0",
  featuresJson: "[]",
  modificationsJson: "[]",
};

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  if (format === "csv") {
    const body = `${headers.map(csvValue).join(",")}\n${headers.map((header) => csvValue(sample[header])).join(",")}\n`;
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequence_Import_Template.csv"' } });
  }

  const data: SheetData = [
    headers.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#DDE8EA", wrap: true })),
    headers.map((header) => ({ value: sample[header] ?? "", type: String, backgroundColor: "#F7F4ED", fontStyle: "italic", textColor: "#6B6B63", wrap: true })),
  ];
  const instructions: SheetData = [
    [{ value: "LabNest Sequence structured import", type: String, fontWeight: "bold" }],
    ["Keep header names unchanged and add one Sequence record per row."],
    ["Delete or replace the example row before importing."],
    ["designType: plasmid, primer, probe, siRNA, shRNA, gRNA, oligo, peptide, protein, fragment, other"],
    ["moleculeType: DNA, RNA, Protein"],
    ["siRNA convention: RNA sequences may end in T or TT to record a 3′ dT overhang; T remains invalid elsewhere in an RNA sequence."],
    ["status: draft, active, inactive, archived"],
    ["validationStatus: unverified, validation_in_progress, validated_recommended, validated_limited, validated_not_recommended, inconclusive"],
    ["featuresJson example: [{\"name\":\"CDS\",\"type\":\"CDS\",\"start\":1,\"end\":120,\"strand\":\"+\"}]"],
    ["modificationsJson example: [{\"position\":\"5′\",\"modification\":\"FAM\",\"note\":\"reporter\"}]"],
  ];
  const buffer = await writeXlsxFile([
    { sheet: "Import", data, columns: headers.map((header) => ({ width: header === "sequence" ? 45 : 22 })) },
    { sheet: "Instructions", data: instructions, columns: [{ width: 120 }] },
  ], { fontFamily: "Arial", fontSize: 10 }).toBuffer();
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="LabNest_Sequence_Import_Template.xlsx"' } });
}
