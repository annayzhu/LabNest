import { prisma } from "@/lib/db";
import type { LibraryElement } from "./feature-library";

/** The lab's own library entries (Q362), shaped like the built-in ones so detection treats them alike. */
export async function listLibraryEntries(): Promise<LibraryElement[]> {
  const rows = await prisma.plasmidLibraryEntry.findMany({ orderBy: { name: "asc" }, take: 1_000 });
  return rows.map((row) => ({ id: `lab-${row.id}`, name: row.name, type: row.type, kind: row.kind === "protein" ? "protein" : "dna", sequence: row.sequence, source: { citation: "Added by the lab" }, ...(row.note ? { note: row.note } : {}) }));
}

export async function addLibraryEntry(entry: { name: string; type: string; kind: "dna" | "protein"; sequence: string; note?: string }) {
  const existing = await prisma.plasmidLibraryEntry.findUnique({ where: { kind_sequence: { kind: entry.kind, sequence: entry.sequence } }, select: { name: true } });
  if (existing) throw new Error(`This sequence is already in the library as “${existing.name}”.`);
  const row = await prisma.plasmidLibraryEntry.create({ data: { name: entry.name, type: entry.type, kind: entry.kind, sequence: entry.sequence, note: entry.note || null }, select: { id: true } });
  await prisma.activityLog.create({ data: { action: "create", targetType: "plasmid_library_entry", targetId: row.id, metadataJson: { name: entry.name, kind: entry.kind, length: entry.sequence.length } } });
  return row.id;
}

export async function removeLibraryEntry(id: string) {
  const row = await prisma.plasmidLibraryEntry.delete({ where: { id }, select: { name: true } });
  await prisma.activityLog.create({ data: { action: "delete", targetType: "plasmid_library_entry", targetId: id, metadataJson: { name: row.name } } });
}
