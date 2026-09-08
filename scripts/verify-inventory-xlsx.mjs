import { acceptanceBase } from './stage-acceptance-env.mjs';
import { request } from 'playwright';
import writeXlsxFile from 'write-excel-file/node';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const api = await request.newContext({ baseURL: acceptanceBase });
const checks = [];
try {
  for (const module of ['inventory', 'purchases']) {
    const inventory = module === 'inventory';
    const headers = ['Custom name', 'Custom quantity', 'unit', ...(inventory ? ['managementMode'] : ['status'])];
    const values = ['Synthetic mapped XLSX ' + Date.now(), '2', 'box', inventory ? 'precise' : 'received'];
    const buffer = await writeXlsxFile([headers, values]).toBuffer();
    const file = { name: module + '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer };
    const mapping = JSON.stringify({ 'Custom name': inventory ? 'name' : 'title', 'Custom quantity': inventory ? 'currentQuantity' : 'quantity' });
    const response = await api.post(`/api/structured-import/${module}/preview`, { multipart: { file, mapping } });
    assert.equal(response.status(), 200, await response.text());
    const { preview } = await response.json(); assert.equal(preview.canImport, true, JSON.stringify(preview));
    const stale = await api.post(`/api/structured-import/${module}/confirm`, { multipart: { file, mapping: '{}', checksum: preview.checksum, confirmationToken: preview.confirmationToken } });
    assert.equal(stale.status(), 409, 'Changed mapping must invalidate confirmation');
    const confirmed = await api.post(`/api/structured-import/${module}/confirm`, { multipart: { file, mapping, checksum: preview.checksum, confirmationToken: preview.confirmationToken } });
    assert.equal(confirmed.status(), 201, await confirmed.text());
    if (inventory) { const {result} = await confirmed.json(); const saved = await (await api.get(`/api/inventory/${result.targets[0].targetId}/containers`)).json(); assert.equal(saved.transactions[0].type, 'adjust', 'Opening balance is not a fabricated arrival'); }
    checks.push(`${module}: XLSX custom column mapping imports independently; altered mapping rejected until re-preview`);
  }
} finally { writeFileSync('docs/stage-20260908/A/evidence/xlsx.json', JSON.stringify({ checks }, null, 2)); await api.dispose(); }
