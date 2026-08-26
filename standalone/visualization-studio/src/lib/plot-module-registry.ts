export type PlotRendererId = "standard" | "advanced";

export type PlotDataShape = "long" | "matrix" | "coordinates" | "sets" | "network" | "hierarchy" | "genomic-links" | "genomic-coordinates" | "alterations" | "motif-matrix";

type PlotRoleLike = { key: string; label: string; kind: "category" | "number" | "label"; required: boolean };
type PlotExampleLike = { label: string; description: string; data: string; metadata?: string; mapping?: Record<string, string>; pcaInputMode?: "scores" | "matrix"; settings?: Record<string, unknown> };
type PlotDefinitionLike<PlotId extends string> = {
  id: PlotId;
  name: string;
  family: string;
  summary: string;
  inputHint: string;
  roles: PlotRoleLike[];
  defaultMapping: Record<string, string>;
  sampleData: string;
  examples?: PlotExampleLike[];
};
type PlotGuidanceLike = {
  definition: string;
  suitableData: string;
  answers: string;
  origin?: string;
  references: Array<{ citation: string; href: string }>;
};

export type PlotModuleCapabilities<SettingKey extends string = string> = {
  dataShape: PlotDataShape;
  settingKeys: readonly SettingKey[];
  numericAxes?: readonly ("x" | "y")[];
  grouping?: boolean;
  multipleExamples?: boolean;
};
export type PlotModuleSeed<PlotId extends string = string, SettingKey extends string = string> = {
  definition: PlotDefinitionLike<PlotId>;
  guidance: PlotGuidanceLike;
  renderer: PlotRendererId;
  capabilities: PlotModuleCapabilities<SettingKey>;
};
export type PlotModule<PlotId extends string = string, SettingKey extends string = string> = Readonly<{
  definition: Readonly<PlotDefinitionLike<PlotId>>;
  examples: readonly Readonly<PlotExampleLike>[];
  guidance: Readonly<PlotGuidanceLike>;
  renderer: PlotRendererId;
  capabilities: Readonly<PlotModuleCapabilities<SettingKey>>;
}>;
export type PlotModuleRegistry<PlotId extends string = string, SettingKey extends string = string> = Readonly<{
  list: () => readonly PlotModule<PlotId, SettingKey>[];
  get: (type: PlotId) => PlotModule<PlotId, SettingKey>;
}>;

const rendererIds = new Set<PlotRendererId>(["standard", "advanced"]);
const dataShapes = new Set<PlotDataShape>(["long", "matrix", "coordinates", "sets", "network", "hierarchy", "genomic-links", "genomic-coordinates", "alterations", "motif-matrix"]);

function normalizedExamples<PlotId extends string>(definition: PlotDefinitionLike<PlotId>) {
  const examples = definition.examples?.length
    ? definition.examples
    : [{ label: "Example 1", description: "Default input template for this plot type.", data: definition.sampleData, mapping: definition.defaultMapping }];
  return Object.freeze(examples.map((example) => Object.freeze({ ...example })));
}

function requireText(value: string | undefined, field: string, id: string) {
  if (!value?.trim()) throw new Error(`Plot module ${id} is missing ${field}.`);
}

function assertSeed<PlotId extends string, SettingKey extends string>(seed: PlotModuleSeed<PlotId, SettingKey>, index: number) {
  const id = seed?.definition?.id || `at index ${index}`;
  requireText(seed?.definition?.id, "definition.id", id);
  requireText(seed?.definition?.name, "definition.name", id);
  requireText(seed?.definition?.family, "definition.family", id);
  requireText(seed?.definition?.summary, "definition.summary", id);
  requireText(seed?.definition?.inputHint, "definition.inputHint", id);
  requireText(seed?.definition?.sampleData, "definition.sampleData", id);
  if (!Array.isArray(seed?.definition?.roles)) throw new Error(`Plot module ${id} is missing definition.roles.`);
  if (!seed?.definition?.defaultMapping) throw new Error(`Plot module ${id} is missing definition.defaultMapping.`);
  const roleKeys = new Set<string>();
  seed.definition.roles.forEach((role, roleIndex) => {
    requireText(role?.key, `definition.roles[${roleIndex}].key`, id);
    requireText(role?.label, `definition.roles[${roleIndex}].label`, id);
    if (!["category", "number", "label"].includes(role?.kind)) throw new Error(`Plot module ${id} has an invalid definition.roles[${roleIndex}].kind.`);
    if (typeof role?.required !== "boolean") throw new Error(`Plot module ${id} has an invalid definition.roles[${roleIndex}].required flag.`);
    if (roleKeys.has(role.key)) throw new Error(`Plot module ${id} has a duplicate role key: ${role.key}.`);
    roleKeys.add(role.key);
  });
  Object.entries(seed.definition.defaultMapping).forEach(([key, value]) => {
    if (!roleKeys.has(key)) throw new Error(`Plot module ${id} maps an unknown role: ${key}.`);
    if (typeof value !== "string") throw new Error(`Plot module ${id} has a non-text default mapping for ${key}.`);
  });
  seed.definition.examples?.forEach((example, exampleIndex) => {
    requireText(example?.label, `definition.examples[${exampleIndex}].label`, id);
    requireText(example?.description, `definition.examples[${exampleIndex}].description`, id);
    requireText(example?.data, `definition.examples[${exampleIndex}].data`, id);
    Object.entries(example.mapping ?? {}).forEach(([key, value]) => {
      if (!roleKeys.has(key)) throw new Error(`Plot module ${id} example ${exampleIndex + 1} maps an unknown role: ${key}.`);
      if (typeof value !== "string") throw new Error(`Plot module ${id} example ${exampleIndex + 1} has a non-text mapping for ${key}.`);
    });
  });
  requireText(seed?.guidance?.definition, "guidance.definition", id);
  requireText(seed?.guidance?.suitableData, "guidance.suitableData", id);
  requireText(seed?.guidance?.answers, "guidance.answers", id);
  if (!seed?.guidance?.references?.length) throw new Error(`Plot module ${id} needs at least one guidance reference.`);
  seed.guidance.references.forEach((reference, referenceIndex) => {
    requireText(reference.citation, `guidance.references[${referenceIndex}].citation`, id);
    requireText(reference.href, `guidance.references[${referenceIndex}].href`, id);
  });
  if (!rendererIds.has(seed.renderer)) throw new Error(`Plot module ${id} has an invalid renderer: ${String(seed.renderer)}.`);
  if (!dataShapes.has(seed.capabilities?.dataShape)) throw new Error(`Plot module ${id} has an invalid data shape: ${String(seed.capabilities?.dataShape)}.`);
  if (!Array.isArray(seed.capabilities?.settingKeys)) throw new Error(`Plot module ${id} is missing adjustable setting keys.`);
  if (new Set(seed.capabilities.settingKeys).size !== seed.capabilities.settingKeys.length) throw new Error(`Plot module ${id} has duplicate adjustable setting keys.`);
  if (seed.capabilities.numericAxes?.some((axis) => axis !== "x" && axis !== "y")) throw new Error(`Plot module ${id} has an invalid numeric axis capability.`);
  if (seed.capabilities.numericAxes && new Set(seed.capabilities.numericAxes).size !== seed.capabilities.numericAxes.length) throw new Error(`Plot module ${id} has duplicate numeric axis capabilities.`);
}

export function createPlotModuleRegistry<PlotId extends string, SettingKey extends string = string>(
  seeds: readonly PlotModuleSeed<PlotId, SettingKey>[],
  options: { allowedSettingKeys?: readonly SettingKey[] } = {},
): PlotModuleRegistry<PlotId, SettingKey> {
  const byId = new Map<PlotId, PlotModule<PlotId, SettingKey>>();
  const allowedSettingKeys = options.allowedSettingKeys ? new Set(options.allowedSettingKeys) : null;
  const modules = seeds.map((seed, index) => {
    assertSeed(seed, index);
    const id = seed.definition.id;
    if (byId.has(id)) throw new Error(`Duplicate plot module identifier: ${id}.`);
    const unknownSettingKey = allowedSettingKeys && seed.capabilities.settingKeys.find((key) => !allowedSettingKeys.has(key));
    if (unknownSettingKey) throw new Error(`Plot module ${id} has an unknown adjustable setting key: ${unknownSettingKey}.`);
    const plotModule = Object.freeze({
      definition: Object.freeze({ ...seed.definition }),
      examples: normalizedExamples(seed.definition),
      guidance: Object.freeze({ ...seed.guidance }),
      renderer: seed.renderer,
      capabilities: Object.freeze({
        ...seed.capabilities,
        settingKeys: Object.freeze([...seed.capabilities.settingKeys]),
        numericAxes: seed.capabilities.numericAxes ? Object.freeze([...seed.capabilities.numericAxes]) : undefined,
      }),
    }) satisfies PlotModule<PlotId, SettingKey>;
    byId.set(id, plotModule);
    return plotModule;
  });
  const immutableModules = Object.freeze(modules);
  return Object.freeze({
    list: () => immutableModules,
    get: (type: PlotId) => {
      const plotModule = byId.get(type);
      if (!plotModule) throw new Error(`Unknown plot module: ${type}.`);
      return plotModule;
    },
  });
}
