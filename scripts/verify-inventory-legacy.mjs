import 'dotenv/config';
import pg from 'pg';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== '/labnest_stage_a_acceptance' || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Only the isolated local acceptance database may provision a synthetic migration database');
const name = `labnest_stage_a_legacy_${Date.now()}`;
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); await admin.end();
url.pathname = '/' + name;
const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
const migrations = readdirSync('prisma/migrations').filter(x => /^\d/.test(x)).sort();
try {
  for (const migration of migrations.filter(x => x < '20260908040000')) await client.query(readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  await client.query(`
    INSERT INTO "Experiment" (id,"runCode",title,"updatedAt") VALUES ('legacy-run','SYN-LEGACY','Synthetic old Run',now());
    INSERT INTO "InventoryItem" (id,name,"currentQuantity",unit,"updatedAt") VALUES ('legacy-parent','Synthetic legacy stock',80,'mL',now());
    INSERT INTO "InventoryItem" (id,name,"currentQuantity",unit,"parentInventoryItemId","aliquotCode","updatedAt") VALUES ('legacy-child','Synthetic legacy aliquot',5,'mL','legacy-parent','SYN-ALIQUOT',now());
    INSERT INTO "InventoryTransaction" (id,"inventoryItemId",type,"quantityChange",unit,"experimentId") VALUES ('legacy-transaction','legacy-parent','consume',-20,'mL','legacy-run');
    INSERT INTO "Attachment" (id,filename,"originalFilename","mimeType",size,"storagePath") VALUES ('legacy-attachment','synthetic.txt','synthetic.txt','text/plain',9,'synthetic-not-a-real-file');
    INSERT INTO "AttachmentLink" (id,"attachmentId","targetType","targetId") VALUES ('legacy-link','legacy-attachment','experiment','legacy-run');
  `);
  const tables = ['Experiment', 'InventoryItem', 'InventoryTransaction', 'Attachment', 'AttachmentLink'];
  const before = {};
  for (const table of tables) before[table] = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
  for (const migration of migrations.filter(x => x >= '20260908040000')) await client.query(readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8'));
  for (const table of tables) {
    const after = (await client.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
    assert.deepEqual(after.map(row => Object.fromEntries(Object.keys(before[table][0]).map(key => [key, row[key]]))), before[table], table + ' legacy columns preserved');
  }
  const items = (await client.query('SELECT "managementMode","quantityRecorded" FROM "InventoryItem"')).rows;
  assert.ok(items.every(x => x.managementMode === 'precise' && x.quantityRecorded === true));
  writeFileSync('docs/stage-20260908/A/evidence/legacy.json', JSON.stringify({ database: name, fixture: 'synthetic rows inserted into pre-A schema; no user records or actual attachment bytes', passed: tables, migrationCount: migrations.length, checks: ['Old IDs, quantities, transaction and experiment link, aliquot parent and attachment link unchanged', 'Legacy known quantities remain precise/recorded, not reset to unknown'] }, null, 2));
} finally { await client.end(); }
