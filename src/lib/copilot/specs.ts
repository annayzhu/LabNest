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
/** A K-Dense Scientific Agent Skill, pinned to the version its rules were taken from (MIT). */
const kDense = (skill: string, version: string): SpecSource => ({ name: `K-Dense ${skill} ${version}`, url: `https://github.com/K-Dense-AI/scientific-agent-skills/tree/main/skills/${skill}`, license: 'MIT' });

export const taskSpecs = {
  'plan-design.context': { module: 'research_plan', version: 1, label: 'Context card', sources: [decided('Q300–Q312')] },
  'plan-design.hypotheses': { module: 'research_plan', version: 1, label: 'Hypotheses and predictions', sources: [decided('Q303, Q332'), kDense('hypothesis-generation', '2.2')] },
  // v2 (2026-11-02): built on the confirmed hypotheses; each rival tied to the block that rules it out.
  'plan-design.chain': { module: 'research_plan', version: 2, label: 'Evidence chain', sources: [decided('Q300–Q312, Q332'), kDense('hypothesis-generation', '2.2')] },
  // v2 (2026-11-02): the model proposes the effect and where it comes from, the program computes n; randomization and batches asked for.
  'plan-design.card': { module: 'research_plan', version: 2, label: 'Design card', sources: [decided('Q304, Q305, Q332'), kDense('experimental-design', '1.2'), kDense('statistical-power', '1.1')] },
  'plan-design.evidence': { module: 'research_plan', version: 1, label: 'Evidence from a paper', sources: [decided('Q306, Q307, Q332'), kDense('hypothesis-generation', '2.2')] },
  // v2 (2026-11-02): every dimension judged, and a finding behind each concern. v3: a rubric per dimension, every finding a change to make, the strongest conclusion stated.
  'plan-design.review': { module: 'research_plan', version: 3, label: 'Independent review', sources: [decided('Q308, Q332'), kDense('scientific-critical-thinking', '1.3'), kDense('statistical-power', '1.1')] },
  'protocol-import.organize': { module: 'protocol_import', version: 1, label: 'Organized manual (template-v1)', sources: [decided('Q291–Q299')] },
  'entry.tidy': { module: 'entry', version: 1, label: 'Tidied quick record', sources: [decided('Q337–Q340')] },
} as const satisfies Record<string, TaskSpec>;
export type SpecId = keyof typeof taskSpecs;
