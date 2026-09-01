import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";

type TemplateType = "primer_pair" | "sirna_duplex" | "single";

const templates: Record<TemplateType, { fileLabel: string; sheet: string; headers: string[]; sample: Record<string, string> }> = {
  primer_pair: {
    fileLabel: "Primer_Pairs",
    sheet: "Primer pairs",
    headers: ["name", "forwardSequence", "reverseSequence", "organism", "description", "pairType"],
    sample: {
      name: "FBN2",
      forwardSequence: "GCAGGACCAAGCCAGGAAT",
      reverseSequence: "GCTGTGCTCCATGTTGTAGC",
      organism: "Homo sapiens",
      description: "Replace or delete this example row.",
      pairType: "primer_pair",
    },
  },
  sirna_duplex: {
    fileLabel: "siRNA_Duplexes",
    sheet: "siRNA duplexes",
    headers: ["name", "senseSequence", "antisenseSequence", "organism", "description", "pairType"],
    sample: {
      name: "FBN2-siRNA-1",
      senseSequence: "GCAUGUUGCUACCUAAAUUTT",
      antisenseSequence: "AAUUUAGGUAGCAACAUGCTT",
      organism: "Homo sapiens",
      description: "Replace or delete this example row.",
      pairType: "sirna_duplex",
    },
  },
  single: {
    fileLabel: "Single_Sequences",
    sheet: "Single sequences",
    headers: ["name", "sequence", "designType", "moleculeType", "organism", "description"],
    sample: {
      name: "FBN2 fragment",
      sequence: "ATGCTGACCTGAACTG",
      designType: "fragment",
      moleculeType: "DNA",
      organism: "Homo sapiens",
      description: "Replace or delete this example row.",
    },
  },
};

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sheetData(template: (typeof templates)[TemplateType]): SheetData {
  return [
    template.headers.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#DDE8EA", wrap: true })),
    template.headers.map((header) => ({ value: template.sample[header] ?? "", type: String, backgroundColor: "#F7F4ED", fontStyle: "italic", textColor: "#6B6B63", wrap: true })),
  ];
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const type = (["primer_pair", "sirna_duplex", "single"].includes(search.get("type") ?? "") ? search.get("type") : "single") as TemplateType;
  const format = search.get("format") === "csv" ? "csv" : "xlsx";
  if (format === "csv") {
    const template = templates[type];
    const body = `${template.headers.map(csvValue).join(",")}\n${template.headers.map((header) => csvValue(template.sample[header])).join(",")}\n`;
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="LabNest_${template.fileLabel}_Import_Template.csv"` } });
  }

  const instructions: SheetData = [
    [{ value: "LabNest Sequence import — compact template", type: String, fontWeight: "bold", fontSize: 14 }],
    ["Use one sheet for the matching entry type. Delete the pale example row before entering final data."],
    ["You may upload this workbook, or copy filled cells directly into Sequence > Import."],
    ["Primer pair: one row is one entry containing Forward and Reverse sequences."],
    ["Alternatively, copied supplier rows named -F/-R, -F1/-R1, qF/qR, Forward/Reverse, 上游/下游, or 正向/反向 can be paired in the paste preview."],
    ["siRNA duplex: one row is one entry containing sense and antisense sequences. A terminal T or TT may record a 3′ dT overhang."],
    ["Only key scientific fields are imported. Purchasing quantities, price, tube count, purification, contact, invoice, and shipping fields are ignored."],
    ["All imports create Draft / Unverified entries. Review them in LabNest before changing lifecycle or validation status."],
  ];
  const buffer = await writeXlsxFile([
    ...Object.values(templates).map((template) => ({ sheet: template.sheet, data: sheetData(template), columns: template.headers.map((header) => ({ width: header.toLowerCase().includes("sequence") ? 34 : header === "description" ? 36 : 22 })) })),
    { sheet: "Instructions", data: instructions, columns: [{ width: 120 }] },
  ], { fontFamily: "Arial", fontSize: 10 }).toBuffer();
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="LabNest_Sequence_Import_Template.xlsx"' } });
}
