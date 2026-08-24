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
    project: ['projects', 'planning', 'planningCompleteness', 'unplannedProjects', 'actuals', 'actualCompletion', 'actualGap'],
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

test('S8-A applique le filtre Projet à l’occupation et réconcilie la carte avec le détail journalier', () => {
  const db = makeSeed(), admin = authFor(db, ['finance.read', 'quote.read', 'planning.read', 'resource.read', 'actual.read', 'client.read', 'project.read', 'maintenance.read']), resource = db.resources.find(value => value.companyId === db.companies[0].id), projects = db.projects.filter(value => value.companyId === resource.companyId).slice(0, 2), source = db.reservations[0];
  assert.equal(projects.length, 2); for (const project of projects) project.siteId = resource.siteId;
  const booking = (id, projectId, endsAt) => ({ ...structuredClone(source), id, companyId: resource.companyId, siteId: resource.siteId, projectId, status: 'confirmed', startsAt: '2026-08-10T00:00:00.000Z', endsAt, resources: [{ resourceId: resource.id, quantity: 1 }], version: 1, sourceQuoteId: undefined, sourceQuoteVersionId: undefined, sourceQuoteLineId: undefined });
  db.reservations = [booking('reservation_dashboard_short', projects[0].id, '2026-08-10T01:00:00.000Z'), booking('reservation_dashboard_hidden', projects[1].id, '2026-08-10T08:00:00.000Z')]; db.actualRecords = []; db.actualRevisions = [];
  const input = { asOf: '2026-08-23', from: '2026-08-10', to: '2026-08-10', projectId: projects[0].id, resourceId: resource.id }, model = dashboardReadModel(db, admin, 'planning', input), kpi = model.kpis.find(value => value.id === 'occupancy'), detail = dashboardDrilldownReadModel(db, admin, 'planning', { ...input, kpiId: 'occupancy', pageSize: 100 });
  assert.equal(model.sources.counts.reservations, 1); assert.equal(kpi.value, 417); assert.equal(detail.total, 1); assert.equal(detail.items[0].value, kpi.value);
});

test('S8-A exige un KPI explicite sur le drill-down public', () => {
  const db = makeSeed(), admin = authFor(db, ['finance.read', 'quote.read', 'planning.read', 'resource.read', 'actual.read', 'client.read', 'project.read', 'maintenance.read']);
  assert.throws(() => dashboardDrilldownReadModel(db, admin, 'direction', { asOf: '2026-08-23' }), error => error.status === 422 && error.code === 'DASHBOARD_KPI_REQUIRED');
});

test('S8-A refuse un export de détail supérieur à 10 000 sources sans troncature silencieuse', () => {
  const db = makeSeed(), admin = authFor(db, ['quote.read', 'planning.read', 'project.read', 'actual.read']), source = db.reservations[0], project = db.projects.find(value => value.id === source.projectId);
  db.reservations = Array.from({ length: 10001 }, (_, index) => ({ ...structuredClone(source), id: `reservation_dashboard_export_${index}`, projectId: project.id, status: 'confirmed', version: 1, sourceQuoteId: undefined, sourceQuoteVersionId: undefined, sourceQuoteLineId: undefined }));
  assert.throws(() => dashboardDrilldownReadModel(db, admin, 'project', { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23', kpiId: 'planning', page: '1', pageSize: '10000', internalExport: true }), error => error.status === 422 && error.code === 'EXPORT_TOO_LARGE' && error.details.total === 10001);
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
  const missingKpi = await fetch(`${base}/api/v1/dashboards/direction/drilldown?asOf=2026-08-23`, { headers: { cookie } }), missingKpiError = await missingKpi.json();
  assert.equal(missingKpi.status, 422); assert.equal(missingKpiError.error.code, 'DASHBOARD_KPI_REQUIRED');
  const invalid = await fetch(`${base}/api/v1/dashboards/direction?asOf=2999-01-01`, { headers: { cookie } }), error = await invalid.json();
  assert.equal(invalid.status, 422); assert.equal(error.error.code, 'DASHBOARD_PERIOD_INVALID'); assert.ok(error.error.requestId);
});

test('S8-A câble la route, l’interface Pilotage et le contrat OpenAPI', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(server, /route\.match\(\/\^\\\/api\\\/v1\\\/dashboards/);
  assert.match(html, /data-route="pilotage"/);
  assert.match(app, /DASHBOARD_KINDS_UI/);
  assert.match(app, /pilotagePageSectionsBase/); assert.match(app, /data-pilotage-detail-page/); assert.match(app, /pilotageShareFilters/);
  assert.match(openapi, /\/dashboards\/\{kind\}:/);
  assert.match(openapi, /\/dashboards\/\{kind\}\/drilldown:/);
  assert.match(openapi, /DashboardDrilldownResponse:/);
});
