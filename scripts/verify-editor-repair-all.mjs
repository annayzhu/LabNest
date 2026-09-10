import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync,writeFileSync,readFileSync} from 'node:fs';
const dir='docs/editor-repair/evidence';mkdirSync(dir,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),checks:[]};
function run(name,args,env={}){const fd=openSync(`${dir}/${name}.log`,'w');const result=spawnSync(process.execPath,args,{env:{...process.env,...env},stdio:['ignore',fd,fd]});closeSync(fd);report.checks.push({name,status:result.status===0?'passed':'failed',exitCode:result.status});writeFileSync(`${dir}/acceptance.json`,JSON.stringify(report,null,2));console.log(`${name}: ${result.status===0?'passed':'failed'}`);if(result.status!==0)console.error(readFileSync(`${dir}/${name}.log`,'utf8'));return result.status===0;}
if(run('seed',['--import','tsx','scripts/seed-editor-repair.ts']))for(const phase of ['print','ime','media-controls','metadata','image-recovery','roundtrip','template','run'])run(phase,['scripts/verify-editor-repair.mjs'],{EDITOR_CHECK:phase});
report.finishedAt=new Date().toISOString();writeFileSync(`${dir}/acceptance.json`,JSON.stringify(report,null,2));if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
