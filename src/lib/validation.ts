import { z } from "zod";

export const tagSchema = z.string().trim().min(1).max(48);

export const entrySchema = z.object({
  title: z.string().trim().min(1, "Entry title is required.").max(160),
  body: z.string().trim().min(1, "Entry body is required."),
  projectId: z.string().optional(),
  tags: z.array(tagSchema).default([]),
  sourceType: z.enum(["text", "photo", "file", "voice", "manual"]).default("text"),
});

export const proposedActionSchema = z.object({
  sourceType: z.enum(["ai", "protocol", "entry", "import", "manual", "system"]),
  sourceId: z.string().nullable().optional(),
  actionType: z.enum([
    "create_experiment",
    "update_experiment",
    "consume_inventory",
    "create_entity",
    "create_result",
    "create_purchase_request",
    "receive_purchase",
    "link_attachment",
    "link_item",
    "create_inventory_item",
    "create_protocol_run",
  ]),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().min(1),
});

export const protocolRunParameterSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

export const inventoryTransactionSchema = z.object({
  inventoryItemId: z.string().min(1),
  type: z.enum(["add", "consume", "transfer", "adjust", "discard", "receive", "aliquot"]),
  quantityChange: z.number().finite(),
  unit: z.string().trim().min(1),
  notes: z.string().optional(),
});

export const aiProviderSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["openai", "anthropic", "openai_compatible", "manual_copy_paste"]),
  baseUrl: z.string().url().optional().or(z.literal("")),
  defaultModel: z.string().optional(),
  enabled: z.boolean().default(false),
  capabilities: z.array(z.string()).default([]),
});
