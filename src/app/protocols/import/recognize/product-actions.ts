"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { isPublicHttpsUrl, type ManualHit } from "@/lib/product-manuals";
import { fetchVendorPdf, inventoryManualFile, manualFileName, readProductSearchSettings, searchProductManuals, writeProductSearchSettings, type ProductSearchSettingsView } from "@/lib/product-manuals.server";
import { keepRecognitionSource, loadRecognitionSource, rulesView } from "@/lib/protocol-recognition.server";
import type { RecognitionState } from "./actions";

export type ManualSearchState = { hits?: ManualHit[]; note?: string; error?: string };
export type ManualSettingsState = { settings?: ProductSearchSettingsView; error?: string; message?: string };

/** 产品说明书: search the manuals on inventory items, and the vendors' sites when AI is on and a key is saved. */
export async function searchManuals(query: string): Promise<ManualSearchState> {
  try { return await searchProductManuals(query); }
  catch (error) { return { error: formActionErrorMessage(error, "The search did not finish; try again") }; }
}

/** Take a found manual into 整理说明书: the file is kept as the source and read as written, like an uploaded PDF. */
export async function takeManual(input: { source: "inventory"; attachmentId: string } | { source: "web"; url: string; title?: string }): Promise<RecognitionState> {
  try {
    let file: File;
    if (input.source === "inventory") file = await inventoryManualFile(input.attachmentId);
    else {
      if (!isPublicHttpsUrl(input.url)) throw new Error("The link is not on a vendor site in the list");
      const { vendors } = await readProductSearchSettings();
      const { bytes, url } = await fetchVendorPdf(input.url, vendors);
      file = new File([bytes as Uint8Array<ArrayBuffer>], manualFileName(url, input.title ?? "manual"), { type: "application/pdf" });
      // Activity entries print their fields as text: keep them flat.
      await prisma.activityLog.create({ data: { action: "product_manual_fetched", targetType: "method_search_settings", targetId: "default", metadataJson: { url, bytes: bytes.length } } });
    }
    return { view: rulesView(await loadRecognitionSource(await keepRecognitionSource(file))) };
  } catch (error) { return { error: formActionErrorMessage(error, "Could not take this manual in") }; }
}

/** The web search key and the vendor list; the saved key is never sent back to the page. */
export async function saveProductSearchSettings(_previous: ManualSettingsState, formData: FormData): Promise<ManualSettingsState> {
  try {
    const settings = await writeProductSearchSettings({ key: String(formData.get("key") ?? ""), clearKey: formData.get("clearKey") === "on", vendors: String(formData.get("vendors") ?? "") });
    revalidatePath("/protocols/import/recognize");
    return { settings, message: "Saved" };
  } catch (error) { return { error: formActionErrorMessage(error, "Not saved") }; }
}
