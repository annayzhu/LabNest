"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SequenceLifecycleStatus, SequenceWorkflowType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { reserveRecordCode } from "@/lib/record-codes";

const methods = {
  alignment: ["pairwise", "multiple"],
  assembly: ["gibson", "golden_gate", "homology", "concatenation"],
  crispr: ["manual_design", "external_import"],
} as const;

export async function createSequenceWorkflow(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  let id: string;
  try {
    const type = z.enum(SequenceWorkflowType).parse(formData.get("type"));
    const input = z.object({
      name: z.string().trim().min(1, "Workflow name is required.").max(180),
      projectId: z.string().trim().min(1, "Choose a Project."),
      status: z.enum(SequenceLifecycleStatus),
      method: z.string().trim().min(1),
      reference: z.string().trim().max(500).optional(),
      pam: z.string().trim().max(80).optional(),
      description: z.string().trim().max(5000).optional(),
    }).parse({
      name: formData.get("name"),
      projectId: formData.get("projectId"),
      status: formData.get("status") ?? "draft",
      method: formData.get("method"),
      reference: optionalText(formData.get("reference")),
      pam: optionalText(formData.get("pam")),
      description: optionalText(formData.get("description")),
    });
    if (!(methods[type] as readonly string[]).includes(input.method)) throw new Error("Choose a supported method for this workflow.");
    if (type === "crispr" && !input.reference) throw new Error("Record a reference genome, transcript, or imported design source for CRISPR work.");
    const sequenceVersionIds = [...new Set(formData.getAll("sequenceVersionId").map(String).filter(Boolean))].slice(0, 50);
    if ((type === "alignment" || type === "assembly") && sequenceVersionIds.length < 2) throw new Error("Select at least two exact Sequence versions.");

    const workflow = await prisma.$transaction(async (tx) => {
      const [project, versionCount] = await Promise.all([
        tx.project.findUnique({ where: { id: input.projectId }, select: { id: true } }),
        tx.sequenceVersion.count({ where: { id: { in: sequenceVersionIds } } }),
      ]);
      if (!project) throw new Error("The selected Project no longer exists.");
      if (versionCount !== sequenceVersionIds.length) throw new Error("One or more selected Sequence versions no longer exist.");
      const code = await reserveRecordCode(tx, "sequenceWorkflow");
      const created = await tx.sequenceWorkflow.create({
        data: {
          code,
          type,
          name: input.name,
          projectId: input.projectId,
          status: input.status,
          method: input.method,
          reference: input.reference,
          pam: input.pam,
          description: input.description,
          metadataJson: type === "crispr" ? { scoring: "not_calculated", provenanceRequired: true } : {},
          inputs: { create: sequenceVersionIds.map((sequenceVersionId, order) => ({ sequenceVersionId, role: "input", order })) },
        },
      });
      await tx.activityLog.create({ data: { action: "create", targetType: "sequence_workflow", targetId: created.id, metadataJson: { code, type, method: input.method, projectId: input.projectId, inputCount: sequenceVersionIds.length } } });
      return created;
    });
    id = workflow.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Sequence workflow could not be created.") };
  }
  revalidatePath("/sequences/workflows");
  redirect(`/sequences/workflows/${id}`);
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}
