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

  function normalizePlateName(value) {
    return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
  }

  function plateNameConflict(workspace, candidate, excludePlateId = "") {
    const normalizedCandidate = normalizePlateName(candidate);
    if (!normalizedCandidate) return null;
    return (workspace?.plates || []).find((plate) => plate.id !== excludePlateId && normalizePlateName(plate.name) === normalizedCandidate) || null;
  }

  function uniquePlateName(workspace, requestedName) {
    const base = String(requestedName ?? "").trim().slice(0, 80) || "Untitled plate";
    if (!plateNameConflict(workspace, base)) return base;
    let suffix = 2;
    while (true) {
      const ending = ` ${suffix}`;
      const candidate = `${base.slice(0, 80 - ending.length)}${ending}`;
      if (!plateNameConflict(workspace, candidate)) return candidate;
      suffix += 1;
    }
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

  function normalizeLiquidPlan(plan) {
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
    return { ...clone(plan), stale: plan.stale === true || plan.status === "stale", status: plan.stale === true || plan.status === "stale" ? "stale" : (plan.status || "saved") };
  }

  function liquidPlanTime(plan) {
    const value = new Date(plan?.updatedAt || plan?.createdAt || 0).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function normalizeLiquidPlanState({ liquidPlan, liquidPlans, archivedLiquidPlans } = {}) {
    const candidates = [liquidPlan, ...(Array.isArray(liquidPlans) ? liquidPlans : [])].map(normalizeLiquidPlan).filter(Boolean);
    const uniqueCandidates = [...new Map(candidates.map((plan, index) => [plan.id || `legacy-${index}`, plan])).values()];
    uniqueCandidates.sort((left, right) => {
      const leftCurrent = left.stale ? 0 : 1;
      const rightCurrent = right.stale ? 0 : 1;
      return rightCurrent - leftCurrent || liquidPlanTime(right) - liquidPlanTime(left) || String(right.id || "").localeCompare(String(left.id || ""));
    });
    const current = uniqueCandidates[0] || null;
    const archived = [...(Array.isArray(archivedLiquidPlans) ? archivedLiquidPlans : []), ...uniqueCandidates.slice(1)]
      .map(normalizeLiquidPlan).filter(Boolean);
    const archivedUnique = [...new Map(archived.filter((plan) => !current || plan.id !== current.id).map((plan, index) => [plan.id || `archived-${index}`, plan])).values()].slice(-30);
    return { current, archived: archivedUnique, migratedCount: Math.max(0, uniqueCandidates.length - 1) };
  }

  function createPlate({ id, name, plateSize = 24, dimensions, wells, colorDimension, calculationLog, calculationOutputs, liquidPlan, liquidPlans, archivedLiquidPlans } = {}) {
    const size = PLATE_SIZES.includes(Number(plateSize)) ? Number(plateSize) : 24;
    const normalizedDimensions = normalizeDimensions(dimensions);
    const maps = blankPlateMaps();
    const hasPlateMaps = wells && typeof wells === "object" && PLATE_SIZES.some((candidateSize) => wells[candidateSize] && typeof wells[candidateSize] === "object");
    if (hasPlateMaps) PLATE_SIZES.forEach((candidateSize) => { maps[candidateSize] = normalizeWellMap(wells[candidateSize]); });
    else maps[size] = normalizeWellMap(wells);
    const planState = normalizeLiquidPlanState({ liquidPlan, liquidPlans, archivedLiquidPlans });
    return {
      id: typeof id === "string" && id ? id : newId(),
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : `Plate ${size}`,
      plateSize: size,
      dimensions: normalizedDimensions,
      plates: maps,
      colorDimension: normalizedDimensions.some((item) => item.id === colorDimension) ? colorDimension : (normalizedDimensions.find((item) => item.id === "treatment")?.id || normalizedDimensions[0]?.id || ""),
      calculationLog: Array.isArray(calculationLog) ? clone(calculationLog).slice(-50) : [],
      calculationOutputs: Array.isArray(calculationOutputs) ? clone(calculationOutputs) : [],
      liquidPlans: planState.current ? [planState.current] : [],
      archivedLiquidPlans: planState.archived,
      liquidPlanMigration: planState.migratedCount ? { archivedCount: planState.migratedCount, keptPlanName: planState.current?.name || planState.current?.recipeName || planState.current?.module || "Untitled liquid plan" } : null,
      updatedAt: new Date().toISOString(),
    };
  }

  function createWorkspace({ name = "未命名项目", plateSize = 24, plateName } = {}) {
    const first = createPlate({ name: plateName || "未命名孔板", plateSize });
    return { version: 2, id: newId("workspace"), name: String(name).slice(0, 80), activePlateId: first.id, plates: [first], latestLiquidSummary: null, migrationNotices: [], updatedAt: new Date().toISOString() };
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
    const migrationNotices = plates.filter((plate) => plate.liquidPlanMigration).map((plate) => ({ plateId: plate.id, plateName: plate.name, ...plate.liquidPlanMigration }));
    plates.forEach((plate) => { delete plate.liquidPlanMigration; });
    return {
      version: 2,
      id: newId("workspace"),
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : "未命名项目",
      activePlateId: plates[0].id,
      plates,
      latestLiquidSummary: null,
      migrationNotices,
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
        wells: plate?.plates || plate?.wells,
      });
      seen.add(normalized.id);
      return normalized;
    });
    if (!plates.length) plates.push(createPlate());
    const migrationNotices = [...(Array.isArray(raw.migrationNotices) ? clone(raw.migrationNotices) : []), ...plates.filter((plate) => plate.liquidPlanMigration).map((plate) => ({ plateId: plate.id, plateName: plate.name, ...plate.liquidPlanMigration }))];
    plates.forEach((plate) => { delete plate.liquidPlanMigration; });
    return {
      version: 2,
      id: typeof raw.id === "string" && raw.id ? raw.id : newId("workspace"),
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : "未命名项目",
      activePlateId: plates.some((plate) => plate.id === raw.activePlateId) ? raw.activePlateId : plates[0].id,
      plates,
      latestLiquidSummary: migrationNotices.length ? null : raw.latestLiquidSummary && typeof raw.latestLiquidSummary === "object" ? clone(raw.latestLiquidSummary) : null,
      migrationNotices,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
  }

  function currentLiquidPlan(plate) {
    return Array.isArray(plate?.liquidPlans) && plate.liquidPlans[0] ? plate.liquidPlans[0] : null;
  }

  function usableLiquidPlan(plate) {
    const plan = currentLiquidPlan(plate);
    return plan && !plan.stale && plan.status !== "stale" ? plan : null;
  }

  function publishLiquidPlan(plate, plan) {
    const next = clone(plate);
    const current = currentLiquidPlan(next);
    const normalized = normalizeLiquidPlan({
      ...plan,
      id: current?.id || plan?.id || newId("liquid"),
      createdAt: current?.createdAt || plan?.createdAt || new Date().toISOString(),
      stale: false,
      status: "saved",
    });
    next.liquidPlans = normalized ? [normalized] : [];
    next.archivedLiquidPlans = Array.isArray(next.archivedLiquidPlans) ? next.archivedLiquidPlans : [];
    return next;
  }

  function markLiquidPlanStale(plate) {
    const next = clone(plate);
    const current = currentLiquidPlan(next);
    next.liquidPlans = current ? [{ ...current, stale: true, status: "stale" }] : [];
    return next;
  }

  function clearLiquidPlan(plate) {
    const next = clone(plate);
    next.liquidPlans = [];
    next.archivedLiquidPlans = Array.isArray(next.archivedLiquidPlans) ? next.archivedLiquidPlans : [];
    return next;
  }

  function clearPlateLayout(plate) {
    const next = markLiquidPlanStale(plate);
    const calculatedDimensionIds = new Set((next.calculationOutputs || []).map((output) => output?.id).filter(Boolean));
    next.plates = blankPlateMaps();
    next.dimensions = (next.dimensions || []).filter((dimension) => !calculatedDimensionIds.has(dimension.id));
    next.calculationLog = [];
    next.calculationOutputs = [];
    next.updatedAt = new Date().toISOString();
    return next;
  }

  function activePlate(workspace) {
    return workspace.plates.find((plate) => plate.id === workspace.activePlateId) || workspace.plates[0];
  }

  function addPlate(workspace, options = {}) {
    const next = normalizeWorkspace(workspace);
    if (next.plates.length >= 24) throw new Error("A workspace supports at most 24 plates.");
    const plate = createPlate({ ...options, name: uniquePlateName(next, options.name) });
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
      name: uniquePlateName(next, `${source.name} 副本`),
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

  function importPlates(workspace, incomingPlates, { mode = "add", replacePlateId = "" } = {}) {
    const source = normalizeWorkspace(workspace);
    const replacing = mode === "replace";
    const replaceIndex = replacing ? source.plates.findIndex((plate) => plate.id === replacePlateId) : -1;
    if (replacing && replaceIndex < 0) return { ok: false, error: { code: "replace-plate-not-found", replacePlateId } };

    const incoming = Array.isArray(incomingPlates) ? incomingPlates : [];
    const retained = source.plates.filter((_, index) => index !== replaceIndex);
    const availableCount = 24 - retained.length;
    if (!incoming.length) return { ok: false, error: { code: "no-plates-to-import", incomingCount: 0, availableCount, maximumCount: 24 } };
    if (incoming.length > availableCount) {
      return { ok: false, error: { code: "plate-capacity-exceeded", incomingCount: incoming.length, availableCount, maximumCount: 24 } };
    }

    const nameWorkspace = { plates: [...retained] };
    const renamed = [];
    const prepared = incoming.map((plate, index) => {
      const normalized = createPlate({ ...plate, id: undefined, wells: plate?.plates || plate?.wells });
      const originalName = normalized.name;
      normalized.name = uniquePlateName(nameWorkspace, originalName);
      if (normalized.name !== originalName) renamed.push({ index, from: originalName, to: normalized.name });
      nameWorkspace.plates.push(normalized);
      return normalized;
    });

    if (replacing) {
      prepared[0].id = replacePlateId;
      source.plates.splice(replaceIndex, 1, ...prepared);
    } else source.plates.push(...prepared);
    source.activePlateId = prepared[0].id;
    source.latestLiquidSummary = null;
    source.updatedAt = new Date().toISOString();
    return { ok: true, workspace: source, plates: prepared, renamed };
  }

  function resolveSummaryPlates(workspace, plateIds) {
    const selectedIds = new Set(Array.isArray(plateIds) ? plateIds : []);
    return (workspace?.plates || []).filter((plate) => selectedIds.has(plate.id));
  }

  const VOLUME_TO_UL = Object.freeze({ nL: 0.001, "µL": 1, uL: 1, mL: 1000, L: 1000000 });
  function mergeLiquidContributions(contributions, { overagePercent = 0, minPipetteVolume = 1, maxContainerVolume = Infinity } = {}) {
    const groups = new Map();
    for (const item of contributions || []) {
      const factor = VOLUME_TO_UL[item.unit];
      const base = Number(item.baseVolume);
      if (!factor || !Number.isFinite(base) || base < 0 || !item.groupKey || !item.component) continue;
      // Bind plate-local recipes to the current plate, including cloned plans.
      const key = item.mergeScope === "plate" ? `${item.plateId}:${item.groupKey}` : item.groupKey;
      if (!groups.has(key)) groups.set(key, {
        key,
        label: item.groupLabel || "",
        module: item.module || "",
        executionPlanVersion: item.executionPlanVersion || null,
        compatibilityKey: item.compatibilityKey || "",
        compatibilityProfile: item.compatibilityProfile ? clone(item.compatibilityProfile) : null,
        operationCompatibilityKey: item.operationCompatibilityKey || item.compatibilityKey || "",
        displayOrder: Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : Number.MAX_SAFE_INTEGER,
        tubeRole: item.tubeRole || "standard",
        tube: item.tube || "",
        overagePolicy: item.overagePolicy === "none" ? "none" : "shared",
        cargoIdentity: item.cargoIdentity || "",
        recipeNames: new Set(),
        plates: new Map(),
        sources: new Map(),
        components: new Map(),
        warnings: [],
      });
      const group = groups.get(key);
      if (Number.isFinite(Number(item.displayOrder))) group.displayOrder = Math.min(group.displayOrder, Number(item.displayOrder));
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
        displayOrder: Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : Number.MAX_SAFE_INTEGER,
        direction: item.direction === "reverse" ? "reverse" : "forward",
        preset: item.preset || "",
        protocolMode: item.protocolMode || "preset",
        finalVolumeUL: Number(item.finalVolumeUL) || 0,
        complexVolumeUL: Number(item.complexVolumeUL) || 0,
        cellMediumVolumeUL: Number(item.cellMediumVolumeUL) || 0,
        incubationMinutes: item.incubationMinutes === null ? null : Number(item.incubationMinutes) || null,
        preparation: item.preparation ? clone(item.preparation) : null,
      });
      const componentKey = item.componentKey || item.component;
      const component = group.components.get(componentKey) || { name: item.component, baseVolume: 0, unit: "µL", perWellVolume: Number(item.perWellVolume) || 0, applyOverage: item.applyOverage !== false, transferMode: item.transferMode, perPlate: [] };
      const volume = base * factor;
      component.baseVolume += volume;
      component.perPlate.push({ plateId: item.plateId, volume });
      group.components.set(componentKey, component);
    }
    const multiplier = 1 + Math.max(0, Number(overagePercent) || 0) / 100;
    return {
      groups: [...groups.values()].map((group) => ({
        key: group.key,
        label: group.label,
        module: group.module,
        executionPlanVersion: group.executionPlanVersion,
        compatibilityKey: group.compatibilityKey,
        compatibilityProfile: group.compatibilityProfile,
        operationCompatibilityKey: group.operationCompatibilityKey,
        displayOrder: group.displayOrder,
        tubeRole: group.tubeRole,
        tube: group.tube,
        overagePolicy: group.overagePolicy,
        cargoIdentity: group.cargoIdentity,
        recipeNames: [...group.recipeNames],
        plates: [...group.plates.values()],
        sources: [...group.sources.values()],
        components: [...group.components.values()].map((component) => {
          const preparedVolume = component.baseVolume * (group.overagePolicy === "none" || !component.applyOverage ? 1 : multiplier);
          return {
            ...component,
            preparedVolume,
            containerCount: Number.isFinite(maxContainerVolume) && maxContainerVolume > 0 ? Math.max(1, Math.ceil(preparedVolume / maxContainerVolume)) : 1,
            warning: (component.transferMode === "batch"
              ? preparedVolume > 0 && preparedVolume < minPipetteVolume
              : (component.perWellVolume > 0 && component.perWellVolume < minPipetteVolume) || component.perPlate.some((item) => item.volume < minPipetteVolume))
              ? "below-minimum-pipette-volume"
              : "",
          };
        }),
      })),
    };
  }

  return { PLATE_SIZES, createPlate, createWorkspace, normalizeWorkspace, activePlate, addPlate, duplicatePlate, reorderPlate, removePlate, importPlates, resolveSummaryPlates, normalizePlateName, plateNameConflict, uniquePlateName, currentLiquidPlan, usableLiquidPlan, publishLiquidPlan, markLiquidPlanStale, clearLiquidPlan, clearPlateLayout, mergeLiquidContributions };
});
