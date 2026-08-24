'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-s8-security-${process.pid}-${Date.now()}.json`);

const { createServer, dashboardReadModel, exportPdfBuffer, exportXlsxBuffer, planningExportRows, resetData, makeSeed, readDb } = require('../server.js');

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

async function openEventStream(auth) {
  const controller = new AbortController(), response = await fetch(`${baseUrl}/api/v1/events`, { headers: { cookie: auth.cookie, accept: 'text/event-stream' }, signal: controller.signal }); assert.equal(response.status, 200);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffered = '';
  while (!buffered.includes(': connected')) { const chunk = await reader.read(); if (chunk.done) throw new Error('Flux SSE fermé avant connexion.'); buffered += decoder.decode(chunk.value, { stream: true }); }
  return { controller, reader, decoder, buffered: buffered.slice(buffered.indexOf(': connected') + ': connected'.length).replace(/^\n\n/, '') };
}
async function nextInvalidation(stream, timeoutMs = 800) {
  const read = async () => { while (!stream.buffered.includes('event: invalidation')) { const chunk = await stream.reader.read(); if (chunk.done) return null; stream.buffered += stream.decoder.decode(chunk.value, { stream: true }); } const boundary = stream.buffered.indexOf('\n\n'), event = stream.buffered.slice(0, boundary + 2); stream.buffered = stream.buffered.slice(boundary + 2); return event; };
  return Promise.race([read(), new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))]);
}
function closeEventStream(stream) { stream.controller.abort(); stream.reader.cancel().catch(() => {}); }

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
  const requirements = { direction: ['finance.read', 'quote.read', 'planning.read', 'resource.read', 'actual.read'], finance: ['finance.read', 'quote.read'], planning: ['planning.read', 'resource.read'], sales: ['quote.read', 'client.read', 'project.read|project.manage'], operations: ['planning.read', 'resource.read', 'maintenance.read'], project: ['quote.read', 'planning.read', 'project.read|project.manage'] }, db = readDb(); let checked = 0;
  for (const role of roles) {
    const permissions = role.permissions.includes('*') ? ['*'] : role.permissions, auth = { user: { id: `matrix_${role.code}`, companyId: 'company_northlight', organizationScope: true, siteIds: db.sites.filter(value => value.companyId === 'company_northlight').map(value => value.id), organizationUnitIds: [], projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: permissions } }, hasPermission = value => permissions.includes('*') || value.split('|').some(permission => permissions.includes(permission));
    for (const dashboard of dashboards) {
      const allowed = requirements[dashboard].every(hasPermission); let model = null, error = null; try { model = dashboardReadModel(db, auth, dashboard, { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23' }); } catch (caught) { error = caught; }
      assert.equal(Boolean(model), allowed, `${role.code}/${dashboard}`); if (!allowed) assert.equal(error?.status, 403); if (model && !hasPermission('finance.read')) assert.doesNotMatch(JSON.stringify(model), /plannedMargin|actualMargin|plannedCost|actualCost|costUnitMinor/);
      for (const format of ['screen', 'xlsx', 'pdf']) { checked++; if (!model) continue; if (format === 'xlsx') assert.equal(exportXlsxBuffer('Matrice', ['Dashboard'], [[dashboard]]).subarray(0, 2).toString(), 'PK'); if (format === 'pdf') assert.equal(exportPdfBuffer('Matrice', dashboard, ['Dashboard'], [[dashboard]]).subarray(0, 8).toString(), '%PDF-1.4'); }
    }
    if (hasPermission('planning.read') && hasPermission('project.read|project.manage')) assert.doesNotThrow(() => planningExportRows(db, auth, { from: '2026-08-01', to: '2026-08-31' }));
  }
  assert.equal(checked, 7 * 6 * 3);
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
  assert.match(source, /if \(!result\.replay && result\.item\.sourceQuoteId\) emit\('quote\.planningProgress\.v1'/);
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(app, /d\.overrideReason\?\.trim\(\)\.length\|\|0\)<3/);
  assert.match(html, /name="overrideReason" minlength="3" maxlength="500"/);
});

test('S8-D ne réémet aucun SSE Devis au replay exact d’une copie de cellule liée', async () => {
  const db = readDb(), sourceBase = db.reservations.find(value => value.id === 'reservation_1') || db.reservations[0]; assert.ok(sourceBase);
  const source = { ...structuredClone(sourceBase), id: 'reservation_s8d_quote_cell', title: 'Cellule liée S8-D', status: 'confirmed', startsAt: '2031-04-01T07:00:00.000Z', endsAt: '2031-04-01T16:00:00.000Z', planningMode: 'dailyCells', includeWeekends: true, sourceQuoteId: 'quote_s8d_cell', sourceQuoteVersionId: 'quoteVersion_s8d_cell', sourceQuoteLineId: 'quoteLine_s8d_cell', planningQuantityMilli: '1000', planningUnit: 'jour', cellOverrides: [], version: 1 };
  const resourceId = source.resources[0].resourceId, quote = { id: 'quote_s8d_cell', companyId: source.companyId, siteId: source.siteId, projectId: source.projectId, kind: 'quote', status: 'accepted', currentVersionId: 'quoteVersion_s8d_cell', currency: 'EUR', currencyExponent: 2, lines: [{ id: 'quoteLine_s8d_cell', category: 'room', section: 'Montage', label: 'Montage Avid', sourceType: 'resource', sourceId: resourceId, unit: 'jour', quantityMilli: '100000', planning: { bookingIds: [], plannedQuantityMilli: '0', requestedDurationDays: 100, status: 'unplanned' }, netHt: '100000', costTotal: '0' }], version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.reservations.push(source); db.quotes ||= []; db.quotes.push(quote); resetData(db); admin = await login('admin@northlight.fr');
  const stream = await openEventStream(admin); try {
    const payload = { sourceDate: '2031-04-01', sourceResourceId: resourceId, targetDate: '2031-04-02', targetResourceId: resourceId }, options = { method: 'POST', headers: { 'Idempotency-Key': 's8d-cell-replay' }, body: JSON.stringify(payload) };
    const created = await request(`/api/v1/reservations/${source.id}/duplicate`, options, admin); assert.equal(created.response.status, 201);
    const first = await nextInvalidation(stream); const second = await nextInvalidation(stream); assert.match(`${first}${second}`, /reservation\.cellDuplicated\.v1/); assert.match(`${first}${second}`, /quote\.planningProgress\.v1/);
    const replay = await request(`/api/v1/reservations/${source.id}/duplicate`, options, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.id, created.data.id); assert.equal(await nextInvalidation(stream, 250), null);
  } finally { closeEventStream(stream); }
});
