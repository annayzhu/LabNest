import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from 'zod';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { scientificDocumentSchema } from '@/lib/scientific-document';
import { mergeQpcrDocumentDraft, mergeQpcrOutput, qpcrOutputs, type QpcrOutputBlock } from '@/lib/qpcr-workflow';
import { assertRecordEditable } from '@/lib/record-lifecycle';
import { prepareAttachmentFile, writePreparedAttachmentFiles, cleanupPreparedAttachmentFiles, type PreparedAttachmentFile } from '@/lib/attachment-files';
import { associateDocumentMedia } from '@/lib/document-media.server';
const ownerSchema = z.object({ ownerType: z.enum(['result', 'experiment', 'research_plan']), ownerId: z.string().optional(), experimentId: z.string().optional() });
const requestSchema = z.object({
    draftId: z.string().uuid(), owner: ownerSchema, document: scientificDocumentSchema,
    baseDocument: scientificDocumentSchema.optional(), forkFromId: z.string().optional(), form: z.record(z.string(), z.unknown()).default({}),
    sessionId: z.string().optional(), session: z.unknown().optional(),
    output: z.object({ id: z.string().uuid(), submissionId: z.string().uuid(), baseRevision: z.number().int().nonnegative(), toolId: z.enum(['qpcr-plate-layout', 'qpcr-analysis']),
        sectionKey: z.enum(['setup', 'material_methods', 'analysis']), anchorId: z.string().optional(), insertionSection: z.string().optional(), label: z.string(), method: z.string(),
        images: z.array(z.object({ svg: z.string().max(2000000), caption: z.string() })).max(150),
        fullTable: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
        table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }), mixTsv: z.string().optional(), source: z.object({ ownerId: z.string(), artifactId: z.string(), revision: z.number() }).optional(),
    }).optional(),
});
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
async function ownerRecord(tx: Prisma.TransactionClient, owner: z.infer<typeof ownerSchema>) {
    if (!owner.ownerId)
        return null;
    const record = owner.ownerType === 'result' ? await tx.result.findUnique({ where: { id: owner.ownerId } })
        : owner.ownerType === 'experiment' ? await tx.experiment.findUnique({ where: { id: owner.ownerId } }) : await tx.researchPlan.findUnique({ where: { id: owner.ownerId } });
    if (!record)
        throw new Error('记录不存在');
    if ('recordStatus' in record)
        assertRecordEditable(record.recordStatus);
    if (record.status === 'archived')
        throw new Error('已归档记录不能修改');
    return record;
}
export async function GET(request: Request) {
    const url = new URL(request.url);
    const draftId = url.searchParams.get('draftId');
    if (draftId)
        return Response.json({ draft: await prisma.qpcrWorkflowDraft.findUnique({ where: { id: draftId } }) });
    const experimentId = url.searchParams.get('experimentId');
    const researchPlanId = url.searchParams.get('researchPlanId');
    const record = experimentId ? await prisma.experiment.findUnique({ where: { id: experimentId }, include: { samples: { where: { role: 'input' }, orderBy: { sortOrder: 'asc' }, include: { sample: true, group: true } } } }) : null;
    const sourcePlanId = researchPlanId ?? record?.researchPlanId;
    const plan = sourcePlanId ? await prisma.researchPlan.findUnique({ where: { id: sourcePlanId } }) : null;
    const document = scientificDocumentSchema.safeParse(record?.contentJson ?? plan?.contentJson);
    const planDocument = scientificDocumentSchema.safeParse(plan?.contentJson);
    return Response.json({ planLayouts: planDocument.success ? qpcrOutputs(planDocument.data).filter(block => block.toolId === 'qpcr-plate-layout').map(block => ({ ...block, ownerId: plan!.id })) : [], samples: record?.samples.map(link => ({ id: link.sampleId, name: link.sample.name, comparisonGroup: link.group?.label ?? '', kind: 'sample' })) ?? [], layouts: document.success ? qpcrOutputs(document.data).filter(block => block.toolId === 'qpcr-plate-layout') : [] });
}
export async function POST(request: Request) {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host'))
        return Response.json({ error: '请求来源不匹配' }, { status: 403 });
    let files: PreparedAttachmentFile[] = [];
    let committed = false;
    try {
        const data = requestSchema.parse(await request.json());
        const output = data.output;
        if (output && data.session === undefined)
            throw new Error('缺少可恢复方案');
        if (output) {
            const build=JSON.parse(await readFile(path.join(process.cwd(),"public/tools",output.toolId,"release.json"),"utf8"));
            const fullTable = output.fullTable ?? output.table;
            const cell = (value: string) => /[\t\r\n"]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
            const fullTsv = [fullTable.headers, ...fullTable.rows].map(row => row.map(cell).join('\t')).join('\n');
            const rawSources = z.object({ sources: z.array(z.object({ fileName: z.string(), metadata: z.object({ originalBytesBase64: z.string().optional() }) })).optional() }).passthrough().safeParse(data.session);
            const originals = rawSources.success ? rawSources.data.sources?.filter(source => source.metadata.originalBytesBase64) ?? [] : [];
            files = await Promise.all([
                prepareAttachmentFile(new File([JSON.stringify({ schemaVersion: 1, toolId: output.toolId, build, hostCommit:process.env.LABNEST_SOURCE_REVISION ?? "development", state: data.session })], `${output.id}-r${output.baseRevision + 1}.json`, { type: 'application/json' })),
                ...output.images.map(image => {
                    if (!/^\s*<svg[\s>]/.test(image.svg) || /<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?!#)/i.test(image.svg))
                        throw new Error('图资源格式无效');
                    return prepareAttachmentFile(new File([image.svg], `${output.id}.svg`, { type: 'image/svg+xml' }));
                }),
                prepareAttachmentFile(new File([fullTsv], `${output.id}-r${output.baseRevision + 1}-data.tsv`, { type: 'text/tab-separated-values' })),
                ...originals.map(source => prepareAttachmentFile(new File([Buffer.from(source.metadata.originalBytesBase64!, 'base64')], source.fileName, { type: 'application/octet-stream' }))),
            ]);
            await writePreparedAttachmentFiles(files);
        }
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${data.owner.ownerId ?? data.draftId}))`;
            const record = await ownerRecord(tx, data.owner);
            const draft = await tx.qpcrWorkflowDraft.findUnique({ where: { id: data.draftId } });
            if (draft && (draft.ownerType !== data.owner.ownerType || draft.ownerId !== (data.owner.ownerId ?? null) || draft.experimentId !== (data.owner.experimentId ?? null)))
                throw new Error('草稿归属不匹配');
            if (draft?.boundRecordId && !data.owner.ownerId)
                throw new Error('此草稿已保存，请打开原记录');
            const authoritative = scientificDocumentSchema.safeParse(record?.contentJson ?? draft?.documentJson);
            if (output && authoritative.success) {
                // Submission identity survives later revisions and browser retries.
                const replay = await tx.attachment.findFirst({ where: { metadataJson: { path: ['submissionId'], equals: output.submissionId }, links: { some: { targetId: data.owner.ownerId ?? data.draftId } } } });
                if (replay)
                    return { document: authoritative.data, block: qpcrOutputs(authoritative.data).find(item => item.id === output.id), updatedAt: record?.updatedAt, replay: true };
            }
            let document = data.document;
            if (data.forkFromId && authoritative.success) {
                const current = qpcrOutputs(authoritative.data).find(item => item.id === data.forkFromId);
                if (current)
                    document = { ...document, sections: document.sections.map(section => ({ ...section, blocks: section.blocks.map(block => block.id === current.id ? current : block) })) };
            }
            if (record && output) {
                const parsedRemote = scientificDocumentSchema.safeParse(record.contentJson);
                const remote = parsedRemote.success ? parsedRemote.data : data.baseDocument ?? data.document;
                document = mergeQpcrDocumentDraft(data.baseDocument ?? remote, document, remote);
            }
            else if (draft && output) {
                const remote = scientificDocumentSchema.parse(draft.documentJson);
                // Autosave and tool commits share the same lock; preserve other tool outputs.
                for (const block of qpcrOutputs(remote))
                    if (!qpcrOutputs(document).some(item => item.id === block.id))
                        document = mergeQpcrOutput(document, block, block.toolId === 'qpcr-analysis' ? 'analysis' : data.owner.ownerType === 'experiment' ? 'setup' : 'material_methods', 0);
            }
            let block: QpcrOutputBlock | undefined;
            if (output) {
                const replay = qpcrOutputs(document).find(item => item.submissionId === output.submissionId);
                if (replay)
                    return { document, block: replay, updatedAt: record?.updatedAt, replay: true };
                const current = qpcrOutputs(authoritative.success ? authoritative.data : document).find(item => item.id === output.id);
                if ((current?.revision ?? 0) !== output.baseRevision)
                    throw new Error('此结果已有新版本');
                const attachmentIds: string[] = [];
                for (const file of files) {
                    const attachment = await tx.attachment.create({ data: { filename: file.filename, originalFilename: file.originalFilename, mimeType: file.mimeType, size: file.size, storagePath: file.storagePath, sha256: file.sha256, metadataJson: json({ ...file.metadataJson, artifactId: output.id, revision: output.baseRevision + 1, submissionId: output.submissionId }), links: { create: { targetType: data.owner.ownerId ? data.owner.ownerType : 'qpcr_draft', targetId: data.owner.ownerId ?? data.draftId, linkType: 'qpcr_output' } } } });
                    attachmentIds.push(attachment.id);
                }
                block = { id: output.id, type: 'qpcr', label: output.label, toolId: output.toolId, revision: output.baseRevision + 1, submissionId: output.submissionId, sessionAttachmentId: attachmentIds[0], images: output.images.map((image, index) => ({ caption: image.caption, url: `/api/attachments/${attachmentIds[index + 1]}?inline=1` })), table: output.table, method: output.method, mixTsv: output.mixTsv, source: output.source, dataset: { attachmentId: attachmentIds[output.images.length + 1], rowCount: (output.fullTable ?? output.table).rows.length, headers: (output.fullTable ?? output.table).headers, preview: (output.fullTable ?? output.table).rows.slice(0, 20) }, rawAttachments: attachmentIds.slice(output.images.length + 2).map((id, index) => ({ id, name: files[output.images.length + 2 + index].originalFilename })) };
                document = mergeQpcrOutput(document, block, output.sectionKey, output.baseRevision, output.anchorId, output.insertionSection);
                if (record) {
                    const update = { contentJson: json(document) };
                    if (data.owner.ownerType === 'result')
                        await tx.result.update({ where: { id: record.id }, data: update });
                    else if (data.owner.ownerType === 'experiment')
                        await tx.experiment.update({ where: { id: record.id }, data: update });
                    else
                        await tx.researchPlan.update({ where: { id: record.id }, data: update });
                    await associateDocumentMedia(tx, document, data.owner.ownerType, record.id);
                    if (data.owner.ownerType === 'result')
                        await tx.resultDataset.create({ data: { resultId: record.id, name: `qPCR · ${output.id} · r${block.revision}`, storageMode: 'external_reference', externalUri: `/api/attachments/${block.dataset!.attachmentId}`, rowCount: block.dataset!.rowCount, columnCount: block.dataset!.headers.length, columnsJson: json(block.dataset!.headers.map((name, index) => ({ name, index, inferredType: "text" }))), previewJson: json(block.dataset!.preview), schemaJson: json({ artifactId: block.id, revision: block.revision }) } });
                }
            }
            const sessions = { ...(draft?.sessionsJson as Record<string, unknown> ?? {}), ...(data.sessionId ? { [data.sessionId]: data.session ?? null } : {}) };
            if (output && data.sessionId)
                delete sessions[data.sessionId];
            await tx.qpcrWorkflowDraft.upsert({ where: { id: data.draftId }, create: { id: data.draftId, ...data.owner, documentJson: json(document), formJson: json(data.form), sessionsJson: json(sessions) }, update: { documentJson: json(document), formJson: json(data.form), sessionsJson: json(sessions) } });
            const refreshed = record ? await ownerRecord(tx, data.owner) : null;
            return { document, block, updatedAt: refreshed?.updatedAt };
        }, { timeout: 30000 });
        committed = !result.replay;
        if (result.replay)
            await cleanupPreparedAttachmentFiles(files);
        return Response.json(result);
    }
    catch (error) {
        if (!committed)
            await cleanupPreparedAttachmentFiles(files);
        return Response.json({ error: error instanceof Error ? error.message : '尚未保存，请重试' }, { status: 409 });
    }
}
