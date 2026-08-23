'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint7-finance-${process.pid}-${Date.now()}.json`);
const { createServer, resetData, makeSeed, readDb, sprint7FinanceStateValid, resolveInternalCostRate, rollbackSprint7Finance, ssePermissionsForEvent } = require('../server.js');

let server; let baseUrl; let admin; let viewer;
async function request(route, options = {}, auth) { const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }; if (auth?.cookie) headers.cookie = auth.cookie; if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf; const response = await fetch(`${baseUrl}${route}`, { ...options, headers }); const text = await response.text(); let data; try { data = text ? JSON.parse(text) : undefined; } catch { data = text; } return { response, data }; }
async function login(email) { const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) }); assert.equal(result.response.status, 200); return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken, user: result.data.user }; }

before(async () => { resetData(makeSeed()); server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login('admin@northlight.fr'); viewer = await login('viewer@northlight.fr'); });
after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {} });

test('la migration Finance S7 est additive, privée et rejouable', () => {
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-7-finance-costs-v1');
  assert.ok(marker); assert.deepEqual(marker.collections, ['costRates', 'projectCosts', 'projectCostRevisions', 'financeIdempotency']); assert.equal(sprint7FinanceStateValid(db), true);
  assert.equal(fs.statSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile)).mode & 0o777, 0o600);
  assert.ok(admin.user.permissions.includes('finance.cost.manage')); assert.deepEqual(ssePermissionsForEvent('costRate.updated.v1'), ['finance.read']);
});

test('les coûts datés sont idempotents, sans chevauchement et résolus ressource avant catégorie', async () => {
  const resource = readDb().resources.find(value => value.id === 'resource_3'), categoryBody = JSON.stringify({ scopeType: 'resourceCategory', scopeId: resource.resourceCategoryId, unit: 'unite', costUnitMinor: '800', currency: 'EUR', validFrom: '2026-01-01', active: true });
  const category = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-category-1' }, body: categoryBody }, admin); assert.equal(category.response.status, 201, JSON.stringify(category.data));
  const directBody = JSON.stringify({ scopeType: 'resource', scopeId: resource.id, unit: 'unite', costUnitMinor: '1000', currency: 'EUR', validFrom: '2026-01-01', active: true }), direct = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-rate-1' }, body: directBody }, admin); assert.equal(direct.response.status, 201, JSON.stringify(direct.data));
  const replay = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-rate-1' }, body: directBody }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.id, direct.data.id);
  const overlap = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-overlap' }, body: JSON.stringify({ ...JSON.parse(directBody), validFrom: '2026-06-01', costUnitMinor: '1200' }) }, admin); assert.equal(overlap.response.status, 409); assert.equal(overlap.data.error.code, 'COST_RATE_PERIOD_OVERLAP');
  assert.equal(resolveInternalCostRate(readDb(), { companyId: resource.companyId, resourceId: resource.id, unit: 'unite', at: '2026-08-17' }).id, direct.data.id);
});

test('une dépense Projet confirmée est corrigée par révision append-only', async () => {
  const payload = JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', category: 'supplier', occurredOn: '2026-08-17', amountMinor: '5000', currency: 'EUR', description: 'Prestataire montage', status: 'confirmed' });
  const created = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'project-cost-1' }, body: payload }, admin); assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const corrected = await request(`/api/v1/finance/project-costs/${created.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'project-cost-patch-1' }, body: JSON.stringify({ version: 1, amountMinor: '6000', correctionReason: 'Facture fournisseur définitive' }) }, admin); assert.equal(corrected.response.status, 200); assert.equal(corrected.data.amountMinor, '6000'); assert.equal(corrected.data.version, 2);
  const db = readDb(), revision = db.projectCostRevisions.find(value => value.projectCostId === created.data.id); assert.equal(revision.snapshot.amountMinor, '5000'); assert.equal(revision.revisionNumber, 1); assert.equal(revision.snapshotDigest.length, 64);
  const terminalSource = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'project-cost-terminal-1' }, body: JSON.stringify({ ...JSON.parse(payload), description: 'Dépense à annuler', amountMinor: '100', status: 'draft' }) }, admin); assert.equal(terminalSource.response.status, 201);
  const cancelled = await request(`/api/v1/finance/project-costs/${terminalSource.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'project-cost-cancel-1' }, body: JSON.stringify({ version: 1, status: 'cancelled', correctionReason: 'Dépense finalement annulée' }) }, admin); assert.equal(cancelled.response.status, 200); assert.equal(cancelled.data.status, 'cancelled');
  const reopened = await request(`/api/v1/finance/project-costs/${terminalSource.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'project-cost-reopen-1' }, body: JSON.stringify({ version: 2, status: 'confirmed', correctionReason: 'Tentative de réouverture' }) }, admin); assert.equal(reopened.response.status, 409); assert.equal(reopened.data.error.code, 'PROJECT_COST_TERMINAL'); assert.equal(readDb().projectCosts.find(value => value.id === terminalSource.data.id).version, 2);
});

test('le coût réalisé est figé dans la révision et les marges restent réservées à finance.read', async () => {
  const reservation = readDb().reservations.find(value => value.id === 'reservation_1'), confirmed = await request(`/api/v1/reservations/${reservation.id}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'finance-actual-1' }, body: JSON.stringify({ reservationVersion: reservation.version }) }, admin); assert.equal(confirmed.response.status, 201, JSON.stringify(confirmed.data)); assert.equal(confirmed.data.currentRevision.costSnapshot.totalMinor, '1000');
  const rate = readDb().costRates.find(value => value.scopeType === 'resource' && value.scopeId === 'resource_3'), changed = await request(`/api/v1/finance/cost-rates/${rate.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'finance-rate-patch-1' }, body: JSON.stringify({ version: rate.version, costUnitMinor: '2000' }) }, admin); assert.equal(changed.response.status, 200);
  const detail = await request(`/api/v1/actuals/${confirmed.data.id}`, {}, admin); assert.equal(detail.response.status, 200); assert.equal(detail.data.currentRevision.costSnapshot.totalMinor, '1000');
  const margins = await request('/api/v1/analytics/margins?projectId=project_1&asOf=2026-08-23', {}, admin); assert.equal(margins.response.status, 200, JSON.stringify(margins.data)); assert.equal(margins.data.currency, 'EUR'); assert.equal(margins.data.totals.actualCostMinor, '7000');
  const denied = await request('/api/v1/analytics/margins?projectId=project_1', {}, viewer); assert.equal(denied.response.status, 403);
  const deniedCosts = await request('/api/v1/finance/project-costs', {}, viewer); assert.equal(deniedCosts.response.status, 403);
});

test('une falsification du snapshot de dépense ou du coût réel rend la base indisponible', () => {
  const raw = fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), tampered = JSON.parse(raw); tampered.projectCostRevisions[0].snapshot.amountMinor = '9999'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const actualTampered = JSON.parse(raw), revision = actualTampered.actualRevisions.find(value => value.digestVersion === 3); revision.costSnapshot.totalMinor = '9999'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(actualTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT'); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, raw, { mode: 0o600 });
  const referenceTampered = JSON.parse(raw); referenceTampered.costRates[0].scopeId = 'resource_absent'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(referenceTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const markerTampered = JSON.parse(raw); markerTampered.financeIdempotency[0].resultId = 'costRate_absent'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(markerTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT'); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, raw, { mode: 0o600 });
});

test('le rollback Finance exige un export privé et restaure exactement la source', () => {
  assert.throws(() => rollbackSprint7Finance(), error => error.code === 'ROLLBACK_EXPORT_REQUIRED');
  const before = readDb(), marker = before.migrations.find(value => value.id === 'sprint-7-finance-costs-v1'), expected = fs.readFileSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile), 'utf8'), exportFile = `${process.env.PLANIFY_DATA_FILE}.finance-export.json`, result = rollbackSprint7Finance({ exportFile });
  assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600); assert.equal(fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), expected); assert.match(result.restoredDigest, /^[a-f0-9]{64}$/);
});

test('la page Finance est autonome, accessible et sépare lecture et gestion', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), shell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8'), contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(shell, /href="#finance"[^>]*data-finance-nav/); assert.match(source, /Finance & marges/); assert.match(source, /can\('finance\.cost\.manage'\)/); assert.match(source, /data-cost-rate-form/); assert.match(source, /data-project-cost-form/); assert.match(source, /role="region" aria-label="Coûts internes" tabindex="0"/); assert.match(css, /\.finance-page/); assert.match(contract, /\/analytics\/margins:/); assert.match(contract, /CostRatePatchCommand:/); assert.match(contract, /ProjectCostPatchCommand:/);
});
