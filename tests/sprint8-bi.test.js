'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint8-bi-${process.pid}-${Date.now()}.json`);
const { analyticsDatasetCsv, analyticsDatasetReadModel, createServer, makeSeed, resetData } = require('../server.js');

function authFor(db, permissions, overrides = {}) {
  const companyId = db.companies[0].id;
  return { user: { id: 'user_bi', companyId, organizationScope: true, siteIds: db.sites.filter(value => value.companyId === companyId).map(value => value.id), organizationUnitIds: [], projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: permissions, ...overrides } };
}

test('S8-C produit des pages BI stables à partir des moteurs canoniques', () => {
  const db = makeSeed(), finance = authFor(db, ['finance.read', 'quote.read', 'project.read', 'client.read', 'planning.read', 'resource.read', 'actual.read']);
  const signed = analyticsDatasetReadModel(db, finance, 'signed-revenue', { page: '1', pageSize: '2' });
  assert.equal(signed.dataset, 'signed-revenue'); assert.equal(signed.definitionVersion, 'BI_SIGNED_REVENUE@2'); assert.equal(signed.page, 1); assert.equal(signed.pageSize, 2); assert.equal(signed.items.length <= 2, true); assert.equal(signed.total >= signed.items.length, true); assert.ok(signed.fields.includes('quoteVersionId')); assert.ok(signed.fields.includes('articleAnalyticsCode'));
  const backlog = analyticsDatasetReadModel(db, finance, 'backlog', { asOf: '2026-08-23', page: '1', pageSize: '10' });
  assert.equal(backlog.definitionVersion, 'FINANCE_BACKLOG@2'); assert.equal(backlog.total >= backlog.items.length, true); assert.equal(backlog.items.every(value => typeof value.backlogMinor === 'string'), true);
});

test('S8-C applique les scopes avant les lignes et masque les coûts sans finance.read', () => {
  const db = makeSeed(), visible = db.projects.find(value => value.companyId === db.companies[0].id), hidden = db.projects.find(value => value.companyId === visible.companyId && value.id !== visible.id);
  const scoped = authFor(db, ['quote.read', 'planning.read', 'project.read', 'actual.read'], { organizationScope: false, siteIds: [visible.siteId], projectScopeRestricted: true, projectIds: [visible.id], entityScopes: { client: [visible.clientId], project: [visible.id], quote: (db.quotes || []).filter(value => value.projectId === visible.id).map(value => value.id), reservation: db.reservations.filter(value => value.projectId === visible.id).map(value => value.id), resource: db.resources.filter(value => value.siteId === visible.siteId).map(value => value.id), actual: (db.actualRecords || []).filter(value => value.projectId === visible.id).map(value => value.id) } });
  const planning = analyticsDatasetReadModel(db, scoped, 'planning-reservations', { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(planning.items.every(value => db.reservations.find(item => item.id === value.reservationId)?.projectId === visible.id), true);
  assert.throws(() => analyticsDatasetReadModel(db, scoped, 'planning-reservations', { from: '2026-01-01', to: '2026-12-31', projectId: hidden.id }), error => error.status === 404);
  const actuals = analyticsDatasetReadModel(db, scoped, 'actuals', {}), raw = JSON.stringify(actuals);
  assert.doesNotMatch(raw, /costSnapshot|costUnitMinor|plannedCostMinor|actualCostMinor/);
  assert.throws(() => analyticsDatasetReadModel(db, scoped, 'margins', {}), error => error.status === 403);
});

test('S8-C neutralise les formules CSV et refuse pagination et dataset invalides', () => {
  const model = { fields: ['label', 'amount'], items: [{ label: '=HYPERLINK("bad")', amount: '-2' }] }, csv = analyticsDatasetCsv(model).toString('utf8');
  assert.ok(csv.startsWith('\ufeff')); assert.match(csv, /'=HYPERLINK/); assert.match(csv, /'-2/);
  const db = makeSeed(), auth = authFor(db, ['finance.read']);
  assert.throws(() => analyticsDatasetReadModel(db, auth, 'margins', { pageSize: '501' }), error => error.status === 422 && error.code === 'ANALYTICS_PAGINATION_INVALID');
  assert.throws(() => analyticsDatasetReadModel(db, auth, 'margins', { asOf: '2999-01-01' }), error => error.status === 422 && error.code === 'ANALYTICS_PERIOD_INVALID');
  assert.throws(() => analyticsDatasetReadModel(db, auth, 'unknown', {}), error => error.status === 404 && error.code === 'ANALYTICS_DATASET_NOT_FOUND');
});

test('S8-C exige une partition quand un dataset dépasse 10 000 lignes', () => {
  const db = makeSeed(), project = db.projects[0], timestamp = '2026-08-20T10:00:00.000Z', accepted = { id: 'quote_bi_large', companyId: project.companyId, projectId: project.id, siteId: project.siteId, kind: 'quote', status: 'accepted', number: 'BI-10001', acceptedAt: timestamp, createdAt: timestamp, updatedAt: timestamp, currency: 'EUR', currencyExponent: 2, currentVersionId: 'quoteVersion_bi_large', lines: Array.from({ length: 10001 }, (_, index) => ({ id: `line_bi_${index}`, sourceType: 'manual', sourceId: null, label: `Ligne ${index}`, quantityMilli: '1000', unitPriceMinor: '1', netHt: '1' })) }; db.quotes = [accepted]; db.budgets = [];
  const auth = authFor(db, ['quote.read', 'project.read', 'client.read']);
  assert.throws(() => analyticsDatasetReadModel(db, auth, 'signed-revenue', { page: '1', pageSize: '500' }), error => error.status === 422 && error.code === 'ANALYTICS_DATASET_TOO_LARGE' && error.details.maximumRows === 10000);
});

test('S8-C expose catalogue, JSON et CSV via HTTP avec RBAC et erreurs stables', async t => {
  const db = makeSeed(), reservation = db.reservations.find(value => value.companyId === db.companies[0].id); reservation.title = '=IMPORT("x")'; resetData(db);
  const server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {} });
  const base = `http://127.0.0.1:${server.address().port}`, login = async email => { const response = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo2026' }) }); return response.headers.get('set-cookie').split(';', 1)[0]; }, admin = await login('admin@northlight.fr'), planner = await login('planner@northlight.fr');
  const catalogResponse = await fetch(`${base}/api/v1/analytics/datasets`, { headers: { cookie: planner } }), catalog = await catalogResponse.json();
  assert.equal(catalogResponse.status, 200); assert.equal(catalog.items.some(value => value.dataset === 'planning-reservations'), true); assert.equal(catalog.items.some(value => value.dataset === 'margins'), false);
  const jsonResponse = await fetch(`${base}/api/v1/analytics/datasets/backlog?asOf=2026-08-23&page=1&pageSize=2`, { headers: { cookie: admin } }), json = await jsonResponse.json();
  assert.equal(jsonResponse.status, 200); assert.equal(json.dataset, 'backlog'); assert.equal(json.pageSize, 2); assert.equal(json.items.length <= 2, true);
  const csvResponse = await fetch(`${base}/api/v1/analytics/datasets/planning-reservations?format=csv&from=2026-01-01&to=2026-12-31`, { headers: { cookie: planner } }), csv = await csvResponse.text();
  assert.equal(csvResponse.status, 200); assert.match(csvResponse.headers.get('content-type'), /text\/csv/); assert.match(csv, /'=IMPORT/);
  const forbidden = await fetch(`${base}/api/v1/analytics/datasets/margins`, { headers: { cookie: planner } }); assert.equal(forbidden.status, 403);
  const invalid = await fetch(`${base}/api/v1/analytics/datasets/backlog?format=xml`, { headers: { cookie: admin } }), error = await invalid.json(); assert.equal(invalid.status, 422); assert.equal(error.error.code, 'ANALYTICS_FORMAT_UNSUPPORTED'); assert.ok(error.error.requestId);
});

test('S8-C documente le catalogue fermé et le contrat paginé OpenAPI', () => {
  const openapi = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(openapi, /\/analytics\/datasets:\n/); assert.match(openapi, /\/analytics\/datasets\/\{dataset\}:/); assert.match(openapi, /operationId: readAnalyticsDataset/); assert.match(openapi, /maximum: 500/); assert.match(openapi, /AnalyticsDatasetResponse:/);
});
