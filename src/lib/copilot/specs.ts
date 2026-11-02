/**
 * Task specs (Q331): every Copilot step that proposes something an author may adopt, with its version and where its
 * rules come from. Each suggestion records the spec and version it was made under, so the AI page can compare versions
 * (Q334) and the eval runner can check a new version against the old one before it ships (Q335). Raise the version
 * whenever a step's prompt, output structure or checks change.
 */
export const copilotModules = ['research_plan', 'protocol_import', 'entry', 'result'] as const;
export type CopilotModule = typeof copilotModules[number];
export const moduleLabels: Record<CopilotModule, string> = { research_plan: 'Research plans', protocol_import: 'Manuals and Protocols', entry: 'Quick records', result: 'Results' };

export type SpecSource = { name: string; url?: string; license?: string };
export type TaskSpec = { module: CopilotModule; version: number; label: string; sources: readonly SpecSource[] };

const decided = (questions: string): SpecSource => ({ name: `LabNest ${questions}` });

export const taskSpecs = {
  'plan-design.context': { module: 'research_plan', version: 1, label: 'Context card', sources: [decided('Q300–Q312')] },
  'plan-design.chain': { module: 'research_plan', version: 1, label: 'Evidence chain', sources: [decided('Q300–Q312')] },
  'plan-design.card': { module: 'research_plan', version: 1, label: 'Design card', sources: [decided('Q300–Q312')] },
  // v2 (2026-11-02): every dimension judged, and a finding behind each concern.
  'plan-design.review': { module: 'research_plan', version: 2, label: 'Independent review', sources: [decided('Q300–Q312')] },
  'protocol-import.organize': { module: 'protocol_import', version: 1, label: 'Organized manual (template-v1)', sources: [decided('Q291–Q299')] },
  'entry.tidy': { module: 'entry', version: 1, label: 'Tidied quick record', sources: [decided('Q337–Q340')] },
} as const satisfies Record<string, TaskSpec>;
export type SpecId = keyof typeof taskSpecs;
