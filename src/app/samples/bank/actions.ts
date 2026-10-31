"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/ai-crypto";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { matchKey } from "@/lib/samples";
import { SampleBatchError } from "@/lib/samples.server";
import { MAX_RECORDS_PER_PUSH, type SampleBankQuery, type SampleBankSearchAck } from "@/lib/sample-bank/contract";
import { newSampleBankSearch } from "@/lib/sample-bank/connector";
import { httpSampleBankConnector } from "@/lib/sample-bank/http-connector";
import { importBankRecords, MAX_BANK_IMPORT } from "@/lib/sample-bank/import.server";
import { searchQueryFromForm } from "@/lib/sample-bank/query";
import { newPushToken } from "@/lib/sample-bank/signature";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";
const address = (message: string) => z.string().trim().url(message).refine((value) => /^https?:\/\//i.test(value), message);
const connectionSchema = z.object({
  name: z.string().trim().min(1, "Name the sample bank.").max(120),
  baseUrl: address("Enter the sample bank's address, such as https://biobank.lab.local/api."),
  source: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{1,59}$/, "The short name uses lower-case letters, digits, . _ or -, at least two characters."),
  callbackUrl: address("Enter the address the sample bank pushes results to."),
  token: z.string().trim().max(500),
  enabled: z.boolean(),
});

function revalidateBank() {
  revalidatePath("/settings");
  revalidatePath("/samples", "layout");
}

/** Saves the one connection the settings page edits (S17). The short name cannot change once samples carry it. */
export async function saveSampleBankConnection(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = connectionSchema.parse({
      name: text(formData.get("name")), baseUrl: text(formData.get("baseUrl")), source: text(formData.get("source")),
      callbackUrl: text(formData.get("callbackUrl")), token: text(formData.get("token")), enabled: formData.get("enabled") === "on",
    });
    const current = await prisma.sampleBankConnection.findFirst({ orderBy: { createdAt: "asc" } });
    if (current && current.source !== parsed.source && await prisma.sample.count({ where: { externalSource: current.source } })) {
      throw new Error(`Samples already came from ${current.source}, so the short name stays.`);
    }
    const data = {
      name: parsed.name, baseUrl: parsed.baseUrl, source: parsed.source, callbackUrl: parsed.callbackUrl, enabled: parsed.enabled,
      ...(parsed.token ? { outboundTokenEncrypted: encryptSecret(parsed.token), outboundTokenHint: parsed.token.slice(-4) } : {}),
    };
    const saved = current ? await prisma.sampleBankConnection.update({ where: { id: current.id }, data }) : await prisma.sampleBankConnection.create({ data });
    await prisma.activityLog.create({ data: { action: current ? "update" : "create", targetType: "sample_bank_connection", targetId: saved.id, metadataJson: { source: saved.source, enabled: saved.enabled, tokenChanged: Boolean(parsed.token) } } });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The connection could not be saved.", "Another connection already uses this short name.") };
  }
  revalidateBank();
  return { success: "Sample bank connection saved." };
}

/** Makes a new push token for the bank (S18). It is shown once; the old one stops working at once. */
export async function newSampleBankPushToken(): Promise<FormActionState & { token?: string }> {
  try {
    const current = await prisma.sampleBankConnection.findFirst({ orderBy: { createdAt: "asc" } });
    if (!current) throw new Error("Save the connection first.");
    const token = newPushToken();
    await prisma.sampleBankConnection.update({ where: { id: current.id }, data: { inboundTokenEncrypted: encryptSecret(token), inboundTokenCreatedAt: new Date() } });
    await prisma.activityLog.create({ data: { action: "new_push_token", targetType: "sample_bank_connection", targetId: current.id, metadataJson: { source: current.source } } });
    revalidateBank();
    return { success: "New push token made. Copy it to the sample bank now; it is not shown again.", token };
  } catch (error) {
    return { error: formActionErrorMessage(error, "No push token was made.") };
  }
}

/** Sends a one-record search to see the bank's answer (S19); whether results come back shows on the search's page. */
export async function testSampleBankConnection(): Promise<FormActionState & { searchId?: string }> {
  try {
    const { search, ack } = await sendSearch({ text: "LabNest connection test" }, 1, { test: true });
    revalidateBank();
    return ack.accepted
      ? { success: "The sample bank accepted the test search. Its pushed answer shows on the search's page.", searchId: search.id }
      : { error: `The sample bank refused the test search: ${ack.error?.message ?? "no reason given"}`, searchId: search.id };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The test search was not sent.") };
  }
}

/** Sends a search from the 外部样本库 tab (S20) and opens its page, where the pushed results arrive. */
export async function startSampleBankSearch(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  let searchId: string;
  try {
    const query = searchQueryFromForm({
      text: text(formData.get("text")), sampleTypes: formData.getAll("sampleTypes").map(String), disease: text(formData.get("disease")),
      collectedFrom: text(formData.get("collectedFrom")), collectedTo: text(formData.get("collectedTo")), attributes: text(formData.get("attributes")),
    });
    const limit = z.coerce.number().int().min(1, "Ask for at least one record.").max(MAX_BANK_IMPORT, `Ask for at most ${MAX_BANK_IMPORT} records.`).parse(text(formData.get("limit")) || MAX_RECORDS_PER_PUSH);
    const requestedBy = text(formData.get("requestedBy")).trim().slice(0, 120) || undefined;
    searchId = (await sendSearch(query, limit, { requestedBy })).search.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The search was not sent.") };
  }
  revalidateBank();
  redirect(`/samples/bank/${searchId}`);
}

/** Remembers which LabNest sample type a bank's own type word means (S27). */
export async function saveSampleBankTypeMap(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const bankType = z.string().trim().min(1).max(60).parse(text(formData.get("bankType")));
    const typeId = z.string().min(1, "Choose a sample type.").parse(text(formData.get("typeId")));
    const connection = await prisma.sampleBankConnection.findFirst({ orderBy: { createdAt: "asc" } });
    if (!connection) throw new Error("No sample bank is set up.");
    const type = await prisma.scientificSchemaDefinition.findFirst({ where: { id: typeId, objectKind: "sample" }, select: { id: true } });
    if (!type) throw new Error("Choose a sample type.");
    await prisma.sampleBankTypeMap.upsert({
      where: { connectionId_bankType: { connectionId: connection.id, bankType: matchKey(bankType) } },
      create: { connectionId: connection.id, bankType: matchKey(bankType), typeId },
      update: { typeId },
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The type was not remembered.") };
  }
  revalidateBank();
  return { success: "Type remembered for this sample bank." };
}

export async function deleteSampleBankTypeMap(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    await prisma.sampleBankTypeMap.delete({ where: { id: z.string().min(1).parse(text(formData.get("id"))) } });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The type pair was not removed.") };
  }
  revalidateBank();
  return { success: "Type pair removed." };
}

export type BankImportState = FormActionState & { batchId?: string; created?: number; updated?: number; unchanged?: number };

/** Imports the chosen records of a search (S23–S26): up to 5000 at once, all in one batch that can be undone together. */
export async function importSampleBankRecords(_previous: BankImportState, formData: FormData): Promise<BankImportState> {
  try {
    const searchId = z.string().min(1).parse(text(formData.get("searchId")));
    const recordIds = z.array(z.string().min(1)).parse(JSON.parse(text(formData.get("recordIds")) || "[]"));
    const projectId = text(formData.get("projectId")) || null;
    const result = await prisma.$transaction((tx) => importBankRecords(tx, { searchId, recordIds, projectId }), { timeout: 120_000, maxWait: 10_000 });
    revalidateBank();
    return { success: `${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged.`, ...result };
  } catch (error) {
    if (error instanceof SampleBatchError) return { error: `${error.message} ${error.rows.slice(0, 3).map((row) => row.problems.join(" ")).join(" ")}` };
    return { error: formActionErrorMessage(error, "The records could not be imported.") };
  }
}

/**
 * Records a search, then sends it. The search exists before the bank hears of it, because a quick bank may push
 * results before its acknowledgement arrives; for the same reason only a search still marked sent takes the answer.
 */
async function sendSearch(query: SampleBankQuery, limit: number, options: { test?: boolean; requestedBy?: string }) {
  const connection = await prisma.sampleBankConnection.findFirst({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  if (!connection) throw new Error("Turn on the sample bank connection in Settings first.");
  const request = newSampleBankSearch(query, { callbackUrl: connection.callbackUrl, limit, requestedBy: options.requestedBy });
  const search = await prisma.sampleBankSearch.create({
    data: { requestId: request.requestId, connectionId: connection.id, query, limit, test: options.test ?? false, requestedBy: options.requestedBy ?? null },
  });
  const token = connection.outboundTokenEncrypted ? decryptSecret(connection.outboundTokenEncrypted) : null;
  const ack: SampleBankSearchAck = await httpSampleBankConnector({ source: connection.source, baseUrl: connection.baseUrl, token }).requestSearch(request);
  await prisma.sampleBankSearch.updateMany({
    where: { id: search.id, status: "sent" },
    data: ack.accepted ? { status: "accepted" } : { status: "rejected", error: ack.error, completedAt: new Date() },
  });
  if (ack.bankRequestId) await prisma.sampleBankSearch.updateMany({ where: { id: search.id, bankRequestId: null }, data: { bankRequestId: ack.bankRequestId } });
  await prisma.activityLog.create({ data: { action: options.test ? "sample_bank_test" : "sample_bank_search", targetType: "sample_bank_search", targetId: search.id, metadataJson: { accepted: ack.accepted, limit, error: ack.error ?? null } } });
  return { search, ack };
}
