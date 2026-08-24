(function attachLiquidCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LiquidCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiquidCore() {
  "use strict";

  const VOLUME_TO_UL = Object.freeze({ nL: 0.001, "µL": 1, uL: 1, mL: 1000, L: 1000000 });
  const MASS_TO_NG = Object.freeze({ ng: 1, "µg": 1000, ug: 1000, mg: 1000000, g: 1000000000 });
  const AMOUNT_TO_PMOL = Object.freeze({ fmol: 0.001, pmol: 1, nmol: 1000, "µmol": 1000000, umol: 1000000 });
  const MOLAR_TO_NM = Object.freeze({ nM: 1, "µM": 1000, uM: 1000, mM: 1000000, M: 1000000000 });
  const MASS_CONC_TO_NG_UL = Object.freeze({ "ng/µL": 1, "ng/uL": 1, "µg/mL": 1, "ug/mL": 1, "µg/µL": 1000, "ug/uL": 1000, "mg/mL": 1000 });

  function finite(value, name, { min = -Infinity, allowZero = true } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || (!allowZero && number === 0)) {
      throw new Error(`${name} must be a valid number${min >= 0 ? ` ≥ ${min}` : ""}.`);
    }
    return number;
  }

  function convert(value, unit, factors, name) {
    const factor = factors[unit];
    if (!factor) throw new Error(`Unsupported ${name} unit: ${unit}`);
    return finite(value, name, { min: 0 }) * factor;
  }

  function volumeToUL(value, unit = "µL") { return convert(value, unit, VOLUME_TO_UL, "volume"); }
  function massToNg(value, unit = "ng") { return convert(value, unit, MASS_TO_NG, "mass"); }
  function amountToPmol(value, unit = "pmol") { return convert(value, unit, AMOUNT_TO_PMOL, "amount"); }

  function concentrationToBase(value, unit, kind) {
    if (kind === "molar") return convert(value, unit, MOLAR_TO_NM, "molar concentration");
    if (kind === "mass") return convert(value, unit, MASS_CONC_TO_NG_UL, "mass concentration");
    if (kind === "percent-vv" || kind === "percent-wv") return finite(value, "percentage", { min: 0 });
    throw new Error(`Unsupported concentration kind: ${kind}`);
  }

  function withOverage(value, overagePercent = 0) {
    return value * (1 + finite(overagePercent, "overage", { min: 0 }) / 100);
  }

  function round(value, digits = 4) {
    const precision = Math.max(0, Math.min(12, Number(digits) || 0));
    return Number(Number(value).toFixed(precision));
  }

  function calculateDilution(options) {
    const kind = options.kind || "molar";
    const stock = concentrationToBase(options.stockConcentration, options.stockUnit, kind);
    const target = concentrationToBase(options.targetConcentration, options.targetUnit, kind);
    if (stock <= 0 || target < 0 || target > stock) throw new Error("Target concentration must be between 0 and the stock concentration.");
    const requestedVolumeUL = options.totalVolume !== undefined
      ? volumeToUL(options.totalVolume, options.volumeUnit || "µL")
      : volumeToUL(options.perWellVolume, options.perWellUnit || "µL") * finite(options.wellCount, "well count", { min: 1, allowZero: false });
    const preparedVolumeUL = withOverage(requestedVolumeUL, options.overagePercent ?? 10);
    const stockVolumeUL = stock === 0 ? 0 : preparedVolumeUL * target / stock;
    return {
      kind,
      requestedVolumeUL: round(requestedVolumeUL),
      preparedVolumeUL: round(preparedVolumeUL),
      stockVolumeUL: round(stockVolumeUL),
      diluentVolumeUL: round(preparedVolumeUL - stockVolumeUL),
      overagePercent: finite(options.overagePercent ?? 10, "overage", { min: 0 }),
    };
  }

  function calculateFixedRatioPreparation(options) {
    const meaning = options.meaning === "final" ? "final" : "extra";
    const volumeMode = options.volumeMode === "total" ? "total" : "per-well";
    const requestedVolumeUL = volumeToUL(options.baseVolume, options.baseUnit || "µL");
    if (requestedVolumeUL <= 0) throw new Error("Requested volume must be greater than zero.");
    const wellCount = volumeMode === "per-well" ? finite(options.wellCount, "well count", { min: 1, allowZero: false }) : 1;
    const overagePercent = finite(options.overagePercent ?? 10, "overage", { min: 0 });
    const equivalentWells = volumeMode === "per-well" ? withOverage(wellCount, overagePercent) : withOverage(1, overagePercent);
    const reagents = (options.reagents || []).map((reagent, index) => {
      const name = String(reagent.name || "").trim();
      if (!name) throw new Error(`Reagent ${index + 1} needs a name.`);
      const referenceVolumeUL = volumeToUL(reagent.referenceVolume, reagent.referenceUnit || "µL");
      const reagentVolumeUL = volumeToUL(reagent.reagentVolume, reagent.reagentUnit || "µL");
      if (referenceVolumeUL <= 0 || reagentVolumeUL <= 0) throw new Error(`Reagent ${index + 1} ratio volumes must be greater than zero.`);
      return { name, fraction: reagentVolumeUL / referenceVolumeUL, normalizedRatio: referenceVolumeUL / reagentVolumeUL };
    });
    if (!reagents.length) throw new Error("At least one reagent is required.");
    const totalFraction = reagents.reduce((sum, reagent) => sum + reagent.fraction, 0);
    if (meaning === "final" && totalFraction >= 1) throw new Error("The total reagent fraction must be less than 100% of the final mixture.");

    const theoreticalReagents = reagents.map((reagent) => ({ ...reagent, volumeUL: requestedVolumeUL * reagent.fraction }));
    const theoreticalMediumUL = meaning === "extra" ? requestedVolumeUL : requestedVolumeUL * (1 - totalFraction);
    const theoreticalFinalUL = meaning === "extra" ? requestedVolumeUL * (1 + totalFraction) : requestedVolumeUL;
    const scale = equivalentWells;
    const rawBatchReagents = theoreticalReagents.map((reagent) => ({ ...reagent, volumeUL: reagent.volumeUL * scale }));
    let batchMediumUL = theoreticalMediumUL * scale;
    const batchFinalUL = theoreticalFinalUL * scale;
    const minimum = volumeToUL(options.minimumPipetteVolume ?? 1, options.minimumPipetteUnit || "µL");
    const workingSolutions = [];
    const batchReagents = rawBatchReagents.map((reagent) => {
      if (!(reagent.volumeUL > 0 && reagent.volumeUL < minimum)) return reagent;
      const dilutionFactor = Math.max(2, Math.ceil(minimum / reagent.volumeUL));
      const applied = options.applyWorkingSolutions === true;
      const transferVolumeUL = reagent.volumeUL * dilutionFactor;
      const transferredDiluentUL = reagent.volumeUL * (dilutionFactor - 1);
      const stockForWorkingSolutionUL = minimum;
      const diluentForWorkingSolutionUL = minimum * (dilutionFactor - 1);
      workingSolutions.push({ name: reagent.name, dilutionFactor, originalVolumeUL: round(reagent.volumeUL), transferVolumeUL: round(transferVolumeUL), stockForWorkingSolutionUL: round(stockForWorkingSolutionUL), diluentForWorkingSolutionUL: round(diluentForWorkingSolutionUL), preparedWorkingSolutionUL: round(stockForWorkingSolutionUL + diluentForWorkingSolutionUL), applied });
      if (applied) {
        batchMediumUL -= transferredDiluentUL;
        return { ...reagent, name: `${reagent.name} working solution`, volumeUL: transferVolumeUL, originalReagentVolumeUL: reagent.volumeUL };
      }
      return reagent;
    });
    if (batchMediumUL < -1e-9) throw new Error("The confirmed working solution requires more diluent than the available medium volume.");

    const nameCounts = new Map();
    reagents.forEach((reagent) => nameCounts.set(reagent.name.toLowerCase(), (nameCounts.get(reagent.name.toLowerCase()) || 0) + 1));
    const warnings = [...nameCounts].filter(([, count]) => count > 1).map(([name]) => ({ code: "duplicate-name", name }));
    workingSolutions.forEach((working) => warnings.push({ code: "small-volume", name: working.name, volumeUL: working.originalVolumeUL, dilutionFactor: working.dilutionFactor, applied: working.applied }));

    const theoretical = {
      mediumVolumeUL: round(theoreticalMediumUL),
      reagents: theoreticalReagents.map((reagent) => ({ ...reagent, volumeUL: round(reagent.volumeUL) })),
      finalVolumeUL: round(theoreticalFinalUL),
    };
    const batch = {
      mediumVolumeUL: round(Math.max(0, batchMediumUL)),
      reagents: batchReagents.map((reagent) => ({ ...reagent, volumeUL: round(reagent.volumeUL) })),
      finalVolumeUL: round(batchFinalUL),
    };
    const componentSum = batch.mediumVolumeUL + batch.reagents.reduce((sum, reagent) => sum + reagent.volumeUL, 0);
    if (Math.abs(componentSum - batch.finalVolumeUL) > 0.01) throw new Error("Component volumes do not sum to the reported final volume.");
    return { meaning, volumeMode, requestedVolumeUL: round(requestedVolumeUL), wellCount, equivalentWells: round(equivalentWells), overagePercent, theoretical, batch, workingSolutions, warnings };
  }

  function calculateSolutionMass(options) {
    const kind = options.kind || "mass";
    const preparedVolumeUL = withOverage(volumeToUL(options.totalVolume, options.volumeUnit || "mL"), options.overagePercent ?? 10);
    const purity = finite(options.purityPercent ?? 100, "purity", { min: 0, allowZero: false }) / 100;
    let massNg;
    if (kind === "mass") {
      const targetNgUL = concentrationToBase(options.targetConcentration, options.targetUnit, "mass");
      massNg = targetNgUL * preparedVolumeUL / purity;
    } else {
      const targetNM = concentrationToBase(options.targetConcentration, options.targetUnit, "molar");
      const molecularWeight = finite(options.molecularWeight, "molecular weight", { min: 0, allowZero: false });
      const moles = targetNM * 1e-9 * preparedVolumeUL * 1e-6;
      massNg = moles * molecularWeight * 1e9 / purity;
    }
    return { preparedVolumeUL: round(preparedVolumeUL), massNg: round(massNg), purityPercent: round(purity * 100) };
  }

  function calculateCargoPerWell(cargo, finalVolumeUL) {
    const mode = cargo.targetMode || (cargo.type === "siRNA" ? "final-concentration" : "mass-per-well");
    if (cargo.type === "siRNA" && mode !== "mass-per-well") {
      const stockPmolUL = concentrationToBase(cargo.stockConcentration, cargo.stockUnit || "µM", "molar") / 1000;
      let pmol;
      if (mode === "final-concentration") {
        const finalNM = concentrationToBase(cargo.targetValue, cargo.targetUnit || "nM", "molar");
        pmol = finalNM * finalVolumeUL / 1000;
      } else {
        pmol = amountToPmol(cargo.targetValue, cargo.targetUnit || "pmol");
      }
      return { name: cargo.name || "siRNA", type: "siRNA", amountPmol: pmol, stockVolumeUL: pmol / stockPmolUL };
    }
    if (mode === "final-concentration") {
      const finalNM = concentrationToBase(cargo.targetValue, cargo.targetUnit || "nM", "molar");
      const amountPmol = finalNM * finalVolumeUL / 1000;
      if (MOLAR_TO_NM[cargo.stockUnit]) {
        const stockPmolUL = concentrationToBase(cargo.stockConcentration, cargo.stockUnit, "molar") / 1000;
        const result = { name: cargo.name || "Cargo", type: cargo.type || "other", amountPmol, stockVolumeUL: amountPmol / stockPmolUL };
        if (cargo.molecularWeight || cargo.lengthBp) {
          const molecularWeight = cargo.molecularWeight
            ? finite(cargo.molecularWeight, "molecular weight", { min: 0, allowZero: false })
            : finite(cargo.lengthBp, "cargo length", { min: 1, allowZero: false }) * 660;
          result.massNg = amountPmol * molecularWeight / 1000;
        }
        return result;
      }
      const molecularWeight = cargo.molecularWeight
        ? finite(cargo.molecularWeight, "molecular weight", { min: 0, allowZero: false })
        : finite(cargo.lengthBp, "cargo length", { min: 1, allowZero: false }) * 660;
      const massNg = amountPmol * molecularWeight / 1000;
      const stockNgUL = concentrationToBase(cargo.stockConcentration, cargo.stockUnit || "ng/µL", "mass");
      return { name: cargo.name || "Cargo", type: cargo.type || "other", amountPmol, massNg, stockVolumeUL: massNg / stockNgUL };
    }
    if (mode === "pmol-per-well") {
      const pmol = amountToPmol(cargo.targetValue, cargo.targetUnit || "pmol");
      const molecularWeight = cargo.molecularWeight
        ? finite(cargo.molecularWeight, "molecular weight", { min: 0, allowZero: false })
        : finite(cargo.lengthBp, "cargo length", { min: 1, allowZero: false }) * 660;
      const massNg = pmol * molecularWeight / 1000;
      const stockNgUL = concentrationToBase(cargo.stockConcentration, cargo.stockUnit || "ng/µL", "mass");
      return { name: cargo.name || "Cargo", type: cargo.type || "other", amountPmol: pmol, massNg, stockVolumeUL: massNg / stockNgUL };
    }
    const stockNgUL = concentrationToBase(cargo.stockConcentration, cargo.stockUnit || "ng/µL", "mass");
    const massNg = massToNg(cargo.targetValue, cargo.targetUnit || "ng");
    const result = { name: cargo.name || "Plasmid", type: cargo.type || "plasmid", massNg, stockVolumeUL: massNg / stockNgUL };
    if (cargo.lengthBp) {
      const molecularWeight = finite(cargo.lengthBp, "plasmid length", { min: 1, allowZero: false }) * 660;
      result.amountPmol = massNg * 1000 / molecularWeight;
    }
    return result;
  }

  function resolveCargoTargets(cargos, options) {
    const resolved = (cargos || []).map((cargo) => ({ ...cargo }));
    const massRatios = resolved.filter((cargo) => cargo.targetMode === "mass-ratio");
    if (massRatios.length) {
      const totalMassNg = massToNg(options.totalCargoMass, options.totalCargoMassUnit || "ng");
      const ratioTotal = massRatios.reduce((sum, cargo) => sum + finite(cargo.targetValue, `${cargo.name || "cargo"} mass ratio`, { min: 0, allowZero: false }), 0);
      massRatios.forEach((cargo) => {
        cargo.targetMode = "mass-per-well";
        cargo.targetValue = totalMassNg * Number(cargo.targetValue) / ratioTotal;
        cargo.targetUnit = "ng";
      });
    }
    const molarRatios = resolved.filter((cargo) => cargo.targetMode === "molar-ratio");
    if (molarRatios.length) {
      const totalPmol = amountToPmol(options.totalCargoAmount, options.totalCargoAmountUnit || "pmol");
      const ratioTotal = molarRatios.reduce((sum, cargo) => sum + finite(cargo.targetValue, `${cargo.name || "cargo"} molar ratio`, { min: 0, allowZero: false }), 0);
      molarRatios.forEach((cargo) => {
        cargo.targetMode = "pmol-per-well";
        cargo.targetValue = totalPmol * Number(cargo.targetValue) / ratioTotal;
        cargo.targetUnit = "pmol";
      });
    }
    return resolved;
  }

  function calculateGenericTransfection(options) {
    const wellCount = finite(options.wellCount, "well count", { min: 1, allowZero: false });
    const overagePercent = finite(options.overagePercent ?? 10, "overage", { min: 0 });
    const equivalents = withOverage(wellCount, overagePercent);
    const finalVolumeUL = volumeToUL(options.finalVolume ?? 300, options.finalVolumeUnit || "µL");
    const complexVolumeUL = volumeToUL(options.complexVolume ?? 30, options.complexVolumeUnit || "µL");
    const minimum = volumeToUL(options.minimumPipetteVolume ?? 1, options.minimumPipetteUnit || "µL");
    const cargos = resolveCargoTargets(options.cargos, options).map((cargo) => calculateCargoPerWell(cargo, finalVolumeUL));
    const cargoByName = new Map(cargos.map((cargo) => [cargo.name, cargo]));
    const selectCargos = (reference) => {
      if (["all", "all-cargos"].includes(reference)) return cargos;
      if (reference === "all-siRNA") return cargos.filter((cargo) => cargo.type === "siRNA");
      if (reference === "all-plasmid") return cargos.filter((cargo) => cargo.type === "plasmid");
      if (String(reference || "").includes("+")) {
        const names = String(reference).split("+").map((name) => name.trim()).filter(Boolean);
        const selected = names.map((name) => cargoByName.get(name));
        return names.length && selected.every(Boolean) ? selected : [];
      }
      const cargo = cargoByName.get(reference);
      return cargo ? [cargo] : [];
    };
    const collectionName = (reference, selected) => {
      if (reference === "all-plasmid") return "All plasmid cargoes";
      if (reference === "all-siRNA") return "All siRNA cargoes";
      if (["all", "all-cargos"].includes(reference)) return "All cargoes";
      return selected.length > 1 ? selected.map((cargo) => cargo.name).join(" + ") : selected[0]?.name;
    };
    const workingSolutions = [];
    const perWell = [];

    for (const tube of options.tubes || []) {
      const tubeName = String(tube.name || `Tube ${perWell.length + 1}`);
      const targetVolumeUL = volumeToUL(tube.volumePerWell, tube.volumeUnit || "µL");
      const tubeRows = [];
      const cargoDependentTube = (tube.components || []).some((component) => ["cargo", "ratio-per-ug", "ratio-per-mass", "ratio-per-pmol", "ratio-volume"].includes(component.kind));
      for (const component of tube.components || []) {
        if (component.kind === "diluent") continue;
        let componentName = component.name || "Component";
        let volumeUL;
        if (component.kind === "cargo") {
          const selected = selectCargos(component.cargoName);
          if (!selected.length) throw new Error(`Unknown cargo in tube ${tubeName}: ${component.cargoName}`);
          componentName = collectionName(component.cargoName, selected);
          volumeUL = selected.reduce((sum, cargo) => sum + cargo.stockVolumeUL, 0);
        } else if (["ratio-per-ug", "ratio-per-mass"].includes(component.kind)) {
          const selected = selectCargos(component.cargoName);
          if (!selected.length || selected.some((cargo) => !Number.isFinite(cargo.massNg))) throw new Error(`${componentName} requires a mass-based cargo reference.`);
          volumeUL = selected.reduce((sum, cargo) => sum + cargo.massNg, 0) / 1000 * finite(component.ratio, `${componentName} ratio`, { min: 0 });
        } else if (component.kind === "ratio-per-pmol") {
          const selected = selectCargos(component.cargoName);
          if (!selected.length || selected.some((cargo) => !Number.isFinite(cargo.amountPmol))) throw new Error(`${componentName} requires a molar cargo reference.`);
          volumeUL = selected.reduce((sum, cargo) => sum + cargo.amountPmol, 0) * finite(component.ratio, `${componentName} ratio`, { min: 0 });
        } else if (component.kind === "ratio-volume") {
          const selected = selectCargos(component.cargoName);
          if (!selected.length) throw new Error(`${componentName} requires a cargo reference.`);
          volumeUL = selected.reduce((sum, cargo) => sum + cargo.stockVolumeUL, 0) * finite(component.ratio, `${componentName} ratio`, { min: 0 });
        } else {
          volumeUL = volumeToUL(component.volumePerWell, component.volumeUnit || "µL");
        }
        const originalVolumeUL = volumeUL;
        const totalVolumeUL = originalVolumeUL * equivalents;
        const dilutionAllowed = component.dilutionAllowed !== false;
        if (totalVolumeUL > 0 && totalVolumeUL < minimum && dilutionAllowed) {
          const dilutionFactor = Math.max(2, Math.ceil(minimum / totalVolumeUL));
          const applied = options.applyWorkingSolutions === true;
          workingSolutions.push({
            tube: tubeName,
            component: componentName,
            dilutionFactor,
            originalTransferUL: round(totalVolumeUL),
            workingTransferUL: round(totalVolumeUL * dilutionFactor),
            stockForWorkingSolutionUL: round(minimum),
            diluentForWorkingSolutionUL: round(minimum * (dilutionFactor - 1)),
            applied,
          });
          if (applied) {
            volumeUL *= dilutionFactor;
            componentName = `${componentName} working solution`;
          }
        }
        tubeRows.push({
          tube: tubeName,
          component: componentName,
          volumeUL,
          dilutionAllowed,
          originalVolumeUL,
          cargoDependent: cargoDependentTube,
          tubeRole: cargoDependentTube ? "cargo" : "common",
        });
      }
      const usedVolumeUL = tubeRows.reduce((sum, row) => sum + row.volumeUL, 0);
      if (usedVolumeUL > targetVolumeUL + 1e-9) throw new Error(`Components exceed the target volume of tube ${tubeName}.`);
      const diluent = (tube.components || []).find((component) => component.kind === "diluent");
      if (targetVolumeUL - usedVolumeUL > 1e-9 && !diluent) throw new Error(`Tube ${tubeName} needs a diluent component.`);
      perWell.push(...tubeRows);
      if (diluent) perWell.push({ tube: tubeName, component: diluent.name || "Diluent", volumeUL: targetVolumeUL - usedVolumeUL, dilutionAllowed: true, cargoDependent: cargoDependentTube, tubeRole: cargoDependentTube ? "cargo" : "common" });
    }
    const totalTubeVolume = perWell.reduce((sum, row) => sum + row.volumeUL, 0);
    if (Math.abs(totalTubeVolume - complexVolumeUL) > 1e-6) throw new Error("Premix tube volumes do not add up to the configured complex volume.");
    const normalizedPerWell = perWell.map((row) => ({ ...row, volumeUL: round(row.volumeUL) }));
    const totals = normalizedPerWell.map((row) => ({ ...row, totalVolumeUL: round(row.volumeUL * equivalents) }));
    const warnings = totals.filter((row) => row.totalVolumeUL > 0 && row.totalVolumeUL < minimum).map((row) => ({ component: row.component, volumeUL: row.totalVolumeUL, dilutionAllowed: row.dilutionAllowed }));
    return {
      preset: options.preset || "custom",
      direction: options.direction || "reverse",
      wellCount,
      equivalents: round(equivalents),
      overagePercent,
      finalVolumeUL,
      complexVolumeUL,
      cellMediumVolumeUL: round(finalVolumeUL - complexVolumeUL),
      cargos,
      perWell: normalizedPerWell,
      totals,
      warnings,
      workingSolutions,
    };
  }

  function calculateRnaiMaxTransfection(options) {
    const complexVolume = options.complexVolume ?? 30;
    const result = calculateGenericTransfection({
      ...options,
      preset: "rnai-max-sirna",
      finalVolume: options.finalVolume ?? 300,
      complexVolume,
      cargos: [{ name: options.cargoName || "siRNA", type: "siRNA", stockConcentration: options.stockConcentration ?? 10, stockUnit: options.stockUnit || "µM", targetMode: options.targetMode || "final-concentration", targetValue: options.targetValue ?? 10, targetUnit: options.targetUnit || "nM" }],
      tubes: [
        { name: "A", volumePerWell: Number(complexVolume) / 2, components: [{ kind: "cargo", cargoName: options.cargoName || "siRNA" }, { kind: "diluent", name: options.diluentName || "Opti-MEM" }] },
        { name: "B", volumePerWell: Number(complexVolume) / 2, components: [{ kind: "fixed", name: options.reagentName || "RNAiMAX", volumePerWell: options.reagentPerWell ?? 0.9, dilutionAllowed: false }, { kind: "diluent", name: options.diluentName || "Opti-MEM" }] },
      ],
    });
    return { ...result, cargo: result.cargos[0], cellSuspensionVolumeUL: result.cellMediumVolumeUL };
  }

  function calculateLipo3000Transfection(options) {
    const cargoName = options.cargoName || "Plasmid DNA";
    const complexVolume = options.complexVolume ?? 250;
    const result = calculateGenericTransfection({
      ...options,
      preset: "lipo3000-plasmid",
      finalVolume: options.finalVolume ?? 2000,
      complexVolume,
      cargos: [{ name: cargoName, type: "plasmid", stockConcentration: options.stockConcentration ?? 500, stockUnit: options.stockUnit || "ng/µL", targetMode: "mass-per-well", targetValue: options.targetMass ?? 2500, targetUnit: options.targetMassUnit || "ng", lengthBp: options.lengthBp }],
      tubes: [
        { name: "A", volumePerWell: Number(complexVolume) / 2, components: [{ kind: "cargo", cargoName }, { kind: "ratio-per-ug", name: options.enhancerName || "P3000", ratio: options.p3000PerUg ?? 2, cargoName, dilutionAllowed: false }, { kind: "diluent", name: options.diluentName || "Opti-MEM" }] },
        { name: "B", volumePerWell: Number(complexVolume) / 2, components: [{ kind: "fixed", name: options.reagentName || "Lipofectamine 3000", volumePerWell: options.lipoPerWell ?? 3.75, dilutionAllowed: false }, { kind: "diluent", name: options.diluentName || "Opti-MEM" }] },
      ],
    });
    return { ...result, cargo: result.cargos[0], cellSuspensionVolumeUL: result.cellMediumVolumeUL };
  }

  function commonTransfectionComponents(results) {
    if (!Array.isArray(results) || results.length < 2) return [];
    const first = results[0];
    const compatible = results.every((result) => result.overagePercent === first.overagePercent && result.finalVolumeUL === first.finalVolumeUL && result.complexVolumeUL === first.complexVolumeUL);
    if (!compatible) return [];
    const commonRows = (result) => (result.totals || []).filter((row) => !row.cargoDependent).map((row) => ({ tube: row.tube, component: row.component, volumeUL: row.volumeUL }));
    const signature = JSON.stringify(commonRows(first));
    if (!results.every((result) => JSON.stringify(commonRows(result)) === signature)) return [];
    return commonRows(first).map((row) => `${row.tube}\u0000${row.component}`);
  }

  function generateConcentrationSeries(options) {
    const high = finite(options.high, "highest concentration", { min: 0, allowZero: false });
    const points = Math.floor(finite(options.points, "number of points", { min: 2, allowZero: false }));
    let values;
    if ((options.method || "fold") === "fold") {
      const fold = finite(options.fold ?? 2, "dilution fold", { min: 1, allowZero: false });
      if (fold <= 1) throw new Error("Dilution fold must be greater than 1.");
      values = Array.from({ length: points }, (_, index) => high / (fold ** index));
    } else {
      const low = finite(options.low, "lowest concentration", { min: 0 });
      if (low > high) throw new Error("Lowest concentration cannot exceed highest concentration.");
      if ((options.scale || "log") === "linear") {
        const step = (high - low) / (points - 1);
        values = Array.from({ length: points }, (_, index) => high - step * index);
      } else {
        if (low <= 0) throw new Error("Logarithmic series requires a positive lowest concentration.");
        const ratio = (high / low) ** (1 / (points - 1));
        values = Array.from({ length: points }, (_, index) => high / (ratio ** index));
      }
    }
    if (options.direction === "low-to-high") values.reverse();
    return values.map((value) => round(value, 8));
  }

  function calculateGradientPreparation(options) {
    const concentrations = options.concentrations || generateConcentrationSeries(options);
    const stock = finite(options.stockConcentration, "stock concentration", { min: 0, allowZero: false });
    const requestedVolumeUL = volumeToUL(options.volumePerLevel, options.volumeUnit || "µL");
    const preparedVolumeUL = withOverage(requestedVolumeUL, options.overagePercent ?? 10);
    if (concentrations.some((value) => value > stock)) throw new Error("A target concentration exceeds the stock concentration.");
    if ((options.strategy || "direct") === "serial") {
      const rows = new Array(concentrations.length);
      let downstreamTransferUL = 0;
      for (let index = concentrations.length - 1; index >= 0; index -= 1) {
        const totalVolumeUL = preparedVolumeUL + downstreamTransferUL;
        const sourceConcentration = index === 0 ? stock : concentrations[index - 1];
        const transferVolumeUL = totalVolumeUL * concentrations[index] / sourceConcentration;
        rows[index] = {
          level: index + 1,
          concentration: concentrations[index],
          source: index === 0 ? "stock" : `level-${index}`,
          transferVolumeUL: round(transferVolumeUL),
          diluentVolumeUL: round(totalVolumeUL - transferVolumeUL),
          totalVolumeUL: round(totalVolumeUL),
          retainedVolumeUL: round(preparedVolumeUL),
          downstreamTransferUL: round(downstreamTransferUL),
        };
        downstreamTransferUL = transferVolumeUL;
      }
      return { strategy: "serial", concentrations, requestedVolumeUL, preparedVolumeUL: round(preparedVolumeUL), stockConsumptionUL: round(rows[0]?.transferVolumeUL || 0), rows };
    }
    const rows = concentrations.map((concentration, index) => {
      const stockVolumeUL = preparedVolumeUL * concentration / stock;
      return { level: index + 1, concentration, source: "stock", transferVolumeUL: round(stockVolumeUL), diluentVolumeUL: round(preparedVolumeUL - stockVolumeUL), totalVolumeUL: round(preparedVolumeUL) };
    });
    return { strategy: "direct", concentrations, requestedVolumeUL, preparedVolumeUL: round(preparedVolumeUL), stockConsumptionUL: round(rows.reduce((sum, row) => sum + row.transferVolumeUL, 0)), rows };
  }

  function orderWells(size, wellIds, orientation = "row") {
    const ids = [...wellIds];
    if (orientation !== "column") return ids;
    const rowMajor = ids.map((id) => ({ id, parsed: /^([A-Z]+)(\d+)$/.exec(id) })).filter((entry) => entry.parsed);
    return rowMajor.sort((left, right) => Number(left.parsed[2]) - Number(right.parsed[2]) || left.parsed[1].localeCompare(right.parsed[1])).map((entry) => entry.id);
  }

  function edgeWellIds(wellIds, plateSize) {
    const parsed = wellIds.map((id) => ({ id, match: /^([A-Z]+)(\d+)$/.exec(id) })).filter((item) => item.match);
    if (!parsed.length) return new Set();
    const geometry = { 6: [2, 3], 12: [3, 4], 24: [4, 6], 96: [8, 12], 384: [16, 24] }[Number(plateSize)];
    const rows = parsed.map((item) => item.match[1]);
    const columns = parsed.map((item) => Number(item.match[2]));
    const firstRow = "A";
    const lastRow = geometry ? String.fromCharCode(64 + geometry[0]) : rows.slice().sort().at(-1);
    const firstColumn = 1;
    const lastColumn = geometry ? geometry[1] : Math.max(...columns);
    return new Set(parsed.filter((item) => item.match[1] === firstRow || item.match[1] === lastRow || Number(item.match[2]) === firstColumn || Number(item.match[2]) === lastColumn).map((item) => item.id));
  }

  function calculateDrugDosingPreparation(options) {
    const stock = finite(options.stockConcentration, "stock concentration", { min: 0, allowZero: false });
    const preparationVolumeUL = withOverage(volumeToUL(options.preparationVolume, options.preparationVolumeUnit || "µL"), options.overagePercent ?? 10);
    const dosingVolumeUL = volumeToUL(options.dosingVolume, options.dosingVolumeUnit || "µL");
    const finalWellVolumeUL = volumeToUL(options.finalWellVolume, options.finalWellVolumeUnit || "µL");
    if (dosingVolumeUL <= 0 || dosingVolumeUL > finalWellVolumeUL) throw new Error("Dosing volume must be greater than zero and no larger than the final well volume.");
    const stockVehiclePercent = finite(options.stockVehiclePercent ?? 100, "stock vehicle percentage", { min: 0 });
    const rows = (options.concentrations || []).map((concentration, index) => {
      const dosingSolutionConcentration = finite(concentration, "target concentration", { min: 0 }) * finalWellVolumeUL / dosingVolumeUL;
      if (dosingSolutionConcentration > stock) throw new Error("A dosing solution concentration exceeds the stock concentration.");
      const stockVolumeUL = preparationVolumeUL * dosingSolutionConcentration / stock;
      const stockFraction = stockVolumeUL / preparationVolumeUL;
      return {
        level: index + 1,
        concentration: round(concentration, 8),
        dosingSolutionConcentration: round(dosingSolutionConcentration, 8),
        stockVolumeUL: round(stockVolumeUL),
        diluentVolumeUL: round(preparationVolumeUL - stockVolumeUL),
        totalVolumeUL: round(preparationVolumeUL),
        finalVehiclePercent: round(stockFraction * (stockVehiclePercent / 100) * (dosingVolumeUL / finalWellVolumeUL) * 100, 8),
      };
    });
    return { preparationVolumeUL: round(preparationVolumeUL), dosingVolumeUL, finalWellVolumeUL, rows };
  }

  function planDrugGradientLayout(options) {
    const occupied = new Set(options.occupiedWellIds || []);
    const ordered = orderWells(options.plateSize, options.wellIds || [], options.orientation);
    const edges = options.avoidEdges || (options.edgeFill && options.edgeFill !== "off") ? edgeWellIds(ordered, options.plateSize) : new Set();
    const fillAssignments = options.edgeFill && options.edgeFill !== "off"
      ? ordered.filter((wellId) => edges.has(wellId) && !occupied.has(wellId)).map((wellId) => ({ wellId, drug: options.edgeFill, concentration: 0, replicate: 1, controlType: "edge-fill" }))
      : [];
    const fixedControlWellIds = options.controlPosition === "fixed" ? (options.fixedControlWellIds || []).filter((wellId) => ordered.includes(wellId) && !occupied.has(wellId)) : [];
    const fixedControlSet = new Set(fixedControlWellIds);
    const candidates = ordered.filter((wellId) => !occupied.has(wellId) && !edges.has(wellId) && !fixedControlSet.has(wellId));
    const planned = [];
    const fixedControls = [];
    for (const drug of options.drugs || []) {
      const series = generateConcentrationSeries(drug);
      const replicates = Math.floor(finite(drug.replicates ?? 3, "replicates", { min: 1, allowZero: false }));
      const treatments = [];
      if (options.disperseReplicates) {
        for (let replicate = 1; replicate <= replicates; replicate += 1) {
          for (const concentration of series) treatments.push({ drug: drug.name || "Drug", concentration, replicate, controlType: "treatment" });
        }
      } else {
        for (const concentration of series) for (let replicate = 1; replicate <= replicates; replicate += 1) treatments.push({ drug: drug.name || "Drug", concentration, replicate, controlType: "treatment" });
      }
      const controls = Array.from({ length: Math.max(0, Math.floor(Number(options.controlsPerDrug) || 0)) }, (_, index) => ({ drug: drug.name || "Drug", concentration: 0, replicate: index + 1, controlType: "vehicle" }));
      if (options.controlPosition === "fixed") fixedControls.push(...controls);
      else planned.push(...(options.controlPosition === "start" ? [...controls, ...treatments] : [...treatments, ...controls]));
      if (options.controlPosition === "fixed") planned.push(...treatments);
    }
    const required = planned.length + fixedControls.length;
    const available = candidates.length + fixedControlWellIds.length;
    const platesNeeded = available ? Math.max(1, Math.ceil(required / available)) : Infinity;
    if (fixedControls.length > fixedControlWellIds.length) return { assignments: [], fillAssignments, required, available, platesNeeded, candidates, error: "insufficient-capacity" };
    if (planned.length > candidates.length) return { assignments: [], fillAssignments, required, available, platesNeeded, candidates, error: "insufficient-capacity" };
    const assignments = planned.map((item, index) => ({ wellId: candidates[index], ...item }));
    fixedControls.forEach((item, index) => assignments.push({ wellId: fixedControlWellIds[index], ...item }));
    return { assignments, fillAssignments, required, available, platesNeeded, candidates, error: null };
  }

  return {
    VOLUME_TO_UL,
    MASS_TO_NG,
    AMOUNT_TO_PMOL,
    MOLAR_TO_NM,
    MASS_CONC_TO_NG_UL,
    volumeToUL,
    massToNg,
    amountToPmol,
    concentrationToBase,
    withOverage,
    calculateDilution,
    calculateFixedRatioPreparation,
    calculateSolutionMass,
    calculateCargoPerWell,
    calculateGenericTransfection,
    calculateRnaiMaxTransfection,
    calculateLipo3000Transfection,
    commonTransfectionComponents,
    generateConcentrationSeries,
    calculateGradientPreparation,
    calculateDrugDosingPreparation,
    planDrugGradientLayout,
  };
});
