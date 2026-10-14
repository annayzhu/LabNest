import { z } from 'zod';

const id = z.string().min(1).max(120).regex(/^[\w-]+$/);
const predicate = z.object({ dimensionId: id, optionId: id });
/** Authored comparisons only; missing inputs remain unknown, including under negation. */
export const protocolConditionSchema = z.object({
  all: z.array(predicate).optional(), any: z.array(predicate).optional(), not: z.array(predicate).optional(),
});
export type ProtocolCondition = z.infer<typeof protocolConditionSchema>;
const quantity = { value: z.number().finite(), unit: z.string().min(1) };
export const protocolSystemsSchema = z.object({
  schemaVersion: z.literal(1),
  dimensions: z.array(z.object({ id, label: z.string().min(1), options: z.array(z.object({ id, label: z.string().min(1) })).min(1) })),
  presets: z.array(z.object({ id, label: z.string().min(1), selections: z.record(z.string(), z.string()) })),
  parameters: z.array(z.object({ id, label: z.string().min(1), unit: z.string().min(1), source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('fixed'), ...quantity }),
    z.object({ kind: z.literal('lookup'), values: z.array(z.object({ id, when: protocolConditionSchema, ...quantity })) }),
    z.object({ kind: z.literal('actual') }),
    z.object({ kind: z.literal('calculator'), calculatorId: z.literal('dilution'), output: z.enum(['stockVolumeUl', 'diluentVolume']), inputs: z.object({ stockConcentration: id, targetConcentration: id, finalVolume: id }) }),
  ]) })),
  restrictions: z.array(z.object({ id, when: protocolConditionSchema, message: z.string().min(1) })),
  rules: z.array(z.object({
    id, target: z.enum(['block', 'step', 'row']), targetId: z.string().min(1),
    when: protocolConditionSchema, exclusiveGroup: z.string().optional(),
    parameterIds: z.array(id).default([]), optional: z.boolean().default(false),
    actualFields: z.array(z.object({ id, label: z.string().min(1), unit: z.string().min(1), required: z.boolean() })).default([]),
    timerParameterId: id.optional(),
  })),
});
export type ProtocolSystems = z.infer<typeof protocolSystemsSchema>;
