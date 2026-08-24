'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint8-dashboards-${process.pid}-${Date.now()}.json`);
const { createServer, dashboardDrilldownReadModel, dashboardReadModel, makeSeed, resetData } = require('../server.js');

function authFor(db, permissions, overrides = {}) {
  const companyId = db.companies[0].id;
  return { user: { id: 'user_dashboard', companyId, organizationScope: true, siteIds: db.sites.filter(value => value.companyId === companyId).map(value => value.id), organizationUnitIds: [], projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: ['dashboard.read', ...permissions], ...overrides } };
}

test('S8-A produit les six read-models versionnés sans inventer facturé ni encaissé', () => {
  const db = makeSeed(), admin = authFor(db, ['finance.read', 'quote.read', 'planning.read', 'resource.read', 'actual.read', 'client.read', 'project.read', 'maintenance.read']);
  for (const kind of ['direction', 'finance', 'planning', 'sales', 'operations', 'project']) {
    const result = dashboardReadModel(db, admin, kind, { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23' });
    assert.equal(result.dashboard, kind); assert.equal(result.definitionVersion, `DASHBOARD_${kind.toUpperCase()}@2`); assert.equal(result.asOf, '2026-08-23'); assert.ok(result.kpis.length >= 3); assert.equal(result.sources.freshness.mode, 'live'); assert.equal(result.sources.scopeDigest.length, 64);
  }
  const finance = dashboardReadModel(db, admin, 'finance', { asOf: '2026-08-23' });
  assert.equal(finance.kpis.find(value => value.id === 'invoicedRevenue').status, 'unavailable');
  assert.equal(finance.kpis.find(value => value.id === 'invoicedRevenue').value, null);
  assert.match(finance.kpis.find(value => value.id === 'invoicedRevenue').definition, /module de facturation non livré/);
  assert.equal(finance.kpis.find(value => value.id === 'collectedRevenue').status, 'unavailable');
});

test('S8-A couvre les KPI obligatoires, conserve les filtres et réconcilie CA signé avec le détail', () => {
  const db = makeSeed(), admin = authFor(db, ['finance.read', 'quote.read', 'planning.read', 'resource.read', 'actual.read', 'client.read', 'project.read', 'maintenance.read']);
  const required = {
    direction: ['signedRevenue', 'earnedRevenue', 'backlog', 'plannedMargin', 'actualMargin', 'occupancy', 'saturation', 'underutilization'],
    finance: ['billableRevenue', 'plannedCost', 'actualCost', 'complementsRequired', 'invoicedRevenue', 'collectedRevenue'],
    planning: ['occupancy', 'saturation', 'underutilization', 'openOptions', 'conflicts', 'unplannedProjects'],
    sales: ['budgets', 'quotes', 'budgetConversion', 'conversion', 'discount'],
    operations: ['resources', 'maintenance', 'unavailable', 'plannedOccupancy', 'actualOccupancy', 'occupancyGap'],
    project: ['projects', 'planning', 'planningCompleteness', 'unplannedProjects', 'actuals'],
  };
  for (const [kind, ids] of Object.entries(required)) { const model = dashboardReadModel(db, admin, kind, { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23' }); for (const id of ids) assert.ok(model.kpis.some(value => value.id === id), `${kind}.${id}`); }
  const resource = db.resources.find(value => value.companyId === db.companies[0].id), planning = dashboardReadModel(db, admin, 'planning', { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23', resourceId: resource.id, resourceCategoryId: resource.resourceCategoryId });
  assert.equal(planning.filters.resourceId, resource.id); assert.equal(planning.filters.resourceCategoryId, resource.resourceCategoryId || null); assert.match(planning.kpis.find(value => value.id === 'occupancy').drilldown, /resourceId=/);
  const direction = dashboardReadModel(db, admin, 'direction', { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23' }), detail = dashboardDrilldownReadModel(db, admin, 'direction', { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23', kpiId: 'signedRevenue', pageSize: 500 });
  assert.equal(detail.total, direction.kpis.find(value => value.id === 'acceptedQuotes').value); assert.equal(detail.items.reduce((sum, value) => sum + BigInt(value.value), 0n), BigInt(direction.kpis.find(value => value.id === 'signedRevenue').value));
});

test('S8-A refuse Exploitation sans maintenance.read et ne divulgue aucun compteur', () => {
  const db = makeSeed(), withoutMaintenance = authFor(db, ['planning.read', 'resource.read']);
  assert.throws(() => dashboardReadModel(db, withoutMaintenance, 'operations', { asOf: '2026-08-23' }), error => error.status === 403 && error.code === 'DASHBOARD_FORBIDDEN' && error.details.missingPermissions.includes('maintenance.read'));
});

test('S8-A n’expose aucun coût ni marge au Commercial sans finance.read', () => {
  const db = makeSeed(), sales = authFor(db, ['quote.read', 'client.read', 'project.read']);
  const result = dashboardReadModel(db, sales, 'sales', { asOf: '2026-08-23' }), raw = JSON.stringify(result);
  assert.equal(result.kpis.some(value => /margin|cost/i.test(value.id)), false);
  assert.doesNotMatch(raw, /plannedMargin|actualMargin|costUnitMinor|costTotalMinor/);
  assert.ok(result.kpis.some(value => value.id === 'signedRevenue'));
  assert.throws(() => dashboardReadModel(db, sales, 'finance', { asOf: '2026-08-23' }), error => error.status === 403 && error.code === 'DASHBOARD_FORBIDDEN');
});

test('S8-A applique les scopes Projet et Site avant les compteurs', () => {
  const db = makeSeed(), visibleProject = db.projects.find(value => value.companyId === db.companies[0].id), hiddenProject = db.projects.find(value => value.companyId === visibleProject.companyId && value.id !== visibleProject.id);
  assert.ok(visibleProject); assert.ok(hiddenProject);
  const scoped = authFor(db, ['quote.read', 'planning.read', 'actual.read', 'project.read'], { organizationScope: false, siteIds: [visibleProject.siteId], projectScopeRestricted: true, projectIds: [visibleProject.id], entityScopes: { client: [visibleProject.clientId], project: [visibleProject.id], quote: (db.quotes || []).filter(value => value.projectId === visibleProject.id).map(value => value.id), reservation: db.reservations.filter(value => value.projectId === visibleProject.id).map(value => value.id), resource: db.resources.filter(value => value.siteId === visibleProject.siteId).map(value => value.id) } });
  const result = dashboardReadModel(db, scoped, 'project', { asOf: '2026-08-23' });
  assert.equal(result.sources.counts.projects, 1);
  assert.equal(result.kpis.find(value => value.id === 'projects').value, 1);
  assert.throws(() => dashboardReadModel(db, scoped, 'project', { asOf: '2026-08-23', projectId: hiddenProject.id }), error => error.status === 404 && error.code === 'NOT_FOUND');
});

test('S8-A refuse les périodes futures, inversées et les dashboards inconnus', () => {
  const db = makeSeed(), admin = authFor(db, ['finance.read', 'quote.read', 'planning.read', 'resource.read', 'actual.read', 'client.read', 'project.read']);
  assert.throws(() => dashboardReadModel(db, admin, 'finance', { asOf: '2999-01-01' }), error => error.status === 422 && error.code === 'DASHBOARD_PERIOD_INVALID');
  assert.throws(() => dashboardReadModel(db, admin, 'planning', { asOf: '2026-08-23', from: '2026-08-24', to: '2026-08-01' }), error => error.status === 422 && error.code === 'DASHBOARD_PERIOD_INVALID');
  assert.throws(() => dashboardReadModel(db, admin, 'unknown', { asOf: '2026-08-23' }), error => error.status === 404 && error.code === 'DASHBOARD_NOT_FOUND');
});

test('S8-A expose le dashboard via HTTP avec le contrat d’erreur stable', async t => {
  resetData(makeSeed()); const server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {} });
  const base = `http://127.0.0.1:${server.address().port}`, login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }) }), session = await login.json(), cookie = login.headers.get('set-cookie').split(';', 1)[0];
  const response = await fetch(`${base}/api/v1/dashboards/direction?asOf=2026-08-23`, { headers: { cookie } }), data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.dashboard, 'direction'); assert.equal(data.kpis.some(value => value.id === 'signedRevenue'), true);
  const drilldown = await fetch(`${base}/api/v1/dashboards/direction/drilldown?asOf=2026-08-23&kpiId=signedRevenue&page=1&pageSize=10`, { headers: { cookie } }), detail = await drilldown.json();
  assert.equal(drilldown.status, 200); assert.equal(detail.dashboard, 'direction'); assert.equal(detail.kpiId, 'signedRevenue'); assert.ok(Array.isArray(detail.items)); assert.ok(detail.items.every(value => value.kpiId === 'signedRevenue'));
  const invalid = await fetch(`${base}/api/v1/dashboards/direction?asOf=2999-01-01`, { headers: { cookie } }), error = await invalid.json();
  assert.equal(invalid.status, 422); assert.equal(error.error.code, 'DASHBOARD_PERIOD_INVALID'); assert.ok(error.error.requestId);
});

test('S8-A câble la route, l’interface Pilotage et le contrat OpenAPI', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(server, /route\.match\(\/\^\\\/api\\\/v1\\\/dashboards/);
  assert.match(html, /data-route="pilotage"/);
  assert.match(app, /DASHBOARD_KINDS_UI/);
  assert.match(openapi, /\/dashboards\/\{kind\}:/);
  assert.match(openapi, /\/dashboards\/\{kind\}\/drilldown:/);
  assert.match(openapi, /DashboardDrilldownResponse:/);
});
