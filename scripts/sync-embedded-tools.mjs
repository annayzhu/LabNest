// Rebuild only the embedding bundle. Source tools and their algorithms are read-only inputs.
import {copyFileSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=process.env.LABNEST_TOOL_SOURCE_ROOT;
if(!root)throw Error('Set LABNEST_TOOL_SOURCE_ROOT to the existing C_材料方法 directory');
const records=[];
const copy=(source,target)=>{mkdirSync(path.dirname(target),{recursive:true});copyFileSync(source,target);records.push({source,target,sha256:createHash('sha256').update(readFileSync(target)).digest('hex')});};
// Rebuild the maintained qPCR source independently; this script does not refresh it.
// See scripts/sync-qpcr-planner.mjs, scripts/sync-cnv-planner.mjs and docs/operations/tools-deployment.md.
const analyzer=path.join(root,'C_Taqman_CNV/CopyNumber_Analyzer');
for(const file of ['cnvtool.html','app.js','diagnostics.js','core.js','layout.js','styles.css','vendor/xlsx.full.min.js','THIRD_PARTY_NOTICES.md'])copy(path.join(analyzer,file),'public/tools/cnv-analysis/'+(file==='cnvtool.html'?'index.html':file));
writeFileSync('docs/qa/history/stage-20260908/D/SOURCES.json',JSON.stringify(records,null,2));
