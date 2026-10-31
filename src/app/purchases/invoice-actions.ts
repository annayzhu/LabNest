"use server";

import { revalidatePath } from "next/cache";
import { keepAttachment } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { purchaseLine } from "@/lib/inventory-recognition";
import { readPurchaseDocuments } from "@/lib/inventory-recognition.server";

export type InvoiceReading = { invoiceNumber?: string; quantity?: string; lotNumber?: string; expiryDate?: string; warnings: string[]; error?: string };

/**
 * Reads a purchase's invoice or delivery note. The file stays with the purchase; the line that is this purchase only
 * fills the receipt form, which a person still checks and saves, so stock is received through the purchase alone.
 */
export async function readPurchaseInvoice(purchaseId: string, formData: FormData): Promise<InvoiceReading> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Choose the invoice picture or PDF.");
    const purchase = await prisma.purchaseRequest.findUnique({ where: { id: purchaseId }, select: { id: true, title: true, catalogNumber: true } });
    if (!purchase) throw new Error("This purchase no longer exists.");
    const reading = await readPurchaseDocuments([file], "");
    await keepAttachment(file, { targetType: "purchase", targetId: purchase.id, linkType: "invoice" });
    revalidatePath(`/purchases/${purchase.id}`);
    const line = purchaseLine(reading.lines, purchase);
    return {
      invoiceNumber: reading.invoiceNumber ?? undefined,
      quantity: line?.quantity || undefined,
      lotNumber: line?.lotNumber || undefined,
      expiryDate: line?.expiryDate || undefined,
      warnings: [...reading.warnings, ...(line || !reading.lines.length ? [] : ["No line on this document matches the purchase; fill the receipt by hand."])],
    };
  } catch (error) {
    return { warnings: [], error: formActionErrorMessage(error, "The invoice could not be read.") };
  }
}
