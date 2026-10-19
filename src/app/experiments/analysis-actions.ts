"use server";

import { revalidatePath } from "next/cache";
import { addAnalysisWorkbook } from "@/lib/analysis-results.server";
import { formActionErrorMessage } from "@/lib/form-actions";

export type AnalysisUploadState = { error?: string; resultId?: string };

/** 添加分析结果: the workbook becomes a draft result of the experiment. */
export async function addAnalysisResult(experimentId: string, _previous: AnalysisUploadState, formData: FormData): Promise<AnalysisUploadState> {
  try {
    const { resultId } = await addAnalysisWorkbook(experimentId, { tool: String(formData.get("tool") ?? ""), file: formData.get("file"), title: String(formData.get("title") ?? "") });
    revalidatePath(`/experiments/${experimentId}`);
    revalidatePath("/results");
    return { resultId };
  } catch (error) {
    return { error: formActionErrorMessage(error, "Couldn’t add the result. Try again") };
  }
}
