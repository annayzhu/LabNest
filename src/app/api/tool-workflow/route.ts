import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from 'zod';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { calculate } from '@/lib/calculators/calculator-engine';
import { documentPlateLayouts } from '@/lib/scientific-document';
import { newPlateId, plateLayoutSchema, plateLayoutsFromPlannerBackup, type PlateLayout, type PlateWellValue } from '@/lib/plate-layout';
import { scientificDocumentSchema } from '@/lib/scientific-document';
import { mergeToolDocumentDraft, mergeToolOutput, replacePlateWithOutput, toolOutputIds, toolOutputs, type ToolOutputBlock } from '@/lib/tool-workflow';
import { assertRecordEditable } from '@/lib/record-lifecycle';
import { currentPlasmidVersion, plasmidOutput } from '@/lib/plasmid/tool-output.server';
import { savedRecordDocument } from '@/lib/tool-remote-document';
import { plannerFieldsLeftOut } from '@/lib/plate-layout';
import { prepareAttachmentFile, writePreparedAttachmentFiles, cleanupPreparedAttachmentFiles, type PreparedAttachmentFile } from '@/lib/attachment-files';
import { associateDocumentMedia } from '@/lib/document-media.server';
const ownerSchema = z.object({ ownerType: z.enum(['result', 'experiment', 'research_plan', 'report', 'entry']), ownerId: z.string().optional(), experimentId: z.string().optional() });
const requestSchema = z.object({
    draftId: z.string().uuid(), owner: ownerSchema, document: scientificDocumentSchema,
    baseDocument: scientificDocumentSchema.optional(), forkFromId: z.string().optional(), form: z.record(z.string(), z.unknown()).default({}),
    sessionId: z.string().optional(), session: z.unknown().optional(),
    output: z.object({ id: z.string().uuid(), submissionId: z.string().uuid(), baseRevision: z.number().int().nonnegative(), toolId: z.enum(toolOutputIds),
        sectionKey: z.enum(['setup', 'material_methods', 'analysis', 'methods', 'results']), replacePlateId: z.string().optional(), anchorId: z.string().optional(), insertionSection: z.string().optional(), label: z.string(), method: z.string(),
        images: z.array(z.object({ svg: z.string().max(2000000), caption: z.string() })).max(150),
        plates: z.array(plateLayoutSchema).max(48).optional(),
        fullTable: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
        table: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }), tables: z.array(z.object({ title: z.string(), headers: z.array(z.string()), rows: z.array(z.array(z.string())) })).max(60).optional(), mixTsv: z.string().optional(), source: z.object({ ownerId: z.string(), artifactId: z.string(), revision: z.number() }).optional(),
    }).optional(),
});
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
/** A planner names samples it was given and samples typed into it; only the first are LabNest samples, so only they stay linked. */
async function keepKnownSamples(plates: PlateLayout[] | undefined) {
    if (!plates?.length)
        return plates;
    const ids = new Set(plates.flatMap(plate => Object.values(plate.wells).flatMap(well => Object.values(well).flatMap(value => typeof value === 'string' ? [] : [value.sampleId]))));
    const known = new Set((await prisma.sample.findMany({ where: { id: { in: [...ids] } }, select: { id: true } })).map(sample => sample.id));
    return plates.map(plate => ({ ...plate, wells: Object.fromEntries(Object.entries(plate.wells).map(([wellId, well]) => [wellId, Object.fromEntries(Object.entries(well).map(([field, value]) => [field, typeof value === 'string' || known.has(value.sampleId) ? value : value.label]))])) }));
}
/** The free planner keeps samples as names: link the ones this record already knows, and only when the name is unambiguous. */
async function plannerPlates(session: unknown, owner: z.infer<typeof ownerSchema>, document: z.infer<typeof scientificDocumentSchema>) {
    const plates = plateLayoutsFromPlannerBackup(session, newPlateId);
    const experimentId = owner.ownerType === 'experiment' ? owner.ownerId : owner.experimentId;
    const links = experimentId ? await prisma.experimentSample.findMany({ where: { experimentId, role: 'input' }, select: { sampleId: true, sample: { select: { name: true } } } }) : [];
    const known = new Map<string, Set<string>>();
    const add = (name: string, id: string) => known.set(name, (known.get(name) ?? new Set()).add(id));
    for (const link of links)
        add(link.sample.name, link.sampleId);
    for (const plate of documentPlateLayouts(document))
        for (const well of Object.values(plate.wells))
            for (const value of Object.values(well))
                if (typeof value !== 'string')
                    add(value.label, value.sampleId);
    return plates.map(plate => {
        const field = plate.fields.find(item => item.id === 'sample' || /^(样本|sample)$/i.test(item.name))?.id;
        if (!field)
            return plate;
        return { ...plate, wells: Object.fromEntries(Object.entries(plate.wells).map(([wellId, well]) => {
                const value = well[field], ids = typeof value === 'string' ? known.get(value) : undefined;
                const linked: PlateWellValue | undefined = ids?.size === 1 && typeof value === 'string' ? { sampleId: [...ids][0], label: value } : value;
                return [wellId, linked === undefined ? well : { ...well, [field]: linked }];
            })) };
    });
}
const plasmidSessionSchema = z.object({ productId: z.string().min(1), versionId: z.string().min(1), zh: z.boolean() });
const calculatorSessionSchema = z.object({ calculatorId: z.string(), inputs: z.record(z.string(), z.unknown()), snapshot: z.unknown() });
async function ownerRecord(tx: Prisma.TransactionClient, owner: z.infer<typeof ownerSchema>) {
    if (!owner.ownerId)
        return null;
    const record = owner.ownerType === 'result' ? await tx.result.findUnique({ where: { id: owner.ownerId } })
        : owner.ownerType === 'experiment' ? await tx.experiment.findUnique({ where: { id: owner.ownerId } }) : owner.ownerType === 'report' ? await tx.report.findUnique({ where: { id: owner.ownerId } }) : await tx.researchPlan.findUnique({ where: { id: owner.ownerId } });
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
    const plasmid = url.searchParams.get('plasmid');
    if (plasmid)
        return Response.json({ current: await currentPlasmidVersion(plasmid) });
    const draftId = url.searchParams.get('draftId');
    if (draftId)
        return Response.json({ draft: await prisma.toolWorkflowDraft.findUnique({ where: { id: draftId } }) });
    const experimentId = url.searchParams.get('experimentId');
    const researchPlanId = url.searchParams.get('researchPlanId');
    const record = experimentId ? await prisma.experiment.findUnique({ where: { id: experimentId }, include: { samples: { where: { role: 'input' }, orderBy: { sortOrder: 'asc' }, include: { sample: true, group: true } } } }) : null;
    const sourcePlanId = researchPlanId ?? record?.researchPlanId;
    const plan = sourcePlanId ? await prisma.researchPlan.findUnique({ where: { id: sourcePlanId } }) : null;
    const document = scientificDocumentSchema.safeParse(record?.contentJson ?? plan?.contentJson);
    const planDocument = scientificDocumentSchema.safeParse(plan?.contentJson);
    return Response.json({ planLayouts: planDocument.success ? toolOutputs(planDocument.data).filter(block => block.toolId === 'qpcr-plate-layout').map(block => ({ ...block, ownerId: plan!.id })) : [], samples: record?.samples.map(link => ({ id: link.sampleId, name: link.sample.name, comparisonGroup: link.group?.label ?? '', kind: 'sample' })) ?? [], layouts: document.success ? toolOutputs(document.data).filter(block => block.toolId === 'qpcr-plate-layout') : [] });
}
export async function POST(request: Request) {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host'))
        return Response.json({ error: '请求来源不匹配' }, { status: 403 });
    let files: PreparedAttachmentFile[] = [];
    let committed = false;
    try {
        const data = requestSchema.parse(await request.json());
        // A plasmid's identity comes from what is saved; the browser only supplies the picture of it.
        const reference = data.output?.toolId === 'plasmid-workbench' ? await plasmidOutput(plasmidSessionSchema.parse(data.session)) : undefined;
        const leftOut = data.output?.toolId === 'free-plate-layout' ? plannerFieldsLeftOut(data.session) : [];
        const output = data.output && reference ? { ...data.output, label: reference.label, table: reference.table, method: reference.method }
            : data.output && leftOut.length ? { ...data.output, method: `${data.output.method} · 板图未显示的参数：${leftOut.join('、')}（完整内容在方案文件里）` } : data.output;
        const plates = output?.toolId === 'free-plate-layout' ? await plannerPlates(data.session, data.owner, data.document) : await keepKnownSamples(output?.plates);
        if (output?.toolId === 'calculator') {
            // The record keeps only what this server calculates from the same inputs.
            const session = calculatorSessionSchema.parse(data.session);
            if (!isDeepStrictEqual(JSON.parse(JSON.stringify(calculate({ calculatorId: session.calculatorId, inputs: session.inputs }))), session.snapshot))
                throw new Error('结果与输入不一致，请重新计算');
        }
        if (output && data.session === undefined)
            throw new Error('缺少可恢复方案');
        if (output) {
            // These ship inside LabNest, so the host commit below already identifies its build.
            const build=output.toolId==="calculator"||output.toolId==="plasmid-workbench"?{bundledWithHost:true}:JSON.parse(await readFile(path.join(process.cwd(),"public/tools",output.toolId,"release.json"),"utf8"));
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
            // An Entry saves its own text: here it only gets the saved output back, and its files stay drafts until that save.
            const detached = data.owner.ownerType === 'entry';
            if (detached && data.owner.ownerId)
                assertRecordEditable((await tx.entry.findUniqueOrThrow({ where: { id: data.owner.ownerId } })).recordStatus);
            // Formal saves lock the row; without the same lock either save could overwrite the other.
            if (data.owner.ownerId && data.owner.ownerType === 'result')
                await tx.$queryRaw `SELECT id FROM "Result" WHERE id=${data.owner.ownerId} FOR UPDATE`;
            else if (data.owner.ownerId && data.owner.ownerType === 'experiment')
                await tx.$queryRaw `SELECT id FROM "Experiment" WHERE id=${data.owner.ownerId} FOR UPDATE`;
            else if (data.owner.ownerId && data.owner.ownerType === 'research_plan')
                await tx.$queryRaw `SELECT id FROM "ResearchPlan" WHERE id=${data.owner.ownerId} FOR UPDATE`;
            else if (data.owner.ownerId && data.owner.ownerType === 'report')
                await tx.$queryRaw `SELECT id FROM "Report" WHERE id=${data.owner.ownerId} FOR UPDATE`;
            const record = detached ? null : await ownerRecord(tx, data.owner);
            const draft = await tx.toolWorkflowDraft.findUnique({ where: { id: data.draftId } });
            if (draft && (draft.ownerType !== data.owner.ownerType || draft.ownerId !== (data.owner.ownerId ?? null) || draft.experimentId !== (data.owner.experimentId ?? null)))
                throw new Error('草稿归属不匹配');
            if (draft?.boundRecordId && !data.owner.ownerId)
                throw new Error('此草稿已保存，请打开原记录');
            const authoritative = scientificDocumentSchema.safeParse(record?.contentJson ?? draft?.documentJson);
            if (output && authoritative.success) {
                // Submission identity survives later revisions and browser retries.
                const replay = await tx.attachment.findFirst({ where: { metadataJson: { path: ['submissionId'], equals: output.submissionId }, links: { some: { targetId: data.owner.ownerId ?? data.draftId } } } });
                if (replay)
                    return { document: authoritative.data, block: toolOutputs(authoritative.data).find(item => item.id === output.id), updatedAt: record?.updatedAt, replay: true };
            }
            let document = data.document;
            if (data.forkFromId && authoritative.success) {
                const current = toolOutputs(authoritative.data).find(item => item.id === data.forkFromId);
                if (current)
                    document = { ...document, sections: document.sections.map(section => ({ ...section, blocks: section.blocks.map(block => block.id === current.id ? current : block) })) };
            }
            if (record && output) {
                const remote = savedRecordDocument(data.owner.ownerType as Exclude<typeof data.owner.ownerType, 'entry'>, record);
                document = mergeToolDocumentDraft(data.baseDocument ?? remote, document, remote);
            }
            else if (draft && output) {
                const remote = scientificDocumentSchema.parse(draft.documentJson);
                // Autosave and tool commits share the same lock; preserve other tool outputs.
                for (const block of toolOutputs(remote))
                    if (!toolOutputs(document).some(item => item.id === block.id))
                        document = mergeToolOutput(document, block, block.toolId === 'qpcr-analysis' ? 'analysis' : data.owner.ownerType === 'experiment' ? 'setup' : 'material_methods', 0);
            }
            let block: ToolOutputBlock | undefined;
            if (output) {
                const replay = toolOutputs(document).find(item => item.submissionId === output.submissionId);
                if (replay)
                    return { document, block: replay, updatedAt: record?.updatedAt, replay: true };
                const current = toolOutputs(authoritative.success ? authoritative.data : document).find(item => item.id === output.id);
                if ((current?.revision ?? 0) !== output.baseRevision)
                    throw new Error('此结果已有新版本');
                const attachmentIds: string[] = [];
                for (const file of files) {
                    const attachment = await tx.attachment.create({ data: { filename: file.filename, originalFilename: file.originalFilename, mimeType: file.mimeType, size: file.size, storagePath: file.storagePath, sha256: file.sha256, metadataJson: json({ ...file.metadataJson, artifactId: output.id, revision: output.baseRevision + 1, submissionId: output.submissionId }), links: { create: { targetType: detached ? 'document_upload_draft' : data.owner.ownerId ? data.owner.ownerType : 'tool_draft', targetId: detached ? data.draftId : data.owner.ownerId ?? data.draftId, linkType: 'tool_output' } } } });
                    attachmentIds.push(attachment.id);
                }
                block = { id: output.id, type: 'tool_output', label: output.label, toolId: output.toolId, revision: output.baseRevision + 1, submissionId: output.submissionId, sessionAttachmentId: attachmentIds[0], images: output.images.map((image, index) => ({ caption: image.caption, url: `/api/attachments/${attachmentIds[index + 1]}?inline=1` })), ...(reference ? { plasmid: reference.plasmid } : {}), ...(plates?.length ? { plates } : {}), table: output.table, ...(output.tables?.length ? { tables: output.tables } : {}), method: output.method, mixTsv: output.mixTsv, source: output.source, dataset: { attachmentId: attachmentIds[output.images.length + 1], rowCount: (output.fullTable ?? output.table).rows.length, headers: (output.fullTable ?? output.table).headers, preview: (output.fullTable ?? output.table).rows.slice(0, 20) }, rawAttachments: attachmentIds.slice(output.images.length + 2).map((id, index) => ({ id, name: files[output.images.length + 2 + index].originalFilename })) };
                document = (output.replacePlateId && !output.baseRevision ? replacePlateWithOutput(document, output.replacePlateId, block) : undefined) ?? mergeToolOutput(document, block, output.sectionKey, output.baseRevision, output.anchorId, output.insertionSection);
                if (record) {
                    const update = { contentJson: json(document) };
                    if (data.owner.ownerType === 'result')
                        await tx.result.update({ where: { id: record.id }, data: update });
                    else if (data.owner.ownerType === 'experiment')
                        await tx.experiment.update({ where: { id: record.id }, data: update });
                    else if (data.owner.ownerType === 'report')
                        await tx.report.update({ where: { id: record.id }, data: update });
                    else
                        await tx.researchPlan.update({ where: { id: record.id }, data: update });
                    await associateDocumentMedia(tx, document, data.owner.ownerType, record.id);
                    if (data.owner.ownerType === 'result')
                        await tx.resultDataset.create({ data: { resultId: record.id, name: `${output.label} · ${output.id} · r${block.revision}`, storageMode: 'external_reference', externalUri: `/api/attachments/${block.dataset!.attachmentId}`, rowCount: block.dataset!.rowCount, columnCount: block.dataset!.headers.length, columnsJson: json(block.dataset!.headers.map((name, index) => ({ name, index, inferredType: "text" }))), previewJson: json(block.dataset!.preview), schemaJson: json({ artifactId: block.id, revision: block.revision }) } });
                }
            }
            const sessions = { ...(draft?.sessionsJson as Record<string, unknown> ?? {}), ...(data.sessionId ? { [data.sessionId]: data.session ?? null } : {}) };
            if (output && data.sessionId)
                delete sessions[data.sessionId];
            if (!detached)
                await tx.toolWorkflowDraft.upsert({ where: { id: data.draftId }, create: { id: data.draftId, ...data.owner, documentJson: json(document), formJson: json(data.form), sessionsJson: json(sessions) }, update: { documentJson: json(document), formJson: json(data.form), sessionsJson: json(sessions) } });
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
