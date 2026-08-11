import { Prisma } from "../generated/prisma/client";

export type RecordCodeKind = "researchPlan" | "protocol" | "experiment";

const recordCodeRules = {
  researchPlan: { counterKey: "research-plan", prefix: "RP-", width: 3, firstValue: 1 },
  protocol: { counterKey: "protocol", prefix: "PRT-", width: 6, firstValue: 100001 },
  experiment: { counterKey: "experiment", prefix: "EXP-", width: 3, firstValue: 1 },
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

export async function reserveRecordCode(tx: Prisma.TransactionClient, kind: RecordCodeKind) {
  let existingCodes: string[];
  if (kind === "researchPlan") {
    existingCodes = (await tx.researchPlan.findMany({ select: { code: true } })).map((item) => item.code);
  } else if (kind === "protocol") {
    existingCodes = (await tx.protocol.findMany({ select: { humanCode: true } })).map((item) => item.humanCode);
  } else {
    existingCodes = (await tx.experiment.findMany({ select: { runCode: true } })).map((item) => item.runCode);
  }

  const rule = recordCodeRules[kind];
  const baseline = nextRecordCodeValue(kind, existingCodes);

  const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
    INSERT INTO "RecordCodeCounter" ("key", "value", "updatedAt")
    VALUES (${rule.counterKey}, ${baseline}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE
    SET "value" = GREATEST("RecordCodeCounter"."value" + 1, EXCLUDED."value"),
        "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `);
  const value = rows[0]?.value;
  if (!Number.isSafeInteger(value)) throw new Error(`Could not reserve the next ${rule.prefix} code.`);
  return formatRecordCode(kind, value);
}
