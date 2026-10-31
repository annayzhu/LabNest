import { beforeEach, expect, it, vi } from "vitest";
import { readPurchaseDocuments } from "./inventory-recognition.server";

const calls = vi.hoisted(() => ({ pictures: [] as string[], texts: [] as string[], logs: [] as { metadataJson: unknown }[], visionOk: true }));

const answer = (items: unknown[], extra: Record<string, unknown> = {}) => ({ text: JSON.stringify({ supplier: null, invoiceNumber: null, items, ...extra }), model: "test-model" });
const adapter = {
  describeImage: async (_system: string, _user: string, image: { mimeType: string }) => {
    calls.pictures.push(image.mimeType);
    return answer([{ name: "Sodium azide", brand: "Sigma-Aldrich", catalogNumber: "S-2002", quantity: 2, unit: "瓶" }], { supplier: "Sigma-Aldrich", invoiceNumber: "INV-7" });
  },
  complete: async (_system: string, user: string) => {
    calls.texts.push(user);
    return answer([{ name: "PBS 10x", quantity: 1, unit: "bottle" }]);
  },
};
const resolved = (name: string) => ({ ok: true as const, adapter, config: { id: `provider-${name}`, name }, gate: { assertAllowed: async () => {} } });

vi.mock("./ai-server", () => ({
  resolveVisionAdapter: async () => (calls.visionOk ? resolved("vision") : { ok: false, status: 409, error: "Choose a service that can read pictures, such as Qwen-VL, Gemini, GPT-4o or Claude." }),
  resolveConnectedAdapter: async () => resolved("text"),
}));
vi.mock("./protocol-source-text.server", () => ({
  readSourceFile: async (name: string) => ({ kind: "pdf", text: name.includes("scan") ? " " : "Invoice INV-9\nPBS 10x  1 bottle  lot 2210 ".repeat(3), warnings: [] }),
}));
vi.mock("./db", () => ({
  prisma: {
    inventoryProduct: { findMany: async () => [{ id: "p_azide", name: "Sodium azide", englishName: null, brand: "Sigma-Aldrich", catalogNumber: "S2002", casNumber: null }, { id: "p_pbs", name: "PBS 10X", englishName: null, brand: "Gibco", catalogNumber: "10010", casNumber: null }] },
    activityLog: { create: async ({ data }: { data: { metadataJson: unknown } }) => { calls.logs.push(data); return data; } },
  },
}));

const picture = new File([new Uint8Array([1, 2, 3])], "invoice.jpg", { type: "image/jpeg" });

beforeEach(() => { calls.pictures = []; calls.texts = []; calls.logs = []; calls.visionOk = true; });

it("reads a picture with the service that sees, and matches its line to the product with that brand and catalogue number", async () => {
  const reading = await readPurchaseDocuments([picture], "");
  expect(calls.pictures).toEqual(["image/jpeg"]);
  expect(reading).toMatchObject({ supplier: "Sigma-Aldrich", invoiceNumber: "INV-7", warnings: [] });
  expect(reading.lines).toEqual([expect.objectContaining({ name: "Sodium azide", quantity: "2", unit: "bottle", productId: "p_azide", candidates: [] })]);
});

it("reads a PDF by its text, offers same-name products, and asks for a photo of a scan", async () => {
  const reading = await readPurchaseDocuments([new File(["%PDF"], "invoice.pdf", { type: "application/pdf" }), new File(["%PDF"], "scan.pdf", { type: "application/pdf" })], "");
  expect(calls.texts).toHaveLength(1);
  expect(reading.lines).toEqual([expect.objectContaining({ name: "PBS 10x", productId: "", candidates: [expect.objectContaining({ id: "p_pbs" })] })]);
  expect(reading.warnings).toEqual(["scan.pdf has no text to read; photograph or screenshot it instead."]);
});

it("logs file names, sizes and the model, never what the documents say", async () => {
  await readPurchaseDocuments([picture], "Order: PBS 10x, 1 bottle");
  expect(calls.logs).toEqual([{ action: "inventory_documents_read", targetType: "ai_provider", targetId: "provider-vision", metadataJson: { files: [{ name: "invoice.jpg", bytes: 3 }], pastedCharacters: 24, lines: 2, models: ["test-model"] } }]);
});

it("says why pictures cannot be read when no service can see", async () => {
  calls.visionOk = false;
  await expect(readPurchaseDocuments([picture], "")).rejects.toThrow("Choose a service that can read pictures");
});
