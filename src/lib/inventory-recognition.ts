import { stockUnit } from "./inventory";
import { catalogKey, nameKey } from "./inventory-duplicates";

// Purchase documents (invoices, delivery notes, packing lists, product labels) read into rows of arriving stock
// (docs/modules/inventory/ai-import-20261030/PLAN.md). The model only proposes rows; a person checks each one before import.

export const isPdf = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

export type DraftRow = { name: string; brand: string; catalogNumber: string; packSize: string; quantity: string; unit: string; lotNumber: string; expiryDate: string };
export type ReadDocument = { supplier: string | null; invoiceNumber: string | null; rows: DraftRow[] };

const reply = '{"supplier": string|null, "invoiceNumber": string|null, "items": [{"name": string, "brand": string|null, "catalogNumber": string|null, "packSize": string|null, "quantity": number|null, "unit": string|null, "lotNumber": string|null, "expiryDate": "YYYY-MM-DD"|"YYYY-MM"|null}]}';

/** What the model is asked; `user` takes the document's text, or nothing when the document is a picture. */
export const documentPrompt = {
  system: [
    "You read documents that come with laboratory supplies: invoices, delivery notes, packing lists and product labels.",
    "List each product received, exactly as printed. Never invent a value: write null for anything not printed.",
    "quantity is how many packs arrived and unit is the pack (bottle, box, vial, pack, piece), unless the line counts an amount such as 500 mL.",
    "packSize is the size of one pack, such as 100 g or 1 mL × 2. A single product label is one item with quantity 1.",
    "Keep catalogue numbers and lot numbers character for character. Give dates as YYYY-MM-DD, or YYYY-MM when only the month is printed.",
    `Answer with JSON only, in this shape: ${reply}`,
  ].join(" "),
  user: (text?: string) => text === undefined ? "Read the items in this picture." : `Read the items in this document:\n\n${text.slice(0, 40_000)}`,
};

const plain = (value: unknown) => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";

/** The model's answer as a document; lines without a name are dropped. */
export function parseDocumentReply(text: string): ReadDocument {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const start = text.indexOf("{");
  const body = fenced ?? (start === -1 ? "" : text.slice(start, text.lastIndexOf("}") + 1));
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = undefined; }
  const items = parsed && typeof parsed === "object" ? (parsed as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) throw new Error("The model did not return a list of items.");
  const { supplier, invoiceNumber } = parsed as Record<string, unknown>;
  const rows = items.slice(0, 100).flatMap((item): DraftRow[] => {
    const value = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name = plain(value.name);
    if (!name) return [];
    return [{
      name, brand: plain(value.brand), catalogNumber: plain(value.catalogNumber), packSize: plain(value.packSize),
      quantity: plain(value.quantity), unit: stockUnit(plain(value.unit)), lotNumber: plain(value.lotNumber), expiryDate: documentDate(plain(value.expiryDate)),
    }];
  });
  return { supplier: plain(supplier) || null, invoiceNumber: plain(invoiceNumber) || null, rows };
}


/** A printed date as YYYY-MM-DD; a month alone means its last day, as on expiry labels. Anything else is left empty. */
function documentDate(value: string) {
  const match = value.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day || 1));
  if (date.getUTCMonth() !== month - 1) return "";
  if (!day) date.setUTCMonth(month, 0);
  return date.toISOString().slice(0, 10);
}

/** Checked draft rows as records of the inventory import: each one an arrival, linked to the product chosen for it. */
export function draftRecords(rows: (DraftRow & { location: string; productId: string })[], document: { supplier: string | null }) {
  return rows.map((row) => ({
    name: row.name, brand: row.brand, catalogNumber: row.catalogNumber, vendor: document.supplier ?? "", lotNumber: row.lotNumber, expiryDate: row.expiryDate,
    currentQuantity: Number(row.quantity), unit: row.unit, location: row.location, productId: row.productId, importMode: "arrival", managementMode: "precise",
    notes: row.packSize ? `Pack size: ${row.packSize}` : "",
  }));
}

/** The invoice line that is this purchase: same catalogue number, else same name, else the only line there is. */
export function purchaseLine<T extends DraftRow>(lines: readonly T[], purchase: { title: string; catalogNumber: string | null }) {
  const key = catalogKey(purchase.catalogNumber);
  const name = nameKey(purchase.title);
  return (key && lines.find((line) => catalogKey(line.catalogNumber) === key)) || (name && lines.find((line) => nameKey(line.name) === name)) || (lines.length === 1 ? lines[0] : undefined);
}
