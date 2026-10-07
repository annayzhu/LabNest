import {readdir,readFile,writeFile} from 'node:fs/promises';
import {DOMParser} from '@xmldom/xmldom';

const root='public/icons/lab-solid-v1';
const shapes=[],svg={};
for(const name of (await readdir(root)).filter(name=>name.endsWith('.svg')).sort()){
 const source=await readFile(`${root}/${name}`,'utf8');
 const doc=new DOMParser().parseFromString(source,'image/svg+xml');
 if(doc.documentElement.getAttribute('viewBox')!=='0 0 24 24'||/script|href|style|\son\w+=|#fff|white|animate|filter/i.test(source))throw new Error(`Unsafe or incompatible icon: ${name}`);
 svg[name.slice(0,-4)]=source.replace('<svg ', '<svg aria-hidden="true" focusable="false" data-calculator-icon="'+name.slice(0,-4)+'" ');
 const body=source.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').trim().replace(/fill-rule=/g,'fillRule=').replace(/clip-rule=/g,'clipRule=');
 shapes.push(`  ${JSON.stringify(name.slice(0,-4))}: <>${body}</>,`);
}
await writeFile('src/components/calculators/solid-icon-shapes.tsx',`// Generated from editable, validated public/icons/lab-solid-v1/*.svg.\nexport const solidIconShapes = {\n${shapes.join('\n')}\n} as const;\n`);
console.log(`${shapes.length} solid calculator icons generated`);

await writeFile('src/lib/calculators/solid-icon-svg.json',JSON.stringify(svg,null,2)+'\n');
