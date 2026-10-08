(function attachLiquidPlanCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LiquidPlanCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiquidPlanCore() {
  "use strict";

  const EXECUTION_PLAN_VERSION = 2;

  const TRANSIENT_INPUT_KEYS = new Set([
    "wellCount", "dilutionWellCount", "groupDimension", "groupRoleLines", "groupOverageLines",
    "overagePercent", "fixedOveragePercent", "dilutionOveragePercent", "solidOveragePercent",
    "cargoName",
  ]);

  function normalizedScalar(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : "";
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(normalizedScalar);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizedScalar(value[key])]));
    return "";
  }

  function stableRecipeInput(input = {}) {
    return Object.fromEntries(Object.keys(input).filter((key) => !TRANSIENT_INPUT_KEYS.has(key)).sort().map((key) => [key, normalizedScalar(input[key])]));
  }

  function stableStringify(value) {
    return JSON.stringify(normalizedScalar(value));
  }

  const UNIT_SCALE = Object.freeze({ nM: 1, "µM": 1000, uM: 1000, mM: 1e6, M: 1e9, "ng/µL": 1, "ng/uL": 1, "µg/µL": 1000, "ug/uL": 1000, ng: 1, "µg": 1000, ug: 1000, pmol: 1, nmol: 1000 });

  function normalizedQuantity(value, unit) {
    const number = Number(value);
    const scale = UNIT_SCALE[String(unit || "").trim()];
    return Number.isFinite(number) && scale ? number * scale : normalizedScalar(value);
  }

  function canonicalChemistry(input = {}) {
    const stockUnit = String(input.stockUnit || "").trim();
    const targetUnit = String(input.targetUnit || "").trim();
    const chemistry = {
      preset: normalizedScalar(input.preset),
      direction: input.direction === "reverse" ? "reverse" : "forward",
      stockRequirement: normalizedQuantity(input.stockConcentration, stockUnit),
      stockDimension: /M$/.test(stockUnit) ? "nM" : /\/µ?L$|\/uL$/.test(stockUnit) ? "ng/µL" : stockUnit,
      targetRequirement: normalizedQuantity(input.targetValue, targetUnit),
      targetDimension: /M$/.test(targetUnit) ? "nM" : /mol$/.test(targetUnit) ? "pmol" : /g$/.test(targetUnit) ? "ng" : targetUnit,
      reagentPerWell: normalizedScalar(input.reagentPerWell),
      p3000PerUg: normalizedScalar(input.p3000PerUg),
      lengthBp: normalizedScalar(input.lengthBp),
      totalCargoMassNg: normalizedQuantity(input.totalCargoMass, input.totalCargoMassUnit),
      totalCargoAmountPmol: normalizedQuantity(input.totalCargoAmount, input.totalCargoAmountUnit),
    };
    return Object.fromEntries(Object.entries(chemistry).filter(([, value]) => value !== "" && value !== undefined));
  }

  function preparationCompatibility({ input = {}, result = {}, tube = "Tube", tubeRole = "standard" } = {}) {
    const components = (result.totals || []).filter((row) => String(row.tube || "Tube").trim() === tube).map((row) => ({
      component: String(row.component || "Component").trim(),
      perWellVolumeUL: Number(row.volumeUL) || 0,
    })).sort((left, right) => left.component.localeCompare(right.component) || left.perWellVolumeUL - right.perWellVolumeUL);
    const chemistry = canonicalChemistry(input);
    if (input.protocolMode === "custom") chemistry.customProtocol = String(input.protocolSteps || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const operationProfile = {
      module: "transfection",
      chemistry,
      handling: {
        finalVolumeUL: Number(result.finalVolumeUL) || 0,
        complexVolumeUL: Number(result.complexVolumeUL) || 0,
        cellMediumVolumeUL: Number(result.cellMediumVolumeUL) || 0,
        incubationMinutes: input.protocolMode === "custom" ? null : input.preset === "rnai" ? 5 : null,
      },
    };
    const profile = {
      module: "transfection",
      tubeRole,
      tube,
      chemistry,
      components,
      handling: operationProfile.handling,
    };
    return { key: stableStringify(profile), profile, operationKey: stableStringify(operationProfile) };
  }

  function cargoIdentityFor(group) {
    const names = [...new Set((group?.result?.cargos || []).map((cargo) => String(cargo?.name || "").trim()).filter(Boolean))];
    return names.join(" + ") || String(group?.name || "Unnamed cargo").trim();
  }

  function buildTransfectionContributions({ input = {}, plate, planName = "Transfection", groups = [] } = {}) {
    if (!plate?.id) throw new Error("A plate identity is required.");
    const contributions = [];
    const cargoDependentTubes = new Set((groups || []).flatMap((group) => (group?.result?.totals || []).filter((row) => row.tubeRole === "cargo" || row.cargoDependent === true).map((row) => String(row.tube || "Tube").trim())));
    for (const [displayOrder, group] of (groups || []).entries()) {
      const cargoIdentity = cargoIdentityFor(group);
      const result = group?.result || {};
      const multiplier = 1 + Math.max(0, Number(result.overagePercent) || 0) / 100;
      for (const row of result.totals || []) {
        const totalVolume = Number(row.totalVolumeUL);
        if (!Number.isFinite(totalVolume) || totalVolume < 0) continue;
        const tube = String(row.tube || "Tube").trim();
        const tubeRole = cargoDependentTubes.has(tube) ? "cargo" : "common";
        const compatibility = preparationCompatibility({ input, result, tube, tubeRole });
        const keepSeparate = input.mergeCommonMix === "off" && tubeRole === "common";
        const groupKey = tubeRole === "cargo"
          ? `transfection:cargo:${cargoIdentity}:${tube}:${compatibility.key}`
          : `transfection:common:${tube}:${keepSeparate ? `${plate.id}:${cargoIdentity}:` : ""}${compatibility.key}`;
        contributions.push({
          executionPlanVersion: EXECUTION_PLAN_VERSION,
          module: "transfection",
          groupKey,
          groupLabel: tubeRole === "cargo" ? `${cargoIdentity} · ${tube}` : `${planName} · ${tube}`,
          compatibilityKey: compatibility.key,
          compatibilityProfile: compatibility.profile,
          operationCompatibilityKey: compatibility.operationKey,
          displayOrder,
          tubeRole,
          tube,
          cargoIdentity: tubeRole === "cargo" ? cargoIdentity : "",
          component: String(row.component || "Component"),
          perWellVolume: Number(row.volumeUL) || 0,
          baseVolume: totalVolume / multiplier,
          savedPreparedVolume: totalVolume,
          planOveragePercent: Math.max(0, Number(result.overagePercent) || 0),
          unit: "µL",
          plateId: plate.id,
          plateName: plate.name || plate.id,
          planName,
          groupName: String(group.name || cargoIdentity),
          scopeWellIds: Array.isArray(group.wellIds) ? [...group.wellIds] : [],
          protocolSteps: Array.isArray(group.protocolSteps) ? [...group.protocolSteps] : [],
          direction: input.direction === "reverse" ? "reverse" : "forward",
          preset: String(input.preset || "custom"),
          protocolMode: input.protocolMode === "custom" ? "custom" : "preset",
          finalVolumeUL: Number(result.finalVolumeUL) || 0,
          complexVolumeUL: Number(result.complexVolumeUL) || 0,
          cellMediumVolumeUL: Number(result.cellMediumVolumeUL) || 0,
          incubationMinutes: input.protocolMode === "custom" ? null : input.preset === "rnai" ? 5 : null,
        });
      }
    }
    return contributions;
  }

  function protocolNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return String(Math.round((number + Number.EPSILON) * 10000) / 10000);
  }

  function buildTransfectionProtocol({ language = "zh", preset = "rnai", direction = "forward", groupName = "", result } = {}) {
    if (!result || !Array.isArray(result.perWell)) return [];
    const isEnglish = language === "en";
    const tubeRows = (tube) => result.perWell.filter((row) => String(row.tube) === tube && Number.isFinite(Number(row.volumeUL)));
    const tubeText = (tube) => tubeRows(tube).map((row) => `${row.component} ${protocolNumber(row.volumeUL)} µL`).join(isEnglish ? " + " : " ＋ ");
    const prefix = groupName ? `${groupName}：` : "";
    const finalVolume = Number(result.finalVolumeUL);
    const complexVolume = Number(result.complexVolumeUL);
    const cellVolume = Number.isFinite(Number(result.cellMediumVolumeUL)) ? Number(result.cellMediumVolumeUL) : finalVolume - complexVolume;
    if (preset === "rnai") {
      const steps = [
        isEnglish ? `${groupName ? `${groupName}: ` : ""}For each well, prepare tube A with ${tubeText("A")}.` : `${prefix}每孔 A 管加入 ${tubeText("A")}。`,
        isEnglish ? `For each well, prepare tube B with ${tubeText("B")}.` : `每孔 B 管加入 ${tubeText("B")}。`,
        isEnglish ? "Combine tubes A and B and incubate for 5 min at room temperature." : "混合 A、B 管，室温孵育 5 min。",
      ];
      if (direction === "forward") {
        steps.push(
          isEnglish ? `Add ${protocolNumber(cellVolume)} µL culture medium to the attached cells in each well.` : `每孔向已贴壁细胞加入 ${protocolNumber(cellVolume)} µL 培养基。`,
          isEnglish ? `Add ${protocolNumber(complexVolume)} µL of the A+B complex to the attached cells in each well.` : `每孔向已贴壁细胞加入 ${protocolNumber(complexVolume)} µL A+B 复合物。`,
        );
      } else {
        steps.push(
          isEnglish ? `Add ${protocolNumber(complexVolume)} µL of the A+B complex to each well first.` : `每孔先加入 ${protocolNumber(complexVolume)} µL A+B 复合物。`,
          isEnglish ? `Then add ${protocolNumber(cellVolume)} µL cell suspension to each well.` : `随后每孔加入 ${protocolNumber(cellVolume)} µL 细胞悬液。`,
        );
      }
      return steps;
    }
    const tubeNames = [...new Set(result.perWell.map((row) => String(row.tube || "Tube")))];
    const steps = tubeNames.map((tube) => isEnglish ? `For each well, prepare tube ${tube} with ${tubeText(tube)}.` : `每孔 ${tube} 管加入 ${tubeText(tube)}。`);
    steps.push(isEnglish ? "Combine the premix tubes and incubate according to the reagent instructions." : "混合各预混管，并按所用试剂说明书完成孵育。");
    if (direction === "forward") steps.push(isEnglish ? `Add ${protocolNumber(complexVolume)} µL complex to attached cells in each well.` : `正向转染：每孔向已贴壁细胞加入 ${protocolNumber(complexVolume)} µL 复合物。`);
    else steps.push(isEnglish ? `Add ${protocolNumber(complexVolume)} µL complex first, then ${protocolNumber(cellVolume)} µL cell suspension per well.` : `反向转染：每孔先加入 ${protocolNumber(complexVolume)} µL 复合物，再加入 ${protocolNumber(cellVolume)} µL 细胞悬液。`);
    return steps;
  }

  function safeDisplayLabel(value) {
    const label = String(value || "").trim();
    if (!label || /^(?:transfection|basic|serial|drug):/i.test(label) || /\{["']?[A-Za-z]/.test(label)) return "";
    return label;
  }

  function orderFor(group) {
    const direct = Number(group?.displayOrder);
    if (Number.isFinite(direct)) return direct;
    const sourceOrders = (group?.sources || []).map((source) => Number(source?.displayOrder)).filter(Number.isFinite);
    return sourceOrders.length ? Math.min(...sourceOrders) : Number.MAX_SAFE_INTEGER;
  }

  function uniqueSources(sources = []) {
    const seen = new Set();
    return sources.filter((source) => {
      const key = `${source?.plateId || ""}\u0000${source?.planName || ""}\u0000${source?.groupName || ""}\u0000${(source?.scopeWellIds || []).join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((source) => ({ ...source, scopeWellIds: [...(source.scopeWellIds || [])] }));
  }

  function sourceWellCount(sources = []) {
    return uniqueSources(sources).reduce((sum, source) => sum + (source.scopeWellIds || []).length, 0);
  }

  function targetText(sources = [], isEnglish = false) {
    return uniqueSources(sources).map((source) => `${source.plateName || source.plateId}: ${(source.scopeWellIds || []).join(", ")}`).join(isEnglish ? "; " : "；");
  }

  function componentText(components = [], isEnglish = false) {
    return components.map((component) => `${component.name} ${protocolNumber(component.perWellVolume)} µL`).join(isEnglish ? " + " : " ＋ ");
  }

  function buildTransfectionExecutionPlan({ groups = [], language = "zh" } = {}) {
    const isEnglish = language === "en";
    const valid = (groups || []).filter((group) => group?.module === "transfection" || ["cargo", "common"].includes(group?.tubeRole));
    const cargoGroups = valid.filter((group) => group.tubeRole === "cargo" && safeDisplayLabel(group.label)).sort((a, b) => orderFor(a) - orderFor(b));
    const commonGroups = valid.filter((group) => group.tubeRole === "common" && safeDisplayLabel(group.label)).sort((a, b) => orderFor(a) - orderFor(b));
    const preparationFor = (group) => ({
      role: group.tubeRole,
      label: safeDisplayLabel(group.label),
      cargoIdentity: safeDisplayLabel(group.cargoIdentity) || (group.tubeRole === "cargo" ? safeDisplayLabel(group.label).replace(/\s*[·•]\s*[^·•]+$/, "") : ""),
      components: (group.components || []).map((component) => ({ ...component })),
      sources: uniqueSources(group.sources || []),
      wellCount: sourceWellCount(group.sources || []),
      warning: (group.components || []).some((component) => component.warning) ? "below-minimum-pipette-volume" : "",
      compatibilityKey: group.compatibilityKey || "",
      operationCompatibilityKey: group.operationCompatibilityKey || group.compatibilityKey || "",
      tube: safeDisplayLabel(group.tube),
    });
    const preparations = [...cargoGroups.map(preparationFor), ...commonGroups.map(preparationFor)];
    const steps = [];
    const pushStep = (step) => steps.push({ sequence: steps.length + 1, ...step });
    for (const item of preparations.filter((entry) => entry.role === "cargo")) {
      pushStep({
        phase: "prepare-cargo", cargoIdentity: item.cargoIdentity, label: item.label, sources: item.sources,
        action: isEnglish ? `Prepare ${item.label}: ${componentText(item.components, true)} per well.` : `准备 ${item.label}：每孔 ${componentText(item.components, false)}。`,
        perWellVolume: item.components.reduce((sum, component) => sum + (Number(component.perWellVolume) || 0), 0),
        target: targetText(item.sources, isEnglish),
      });
    }
    for (const item of preparations.filter((entry) => entry.role === "common")) {
      pushStep({
        phase: "prepare-common", cargoIdentity: "", label: item.label, sources: item.sources,
        action: isEnglish ? `Prepare shared ${item.label}: ${componentText(item.components, true)} per well.` : `准备公共液 ${item.label}：每孔 ${componentText(item.components, false)}。`,
        perWellVolume: item.components.reduce((sum, component) => sum + (Number(component.perWellVolume) || 0), 0),
        target: targetText(item.sources, isEnglish),
      });
    }
    for (const cargo of preparations.filter((entry) => entry.role === "cargo")) {
      const source = cargo.sources[0] || {};
      const compatibleCommon = preparations.filter((entry) => entry.role === "common" && (!cargo.operationCompatibilityKey || entry.operationCompatibilityKey === cargo.operationCompatibilityKey));
      const commonNames = compatibleCommon.map((entry) => entry.label).join(isEnglish ? ", " : "、");
      const incubation = Number(source.incubationMinutes);
      const incubationText = Number.isFinite(incubation) && incubation > 0
        ? (isEnglish ? ` and incubate for ${protocolNumber(incubation)} min at room temperature` : `，室温孵育 ${protocolNumber(incubation)} min`)
        : (isEnglish ? " and incubate according to the saved protocol" : "，并按已保存方案孵育");
      pushStep({
        phase: "combine-incubate", cargoIdentity: cargo.cargoIdentity, label: cargo.label, sources: cargo.sources,
        action: isEnglish ? `Combine ${cargo.label}${commonNames ? ` with ${commonNames}` : ""}${incubationText}.` : `将 ${cargo.label}${commonNames ? ` 与 ${commonNames}` : ""}混合${incubationText}。`,
        perWellVolume: Number(source.complexVolumeUL) || 0,
        target: targetText(cargo.sources, isEnglish),
      });
    }
    const batches = new Map();
    for (const cargo of preparations.filter((entry) => entry.role === "cargo")) {
      const source = cargo.sources[0] || {};
      const key = `${cargo.operationCompatibilityKey}\u0000${source.direction || "forward"}\u0000${Number(source.cellMediumVolumeUL) || 0}`;
      if (!batches.has(key)) batches.set(key, { direction: source.direction === "reverse" ? "reverse" : "forward", cellMediumVolumeUL: Number(source.cellMediumVolumeUL) || 0, cargos: [] });
      batches.get(key).cargos.push(cargo);
    }
    for (const batch of batches.values()) {
      const allSources = uniqueSources(batch.cargos.flatMap((cargo) => cargo.sources));
      if (batch.direction === "forward") {
        pushStep({
          phase: "add-medium", cargoIdentity: "", label: isEnglish ? "Culture medium" : "培养基", sources: allSources,
          action: isEnglish ? `Add ${protocolNumber(batch.cellMediumVolumeUL)} µL culture medium to attached cells in every target well.` : `向所有目标孔的已贴壁细胞每孔加入 ${protocolNumber(batch.cellMediumVolumeUL)} µL 培养基。`,
          perWellVolume: batch.cellMediumVolumeUL, target: targetText(allSources, isEnglish),
        });
      }
      for (const cargo of batch.cargos) {
        const volume = Number(cargo.sources[0]?.complexVolumeUL) || 0;
        pushStep({
          phase: "add-complex", cargoIdentity: cargo.cargoIdentity, label: cargo.label, sources: cargo.sources,
          action: isEnglish ? `Add ${protocolNumber(volume)} µL ${cargo.cargoIdentity || cargo.label} complex to each mapped well.` : `向对应孔每孔加入 ${protocolNumber(volume)} µL ${cargo.cargoIdentity || cargo.label} 复合物。`,
          perWellVolume: volume, target: targetText(cargo.sources, isEnglish),
        });
      }
      if (batch.direction === "reverse") {
        pushStep({
          phase: "add-cells", cargoIdentity: "", label: isEnglish ? "Cell suspension" : "细胞悬液", sources: allSources,
          action: isEnglish ? `Add ${protocolNumber(batch.cellMediumVolumeUL)} µL cell suspension to every target well.` : `向所有目标孔每孔加入 ${protocolNumber(batch.cellMediumVolumeUL)} µL 细胞悬液。`,
          perWellVolume: batch.cellMediumVolumeUL, target: targetText(allSources, isEnglish),
        });
      }
    }
    return { version: EXECUTION_PLAN_VERSION, preparations, steps };
  }

  function buildExecutionGroupsFromContributions(contributions = []) {
    const groups = new Map();
    for (const item of contributions || []) {
      if (item?.module !== "transfection" || !["cargo", "common"].includes(item.tubeRole)) continue;
      const key = String(item.groupKey || `${item.tubeRole}:${item.cargoIdentity || ""}:${item.tube || ""}:${item.compatibilityKey || ""}`);
      if (!groups.has(key)) groups.set(key, {
        key,
        module: "transfection",
        label: item.groupLabel,
        tubeRole: item.tubeRole,
        tube: item.tube,
        cargoIdentity: item.cargoIdentity || "",
        compatibilityKey: item.compatibilityKey || "",
        operationCompatibilityKey: item.operationCompatibilityKey || item.compatibilityKey || "",
        displayOrder: Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : Number.MAX_SAFE_INTEGER,
        components: [],
        sources: [],
      });
      const group = groups.get(key);
      group.displayOrder = Math.min(group.displayOrder, Number.isFinite(Number(item.displayOrder)) ? Number(item.displayOrder) : Number.MAX_SAFE_INTEGER);
      const componentName = String(item.component || "Component");
      let component = group.components.find((entry) => entry.name === componentName);
      if (!component) {
        component = { name: componentName, perWellVolume: Number(item.perWellVolume) || 0, baseVolume: 0, preparedVolume: 0, containerCount: 1, warning: false };
        group.components.push(component);
      }
      component.baseVolume += Number(item.baseVolume) || 0;
      component.preparedVolume += Number(item.savedPreparedVolume ?? item.preparedVolume) || 0;
      component.containerCount = Math.max(component.containerCount, Number(item.containerCount) || 1);
      component.warning ||= Boolean(item.warning);
      group.sources.push({
        plateId: item.plateId,
        plateName: item.plateName,
        planName: item.planName,
        groupName: item.groupName,
        scopeWellIds: [...(item.scopeWellIds || [])],
        displayOrder: item.displayOrder,
        direction: item.direction,
        preset: item.preset,
        protocolMode: item.protocolMode,
        protocolSteps: [...(item.protocolSteps || [])],
        finalVolumeUL: item.finalVolumeUL,
        complexVolumeUL: item.complexVolumeUL,
        cellMediumVolumeUL: item.cellMediumVolumeUL,
        incubationMinutes: item.incubationMinutes,
      });
    }
    return [...groups.values()];
  }

  function buildTransfectionExecutionPlanFromContributions({ contributions = [], language = "zh" } = {}) {
    return buildTransfectionExecutionPlan({ groups: buildExecutionGroupsFromContributions(contributions), language });
  }

  return { EXECUTION_PLAN_VERSION, stableRecipeInput, preparationCompatibility, buildTransfectionContributions, buildTransfectionProtocol, buildExecutionGroupsFromContributions, buildTransfectionExecutionPlanFromContributions, buildTransfectionExecutionPlan, safeDisplayLabel };
});
