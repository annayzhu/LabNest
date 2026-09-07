import {byId,getCalculatorDefinition} from "./catalog";
import type {CalculatorDefinition} from "./catalog";
export {getCalculatorCatalog,getCalculatorDefinition} from "./catalog";
export type {CalculatorCategory,CalculatorField,CalculatorDefinition} from "./catalog";
import {validateDisplayUnits} from "./result-presentation";
import {applyPipettingOptions} from "./pipetting";
import { isFieldVisible } from "./task-definitions";
import { dilution, addStock, serialPlan, mixPlan, batchPlan, wbPlan, type MixRow, type SampleRow } from "./planning";
import { convert, parseScalar, units, normalizeUnit, canonicalUnits } from "./quantities";
export type CalculatorRequest = { calculatorId: string; inputs: Record<string, unknown> };
export type CalculatorOutput = { key: string; label: string; labelZh: string; value: number | string; unit?: string };
export type CalculatorResult = {
  operationVersion?: string;
  pipettingCheck?: {status: 'not-set'|'passed'|'below-minimum'|'incomplete'|'not-applicable'; minimumUl?:number};
  operations?: import("./operations").LiquidOperation[];
  structuredWarnings?: import("./pipetting").PipettingWarning[];
  displayUnits?: Record<string,string>;
  schemaVersion?: number;
  status?: "valid" | "estimate" | "partial";
  mode?: string;
  rawInputs?: Record<string, unknown>;
  normalizedInputs?: Record<string, unknown>;
  calculatorId: string;
  methodVersion: string;
  outputs: CalculatorOutput[];
  outputMap: Record<string, number | string>;
  warnings: string[];
  notes: string[];
  table?: Array<Record<string, number | string>>;
};

const round = (value: number) => value;
const num = (inputs: Record<string, unknown>, key: string, options: { min?: number; positive?: boolean } = {}) => {
  const value = parseScalar(inputs[key]);
  if (key === "dilution" && value > 1) throw new Error("稀释度不得超过1 / Dilution fraction must not exceed 1");
  if (["points", "levels"].includes(key) && value > 384) throw new Error("最多384个浓度点 / Maximum 384 concentration points");
  if (["wells", "plates", "replicates", "points", "levels", "reactions", "colonies", "plaques", "automaticCount", "manualAdjustment", "samples", "controls", "cells", "cellsPerWell", "vectorBp", "insertBp", "length"].includes(key) && !Number.isInteger(value)) throw new Error(`${key}: 必须是整数 / Must be an integer`);
  if (["viabilityPercent", "currentConfluency", "targetConfluency"].includes(key) && value > 100) throw new Error(`${key}: 不得超过100% / Must not exceed 100%`);
  if (!Number.isFinite(value) || (options.positive && value <= 0) || (options.min !== undefined && value < options.min)) throw new Error(`${key} must be a valid number${options.positive ? " greater than zero" : ""}.`);
  return value;
};
const str = (inputs: Record<string, unknown>, key: string) => String(inputs[key] ?? "").trim();
const parseNumbers = (value: unknown) => String(value ?? "").trim().split(/[\s,;]+/).map((item) => { const n = parseScalar(item); if (n < 0 || !Number.isInteger(n)) throw new Error("计数必须是非负整数 / Counts must be nonnegative integers"); return n; });
const parseRows = (value: unknown, columns = 2) => String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/[,\t]/).map((part) => part.trim())).map((row) => { if (row.length < columns || row.some(cell => !cell)) throw new Error("表格含不完整行 / Incomplete table row"); return row; });
const out = (key: string, label: string, labelZh: string, value: number | string, unit?: string): CalculatorOutput => ({ key, label, labelZh, value: typeof value === "number" ? round(value) : value, unit });
const finish = (definition: CalculatorDefinition, outputs: CalculatorOutput[], warnings: string[] = [], notes: string[] = [], table?: Array<Record<string, number | string>>): CalculatorResult => ({ calculatorId: definition.id, methodVersion: definition.methodVersion.replace(/-v1$/, "-v2"), outputs, outputMap: Object.fromEntries(outputs.map((item) => [item.key, item.value])), warnings, notes, table });
function linearRegression(rows: number[][]) {
  if (rows.length < 2 || rows.some(row => row.some(n => !Number.isFinite(n)))) throw new Error("At least two finite standard points are required.");
  const n = rows.length;
  const sx = rows.reduce((s, r) => s + r[0], 0), sy = rows.reduce((s, r) => s + r[1], 0);
  const sxx = rows.reduce((s, r) => s + r[0] ** 2, 0), sxy = rows.reduce((s, r) => s + r[0] * r[1], 0);
  const denominator = n * sxx - sx ** 2;
  if (Math.abs(denominator) < 1e-12) throw new Error("Standard concentrations must not all be identical.");
  const slope = (n * sxy - sx * sy) / denominator;
  const intercept = (sy - slope * sx) / n;
  const mean = sy / n;
  const ssTotal = rows.reduce((s, r) => s + (r[1] - mean) ** 2, 0);
  const ssResidual = rows.reduce((s, r) => s + (r[1] - (slope * r[0] + intercept)) ** 2, 0);
  return { slope, intercept, r2: ssTotal ? 1 - ssResidual / ssTotal : 1 };
}

type FourPl = { bottom: number; top: number; ec50: number; hill: number; r2: number; converged: boolean };
function fourPlFit(rows: number[][], responseDirection?: number): FourPl {
  if (rows.some(([x, y]) => !Number.isFinite(x) || x <= 0 || !Number.isFinite(y))) throw new Error("4PL要求完整的正浓度数据 / 4PL requires finite positive concentration data");
  const points = [...rows].sort((a, b) => a[0] - b[0]);
  if (points.length < 4) throw new Error("At least four positive-concentration points are required for 4PL fitting.");
  if(new Set(points.map(point=>point[0])).size<4)throw new Error("4PL至少需要四个不同浓度 / At least four distinct concentrations required");
  const ys = points.map((p) => p[1]);
  if(Math.max(...ys)===Math.min(...ys))throw new Error("反应值没有变化，无法拟合 / Constant response cannot identify a curve");
  if(responseDirection && (ys.at(-1)!-ys[0])*responseDirection<=0)throw new Error("Response data do not support the selected curve direction.");
  let params = [Math.min(...ys), Math.max(...ys), points[Math.floor(points.length / 2)][0], points.at(-1)![1] >= points[0][1] ? 1 : -1];
  const score = (p: number[]) => points.reduce((sum, [x, y]) => { const e = y - (p[0] + (p[1] - p[0]) / (1 + (p[2] / x) ** p[3])); return sum + e * e; }, 0);
  let step = [Math.max(1, Math.abs(params[1] - params[0]) * 0.1), Math.max(1, Math.abs(params[1] - params[0]) * 0.1), params[2] * 0.5, 0.5];
  let best = score(params);
  for (let iteration = 0; iteration < 800; iteration += 1) {
    let improved = false;
    for (let index = 0; index < 4; index += 1) for (const direction of [-1, 1]) {
      const candidate = [...params]; candidate[index] += step[index] * direction;
      if (candidate[1] <= candidate[0] || candidate[2] <= 0 || Math.abs(candidate[3]) <= 0.05 || Math.abs(candidate[3]) > 10 || (responseDirection !== undefined && candidate[3]*responseDirection<=0.05)) continue;
      const next = score(candidate);
      if (next < best) { params = candidate; best = next; improved = true; }
    }
    if (!improved) step = step.map((value) => value * 0.7);
    if (Math.max(...step) < 1e-8) break;
  }
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const total = ys.reduce((s, y) => s + (y - mean) ** 2, 0);
  return { bottom: params[0], top: params[1], ec50: params[2], hill: params[3], converged: Math.max(...step) < 1e-8, r2: total ? 1 - best / total : 1 };
}

function calculateInternal(request: CalculatorRequest): CalculatorResult {
  const definition = byId.get(request.calculatorId);
  if (!definition) throw new Error(`Unknown calculator: ${request.calculatorId}`);
  const i = { ...request.inputs };
  const current = getCalculatorDefinition(definition.id);
  if(["ic50-ec50","bradford-bca","elisa-4pl"].includes(definition.id)&&i.concentrationUnit==="")throw new Error("请选择浓度单位 / Choose concentration units");
  for (const field of current.fields) {
    if (!isFieldVisible(definition.id, field.key, i)) continue;
    if (field.type === "select" && i[field.key] !== undefined && !field.options?.some(option => option.value === i[field.key])) throw new Error(`${field.labelZh} / ${field.label}: 无效选项 / Invalid option`);
    if(["dilution","reagent-dosing","fold-dilution"].includes(definition.id)&&["stockConcentration","targetConcentration","initialConcentration"].includes(field.key))continue;
    const selectedUnit = i[`${field.key}Unit`];
    if (field.unit && typeof selectedUnit === "string") i[field.key] = convert(parseScalar(i[field.key]), selectedUnit, field.unit);
  }
  if(definition.id === "wb-loading" && i.bufferContainsReducingAgent === "yes")i.reducingAgentPercent=0;
  if (definition.id === "seeding" && i.plates === undefined) i.plates = 1;
  if (definition.id === "molarity" && (i.purityPercent === "" || i.purityPercent === undefined)) i.purityPercent = 100;

  switch (definition.id) {
    case "hemocytometer": { const counts = parseNumbers(i.counts); if (!counts.length) throw new Error("Enter at least one quadrant count."); const average = counts.reduce((a, b) => a + b, 0) / counts.length; const concentration = average * num(i, "dilutionFactor", { positive: true }) * (i.countRegion === "custom" ? 1000 / (num(i,"areaMm2",{positive:true}) * num(i,"depthMm",{positive:true})) : 10000); const viability = num(i, "viabilityPercent", { min: 0 }); return finish(definition, [out("averageCount", "Average count", "平均计数", average, "cells/quadrant"), out("concentrationCellsPerMl", "Cell concentration", "细胞浓度", concentration, "cells/mL"), out("viableCellsPerMl", "Viable-cell concentration", "活细胞浓度", concentration * viability / 100, "cells/mL")], viability > 100 ? ["Viability exceeds 100%. Check the input."] : []); }
    case "seeding": { const wells = num(i, "wells", { positive: true }) * num(i, "plates", { positive: true }); const factor = 1 + num(i, "overagePercent", { min: 0 }) / 100; const totalCells = num(i, "cellsPerWell", { positive: true }) * wells * factor; const finalMl = num(i, "volumePerWellUl", { positive: true }) * wells * factor / 1000; const stockMl = totalCells / num(i, "stockCellsPerMl", { positive: true }); if (stockMl > finalMl) throw new Error("Stock cell density is too low for the requested seeding density and volume."); return finish(definition, [out("totalCells", "Total cells", "总细胞数", totalCells, "cells"), out("stockVolumeMl", "Cell suspension", "细胞悬液", stockMl, "mL"), out("mediumVolumeMl", "Medium", "培养基", finalMl - stockMl, "mL"), out("finalVolumeMl", "Final suspension", "最终悬液", finalMl, "mL")]); }
    case "hydrogel": { const totalUl = num(i, "wells", { positive: true }) * num(i, "volumePerWellUl", { positive: true }); const totalCells = num(i, "targetCellsPerMl", { positive: true }) * totalUl / 1000; const cellStockUl = totalCells / num(i, "stockCellsPerMl", { positive: true }) * 1000; const parts = num(i, "gelParts", { positive: true }) + num(i, "suspensionParts", { positive: true }); const gelUl = totalUl * num(i, "gelParts", { positive: true }) / parts; const suspensionUl = totalUl - gelUl; if (cellStockUl > suspensionUl) throw new Error("细胞原液超过悬液分量 / Cell stock exceeds suspension fraction"); return finish(definition, [out("totalCells", "Total cells", "总细胞数", totalCells, "cells"), out("hydrogelUl", "Hydrogel", "水凝胶", gelUl, "µL"), out("cellStockUl", "Cell stock", "细胞原液", cellStockUl, "µL"), out("mediumUl", "Suspension medium", "悬液培养基", Math.max(0, suspensionUl - cellStockUl), "µL")], cellStockUl > suspensionUl ? ["The requested cells do not fit in the cell-suspension fraction; increase stock density or suspension fraction."] : []); }
    case "split": { const post = num(i, "currentConfluency", { positive: true }) / num(i, "splitRatio", { positive: true }) * (i.areaMode === "different" ? num(i,"sourceAreaCm2",{positive:true}) / num(i,"targetAreaCm2",{positive:true}) : 1); const target = num(i, "targetConfluency", { positive: true }); const hours = target <= post ? 0 : Math.log2(target / post) * num(i, "doublingTimeHours", { positive: true }); return finish(definition, [out("postSplitConfluency", "Post-split confluency", "传代后汇合度", post, "%"), out("hoursToTarget", "Estimated time to target", "预计达到目标时间", hours, "h"), out("daysToTarget", "Estimated days", "预计天数", hours / 24, "days")], [], ["This is an exponential-growth estimate; attachment lag and density effects are not modeled."]); }
    case "freezing": { const vials = Math.floor(num(i, "totalCells", { min: 0 }) / num(i, "cellsPerVial", { positive: true })); const total = vials * num(i, "volumePerVialMl", { positive: true }); const dmso = total * num(i, "dmsoPercent", { min: 0 }) / 100; const serum = total * num(i, "serumPercent", { min: 0 }) / 100; if (num(i, "dmsoPercent") + num(i, "serumPercent") > 100) throw new Error("配方比例超过100% / Recipe exceeds 100%"); return finish(definition, [out("vials", "Complete vials", "可冻存整管数", vials, "vials"), out("remainingCells", "Remaining cells", "剩余细胞", num(i, "totalCells") - vials * num(i, "cellsPerVial"), "cells"), out("totalMediumMl", "Total freezing medium", "冻存液总量", total, "mL"), out("dmsoMl", "DMSO", "DMSO", dmso, "mL"), out("serumMl", "Serum", "血清", serum, "mL"), out("baseMediumMl", "Base medium", "基础培养基", total - dmso - serum, "mL")], dmso + serum > total ? ["DMSO and serum percentages exceed 100% combined."] : []); }
    case "transfection": { const n = num(i, "wells", { positive: true }) * num(i, "replicates", { positive: true }); const f = 1 + num(i, "overagePercent", { min: 0 }) / 100; const dna = num(i, "dnaUgPerWell", { min: 0 }) * n * f; const reagent = dna * num(i, "reagentUlPerUg", { min: 0 }); const total = num(i, "complexVolumeUlPerWell", { positive: true }) * n * f; const dnaVolume = dna / num(i, "dnaConcentrationUgUl", { positive: true }); if (dnaVolume + reagent > total) throw new Error("核酸和试剂超过复合物体积 / DNA and reagent exceed complex volume");
      let tubeTable;
      if(i.complexMode==='two-tube'){const a=num(i,'tubeAVolumeUl',{positive:true})*n*f,b=total-a;if(a<dnaVolume||b<reagent)throw new Error('核酸或试剂超过对应管体积 / DNA or reagent exceeds its tube volume');tubeTable=[{tube:'A',component:'核酸原液 / DNA stock',volumeUl:dnaVolume},{tube:'A',component:'稀释液 / Diluent',volumeUl:a-dnaVolume},{tube:'B',component:'试剂 / Reagent',volumeUl:reagent},{tube:'B',component:'稀释液 / Diluent',volumeUl:b-reagent}];}
      return finish(definition, [out("dnaUg", "DNA", "DNA", dna, "µg"), out("reagentUl", "Transfection reagent", "转染试剂", reagent, "µL"), out("dnaVolumeUl", "DNA solution", "DNA原液", dnaVolume, "µL"), out("diluentUl", "Diluent", "稀释液", total - reagent - dnaVolume, "µL"), out("totalComplexUl", "Total complex", "复合物总量", total, "µL")], [], ["试剂、稀释液及混合顺序遵循所用产品说明 / Follow product-specific reagent, diluent and mixing instructions"], tubeTable); }
    case "kill-curve": { const points = num(i, "points", { positive: true }); if(points<2)throw new Error("至少两个浓度点 / At least two dose points required"); const min = num(i, "minimum", { min: 0 }), max = num(i, "maximum", { positive: true }); if (max < min) throw new Error("Maximum dose must be at least the minimum dose."); const doses = Array.from({ length: points }, (_, index) => str(i, "scale") === "log" ? min * (max / min) ** (index / Math.max(1, points - 1)) : min + (max - min) * index / Math.max(1, points - 1)); if (str(i,"scale")==="log" && min<=0) throw new Error("对数梯度最低浓度必须大于0 / Log minimum must be positive"); const stockUgMl = num(i, "stockConcentration", { positive: true }) * 1000; if(max>stockUgMl)throw new Error("目标浓度超过母液 / Target exceeds stock"); const volume = num(i, "volumePerWellMl", { positive: true }); const table = doses.map((dose, index) => ({ level: index + 1, doseUgMl: round(dose), stockToAddUl: round(dose * volume / stockUgMl * 1000) })); return finish(definition, [out("dosePoints", "Dose points", "浓度点数", points), out("highestStockAdditionUl", "Highest stock addition", "最高浓度母液加入量", table.at(-1)?.stockToAddUl ?? 0, "µL")], [], [], table); }
    case "viability": { const total = num(i, "totalCells", { min: 0 }), viability = num(i, "viabilityPercent", { min: 0 }); const live = total * viability / 100; const target = num(i, "targetLiveCellsPerMl", { positive: true }); return finish(definition, [out("liveCells", "Live cells", "活细胞", live, "cells"), out("deadCells", "Dead cells", "死细胞", total - live, "cells"), out("resuspensionVolumeMl", "Resuspension volume", "重悬体积", live / target, "mL")], viability > 100 ? ["Viability exceeds 100%."] : []); }
    case "od600": { const corrected = num(i, "od600", { min: 0 }) / num(i, "pathLengthCm", { positive: true }); const density = corrected * num(i, "cellsPerMlPerOd", { positive: true }); return finish(definition, [out("pathCorrectedOd", "Path-corrected OD600", "光程校正OD600", corrected), out("estimatedCellsPerMl", "Estimated density", "估算细胞浓度", density, "cells/mL"), out("estimatedTotalCells", "Estimated total cells", "估算总细胞数", density * num(i, "cultureVolumeMl", { min: 0 }), "cells")], [], ["The conversion factor is organism-, instrument-, and growth-condition-specific."]); }
    case "cfu": { const cfu = num(i, "colonies", { min: 0 }) / (num(i, "dilution", { positive: true }) * num(i, "platedVolumeMl", { positive: true })); const dna = num(i, "dnaUg", { min: 0 }); return finish(definition, [out("cfuPerMl", "CFU/mL", "CFU/mL", cfu, "CFU/mL"), out("log10CfuPerMl", "log10 CFU/mL", "log10 CFU/mL", cfu > 0 ? Math.log10(cfu) : "未检出 / Not detected"), dna > 0 ? out("transformantsPerUg", "Transformation efficiency", "转化效率", cfu / dna, "CFU/µg") : out("transformantsPerUg", "Transformation efficiency", "转化效率", "Not calculated")], num(i, "colonies", { min: 0 }) < 30 ? ["Low colony count may be statistically unstable."] : []); }
    case "colony-counter": { if(num(i,"automaticCount",{min:0})+num(i,"manualAdjustment")<0)throw new Error("计数不可为负 / Count cannot be negative"); const automatic = Math.round(num(i, "automaticCount", { min: 0 })); const adjustment = Math.round(num(i, "manualAdjustment")); return finish(definition, [out("automaticCount", "Automatic detections", "自动识别数", automatic), out("confirmedCount", "Human-confirmed count", "人工确认计数", Math.max(0, automatic + adjustment))], [], ["Uploaded images are transient and are not included in saved calculation records."]); }
    case "reagent-dosing": case "dilution": case "fold-dilution": {
      const mode = str(i, "mode") || (definition.id === "fold-dilution" ? "fold" : "final");
      // Old requests retain their documented fixed units. New requests always declare a mode.
      const modern = Boolean(i.mode);
      const volume = num(i, definition.id === "reagent-dosing" && !modern ? "finalVolumeMl" : "finalVolume", {positive:true});
      let stock = 1, target = 1, initial = 0;
      if (mode === "fold") { stock=num(i, modern?"stockFold":"fold",{positive:true});target=modern?num(i,"targetFold",{positive:true}):1; }
      else if (mode === "ratio") {stock=num(i,"ratio",{positive:true});if(stock<1)throw new Error("稀释分母至少为1 / Ratio denominator must be at least 1");}
      else if (mode === "parts") {target=num(i,"stockParts",{positive:true});stock=target+num(i,"diluentParts",{min:0});}
      else {
        stock=num(i,"stockConcentration",{positive:true});target=num(i,"targetConcentration",{min:0});
        if(modern) {
          const from=String(i.stockConcentrationUnit??'mM'),to=String(i.targetConcentrationUnit??'µM');
          const source=units[normalizeUnit(from)],targetUnit=units[normalizeUnit(to)];
          if(!source||!targetUnit||![source.dimension,targetUnit.dimension].every(d=>['mass-concentration','molar-concentration'].includes(d)))throw new Error('浓度单位无效 / Invalid concentration unit');
          if(source.dimension===targetUnit.dimension)stock=convert(stock,from,to);
          else {const mw=num(i,'molecularWeight',{positive:true});stock=stock*source.factor*(source.dimension==='molar-concentration'?mw:1/mw)/targetUnit.factor;}
        }
        else if(definition.id==='reagent-dosing') { if(num(i,"stockToTargetFactor")!==1000)throw new Error("旧倍率与单位冲突，请确认单位 / Legacy factor conflicts with units");stock*=1000; }
        if(mode==='add')initial=convert(num(i,"initialConcentration",{min:0}),String(i.initialConcentrationUnit??'µM'),String(i.targetConcentrationUnit??'µM'));
      }
      const plan=mode==='add'?addStock(stock,target,initial,volume):dilution(stock,target,volume);
      const unit=modern?'mL':definition.id==='dilution'?str(i,'volumeUnit'):'mL';
      return finish(current,[out('stockVolume','Take stock','取母液',plan.sample,unit),out('stockVolumeUl','Take stock','取母液',convert(plan.sample,unit,'µL'),'µL'),out('diluentVolume','Diluent','稀释液',mode==='add'?0:plan.diluent,unit),out('finalVolume','Final volume','最终体积',plan.final,unit)],[],['体积可加和近似 / Assumes additive volumes.']);
    }
    case "serial-dilution": {
      if(i.gradientMode==='linear'||i.gradientMode==='custom') {
        const start=i.gradientMode==='linear'?num(i,'startingConcentration',{min:0}):0;
        const count=i.gradientMode==='linear'?num(i,'levels',{positive:true}):1;if(count>384)throw new Error('最多384点 / Maximum 384 points');
        const targets=i.gradientMode==='custom'?String(i.customTargets??'').split(/\r?\n/).map(value=>parseScalar(value)):Array.from({length:count},(_,index)=>start+(num(i,'endingConcentration',{min:0})-start)*index/Math.max(1,count-1));
        const table=targets.map((concentration,index)=>{const plan=dilution(num(i,'sourceConcentration',{positive:true}),concentration,num(i,'totalVolumePerLevel',{positive:true}));return {tube:index+1,concentration,source:'母液 / Stock',takeUl:plan.sample,diluentUl:plan.diluent,mixedUl:plan.final,transferUl:0,remainingUl:plan.final};});
        return finish(current,[out('levels','Concentration points','浓度点数',table.length)],[],['并行配制；浓度µM，体积µL / Parallel preparation; µM and µL'],table);
      }
      const table=serialPlan(num(i,'startingConcentration',{positive:true}),num(i,'dilutionFactor',{positive:true}),num(i,'levels',{positive:true}),num(i,'totalVolumePerLevel',{positive:true}),i.volumeMode==='retained');
      if(i.firstSource==='stock'){const first=table[0];const plan=dilution(num(i,'sourceConcentration',{positive:true}),num(i,'startingConcentration',{positive:true}),first.mixedUl);first.source='母液 / Stock';first.takeUl=plan.sample;first.diluentUl=plan.diluent;}
      const required=i.requiredVolumeUl?num(i,'requiredVolumeUl',{min:0}):i.volumeMode==='retained'?num(i,'totalVolumePerLevel',{positive:true}):undefined;
      const planned=table.map(row=>({...row,requiredUl:required??'未设置 / Unspecified',sufficient:required===undefined?'未评估 / Not assessed':row.remainingUl>=required?'是 / Yes':'否 / No'}));
      return finish(current,[out('levels','Points including start','浓度点数（含起始点）',table.length),out('transferVolume','First transfer','首次转移',table[0].transferUl,'µL')],required!==undefined&&table.some(row=>row.remainingUl<required)?['部分管保留量不足，请调整规划 / Some tubes retain insufficient volume; revise the plan']:[],[i.firstSource==='stock'?'首管从更浓母液制备 / Prepare first tube from stock':'第一管为已备起始液 / First tube is prepared starting solution','对照单独设置；浓度µM，体积µL / Controls separate; concentrations µM, volumes µL'],planned);
    }
    case "molarity": {
      const mw = num(i, "molecularWeight", { positive: true });
      const mode = str(i, "mode");
      const purity = i.purityPercent === undefined ? 1 : num(i, "purityPercent", { positive: true }) / 100;
      if (purity > 1) throw new Error("纯度不得超过100% / Purity exceeds 100%");
      if (mode === "mass") return finish(definition, [out("massG", "Mass to weigh", "称量质量", mw * num(i, "concentrationM", { positive: true }) * num(i, "volumeL", { positive: true }) / purity, "g")], [], ["溶解后定容；纯度按质量分数 / Dissolve then bring to final volume; purity is a mass fraction."]);
      if (mode === "concentration") return finish(definition, [out("concentrationM", "Molarity", "摩尔浓度", num(i, "massG", { positive: true }) * purity / mw / num(i, "volumeL", { positive: true }), "M")]);
      if (mode !== "volume") throw new Error("请选择求解目标 / Select a solve mode");
      return finish(definition, [out("volumeL", "Required volume", "定容体积", num(i, "massG", { positive: true }) * purity / mw / num(i, "concentrationM", { positive: true }), "L")]);
    }
    case "percent-solution": { if (num(i,"percentage",{min:0})>100 && str(i,"type")!=='w/v')throw new Error('比例超过100% / Fraction exceeds 100%');
      if(str(i,'type')==='w/w'){const final=num(i,'targetMassG',{positive:true});const mass=final*num(i,'percentage',{min:0})/100;return finish(current,[out('soluteAmount','Solute mass','溶质质量',mass,'g'),out('otherMassG','Other components','其他组分合计',final-mass,'g')]);}
      const amount = num(i, "percentage", { min: 0 }) * num(i, "targetVolumeMl", { positive: true }) / 100; return finish(definition, [out("soluteAmount", str(i, "type") === "w/v" ? "Solute mass" : "Liquid solute", str(i, "type") === "w/v" ? "溶质质量" : "液体溶质体积", amount, str(i, "type") === "w/v" ? "g" : "mL"), out("targetVolumeMl", "Bring to final volume", "定容至", num(i, "targetVolumeMl", { positive: true }), "mL")]); }
    case "media-recipe": case "buffer-recipe": { const scale = num(i, "targetVolumeMl", { positive: true }) / num(i, "baseVolumeMl", { positive: true }); const source = Array.isArray(i.recipeRows) ? (i.recipeRows as Array<{name:string;amount:string;unit:string;inputMode?:string;stock?:string;target?:string;stockUnit?:string;targetUnit?:string}>).map(row=>{
        if(row.inputMode==='concentration'){if(i.recipeMode==='add')throw new Error('目标浓度模式需明确最终体积，请选择定容模式 / Target concentration requires final-volume mode');const plan=dilution(convert(parseScalar(row.stock),row.stockUnit??'mM',row.targetUnit??'µM'),parseScalar(row.target),num(i,'targetVolumeMl',{positive:true}));return[row.name,String(plan.sample/scale),'mL'];}
        return [row.name,row.amount,row.unit];
      }) : parseRows(i.components, 3); const table = source.map(([name, amount, unit],index) => ({ component: name, componentId:String(index), action:'add', amount: parseScalar(amount) * scale, unit }));
      if(table.some(row=>!row.component.trim()||row.amount<0))throw new Error('组分名称或用量无效 / Invalid component name or amount');
      const liquidMl=table.filter(row=>['mL','µL','L'].includes(row.unit)).reduce((sum,row)=>sum+convert(row.amount,row.unit,'mL'),0);
      if(i.recipeMode==='final'&&liquidMl>num(i,'targetVolumeMl'))throw new Error('液体组分超过最终体积 / Liquid components exceed final volume');
      if(i.recipeMode==='final')table.push({component:'溶解后定容至 / Dissolve then bring to',componentId:'final',action:'make-up-to',amount:num(i,'targetVolumeMl'),unit:'mL'}); if (!table.length || table.some((row) => !Number.isFinite(Number(row.amount)))) throw new Error("Enter components as name, amount, unit."); return finish(definition, [out("scaleFactor", "Scale factor", "缩放倍数", scale), out("componentCount", "Components", "组分数", table.length)], [], [], table); }
    case "ic50-ec50": { const rows = parseRows(i.points).map((row) => [Number(row[0]), Number(row[1])]); const fit = fourPlFit(rows,str(i,"mode")==="inhibition"?-1:1); return finish(definition, [out("midpoint", "Relative 4PL midpoint", "相对4PL曲线中点", fit.ec50), out("bottom", "Bottom", "下平台", fit.bottom), out("top", "Top", "上平台", fit.top), out("hillSlope", "Hill slope", "Hill斜率", fit.hill), out("rSquared", "R²", "R²", fit.r2), out('converged','Converged','数值收敛',fit.converged?'Yes / 是':'No / 否')], fit.r2 < 0.9 || !fit.converged ? ["拟合需复核：R²不代表模型可靠性 / Review fit; R² alone is not validation"] : [], ['相对中点不是所有定义的绝对50%效应；检查平台和量程 / Relative midpoint is not necessarily absolute 50% effect; inspect plateaus and range.'], rows.map(([x,y])=>({concentration:x,observed:y,fitted:fit.bottom+(fit.top-fit.bottom)/(1+(fit.ec50/x)**fit.hill)}))); }
    case "master-mix": {
      if(Array.isArray(i.groups)){
        const groups=i.groups as Array<{name:string;reactions:string;rows:MixRow[]}>;
        if(!groups.length||groups.some(group=>!group.name.trim())||new Set(groups.map(group=>group.name.trim())).size!==groups.length)throw new Error('配液组名称缺失或重复 / Missing or duplicate mix group name');
        const plans=groups.map((group,groupIndex)=>{const reactions=parseScalar(group.reactions);return {group,plan:mixPlan(group.rows,reactions,reactions*num(i,'overagePercent',{min:0})/100,num(i,'reactionVolumeUl',{positive:true}),String(groupIndex),group.name)};});
        return {...finish(current,[out('groups','Separate mix groups','独立配液组',groups.length),out('totalMasterMixUl','Total across separate groups','各组预混总量（分别配制）',plans.reduce((sum,item)=>sum+item.plan.total,0),'µL')],[],['不同组分别配制，不合并模板 / Prepare each group separately; never pool templates'],plans.flatMap(({group,plan})=>plan.table.map(row=>({...row,group:group.name})))),operations:plans.flatMap(({plan})=>plan.operations)};
      }
      const reactions=i.samples!==undefined?num(i,'samples',{positive:true})*num(i,'replicates',{positive:true})+num(i,'controls',{min:0}):num(i,'reactions',{positive:true});
      if(!Number.isInteger(reactions))throw new Error('反应数必须是整数 / Reaction count must be an integer');
      const rows=Array.isArray(i.rows)?i.rows as MixRow[]:parseRows(i.components).map(([name,volume])=>({name,volume,premix:true}));
      const final=i.reactionVolumeUl!==undefined?num(i,'reactionVolumeUl',{positive:true}):rows.reduce((s,row)=>s+parseScalar(row.volume),0);
      const extra=reactions*num(i,'overagePercent',{min:0})/100;
      const plan=mixPlan(rows,reactions,extra,final);
      return {...finish(current,[out('actualReactions','Actual reactions','实际反应数',reactions),out('preparedReactions','Premix equivalents','预混反应当量',reactions+extra),out('totalMasterMixUl','Prepare premix','配制预混液',plan.total,'µL'),out('dispenseUl','Premix per reaction','每反应分装预混液',final-plan.separate,'µL'),out('separateUl','Separate sample per reaction','每反应独立加样',plan.separate,'µL') ,out('remainingPremixUl','Premix reserve','预混余量',plan.remaining,'µL')],[],['每反应当量仅表示组成；预混组分按整批加入，独立样本分别加样 / Per-reaction equivalents describe composition; prepare premix in bulk, add samples individually.'],plan.table),operations:plan.operations};
    }
    case "resuspension": {
      const mode=str(i,'mode');let volume;
      if(mode==='amount')volume=num(i,'amount',{positive:true})*1e-9/(num(i,'targetMolar',{positive:true})*1e-6);
      else if(mode==='mass')volume=num(i,'mass',{positive:true})*1e-3/num(i,'targetMass',{positive:true});
      else volume=num(i,'mass',{positive:true})*1e-3/num(i,'molecularWeight',{positive:true})/(num(i,'targetMolar',{positive:true})*1e-6);
      return finish(current,[out('finalVolumeUl','Final solution volume','最终溶液体积',volume*1e6,'µL')],[],['以COA量或分子量为依据；溶剂及复溶操作遵循产品说明 / Use COA amount or MW and product instructions.']);
    }
    case "normalization": {
      if(!Array.isArray(i.samples)||!i.samples.length)throw new Error('请输入样本 / Enter samples');
      const table=batchPlan(i.samples as SampleRow[],num(i,'targetConcentration',{min:0}),num(i,'finalVolume',{positive:true}));
      return finish(current,[out('validRows','Valid samples','有效样本',table.filter(row=>typeof row.sampleUl==='number').length)],[],['浓度单位ng/µL，体积单位µL；无效行不提供移液量 / Concentrations ng/µL, volumes µL; invalid rows have no volumes.'],table);
    }
    case "ligation": { const insert = num(i, "vectorNg", { positive: true }) * num(i, "insertBp", { positive: true }) / num(i, "vectorBp", { positive: true }) * num(i, "molarRatio", { positive: true }); return finish(definition, [out("insertNg", "Insert DNA required", "所需插入片段DNA", insert, "ng"), out("vectorNg", "Vector DNA", "载体DNA", num(i, "vectorNg", { positive: true }), "ng")]); }
    case "tm": { const sequence = str(i, "sequence").toUpperCase(); if (!/^[ACGT]+$/.test(sequence) || sequence.length < 4) throw new Error("Enter a DNA primer sequence containing A, C, G, and T."); const gc = [...sequence].filter((base) => base === "G" || base === "C").length; const saltM = num(i, "sodiumMm", { positive: true }) / 1000; const tm = sequence.length < 14 ? 2 * (sequence.length - gc) + 4 * gc : 64.9 + 41 * (gc - 16.4) / sequence.length + 16.6 * Math.log10(saltM); return finish(definition, [out("length", "Primer length", "引物长度", sequence.length, "nt"), out("gcPercent", "GC content", "GC含量", gc / sequence.length * 100, "%"), out("tmC", "Estimated Tm", "估算Tm", tm, "°C")], [], ["This screening estimate does not model Mg²⁺, dNTPs, mismatches, or nearest-neighbor thermodynamics."]); }
    case "dna-rna-conversion": { const factor = str(i, "type") === "dsDNA" ? 660 : str(i, "type") === "ssDNA" ? 330 : 340; const mw = num(i, "length", { positive: true }) * factor; const grams = num(i, "massUg", { min: 0 }) * 1e-6; const moles = grams / mw; const molecules = moles * 6.02214076e23; return finish(definition, [out("molecularWeight", "Estimated molecular weight", "估算分子量", mw, "g/mol"), out("concentrationNm", "Estimated molar concentration", "估算摩尔浓度", moles / (num(i,"volumeUl",{positive:true}) * 1e-6) * 1e9, "nM"), out("moles", "Amount", "物质的量", moles, "mol"), out("molecules", "Molecules", "分子数", molecules, "molecules"), out("concentrationUgUl", "Mass concentration", "质量浓度", num(i, "massUg", { min: 0 }) / num(i, "volumeUl", { positive: true }), "µg/µL")]); }
    case "bradford-bca": { const rows = parseRows(i.standards).map((row) => [Number(row[0]), Number(row[1])]); const fit = linearRegression(rows); if (fit.slope <= 0) throw new Error("The standard curve slope must be positive."); const concentration = (num(i, "sampleAbsorbance", { min: 0 }) - fit.intercept) / fit.slope * num(i, "dilutionFactor", { positive: true }); if(concentration<0)throw new Error("样品信号低于可反算范围 / Sample signal is below the invertible range"); const minX = Math.min(...rows.map((r) => r[0])), maxX = Math.max(...rows.map((r) => r[0])); return finish(definition, [out("slope", "Slope", "斜率", fit.slope), out("intercept", "Intercept", "截距", fit.intercept), out("rSquared", "R²", "R²", fit.r2), out("sampleConcentration", "Sample concentration", "样品浓度", concentration)], concentration / num(i, "dilutionFactor", { positive: true }) < minX || concentration / num(i, "dilutionFactor", { positive: true }) > maxX ? ["Back-calculated concentration is outside the standard range."] : [], ["仅在已验证线性量程内使用 / Use only within the validated linear range"], rows.map(([x,y])=>({concentration:x,observed:y,fitted:fit.intercept+fit.slope*x}))); }
    case "elisa-4pl": { const rows = parseRows(i.standards).map((row) => [Number(row[0]), Number(row[1])]); const fit = fourPlFit(rows); const signal = num(i, "sampleSignal", { min: 0 }); const ratio = (fit.top - fit.bottom) / (signal - fit.bottom) - 1; const concentration = ratio > 0 ? fit.ec50 / ratio ** (1 / fit.hill) * num(i, "dilutionFactor", { positive: true }) : NaN; if (!Number.isFinite(concentration)) throw new Error("Sample signal cannot be inverted within the fitted 4PL range."); return finish(definition, [out("sampleConcentration", "Sample concentration", "样品浓度", concentration), out("ec50", "Curve midpoint", "曲线中点", fit.ec50), out("hillSlope", "Hill slope", "Hill斜率", fit.hill), out("rSquared", "R²", "R²", fit.r2),out('bottom','Bottom','下平台',fit.bottom),out('top','Top','上平台',fit.top),out('converged','Converged','数值收敛',fit.converged?'Yes / 是':'No / 否')], concentration/num(i,'dilutionFactor',{positive:true})<Math.min(...rows.map(row=>row[0]))||concentration/num(i,'dilutionFactor',{positive:true})>Math.max(...rows.map(row=>row[0]))?['稀释样本反算浓度超出标准范围 / Diluted sample is outside the standard range']:[],['检查标准曲线覆盖范围、平台与收敛 / Inspect range, plateaus and convergence'],rows.map(([x,y])=>({concentration:x,observed:y,fitted:fit.bottom+(fit.top-fit.bottom)/(1+(fit.ec50/x)**fit.hill)}))); }
    case "wb-loading": {
      const inclusion=str(i,'bufferContainsReducingAgent');
      if(!['yes','no'].includes(inclusion))throw new Error('请确认Buffer是否含还原剂 / Confirm whether buffer contains reducing agent');
      const final=num(i,'finalLoadingVolumeUl',{positive:true});
      const mode=inclusion==='yes'?'included':str(i,'reducingMode')||'volume-fraction';
      const percent=inclusion==='yes'?0:num(i,'reducingAgentPercent',{min:0});
      let reducing=final*percent/100;
      if(mode==='target-concentration') {const stock=num(i,'reducingStockPercent',{positive:true});if(percent>stock||stock>100)throw new Error('还原剂浓度不可行 / Invalid reducing-agent concentration');reducing=final*percent/stock;}
      if(reducing>final)throw new Error('还原剂超过总体积 / Reducing agent exceeds total volume');
      const name=inclusion==='yes'?'已包含于Buffer / Included in buffer':str(i,'reducingAgentName') || (reducing===0?'无独立还原剂 / None':'');
      if(!name)throw new Error('请注明还原剂原液名称 / Name the reducing-agent stock');
      const definition=mode==='included'?'已包含于Buffer / Included in buffer':mode==='target-concentration'?`目标 ${percent}%；原液 ${i.reducingStockPercent}% / Target and stock concentrations`:`最终体积的 ${percent}% v/v 原液；不代表有效成分终浓度 / Fraction of final volume, not active concentration`;
      const rows=Array.isArray(i.samples)?i.samples as SampleRow[]:[{id:'Sample',concentration:String(i.sampleConcentrationUgUl??''),available:''}];
      const table=wbPlan(rows,num(i,'targetProteinUg',{positive:true}),final,num(i,'bufferFold',{positive:true}),{name,mode:mode as 'included'|'volume-fraction'|'target-concentration',volumeUl:reducing,definition});
      if(!Array.isArray(i.samples)&&typeof table[0]?.sampleUl!=='number')throw new Error(table[0]?.status??'Invalid WB sample');
      const row=table[0];
      const outputs=Array.isArray(i.samples)?[out('validRows','Valid samples','有效样本',table.filter(r=>typeof r.sampleUl==='number').length)]:[out('sampleUl','Sample','样品',row.sampleUl,'µL'),out('loadingBufferUl','Loading buffer','Loading Buffer',row.bufferUl,'µL'),out('reducingAgentUl',name,name,row.reducingAgentUl,'µL'),out('waterUl','Water','水',row.diluentUl,'µL')];
      return finish(current,outputs,[],[definition],table);
    }
    case "moi": { if(str(i,"titerUnit")==="VG/mL")throw new Error("VG不是功能性滴度，请提供功能性滴度 / VG is not a functional titer"); const moi = num(i, "desiredMoi", { min: 0 }), units = num(i, "cells", { positive: true }) * moi; const volume = units / num(i, "titer", { positive: true }) * 1000; const p0 = Math.exp(-moi); const p1 = moi * p0; return finish(definition, [out("virusVolumeUl", "Virus volume", "病毒体积", volume, "µL"), out("probabilityUninfectedPercent", "Uninfected", "未感染概率", p0 * 100, "%"), out("probabilityExactlyOnePercent", "Exactly one event", "恰好一次感染概率", p1 * 100, "%"), out("probabilityAtLeastOnePercent", "At least one event", "至少一次感染概率", (1 - p0) * 100, "%")], [], [`理论泊松模型：独立、均一事件假设，不代表确定感染率 / Theoretical Poisson model: independent homogeneous events. ${str(i, "titerUnit")}; PFU, IU, TU, TCID50, VG are not equivalent.`]); }
    case "virus-titer": { if (str(i, "mode") === "plaque") { const titer = num(i, "plaques", { min: 0 }) / (num(i, "dilution", { positive: true }) * num(i, "inoculumMl", { positive: true })); return finish(definition, [out("pfuPerMl", "Virus titer", "病毒滴度", titer, "PFU/mL"), out("log10PfuPerMl", "log10 titer", "log10滴度", titer > 0 ? Math.log10(titer) : "未检出 / Not detected")]); } const rows = parseRows(i.tcidSeries, 3).map((row) => [Number(row[0]), Number(row[1]), Number(row[2])]); if (rows.length < 2) throw new Error("Enter at least two TCID50 dilution rows."); if(rows.some(([d,p,t])=>!Number.isFinite(d)||d<=0||d>1||!Number.isInteger(p)||!Number.isInteger(t)||p<0||t<=0||p>t))throw new Error("终点行无效 / Invalid endpoint row"); const crossing = rows.find(([, positive, total]) => positive / total <= 0.5); if(!crossing)throw new Error("未跨越50%终点 / No 50% crossing observed"); return finish(definition, [out("approximateTcid50Dilution", "Approximate 50% endpoint dilution", "近似50%终点稀释度", crossing[0])], ["This quick endpoint identifies the first dilution at or below 50%; use a protocol-specific Reed–Muench or Spearman–Kärber workflow for formal reporting."]); }
    case "unit-converter": return finish(definition, [out("convertedValue", "Converted value", "换算结果", convert(num(i, "value"), str(i, "fromUnit"), str(i, "toUnit")), str(i, "toUnit"))]);
    case "centrifuge": { const radius = num(i, "radiusCm", { positive: true }); if (str(i, "mode") === "rcf-to-rpm") return finish(definition, [out("rpm", "RPM", "转速", Math.sqrt(num(i, "rcf", { min: 0 }) / (1.118e-5 * radius)), "rpm")]); return finish(definition, [out("rcf", "RCF", "相对离心力", 1.118e-5 * radius * num(i, "rpm", { min: 0 }) ** 2, "×g")]); }
    default: throw new Error(`Calculator implementation missing: ${definition.id}`);
  }
}

/** One result contract powers rendering, copying, history, and experiment writes. */
export function calculate(request: CalculatorRequest): CalculatorResult {
  const result=applyPipettingOptions(calculateInternal(request),request.inputs);
  if(['ic50-ec50','bradford-bca','elisa-4pl'].includes(request.calculatorId))result.outputs=result.outputs.map(output=>['midpoint','ec50','sampleConcentration'].includes(output.key)?{...output,unit:String(request.inputs.concentrationUnit??'未注明 / Unspecified')}:output);
  if(request.calculatorId==="dna-rna-conversion")result.notes.push("长度估算系数：dsDNA 660、ssDNA 330、RNA 340 g/mol/bp或nt。修饰核酸优先使用COA分子量 / Length-based estimate; prefer COA MW for modified nucleic acids.");
  const definition=getCalculatorDefinition(request.calculatorId);
  const normalizedInputs:Record<string,unknown>={};
  for(const field of definition.fields){
    if(!isFieldVisible(definition.id,field.key,request.inputs)||request.inputs[field.key]===undefined||request.inputs[field.key]==='')continue;
    normalizedInputs[field.key]=field.unit&&units[normalizeUnit(field.unit)]?{value:parseScalar(request.inputs[field.key])*units[normalizeUnit(String(request.inputs[`${field.key}Unit`]??field.unit))].factor+(units[normalizeUnit(String(request.inputs[`${field.key}Unit`]??field.unit))].offset??0),dimension:units[normalizeUnit(String(request.inputs[`${field.key}Unit`]??field.unit))].dimension,unit:canonicalUnits[units[normalizeUnit(String(request.inputs[`${field.key}Unit`]??field.unit))].dimension]??field.unit,sourceUnit:String(request.inputs[`${field.key}Unit`]??field.unit)}:request.inputs[field.key];
  }
  if(result.outputs.some(output=>typeof output.value==='number'&&!Number.isFinite(output.value)))throw new Error('计算溢出或条件无效 / Numerical overflow or invalid conditions');
  return {...result,displayUnits:validateDisplayUnits(result,request.inputs.__displayUnits),schemaVersion:2,status:['split','od600','tm','dna-rna-conversion','moi','virus-titer','ic50-ec50','elisa-4pl','bradford-bca'].includes(request.calculatorId)?'estimate':result.table?.some(row=>typeof row.status==='string'&&row.status!=='有效 / Valid')?'partial':'valid',mode:String(request.inputs.mode??'default'),rawInputs:structuredClone(request.inputs),normalizedInputs};
}
