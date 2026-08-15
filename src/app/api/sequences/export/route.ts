import { prisma } from "@/lib/db";
import { toFasta } from "@/lib/sequence";

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
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

  const records = await prisma.sequence.findMany({
    where: {
      ...(exportScope === "selected" ? { id: { in: ids } } : {}),
      ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { targetName: { contains: q, mode: "insensitive" } }, { organism: { contains: q, mode: "insensitive" } }] } : {}),
      ...(designType ? { designType: designType as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(moleculeType || validationStatus ? { versions: { some: { ...(moleculeType ? { moleculeType: moleculeType as never } : {}), ...(validationStatus ? { validationStatus: validationStatus as never } : {}) } } } : {}),
    },
    include: {
      project: { select: { name: true } },
      versions: {
        include: { features: { orderBy: { start: "asc" } }, modifications: { orderBy: { order: "asc" } } },
        orderBy: { versionNumber: "desc" },
        ...(versionScope === "latest" ? { take: 1 } : {}),
      },
    },
    orderBy: [{ code: "asc" }],
  });

  if (format === "fasta") {
    const body = records.flatMap((record) => record.versions.map((version) => toFasta(`${record.code}|${record.name.replaceAll(" ", "_")}|v${version.displayVersion}|${version.moleculeType}`, version.sequence))).join("\n");
    return new Response(`${body}${body ? "\n" : ""}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequences.fasta"' } });
  }

  const headers = ["code", "name", "designType", "status", "project", "targetName", "organism", "description", "version", "moleculeType", "sequence", "length", "topology", "strandedness", "validationStatus", "validationSummary", "checksum", "changeSummary", "featuresJson", "modificationsJson"];
  const rows = records.flatMap((record) => record.versions.map((version) => ({
    code: record.code,
    name: record.name,
    designType: record.designType,
    status: record.status,
    project: record.project?.name,
    targetName: record.targetName,
    organism: record.organism,
    description: record.description,
    version: version.displayVersion,
    moleculeType: version.moleculeType,
    sequence: version.sequence,
    length: version.sequence.length,
    topology: version.topology,
    strandedness: version.strandedness,
    validationStatus: version.validationStatus,
    validationSummary: version.validationSummary,
    checksum: version.checksum,
    changeSummary: version.changeSummary,
    featuresJson: version.features.map(({ name, type, start, end, strand, note }) => ({ name, type, start, end, strand, note })),
    modificationsJson: version.modifications.map(({ position, modification, note }) => ({ position, modification, note })),
  })));
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvValue(row[header as keyof typeof row])).join(","))].join("\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="LabNest_Sequences.csv"' } });
}
