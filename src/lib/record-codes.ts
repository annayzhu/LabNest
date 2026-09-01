import { Prisma } from "../generated/prisma/client";

export type RecordCodeKind = "researchPlan" | "protocol" | "experiment" | "sequence" | "sequencePair" | "sequenceCollection" | "sequenceWorkflow";

const recordCodeRules = {
  researchPlan: { counterKey: "research-plan", prefix: "RP-", width: 3, firstValue: 1 },
  protocol: { counterKey: "protocol", prefix: "PRT-", width: 6, firstValue: 100001 },
  experiment: { counterKey: "experiment", prefix: "EXP-", width: 3, firstValue: 1 },
  sequence: { counterKey: "sequence", prefix: "SEQ-", width: 6, firstValue: 1 },
  sequencePair: { counterKey: "sequence-pair", prefix: "PAI-", width: 6, firstValue: 1 },
  sequenceCollection: { counterKey: "sequence-collection", prefix: "SET-", width: 6, firstValue: 1 },
  sequenceWorkflow: { counterKey: "sequence-workflow", prefix: "WF-", width: 6, firstValue: 1 },
} as const;

export function formatRecordCode(kind: RecordCodeKind, value: number) {
  const rule = recordCodeRules[kind];
  return `${rule.prefix}${String(value).padStart(rule.width, "0")}`;
}

export function isValidRecordCode(kind: RecordCodeKind, value: string) {
  const rule = recordCodeRules[kind];
  const escapedPrefix = rule.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedPrefix}\\d{${rule.width},}$`).test(value);
}

export function recordCodeExample(kind: RecordCodeKind) {
  return formatRecordCode(kind, recordCodeRules[kind].firstValue);
}

export function recordCodeFromSuffix(kind: RecordCodeKind, suffix: string) {
  const rule = recordCodeRules[kind];
  const normalizedSuffix = suffix.trim();
  const code = `${rule.prefix}${normalizedSuffix}`;
  if (!isValidRecordCode(kind, code)) {
    throw new Error(`${rule.prefix} must be followed by at least ${rule.width} digits.`);
  }
  return code;
}

function numericSuffix(kind: RecordCodeKind, value: string) {
  if (!isValidRecordCode(kind, value)) return undefined;
  const parsed = Number(value.slice(recordCodeRules[kind].prefix.length));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function nextRecordCodeValue(kind: RecordCodeKind, existingCodes: string[], lastReservedValue?: number) {
  const rule = recordCodeRules[kind];
  const highestExisting = existingCodes.reduce((highest, code) => {
    const suffix = numericSuffix(kind, code);
    return suffix === undefined ? highest : Math.max(highest, suffix);
  }, rule.firstValue - 1);
  const safeLastReserved = Number.isSafeInteger(lastReservedValue) ? lastReservedValue! : rule.firstValue - 1;
  return Math.max(rule.firstValue, highestExisting + 1, safeLastReserved + 1);
}

export function suggestNextRecordCode(kind: RecordCodeKind, existingCodes: string[], lastReservedValue?: number) {
  return formatRecordCode(kind, nextRecordCodeValue(kind, existingCodes, lastReservedValue));
}

async function existingRecordCodes(tx: Prisma.TransactionClient, kind: RecordCodeKind) {
  let existingCodes: string[];
  if (kind === "researchPlan") {
    existingCodes = (await tx.researchPlan.findMany({ select: { code: true } })).map((item) => item.code);
  } else if (kind === "protocol") {
    existingCodes = (await tx.protocol.findMany({ select: { humanCode: true } })).map((item) => item.humanCode);
  } else if (kind === "experiment") {
    existingCodes = (await tx.experiment.findMany({ select: { runCode: true } })).map((item) => item.runCode);
  } else if (kind === "sequence") {
    existingCodes = (await tx.sequence.findMany({ select: { code: true } })).map((item) => item.code);
  } else if (kind === "sequencePair") {
    existingCodes = (await tx.sequencePair.findMany({ select: { code: true } })).map((item) => item.code);
  } else if (kind === "sequenceCollection") {
    existingCodes = (await tx.sequenceCollection.findMany({ select: { code: true } })).map((item) => item.code);
  } else {
    existingCodes = (await tx.sequenceWorkflow.findMany({ select: { code: true } })).map((item) => item.code);
  }

  return existingCodes;
}

export async function reserveRecordCodes(tx: Prisma.TransactionClient, kind: RecordCodeKind, count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 5000) throw new Error("Record code reservation count must be between 1 and 5000.");
  const existingCodes = await existingRecordCodes(tx, kind);
  const rule = recordCodeRules[kind];
  const baseline = nextRecordCodeValue(kind, existingCodes);
  const requestedEnd = baseline + count - 1;

  const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
    INSERT INTO "RecordCodeCounter" ("key", "value", "updatedAt")
    VALUES (${rule.counterKey}, ${requestedEnd}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE
    SET "value" = GREATEST("RecordCodeCounter"."value" + ${count}, EXCLUDED."value"),
        "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `);
  const endValue = rows[0]?.value;
  if (!Number.isSafeInteger(endValue)) throw new Error(`Could not reserve the next ${rule.prefix} codes.`);
  return Array.from({ length: count }, (_, index) => formatRecordCode(kind, endValue - count + index + 1));
}

export async function reserveRecordCode(tx: Prisma.TransactionClient, kind: RecordCodeKind) {
  const [code] = await reserveRecordCodes(tx, kind, 1);
  if (!code) throw new Error(`Could not reserve the next ${recordCodeRules[kind].prefix} code.`);
  return code;
}
