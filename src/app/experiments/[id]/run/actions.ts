"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appendExperimentObservation, experimentSearchText } from "@/lib/experiment-document";
import { formActionErrorMessage } from "@/lib/form-actions";
import { assertRecordEditable } from "@/lib/record-lifecycle";
import { updateRunTimer } from "@/lib/run-timer.server";
import { structuredRunView, assertStructuredStepExecutable } from '@/lib/structured-run';
import { advanceExecutionRevision, updateRunSystemSelections, configureRunGroups, recordStructuredStep } from '@/lib/structured-run.server';

export type ProtocolRunProgressState = { error?: string; message?: string; savedAt?: string; completedStepIds?: string[]; completedCurrentStepId?: string; continuationUrl?: string };
export type StepTimerActionState = ProtocolRunProgressState;

export async function saveStructuredStepRecord(_previous: ProtocolRunProgressState, form: FormData): Promise<ProtocolRunProgressState> {
  try {
    const experimentId = String(form.get('experimentId'));
    await recordStructuredStep({ experimentId, stepId: String(form.get('stepId')), expectedRevision: Number(form.get('executionPlanRevision')), clientMutationId: String(form.get('clientMutationId')), intent: z.enum(['actual', 'skip', 'unskip']).parse(form.get('intent')), reason: String(form.get('reason') ?? ''), values: JSON.parse(String(form.get('values') ?? '{}')) });
    revalidatePath(`/experiments/${experimentId}/run`);
    return { message: '记录已保存', savedAt: new Date().toISOString() };
  } catch (error) { return { error: formActionErrorMessage(error, '记录保存失败') }; }
}

export async function confirmRunSystems(_previous: ProtocolRunProgressState, form: FormData): Promise<ProtocolRunProgressState> {
  try {
    const versionId = String(form.get('versionId'));
    const result = await updateRunSystemSelections({ experimentId: String(form.get('experimentId')), versionId, expectedRevision: Number(form.get('executionPlanRevision')), confirmCalculations: form.getAll('confirmCalculations').flatMap(value => String(value).split(/\s+/)).filter(Boolean), selections: JSON.parse(String(form.get('selections'))), actualInputs: JSON.parse(String(form.get('actualInputs') ?? '{}')), ...(form.get('intent') === 'continue' ? { continuationKey: String(form.get('continuationKey')), continuationStartRef: String(form.get('continuationStartRef') ?? ''), cancelAffectedTimers: form.get('cancelAffectedTimers') === 'yes' } : {}) }, [versionId, ...form.getAll('applyToVersionIds').map(String)]);
    revalidatePath(`/experiments/${result.experimentId}/run`);
    return { message: '本次体系已确认并保存', savedAt: new Date().toISOString(), ...(result.experimentId !== String(form.get('experimentId')) ? { continuationUrl: `/experiments/${result.experimentId}/run` } : {}) };
  } catch (error) { return { error: formActionErrorMessage(error, '体系未保存，请重试') }; }
}

export async function saveRunGroups(_previous: ProtocolRunProgressState, form: FormData): Promise<ProtocolRunProgressState> {
  try {
    const experimentId = String(form.get('experimentId'));
    await configureRunGroups({ experimentId, expectedRevision: Number(form.get('executionPlanRevision')), groups: JSON.parse(String(form.get('groups'))) });
    revalidatePath(`/experiments/${experimentId}/run`);
    return { message: '实验组已保存，请逐组确认实际采用体系。' };
  } catch (error) { return { error: formActionErrorMessage(error, '实验组未保存') }; }
}

const progressSchema = z.object({
  experimentId: z.string().min(1),
  intent: z.enum(["save", "start", "complete"]),
  quickNote: z.string().trim().max(10_000).optional(),
  completedCurrentStepId: z.string().trim().optional(),
  clientMutationId: z.string().uuid().optional(),
  deviceCreatedAt: z.coerce.date().optional(),
});

const consumptionSchema = z.object({
  experimentId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  experimentStepId: z.string().optional(),
  quantity: z.coerce.number().finite().positive(),
  performedBy: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

const stepTimerSchema = z.object({
  experimentId: z.string().min(1),
  stepId: z.string().min(1),
  timerIntent: z.enum(["start", "pause", "reset", "finish"]),
  durationMinutes: z.coerce.number().finite().min(0.1).max(24 * 60).optional(),
  parameterId: z.string().min(1).max(120).optional(),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export async function saveProtocolRunProgress(
  _previousState: ProtocolRunProgressState,
  formData: FormData,
): Promise<ProtocolRunProgressState> {
  let parsed: z.infer<typeof progressSchema>;
  let savedCompletedStepIds: string[] = [];
  try {
    parsed = progressSchema.parse({
      experimentId: formData.get("experimentId"),
      intent: optionalText(formData.get("intent")) ?? "save",
      quickNote: optionalText(formData.get("quickNote")),
      completedCurrentStepId: optionalText(formData.get("completedCurrentStepId")),
      clientMutationId: optionalText(formData.get("clientMutationId")),
      deviceCreatedAt: optionalText(formData.get("deviceCreatedAt")),
    });
    const completedStepIds = new Set(formData.getAll("completedStepIds").map(String));
    if (parsed.completedCurrentStepId) completedStepIds.add(parsed.completedCurrentStepId);
    const recordedAt = new Date();

    await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${parsed.experimentId} FOR UPDATE`;
    if (parsed.clientMutationId && parsed.completedCurrentStepId) {
      const replay = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: parsed.clientMutationId } });
      if (replay) {
        if (replay.experimentId !== parsed.experimentId || replay.experimentStepId !== parsed.completedCurrentStepId) throw new Error('重复请求不属于此步骤');
        return;
      }
    }
    const experiment = await tx.experiment.findUnique({
      where: { id: parsed.experimentId },
      include: { protocolRun: true, steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }] } },
    });
    if (!experiment) throw new Error("Experiment not found.");
    if (experiment.status === "archived") throw new Error("An archived Experiment cannot be changed in Run mode.");
    assertRecordEditable(experiment.recordStatus);
    const structured = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    const expectedRevision = formData.has('executionPlanRevision') ? Number(formData.get('executionPlanRevision')) : undefined;
    if (structured.hasSystems && expectedRevision !== structured.plan.revision) throw new Error('执行方案已变更，请刷新 / Execution plan changed');
    for (const step of experiment.steps) if (completedStepIds.has(step.id) && !step.completed) {
      assertStructuredStepExecutable(structured, step.id, expectedRevision, true);
      if (structured.steps[step.id] && step.timerStartedAt) throw new Error('请先结束计时，再确认步骤完成');
    }
    if (structured.hasSystems && experiment.status === 'completed') throw new Error('已结束的执行记录不可改写 / Finished execution is fixed');

    if (parsed.completedCurrentStepId) {
      // A single-step command is not a replacement of the client's full snapshot.
      completedStepIds.clear();
      experiment.steps.filter((step) => step.completed).forEach((step) => completedStepIds.add(step.id));
      completedStepIds.add(parsed.completedCurrentStepId);
    }

    const knownStepIds = new Set(experiment.steps.map((step) => step.id));
    const unknownStep = [...completedStepIds].find((id) => !knownStepIds.has(id));
    if (unknownStep) throw new Error("A submitted step does not belong to this Experiment.");

    if(parsed.intent==="complete" && !experiment.steps.length && (experiment.protocolSnapshotJson as {methodMode?:string}).methodMode==="protocol")throw new Error("No execution steps were planned. This Protocol-only record needs an explicitly organized operation contract before completion.");

    const requiredSteps = experiment.steps.filter(step => structured.steps[step.id]?.applicability !== 'not-applicable' && !structured.steps[step.id]?.optional);
    if (parsed.intent === "complete" && requiredSteps.some((step) => !completedStepIds.has(step.id) || structured.steps[step.id]?.blocked)) {
      throw new Error("Complete every execution step before marking the Experiment completed.");
    }

    const allStepsCompleted = requiredSteps.every((step) => completedStepIds.has(step.id));
    const nextStatus = parsed.intent === "complete"
      ? "completed" as const
      : parsed.intent === "start" || (experiment.status === "planned" && (completedStepIds.size > 0 || parsed.quickNote))
        ? "running" as const
        : experiment.status === "completed" && !allStepsCompleted
          ? "running" as const
        : experiment.status;
    const contentJson = parsed.quickNote
      ? appendExperimentObservation(experiment.contentJson, {
          id: `run-note-${randomUUID()}`,
          text: parsed.quickNote,
          recordedAt,
        })
      : experiment.contentJson;

    await tx.experiment.update({
      where: { id: experiment.id },
      data: {
        status: nextStatus,
        // A completed run is a written record; submission stays an explicit step.
        ...(nextStatus === "completed" && experiment.recordStatus === "draft" ? { recordStatus: "recorded" as const } : {}),
        contentJson: contentJson as Prisma.InputJsonValue,
        searchText: experimentSearchText(experiment.purpose, contentJson),
      },
    });

    for (const step of experiment.steps) {
      if (parsed.completedCurrentStepId && step.id !== parsed.completedCurrentStepId) continue;
      const completed = completedStepIds.has(step.id);
      const deviationNote = parsed.completedCurrentStepId
        ? step.id === parsed.completedCurrentStepId
          ? optionalText(formData.get(`mobileDeviation:${step.id}`))
          : step.deviationNote ?? undefined
        : optionalText(formData.get(`deviation:${step.id}`));
      const deviationType = parsed.completedCurrentStepId === step.id ? optionalText(formData.get(`mobileDeviationType:${step.id}`)) : step.deviationType ?? undefined;
      const deviationImpact = parsed.completedCurrentStepId === step.id ? optionalText(formData.get(`mobileDeviationImpact:${step.id}`)) : step.deviationImpact ?? undefined;
      const deviationAuthor = parsed.completedCurrentStepId === step.id ? optionalText(formData.get(`mobileDeviationAuthor:${step.id}`)) : step.deviationAuthor ?? undefined;
      if ((deviationNote?.length ?? 0) > 5_000) throw new Error(`Deviation note for step ${step.order} is too long.`);
      if ((deviationImpact?.length ?? 0) > 5_000) throw new Error(`Deviation impact for step ${step.order} is too long.`);
      if (!step.allowsDeviation && deviationNote) throw new Error(`Step ${step.order} does not allow a deviation record.`);
      if (completed !== step.completed || deviationNote !== (step.deviationNote ?? undefined) || deviationType !== (step.deviationType ?? undefined) || deviationImpact !== (step.deviationImpact ?? undefined) || deviationAuthor !== (step.deviationAuthor ?? undefined)) {
        await tx.experimentStep.update({
          where: { id: step.id },
          data: {
            completed,
            completedAt: completed ? step.completedAt ?? recordedAt : null,
            deviationNote: deviationNote ?? null,
            deviationType: deviationNote ? deviationType ?? "other" : null,
            deviationImpact: deviationNote ? deviationImpact ?? null : null,
            deviationAuthor: deviationNote ? deviationAuthor ?? null : null,
            deviationAt: deviationNote ? recordedAt : null,
          },
        });
        if (parsed.completedCurrentStepId === step.id || structured.steps[step.id] && completed !== step.completed) {
          await tx.experimentStepEvent.create({
            data: {
              experimentStepId: step.id,
              experimentId: experiment.id,
              eventType: completed ? "completed" : "reopened",
              clientMutationId: parsed.completedCurrentStepId ? parsed.clientMutationId : undefined,
              deviceCreatedAt: parsed.deviceCreatedAt,
              payloadJson: JSON.parse(JSON.stringify({ previousCompleted: step.completed, completed, deviationType: deviationType ?? null, actualExecution: deviationNote ?? null, impactAssessment: deviationImpact ?? null, author: deviationAuthor ?? null, ...(structured.steps[step.id] ? { executionPlanRevision: structured.plan.revision, adopted: structured.steps[step.id], actualValues: structured.plan.actualValues[step.id] ?? {} } : {}) })),
            },
          });
        }
      }
    }

    if (experiment.primaryProtocolVersionId) {
      await tx.protocolRun.upsert({
        where: { experimentId: experiment.id },
        create: {
          experimentId: experiment.id,
          protocolVersionId: experiment.primaryProtocolVersionId,
          status: nextStatus,
          parametersJson: {},
          calculatedConsumptionJson: [],
        },
        update: { status: nextStatus },
      });
    }
    await advanceExecutionRevision(tx, experiment.id, structured);
    await tx.activityLog.create({
      data: {
        action: `protocol_run_${parsed.intent}`,
        targetType: "experiment",
        targetId: experiment.id,
        metadataJson: {
          status: nextStatus,
          completedSteps: completedStepIds.size,
          totalSteps: experiment.steps.length,
          quickNoteAdded: Boolean(parsed.quickNote),
        },
      },
    });
    savedCompletedStepIds = experiment.steps.filter((step) => completedStepIds.has(step.id)).map((step) => step.id);
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "Run progress could not be saved.") };
  }

  revalidatePath("/protocol-run");
  revalidatePath("/experiments");
  revalidatePath(`/experiments/${parsed.experimentId}`);
  revalidatePath(`/experiments/${parsed.experimentId}/run`);
  const message = parsed.intent === "start" ? "Run started." : parsed.intent === "complete" ? "Run completed." : "Progress saved.";
  return { message, savedAt: new Date().toISOString(), completedStepIds: savedCompletedStepIds, completedCurrentStepId: parsed.completedCurrentStepId };
}

export async function updateStepTimer(
  _previousState: StepTimerActionState,
  formData: FormData,
): Promise<StepTimerActionState> {
  let parsed: z.infer<typeof stepTimerSchema>;
  try {
    parsed = stepTimerSchema.parse({
      experimentId: formData.get("experimentId"),
      stepId: formData.get("stepId"),
      timerIntent: formData.get("timerIntent"),
      durationMinutes: optionalText(formData.get("durationMinutes")),
      parameterId: optionalText(formData.get("parameterId")),
    });
    await updateRunTimer({ ...parsed, expectedRevision: formData.has('executionPlanRevision') ? Number(formData.get('executionPlanRevision')) : undefined });
  } catch (error) {
    return { error: formActionErrorMessage(error, "Timer could not be updated.") };
  }

  revalidatePath("/");
  revalidatePath(`/experiments/${parsed.experimentId}/run`);
  return { message: `Timer ${parsed.timerIntent === "start" ? "started" : parsed.timerIntent === "pause" ? "paused" : "reset"}.`, savedAt: new Date().toISOString() };
}

export async function recordProtocolRunConsumption(formData: FormData) {
  const parsed = consumptionSchema.parse({
    experimentId: formData.get("experimentId"),
    inventoryItemId: formData.get("inventoryItemId"),
    experimentStepId: optionalText(formData.get("experimentStepId")),
    quantity: formData.get("quantity"),
    performedBy: optionalText(formData.get("performedBy")),
    notes: optionalText(formData.get("notes")),
  });

  await prisma.$transaction(async (tx) => {
    const [experiment, item, step] = await Promise.all([
      tx.experiment.findUnique({ where: { id: parsed.experimentId }, select: { id: true, status: true, recordStatus: true } }),
      tx.inventoryItem.findUnique({ where: { id: parsed.inventoryItemId } }),
      parsed.experimentStepId ? tx.experimentStep.findFirst({ where: { id: parsed.experimentStepId, experimentId: parsed.experimentId }, select: { id: true } }) : null,
    ]);
    if (!experiment) throw new Error("Experiment not found.");
    if (experiment.status === "archived") throw new Error("An archived Experiment cannot consume Inventory.");
    assertRecordEditable(experiment.recordStatus);
    if (!item || item.status !== "active") throw new Error("Inventory Item not found or inactive.");
    if (parsed.experimentStepId && !step) throw new Error("The selected Step does not belong to this Experiment.");

    if (!item.quantityRecorded || item.managementMode !== "precise") throw new Error("该物料不支持精确扣减；请使用实物流转或先盘点。 / Item requires physical management or an opening count.");
    const nextQuantity = Number((item.currentQuantity - parsed.quantity).toFixed(6));
    if (nextQuantity < 0) throw new Error(`Available stock is ${item.currentQuantity} ${item.unit}.`);

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        type: "consume",
        quantityChange: -parsed.quantity,
        unit: item.unit,
        fromLocationId: item.locationId ?? undefined,
        experimentId: experiment.id,
        experimentStepId: step?.id,
        performedBy: parsed.performedBy,
        notes: parsed.notes ?? `Consumed during ${experiment.id}.`,
      },
    });
    const updated = await tx.inventoryItem.updateMany({
      where: { id: item.id, currentQuantity: item.currentQuantity },
      data: { currentQuantity: nextQuantity },
    });
    if (updated.count !== 1) throw new Error("Stock changed during submission. Review the latest quantity and try again.");

    await tx.activityLog.create({
      data: {
        action: "consume",
        targetType: "inventory_item",
        targetId: item.id,
        metadataJson: {
          experimentId: experiment.id,
          experimentStepId: step?.id ?? null,
          quantityChange: -parsed.quantity,
          unit: item.unit,
        },
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${parsed.inventoryItemId}`);
  revalidatePath(`/experiments/${parsed.experimentId}`);
  revalidatePath(`/experiments/${parsed.experimentId}/run`);
  redirect(`/experiments/${parsed.experimentId}/run`);
}

/** Reuses ProtocolRun.parametersJson; no new parameter store or protocol rewrite. */
export async function saveRunParameters(_previous:ProtocolRunProgressState,form:FormData):Promise<ProtocolRunProgressState>{
 try{
  const {validateRunParameters,runParameterKeys}=await import('@/lib/run-parameters');
  const id=z.string().min(1).parse(form.get('experimentId'));
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${id} FOR UPDATE`;
   const experiment=await tx.experiment.findUnique({where:{id},include:{protocolRun:true,steps:true}});
   if(!experiment||experiment.status==='archived'||experiment.status==='completed'||!experiment.primaryProtocolVersionId)throw new Error('This run cannot be edited.');
   assertRecordEditable(experiment.recordStatus);
   const previous=experiment.protocolRun?.parametersJson??{};
   if(JSON.stringify(previous)!==String(form.get('expected')))throw new Error('Parameters changed elsewhere. Reload and review before saving.');
   const raw=Object.fromEntries([...form.entries()].filter(([key])=>key.startsWith('parameter:')).map(([key,value])=>[key.slice(10),value]));
   const structured=structuredRunView(experiment.protocolSnapshotJson,experiment.protocolRun?.executionPlanJson,experiment.steps);
   const reserved=new Set(structured.versions.flatMap(v=>v.document.systems?.parameters.map(p=>p.id)??[]));
   if(Object.keys(raw).some(key=>reserved.has(key)))throw new Error('体系参数请在实验准备中确认，不能通过旧参数表覆盖。');
   const edited=validateRunParameters(experiment.protocolSnapshotJson,raw);
   const values={...(previous as Record<string,string|number|boolean>),...edited};
   for(const key of runParameterKeys(experiment.protocolSnapshotJson))if(!edited[key])delete values[key];
   if(JSON.stringify(values)===JSON.stringify(previous))return;
   await tx.protocolRun.upsert({where:{experimentId:id},create:{experimentId:id,protocolVersionId:experiment.primaryProtocolVersionId,status:experiment.status,parametersJson:values,calculatedConsumptionJson:[]},update:{parametersJson:values}});
   const content=appendExperimentObservation(experiment.contentJson,{text:`Run parameters changed: ${JSON.stringify(previous)} → ${JSON.stringify(values)}`,id:randomUUID(),recordedAt:new Date()});
   await tx.experiment.update({where:{id},data:{contentJson:content as Prisma.InputJsonValue}});
  },{isolationLevel:'Serializable'});
  revalidatePath(`/experiments/${id}/run`);return {message:'参数已保存 / Parameters saved'};
 }catch(error){return {error:formActionErrorMessage(error,'Could not save parameters.')};}
}

export async function connectWatchRun(_previous: { code?: string; error?: string }, form: FormData): Promise<{ code?: string; error?: string }> {
  try { const { createWatchPairing } = await import('@/lib/watch-execution.server'); return { code: await createWatchPairing(String(form.get('experimentId'))) }; }
  catch (error) { return { error: formActionErrorMessage(error, '配对码创建失败') }; }
}
export async function disconnectWatchRun(_previous: { message?: string; error?: string }, form: FormData): Promise<{ message?: string; error?: string }> {
  try { const { revokeWatchPairings } = await import('@/lib/watch-execution.server'); await revokeWatchPairings(String(form.get('experimentId'))); return { message: '此实验的已连接手表已断开。' }; }
  catch (error) { return { error: formActionErrorMessage(error, '断开失败') }; }
}

/** The record and edit pages check one step or record its deviation at a time; the Run page stays the bench view. */
export async function recordExecutionStep(request: { experimentId: string; stepId: string; clientMutationId: string; expectedRevision?: number; completed?: boolean; deviation?: { type: string; note: string; impact?: string; author?: string } | null }): Promise<{ error?: string }> {
  try {
    const { updateExecutionStep } = await import('@/lib/execution-step.server');
    await updateExecutionStep(request as Parameters<typeof updateExecutionStep>[0]);
  } catch (error) { return { error: formActionErrorMessage(error, '未保存，请重试') }; }
  revalidatePath(`/experiments/${request.experimentId}`);
  revalidatePath(`/experiments/${request.experimentId}/edit`);
  revalidatePath(`/experiments/${request.experimentId}/run`);
  return {};
}

/** A value filled at execution, or a calculation confirmed, from inside a step. Same checks as the preparation form; the adopted system stays as confirmed. */
export async function updateStepInputs(request: { experimentId: string; versionId: string; expectedRevision: number; actualInputs?: Record<string, { value: number; unit: string }>; confirmCalculations?: string[] }): Promise<{ error?: string }> {
  try {
    const experiment = await prisma.experiment.findUniqueOrThrow({ where: { id: request.experimentId }, include: { protocolRun: true, steps: true } });
    const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    const version = view.versions.find(item => item.id === request.versionId);
    if (!version?.document.systems) throw new Error('此规程不属于本次执行');
    const adopted = view.plan.versions[request.versionId];
    if (!adopted && version.document.systems.dimensions.length) throw new Error('请先在实验准备中确认本次体系');
    await updateRunSystemSelections({ experimentId: request.experimentId, versionId: request.versionId, expectedRevision: request.expectedRevision, selections: adopted?.selections ?? {}, actualInputs: { ...adopted?.actualInputs, ...request.actualInputs }, confirmCalculations: request.confirmCalculations ?? [] }, [request.versionId]);
  } catch (error) { return { error: formActionErrorMessage(error, '未保存，请重试') }; }
  revalidatePath(`/experiments/${request.experimentId}/run`);
  revalidatePath(`/experiments/${request.experimentId}`);
  return {};
}

type MixResult = { error?: string; mixId?: string };
async function mixAction(experimentId: string, work: () => Promise<unknown>): Promise<MixResult> {
  try { const value = await work(); revalidatePath(`/experiments/${experimentId}/run`); revalidatePath(`/experiments/${experimentId}`); return typeof value === 'string' ? { mixId: value } : {}; }
  catch (error) { return { error: formActionErrorMessage(error, '未保存，请重试') }; }
}
/** 配液卡: confirm, cross off lines, set 本次数量, make one at the bench, offer it to the Protocol. */
export async function confirmRunMix(request: Parameters<typeof import('@/lib/run-mix.server').confirmRunMix>[0]) { return mixAction(request.experimentId, async () => (await import('@/lib/run-mix.server')).confirmRunMix(request)); }
export async function strikeRunMixLine(request: Parameters<typeof import('@/lib/run-mix.server').strikeRunMixLine>[0]) { return mixAction(request.experimentId, async () => (await import('@/lib/run-mix.server')).strikeRunMixLine(request)); }
export async function setRunQuantities(request: Parameters<typeof import('@/lib/run-mix.server').setRunQuantities>[0]) { return mixAction(request.experimentId, async () => (await import('@/lib/run-mix.server')).setRunQuantities(request)); }
export async function createRunMix(request: Parameters<typeof import('@/lib/run-mix.server').createRunMix>[0]) { return mixAction(request.experimentId, async () => (await import('@/lib/run-mix.server')).createRunMix(request)); }
export async function proposeRunMix(request: Parameters<typeof import('@/lib/run-mix.server').proposeRunMix>[0]) { return mixAction(request.experimentId, async () => (await import('@/lib/run-mix.server')).proposeRunMix(request)); }
