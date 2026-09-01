import { prisma } from "@/lib/db";
import { toFasta } from "@/lib/sequence";

function csvValue(value: unknown) {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const format = search.get("format") === "fasta" ? "fasta" : "csv";
  const versionScope = search.get("versions") === "all" ? "all" : "latest";
  const exportScope = search.get("exportScope") ?? "filtered";
  const ids = search.getAll("id").filter(Boolean).slice(0, 500);
  const q = exportScope === "all" ? undefined : search.get("q")?.trim() || undefined;
  const designType = exportScope === "all" ? undefined : search.get("designType") || undefined;
  const status = exportScope === "all" ? undefined : search.get("status") || undefined;
  const moleculeType = exportScope === "all" ? undefined : search.get("moleculeType") || undefined;
  const validationStatus = exportScope === "all" ? undefined : search.get("validationStatus") || undefined;
  const textFilter = q ? { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }, { targetName: { contains: q, mode: "insensitive" as const } }, { organism: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {};

  const [records, pairs] = await Promise.all([
    prisma.sequence.findMany({
      where: { pairMembership: { is: null }, ...(exportScope === "selected" ? { id: { in: ids } } : {}), ...textFilter, ...(designType ? { designType: designType as never } : {}), ...(status ? { status: status as never } : exportScope === "selected" || exportScope === "all" ? {} : { status: { not: "archived" as const } }), ...(moleculeType || validationStatus ? { versions: { some: { ...(moleculeType ? { moleculeType: moleculeType as never } : {}), ...(validationStatus ? { validationStatus: validationStatus as never } : {}) } } } : {}) },
      include: { project: { select: { name: true } }, versions: { include: { features: { orderBy: { start: "asc" } }, modifications: { orderBy: { order: "asc" } } }, orderBy: { versionNumber: "desc" }, ...(versionScope === "latest" ? { take: 1 } : {}) } },
      orderBy: { code: "asc" },
    }),
    prisma.sequencePair.findMany({
      where: { ...(exportScope === "selected" ? { id: { in: ids } } : {}), ...textFilter, ...(designType === "primer" ? { type: "primer_pair" as const } : designType === "siRNA" ? { type: "sirna_duplex" as const } : designType ? { id: "__no_pair_matches__" } : {}), ...(status ? { status: status as never } : exportScope === "selected" || exportScope === "all" ? {} : { status: { not: "archived" as const } }), ...(moleculeType || validationStatus ? { members: { some: { sequenceVersion: { ...(moleculeType ? { moleculeType: moleculeType as never } : {}), ...(validationStatus ? { validationStatus: validationStatus as never } : {}) } } } } : {}) },
      include: { project: { select: { name: true } }, members: { include: { sequenceVersion: true }, orderBy: { order: "asc" } } },
      orderBy: { code: "asc" },
    }),
  ]);

  if (format === "fasta") {
    const body = [...records.flatMap((record) => record.versions.map((version) => toFasta(`${record.code}|${record.name.replaceAll(" ", "_")}|v${version.displayVersion}|${version.moleculeType}`, version.sequence))), ...pairs.flatMap((pair) => pair.members.map((member) => toFasta(`${pair.code}|${pair.name.replaceAll(" ", "_")}|${member.role}|v${member.sequenceVersion.displayVersion}|${member.sequenceVersion.moleculeType}`, member.sequenceVersion.sequence)))].join("\n");
    return new Response(`${body}${body ? "\n" : ""}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequences.fasta"' } });
  }

  const headers = ["code", "name", "entryKind", "entryClass", "pairType", "designType", "status", "ownershipScope", "project", "targetName", "organism", "description", "version", "moleculeType", "sequence", "forwardSequence", "reverseSequence", "senseSequence", "antisenseSequence", "length", "topology", "strandedness", "validationStatus", "validationSummary", "checksum", "changeSummary", "featuresJson", "modificationsJson"];
  const rows: Array<Record<string, unknown>> = [
    ...records.flatMap((record) => record.versions.map((version) => ({ code: record.code, name: record.name, entryKind: "single", entryClass: record.entryClass, pairType: "", designType: record.designType, status: record.status, ownershipScope: record.ownershipScope, project: record.project?.name, targetName: record.targetName, organism: record.organism, description: record.description, version: version.displayVersion, moleculeType: version.moleculeType, sequence: version.sequence, forwardSequence: "", reverseSequence: "", senseSequence: "", antisenseSequence: "", length: version.sequence.length, topology: version.topology, strandedness: version.strandedness, validationStatus: version.validationStatus, validationSummary: version.validationSummary, checksum: version.checksum, changeSummary: version.changeSummary, featuresJson: version.features.map(({ name, type, start, end, strand, note }) => ({ name, type, start, end, strand, note })), modificationsJson: version.modifications.map(({ position, modification, note }) => ({ position, modification, note })) }))),
    ...pairs.map((pair) => ({ code: pair.code, name: pair.name, entryKind: "paired", entryClass: "oligo", pairType: pair.type, designType: pair.type === "primer_pair" ? "primer" : "siRNA", status: pair.status, ownershipScope: pair.ownershipScope, project: pair.project?.name, targetName: pair.targetName, organism: pair.organism, description: pair.description, version: "", moleculeType: pair.members[0]?.sequenceVersion.moleculeType, sequence: "", forwardSequence: pair.members.find((member) => member.role === "forward")?.sequenceVersion.sequence ?? "", reverseSequence: pair.members.find((member) => member.role === "reverse")?.sequenceVersion.sequence ?? "", senseSequence: pair.members.find((member) => member.role === "sense")?.sequenceVersion.sequence ?? "", antisenseSequence: pair.members.find((member) => member.role === "antisense")?.sequenceVersion.sequence ?? "", length: pair.members.reduce((sum, member) => sum + member.sequenceVersion.sequence.length, 0), topology: "linear", strandedness: "paired", validationStatus: pair.members.map((member) => `${member.role}:${member.sequenceVersion.validationStatus}`).join(";"), validationSummary: pair.members.map((member) => member.sequenceVersion.validationSummary).filter(Boolean).join(" | "), checksum: pair.members.map((member) => `${member.role}:${member.sequenceVersion.checksum}`).join(";"), changeSummary: "", featuresJson: [], modificationsJson: [] })),
  ];
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(","))].join("\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequences.csv"' } });
}
