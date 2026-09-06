import sharp from 'sharp';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const records=JSON.parse(await readFile('docs/calculator/v1.1/icons-generation.json','utf8'));
const dir='public/icons/lab-soft-v1';await mkdir(dir,{recursive:true});await mkdir('public/tools/free-plate-layout/icons/lab-soft-v1',{recursive:true});
const manifest={id:'lab-soft',version:1,name:'Lab soft',fallback:'classic-line',modeTreatment:'Dark surfaces use a neutral contrast plate; same alpha asset',assets:[]};
for(const record of records){
 const raw=await sharp(record.source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height,channels}=raw.info;let minX=width,minY=height,maxX=-1,maxY=-1,transparent=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=raw.data[(y*width+x)*channels+3];if(alpha===0)transparent++;if(alpha>10){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 if(transparent/(width*height)<.1||minX===0||minY===0||maxX===width-1||maxY===height-1)throw Error(record.id+': missing genuine alpha or cropped subject');
 // Deterministic export normalization only: preserve drawing, normalize occupied area to 96 of 128 pixels.
 const icon=await sharp(record.source).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).resize(96,96,{fit:'contain',background:'#00000000'}).extend({top:16,bottom:16,left:16,right:16,background:'#00000000'}).png({palette:true,colours:128,compressionLevel:9}).toBuffer();
 if(icon.length>30000)throw Error(record.id+': size budget');
 const path=`${dir}/${record.id}.png`;await writeFile(path,icon);await copyFile(path,`public/tools/free-plate-layout/icons/lab-soft-v1/${record.id}.png`);
 manifest.assets.push({taskIcon:record.id,path:`/icons/lab-soft-v1/${record.id}.png`,width:128,height:128,bytes:icon.length,sha256:createHash('sha256').update(icon).digest('hex'),sourceSha256:createHash('sha256').update(await readFile(record.source)).digest('hex'),sourceTransparentFraction:transparent/(width*height),sourceBounds:[minX,minY,maxX,maxY]});
}
await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
