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

test('S8-A ne fabrique pas de lignes d’occupation réelle sans réalisé', () => {
  const db = makeSeed(), admin = authFor(db, ['planning.read', 'resource.read', 'actual.read', 'project.read', 'maintenance.read']);
  const input = { asOf: '2026-08-23', from: '2026-08-01', to: '2026-08-23' }, operations = dashboardReadModel(db, admin, 'operations', input);
  for (const kpiId of ['actualOccupancy', 'occupancyGap']) {
    const kpi = operations.kpis.find(value => value.id === kpiId), detail = dashboardDrilldownReadModel(db, admin, 'operations', { ...input, kpiId, pageSize: 500 });
    assert.equal(detail.total, kpi.sourceCount, `${kpiId} doit réconcilier carte et détail`);
    assert.ok(detail.items.every(value => value.value !== null), `${kpiId} ne doit pas exposer de ligne « — bps »`);
  }
});

test('S8-A réconcilie la valeur de l’écart d’occupation sur les seules périodes réalisées', () => {
  const db = makeSeed(), admin = authFor(db, ['planning.read', 'resource.read', 'actual.read', 'project.read', 'maintenance.read']), source = db.reservations[0], allocation = source.resources[0];
  const reservation = (id, day, hours) => ({ ...structuredClone(source), id, startsAt: `${day}T00:00:00.000Z`, endsAt: `${day}T${String(hours).padStart(2, '0')}:00:00.000Z`, resources: [structuredClone(allocation)], version: 1, sourceQuoteId: undefined, sourceQuoteVersionId: undefined, sourceQuoteLineId: undefined });
  const realized = reservation('reservation_gap_realized', '2026-08-10', 1), plannedOnly = reservation('reservation_gap_planned_only', '2026-08-11', 8), record = { id: 'actual_gap_realized', companyId: realized.companyId, reservationId: realized.id, projectId: realized.projectId, siteId: realized.siteId, sourceReservationVersion: 1, plannedSnapshot: { resources: [structuredClone(allocation)] }, currentRevisionId: 'actual_gap_realized_revision', version: 1 }, revision = { id: record.currentRevisionId, companyId: realized.companyId, actualRecordId: record.id, revisionNumber: 1, startsAt: realized.startsAt, endsAt: realized.endsAt, quantityMilli: '1000', unit: 'hour', confirmationKind: 'confirmed', sourceReservationVersion: 1, confirmedAt: '2026-08-10T02:00:00.000Z' };
  db.reservations = [realized, plannedOnly]; db.actualRecords = [record]; db.actualRevisions = [revision];
  const input = { asOf: '2026-08-23', from: '2026-08-10', to: '2026-08-11', resourceId: allocation.resourceId }, operations = dashboardReadModel(db, admin, 'operations', input), kpi = operations.kpis.find(value => value.id === 'occupancyGap'), detail = dashboardDrilldownReadModel(db, admin, 'operations', { ...input, kpiId: 'occupancyGap', pageSize: 100 }), detailAverage = Math.round(detail.items.reduce((sum, value) => sum + Number(value.value), 0) / detail.items.length);
  assert.equal(kpi.sourceCount, 1); assert.equal(detail.total, 1); assert.equal(kpi.value, detailAverage); assert.equal(kpi.value, 0);
  plannedOnly.endsAt = '2026-08-11T03:00:00.000Z'; const secondRecord = { ...structuredClone(record), id: 'actual_gap_second', reservationId: plannedOnly.id, currentRevisionId: 'actual_gap_second_revision' }, secondRevision = { ...structuredClone(revision), id: secondRecord.currentRevisionId, actualRecordId: secondRecord.id, startsAt: plannedOnly.startsAt, endsAt: '2026-08-11T01:00:00.000Z', confirmedAt: '2026-08-11T04:00:00.000Z' }; db.actualRecords.push(secondRecord); db.actualRevisions.push(secondRevision);
  const roundedOperations = dashboardReadModel(db, admin, 'operations', input), roundedKpi = roundedOperations.kpis.find(value => value.id === 'occupancyGap'), roundedDetail = dashboardDrilldownReadModel(db, admin, 'operations', { ...input, kpiId: 'occupancyGap', pageSize: 100 }), roundedDetailAverage = Math.round(roundedDetail.items.reduce((sum, value) => sum + Number(value.value), 0) / roundedDetail.items.length);
  assert.deepEqual(roundedDetail.items.map(value => value.value), [0, -833]); assert.equal(roundedKpi.value, roundedDetailAverage); assert.equal(roundedKpi.value, -416);
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

test('S8-A borne les réalisés Projet aux réservations visibles, à leur période et à asOf', () => {
  const db = makeSeed(), admin = authFor(db, ['quote.read', 'planning.read', 'project.read', 'actual.read']), source = db.reservations[0], project = db.projects.find(value => value.id === source.projectId);
  const reservation = (id, startsAt, endsAt) => ({ ...structuredClone(source), id, projectId: project.id, startsAt, endsAt, status: 'confirmed', version: 1, sourceQuoteId: undefined, sourceQuoteVersionId: undefined, sourceQuoteLineId: undefined });
  const visible = reservation('reservation_dashboard_actual_visible', '2026-08-10T08:00:00.000Z', '2026-08-10T09:00:00.000Z'), old = reservation('reservation_dashboard_actual_old', '2026-07-01T08:00:00.000Z', '2026-07-01T09:00:00.000Z'); db.reservations = [visible, old];
  const record = (id, booking, confirmedAt) => ({ id, companyId: booking.companyId, reservationId: booking.id, projectId: booking.projectId, siteId: booking.siteId, sourceReservationVersion: booking.version, currentRevisionId: `${id}_revision`, plannedSnapshot: { resources: structuredClone(booking.resources) } }), revision = (recordValue, booking, confirmedAt) => ({ id: recordValue.currentRevisionId, actualRecordId: recordValue.id, revisionNumber: 1, startsAt: booking.startsAt, endsAt: booking.endsAt, confirmedAt });
  const oldRecord = record('actual_dashboard_old', old), futureRecord = record('actual_dashboard_future', visible); db.actualRecords = [oldRecord, futureRecord]; db.actualRevisions = [revision(oldRecord, old, '2026-07-01T10:00:00.000Z'), revision(futureRecord, visible, '2026-08-11T10:00:00.000Z')];
  const input = { asOf: '2026-08-10', from: '2026-08-10', to: '2026-08-10', projectId: project.id }, model = dashboardReadModel(db, admin, 'project', input), detail = dashboardDrilldownReadModel(db, admin, 'project', { ...input, kpiId: 'actualGap', pageSize: 100 }), byId = new Map(model.kpis.map(value => [value.id, value]));
  assert.equal(byId.get('planning').value, 1); assert.equal(byId.get('actuals').value, 0); assert.equal(byId.get('actualCompletion').value, 0); assert.equal(byId.get('actualGap').value, 1); assert.deepEqual(detail.items.map(value => value.sourceId), [visible.id]);
  visible.version = 2; db.actualRevisions.find(value => value.actualRecordId === futureRecord.id).confirmedAt = '2026-08-10T10:00:00.000Z';
  const stale = dashboardReadModel(db, admin, 'project', input), staleById = new Map(stale.kpis.map(value => [value.id, value])); assert.equal(staleById.get('actuals').value, 0); assert.equal(staleById.get('actualCompletion').value, 0); assert.equal(staleById.get('actualGap').value, 1);
  const currentRecord = { ...structuredClone(futureRecord), id: 'actual_dashboard_current', currentRevisionId: 'actual_dashboard_current_revision', sourceReservationVersion: 2 }, currentRevision = { ...structuredClone(db.actualRevisions.find(value => value.actualRecordId === futureRecord.id)), id: currentRecord.currentRevisionId, actualRecordId: currentRecord.id, sourceReservationVersion: 2 }; db.actualRecords.push(currentRecord); db.actualRevisions.push(currentRevision);
  const current = dashboardReadModel(db, admin, 'project', input), currentDetail = dashboardDrilldownReadModel(db, admin, 'project', { ...input, kpiId: 'actuals', pageSize: 100 }), currentById = new Map(current.kpis.map(value => [value.id, value])); assert.equal(currentById.get('actuals').value, 1); assert.equal(currentById.get('actualCompletion').value, 10000); assert.equal(currentById.get('actualGap').value, 0); assert.deepEqual(currentDetail.items.map(value => value.sourceId), [currentRecord.id]);
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
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(server, /route\.match\(\/\^\\\/api\\\/v1\\\/dashboards/);
  assert.match(html, /data-route="pilotage"/);
  assert.match(app, /DASHBOARD_KINDS_UI/);
  assert.match(app, /pilotagePageSectionsBase/); assert.match(app, /data-pilotage-detail-page/); assert.match(app, /pilotageShareFilters/);
  assert.match(app, /<dialog class="pilotage-detail-dialog"/); assert.match(app, /data-pilotage-detail-close/); assert.match(app, /Sous-utilisé/); assert.match(app, /pilotageDetailValue/);
  assert.match(app, /pilotageForecastSection/); assert.match(app, /Prévisions de chiffre d’affaires/); assert.match(app, /Déjà planifié/); assert.match(app, /À planifier/); assert.match(css, /\.pilotage-forecast-grid/);
  assert.match(openapi, /\/dashboards\/\{kind\}:/);
  assert.match(openapi, /\/dashboards\/\{kind\}\/drilldown:/);
  assert.match(openapi, /DashboardDrilldownResponse:/);
});
