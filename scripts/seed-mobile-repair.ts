import "dotenv/config";
import { prisma } from "../src/lib/db";

const database = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/labnest_mobile_qa") {
  throw new Error("Mobile repair fixtures require the isolated local labnest_mobile_qa database.");
}

async function seed() {
  const now = new Date();
  for (const [id, title, status, days] of [
    ["mobile-running", "QA overnight experiment", "running", -1],
    ["mobile-today", "QA planned today", "planned", 0],
    ["mobile-future", "QA future experiment", "planned", 2],
    ["mobile-completed", "QA completed experiment", "completed", 0],
  ] as const) {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    const data = { title, status, date, runCode: id };
    await prisma.experiment.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  await prisma.entry.upsert({
    where: { id: "mobile-assigned-entry" },
    create: { id: "mobile-assigned-entry", title: "QA assigned observation", body: "Synthetic mobile test record.", experimentId: "mobile-running" },
    update: {},
  });
  const location = await prisma.inventoryLocation.upsert({
    where: { id: "mobile-fridge" }, create: { id: "mobile-fridge", name: "QA Fridge" }, update: {},
  });
  const fixtures = [
    { id: "mobile-qr", barcode: "LN-MOBILE-QR-20261020", quantityRecorded: true, currentQuantity: 20 },
    { id: "mobile-code128", barcode: "LN-MOBILE-128-20261020", quantityRecorded: true, currentQuantity: 8 },
    { id: "mobile-ean13", barcode: "5901234123457", quantityRecorded: true, currentQuantity: 2 },
    { id: "mobile-datamatrix", barcode: "LN-MOBILE-DM-20261020", quantityRecorded: true, currentQuantity: 10 },
    { id: "mobile-unknown", quantityRecorded: false, currentQuantity: 0 },
    { id: "mobile-expired", quantityRecorded: true, currentQuantity: 0, expiryDate: new Date("2020-01-01") },
    { id: "mobile-low", quantityRecorded: true, currentQuantity: 1, lowThreshold: 5 },
    { id: "mobile-package", quantityRecorded: true, currentQuantity: 2, managementMode: "package" },
    ...Array.from({ length: 8 }, (_, i) => ({ id: `mobile-extra-${i}`, quantityRecorded: true, currentQuantity: 4 })),
  ];
  for (const fixture of fixtures) {
    const data = { name: `QA ${fixture.id}`, unit: "mL", locationId: location.id, positionCode: "Shelf A", lotNumber: "QA-LOT-20", ...fixture };
    await prisma.inventoryItem.upsert({ where: { id: fixture.id }, create: data, update: data });
  }
  for (let i = 1; i <= 2; i++) {
    await prisma.inventoryContainer.upsert({
      where: { id: `mobile-bottle-${i}` },
      create: { id: `mobile-bottle-${i}`, inventoryItemId: "mobile-package", location: "Shelf A" },
      update: {},
    });
  }
}

seed().finally(() => prisma.$disconnect());
