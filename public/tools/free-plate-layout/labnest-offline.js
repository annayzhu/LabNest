/* Legacy LabNest downloads use the shared engine; canonical desktop releases do not load this adapter. */
(() => {
  const engine = window.LabNestCalculations;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const appearanceKey = 'labnest.standalone-calculator.appearance';
  let iconPack = 'lab-soft';
  let activeEditor = null;
  try { iconPack = engine.parseAppearance(localStorage.getItem(appearanceKey), null, null, false).value.iconPackId; } catch { /* Default remains usable without storage. */ }
  const icon = id => {
    const resource = engine.taskIconResource(id, iconPack);
    return `<span class="standalone-task-icon">${resource ? `<img src=".${escape(resource)}" width="32" height="32" alt="" />` : engine.taskLineSvg(id)}</span>`;
  };
  function fieldMarkup(field, value, locked = false) {
    const name = escape(field.key);
    const control = field.type === 'select'
      ? `<select name="${name}">${field.options.map(o => `<option value="${escape(o.value)}" ${String(value) === o.value ? 'selected' : ''}>${escape(o.labelZh || o.label)}</option>`).join('')}</select>`
      : field.type === 'textarea'
        ? `<textarea name="${name}">${escape(value)}</textarea>`
        : `<input name="${name}" type="number" step="any" value="${escape(value)}" ${locked ? 'readonly' : ''}>`;
    return `<label><span>${escape(field.labelZh || field.label)} ${escape(field.unit || '')}</span>${control}</label>`;
  }
  window.LabNestOffline = {
    reset() { activeEditor = null; },
    open({host, calculatorId, plan, publish}) {
      if (!plan && activeEditor?.id === calculatorId && activeEditor.container.isConnected) return;
      const context = host.context();
      if (plan) context.wellIds = [...plan.scopeWellIds];
      const snapshot = host.snapshot();
      const definition = engine.getCalculatorDefinition(calculatorId);
      const inputs = engine.canonicalPlateInputs(calculatorId, {...definition.exampleInputs, ...plan?.input});
      if ('wells' in inputs) inputs.wells = context.wellIds.length;
      inputs.plates = 1;
      // The historical download editor supports text components; use the same
      // engine's legacy input contract instead of maintaining a second formula.
      let fields = definition.fields;
      const legacyMix = calculatorId === 'master-mix' && (!plan || plan.input?.components !== undefined);
      if (legacyMix) {
        fields = [{key:'reactions', labelZh:'反应数', type:'number'}, {key:'overagePercent',labelZh:'余量 (%)',type:'number'}, {key:'components',labelZh:'组分（名称, 每反应 µL）',type:'textarea'}];
        inputs.reactions = context.wellIds.length;
        inputs.components = plan?.input?.components ?? '2× Mix,10\nForward primer,0.5\nReverse primer,0.5\nWater,8';
      }
      const container = document.createElement('div');
      container.id = 'plateCalculatorHost';
      container.className = 'plate-calculator-host';
      container.innerHTML = `<div class="liquid-workspace"><section class="liquid-form-card"><h3>${escape(definition.nameZh)}</h3><details class="standalone-appearance-preview"><summary>外观预览 / Appearance preview</summary><select data-standalone-icon-pack><option value="lab-soft">Lab soft</option><option value="classic-line">Classic line</option></select><p>此独立版来源内生效 / Local to this origin; no automatic cross-origin sync</p><div data-icon-preview>${icon(calculatorId)}</div></details><form id="standalonePlateCalculatorForm"><div class="liquid-form-grid">${fields.map(f => fieldMarkup(f, inputs[f.key] ?? f.defaultValue ?? '', ['wells','reactions','plates'].includes(f.key))).join('')}${fieldMarkup({key:'pipetteMinimumUl',labelZh:'移液下限',unit:'µL'},inputs.pipetteMinimumUl)}</div><button type="submit" class="primary-button">计算 / Calculate</button></form></section><section class="liquid-result-card"><h3>计算结果 / Results</h3><div id="standalonePlateResult"></div></section></div>`;
      host.open(container);
      activeEditor = {id:calculatorId, container};
      container.querySelector('h3').insertAdjacentHTML('afterbegin', `<span class="standalone-task-icon">${engine.taskSolidSvg(calculatorId)}</span> `);
      container.addEventListener('keydown', event => {
        const details=event.target.closest('details[open]');
        if(event.key !== 'Escape' || !details)return;
        event.preventDefault();event.stopPropagation();details.open=false;details.querySelector('summary').focus({preventScroll:true});
      });
      container.querySelector('[data-standalone-icon-pack]').value = iconPack;
      let result = null;
      const resultNode = container.querySelector('#standalonePlateResult');
      const render = () => {
        resultNode.innerHTML = engine.presentedOutputs(result).map(o => `<p>${escape(o.labelZh || o.label)}: <strong>${escape(typeof o.value === 'number' ? engine.formatQuantity(o.value) : o.value)} ${escape(o.unit)}</strong>${o.unit && engine.compatibleUnits(o.unit).length > 1 ? `<select data-output-unit="${escape(o.key)}">${engine.compatibleUnits(o.unit).map(u=>`<option ${u === o.unit ? 'selected' : ''}>${escape(u)}</option>`).join('')}</select>` : ''}</p>`).join('') + result.warnings.map(w=>`<p class="liquid-warning">${escape(w)}</p>`).join('') + `<pre>${escape(engine.resultClipboard(result, context.locale === 'zh'))}</pre><button class="primary-button" data-plate-result-action="apply">应用到当前孔板 / Apply to current plate</button><button data-plate-result-action="copy">复制 / Copy</button><button data-plate-result-action="csv">CSV</button>`;
      };
      container.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.target));
        try {
          const raw = {...inputs, ...values, plates:1};
          if (!raw.pipetteMinimumUl) delete raw.pipetteMinimumUl;
          if (legacyMix) { delete raw.rows; delete raw.samples; delete raw.replicates; delete raw.controls; }
          result = engine.calculate({calculatorId, inputs:raw});
          render();
        } catch (error) { result = null; resultNode.textContent = error.message; }
      });
      container.addEventListener('input', event => {
        if (!event.target.closest('form')) return;
        result = null; resultNode.textContent = '输入已改变，请重新计算 / Inputs changed; recalculate';
      });
      container.addEventListener('change', event => {
        if (event.target.matches('[data-standalone-icon-pack]')) {
          iconPack = event.target.value;
          try {
            const parsed = engine.parseAppearance(localStorage.getItem(appearanceKey),null,null,false);
            if (parsed.preserve) throw Error('Protected preference version');
            localStorage.setItem(appearanceKey,JSON.stringify({...parsed.value,iconPackId:iconPack}));
          } catch { host.notify('偏好未保存 / Preferences not saved'); }
          container.querySelector('[data-icon-preview]').innerHTML = icon(calculatorId);
        } else if (event.target.dataset.outputUnit && result) {
          result.displayUnits = {...result.displayUnits,[event.target.dataset.outputUnit]:event.target.value};render();
        }
      });
      container.addEventListener('click', async event => {
        const action = event.target.closest('[data-plate-result-action]')?.dataset.plateResultAction;
        if (!result || !action) return;
        if (action === 'apply') {
          if (snapshot !== host.snapshot()) return host.notify('孔板已改变，请重新计算 / Plate changed; recalculate');
          try { publish(engine.buildPlateLiquidPlan(result,context),context); } catch(error) { host.notify(error.message); }
        } else if (action === 'copy') {
          const text = engine.resultClipboard(result,context.locale === 'zh');
          if (await engine.copyCalculation(text) === 'manual') { const area=document.createElement('textarea');area.readOnly=true;area.value=text;resultNode.append(area);area.select(); }
        } else if (action === 'csv') {
          const url=URL.createObjectURL(new Blob([engine.resultCsv(result,context.locale === 'zh')],{type:'text/csv;charset=utf-8'}));
          const link=document.createElement('a');link.href=url;link.download='calculator.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }
      });
    },
    installCacheControl() {
      const button=document.createElement('button');button.id='cacheStandalone';button.textContent='缓存离线使用 / Cache for offline';
      const status=document.createElement('span');status.id='cacheStandaloneStatus';
      document.querySelector('.liquid-module-grid').after(button,status);
      button.addEventListener('click',async()=>{
        try {
          status.textContent='Caching / 正在缓存';
          const registration=await navigator.serviceWorker.register('./offline.js',{scope:'./'});
          const worker=registration.active||registration.installing||registration.waiting;
          if(worker.state!=='activated')await new Promise(resolve=>worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();}));
          const icons=await(await fetch('./icons/lab-soft-v1/resources.json')).json();
          const paths=[location.href,...[...document.querySelectorAll('script[src],link[rel="stylesheet"]')].map(el=>el.src||el.href),...icons.map(p=>'.'+p)];
          const ok=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>resolve(false),20000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data.ok);};worker.postMessage({type:'CACHE_STANDALONE',paths},[channel.port2]);});
          status.textContent=ok?'Cached for offline reload / 已缓存，可离线刷新':'Caching failed / 缓存失败';
        }catch { status.textContent='Caching unavailable; requires HTTPS or localhost / 需HTTPS或本机地址'; }
      });
    },
  };
})();
