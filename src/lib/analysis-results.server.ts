import type { Prisma } from '@/generated/prisma/client';
import { analysisResultDocument, analysisTools, isAnalysisTool, workbookProblem } from './analysis-results';
import { keepAttachment } from './attachment-files';
import { prisma } from './db';
import { createResultInTransaction } from './result-creation';

/**
 * Adds a workbook exported by the qPCR or CNV analysis tool to an experiment as a draft result, the file kept as it
 * is. The file is also linked to the experiment, so it stays traceable even if the result is later removed.
 */
export async function addAnalysisWorkbook(experimentId: string, input: { tool: string; file: unknown; title?: string }) {
  if (!isAnalysisTool(input.tool)) throw new Error('请选择分析工作台');
  const file = input.file instanceof File ? input.file : undefined;
  const problem = workbookProblem(file ?? { name: '', size: 0 });
  if (problem || !file) throw new Error(problem);
  if (!await prisma.experiment.findUnique({ where: { id: experimentId }, select: { id: true } })) throw new Error('实验不存在');
  const label = analysisTools[input.tool];
  const attachmentId = await keepAttachment(file, { targetType: 'experiment', targetId: experimentId, linkType: 'analysis_workbook' });
  const contentJson = JSON.parse(JSON.stringify(analysisResultDocument({ id: attachmentId, name: file.name, type: file.type, size: file.size }, label))) as Prisma.InputJsonValue;
  return prisma.$transaction(async tx => {
    const created = await createResultInTransaction(tx, {
      experimentId, title: input.title?.trim() || `${label} · ${file.name.replace(/\.[^.]+$/, '')}`, resultType: label,
      recordStatus: 'draft', sourceType: 'analysis', qualityStatus: 'not_assessed', origin: { kind: 'manual' },
      analysisMethod: `${label}工作台`, contentJson, provenanceJson: { analysisTool: input.tool, workbook: file.name },
    });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: 'analysis_result_added', targetType: 'experiment', targetId: experimentId, metadataJson: { resultId: created.resultId, tool: input.tool, workbook: file.name, attachmentId } } });
    return created;
  });
}
