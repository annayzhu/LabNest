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
  // Master Mix opens filled in, with the same example components and overage as the release's reaction module.
  const startingInputs = {
    'master-mix': { overagePercent: '10', reactionVolumeUl: '20', rows: [{ name: '2× Mix', volume: '10', premix: true }, { name: 'Forward primer', volume: '0.5', premix: true }, { name: 'Reverse primer', volume: '0.5', premix: true }, { name: 'Template', volume: '2', premix: false }] },
  };
  // The drawer already names the calculation and the wells, so the embedded page drops its own title.
  const embeddedCalculatorCss = `
    :root { --color-moss: #3f625d; --color-moss-hover: #34534f; }
    main { min-height: 100vh !important; padding: 10px 12px !important; background: #ffffff !important; }
    .calculator-heading > :not(.calculator-heading-actions) { display: none !important; }
    .calculator-heading { justify-content: flex-end; min-height: 0; margin: 0; padding: 0; }
    .calculator-workbench > p.text-xs.text-muted, .calculator-workbench > div.border-info\\/20 { display: none !important; }
  `;
  const text = (zh, en) => host.context().locale === 'en' ? en : zh;
  const isEmbedded = /^https?:$/.test(location.protocol) && location.pathname.startsWith('/tools/free-plate-layout/');
  const tabFor = calculatorId => calculatorId === 'master-mix' ? { module: 'reaction' } : { calculatorId };

  function dressFrame(frame) {
    frame.addEventListener('load', () => {
      const page = frame.contentDocument;
      if (!page?.head) return;
      const style = page.createElement('style');
      style.textContent = embeddedCalculatorCss;
      page.head.append(style);
    });
  }

  function open(calculatorId, plan) {
    if (!isEmbedded) return window.LabNestOffline.open({host: {...host, open: node => host.open(node, tabFor(calculatorId))}, calculatorId, plan, publish: (saved, context) => host.publish(saved, mappings(saved.resultSnapshot, context))});
    if (!plan && session?.calculatorId === calculatorId && session.frame.isConnected) return;
    const { locale, ...context } = host.context();
    if (plan) context.wellIds = [...plan.scopeWellIds];
    context.requestId = crypto.randomUUID();
    const query = new URLSearchParams({ ...context, plateSize: String(context.plateSize), wellIds: context.wellIds.join(','), embed: 'plate', source: 'plate', locale });
    const frame = document.createElement('iframe');
    frame.className = 'plate-calculator-frame';
    frame.title = text('主 Calculator 配液编辑器', 'Main Calculator preparation editor');
    frame.src = `/tools/calculator/${calculatorId}?${query}`;
    dressFrame(frame);
    host.open(frame, tabFor(calculatorId));
    session = { frame, context, calculatorId, input: plan?.input ?? startingInputs[calculatorId], snapshot: host.snapshot() };
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

  /* Record protocol: the same labnest-tool-v1 messages the qPCR tools send. */
  function connectRecord() {
    if (window.parent === window) return;
    const protocol = 'labnest-tool-v1';
    let sessionId = '';
    let draftTimer = 0;
    const send = message => window.parent.postMessage({ protocol, sessionId, ...message }, location.origin);
    const fail = (error, fallback) => send({ type: 'SAVE_ERROR', error: error instanceof Error && error.message ? error.message : fallback });
    host.onStateChange(() => {
      if (!sessionId) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => send({ type: 'DRAFT_CHANGED', state: host.state() }), 250);
    });
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.protocol !== protocol) return;
      const { type } = event.data;
      if (type === 'CONTEXT_INIT') {
        sessionId = event.data.sessionId;
        document.documentElement.dataset.labnestEmbedded = 'true';
        try {
          host.enterRecord(event.data);
          send({ type: 'CONTEXT_READY' });
        } catch (error) { fail(error, '方案读取失败'); }
        return;
      }
      if (!sessionId || event.data.sessionId !== sessionId) return;
      if (type === 'REQUEST_DRAFT') send({ type: 'DRAFT_FLUSH', state: host.state() });
      if (type === 'REQUEST_OUTPUT') {
        clearTimeout(draftTimer);
        try { send({ type: 'OUTPUT_SUBMIT', state: host.state(), output: host.output() }); } catch (error) { fail(error, '请检查当前输入'); }
      }
    });
    send({ type: 'TOOL_READY' });
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
      // The release lists these calculations but only this adapter can run them.
      const gradientGroup = document.querySelector('[data-liquid-module="drug"]').parentElement;
      for (const [id, [zh, en]] of Object.entries(calculators).filter(([id]) => id !== 'master-mix')) {
        let button = document.querySelector(`[data-plate-calculator="${id}"]`);
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.dataset.plateCalculator = id;
          Object.assign(button.dataset, { zh, en });
          button.textContent = text(zh, en);
          gradientGroup.append(button);
        }
        button.hidden = false;
      }
      document.addEventListener('click', event => {
        const button = event.target.closest('[data-plate-calculator], #liquidModuleTabs [data-liquid-module="reaction"]');
        if (!button) return;
        // The reaction tab has the release's listener; intercept before it runs.
        event.stopImmediatePropagation();
        open(button.dataset.plateCalculator || 'master-mix');
      }, true);
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
      setTimeout(connectRecord);
    },
  };
})();
