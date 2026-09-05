import {prisma} from '../src/lib/db';
async function seed(){
 await prisma.experiment.upsert({where:{id:'calculator-acceptance-experiment'},update:{},create:{id:'calculator-acceptance-experiment',runCode:'CALC-ACCEPTANCE-20260906',title:'Calculator synthetic acceptance fixture',status:'running',steps:{create:{id:'calculator-acceptance-step',order:1,title:'Synthetic calculation',description:'Synthetic fixture; not an experimental result.'}}}});
 await prisma.experiment.upsert({where:{id:'calculator-archived-experiment'},update:{},create:{id:'calculator-archived-experiment',runCode:'CALC-ARCHIVED-20260906',title:'Archived calculator fixture',status:'archived',steps:{create:{id:'calculator-archived-step',order:1,title:'Archived step',description:'No write allowed.'}}}});
 await prisma.$disconnect();
}
seed().catch(error=>{console.error(error);process.exitCode=1;});
