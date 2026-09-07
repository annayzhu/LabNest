import 'dotenv/config';
import pg from 'pg';
import {spawnSync,spawn} from 'node:child_process';
const source=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(source.hostname))throw new Error('Acceptance database must be local');
const name='labnest_calculator_acceptance_20260906';
const client=new pg.Client({connectionString:source.toString()});await client.connect();
if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await client.query(`CREATE DATABASE ${name}`);
await client.end();source.pathname=`/${name}`;process.env.DATABASE_URL=source.toString();
for(const args of [['prisma','migrate','deploy'],['tsx','scripts/seed-calculator-acceptance.ts'],['tsx','scripts/seed-calculator-run-v12.ts']]){
 const result=spawnSync('npx',args,{env:process.env,stdio:'pipe',encoding:'utf8'});if(result.status!==0){console.error(result.stderr);process.exit(result.status??1);}console.log(`${args.join(' ')} succeeded in isolated database`);
}
process.env.LABNEST_BUILD_DIR='.next/calculator-production';process.env.LABNEST_TSCONFIG_PATH='tsconfig.calculator.json';
const child=spawn('npm',['run','start','--','--port','3221'],{env:process.env,stdio:'inherit'});process.on('SIGINT',()=>child.kill('SIGINT'));await new Promise(resolve=>child.on('exit',resolve));
