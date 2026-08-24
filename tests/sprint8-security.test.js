'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-s8-security-${process.pid}-${Date.now()}.json`);

const { createServer, resetData, makeSeed, readDb } = require('../server.js');

let server;
let baseUrl;
let admin;
let planner;

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const raw = Buffer.from(await response.arrayBuffer());
  let data = raw;
  if (contentType.includes('json')) data = raw.length ? JSON.parse(raw.toString('utf8')) : undefined;
  return { response, data, raw };
}

async function login(email) {
  const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) });
  assert.equal(result.response.status, 200);
  return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken, user: result.data.user };
}

before(async () => {
  resetData(makeSeed());
  const db = readDb();
  for (const role of db.roles.filter(value => value.companyId === 'company_northlight' && value.code.toLowerCase() === 'planner')) role.permissions = role.permissions.filter(permission => permission !== 'planning.override_conflict');
  resetData(db);
  server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  admin = await login('admin@northlight.fr');
  planner = await login('planner@northlight.fr');
  assert.equal(planner.user.permissions.includes('planning.write'), true);
  assert.equal(planner.user.permissions.includes('planning.override_conflict'), false);
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const suffix of ['', '.tmp']) try { fs.unlinkSync(`${process.env.PLANIFY_DATA_FILE}${suffix}`); } catch {}
});

const conflictingReservation = overrides => ({
  title: 'S8-D dérogation', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
  startsAt: '2026-08-17T07:30:00.000Z', endsAt: '2026-08-17T08:30:00.000Z',
  resources: [{ resourceId: 'resource_3', quantity: 1 }],
  conflictPolicy: 'override', overrideReason: 'Conflit autorisé pour continuité de production',
  ...overrides,
});

async function stateCounts() {
  const [reservations, audits, events] = await Promise.all([
    request('/api/v1/reservations?pageSize=1000', {}, admin),
    request('/api/v1/audit?pageSize=1000', {}, admin),
    request('/api/v1/domain-events?limit=1000', {}, admin),
  ]);
  return { reservations: reservations.data.items.length, audits: audits.data.items.length, events: events.data.data.length };
}

test('S8-D refuse permission, motif et version sans réservation, audit ni événement', async () => {
  const before = await stateCounts();
  const forbidden = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': 's8d-forbidden' }, body: JSON.stringify(conflictingReservation()) }, planner);
  assert.equal(forbidden.response.status, 403);
  assert.equal(forbidden.data.error.code, 'PLANNING_OVERRIDE_FORBIDDEN');

  for (const [key, override] of [['missing', { overrideReason: '' }], ['short', { overrideReason: 'x' }]]) {
    const result = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': `s8d-${key}` }, body: JSON.stringify(conflictingReservation(override)) }, admin);
    assert.equal(result.response.status, 422);
    assert.equal(result.data.error.code, 'PLANNING_OVERRIDE_REASON_REQUIRED');
  }

  const stale = await request('/api/v1/reservations/reservation_1', { method: 'PATCH', headers: { 'Idempotency-Key': 's8d-version' }, body: JSON.stringify({ version: 999, conflictPolicy: 'override', overrideReason: 'Motif valide' }) }, admin);
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error.code, 'VERSION_CONFLICT');

  const batch = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 's8d-batch-rollback' }, body: JSON.stringify({ actions: [
    { type: 'create', title: 'Première action', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2030-01-10T08:00:00.000Z', endsAt: '2030-01-10T09:00:00.000Z', resources: [{ resourceId: 'resource_3', quantity: 1 }] },
    { type: 'create', ...conflictingReservation({ overrideReason: 'x' }) },
  ] }) }, admin);
  assert.equal(batch.response.status, 422);
  assert.equal(batch.data.error.code, 'PLANNING_OVERRIDE_REASON_REQUIRED');
  assert.deepEqual(await stateCounts(), before);
});

test('S8-D accepte une dérogation motivée, trace le contexte et rejoue sans second effet', async () => {
  const before = await stateCounts(), payload = conflictingReservation();
  const created = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': 's8d-success' }, body: JSON.stringify(payload) }, admin);
  assert.equal(created.response.status, 201);
  assert.equal(created.data.conflictOverride, true);
  assert.equal(created.data.overrideReason, payload.overrideReason);

  const afterCreate = await stateCounts();
  assert.deepEqual(afterCreate, { reservations: before.reservations + 1, audits: before.audits + 1, events: before.events + 1 });
  const audit = (await request('/api/v1/audit?pageSize=1000', {}, admin)).data.items.find(value => value.entityId === created.data.id);
  assert.equal(audit.details.overrideReason, payload.overrideReason);
  assert.ok(audit.details.conflicts.length > 0);
  assert.equal(audit.before, null);
  assert.equal(audit.after.conflictOverride, true);
  assert.ok(audit.operationId);
  assert.ok(audit.origin);

  const replay = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': 's8d-success' }, body: JSON.stringify(payload) }, admin);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.id, created.data.id);
  assert.deepEqual(await stateCounts(), afterCreate);

  const divergent = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': 's8d-success' }, body: JSON.stringify({ ...payload, title: 'Contenu divergent' }) }, admin);
  assert.equal(divergent.response.status, 409);
  assert.equal(divergent.data.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(await stateCounts(), afterCreate);
});

test('S8-D applique la matrice des sept rôles, six dashboards et trois exports sans coût hors Finance', async () => {
  const roles = readDb().roles.filter(value => value.companyId === 'company_northlight' && ['ADMIN', 'PLANNING_MANAGER', 'PLANNER', 'SALES', 'PROJECT_MANAGER', 'FINANCE', 'READ_ONLY'].includes(value.code));
  assert.deepEqual(roles.map(value => value.code).sort(), ['ADMIN', 'FINANCE', 'PLANNER', 'PLANNING_MANAGER', 'PROJECT_MANAGER', 'READ_ONLY', 'SALES']);
  const financeRoles = new Set(roles.filter(value => value.permissions.includes('*') || value.permissions.includes('finance.read')).map(value => value.code));
  assert.deepEqual([...financeRoles].sort(), ['ADMIN', 'FINANCE']);

  const dashboards = ['direction', 'finance', 'planning', 'sales', 'operations', 'project'];
  const observed = {};
  for (const dashboard of dashboards) observed[dashboard] = (await request(`/api/v1/dashboards/${dashboard}`, {}, planner)).response.status;
  assert.deepEqual(observed, { direction: 403, finance: 403, planning: 200, sales: 200, operations: 200, project: 200 });

  const catalogue = await request('/api/v1/analytics/datasets', {}, planner);
  assert.equal(catalogue.response.status, 200);
  assert.equal(catalogue.data.items.some(value => ['margins', 'profitability', 'unbilled-overages', 'rate-discounts'].includes(value.id)), false);
  assert.equal((await request('/api/v1/analytics/datasets/margins', {}, planner)).response.status, 403);
  assert.equal((await request('/api/v1/audit', {}, planner)).response.status, 403);

  const xlsx = await request('/api/v1/exports/planning.xlsx?from=2026-08-01&to=2026-08-31', {}, planner);
  const pdf = await request('/api/v1/exports/planning.pdf?from=2026-08-01&to=2026-08-31', {}, planner);
  const dashboardXlsx = await request('/api/v1/dashboards/planning/export.xlsx?from=2026-08-01&to=2026-08-31', {}, planner);
  assert.equal(xlsx.response.status, 200); assert.equal(pdf.response.status, 200); assert.equal(dashboardXlsx.response.status, 200);
  for (const result of [xlsx, pdf, dashboardXlsx]) {
    assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(/costUnitMinor|costSnapshot|plannedMargin|actualMargin/i.test(result.raw.toString('latin1')), false);
  }

  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /JSON\.stringify\(\{ eventId: id\('event'\), type, occurredAt: now\(\), companyId, siteId: entity\.siteId, entityId: entity\.id, entityVersion: entity\.version \}\)/);
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(app, /d\.overrideReason\?\.trim\(\)\.length\|\|0\)<3/);
  assert.match(html, /name="overrideReason" minlength="3" maxlength="500"/);
});
