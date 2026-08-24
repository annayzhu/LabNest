(function attachWorkspaceCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WorkspaceCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorkspaceCore() {
  "use strict";

  const PLATE_SIZES = Object.freeze([6, 12, 24, 96, 384]);
  const DEFAULT_DIMENSIONS = Object.freeze([
    { id: "sample", name: "样本", type: "text" },
    { id: "treatment", name: "处理", type: "text" },
    { id: "dose", name: "剂量", type: "number", unit: "" },
    { id: "timepoint", name: "时间点", type: "text" },
    { id: "replicate", name: "重复", type: "number", unit: "" },
    { id: "value", name: "原始值", type: "number", unit: "" },
  ]);
  let fallbackId = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function newId(prefix = "plate") {
    if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
    fallbackId += 1;
    return `${prefix}-${Date.now().toString(36)}-${fallbackId.toString(36)}`;
  }

  function blankPlateMaps() {
    return { 6: {}, 12: {}, 24: {}, 96: {}, 384: {} };
  }

  function normalizeDimensions(source) {
    const seen = new Set();
    const rows = Array.isArray(source) ? source : DEFAULT_DIMENSIONS;
    return rows.filter((item) => item && typeof item.id === "string" && typeof item.name === "string").map((item) => ({
      id: item.id.slice(0, 80),
      name: item.name.trim().slice(0, 30),
      type: item.type === "number" ? "number" : "text",
      unit: item.type === "number" && typeof item.unit === "string" ? item.unit.trim().slice(0, 16) : "",
    })).filter((item) => item.name && !seen.has(item.id) && seen.add(item.id));
  }

  function normalizeWellMap(source) {
    const result = {};
    if (!source || typeof source !== "object" || Array.isArray(source)) return result;
    for (const [wellId, well] of Object.entries(source)) {
      if (!/^[A-Z]+\d+$/.test(wellId) || !well || typeof well.params !== "object" || Array.isArray(well.params)) continue;
      result[wellId] = { params: { ...well.params } };
    }
    return result;
  }

  function createPlate({ id, name, plateSize = 24, dimensions, wells, colorDimension, calculationLog, calculationOutputs, liquidPlans } = {}) {
    const size = PLATE_SIZES.includes(Number(plateSize)) ? Number(plateSize) : 24;
    const normalizedDimensions = normalizeDimensions(dimensions);
    const maps = blankPlateMaps();
    maps[size] = normalizeWellMap(wells?.[size] || wells);
    return {
      id: typeof id === "string" && id ? id : newId(),
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : `Plate ${size}`,
      plateSize: size,
      dimensions: normalizedDimensions,
      plates: maps,
      colorDimension: normalizedDimensions.some((item) => item.id === colorDimension) ? colorDimension : (normalizedDimensions.find((item) => item.id === "treatment")?.id || normalizedDimensions[0]?.id || ""),
      calculationLog: Array.isArray(calculationLog) ? clone(calculationLog).slice(-50) : [],
      calculationOutputs: Array.isArray(calculationOutputs) ? clone(calculationOutputs) : [],
      liquidPlans: Array.isArray(liquidPlans) ? clone(liquidPlans).slice(-30) : [],
      updatedAt: new Date().toISOString(),
    };
  }

  function createWorkspace({ name = "未命名项目", plateSize = 24, plateName } = {}) {
    const first = createPlate({ name: plateName || "未命名孔板", plateSize });
    return { version: 2, name: String(name).slice(0, 80), activePlateId: first.id, plates: [first], latestLiquidSummary: null, updatedAt: new Date().toISOString() };
  }

  function hasLegacyContent(raw, size) {
    return Object.keys(raw.plates?.[size] || {}).length > 0
      || (raw.calculationOutputs || []).some((item) => Number(item?.plateSize) === size)
      || (raw.liquidPlans || []).some((item) => Number(item?.plateSize) === size);
  }

  function migrateLegacy(raw) {
    const activeSize = PLATE_SIZES.includes(Number(raw.plateSize)) ? Number(raw.plateSize) : 24;
    const sizes = [activeSize, ...PLATE_SIZES.filter((size) => size !== activeSize && hasLegacyContent(raw, size))];
    const plates = sizes.map((size, index) => createPlate({
      id: `migrated-${size}-${index + 1}`,
      name: index === 0 ? (raw.name || "未命名孔板") : `${raw.name || "迁移孔板"} · ${size} well`,
      plateSize: size,
      dimensions: raw.dimensions,
      wells: raw.plates?.[size],
      colorDimension: raw.colorDimension,
      calculationLog: (raw.calculationLog || []).filter((item) => !item?.plateSize || Number(item.plateSize) === size),
      calculationOutputs: (raw.calculationOutputs || []).filter((item) => !item?.plateSize || Number(item.plateSize) === size),
      liquidPlans: (raw.liquidPlans || []).filter((item) => !item?.plateSize || Number(item.plateSize) === size),
    }));
    return {
      version: 2,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : "未命名项目",
      activePlateId: plates[0].id,
      plates,
      latestLiquidSummary: null,
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeWorkspace(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Workspace data is invalid.");
    if (Number(raw.version) !== 2 || !Array.isArray(raw.plates)) return migrateLegacy(raw);
    const seen = new Set();
    const plates = raw.plates.slice(0, 24).map((plate, index) => {
      const normalized = createPlate({
        ...plate,
        id: typeof plate?.id === "string" && plate.id && !seen.has(plate.id) ? plate.id : `plate-${index + 1}-${newId("id")}`,
        wells: plate?.plates?.[plate?.plateSize] || plate?.wells,
      });
      seen.add(normalized.id);
      return normalized;
    });
    if (!plates.length) plates.push(createPlate());
    return {
      version: 2,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : "未命名项目",
      activePlateId: plates.some((plate) => plate.id === raw.activePlateId) ? raw.activePlateId : plates[0].id,
      plates,
      latestLiquidSummary: raw.latestLiquidSummary && typeof raw.latestLiquidSummary === "object" ? clone(raw.latestLiquidSummary) : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
  }

  function activePlate(workspace) {
    return workspace.plates.find((plate) => plate.id === workspace.activePlateId) || workspace.plates[0];
  }

  function addPlate(workspace, options = {}) {
    const next = normalizeWorkspace(workspace);
    if (next.plates.length >= 24) throw new Error("A workspace supports at most 24 plates.");
    const plate = createPlate(options);
    next.plates.push(plate);
    next.activePlateId = plate.id;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function duplicatePlate(workspace, sourceId, mode = "full") {
    const next = normalizeWorkspace(workspace);
    if (next.plates.length >= 24) throw new Error("A workspace supports at most 24 plates.");
    const source = next.plates.find((plate) => plate.id === sourceId);
    if (!source) throw new Error("Source plate was not found.");
    const copiedWells = mode === "structure" ? {} : source.plates[source.plateSize];
    const plate = createPlate({
      name: `${source.name} 副本`,
      plateSize: source.plateSize,
      dimensions: source.dimensions,
      wells: copiedWells,
      colorDimension: source.colorDimension,
      calculationLog: [],
      calculationOutputs: [],
      liquidPlans: [],
    });
    const index = next.plates.findIndex((item) => item.id === sourceId);
    next.plates.splice(index + 1, 0, plate);
    next.activePlateId = plate.id;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function reorderPlate(workspace, plateId, offset) {
    const next = normalizeWorkspace(workspace);
    const index = next.plates.findIndex((plate) => plate.id === plateId);
    const target = index + Number(offset);
    if (index < 0 || target < 0 || target >= next.plates.length) return next;
    [next.plates[index], next.plates[target]] = [next.plates[target], next.plates[index]];
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function removePlate(workspace, plateId) {
    const next = normalizeWorkspace(workspace);
    if (next.plates.length <= 1) throw new Error("A workspace must contain at least one plate.");
    const index = next.plates.findIndex((plate) => plate.id === plateId);
    if (index < 0) return next;
    next.plates.splice(index, 1);
    if (next.activePlateId === plateId) next.activePlateId = next.plates[Math.min(index, next.plates.length - 1)].id;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  const VOLUME_TO_UL = Object.freeze({ nL: 0.001, "µL": 1, uL: 1, mL: 1000, L: 1000000 });
  function mergeLiquidContributions(contributions, { overagePercent = 0, minPipetteVolume = 1, maxContainerVolume = Infinity } = {}) {
    const groups = new Map();
    for (const item of contributions || []) {
      const factor = VOLUME_TO_UL[item.unit];
      const base = Number(item.baseVolume);
      if (!factor || !Number.isFinite(base) || base < 0 || !item.groupKey || !item.component) continue;
      if (!groups.has(item.groupKey)) groups.set(item.groupKey, {
        key: item.groupKey,
        label: item.groupLabel || item.groupKey,
        tubeRole: item.tubeRole || "standard",
        tube: item.tube || "",
        cargoIdentity: item.cargoIdentity || "",
        recipeNames: new Set(),
        plates: new Map(),
        sources: new Map(),
        components: new Map(),
        warnings: [],
      });
      const group = groups.get(item.groupKey);
      if (!group.plates.has(item.plateId)) group.plates.set(item.plateId, { plateId: item.plateId, plateName: item.plateName || item.plateId });
      if (item.planName) group.recipeNames.add(item.planName);
      const sourceKey = `${item.plateId}\u0000${item.planName || ""}\u0000${item.groupName || ""}`;
      if (!group.sources.has(sourceKey)) group.sources.set(sourceKey, {
        plateId: item.plateId,
        plateName: item.plateName || item.plateId,
        planName: item.planName || "",
        groupName: item.groupName || "",
        scopeWellIds: Array.isArray(item.scopeWellIds) ? [...item.scopeWellIds] : [],
        protocolSteps: Array.isArray(item.protocolSteps) ? [...item.protocolSteps] : [],
      });
      const component = group.components.get(item.component) || { name: item.component, baseVolume: 0, unit: "µL", perWellVolume: Number(item.perWellVolume) || 0, perPlate: [] };
      const volume = base * factor;
      component.baseVolume += volume;
      component.perPlate.push({ plateId: item.plateId, volume });
      group.components.set(item.component, component);
    }
    const multiplier = 1 + Math.max(0, Number(overagePercent) || 0) / 100;
    return {
      groups: [...groups.values()].map((group) => ({
        key: group.key,
        label: group.label,
        tubeRole: group.tubeRole,
        tube: group.tube,
        cargoIdentity: group.cargoIdentity,
        recipeNames: [...group.recipeNames],
        plates: [...group.plates.values()],
        sources: [...group.sources.values()],
        components: [...group.components.values()].map((component) => {
          const preparedVolume = component.baseVolume * multiplier;
          return {
            ...component,
            preparedVolume,
            containerCount: Number.isFinite(maxContainerVolume) && maxContainerVolume > 0 ? Math.max(1, Math.ceil(preparedVolume / maxContainerVolume)) : 1,
            warning: (component.perWellVolume > 0 && component.perWellVolume < minPipetteVolume) || component.perPlate.some((item) => item.volume < minPipetteVolume)
              ? "below-minimum-pipette-volume"
              : "",
          };
        }),
      })),
    };
  }

  return { PLATE_SIZES, createPlate, createWorkspace, normalizeWorkspace, activePlate, addPlate, duplicatePlate, reorderPlate, removePlate, mergeLiquidContributions };
});
