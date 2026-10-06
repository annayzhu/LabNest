import { z } from "zod";

export const entryTypes = ["unclassified", "experiment", "observation", "idea"] as const;
export const entryTypeLabels = { unclassified: "未分类", experiment: "实验记录", observation: "观察/结果", idea: "想法" };
export const entryAssignmentSchema = z.object({
  mutationId: z.string().uuid(),
  expectedTarget: z.string().nullable(),
  type: z.enum(["experiment", "result", "none"]),
  targetId: z.string().min(1).optional(),
  experimentId: z.string().min(1).optional(),
  newTitle: z.string().trim().min(1).max(300).optional(),
}).superRefine((value, ctx) => {
  if (value.type !== "none" && !value.targetId && !value.newTitle) ctx.addIssue({ code: "custom", message: "请选择目标或填写新目标名称" });
  if (value.type === "result" && !value.experimentId) ctx.addIssue({ code: "custom", message: "请先选择所属实验" });
  if (value.targetId && value.newTitle) ctx.addIssue({ code: "custom", message: "请选择已有目标或新建目标，不能同时指定" });
});
export type EntryAssignmentInput = z.infer<typeof entryAssignmentSchema>;
export function entryTargetKey(target?: { targetType: string; targetId: string } | null) { return target ? `${target.targetType}:${target.targetId}` : null; }
