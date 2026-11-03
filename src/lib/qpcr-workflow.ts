import { z } from 'zod';
import type { ScientificDocument } from './scientific-document';
export const qpcrOutputFields = {
    type: z.literal('qpcr'), label: z.string(),
    toolId: z.enum(['qpcr-plate-layout', 'qpcr-analysis']),
    revision: z.number().int().positive(), submissionId: z.string().min(1),
    sessionAttachmentId: z.string().min(1),
    images: z.array(z.object({ url: z.string(), caption: z.string() })),
    table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }),
    dataset: z.object({ attachmentId: z.string(), rowCount: z.number(), headers: z.array(z.string()), preview: z.array(z.array(z.string())) }).optional(),
    rawAttachments: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    method: z.string(), mixTsv: z.string().optional(),
    source: z.object({ ownerId: z.string(), artifactId: z.string(), revision: z.number() }).optional(),
};
export const qpcrOutputSchema = z.object({ id: z.string().min(1), ...qpcrOutputFields });
export type QpcrOutputBlock = z.infer<typeof qpcrOutputSchema>;
export type QpcrOwner = {
    ownerType: 'research_plan' | 'experiment' | 'result';
    ownerId?: string;
    experimentId?: string;
    researchPlanId?: string;
};
export function qpcrOutputs(document: ScientificDocument) {
    return document.sections.flatMap(section => section.blocks.filter((block): block is QpcrOutputBlock => block.type === 'qpcr'));
}
/** Only the selected output is replaced. A retry is a no-op, including after a later revision. */
export function mergeQpcrOutput(document: ScientificDocument, output: QpcrOutputBlock, sectionKey: string, baseRevision: number, anchorId?: string): ScientificDocument {
    const next = structuredClone(document);
    const existing = qpcrOutputs(next).find(block => block.id === output.id);
    if (existing?.submissionId === output.submissionId)
        return next;
    if ((existing?.revision ?? 0) !== baseRevision)
        throw new Error('此结果已有新版本');
    if (existing) {
        for (const section of next.sections)
            section.blocks = section.blocks.map(block => block.id === output.id ? output : block);
    }
    else {
        let section = next.sections.find(item => anchorId && item.blocks.some(block => block.id === anchorId)) ?? next.sections.find(item => item.key === sectionKey);
        if (!section) {
            section = { key: sectionKey, title: sectionKey === 'analysis' ? 'Analysis' : sectionKey === 'setup' ? 'Setup & samples' : 'Material & methods', blocks: [] };
            next.sections.push(section);
        }
        const index = anchorId ? section.blocks.findIndex(block => block.id === anchorId) : -1;
        section.blocks.splice(index < 0 ? section.blocks.length : index + 1, 0, output);
    }
    return next;
}
/** Three-way paragraph merge; never overwrite a concurrent human edit. */
export function mergeQpcrDocumentDraft(base: ScientificDocument, local: ScientificDocument, remote: ScientificDocument): ScientificDocument {
    const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const next = structuredClone(remote);
    for (const section of local.sections) {
        const original = base.sections.find(item => item.key === section.key);
        let target = next.sections.find(item => item.key === section.key);
        if (!target) {
            if (original && !equal(section, original))
                throw new Error('此段落已被另一窗口删除');
            next.sections.push(structuredClone(section));
            continue;
        }
        for (const block of section.blocks) {
            const before = original?.blocks.find(item => item.id === block.id);
            if (equal(before, block))
                continue;
            const index = target.blocks.findIndex(item => item.id === block.id);
            const current = target.blocks[index];
            if (block.type === "qpcr" && current?.type === "qpcr" && current.revision > block.revision)
                throw new Error("此结果已有新版本");
            if (!equal(current, before) && !equal(current, block))
                throw new Error('此段落已有新版本，请保留草稿后重新打开');
            if (index < 0)
                target.blocks.push(block);
            else
                target.blocks[index] = block;
        }
        for (const before of original?.blocks ?? []) {
            if (section.blocks.some(block => block.id === before.id))
                continue;
            const current = target.blocks.find(block => block.id === before.id);
            if (current && !equal(before, current))
                throw new Error('此段落已有新版本，请保留草稿后重新打开');
            target.blocks = target.blocks.filter(block => block.id !== before.id);
        }
    }
    return next;
}
