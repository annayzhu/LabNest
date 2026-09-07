import {units, normalizeUnit} from "./quantities";
import type { CalculatorDefinition, CalculatorField } from './calculator-engine';
const n = (key: string, label: string, labelZh: string, unit?: string): CalculatorField => ({ key, label, labelZh, type: 'number', unit });
const select = (key: string, label: string, labelZh: string, options: string[][]): CalculatorField => ({ key, label, labelZh, type: 'select', defaultValue: options[0][0], options: options.map(([value,label,labelZh]) => ({value,label,labelZh})) });
export const defaultTasks = ['dilution', 'molarity', 'seeding', 'master-mix', 'wb-loading', 'centrifuge'];
export const legacyTaskMap: Record<string, { task: string; mode?: string }> = {
  'reagent-dosing': { task: 'dilution', mode: 'final' }, 'fold-dilution': { task: 'dilution', mode: 'fold' },
};
export function enhanceDefinition(d: CalculatorDefinition): CalculatorDefinition {
  if(d.id==='master-mix')d.methodVersion='master-mix-v3';
  if(d.id==='percent-solution')d.methodVersion='percent-solution-v2';
  d = { ...d, fields: [...d.fields], aliases: [...d.aliases], methodVersion: d.methodVersion.replace(/-v1$/, '-v2') };
  if(['wb-loading','bradford-bca','elisa-4pl'].includes(d.id))d.category='protein';
  if(['od600','cfu','colony-counter'].includes(d.id))d.category='virology-microbiology';
  if (['dilution','reagent-dosing','fold-dilution'].includes(d.id)) {
    d.name = 'Dilution & dosing'; d.nameZh = '稀释与加药';
    d.aliases.push('抗体', '1:1000', 'antibody dilution', '10× PBS', 'fold dilution', '加药', '常规稀释', '试剂加药', '倍数稀释');
    d.fields = [select('mode','Mode','模式', [['final','Final volume','配至最终体积'],['add','Add to existing liquid','向已有液体加药'],['fold','Fold dilution','倍液'],['ratio','1:N dilution','1:N稀释（占最终体积1/N）'],['parts','Stock:diluent','母液:稀释液']]), n('stockConcentration','Stock concentration','母液浓度','mM'), n('targetConcentration','Target concentration','目标浓度','µM'), n('initialConcentration','Initial concentration (same solute)','已有液体初始浓度（同一溶质）','µM'), n('stockFold','Stock fold','母液倍数'), n('targetFold','Target fold','目标倍数'),n('ratio','Dilution denominator','稀释分母N'), n('stockParts','Stock parts','母液份数'),n('diluentParts','Diluent parts','稀释液份数'),n('finalVolume','Final / initial volume','最终体积 / 已有液体体积','mL'),n('molecularWeight','MW of confirmed chemical form','已确认盐/水合物形式的分子量','g/mol')];
    d.exampleInputs = { mode: 'final', stockConcentration: 10, targetConcentration: 10, finalVolume: 2, initialConcentration: 0 };
    if(d.id==='fold-dilution'){d.fields[0].defaultValue='fold';d.exampleInputs={mode:'fold',stockFold:10,targetFold:2,finalVolume:100};}
  }
  if (d.id === 'molarity') { d.name='Weigh & prepare';d.nameZh='称量配液';d.fields.push(n('purityPercent','Mass purity','质量纯度','%'));d.exampleInputs.purityPercent=100; }
  if (d.id === 'seeding') { d.fields=d.fields.filter(f=>f.key !== 'plates'); d.fields[0]={...d.fields[0],label:'Viable-cell concentration',labelZh:'活细胞浓度'};d.aliases.push('seeding','铺24孔'); }
  if(d.id==='hemocytometer'){d.fields.unshift(select('countRegion','Counting region','计数区',[['standard','Standard large square (100 nL)','标准大方格（100 nL）'],['custom','Custom geometry','自定义几何参数']]));d.fields.push(n('areaMm2','Counting area','计数面积','mm²'),n('depthMm','Chamber depth','计数深度','mm'));}
  if(['ic50-ec50','bradford-bca','elisa-4pl'].includes(d.id)){
    d.fields.unshift(select('concentrationUnit','Concentration unit','浓度单位',[['','Choose a unit','请选择单位'],['µM','µM','µM'],['nM','nM','nM'],['mg/mL','mg/mL','mg/mL'],['µg/mL','µg/mL','µg/mL'],['ng/mL','ng/mL','ng/mL'],['pg/mL','pg/mL','pg/mL']]));
    d.exampleInputs.concentrationUnit=d.id==='ic50-ec50'?'µM':d.id==='bradford-bca'?'mg/mL':'pg/mL';
  }
  if (d.id === 'centrifuge') { d.aliases.push('g转rpm');d.fields.push(select('radiusDefinition','Radius definition','半径来源定义',[['entered','User-entered rotor radius','用户录入转子半径'],['maximum','Maximum radius','最大半径'],['mean','Mean radius','平均半径']])); }
  if(d.id==='transfection'){d.fields.unshift(select('complexMode','Mixing template','混合模板',[['combined','Combined mixture','单体系'],['two-tube','Two separate tubes','两管分别配制再混合']]));d.fields.push(n('tubeAVolumeUl','Tube A final volume per well','每孔A管总体积','µL'));}
  if(d.id==='wb-loading'){d.fields.unshift(select('bufferContainsReducingAgent','Buffer contains reducing agent','Buffer是否已含还原剂',[['','Please confirm','请选择确认'],['no','No; specify separate amount','否，单独设置用量'],['yes','Yes; do not add twice','是，不再重复添加']]));d.fields.push({key:'reducingAgentName',type:'text',label:'Reducing-agent stock name',labelZh:'还原剂原液名称'},select('reducingMode','Reducing-agent definition','还原剂添加定义',[['volume-fraction','Stock fraction of final volume','原液占最终体积比例'],['target-concentration','Target active concentration (%)','有效成分目标浓度（%）']]),n('reducingStockPercent','Stock concentration (%)','原液有效成分浓度（%）','%'));d.exampleInputs={...d.exampleInputs,bufferContainsReducingAgent:'no',reducingAgentName:'Specified stock',reducingMode:'volume-fraction'};d.methodVersion='wb-loading-v3';}
  if(d.id==='split'){d.fields.unshift(select('areaMode','Container area','容器面积',[['same','Same source and target area','来源和目标容器面积相同'],['different','Different areas','来源和目标容器面积不同']]));d.fields.push(n('sourceAreaCm2','Source area','来源容器面积','cm²'),n('targetAreaCm2','Area of each target container','每个目标容器面积','cm²'));}

  if (d.id === 'dna-rna-conversion') d.aliases.push('ng/μL 转 nM','DNA浓度','ng每μL转nM');
  if (d.id === 'percent-solution') { d.fields[0].options=[...d.fields[0].options!,{value:'w/w',label:'w/w',labelZh:'质量/质量'}];d.fields.push(n('targetMassG','Final mixture mass','最终混合物质量','g')); }
  if (d.id === 'serial-dilution') { d.fields.push(select('volumeMode','Volume meaning','体积含义',[['mixed','Mixed volume','每管混匀时体积'],['retained','Retained volume','转移后保留体积']]));d.fields.find(f=>f.key==='startingConcentration')!.unit='µM'; }
  if(['media-recipe','buffer-recipe'].includes(d.id)){d.fields=d.fields.filter(f=>f.key!=='components');d.fields.push(select('recipeMode','Preparation mode','配制模式',[['final','Bring to final volume','溶解后定容至最终体积'],['add','Add to existing base liquid','向已有基础液添加']]));}
  if(d.id==='serial-dilution') {
    d.fields.unshift(select('gradientMode','Gradient','梯度方式',[['geometric','Geometric serial','等倍连续'],['linear','Linear parallel','线性并行配制'],['custom','Custom parallel','自定义浓度并行配制']]));
    d.fields.push(n('requiredVolumeUl','Required retained volume (optional)','转移后所需用量（可选）','µL'),n('endingConcentration','Last concentration','末点浓度','µM'),{key:'customTargets',label:'Targets (one µM value per line)',labelZh:'目标浓度（每行一个µM数值）',type:'textarea'},select('firstSource','Starting solution','第一管来源',[['prepared','Already prepared starting solution','已备起始液'],['stock','Prepare from stock','从更浓母液制备']]),n('sourceConcentration','Source stock concentration','来源母液浓度','µM'));
  }
  if (d.id === 'master-mix') {
    d.name='Reaction preparation';d.nameZh='反应配液';
    d.fields=[n('samples','Samples','样本数','integer'),n('replicates','Replicates per sample','每样本重复数','integer'),n('controls','Control reactions','额外对照反应数','integer'),n('overagePercent','Overage','预混余量','%'),n('reactionVolumeUl','Final volume per reaction','单反应总体积','µL')];
    d.exampleInputs={samples:8,replicates:3,controls:2,overagePercent:10,reactionVolumeUl:20,rows:[{name:'2× Mix',volume:'10',premix:true},{name:'F',volume:'0.5',premix:true},{name:'R',volume:'0.5',premix:true},{name:'Template',volume:'2',premix:false},{name:'Water',volume:'7',premix:true}]};
  }
  return d;
}
export const newDefinitions: CalculatorDefinition[] = [
  { id:'resuspension',name:'Reagent resuspension',nameZh:'试剂复溶',shortDescription:'Final volume from amount and concentration',shortDescriptionZh:'根据试剂量计算复溶最终体积',category:'solutions',aliases:['引物溶解','oligo resuspension'],plateAware:false,method:'Final volume = amount / target concentration',methodZh:'最终体积 = 量 / 目标浓度；按产品说明选择溶剂',methodVersion:'resuspension-v2',fields:[select('mode','Mode','模式',[['amount','Amount → molarity','物质的量→摩尔浓度'],['mass','Mass → mass concentration','质量→质量浓度'],['mass-molar','Mass + MW → molarity','质量＋分子量→摩尔浓度']]),n('amount','Amount','物质的量','nmol'),n('mass','Mass','质量','mg'),n('molecularWeight','Molecular weight','分子量','g/mol'),n('targetMolar','Target molarity','目标摩尔浓度','µM'),n('targetMass','Target mass concentration','目标质量浓度','mg/mL')],exampleInputs:{mode:'amount',amount:25,targetMolar:100}},
  { id:'normalization',name:'Batch normalization',nameZh:'批量浓度归一化',shortDescription:'Row-by-row dilution with sample availability',shortDescriptionZh:'逐样本检查浓度和可用体积，生成移液表',category:'solutions',aliases:['batch dilution','批量稀释'],plateAware:false,method:'C1V1=C2V2; each sample validated separately',methodZh:'C1V1=C2V2；逐行校验并保留无效行',methodVersion:'normalization-v2',fields:[n('targetConcentration','Target concentration','目标浓度','ng/µL'),n('finalVolume','Final volume','最终体积','µL')],exampleInputs:{targetConcentration:10,finalVolume:20,samples:[{id:'A',concentration:'50',available:''},{id:'B',concentration:'5',available:''}]}},
];
export function isFieldVisible(id: string, key: string, inputs: Record<string,unknown>) {
  const mode=String(inputs.mode ?? '');
  if (['dilution','reagent-dosing','fold-dilution'].includes(id)) {
    const m=mode || 'final';
    if(key==='molecularWeight')return ['final','add'].includes(m)&&units[normalizeUnit(String(inputs.stockConcentrationUnit??'mM'))]?.dimension!==units[normalizeUnit(String(inputs.targetConcentrationUnit??'µM'))]?.dimension;
    if (['stockConcentration','targetConcentration'].includes(key)) return ['final','add'].includes(m);
    if(key==='initialConcentration') return m==='add';
    if(['stockFold','targetFold'].includes(key))return m==='fold';
    if(key==='ratio')return m==='ratio';
    if(['stockParts','diluentParts'].includes(key))return m==='parts';
  }
  if(id==='serial-dilution') {
    const gradient=inputs.gradientMode??'geometric';
    if(key==='startingConcentration'||key==='levels')return gradient!=='custom';
    if(key==='dilutionFactor'||key==='volumeMode')return gradient==='geometric';
    if(key==='endingConcentration')return gradient==='linear';
    if(key==='customTargets')return gradient==='custom';
    if(key==='sourceConcentration')return gradient!=='geometric'||inputs.firstSource==='stock';
    if(key==='firstSource')return gradient==='geometric';
  }
  if(id==='hemocytometer'&&['areaMm2','depthMm'].includes(key))return inputs.countRegion==='custom';
  if(id==='master-mix'&&Array.isArray(inputs.groups)&&['samples','replicates','controls'].includes(key))return false;
  if(id==='transfection'&&key==='tubeAVolumeUl')return inputs.complexMode==='two-tube';
  if(id==='wb-loading'&&['reducingAgentPercent','reducingAgentName','reducingMode','reducingStockPercent'].includes(key))return inputs.bufferContainsReducingAgent==='no'&&(key!=='reducingStockPercent'||inputs.reducingMode==='target-concentration');
  if(id==='split'&&['sourceAreaCm2','targetAreaCm2'].includes(key))return inputs.areaMode==='different';
  if(id==='molarity')return key!==({mass:'massG',concentration:'concentrationM',volume:'volumeL'}[mode||'mass']);
  if(id==='centrifuge')return key!==(mode==='rcf-to-rpm'?'rpm':'rcf');
  if(id==='percent-solution') { if(key==='targetMassG')return inputs.type==='w/w';if(key==='targetVolumeMl')return inputs.type!=='w/w'; }
  if(id==='resuspension') { if(key==='amount')return mode==='amount';if(key==='mass')return mode!=='amount';if(key==='molecularWeight')return mode==='mass-molar';if(key==='targetMass')return mode==='mass';if(key==='targetMolar')return mode!=='mass'; }
  if(id==='virus-titer')return key==='mode'||(mode==='tcid50'?key==='tcidSeries':key!=='tcidSeries');
  return true;
}
