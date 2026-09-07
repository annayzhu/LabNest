import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {readdir,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
execFileSync('npx',['tsx','scripts/build-calculator-line-icons.tsx'],{stdio:'inherit'});
const source='assets/calculator-icons-v1.3/LabNest_Calculator_Icons_v1.3/icons',dest='public/icons/lab-soft-v1';
const report=[];
for(const name of (await readdir(source)).filter(n=>n.endsWith('.png')).sort()){
 const input=await readFile(`${source}/${name}`),meta=await sharp(input).metadata();
 if(!meta.hasAlpha)throw Error(`${name}: no alpha`);
 // Derivatives only; supplied originals stay byte-for-byte intact. Same optical padding for the new family.
 const output=await sharp(input).trim({background:'#00000000',threshold:8}).resize(104,104,{fit:'inside'}).extend({top:12,bottom:12,left:12,right:12,background:'#00000000'}).resize(128,128,{fit:'contain',background:'#00000000'}).png({palette:true,colours:128,effort:10}).toBuffer();
 await writeFile(`${dest}/${name}`,output);report.push({id:name.slice(0,-4),source:`${source}/${name}`,sourceSha256:createHash('sha256').update(input).digest('hex'),sourceWidth:meta.width,sourceHeight:meta.height,alpha:meta.hasAlpha,bytes:output.length});
}
const paths=(await readdir(dest)).filter(n=>n.endsWith('.png')).sort().map(n=>`/icons/lab-soft-v1/${n}`);
await writeFile(`${dest}/resources.json`,JSON.stringify(paths));
await mkdir('public/tools/free-plate-layout/icons/lab-soft-v1',{recursive:true});
for(const path of paths)await writeFile(`public/tools/free-plate-layout${path}`,await readFile(`public${path}`));
await writeFile(`${dest}/v1.3-manifest.json`,JSON.stringify({version:'1.3',derived:report,totalBytes:(await Promise.all(paths.map(async p=>(await readFile(`public${p}`)).length))).reduce((a,b)=>a+b,0)},null,2));

await writeFile('public/tools/free-plate-layout/icons/lab-soft-v1/resources.json',JSON.stringify(paths));
