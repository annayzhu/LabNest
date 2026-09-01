import { validateSequence, type MoleculeType } from "@/lib/sequence";

export type SequencePasteMode = "primer_pair" | "sirna_duplex" | "single";

export type SequencePasteMember = {
  role: "forward" | "reverse" | "sense" | "antisense" | "sequence";
  sequence: string;
};

export type SequencePasteEntry = {
  kind: "pair" | "single";
  pairType?: "primer_pair" | "sirna_duplex";
  name: string;
  targetName?: string;
  organism?: string;
  description?: string;
  sourceRows: number[];
  members: SequencePasteMember[];
};

export type SequencePastePreview = {
  entries: SequencePasteEntry[];
  errors: string[];
  warnings: string[];
  sourceRowCount: number;
};

type ParsedRow = {
  rowNumber: number;
  cells: string[];
  sequenceCells: Array<{ index: number; sequence: string }>;
};

type ColumnMap = Partial<Record<"name" | "forward" | "reverse" | "sense" | "antisense" | "sequence" | "organism" | "description", number>>;

const headerAliases: Record<keyof ColumnMap, string[]> = {
  name: ["name", "sequencename", "primername", "genename", "targetgene", "targetname", "名称", "序列名称", "引物名称", "primer名称", "基因名称", "基因名", "靶基因", "靶点名称"],
  forward: ["forward", "forwardsequence", "forwardprimer", "forwardprimersequence", "正向", "正向序列", "正向引物", "正向引物序列", "上游", "上游序列", "上游引物", "上游引物序列", "f序列"],
  reverse: ["reverse", "reversesequence", "reverseprimer", "reverseprimersequence", "反向", "反向序列", "反向引物", "反向引物序列", "下游", "下游序列", "下游引物", "下游引物序列", "r序列"],
  sense: ["sense", "sensesequence", "正义链", "正义链序列"],
  antisense: ["antisense", "antisensesequence", "反义链", "反义链序列"],
  sequence: ["sequence", "sequence53", "oligosequence", "primersequence", "序列", "序列53", "碱基序列", "引物序列"],
  organism: ["organism", "species", "物种", "物种名称"],
  description: ["description", "note", "notes", "remark", "remarks", "说明", "备注"],
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s\u00a0'′’"“”`´‐‑‒–—―_()（）\[\]【】:：/\\.-]+/g, "");
}

function splitClipboardRows(input: string) {
  return input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({ rowNumber: index + 1, cells: line.split("\t").map((cell) => cell.trim()) }))
    .filter((row) => row.cells.some(Boolean));
}

function normalizedCandidate(value: string) {
  return value.replace(/[\s\u00a0]/g, "").toUpperCase();
}

function isSequenceCandidate(value: string, moleculeType: MoleculeType, allowTerminalT = false) {
  const sequence = normalizedCandidate(value);
  if (sequence.length < 8) return false;
  if (headerKey(value)) return false;
  return validateSequence(sequence, moleculeType, { allowTerminalDeoxythymidineOverhang: allowTerminalT }).errors.length === 0;
}

function sequenceCells(cells: string[], moleculeType: MoleculeType, allowTerminalT = false) {
  return cells.flatMap((cell, index) => isSequenceCandidate(cell, moleculeType, allowTerminalT)
    ? [{ index, sequence: normalizedCandidate(cell) }]
    : []);
}

function headerKey(value: string): keyof ColumnMap | undefined {
  const normalized = normalizeHeader(value);
  if (!normalized) return undefined;
  return (Object.entries(headerAliases) as Array<[keyof ColumnMap, string[]]>).find(([, aliases]) => aliases.some((alias) => normalized === alias || normalized.startsWith(alias) || normalized.endsWith(alias)))?.[0];
}

function inferColumns(rows: Array<{ cells: string[] }>, firstDataIndex: number) {
  const columns: ColumnMap = {};
  const headerRows = rows.slice(Math.max(0, firstDataIndex - 3), firstDataIndex);
  const width = Math.max(0, ...headerRows.map((row) => row.cells.length));
  for (let column = 0; column < width; column += 1) {
    const candidates = headerRows.map((row) => row.cells[column] ?? "").filter(Boolean).reverse();
    for (const candidate of candidates) {
      const key = headerKey(candidate);
      if (key && columns[key] === undefined) {
        columns[key] = column;
        break;
      }
    }
  }
  return columns;
}

function cellAt(row: ParsedRow, index: number | undefined) {
  return index === undefined ? undefined : row.cells[index]?.trim() || undefined;
}

function looksLikeAdministrativeCode(value: string) {
  const compact = value.replace(/\s/g, "");
  return /^\d+(?:\.\d+)?$/.test(compact)
    || /^(?:no|编号|序号)[:：-]?\d+$/i.test(compact)
    || /^(?:cat|order|geneid|id)[-_:：]?[a-z0-9.-]+$/i.test(compact);
}

function inferredName(row: ParsedRow, columns: ColumnMap) {
  const mapped = cellAt(row, columns.name);
  if (mapped && !isSequenceCandidate(mapped, "DNA") && !isSequenceCandidate(mapped, "RNA", true)) return mapped;
  const firstSequenceIndex = row.sequenceCells[0]?.index ?? row.cells.length;
  for (let index = firstSequenceIndex - 1; index >= 0; index -= 1) {
    const value = row.cells[index]?.trim();
    if (!value || looksLikeAdministrativeCode(value)) continue;
    if (headerKey(value)) continue;
    if (isSequenceCandidate(value, "DNA") || isSequenceCandidate(value, "RNA", true)) continue;
    return value;
  }
  return undefined;
}

function uniqueWarnings(values: string[]) {
  return [...new Set(values)];
}

function memberSequence(row: ParsedRow, preferredColumn: number | undefined, fallbackOrder: number) {
  const preferred = preferredColumn === undefined ? undefined : row.sequenceCells.find((item) => item.index === preferredColumn)?.sequence;
  return preferred ?? row.sequenceCells[fallbackOrder]?.sequence;
}

function parsePrimerRole(name: string): { root: string; role: "forward" | "reverse"; index: string } | undefined {
  const patterns: Array<{ expression: RegExp; role?: "forward" | "reverse" }> = [
    { expression: /^(.*?)(?:[-_\s]*)(?:q)?([fr])(\d*)$/i },
    { expression: /^(.*?)(?:[-_\s]*)(forward|reverse)(\d*)$/i },
    { expression: /^(.*?)(?:[-_\s]*)(上游|下游|正向|反向)(?:引物)?(\d*)$/i },
  ];
  for (const pattern of patterns) {
    const match = name.match(pattern.expression);
    if (!match) continue;
    const token = match[2].toLowerCase();
    const role = pattern.role ?? (["f", "forward", "上游", "正向"].includes(token) ? "forward" : "reverse");
    const root = match[1].replace(/[-_\s]+$/g, "").trim();
    if (root) return { root, role, index: match[3] ?? "" };
  }
  return undefined;
}

function rowMetadata(row: ParsedRow, columns: ColumnMap) {
  return {
    organism: cellAt(row, columns.organism),
    description: cellAt(row, columns.description),
  };
}

export function parseSequencePaste(input: string, mode: SequencePasteMode, moleculeType: MoleculeType = "DNA"): SequencePastePreview {
  const rows = splitClipboardRows(input);
  const sourceRowCount = rows.length;
  if (!rows.length) return { entries: [], errors: ["Paste one or more rows copied from Excel."], warnings: [], sourceRowCount };

  const expectedMolecule: MoleculeType = mode === "primer_pair" ? "DNA" : mode === "sirna_duplex" ? "RNA" : moleculeType;
  const allowTerminalT = mode === "sirna_duplex";
  const firstDataIndex = rows.findIndex((row) => sequenceCells(row.cells, expectedMolecule, allowTerminalT).length > 0);
  if (firstDataIndex < 0) return { entries: [], errors: [`No valid ${expectedMolecule} sequence cells were found.`], warnings: [], sourceRowCount };
  const columns = inferColumns(rows, firstDataIndex);
  const parsedRows: ParsedRow[] = rows.slice(firstDataIndex).map((row) => ({ ...row, sequenceCells: sequenceCells(row.cells, expectedMolecule, allowTerminalT) })).filter((row) => row.sequenceCells.length > 0);
  const entries: SequencePasteEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (mode === "single") {
    for (const row of parsedRows) {
      const name = inferredName(row, columns);
      const sequence = memberSequence(row, columns.sequence, 0);
      if (!name) errors.push(`Row ${row.rowNumber}: a name could not be identified.`);
      else if (!sequence) errors.push(`Row ${row.rowNumber}: a sequence could not be identified.`);
      else entries.push({ kind: "single", name, targetName: name, ...rowMetadata(row, columns), sourceRows: [row.rowNumber], members: [{ role: "sequence", sequence }] });
    }
  } else if (mode === "sirna_duplex") {
    for (const row of parsedRows) {
      const name = inferredName(row, columns);
      const sense = memberSequence(row, columns.sense, 0);
      const antisense = memberSequence(row, columns.antisense, 1);
      if (!name) errors.push(`Row ${row.rowNumber}: a gene or duplex name could not be identified.`);
      else if (!sense || !antisense || sense === antisense) errors.push(`Row ${row.rowNumber}: both sense and antisense sequences are required.`);
      else entries.push({ kind: "pair", pairType: "sirna_duplex", name, targetName: name, ...rowMetadata(row, columns), sourceRows: [row.rowNumber], members: [{ role: "sense", sequence: sense }, { role: "antisense", sequence: antisense }] });
    }
  } else {
    const grouped = new Map<string, { root: string; index: string; forward?: ParsedRow; reverse?: ParsedRow }>();
    for (const row of parsedRows) {
      const name = inferredName(row, columns);
      const forward = memberSequence(row, columns.forward, 0);
      const reverse = memberSequence(row, columns.reverse, 1);
      if (name && forward && reverse && forward !== reverse) {
        entries.push({ kind: "pair", pairType: "primer_pair", name, targetName: name, ...rowMetadata(row, columns), sourceRows: [row.rowNumber], members: [{ role: "forward", sequence: forward }, { role: "reverse", sequence: reverse }] });
        continue;
      }
      if (!name) {
        errors.push(`Row ${row.rowNumber}: a primer name could not be identified.`);
        continue;
      }
      const parsedName = parsePrimerRole(name);
      if (!parsedName) {
        errors.push(`Row ${row.rowNumber}: add an F/R suffix to the primer name, or paste Forward and Reverse sequences in the same row.`);
        continue;
      }
      const key = `${parsedName.root.toLocaleLowerCase()}\u0000${parsedName.index}`;
      const group = grouped.get(key) ?? { root: parsedName.root, index: parsedName.index };
      if (group[parsedName.role]) errors.push(`Row ${row.rowNumber}: duplicate ${parsedName.role} primer for ${parsedName.root}${parsedName.index ? ` ${parsedName.index}` : ""}.`);
      else group[parsedName.role] = row;
      grouped.set(key, group);
    }
    const rootCounts = new Map<string, number>();
    for (const group of grouped.values()) rootCounts.set(group.root.toLocaleLowerCase(), (rootCounts.get(group.root.toLocaleLowerCase()) ?? 0) + 1);
    for (const group of grouped.values()) {
      if (!group.forward || !group.reverse) {
        const present = group.forward ?? group.reverse;
        errors.push(`Row ${present?.rowNumber ?? "?"}: ${group.root}${group.index ? ` ${group.index}` : ""} is missing its ${group.forward ? "reverse" : "forward"} primer.`);
        continue;
      }
      const forward = group.forward.sequenceCells[0]?.sequence;
      const reverse = group.reverse.sequenceCells[0]?.sequence;
      if (!forward || !reverse) continue;
      const needsIndex = (rootCounts.get(group.root.toLocaleLowerCase()) ?? 0) > 1;
      const name = needsIndex && group.index ? `${group.root} ${group.index}` : group.root;
      entries.push({
        kind: "pair",
        pairType: "primer_pair",
        name,
        targetName: group.root,
        organism: cellAt(group.forward, columns.organism) ?? cellAt(group.reverse, columns.organism),
        description: cellAt(group.forward, columns.description) ?? cellAt(group.reverse, columns.description),
        sourceRows: [group.forward.rowNumber, group.reverse.rowNumber],
        members: [{ role: "forward", sequence: forward }, { role: "reverse", sequence: reverse }],
      });
    }
  }

  if (firstDataIndex > 0) warnings.push(`${firstDataIndex} header or administrative ${firstDataIndex === 1 ? "row was" : "rows were"} skipped.`);
  if (parsedRows.length < rows.length - firstDataIndex) warnings.push("Rows without sequence-shaped cells were ignored.");
  if (entries.length > 500) errors.push("A single import is limited to 500 entries.");
  entries.sort((a, b) => a.sourceRows[0] - b.sourceRows[0]);
  return { entries: entries.slice(0, 500), errors: uniqueWarnings(errors), warnings: uniqueWarnings(warnings), sourceRowCount };
}
