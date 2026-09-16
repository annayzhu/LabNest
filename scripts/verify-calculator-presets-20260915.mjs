import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3251',dir='docs/calculator/presets-20260915/evidence';await mkdir(dir,{recursive:true});
const browser=await chromium.launch();const checks=[];
try{for(const width of [1440,390])for(const mode of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:mode});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/tools/calculator/master-mix',{waitUntil:'networkidle'});
 assert.equal(await p.getByText('Offline pages',{exact:true}).isVisible(),false);
 assert.equal(await p.getByRole('textbox',{name:'Preset name',exact:true}).count(),0);
 const save=p.getByRole('button',{name:'Save as preset',exact:true});assert(await save.isVisible());
 await p.getByRole('button',{name:'Load example',exact:true}).click();
 const calculate=p.getByRole('button',{name:'Calculate',exact:true});const calcBox=await calculate.boundingBox(),presetBox=await save.boundingBox();assert(presetBox.y+presetBox.height<=calcBox.y);
 await save.click();await p.getByRole('textbox',{name:'Preset name',exact:true}).fill('PCR long name with units µL and template');await p.getByRole('button',{name:'Save',exact:true}).click();
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('labnest.calculators.v1')).presets[0]);assert.equal(Number(saved.inputs.reactionVolumeUl),20);assert(saved.methodVersion);assert.equal(saved.source,'synthetic example');
 const samples=p.getByRole('textbox',{name:'Samples',exact:true});await samples.fill('11');
 await p.getByRole('combobox',{name:'Presets',exact:true}).selectOption(saved.id);await p.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await samples.inputValue(),'11');
 await p.getByRole('combobox',{name:'Presets',exact:true}).selectOption(saved.id);await p.getByRole('button',{name:'Load',exact:true}).click();assert.equal(await samples.inputValue(),'8');assert.equal(await p.locator('[data-calculator-result]').count(),0);
 await p.locator('summary').getByText('Manage presets',{exact:true}).click();await p.getByRole('button',{name:'Rename '+saved.name,exact:true}).click();await p.getByRole('textbox',{name:'Preset name',exact:true}).fill('PCR renamed');await p.getByRole('button',{name:'Save',exact:true}).click();
 await p.reload({waitUntil:'networkidle'});assert(await p.getByRole('combobox',{name:'Presets',exact:true}).locator('option').filter({hasText:'PCR renamed'}).count());
 await p.evaluate(()=>{const key='labnest.calculators.v1',s=JSON.parse(localStorage.getItem(key));s.presets=Array.from({length:14},(_,i)=>({...s.presets[0],id:'preset-'+i,name:'PCR long searchable preset '+i}));localStorage.setItem(key,JSON.stringify(s));});await p.reload({waitUntil:'networkidle'});
 await p.getByText('Choose / manage presets',{exact:true}).click();await p.getByRole('textbox',{name:'Search presets',exact:true}).fill('preset 13');await p.getByRole('textbox',{name:'Search presets',exact:true}).press('Enter');assert.equal(await p.getByRole('textbox',{name:'Search presets',exact:true}).evaluate(el=>el.form),null);assert.deepEqual((await p.locator('[role=alert]').allTextContents()).filter(Boolean),[]);assert.equal(await p.locator('.calculator-preset-list > div').count(),1);
 await p.getByRole('button',{name:'Delete PCR long searchable preset 13',exact:true}).click();await p.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await p.locator('.calculator-preset-list > div').count(),0);
 await p.getByText('Choose / manage presets',{exact:true}).click();
 await p.screenshot({path:`${dir}/presets-${width}-${mode}.png`,fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await p.locator('.calculator-more > summary').click();await p.getByRole('button',{name:'Offline use',exact:true}).click();const panel=p.getByRole('dialog',{name:'Offline use',exact:true});assert(await panel.isVisible());assert.equal(await panel.locator('details').count(),0);await p.screenshot({path:`${dir}/offline-${width}-${mode}.png`});await p.keyboard.press('Escape');assert.equal(await panel.isVisible(),false);
 assert.deepEqual(errors,[]);checks.push({width,mode,status:'passed',checks:['empty save-only row','presets precede calculation in the input header','save metadata and units','cancel keeps edited input','load resets manual output','rename persists after refresh','many searchable presets','delete confirmed','single offline panel','no outer overflow']});await context.close();
}
 const c=await browser.newContext(),p=await c.newPage();await p.goto(base+'/tools/calculator/unit-converter',{waitUntil:'networkidle'});
 await p.evaluate(()=>{const k='labnest.calculators.v1',s=JSON.parse(localStorage.getItem(k));s.presets=[{id:'mass',calculatorId:'unit-converter',name:'Mass reference',createdAt:'2026-09-15',methodVersion:'unit-converter-v1',inputs:{dimension:'mass',value:2,fromUnit:'mg',toUnit:'µg'}}];localStorage.setItem(k,JSON.stringify(s));});await p.reload({waitUntil:'networkidle'});await p.getByRole('combobox',{name:'Presets',exact:true}).selectOption('mass');await p.getByRole('button',{name:'Load',exact:true}).click();assert.equal(await p.getByRole('combobox',{name:'From unit',exact:true}).inputValue(),'mg');assert.equal(await p.getByRole('combobox',{name:'To unit',exact:true}).inputValue(),'µg');assert((await p.locator('[data-calculator-result]').innerText()).replaceAll(',','').includes('2000'));checks.push({status:'passed',check:'cross-dimension preset retains mg to µg and computes 2000'});await c.close();
}finally{await browser.close();await writeFile(dir+'/browser.json',JSON.stringify({base,at:new Date().toISOString(),checks},null,2));}
