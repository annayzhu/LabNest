import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,openSync,closeSync,cpSync,existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
const out='docs/calculator/v1.3/evidence';mkdirSync(out+'/logs',{recursive:true});
const scripts=['run-v12','pipetting-v12','v12-database','refactor','legacy','compact-ui','plate','storage-appearance','appearance','integration','database','rejection','visual-v11','standalone-v11','ux-v13','formal-exports','navigation-icons','colony-v13','cache-clear-failure','copy-recent','transfection'];
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),base:process.env.LABNEST_E2E_BASE_URL,checks:[]};
for(const name of scripts){const path=`${out}/logs/${name}.log`,fd=openSync(path,'w');const start=Date.now();const result=spawnSync(process.execPath,[`scripts/verify-calculator-${name}.mjs`],{env:process.env,stdio:['ignore',fd,fd]});closeSync(fd);const entry={name,status:result.status===0?'通过':'失败',exitCode:result.status,durationMs:Date.now()-start,log:path};report.checks.push(entry);writeFileSync(out+'/acceptance-run.json',JSON.stringify(report,null,2));console.log(`${entry.status}: ${name} (${entry.durationMs} ms)`);if(result.status!==0)console.error(readFileSync(path,'utf8'));}
// Preserve this run's evidence without rewriting previous release reports in git.
function copyFresh(source,target){
 for(const entry of readdirSync(source,{withFileTypes:true})){
  const from=`${source}/${entry.name}`,to=`${target}/${entry.name}`;
  if(entry.isDirectory())copyFresh(from,to);
  else if(statSync(from).mtimeMs>=Date.parse(report.startedAt)){mkdirSync(target,{recursive:true});cpSync(from,to);}
 }
}
for(const [source,target] of [['docs/calculator/evidence','core'],['docs/calculator/v1.1/evidence','v11'],['docs/calculator/v1.2/evidence','v12'],['docs/calculator/blockers/evidence','blockers'],['docs/appearance/foundation/evidence','appearance']])if(existsSync(source))copyFresh(source,`${out}/regression/${target}`);
report.finishedAt=new Date().toISOString();writeFileSync(out+'/acceptance-run.json',JSON.stringify(report,null,2));if(report.checks.some(c=>c.status==='失败'))process.exitCode=1;
