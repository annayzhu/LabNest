import { z } from 'zod';
import { escapeToken, plateLayoutFromMarkdown, plateLayoutSchema } from './plate-layout';
import type { ScientificDocument } from './scientific-document';
/** Tools whose results save back to a record. */
export const toolOutputIds = ['free-plate-layout', 'qpcr-plate-layout', 'qpcr-analysis', 'cnv-analysis', 'calculator', 'plasmid-workbench'] as const;
const tableSchema = z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) });
export const toolOutputFields = {
    type: z.literal('tool_output'), label: z.string(),
    toolId: z.enum(toolOutputIds),
    revision: z.number().int().positive(), submissionId: z.string().min(1),
    sessionAttachmentId: z.string().min(1),
    images: z.array(z.object({ url: z.string(), caption: z.string() })),
    plates: z.array(plateLayoutSchema).optional(),
    table: tableSchema,
    tables: z.array(tableSchema.extend({ title: z.string() })).optional(),
    dataset: z.object({ attachmentId: z.string(), rowCount: z.number(), headers: z.array(z.string()), preview: z.array(z.array(z.string())) }).optional(),
    rawAttachments: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    method: z.string(), mixTsv: z.string().optional(),
    source: z.object({ ownerId: z.string(), artifactId: z.string(), revision: z.number() }).optional(),
    /** The plasmid version a map snapshot shows; the snapshot stays when the plasmid gets a newer one. */
    plasmid: z.object({ productId: z.string(), versionId: z.string(), versionLabel: z.string() }).optional(),
};
export const toolOutputSchema = z.object({ id: z.string().min(1), ...toolOutputFields });
export type ToolOutputBlock = z.infer<typeof toolOutputSchema>;
export type ToolOwner = {
    ownerType: 'research_plan' | 'experiment' | 'result' | 'report' | 'entry';
    ownerId?: string;
    experimentId?: string;
    researchPlanId?: string;
};
const toolTokenPattern = /^<!--labnest-tool:([A-Za-z0-9%._-]+)-->$/;
/** An Entry is one Markdown text, so its tool outputs stay in it as one line each, like its plates. */
export const toolOutputToMarkdown = (block: ToolOutputBlock) => `<!--labnest-tool:${escapeToken(JSON.stringify(block))}-->`;
export function toolOutputFromMarkdown(line: string): ToolOutputBlock | undefined {
    const match = toolTokenPattern.exec(line.trim());
    if (!match)
        return undefined;
    try {
        const parsed = toolOutputSchema.safeParse(JSON.parse(decodeURIComponent(match[1])));
        return parsed.success ? parsed.data : undefined;
    }
    catch {
        return undefined;
    }
}
/** An Entry's tool outputs as a document, which is what the save route checks revisions against. */
export const entryToolDocument = (markdown: string): ScientificDocument => ({ schemaVersion: 1, sections: [{ key: 'analysis', title: 'Analysis', blocks: markdown.split('\n').flatMap(line => toolOutputFromMarkdown(line) ?? []) }] });
export function toolOutputs(document: ScientificDocument) {
    return document.sections.flatMap(section => section.blocks.filter((block): block is ToolOutputBlock => block.type === 'tool_output'));
}
/** Only the selected output is replaced. A retry is a no-op, including after a later revision. */
export function mergeToolOutput(document: ScientificDocument, output: ToolOutputBlock, sectionKey: string, baseRevision: number, anchorId?: string, insertionSection?: string): ScientificDocument {
    const next = structuredClone(document);
    const existing = toolOutputs(next).find(block => block.id === output.id);
    if (existing?.submissionId === output.submissionId)
        return next;
    if ((existing?.revision ?? 0) !== baseRevision)
        throw new Error('此结果已有新版本');
    if (existing) {
        for (const section of next.sections)
            section.blocks = section.blocks.map(block => block.id === output.id ? output : block);
    }
    else {
        let section = next.sections.find(item => item.key === insertionSection) ?? next.sections.find(item => anchorId && item.blocks.some(block => block.id === anchorId)) ?? next.sections.find(item => item.key === sectionKey);
        if (!section) {
            section = { key: sectionKey, title: sectionKey === 'analysis' ? 'Analysis' : sectionKey === 'setup' ? 'Setup & samples' : 'Material & methods', blocks: [] };
            next.sections.push(section);
        }
        const index = anchorId ? section.blocks.findIndex(block => block.id === anchorId) : -1;
        section.blocks.splice(index < 0 ? (insertionSection ? 0 : section.blocks.length) : index + 1, 0, output);
    }
    return next;
}
/** A tool's own session, table and figure files; the output block in the document lists them, so attachment lists leave them out. */
export const isToolOutputFile = (attachment: { metadataJson: unknown }) => Boolean((attachment.metadataJson as { artifactId?: unknown } | null)?.artifactId);
/** A plate written in the document becomes what the planner saved, in the same place, with the text around it kept. */
export function replacePlateWithOutput(document: ScientificDocument, plateId: string, output: ToolOutputBlock): ScientificDocument | undefined {
    const next = structuredClone(document);
    for (const section of next.sections)
        for (const [index, block] of section.blocks.entries()) {
            if (block.type !== 'text')
                continue;
            const lines = block.text.split('\n');
            const at = lines.findIndex(line => plateLayoutFromMarkdown(line)?.id === plateId);
            if (at < 0)
                continue;
            const before = lines.slice(0, at).join('\n'), after = lines.slice(at + 1).join('\n');
            section.blocks.splice(index, 1, ...(before.trim() ? [{ ...block, text: before }] : []), output, ...(after.trim() ? [{ ...block, id: `${block.id}-after`, text: after }] : []));
            return next;
        }
    return undefined;
}
/**
 * A draft kept in this browser, if it still applies. Each draft remembers the saved version it was made from: once the
 * record has moved on, restoring it would quietly put older content back and the save check would not notice.
 */
export function freshToolDraft<T extends { form?: Record<string, unknown> }>(saved: T, recordUpdatedAt: string | Date | null | undefined, existingRecord: boolean): T | undefined {
    if (!existingRecord)
        return saved;
    return recordUpdatedAt && saved.form?.expectedUpdatedAt === new Date(recordUpdatedAt).toISOString() ? saved : undefined;
}
/** The form values of the browser's draft for a record, for the forms that restore their own fields. */
export function savedToolDraftForm(storageKey: string, recordUpdatedAt: string | Date | null | undefined, existingRecord: boolean): Record<string, unknown> | undefined {
    try {
        return freshToolDraft(JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { form?: Record<string, unknown> }, recordUpdatedAt, existingRecord)?.form;
    }
    catch {
        return undefined;
    }
}
/** Three-way paragraph merge; never overwrite a concurrent human edit. */
export function mergeToolDocumentDraft(base: ScientificDocument, local: ScientificDocument, remote: ScientificDocument): ScientificDocument {
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
        let previousId: string | undefined;
        for (const block of section.blocks) {
            const after = previousId;
            previousId = block.id;
            const before = original?.blocks.find(item => item.id === block.id);
            if (equal(before, block))
                continue;
            const index = target.blocks.findIndex(item => item.id === block.id);
            const current = target.blocks[index];
            if (block.type === "tool_output" && current?.type === "tool_output" && current.revision > block.revision)
                throw new Error("此结果已有新版本");
            if (!equal(current, before) && !equal(current, block))
                throw new Error('此段落已有新版本，请保留草稿后重新打开');
            if (index < 0) {
                // A paragraph split or typed here stays here, after the local block before it.
                const anchor = after === undefined ? -1 : target.blocks.findIndex(item => item.id === after);
                target.blocks.splice(anchor < 0 ? (after === undefined ? 0 : target.blocks.length) : anchor + 1, 0, block);
            }
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
