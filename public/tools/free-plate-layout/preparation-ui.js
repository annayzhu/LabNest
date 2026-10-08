(function attach(root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse = (value, fallback) => value ? JSON.parse(value) : fallback;
  const initialRows = () => [
    {name:'2× Mix',volume:'10',premix:true}, {name:'Forward primer',volume:'0.5',premix:true},
    {name:'Reverse primer',volume:'0.5',premix:true}, {name:'Template',volume:'2',premix:false},
  ];
  const units = ['nM','µM','mM','ng/µL','µg/mL','mg/mL'];
  function create(language) {
    const t = (zh,en) => language === 'en' ? en : zh;
    const quantity=value=>value===null?'—':Number(value.toPrecision(12));
    const field = (key,label,value,extra='') => `<label><span>${label}</span><input name="${key}" value="${escape(value)}" ${extra}></label>`;
    const options = (items,value) => items.map(item => { const [key,label] = Array.isArray(item) ? item : [item,item]; return `<option value="${escape(key)}"${key===value?' selected':''}>${escape(label)}</option>`; }).join('');
    function rowMarkup(row) {
      const concentration = row.inputMode === 'concentration';
      return `<div class="prep-component" data-prep-row>
        <label><span>${t('组分名称 / 母液标识','Component / stock identity')}</span><input data-prep-field="name" value="${escape(row.name)}"></label>
        <label><span>${t('输入方式','Input mode')}</span><select data-prep-field="inputMode">${options([['volume',t('每反应体积','Volume / reaction')],['concentration',t('母液 → 终浓度','Stock → final concentration')]],row.inputMode||'volume')}</select></label>
        <label class="prep-volume"${concentration?' hidden':''}><span>µL / ${t('反应','reaction')}</span><input data-prep-field="volume" type="number" min="0" step="any" value="${escape(row.volume)}"></label>
        <label class="prep-check"><input data-prep-field="premix" type="checkbox"${row.premix?' checked':''}>${t('进入预混','Premix')}</label>
        <button type="button" class="icon-button prep-remove" data-prep-action="remove" aria-label="${t('删除组分','Remove component')}">×</button>
        <div class="prep-concentrations"${concentration?'':' hidden'}>${['stock','target'].map((key,index)=>`<label><span>${index?t('终浓度','Final concentration'):t('母液浓度','Stock concentration')}</span><div class="liquid-inline-input"><input type="number" min="0" step="any" data-prep-field="${key}" value="${escape(row[key]??'')}"><select data-prep-field="${key}Unit">${options(units,row[key+'Unit']||'µM')}</select></div></label>`).join('')}</div>
      </div>`;
    }
    function fields(kind,draft,context) {
      const common = field('prepFinalVolume',t('单反应 / 每样本最终体积 · µL','Final volume / reaction or sample · µL'),draft.prepFinalVolume??20,'type="number" min="0" step="any"') + field('prepDiluent',t('补足液 / 稀释液','Make-up liquid / diluent'),draft.prepDiluent??'Water');
      if (kind==='reaction') return common +
        field('prepOverage',t('预混余量 · %','Premix overage · %'),draft.prepOverage??10,'type="number" min="0" step="any"') +
        `<label><span>${t('按孔参数分组（同组分别配制）','Group by well parameter')}</span><select name="groupDimension">${options([['',t('不分组','One group')],...context.dimensions.map(d=>[d.id,d.label])],draft.groupDimension||'')}</select></label>` +
        `<div class="wide prep-help">${t('反应数来自所选孔，不再乘重复数。未勾选“进入预混”的模板/样本逐孔独立加入。示例不是通用实验推荐。','Reaction count comes from selected wells. Unchecked templates/samples are added separately. Example values are not a universal protocol.')}</div>`+
        `<input type="hidden" name="prepRows" value="${escape(draft.prepRows||JSON.stringify(initialRows()))}"><div class="wide prep-rows">${parse(draft.prepRows,initialRows()).map(rowMarkup).join('')}</div>`+
        `<button class="secondary-button wide" data-prep-action="add" type="button">＋ ${t('添加组分','Add component')}</button>`+
        `<label class="wide"><span>${t('跨板预混液','Cross-plate premix')}</span><select name="prepMerge">${options([['off',t('分别配制（默认）','Prepare separately (default)')],['on',t('同配方合并：我确认同名组分来自相同母液','Merge identical recipes: same names identify the same stocks')]],draft.prepMerge||'off')}</select></label>`;
      const saved = parse(draft.prepSamples,[]);
      const rows = context.wells.map(well => saved.find(r=>r.wellId===well.id)||{wellId:well.id,id:well.sample||well.id,concentration:'',available:''});
      return common + field('prepTarget',t('目标浓度','Target concentration'),draft.prepTarget??10,'type="number" min="0" step="any"')+
        `<label><span>${t('全部浓度使用同一单位','One unit for all concentrations')}</span><select name="prepUnit">${options(units,draft.prepUnit||'ng/µL')}</select></label>`+
        `<div class="wide prep-help">${t('一行对应一个孔。样本分别配制，不混合，不自动多取样本。所有行有效后才能保存到项目。','One row per well. Samples stay separate; no extra sample consumption. Resolve invalid rows before saving.')}</div>`+
        `<input type="hidden" name="prepSamples" value="${escape(JSON.stringify(rows))}"><div class="wide prep-samples"><table><thead><tr>${[t('孔位','Well'),t('样本ID','Sample ID'),t('原浓度','Stock concentration'),t('可用量 µL（可选）','Available µL (optional)')].map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr data-prep-sample="${escape(row.wellId)}"><th>${escape(row.wellId)}</th>${['id','concentration','available'].map(key=>`<td><input data-sample-field="${key}" aria-label="${escape(row.wellId+' '+key)}" value="${escape(row[key])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`+
        `<details class="wide"><summary>${t('从 Excel 粘贴多行','Paste rows from Excel')}</summary><p>${t('三列：样本ID、浓度、可用量（可空）。不含表头，按上面的孔位顺序一一对应。','Three columns: sample ID, concentration, available volume (optional). No header; matches wells in the order above.')}</p><textarea data-prep-paste rows="4" placeholder="S1&#9;50&#9;10&#10;S2&#9;40&#9;10"></textarea><button type="button" class="secondary-button" data-prep-action="paste">${t('填入样本行','Fill sample rows')}</button></details>`;
    }
    function sync(form) {
      if(form.elements.prepRows) form.elements.prepRows.value=JSON.stringify([...form.querySelectorAll('[data-prep-row]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-prep-field]')].map(input=>[input.dataset.prepField,input.type==='checkbox'?input.checked:input.value]))));
      if(form.elements.prepSamples) form.elements.prepSamples.value=JSON.stringify([...form.querySelectorAll('[data-prep-sample]')].map(row=>({wellId:row.dataset.prepSample,...Object.fromEntries([...row.querySelectorAll('[data-sample-field]')].map(input=>[input.dataset.sampleField,input.value]))})));
    }
    function mount(form,onEdit) {
      if(!form?.elements.prepRows&&!form?.elements.prepSamples)return;
      form.addEventListener('input',()=>{sync(form);onEdit();});
      form.addEventListener('change',event=>{
        const row=event.target.closest('[data-prep-row]');
        if(row){const mode=row.querySelector('[data-prep-field="inputMode"]').value;row.querySelector('.prep-volume').hidden=mode!=='volume';row.querySelector('.prep-concentrations').hidden=mode!=='concentration';}
        sync(form);onEdit();
      });
      form.addEventListener('click',event=>{
        const button=event.target.closest('[data-prep-action]');if(!button)return;
        if(button.dataset.prepAction==='add')form.querySelector('.prep-rows').insertAdjacentHTML('beforeend',rowMarkup({name:'',volume:'',premix:true}));
        if(button.dataset.prepAction==='remove')button.closest('[data-prep-row]').remove();
        if(button.dataset.prepAction==='paste'){
          const text=form.querySelector('[data-prep-paste]').value.trim();
          const data=text.split(/\r?\n/).map(line=>line.split('\t'));
          const rows=[...form.querySelectorAll('[data-prep-sample]')];
          if(data.length!==rows.length||data.some(r=>r.length<2||r.length>3)){onEdit(t('粘贴失败：需要与孔数相同的行数，每行 2–3 列。','Paste requires one row per well and 2–3 columns.'));return;}
          rows.forEach((row,index)=>row.querySelectorAll('[data-sample-field]').forEach((input,column)=>{input.value=data[index][column]||'';}));
        }
        sync(form);onEdit();
      });
      sync(form);
    }
    function input(kind,values) {
      const common={finalVolume:values.prepFinalVolume,diluent:values.prepDiluent};
      if(kind==='reaction')return {...common,overagePercent:values.prepOverage,mergeCompatible:values.prepMerge==='on',rows:JSON.parse(values.prepRows)};
      return {...common,target:values.prepTarget,unit:values.prepUnit,rows:JSON.parse(values.prepSamples)};
    }
    // One instruction formatter serves the immediate result and project exports.
    function executionSteps(prep,label) {
      if (prep.addToExistingUL != null) {
        const total = prep.totalAdditionUL != null;
        const amount = total ? prep.totalAdditionUL : prep.dispenseUL;
        return [{phase:'dispense',perWellVolume:total?0:amount,transferVolumeUL:amount,action:t(`${total?'本次':'每孔'}向已有 ${quantity(prep.addToExistingUL)} µL 液体加入 ${quantity(amount)} µL ${label}，最终 ${quantity(prep.finalVolumeUL)} µL；已有液体不再添加，余量不进入孔内。`,`${total?'For this batch':'Per well'}, add ${quantity(amount)} µL ${label} to the existing ${quantity(prep.addToExistingUL)} µL; final ${quantity(prep.finalVolumeUL)} µL. Do not add existing liquid again or dose preparation overage.`)}];
      }
      const targets=(prep.samples||[]).some(s=>s.sample!=='')?prep.samples:[{wellId:null,sample:''}];
      return [
        ...(prep.dispenseUL?[{phase:'dispense',perWellVolume:prep.dispenseUL,action:t(`每孔分装 ${quantity(prep.dispenseUL)} µL ${label} 预混液。`,`Dispense ${quantity(prep.dispenseUL)} µL ${label} premix per well.`)}]:[]),
        ...(prep.separate||[]).flatMap(c=>targets.map(target=>({phase:'separate-sample',perWellVolume:c.perWellUL,wellId:target.wellId,action:t(`${target.wellId?target.wellId+(target.sample?`（样本 ${target.sample}）`:''):'每孔'}：独立加入 ${c.name} ${quantity(c.perWellUL)} µL；不同样本不得混合。`,`${target.wellId?target.wellId+(target.sample?` (sample ${target.sample})`:''):'Each well'}: add ${c.name} ${quantity(c.perWellUL)} µL separately; never pool samples.`)}))),
      ];
    }
    function presentation(result) {
      if(result.kind==='normalization')return {
        headers:[t('孔位','Well'),t('样本','Sample'),t('样本 µL','Sample µL'),t('稀释液 µL','Diluent µL'),t('状态','Status')],
        rows:result.samples.map(s=>[s.wellId,s.id,quantity(s.sampleUL),quantity(s.diluentUL),s.status]),
        checklist:[t('按孔位逐样本配制，样本之间不得混合；不额外增加样本用量。','Prepare each sample at its assigned well; never pool samples or add sample overage.')],
      };
      const total = result.volumeMode === 'total';
      if (result.mode === 'add') return {
        headers:[t('组分','Component'),total?t('本次用量 µL','Amount µL'):t('每孔 µL','Per well µL'),t('需准备 µL（含余量）','To prepare µL (incl. overage)'),t('说明','Note')],
        rows:result.groups[0].components.map(c=>[c.name,quantity(c.perWellUL),quantity(c.preparedVolumeUL),c.existing?t('已有液体，不再配制','Already present; do not prepare again'):t('加入已有液体','Add to existing liquid')]),
        checklist:executionSteps(result.groups[0].preparation,result.groups[0].label).map(step=>step.action),
      };
      return {
        headers:[t('组','Group'),t('目标孔','Wells'),t('组分','Component'),total?t('基础总量 µL','Base total µL'):t('每孔 µL','Per well µL'),t('含余量整批 µL','Batch incl. overage µL'),t('加入方式','Addition')],
        rows:result.groups.flatMap(g=>g.components.map(c=>[g.label,g.wellIds.join(', '),c.name,quantity(c.perWellUL),quantity(c.preparedVolumeUL),c.premix?t('预混','Premix'):t('独立加入，不混样','Separate; never pool')])),
        checklist:result.groups.flatMap(g=>[t(`${g.label}：按整批量配制预混液。`,`${g.label}: prepare the batch premix.`),...executionSteps(g.preparation,g.label).map(step=>step.action)]),
      };
    }
    function dilutionFields() {
      const label=(key,text,value,modes)=>field(key,text,value,'type="number" min="0" step="any"').replace('<label>',`<label data-basic-task="dilution" data-dilution-modes="${modes}">`);
      return `<label class="wide" data-basic-task="dilution"><span>${t('稀释模式','Dilution mode')}</span><select name="dilutionMode">${options([['final',t('配至最终体积','Bring to final volume')],['add',t('向已有液体加药','Add to existing liquid')],['fold',t('倍液（10× → 1×）','Fold (10× → 1×)')],['ratio',t('1:N（占最终体积 1/N）','1:N of final volume')],['parts',t('母液:稀释液份数','Stock:diluent parts')]],'final')}</select></label>`+
        field('dilutionStockName',t('母液名称 / 标识','Stock identity'),'Stock').replace('<label>','<label data-basic-task="dilution">')+
        field('dilutionDiluent',t('稀释液','Diluent'),'Medium').replace('<label>','<label data-basic-task="dilution">')+
        label('initialConcentration',t('已有液体初始浓度（目标同单位）','Initial concentration (target unit)'),0,'add')+
        label('stockFold',t('母液倍数','Stock fold'),10,'fold')+label('targetFold',t('目标倍数','Target fold'),1,'fold')+
        label('dilutionRatio','N',100,'ratio')+label('stockParts',t('母液份数','Stock parts'),1,'parts')+label('diluentParts',t('稀释液份数','Diluent parts'),9,'parts');
    }
    return {fields,mount,sync,input,presentation,dilutionFields,executionSteps};
  }
  root.PreparationUI={create};
})(globalThis);
