(function attach(root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./vendor/preparation-kernel.js') : root.PreparationKernel);
  if (node) module.exports = api;
  else root.PreparationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPreparationCore(Kernel) {
  'use strict';
  const VERSION = 1;
  function number(value, label, minimum = 0) {
    const parsed = Kernel.parseScalar(value);
    if (parsed < minimum) throw new Error(`${label} ≥ ${minimum}`);
    return parsed;
  }
  function name(value, label) {
    const result = String(value || '').trim();
    if (!result) throw new Error(`${label}: 请填写 / Required`);
    return result;
  }
  function validateScope(scope) {
    if (!scope?.wells?.length || !scope.plateId) throw new Error('先选择孔位 / Select wells first');
    const ids = scope.wells.map(w => w.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('孔位缺失或重复 / Missing or duplicate wells');
  }
  function reaction(input, scope) {
    const finalVolumeUL = number(input.finalVolume, '反应体积 / Reaction volume', Number.MIN_VALUE);
    const overagePercent = number(input.overagePercent, '余量 / Overage');
    const diluent = name(input.diluent, '补足液 / Diluent');
    const rows = input.rows.map(row => ({ ...row, name: name(row.name, '组分 / Component') }));
    if (new Set(rows.map(row => row.name.toLowerCase())).size !== rows.length) throw new Error('组分名称重复 / Duplicate component names');
    if (rows.some(row => !row.premix && row.name.toLowerCase() === diluent.toLowerCase())) throw new Error('补足液不能与独立样本同名 / Diluent must not identify a separate sample');
    const grouped = new Map();
    for (const well of scope.wells) {
      const label = String(well.group ?? 'Master Mix');
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(well.id);
    }
    const groups = [...grouped].map(([label, wellIds]) => {
      const plan = Kernel.mixPlan(rows, wellIds.length, wellIds.length * overagePercent / 100, finalVolumeUL);
      const components = plan.table.map((row, index) => ({
        name: index >= rows.length ? diluent : row.component,
        perWellUL: row.perReactionUl,
        premix: index >= rows.length || rows[index].premix,
        preparedVolumeUL: typeof row.batchUl === 'number' ? row.batchUl : null,
      }));
      // An explicit named diluent row plus automatic top-up is one physical reagent.
      const existing = components.findIndex(c => c.name === diluent && c.premix);
      if (components.length > rows.length && existing < rows.length && existing >= 0) {
        const extra = components.pop();
        components[existing].perWellUL += extra.perWellUL;
        components[existing].preparedVolumeUL += extra.preparedVolumeUL;
      }
      if (!components.some(c => c.premix && c.perWellUL > 0)) throw new Error('没有需要配制的预混组分 / No premix component to prepare');
      const samples = scope.wells.filter(w => wellIds.includes(w.id)).map(w => ({ wellId: w.id, sample: String(w.sample ?? '') }));
      const preparation = { kind: 'reaction', dispenseUL: finalVolumeUL - plan.separate, finalVolumeUL, separate: components.filter(c => !c.premix), samples };
      return { label, wellIds, finalVolumeUL, dispenseUL: preparation.dispenseUL, preparedVolumeUL: plan.total, components, preparation };
    });
    const contributions = groups.flatMap((group, index) => {
      // Names describe a confirmed stock identity; scope and overage are not recipe identity.
      const profile = JSON.stringify([group.label, finalVolumeUL, diluent, rows.map(row => [row.name, row.premix, row.inputMode || 'volume', row.stock || '', row.stockUnit || '', row.target || '', row.targetUnit || '']), group.components.map(c => [c.name, c.perWellUL, c.premix])]);
      const groupKey = `reaction:${profile}`;
      return group.components.filter(c => c.premix).map(component => ({
        module: 'reaction', groupKey, mergeScope: input.mergeCompatible === true ? 'project' : 'plate', groupLabel: group.label, groupName: group.label, planName: 'Master Mix',
        plateId: scope.plateId, plateName: scope.plateName, scopeWellIds: group.wellIds,
        component: component.name, baseVolume: component.perWellUL * group.wellIds.length, perWellVolume: component.perWellUL, transferMode: 'batch', unit: 'µL', displayOrder: index,
        preparation: group.preparation,
      }));
    });
    return { version: VERSION, kind: 'reaction', status: 'valid', groups, contributions, overagePercent };
  }
  function normalization(input, scope) {
    const target = number(input.target, '目标浓度 / Target', Number.MIN_VALUE);
    const finalVolumeUL = number(input.finalVolume, '目标体积 / Volume', Number.MIN_VALUE);
    const diluent = name(input.diluent, '稀释液 / Diluent');
    if (input.rows.some(row => String(row.id).trim().toLowerCase() === diluent.toLowerCase())) throw new Error('样本与稀释液名称须不同 / Sample and diluent identities must be different');
    // All concentrations share one explicit unit; the dimension cancels in C1V1=C2V2.
    if (!['ng/µL', 'µg/mL', 'mg/mL', 'nM', 'µM', 'mM'].includes(input.unit)) throw new Error('请选择浓度单位 / Choose concentration unit');
    if (input.rows.length !== scope.wells.length) throw new Error('样本行数必须等于所选孔数 / One sample row per selected well');
    const samples = Kernel.batchPlan(input.rows, target, finalVolumeUL).map((row, index) => ({
      id: row.id, wellId: scope.wells[index].id, status: row.status,
      sampleUL: typeof row.sampleUl === 'number' ? row.sampleUl : null,
      diluentUL: typeof row.diluentUl === 'number' ? row.diluentUl : null,
    }));
    const valid = samples.every(sample => sample.sampleUL !== null);
    const groups = samples.filter(sample => sample.sampleUL !== null).map(sample => ({
      label: `${sample.id} · ${sample.wellId}`, wellIds: [sample.wellId], finalVolumeUL, dispenseUL: finalVolumeUL,
      preparedVolumeUL: finalVolumeUL,
      components: [{ name: sample.id, perWellUL: sample.sampleUL, preparedVolumeUL: sample.sampleUL, premix: false },
        { name: diluent, perWellUL: sample.diluentUL, preparedVolumeUL: sample.diluentUL, premix: false }],
    }));
    const contributions = valid ? groups.flatMap((group, index) => group.components.map(component => ({
      module: 'normalization', groupKey: `normalization:${group.wellIds[0]}`, mergeScope: 'plate', groupLabel: group.label,
      groupName: group.label, planName: 'Normalization', plateId: scope.plateId, plateName: scope.plateName,
      scopeWellIds: group.wellIds, component: component.name, baseVolume: component.perWellUL, perWellVolume: component.perWellUL, transferMode: 'per-well',
      unit: 'µL', displayOrder: index, overagePolicy: 'none', preparation: { kind: 'normalization', finalVolumeUL, separate: [] },
    }))) : [];
    return { version: VERSION, kind: 'normalization', status: valid ? 'valid' : 'partial', groups, samples, contributions, overagePercent: 0 };
  }
  function dilution(input, scope) {
    const volume = Kernel.convert(number(input.volume, '体积 / Volume', Number.MIN_VALUE), input.volumeUnit, 'µL');
    const count = input.volumeMode === 'total' ? 1 : scope.wells.length;
    const overagePercent = number(input.overagePercent, '余量 / Overage');
    const stockName = name(input.stockName, '母液名称 / Stock name');
    const diluent = name(input.diluent, '稀释液 / Diluent');
    if (stockName === diluent) throw new Error('母液和稀释液名称须不同 / Stock and diluent must differ');
    let plan;
    if (['final', 'add'].includes(input.mode)) {
      const stock = Kernel.convert(number(input.stock, '母液浓度 / Stock', Number.MIN_VALUE), input.stockUnit, input.targetUnit);
      const target = number(input.target, '目标浓度 / Target');
      plan = input.mode === 'add' ? Kernel.addStock(stock, target, number(input.initial, '初始浓度 / Initial'), volume) : Kernel.dilution(stock, target, volume);
    } else {
      let stock, target;
      if (input.mode === 'fold') { stock = number(input.stockFold, '母液倍数 / Stock fold', Number.MIN_VALUE); target = number(input.targetFold, '目标倍数 / Target fold', Number.MIN_VALUE); }
      else if (input.mode === 'ratio') { stock = number(input.ratio, '1:N', 1); target = 1; }
      else if (input.mode === 'parts') { target = number(input.stockParts, '母液份数 / Stock parts', Number.MIN_VALUE); stock = target + number(input.diluentParts, '稀释液份数 / Diluent parts'); }
      else throw new Error('Unknown dilution mode');
      plan = Kernel.dilution(stock, target, volume);
    }
    const adding = input.mode === 'add';
    const components = [{ name: stockName, perWellUL: plan.sample, existing: false }, { name: diluent, perWellUL: plan.diluent, existing: adding }].map(c => ({ ...c, premix: !adding, preparedVolumeUL: c.existing ? null : c.perWellUL * count * (1 + overagePercent / 100) }));
    const group = { label: stockName, wellIds: scope.wells.map(w => w.id), finalVolumeUL: plan.final, dispenseUL: input.volumeMode === 'total' ? 0 : adding ? plan.sample : plan.final, preparedVolumeUL: (adding ? plan.sample : plan.final) * count * (1 + overagePercent / 100), components };
    group.preparation = { kind: 'dilution', dispenseUL: group.dispenseUL, addToExistingUL: adding ? plan.diluent : null, totalAdditionUL: adding && input.volumeMode === 'total' ? plan.sample : null, finalVolumeUL: plan.final, separate: [] };
    // Routine dilution remains plate-local unless a complete material identity is provided.
    const contributions = components.filter(c => !c.existing).map(c => ({ module: 'dilution', groupKey: 'dilution', mergeScope: 'plate', groupLabel: stockName, groupName: stockName,
      plateId: scope.plateId, plateName: scope.plateName, scopeWellIds: group.wellIds, planName: 'Dilution',
      component: c.name, baseVolume: c.perWellUL * count, perWellVolume: input.volumeMode === 'total' ? 0 : c.perWellUL, transferMode: adding && input.volumeMode !== 'total' ? 'per-well' : 'batch', unit: 'µL',
      preparation: group.preparation,
    }));
    return { version: VERSION, kind:'dilution', mode:input.mode, volumeMode:input.volumeMode, status:'valid', groups:[group], contributions, overagePercent, perWell:{ stockUL:plan.sample, diluentUL:plan.diluent, finalUL:plan.final } };
  }
  function calculate(kind, input, scope) {
    if (kind !== 'dilution' || input.volumeMode !== 'total') validateScope(scope);
    if (kind === 'reaction') return reaction(input, scope);
    if (kind === 'normalization') return normalization(input, scope);
    if (kind === 'dilution') return dilution(input, scope);
    throw new Error(`Unknown preparation: ${kind}`);
  }
  return { VERSION, calculate };
});
