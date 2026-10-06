import { createHash } from "node:crypto";
/** Content identity belongs to one mutation ID; hashes never merge independent uploads. */
export function entrySaveSignature(input: Record<string, unknown>, fileIdentities: string[], order: unknown[]) {
 const {clientMutationId: _id, deviceCreatedAt: _device, ...fields} = input;
 void _id; void _device;
 if (fields.eventTimePrecision === "unknown") delete fields.occurredAt;
 return createHash("sha256").update(JSON.stringify([Object.fromEntries(Object.entries(fields).sort(([a],[b])=>a.localeCompare(b))),fileIdentities,order])).digest("hex");
}
export async function entryFileIdentities(files: File[]) {
 return Promise.all(files.map(async file => `${file.name}:${file.type}:${file.size}:${createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex")}`));
}
