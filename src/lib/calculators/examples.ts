import {changeTransfectionMaterial,exampleTransfectionPlan,newDoseReagent,newNucleicRow} from './transfection';

export type CalculatorExample = {name:string;nameZh:string;inputs:Record<string,unknown>};

function sirnaPlan(){const p=changeTransfectionMaterial(exampleTransfectionPlan(),'sirna');const g=p.groups[0];g.name='siRNA group';g.rows=[{...newNucleicRow('sirna'),name:'siTarget',stock:'20',dose:'10'}];g.finalVolume='600';g.reagent={...newDoseReagent(),name:'RNAiMAX',amount:'1'};g.order='Dilute, mix, add to cells';return p;}
const pbs=[{name:'NaCl',amount:'8',unit:'g'},{name:'KCl',amount:'0.2',unit:'g'},{name:'Na2HPO4',amount:'1.44',unit:'g'},{name:'KH2PO4',amount:'0.24',unit:'g'}];
const qpcr=(template:string)=>[{name:'2× SYBR Mix',volume:'10',premix:true},{name:'F',volume:'0.4',premix:true},{name:'R',volume:'0.4',premix:true},{name:template,volume:'2',premix:false},{name:'Water',volume:'7.2',premix:true}];

/** Named scenarios for tools with several modes; single-mode tools keep definition.exampleInputs. */
export const calculatorExamples: Record<string, CalculatorExample[]> = {
  hemocytometer:[
    {name:'Standard large squares, trypan blue',nameZh:'标准大方格：4 格计数，台盼蓝稀释',inputs:{countRegion:'standard',counts:'13,11,14,17',dilutionFactor:3,viabilityPercent:90}},
    {name:'Custom region: 0.04 mm² × 0.1 mm',nameZh:'自定义计数区：0.04 mm² × 0.1 mm',inputs:{countRegion:'custom',counts:'8,6,7,9,8',dilutionFactor:2,viabilityPercent:95,areaMm2:0.04,depthMm:0.1}},
  ],
  split:[
    {name:'Same flask size, 1:4',nameZh:'同尺寸容器：1:4 传代',inputs:{areaMode:'same',currentConfluency:90,splitRatio:4,targetConfluency:80,doublingTimeHours:24}},
    {name:'T25 into T75',nameZh:'不同容器：T25 传至 T75',inputs:{areaMode:'different',currentConfluency:90,splitRatio:3,targetConfluency:80,doublingTimeHours:24,sourceAreaCm2:25,targetAreaCm2:75}},
  ],
  transfection:[
    {name:'DNA plasmid, two tubes',nameZh:'DNA 质粒：双管配制',inputs:{transfectionPlan:exampleTransfectionPlan()}},
    {name:'siRNA with RNAiMAX',nameZh:'siRNA：RNAiMAX 转染',inputs:{transfectionPlan:sirnaPlan()}},
  ],
  'kill-curve':[
    {name:'Puromycin, linear 0.5–10 µg/mL',nameZh:'嘌呤霉素：线性 0.5–10 µg/mL',inputs:{scale:'linear',stockConcentration:10,minimum:0.5,maximum:10,points:8,volumePerWellMl:0.5}},
    {name:'G418, log 100–1000 µg/mL',nameZh:'G418：对数 100–1000 µg/mL',inputs:{scale:'log',stockConcentration:50,minimum:100,maximum:1000,points:6,volumePerWellMl:2}},
  ],
  cfu:[
    {name:'Viable count, 10⁻⁶ dilution',nameZh:'活菌计数：10⁻⁶ 稀释涂 100 µL',inputs:{colonies:120,dilution:0.000001,platedVolumeMl:0.1,dnaUg:0}},
    {name:'Transformation efficiency, 1 ng plasmid',nameZh:'转化效率：1 ng 质粒',inputs:{colonies:150,dilution:1,platedVolumeMl:0.1,dnaUg:0.001}},
  ],
  dilution:[
    {name:'10 mM stock to 2 mL of 10 µM',nameZh:'配至最终体积：10 mM 母液配 2 mL 10 µM',inputs:{mode:'final',stockConcentration:10,targetConcentration:10,finalVolume:2}},
    {name:'Dose 10 mL of medium to 10 µM',nameZh:'向已有液体加药：10 mL 培养基加至 10 µM',inputs:{mode:'add',stockConcentration:10,targetConcentration:10,initialConcentration:0,finalVolume:10}},
    {name:'10× PBS to 500 mL of 1×',nameZh:'倍液：10× PBS 配 500 mL 1×',inputs:{mode:'fold',stockFold:10,targetFold:1,finalVolume:500}},
    {name:'1:100 dilution, 10 mL',nameZh:'1:N 稀释：1:100，最终 10 mL',inputs:{mode:'ratio',ratio:100,finalVolume:10}},
    {name:'Stock:diluent 1:4, 5 mL',nameZh:'母液:稀释液：1:4，最终 5 mL',inputs:{mode:'parts',stockParts:1,diluentParts:4,finalVolume:5}},
  ],
  'serial-dilution':[
    {name:'10-fold × 6 from 100 µM',nameZh:'等倍连续：100 µM 起，10 倍 × 6 级',inputs:{gradientMode:'geometric',startingConcentration:100,dilutionFactor:10,levels:6,totalVolumePerLevel:100}},
    {name:'3-fold × 8 from a 10 mM stock',nameZh:'从 10 mM 母液起：3 倍 × 8 级，转移后保留',inputs:{gradientMode:'geometric',firstSource:'stock',volumeMode:'retained',sourceConcentration:10000,startingConcentration:100,dilutionFactor:3,levels:8,totalVolumePerLevel:100}},
    {name:'Linear 100–10 µM, 10 points',nameZh:'线性并行：100–10 µM 共 10 点',inputs:{gradientMode:'linear',startingConcentration:100,endingConcentration:10,levels:10,totalVolumePerLevel:100,sourceConcentration:1000}},
    {name:'Custom 50, 20, 10, 5, 1 µM',nameZh:'自定义浓度：50/20/10/5/1 µM',inputs:{gradientMode:'custom',customTargets:'50\n20\n10\n5\n1',sourceConcentration:1000,totalVolumePerLevel:200}},
  ],
  molarity:[
    {name:'Weigh glucose for 100 mL of 0.1 M',nameZh:'称量质量：配 100 mL 0.1 M 葡萄糖',inputs:{mode:'mass',molecularWeight:180.16,concentrationM:0.1,volumeL:0.1,purityPercent:100}},
    {name:'2.922 g NaCl in 50 mL',nameZh:'求浓度：2.922 g NaCl 溶于 50 mL',inputs:{mode:'concentration',molecularWeight:58.44,massG:2.922,volumeL:0.05,purityPercent:100}},
    {name:'12.114 g Tris to 1 M',nameZh:'求体积：12.114 g Tris 配成 1 M',inputs:{mode:'volume',molecularWeight:121.14,massG:12.114,concentrationM:1,purityPercent:100}},
  ],
  'percent-solution':[
    {name:'5% (w/v), 500 mL',nameZh:'质量/体积：500 mL 5% 脱脂奶粉',inputs:{type:'w/v',percentage:5,targetVolumeMl:500}},
    {name:'70% ethanol (v/v), 100 mL',nameZh:'体积/体积：100 mL 70% 乙醇',inputs:{type:'v/v',percentage:70,targetVolumeMl:100}},
    {name:'10% (w/w), 50 g',nameZh:'质量/质量：50 g 10% 溶液',inputs:{type:'w/w',percentage:10,targetMassG:50}},
  ],
  'media-recipe':[
    {name:'LB broth 25 g/L, make 500 mL',nameZh:'定容：LB 25 g/L，配 500 mL',inputs:{recipeMode:'final',baseVolumeMl:1000,targetVolumeMl:500,recipeRows:[{name:'LB broth powder',amount:'25',unit:'g'}]}},
    {name:'Complete DMEM: FBS and Pen/Strep',nameZh:'添加：500 mL DMEM 加 FBS 与双抗',inputs:{recipeMode:'add',baseVolumeMl:500,targetVolumeMl:500,recipeRows:[{name:'FBS',amount:'50',unit:'mL'},{name:'Pen/Strep',amount:'5',unit:'mL'}]}},
  ],
  'buffer-recipe':[
    {name:'1× PBS, make 500 mL',nameZh:'定容：1× PBS 按 1 L 配方配 500 mL',inputs:{recipeMode:'final',baseVolumeMl:1000,targetVolumeMl:500,recipeRows:pbs}},
    {name:'RIPA + inhibitors, 50 mL',nameZh:'添加：50 mL RIPA 加蛋白酶抑制剂与 PMSF',inputs:{recipeMode:'add',baseVolumeMl:50,targetVolumeMl:50,recipeRows:[{name:'Protease inhibitor (100×)',amount:'0.5',unit:'mL'},{name:'PMSF (100 mM)',amount:'0.5',unit:'mL'}]}},
  ],
  'ic50-ec50':[
    {name:'EC50, rising response',nameZh:'EC50：激活反应（上升）',inputs:{mode:'activation',concentrationUnit:'µM',points:'0.1,1\n1,10\n10,50\n100,90\n1000,99'}},
    {name:'IC50, remaining activity',nameZh:'IC50：残存活性（下降）',inputs:{mode:'inhibition',concentrationUnit:'nM',points:'0.1,98\n1,95\n10,75\n100,30\n1000,8\n10000,3'}},
  ],
  'master-mix':[
    {name:'qPCR, one mix',nameZh:'单组：8 样本 × 3 重复 qPCR',inputs:{samples:8,replicates:3,controls:2,overagePercent:10,reactionVolumeUl:20,rows:[{name:'2× Mix',volume:'10',premix:true},{name:'F',volume:'0.5',premix:true},{name:'R',volume:'0.5',premix:true},{name:'Template',volume:'2',premix:false},{name:'Water',volume:'7',premix:true}]}},
    {name:'qPCR, two primer sets',nameZh:'多组：GAPDH 与目的基因两组引物',inputs:{overagePercent:10,reactionVolumeUl:20,groups:[{name:'GAPDH',reactions:'12',rows:qpcr('cDNA')},{name:'Target',reactions:'12',rows:qpcr('cDNA')}]}},
  ],
  'dna-rna-conversion':[
    {name:'dsDNA, 500 bp PCR product',nameZh:'双链DNA：500 bp PCR 产物',inputs:{type:'dsDNA',length:500,massUg:1,volumeUl:20}},
    {name:'ssDNA, 20 nt primer',nameZh:'单链DNA：20 nt 引物',inputs:{type:'ssDNA',length:20,massUg:10,volumeUl:100}},
    {name:'RNA, 1.5 kb transcript',nameZh:'RNA：1.5 kb 转录本',inputs:{type:'RNA',length:1500,massUg:2,volumeUl:20}},
  ],
  'wb-loading':[
    {name:'Add reducing agent separately',nameZh:'单样本：还原剂单独按体积比例加入',inputs:{sampleConcentrationUgUl:2,targetProteinUg:20,finalLoadingVolumeUl:20,bufferFold:4,bufferContainsReducingAgent:'no',reducingMode:'volume-fraction',reducingAgentName:'β-mercaptoethanol',reducingAgentPercent:5}},
    {name:'β-ME to 2.5% final',nameZh:'单样本：β-巯基乙醇终浓度 2.5%',inputs:{sampleConcentrationUgUl:2,targetProteinUg:20,finalLoadingVolumeUl:20,bufferFold:4,bufferContainsReducingAgent:'no',reducingMode:'target-concentration',reducingAgentName:'β-mercaptoethanol',reducingStockPercent:100,reducingAgentPercent:2.5}},
    {name:'Batch of 3, buffer already reducing',nameZh:'批量：3 个样品，Buffer 已含还原剂',inputs:{targetProteinUg:20,finalLoadingVolumeUl:20,bufferFold:4,bufferContainsReducingAgent:'yes',samples:[{id:'Ctrl',concentration:'2.1',available:''},{id:'KD-1',concentration:'1.6',available:''},{id:'KD-2',concentration:'2.8',available:''}]}},
  ],
  'virus-titer':[
    {name:'Plaque assay',nameZh:'噬菌斑法：10⁻⁶ 稀释 20 个斑',inputs:{mode:'plaque',plaques:20,dilution:0.000001,inoculumMl:0.1}},
    {name:'TCID50, 8 wells per dilution',nameZh:'TCID50：每稀释度 8 孔',inputs:{mode:'tcid50',tcidSeries:'0.001,8,8\n0.0001,6,8\n0.00001,2,8\n0.000001,0,8'}},
  ],
  'unit-converter':[
    {name:'1 mL to µL',nameZh:'体积：1 mL → µL',inputs:{dimension:'volume',value:1,fromUnit:'mL',toUnit:'µL'}},
    {name:'250 mg to g',nameZh:'质量：250 mg → g',inputs:{dimension:'mass',value:250,fromUnit:'mg',toUnit:'g'}},
    {name:'1 mM to µM',nameZh:'浓度：1 mM → µM',inputs:{dimension:'concentration',value:1,fromUnit:'mM',toUnit:'µM'}},
    {name:'37 °C to °F',nameZh:'温度：37 °C → °F',inputs:{dimension:'temperature',value:37,fromUnit:'°C',toUnit:'°F'}},
  ],
  centrifuge:[
    {name:'10,000 rpm to ×g',nameZh:'RPM 转 RCF：10,000 rpm，半径 10 cm',inputs:{mode:'rpm-to-rcf',rpm:10_000,radiusCm:10}},
    {name:'12,000 ×g to rpm',nameZh:'RCF 转 RPM：12,000 ×g，半径 8.4 cm',inputs:{mode:'rcf-to-rpm',rcf:12_000,radiusCm:8.4}},
  ],
  resuspension:[
    {name:'25 nmol primer to 100 µM',nameZh:'物质的量：25 nmol 引物复溶至 100 µM',inputs:{mode:'amount',amount:25,targetMolar:100}},
    {name:'5 mg protein to 1 mg/mL',nameZh:'质量：5 mg 蛋白复溶至 1 mg/mL',inputs:{mode:'mass',mass:5,targetMass:1}},
    {name:'10 mg compound to 10 mM',nameZh:'质量＋分子量：10 mg 化合物配 10 mM',inputs:{mode:'mass-molar',mass:10,molecularWeight:500,targetMolar:10,targetMolarUnit:'mM'}},
  ],
};
