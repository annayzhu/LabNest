import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { prisma } from "@/lib/db";
import { toFasta } from "@/lib/sequence";
import { sequencePairDefinition, sequencePairTypeForDesignType } from "@/lib/sequence-entry";
import { designTypeLabel, pairTypeLabel, validationStatusLabel } from "@/lib/sequence-registry";

type ExportVersion = {
  displayVersion: string;
  moleculeType: string;
  sequence: string;
  topology: string;
  strandedness: string;
  validationStatus: string;
  validationSummary: string | null;
  checksum: string;
  changeSummary: string | null;
  features?: Array<{ name: string; type: string; start: number; end: number; strand: string | null; note: string | null }>;
  modifications?: Array<{ position: string; modification: string; note: string | null }>;
};

type ExportEntry = {
  id: string;
  code: string;
  name: string;
  kind: "single" | "paired";
  entryClass: string;
  pairType?: "primer_pair" | "sirna_duplex";
  designType: string;
  status: string;
  ownershipScope: string;
  project?: string;
  targetName?: string;
  organism?: string;
  description?: string;
  updatedAt: Date;
  versions: ExportVersion[];
  members: Array<{ role: string; version: ExportVersion }>;
};

function safeSpreadsheetText(value: unknown) {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvValue(value: unknown) {
  const text = safeSpreadsheetText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function lifecycleLabel(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).replaceAll("_", " ")}` : "";
}

function moleculeSummary(entry: ExportEntry) {
  if (entry.kind === "paired") return `${pairTypeLabel(entry.pairType ?? "paired")} · ${entry.members.map((member) => `${member.role} ${member.version.sequence.length} nt`).join(" · ")}`;
  const version = entry.versions[0];
  if (!version) return "";
  return `${version.moleculeType === "Protein" ? "Amino acid" : version.moleculeType} · ${version.sequence.length} ${version.moleculeType === "Protein" ? "aa" : "nt"}`;
}

function validationSummary(entry: ExportEntry) {
  if (entry.kind === "paired") return entry.members.map((member) => `${member.role}: ${validationStatusLabel(member.version.validationStatus)}`).join(" · ");
  return validationStatusLabel(entry.versions[0]?.validationStatus ?? "unverified");
}

function headerRow(headers: string[]): SheetData[number] {
  return headers.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#DDE8EA", textColor: "#243A3A", wrap: true }));
}

function textRow(values: unknown[], mutedColumns: number[] = []): SheetData[number] {
  return values.map((value, index) => ({ value: safeSpreadsheetText(value), type: String, wrap: true, ...(mutedColumns.includes(index) ? { textColor: "#7A7A72", fontSize: 9 } : {}) }));
}

function xlsxSheets(entries: ExportEntry[], context: Array<[string, string]>) {
  const currentHeaders = ["Sequence", "Reference", "Design type", "Molecule", "Target / organism", "Validation", "Lifecycle", "Project / location"];
  const current: SheetData = [
    headerRow(currentHeaders),
    ...entries.map((entry) => textRow([
      entry.name,
      entry.code,
      designTypeLabel(entry.designType),
      moleculeSummary(entry),
      [entry.targetName, entry.organism].filter(Boolean).join(" · "),
      validationSummary(entry),
      lifecycleLabel(entry.status),
      entry.project ?? "Sequence library",
    ], [1])),
  ];

  const detailHeaders = ["name", "reference", "entryKind", "designType", "pairType", "moleculeType", "sequence", "forwardSequence", "reverseSequence", "senseSequence", "antisenseSequence", "targetName", "organism", "projectOrLocation", "description", "version", "status", "validation"];
  const details: SheetData = [
    headerRow(detailHeaders),
    ...entries.map((entry) => {
      const latest = entry.versions[0];
      const member = (role: string) => entry.members.find((item) => item.role === role)?.version.sequence ?? "";
      return textRow([
        entry.name,
        entry.code,
        entry.kind,
        entry.designType,
        entry.pairType ?? "",
        latest?.moleculeType ?? entry.members[0]?.version.moleculeType ?? "",
        latest?.sequence ?? "",
        member("forward"),
        member("reverse"),
        member("sense"),
        member("antisense"),
        entry.targetName,
        entry.organism,
        entry.project ?? "Sequence library",
        entry.description,
        latest?.displayVersion ?? "",
        entry.status,
        validationSummary(entry),
      ], [1]);
    }),
  ];
  const exportContext: SheetData = [headerRow(["Export context", "Value"]), ...context.map(([label, value]) => textRow([label, value]))];
  return [
    { sheet: "Current view", data: current, columns: [{ width: 28 }, { width: 16 }, { width: 18 }, { width: 38 }, { width: 30 }, { width: 36 }, { width: 16 }, { width: 24 }] },
    { sheet: "Sequence details", data: details, columns: detailHeaders.map((header) => ({ width: header.toLowerCase().includes("sequence") ? 36 : header === "description" ? 38 : 20 })) },
    { sheet: "Export context", data: exportContext, columns: [{ width: 26 }, { width: 72 }] },
  ];
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const requestedFormat = search.get("format");
  const format = requestedFormat === "fasta" ? "fasta" : requestedFormat === "csv" ? "csv" : "xlsx";
  const versionScope = search.get("versions") === "all" ? "all" : "latest";
  const exportScope = search.get("exportScope") ?? "filtered";
  const ids = search.getAll("id").filter(Boolean).slice(0, 500);
  const q = exportScope === "all" ? undefined : search.get("q")?.trim() || undefined;
  const designType = exportScope === "all" ? undefined : search.get("designType") || undefined;
  const status = exportScope === "all" ? undefined : search.get("status") || undefined;
  const moleculeType = exportScope === "all" ? undefined : search.get("moleculeType") || undefined;
  const validationStatus = exportScope === "all" ? undefined : search.get("validationStatus") || undefined;
  const sort = search.get("sort") ?? "updated_desc";
  const pairTypeFilter = designType ? sequencePairTypeForDesignType(designType) : undefined;
  const textFilter = q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }, { targetName: { contains: q, mode: "insensitive" as const } }, { organism: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {};

  const [records, pairs] = await Promise.all([
    prisma.sequence.findMany({
      where: { pairMembership: { is: null }, ...(exportScope === "selected" ? { id: { in: ids } } : {}), ...textFilter, ...(designType ? { designType: designType as never } : {}), ...(status ? { status: status as never } : exportScope === "selected" || exportScope === "all" ? {} : { status: { not: "archived" as const } }), ...(versionScope === "all" && (moleculeType || validationStatus) ? { versions: { some: { ...(moleculeType ? { moleculeType: moleculeType as never } : {}), ...(validationStatus ? { validationStatus: validationStatus as never } : {}) } } } : {}) },
      include: { project: { select: { name: true } }, versions: { include: { features: { orderBy: { start: "asc" } }, modifications: { orderBy: { order: "asc" } } }, orderBy: { versionNumber: "desc" }, ...(versionScope === "latest" || format === "xlsx" ? { take: 1 } : {}) } },
    }),
    prisma.sequencePair.findMany({
      where: { ...(exportScope === "selected" ? { id: { in: ids } } : {}), ...textFilter, ...(pairTypeFilter ? { type: pairTypeFilter } : designType ? { id: "__no_pair_matches__" } : {}), ...(status ? { status: status as never } : exportScope === "selected" || exportScope === "all" ? {} : { status: { not: "archived" as const } }), ...(moleculeType || validationStatus ? { members: { ...(moleculeType ? { every: { sequenceVersion: { moleculeType: moleculeType as never } } } : {}), ...(validationStatus ? { some: { sequenceVersion: { validationStatus: validationStatus as never } } } : {}) } } : {}) },
      include: { project: { select: { name: true } }, members: { include: { sequenceVersion: true }, orderBy: { order: "asc" } } },
    }),
  ]);
  const filteredRecords = versionScope === "latest" || format === "xlsx" ? records.filter((record) => {
    const latest = record.versions[0];
    return latest && (!moleculeType || latest.moleculeType === moleculeType) && (!validationStatus || latest.validationStatus === validationStatus);
  }) : records;

  const entries: ExportEntry[] = [
    ...filteredRecords.map((record) => ({
      id: record.id, code: record.code, name: record.name, kind: "single" as const, entryClass: record.entryClass, designType: record.designType, status: record.status, ownershipScope: record.ownershipScope, project: record.project?.name, targetName: record.targetName ?? undefined, organism: record.organism ?? undefined, description: record.description ?? undefined, updatedAt: record.updatedAt, versions: record.versions, members: [],
    })),
    ...pairs.map((pair) => ({
      id: pair.id, code: pair.code, name: pair.name, kind: "paired" as const, entryClass: "oligo", pairType: pair.type, designType: sequencePairDefinition(pair.type).designType, status: pair.status, ownershipScope: pair.ownershipScope, project: pair.project?.name, targetName: pair.targetName ?? undefined, organism: pair.organism ?? undefined, description: pair.description ?? undefined, updatedAt: pair.updatedAt, versions: [], members: pair.members.map((member) => ({ role: member.role, version: member.sequenceVersion })),
    })),
  ];
  const selectedOrder = new Map(ids.map((id, index) => [id, index]));
  entries.sort((a, b) => exportScope === "selected"
    ? (selectedOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (selectedOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    : sort === "name_asc" ? a.name.localeCompare(b.name)
      : sort === "code_asc" ? a.code.localeCompare(b.code)
        : b.updatedAt.getTime() - a.updatedAt.getTime());

  if (format === "fasta") {
    const body = entries.flatMap((entry) => entry.kind === "single"
      ? entry.versions.map((version) => toFasta(`${entry.code}|${entry.name.replaceAll(" ", "_")}|v${version.displayVersion}|${version.moleculeType}`, version.sequence))
      : entry.members.map((member) => toFasta(`${entry.code}|${entry.name.replaceAll(" ", "_")}|${member.role}|v${member.version.displayVersion}|${member.version.moleculeType}`, member.version.sequence))).join("\n");
    return new Response(`${body}${body ? "\n" : ""}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequences.fasta"' } });
  }

  if (format === "xlsx") {
    const context: Array<[string, string]> = [
      ["Scope", exportScope],
      ["Entries", String(entries.length)],
      ["Sort", sort],
      ["Search", q ?? ""],
      ["Design type", designType ?? "All"],
      ["Molecule", moleculeType ?? "All"],
      ["Validation", validationStatus ?? "All"],
      ["Lifecycle", status ?? "All"],
      ["Exported at", new Date().toISOString()],
    ];
    const buffer = await writeXlsxFile(xlsxSheets(entries, context), { fontFamily: "Arial", fontSize: 10 }).toBuffer();
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="LabNest_Sequences_Current_View.xlsx"' } });
  }

  const headers = ["code", "name", "entryKind", "entryClass", "pairType", "designType", "status", "ownershipScope", "project", "targetName", "organism", "description", "version", "moleculeType", "sequence", "forwardSequence", "reverseSequence", "senseSequence", "antisenseSequence", "length", "topology", "strandedness", "validationStatus", "validationSummary", "checksum", "changeSummary", "featuresJson", "modificationsJson"];
  const rows: Array<Record<string, unknown>> = entries.flatMap<Record<string, unknown>>((entry) => entry.kind === "single"
    ? entry.versions.map((version) => ({ code: entry.code, name: entry.name, entryKind: "single", entryClass: entry.entryClass, pairType: "", designType: entry.designType, status: entry.status, ownershipScope: entry.ownershipScope, project: entry.project, targetName: entry.targetName, organism: entry.organism, description: entry.description, version: version.displayVersion, moleculeType: version.moleculeType, sequence: version.sequence, forwardSequence: "", reverseSequence: "", senseSequence: "", antisenseSequence: "", length: version.sequence.length, topology: version.topology, strandedness: version.strandedness, validationStatus: version.validationStatus, validationSummary: version.validationSummary, checksum: version.checksum, changeSummary: version.changeSummary, featuresJson: version.features ?? [], modificationsJson: version.modifications ?? [] }))
    : [{ code: entry.code, name: entry.name, entryKind: "paired", entryClass: entry.entryClass, pairType: entry.pairType ?? "", designType: entry.designType, status: entry.status, ownershipScope: entry.ownershipScope, project: entry.project, targetName: entry.targetName, organism: entry.organism, description: entry.description, version: "", moleculeType: entry.members[0]?.version.moleculeType, sequence: "", forwardSequence: entry.members.find((member) => member.role === "forward")?.version.sequence ?? "", reverseSequence: entry.members.find((member) => member.role === "reverse")?.version.sequence ?? "", senseSequence: entry.members.find((member) => member.role === "sense")?.version.sequence ?? "", antisenseSequence: entry.members.find((member) => member.role === "antisense")?.version.sequence ?? "", length: entry.members.reduce((sum, member) => sum + member.version.sequence.length, 0), topology: "linear", strandedness: "paired", validationStatus: entry.members.map((member) => `${member.role}:${member.version.validationStatus}`).join(";"), validationSummary: entry.members.map((member) => member.version.validationSummary).filter(Boolean).join(" | "), checksum: entry.members.map((member) => `${member.role}:${member.version.checksum}`).join(";"), changeSummary: "", featuresJson: [], modificationsJson: [] }]);
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))].join("\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequences.csv"' } });
}
