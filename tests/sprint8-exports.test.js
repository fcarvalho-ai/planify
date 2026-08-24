'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint8-exports-${process.pid}-${Date.now()}.json`);
const { createServer, exportXlsxBuffer, makeSeed, planningExportRows, resetData } = require('../server.js');

function authFor(db, permissions, overrides = {}) {
  const companyId = db.companies[0].id;
  return { user: { id: 'user_export', companyId, organizationScope: true, siteIds: db.sites.filter(value => value.companyId === companyId).map(value => value.id), organizationUnitIds: [], projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: permissions, ...overrides } };
}

test('S8-B construit un XLSX local valide et neutralise les formules injectées', () => {
  const workbook = exportXlsxBuffer('Contrôle', ['Libellé', 'Valeur'], [['=2+2', 4], ['@commande', 1]]), raw = workbook.toString('utf8');
  assert.equal(workbook.subarray(0, 2).toString(), 'PK');
  assert.match(raw, /xl\/worksheets\/sheet1\.xml/);
  assert.match(raw, /&apos;=2\+2/);
  assert.match(raw, /&apos;@commande/);
});

test('S8-B applique les scopes avant de produire les lignes Planning', () => {
  const db = makeSeed(), visible = db.projects.find(value => value.companyId === db.companies[0].id), hidden = db.projects.find(value => value.companyId === visible.companyId && value.id !== visible.id);
  const auth = authFor(db, ['planning.read', 'project.read'], { organizationScope: false, siteIds: [visible.siteId], projectScopeRestricted: true, projectIds: [visible.id], entityScopes: { project: [visible.id], client: [visible.clientId], reservation: db.reservations.filter(value => value.projectId === visible.id).map(value => value.id), resource: db.resources.filter(value => value.siteId === visible.siteId).map(value => value.id) } });
  const output = planningExportRows(db, auth, { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(output.items.every(value => db.reservations.find(item => item.id === value.reservationId)?.projectId === visible.id), true);
  assert.throws(() => planningExportRows(db, auth, { from: '2026-01-01', to: '2026-12-31', projectId: hidden.id }), error => error.status === 404);
});

test('S8-B expose Planning XLSX/PDF et KPI XLSX avec bornes et permissions', async t => {
  resetData(makeSeed()); const server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {} });
  const base = `http://127.0.0.1:${server.address().port}`, login = async email => { const response = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo2026' }) }); return response.headers.get('set-cookie').split(';', 1)[0]; }, admin = await login('admin@northlight.fr'), viewer = await login('viewer@northlight.fr');
  const xlsx = await fetch(`${base}/api/v1/exports/planning.xlsx?from=2026-08-01&to=2026-08-31`, { headers: { cookie: admin } }), xlsxBuffer = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(xlsx.status, 200); assert.match(xlsx.headers.get('content-type'), /spreadsheetml/); assert.equal(xlsxBuffer.subarray(0, 2).toString(), 'PK'); assert.match(xlsxBuffer.toString('utf8'), /ID réservation/);
  const pdf = await fetch(`${base}/api/v1/exports/planning.pdf?from=2026-08-01&to=2026-08-31`, { headers: { cookie: admin } }), pdfBuffer = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdf.status, 200); assert.equal(pdfBuffer.subarray(0, 8).toString(), '%PDF-1.4'); assert.match(pdfBuffer.toString('latin1'), /Planning des reservations/); assert.doesNotMatch(pdfBuffer.toString('latin1'), /costUnitMinor|Marge interne/);
  const kpi = await fetch(`${base}/api/v1/dashboards/finance/export.xlsx?asOf=2026-08-23`, { headers: { cookie: admin } }), kpiBuffer = Buffer.from(await kpi.arrayBuffer());
  assert.equal(kpi.status, 200); assert.equal(kpiBuffer.subarray(0, 2).toString(), 'PK'); assert.match(kpiBuffer.toString('utf8'), /invoicedRevenue/); assert.match(kpiBuffer.toString('utf8'), /Indisponible|unavailable/);
  const forbidden = await fetch(`${base}/api/v1/dashboards/finance/export.xlsx?asOf=2026-08-23`, { headers: { cookie: viewer } }); assert.equal(forbidden.status, 403);
  const invalid = await fetch(`${base}/api/v1/exports/planning.xlsx?from=2025-01-01&to=2026-08-31`, { headers: { cookie: admin } }); assert.equal(invalid.status, 422); assert.equal((await invalid.json()).error.code, 'EXPORT_PERIOD_INVALID');
});

test('S8-B câble les exports dans les interfaces et OpenAPI', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(app, /Exporter les KPI Excel/); assert.match(app, /Export Excel/); assert.match(app, /Export PDF/);
  assert.match(openapi, /\/exports\/planning\.xlsx:/); assert.match(openapi, /\/exports\/planning\.pdf:/); assert.match(openapi, /\/dashboards\/\{kind\}\/export\.xlsx:/);
});
