import 'dotenv/config';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
const url=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Isolated local DB required');url.pathname='/labnest_calculator_acceptance_20260906';
const client=new pg.Client({connectionString:url.toString()});await client.connect();
try{
 const report=JSON.parse(await readFile('docs/calculator/evidence/integration-report.json','utf8'));const wb=JSON.parse(await readFile('docs/calculator/v1.1/evidence/appearance-browser-report.json','utf8'));assert(wb.wbResultId,'WB browser fixture did not finish');
 const replay=await client.query('SELECT id,"experimentId","experimentStepId","valuesJson" FROM "Result" WHERE "clientMutationId"=$1',[report.clientMutationId]);assert.equal(replay.rowCount,1);assert.equal(replay.rows[0].id,report.resultId);assert.equal(replay.rows[0].experimentId,'calculator-acceptance-experiment');assert.equal(replay.rows[0].experimentStepId,'calculator-acceptance-step');
 const actual=await client.query('SELECT "valuesJson","contentJson","provenanceJson" FROM "Result" WHERE id=$1',[wb.wbResultId]);assert.equal(actual.rowCount,1);const snapshot=actual.rows[0].valuesJson;assert.deepEqual(actual.rows[0].contentJson.snapshot,snapshot);assert.deepEqual(['sampleUl','bufferUl','reducingAgentUl','diluentUl'].map(k=>snapshot.table[0][k]),[10,5,1,4]);assert(snapshot.warnings.some(w=>w.includes('below configured minimum')));assert(snapshot.structuredWarnings.length>0);assert.equal(snapshot.displayUnits['table:sampleUl'],'µL');assert.equal(actual.rows[0].provenanceJson.operator,'Acceptance fixture operator');
 const checks=['I04 replay creates exactly one database Result linked to fixture step','I06 WB Result database contains complete components, raw inputs, display units, warnings, notes and operator'];await writeFile('docs/calculator/v1.1/evidence/database-report.json',JSON.stringify({resultId:report.resultId,wbResultId:wb.wbResultId,checks,completedAt:new Date().toISOString()},null,2));console.log(checks);
}finally{await client.end();}
