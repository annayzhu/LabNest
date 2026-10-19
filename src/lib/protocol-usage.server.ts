import { prisma } from './db';
import { optionMarks } from './protocol-chips';
import { structuredRunView } from './structured-run';

export type ProtocolUsageRow = {
  experimentId: string; runCode: string; title: string; status: string; date: string;
  /** This Protocol's versions the Experiment used, e.g. "v0.3". */
  versions: string[];
  /** The system each group ran under, each choice with its dimension's name, e.g. "裂解液：▲ 350 µL · 加 DNase：否"; empty when the version has no systems. */
  systems: string[];
  quantities: string[];
  stepsDone: number; stepsTotal: number; actualValues: number; deviations: number; results: number;
};

/**
 * 使用记录: every Experiment that ran any version of this Protocol, with the system, counts and this run's own records.
 * Read-only; nothing is derived beyond what the records hold. A run whose plan no longer parses is still listed without its details.
 */
export async function protocolUsageHistory(protocolId: string): Promise<ProtocolUsageRow[]> {
  const experiments = await prisma.experiment.findMany({
    where: { OR: [{ primaryProtocolVersion: { protocolId } }, { protocolVersions: { some: { protocolVersion: { protocolId } } } }] },
    include: { protocolRun: { select: { executionPlanJson: true } }, steps: { select: { id: true, protocolStepRef: true, groupKey: true, completed: true, deviationNote: true } },
      protocolVersions: { include: { protocolVersion: { select: { id: true, protocolId: true, displayVersion: true } } } }, primaryProtocolVersion: { select: { id: true, protocolId: true, displayVersion: true } },
      _count: { select: { results: true } } },
    orderBy: { date: 'desc' },
  });
  return experiments.map(experiment => {
    const own = [...experiment.protocolVersions.map(link => link.protocolVersion), ...(experiment.primaryProtocolVersion ? [experiment.primaryProtocolVersion] : [])].filter(version => version.protocolId === protocolId);
    const ownIds = new Set(own.map(version => version.id));
    const row: ProtocolUsageRow = { experimentId: experiment.id, runCode: experiment.runCode, title: experiment.title, status: experiment.status, date: experiment.date.toISOString().slice(0, 10),
      versions: [...new Set(own.map(version => `v${version.displayVersion}`))], systems: [], quantities: [], stepsDone: 0, stepsTotal: 0, actualValues: 0, deviations: 0, results: experiment._count.results };
    try {
      const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
      const mine = Object.entries(view.steps).filter(([, step]) => { const version = view.versions.find(item => item.id === step.versionId); return version && ownIds.has(version.sourceVersionId) && step.applicability !== 'not-applicable'; });
      row.stepsTotal = mine.length;
      row.stepsDone = mine.filter(([id]) => experiment.steps.find(step => step.id === id)?.completed).length;
      row.actualValues = mine.reduce((count, [id]) => count + Object.keys(view.plan.actualValues[id] ?? {}).length, 0);
      row.deviations = mine.filter(([id]) => experiment.steps.find(step => step.id === id)?.deviationNote?.trim()).length;
      for (const version of view.versions.filter(version => ownIds.has(version.sourceVersionId))) {
        const adopted = view.plan.versions[version.id], systems = version.document.systems;
        if (systems?.dimensions.length) {
          const marks = optionMarks(systems);
          // Named as the record's 本次体系 line names them: "新引物：否", never a bare "否".
          const choice = adopted ? systems.dimensions.map(d => { const option = d.options.find(o => o.id === adopted.selections[d.id]); return `${d.label}：${option ? [marks.get(`${d.id}:${option.id}`)?.glyph, option.label].filter(Boolean).join(' ') : '未选'}`; }).join(' · ') : '未确认';
          row.systems.push(`${version.groupLabel ? `${version.groupLabel}：` : ''}${choice}`);
        }
        for (const [label, value] of Object.entries(view.plan.quantities[version.id] ?? {})) row.quantities.push(`${version.groupLabel ? `${version.groupLabel} ` : ''}${label} ${value}`);
      }
    } catch {
      // A legacy or unreadable plan: the Experiment is still part of the history.
      row.stepsTotal = experiment.steps.filter(step => step.protocolStepRef && ownIds.has(step.groupKey)).length;
      row.stepsDone = experiment.steps.filter(step => step.protocolStepRef && ownIds.has(step.groupKey) && step.completed).length;
    }
    return row;
  });
}
