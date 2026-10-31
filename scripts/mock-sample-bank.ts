// A stand-in for the lab's sample bank, for testing the sample bank import (docs/modules/samples/sample-bank-20261031,
// S29); it is not part of the app. It follows the contract: POST /searches answers at once, then pushes the results to
// the search's callbackUrl in pages of six, signed with LabNest's push token.
//   MOCK_BANK_TOKEN=<the bank's token> LABNEST_PUSH_TOKEN=<LabNest's push token> npx tsx scripts/mock-sample-bank.ts [--port 4891]
// Keywords pick a case: "fail" gets a failed push, "v2" the same samples with changed values, the connection test an
// empty page; any other search gets every sample in two pages, with page 1 pushed twice.
import { createServer } from "node:http";
import { SAMPLE_BANK_CONTRACT, sampleBankSearchRequestSchema, type SampleBankRecord, type SampleBankResultPush, type SampleBankSearchRequest } from "../src/lib/sample-bank/contract";
import { signPush } from "../src/lib/sample-bank/signature";

const portIndex = process.argv.indexOf("--port");
const port = portIndex > 0 ? Number(process.argv[portIndex + 1]) : 4891;
const bankToken = process.env.MOCK_BANK_TOKEN;
const pushToken = process.env.LABNEST_PUSH_TOKEN;
if (!pushToken) throw new Error("Set LABNEST_PUSH_TOKEN to the push token LabNest showed.");
const PAGE_SIZE = 6;
const source = "hospital-biobank";

const samples: SampleBankRecord[] = [
  { source, externalId: "BB-2024-000123", code: "P001-T", name: "P001-T", sampleType: "sample_tissue", origin: "P001", collectedAt: "2024-05-12", amount: { value: 50, unit: "mg" }, location: "3号冰箱 / B架 / 12盒 / A5", biosafetyLevel: "BSL-2", attributes: { site: "食管中段", pathology: "鳞癌", stage: "IIIA" }, updatedAt: "2026-10-30T12:00:00+08:00" },
  { source, externalId: "BB-2024-000124", name: "P001-RNA", sampleType: "RNA", origin: "P001", parentExternalId: "BB-2024-000123", amount: { value: 30, unit: "µL" }, concentration: { value: 412.5, unit: "ng/µL" }, attributes: { rin: "8.1", "A260/A280": "2.05" } },
  { source, externalId: "BB-2024-000125", name: "P001-cDNA", sampleType: "cDNA", origin: "P001", parentExternalId: "BB-2024-000124", amount: { value: 20, unit: "µL" }, concentration: { value: 100, unit: "ng/µL" } },
  { source, externalId: "BB-2024-000131", name: "P002-T", sampleType: "组织", origin: "P002", collectedAt: "2024-06-03", amount: { value: 42, unit: "mg" }, location: "3号冰箱 / B架 / 12盒 / A6", attributes: { 部位: "食管下段", 病理类型: "鳞癌", preservation: "Liquid nitrogen" } },
  { source, externalId: "BB-2024-000132", name: "P002-FFPE", sampleType: "FFPE", origin: "P002", collectedAt: "2024-06-03", location: "蜡块柜 / 2层", attributes: { block: "B12" } },
  { source, externalId: "BB-2024-000140", name: "P003-S", sampleType: "Serum", origin: "P003", collectedAt: "2024-07-01", amount: { value: 500, unit: "ul" }, biosafetyLevel: "BSL-2" },
  { source, externalId: "BB-2024-000141", name: "P003-P", sampleType: "血浆", origin: "P003", collectedAt: "2024-07-01", amount: { value: 400, unit: "µL" } },
  { source, externalId: "BB-2024-000150", name: "P004-RNA", sampleType: "sample_rna", origin: "P004", parentExternalId: "BB-2023-009999", concentration: { value: 85, unit: "ng/µL" }, attributes: { rin: "n/a" } },
  { source, externalId: "BB-2024-000160", name: "P005-B", sampleType: "Whole blood", origin: "P005", collectedAt: "2024-08-15", amount: { value: 2, unit: "mL" }, attributes: { anticoagulant: "EDTA" } },
  { source, externalId: "BB-2024-000161", name: "P005-DNA", sampleType: "Genomic DNA", origin: "P005", parentExternalId: "BB-2024-000160", amount: { value: 50, unit: "µL" }, concentration: { value: 120, unit: "ng/µL" } },
  { source, externalId: "BB-2024-000170", name: "P006-C", sampleType: "Cells", origin: "P006", attributes: { cellCount: "1000000" } },
  { source, externalId: "BB-2024-000171", name: "P006-PRO", sampleType: "Protein lysate", origin: "P006", parentExternalId: "BB-2024-000170", amount: { value: 80, unit: "µL" }, concentration: { value: 2.4, unit: "µg/µL" } },
];

// The same first samples after the bank corrected them: a new name, stage and location, and less left.
const corrected: SampleBankRecord[] = [
  { ...samples[0], name: "P001-T（复核）", amount: { value: 45, unit: "mg" }, location: "4号冰箱 / A架 / 03盒 / B2", attributes: { site: "食管中段", pathology: "鳞癌", stage: "IIIB" }, updatedAt: "2026-10-31T09:00:00+08:00" },
  { ...samples[1], amount: { value: 25, unit: "µL" } },
  samples[2],
];

let searches = 0;

createServer(async (request, response) => {
  const reply = (status: number, body: unknown) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
  if (request.method !== "POST" || request.url !== "/searches") return reply(404, { error: "Only POST /searches is here." });
  if (bankToken && request.headers.authorization !== `Bearer ${bankToken}`) return reply(401, { contract: SAMPLE_BANK_CONTRACT, error: { code: "unauthorized", message: "Wrong bank token." } });
  let body = "";
  for await (const chunk of request) body += chunk;
  const parsed = sampleBankSearchRequestSchema.safeParse(JSON.parse(body || "null"));
  if (!parsed.success) return reply(400, { contract: SAMPLE_BANK_CONTRACT, error: { code: "invalid_request", message: parsed.error.issues[0].message } });
  const search = parsed.data;
  const bankRequestId = `MOCK-${++searches}`;
  reply(200, { contract: SAMPLE_BANK_CONTRACT, requestId: search.requestId, accepted: true, bankRequestId });
  console.log(`${bankRequestId} accepted: ${JSON.stringify(search.query)} (limit ${search.limit})`);
  setTimeout(() => void answer(search, bankRequestId), 400);
}).listen(port, () => console.log(`Mock sample bank on http://localhost:${port}`));

async function answer(search: SampleBankSearchRequest, bankRequestId: string) {
  const text = search.query.text ?? "";
  if (text === "LabNest connection test") return push(search, { page: 1, pageCount: 1, status: "complete", total: 0, records: [] }, bankRequestId);
  if (/fail/i.test(text)) return push(search, { page: 1, pageCount: 1, status: "failed", records: [], error: { code: "bank_unavailable", message: "The bank database is in maintenance until 22:00." } }, bankRequestId);
  const found = (/v2/i.test(text) ? corrected : samples).slice(0, search.limit);
  const pageCount = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  for (let page = 1; page <= pageCount; page++) {
    const records = found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const status = page === pageCount ? "complete" : "partial";
    await push(search, { page, pageCount, status, total: found.length, records }, bankRequestId);
    if (page === 1) await push(search, { page, pageCount, status, total: found.length, records }, bankRequestId);
  }
}

async function push(search: SampleBankSearchRequest, page: Omit<SampleBankResultPush, "contract" | "requestId" | "bankRequestId">, bankRequestId: string) {
  const body = JSON.stringify({ contract: SAMPLE_BANK_CONTRACT, requestId: search.requestId, bankRequestId, ...page });
  const response = await fetch(search.callbackUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${pushToken}`, "X-LabNest-Signature": signPush(body, pushToken!) }, body });
  console.log(`${bankRequestId} page ${page.page}/${page.pageCount} (${page.records.length} records) → ${response.status} ${await response.text()}`);
}
