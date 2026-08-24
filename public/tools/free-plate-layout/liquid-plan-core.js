(function attachLiquidPlanCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LiquidPlanCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiquidPlanCore() {
  "use strict";

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

  function cargoIdentityFor(group) {
    const names = [...new Set((group?.result?.cargos || []).map((cargo) => String(cargo?.name || "").trim()).filter(Boolean))];
    return names.join(" + ") || String(group?.name || "Unnamed cargo").trim();
  }

  function buildTransfectionContributions({ input = {}, plate, planName = "Transfection", groups = [] } = {}) {
    if (!plate?.id) throw new Error("A plate identity is required.");
    const compatibility = stableStringify(stableRecipeInput(input));
    const contributions = [];
    for (const group of groups || []) {
      const cargoIdentity = cargoIdentityFor(group);
      const result = group?.result || {};
      const multiplier = 1 + Math.max(0, Number(result.overagePercent) || 0) / 100;
      for (const row of result.totals || []) {
        const totalVolume = Number(row.totalVolumeUL);
        if (!Number.isFinite(totalVolume) || totalVolume < 0) continue;
        const tubeRole = row.tubeRole === "cargo" || row.cargoDependent === true ? "cargo" : "common";
        const tube = String(row.tube || "Tube").trim();
        const groupKey = tubeRole === "cargo"
          ? `transfection:cargo:${cargoIdentity}:${tube}:${compatibility}`
          : `transfection:common:${tube}:${compatibility}`;
        contributions.push({
          groupKey,
          groupLabel: tubeRole === "cargo" ? `${cargoIdentity} · ${tube}` : `${planName} · ${tube}`,
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

  return { stableRecipeInput, buildTransfectionContributions, buildTransfectionProtocol };
});
