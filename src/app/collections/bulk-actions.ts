"use server";

import { revalidatePath } from "next/cache";
import { loadCollectionSelection, previewCollectionBulk, applyCollectionBulk } from "@/lib/collection-bulk.server";

function errorMessage(error: unknown) {
  if (error instanceof Error && "code" in error && error.code === "P2034") return { en: "Records changed while processing. Preview again; nothing was written.", zh: "处理期间记录发生变化，请重新预览。本次没有写入。" };
  return { en: "The batch could not be processed. Check the selection and fields, then preview again.", zh: "批量操作未完成。请检查选择与字段后重新预览。" };
}
export async function getCollectionSelection(input: unknown) {
  try { return { records: await loadCollectionSelection(input) }; } catch (error) { return { error: errorMessage(error) }; }
}
export async function getCollectionBulkPreview(input: unknown) {
  try { return { preview: await previewCollectionBulk(input) }; } catch (error) { return { error: errorMessage(error) }; }
}
export async function submitCollectionBulk(input: unknown, token: string, batchId: string, confirmation?: string) {
  try {
    const result = await applyCollectionBulk(input, token, batchId, confirmation);
    if (result.applied) revalidatePath("/", "layout");
    return { result };
  } catch (error) { return { error: errorMessage(error) }; }
}
