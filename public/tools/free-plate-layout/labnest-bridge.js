/* LabNest-only UI adapter. The release owns project state; Calculator owns calculations. */
(() => {
  let host;
  let session = null;
  const calculators = {
    'master-mix': ['Master Mix', 'Master Mix'],
    seeding: ['细胞铺板', 'Cell seeding'],
    hydrogel: ['水凝胶培养', 'Hydrogel culture'],
    'kill-curve': ['杀灭曲线', 'Kill curve'],
    moi: ['病毒感染 MOI', 'Viral MOI'],
  };
  const text = (zh, en) => host.context().locale === 'en' ? en : zh;
  const isEmbedded = /^https?:$/.test(location.protocol) && location.pathname.startsWith('/tools/free-plate-layout/');

  function open(calculatorId, plan) {
    if (!isEmbedded) return window.LabNestOffline.open({host, calculatorId, plan, publish: (saved, context) => host.publish(saved, mappings(saved.resultSnapshot, context))});
    if (!plan && session?.calculatorId === calculatorId && session.frame.isConnected) return;
    const { locale, ...context } = host.context();
    if (plan) context.wellIds = [...plan.scopeWellIds];
    context.requestId = crypto.randomUUID();
    const query = new URLSearchParams({ ...context, plateSize: String(context.plateSize), wellIds: context.wellIds.join(','), embed: 'plate', source: 'plate', locale });
    const frame = document.createElement('iframe');
    frame.className = 'plate-calculator-frame';
    frame.title = text('主 Calculator 配液编辑器', 'Main Calculator preparation editor');
    frame.src = `/tools/calculator/${calculatorId}?${query}`;
    host.open(frame);
    session = { frame, context, calculatorId, input: plan?.input, snapshot: host.snapshot() };
  }

  function mappings(result, context) {
    const input = window.LabNestCalculations.canonicalPlateInputs(result.calculatorId, result.rawInputs);
    const fields = {
      seeding: [['铺板细胞数/孔', 'Seeding cells/well', 'cells', input.cellsPerWell], ['铺板体积/孔', 'Seeding volume/well', 'µL', input.volumePerWellUl]],
      hydrogel: [['水凝胶培养体积/孔', 'Hydrogel volume/well', 'µL', input.volumePerWellUl]],
      moi: [['目标 MOI', 'Target MOI', 'MOI', input.desiredMoi]],
      'fold-dilution': [['工作液倍数', 'Working-solution fold', '×', input.targetFold ?? 1]],
    };
    if (result.calculatorId === 'kill-curve') {
      const rows = result.table.filter(row => Number.isFinite(Number(row.doseUgMl)));
      return [{ name: text('杀灭曲线浓度', 'Kill-curve dose'), unit: 'µg/mL', values: context.wellIds.map((_, index) => Number(rows[Math.min(rows.length - 1, Math.floor(index * rows.length / context.wellIds.length))].doseUgMl)) }];
    }
    return (fields[result.calculatorId] || []).filter(row => Number.isFinite(Number(row[3]))).map(([zh, en, unit, value]) => ({ name: text(zh, en), unit, values: context.wellIds.map(() => Number(value)) }));
  }

  window.LabNestPlateBridge = {
    reset() { session = null; window.LabNestOffline.reset(); },
    edit(plan) { open(plan.calculatorId, plan); },
    connect(api) {
      host = api;
      if (!isEmbedded) {
        calculators['fold-dilution'] = ['倍数稀释', 'Fold dilution'];
        window.LabNestOffline.installCacheControl();
      }
      const grid = document.querySelector('.liquid-module-grid');
      // A single Master Mix entry opens the full host editor. Offline keeps its own editor.
      const reaction = grid.querySelector('[data-liquid-module="reaction"]');
      reaction.removeAttribute('data-liquid-module');
      reaction.dataset.plateCalculator = 'master-mix';
      reaction.classList.add('plate-calculator-launch');
      for (const [id, labels] of Object.entries(calculators).filter(([id]) => id !== 'master-mix')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'liquid-module-card plate-calculator-launch';
        button.dataset.plateCalculator = id;
        button.textContent = text(...labels);
        grid.append(button);
      }
      document.addEventListener('click', event => {
        const button = event.target.closest('[data-plate-calculator], [data-liquid-module="reaction"]');
        if (!button) return;
        // The original reaction button has the release's listener; intercept before it runs.
        event.stopImmediatePropagation();
        open(button.dataset.plateCalculator || 'master-mix');
      }, true);
      document.addEventListener('click', event => {
        if (!event.target.closest('.language-option')) return;
        for (const button of grid.querySelectorAll('.liquid-module-card[data-plate-calculator]')) button.textContent = text(...calculators[button.dataset.plateCalculator]);
      });
      window.addEventListener('message', event => {
        const current = session;
        if (!current || event.origin !== location.origin || event.source !== current.frame.contentWindow || event.data?.calculatorId !== current.calculatorId || JSON.stringify(event.data?.plateContext) !== JSON.stringify(current.context)) return;
        if (event.data.type === 'labnest:calculator-ready') {
          current.frame.dataset.ready = 'true';
          if (current.input) current.frame.contentWindow.postMessage({ type: 'labnest:calculator-inputs', calculatorId: current.calculatorId, requestId: current.context.requestId, inputs: current.input }, location.origin);
          return;
        }
        if (event.data.type !== 'labnest:calculator-result') return;
        if (current.snapshot !== host.snapshot()) { host.notify(text('孔板已改变，请重新打开计算器。', 'Plate changed; reopen the calculator.')); return; }
        try {
          const plan = window.LabNestCalculations.buildPlateLiquidPlan(event.data, current.context);
          const assignments = mappings(plan.resultSnapshot, current.context);
          host.publish(plan, assignments);
          session = null;
        } catch (error) { host.notify(error.message); }
      });
    },
  };
})();
