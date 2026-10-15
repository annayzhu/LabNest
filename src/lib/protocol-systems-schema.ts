import { z } from 'zod';

const id = z.string().min(1).max(120).regex(/^[\w-]+$/);
const predicate = z.object({ dimensionId: id, optionId: id });
export const protocolPredicateSchema = predicate;
/** Authored comparisons only; missing inputs remain unknown, including under negation. */
export const protocolConditionSchema = z.object({
  all: z.array(predicate).optional(), any: z.array(predicate).optional(), not: z.array(predicate).optional(),
});
export type ProtocolCondition = z.infer<typeof protocolConditionSchema>;
const quantity = { value: z.number().finite().nullable(), unit: z.string().min(1) };
export const chipSymbols = ['triangle', 'square', 'circle', 'diamond', 'star', 'triangle-open', 'square-open', 'circle-open', 'diamond-open', 'star-open'] as const;
export const chipKinds = ['volume', 'mass', 'amount', 'concentration', 'time', 'temperature', 'rcf', 'speed', 'ph', 'voltage', 'current', 'pressure', 'electrical', 'count', 'percent', 'other'] as const;
export const toolKinds = ['centrifuge', 'mix', 'incubate', 'shake', 'vacuum', 'electrophoresis', 'electroporation', 'gas', 'dark', 'gradient'] as const;
/** Calculations a chip can carry; each maps to an existing calculator (see protocol-calculations). */
export const protocolCalculatorIds = ['dilution', 'fold-dilution', 'molarity', 'hemocytometer', 'seeding', 'transfection', 'moi'] as const;
export const protocolSystemsSchema = z.object({
  schemaVersion: z.literal(1),
  dimensions: z.array(z.object({ id, label: z.string().min(1),
    /** A sample condition (e.g. fatty tissue) is chosen like a system but marked with text, not a symbol. */
    kind: z.enum(['system', 'condition']).optional(),
    options: z.array(z.object({ id, label: z.string().min(1), symbol: z.enum(chipSymbols).optional(), tone: z.number().int().min(0).max(9).optional() })).min(1) })),
  presets: z.array(z.object({ id, label: z.string().min(1), selections: z.record(z.string(), z.string()) })),
  parameters: z.array(z.object({ id,
    /** Optional name; chips typed into the body are nameless until the author links a material. */
    label: z.string(), unit: z.string().min(1), kind: z.enum(chipKinds).optional(),
    /** "chip": created by typing; dropped on save once no longer referenced. */
    origin: z.literal('chip').optional(), ownerToolId: id.optional(),
    materialRef: z.object({ name: z.string().min(1), rowId: z.string().min(1).optional() }).optional(),
    /** "执行时必填": the step cannot be completed until its actual value is recorded. Recording is optional otherwise. */
    actual: z.literal('required').optional(),
    /** A material amount for the whole run rather than per reaction; consumption does not multiply it by the run's quantity. */
    perRun: z.literal(true).optional(),
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('fixed'), ...quantity }),
      z.object({ kind: z.literal('lookup'), values: z.array(z.object({ id, when: protocolConditionSchema, ...quantity })) }),
      z.object({ kind: z.literal('actual') }),
      // `output`: which calculator result this chip shows; `inputs`: calculator input key → the chip that supplies it.
      z.object({ kind: z.literal('calculator'), calculatorId: z.enum(protocolCalculatorIds), output: z.string().min(1).max(60), inputs: z.record(z.string().min(1).max(60), id) }),
    ]) })),
  /** Equipment operations shown as one chip, e.g. 离心 12,000 ×g · 1 min · 4 °C; each field is a parameter. */
  tools: z.array(z.object({ id, kind: z.enum(toolKinds), method: z.string().optional(), fields: z.array(z.object({ key: z.string().min(1), parameterId: id })) })).optional(),
  restrictions: z.array(z.object({ id, when: protocolConditionSchema, message: z.string().min(1) })),
  rules: z.array(z.object({
    id, target: z.enum(['block', 'step', 'row']), targetId: z.string().min(1),
    scope: z.enum(['group', 'experiment']).optional(),
    when: protocolConditionSchema, exclusiveGroup: z.string().optional(),
    parameterIds: z.array(id).default([]), optional: z.boolean().default(false),
    actualFields: z.array(z.object({ id, label: z.string().min(1), unit: z.string().min(1), required: z.boolean() })).default([]),
    timerParameterId: id.optional(),
  })),
  /** The author's answer to "which system do these N slash-separated values follow?", keyed by N. */
  splitChoices: z.record(z.string(), id).optional(),
});
export type ProtocolSystems = z.infer<typeof protocolSystemsSchema>;
export const blankProtocolSystems = (): ProtocolSystems => ({ schemaVersion: 1, dimensions: [], parameters: [], presets: [], rules: [], restrictions: [] });
