import {spawnSync,spawn} from 'node:child_process';
const url=new URL(process.env.DATABASE_URL??'');
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/labnest_ai_provider_acceptance_20261008')throw Error('Only the isolated AI acceptance database is permitted');
const migrated=spawnSync('npx',['prisma','migrate','deploy'],{env:process.env,stdio:'inherit'});
if(migrated.status!==0)process.exit(migrated.status??1);
const child=spawn('npm',['run','start','--','--port',process.env.AI_APP_PORT??'3338'],{env:process.env,stdio:'inherit'});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
await new Promise(resolve=>child.on('exit',code=>{process.exitCode=code??0;resolve();}));
