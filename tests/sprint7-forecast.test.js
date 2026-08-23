'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { financeBacklog, financeForecast, revenueChain } = require('../server.js');

function fixture() {
  const companyId = 'company_forecast', projectId = 'project_forecast', quoteId = 'quote_forecast', lineId = 'line_forecast', resourceId = 'resource_forecast';
  const db = {
    companies: [{ id: companyId, currency: 'EUR' }],
    clients: [{ id: 'client_forecast', companyId }],
    projects: [{ id: projectId, companyId, clientId: 'client_forecast', siteId: 'site_forecast', name: 'Projet Forecast', startDate: '2026-09-15', endDate: '2026-10-15', salesOwnerId: 'user_sales' }],
    resources: [{ id: resourceId, companyId, siteId: 'site_forecast', active: true }], serviceOfferings: [], organizationUnits: [],
    budgets: [], quotes: [{ id: quoteId, companyId, projectId, siteId: 'site_forecast', kind: 'quote', status: 'accepted', number: 'DEV-FORECAST', currency: 'EUR', currencyExponent: 2, createdBy: 'user_sales', lines: [{ id: lineId, sourceType: 'resource', sourceId: resourceId, label: 'Montage', unit: 'jour', quantityMilli: '10000', netHt: '100000' }], revenueRecognition: { state: 'active', netHt: '100000', quoteVersionId: 'version_forecast', recognizedAt: '2026-08-01T10:00:00.000Z' } }],
    reservations: [
      { id: 'reservation_past', companyId, projectId, siteId: 'site_forecast', sourceQuoteId: quoteId, sourceQuoteLineId: lineId, sourceQuoteVersionId: 'version_forecast', startsAt: '2026-07-01T08:00:00.000Z', endsAt: '2026-07-01T18:00:00.000Z', status: 'completed', version: 1, planningUnit: 'jour', resources: [{ resourceId, quantity: 2 }] },
      { id: 'reservation_future', companyId, projectId, siteId: 'site_forecast', sourceQuoteId: quoteId, sourceQuoteLineId: lineId, sourceQuoteVersionId: 'version_forecast', startsAt: '2026-09-20T08:00:00.000Z', endsAt: '2026-09-20T18:00:00.000Z', status: 'confirmed', version: 1, planningUnit: 'jour', resources: [{ resourceId, quantity: 3 }] },
    ],
    actualRecords: [{ id: 'actual_forecast', companyId, projectId, siteId: 'site_forecast', reservationId: 'reservation_past', sourceReservationVersion: 1, sourceQuoteId: quoteId, sourceQuoteLineId: lineId, plannedSnapshot: { sourceQuoteId: quoteId, sourceQuoteLineId: lineId, quantityMilli: '2000', unit: 'jour', resources: [{ resourceId, quantity: 2 }] }, currentRevisionId: 'actual_revision_forecast', version: 1 }],
    actualRevisions: [{ id: 'actual_revision_forecast', companyId, actualRecordId: 'actual_forecast', revisionNumber: 1, startsAt: '2026-07-01T08:00:00.000Z', endsAt: '2026-07-02T18:00:00.000Z', quantityMilli: '2000', unit: 'jour' }],
  };
  const auth = { user: { id: 'user_finance', companyId, organizationScope: true, siteIds: ['site_forecast'], organizationUnitIds: [], projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: ['finance.read', 'quote.read'] } };
  return { db, auth, projectId, resourceId };
}

test('S7-C calcule le backlog signé sans double comptage des réalisations', () => {
  const { db, auth } = fixture(), result = financeBacklog(db, auth, { asOf: '2026-08-31' });
  assert.equal(result.definitionVersion, 'FINANCE_BACKLOG@1');
  assert.deepEqual(result.totals, { signedRevenueMinor: '100000', earnedSignedRevenueMinor: '20000', backlogMinor: '80000' });
  assert.equal(result.sources.quoteCount, 1); assert.equal(result.sources.reservationCount, 2); assert.equal(result.sources.actualRecordCount, 1);
  assert.equal(result.items[0].plannedQuantityMilli, '5000'); assert.equal(result.items[0].actualQuantityMilli, '2000');
  assert.equal(result.items[0].quoteVersionId, 'version_forecast');
});

test('S7-C applique asOf aux réalisés et conserve les montants après arrondi', () => {
  const { db, auth } = fixture();
  db.actualRecords.push({ ...structuredClone(db.actualRecords[0]), id: 'actual_future', reservationId: 'reservation_future', currentRevisionId: 'actual_revision_future' });
  db.actualRevisions.push({ ...structuredClone(db.actualRevisions[0]), id: 'actual_revision_future', actualRecordId: 'actual_future', startsAt: '2026-09-10T08:00:00.000Z', endsAt: '2026-09-10T18:00:00.000Z', quantityMilli: '1000' });
  assert.equal(financeBacklog(db, auth, { asOf: '2026-08-31' }).totals.earnedSignedRevenueMinor, '20000');
  assert.equal(financeBacklog(db, auth, { asOf: '2026-09-30' }).totals.earnedSignedRevenueMinor, '30000');

  db.quotes[0].lines[0].quantityMilli = '3000'; db.quotes[0].lines[0].netHt = '2'; db.actualRevisions[0].quantityMilli = '1000';
  db.actualRecords = [db.actualRecords[0]]; db.actualRevisions = [db.actualRevisions[0]]; db.reservations = [{ ...db.reservations[1], planningQuantityMilli: '1000', resources: [{ resourceId: 'resource_forecast', quantity: 1 }] }];
  const forecast = financeForecast(db, auth, { asOf: '2026-08-31' }), window = forecast.windows.at(-1);
  assert.equal(BigInt(window.scheduledMinor) + BigInt(window.unscheduledMinor), BigInt(forecast.items[0].scheduled.at(-1).amountMinor) + BigInt(forecast.items[0].unscheduledMinor));
  assert.ok(BigInt(window.totalMinor) <= BigInt(financeBacklog(db, auth, { asOf: '2026-08-31' }).totals.backlogMinor));
});

test('S7-C affecte le dépassement réalisé au complément accepté avant le billable', () => {
  const { db, auth } = fixture(), base = db.quotes[0];
  base.lines[0].quantityMilli = '10000'; base.lines[0].netHt = '100000'; db.actualRevisions[0].quantityMilli = '12000';
  db.quotes.push({ id: 'quote_complement', companyId: base.companyId, projectId: base.projectId, siteId: base.siteId, kind: 'quote', status: 'accepted', number: 'DEV-COMP', currency: 'EUR', currencyExponent: 2, createdBy: 'user_sales', planningComplementSourceQuoteId: base.id, currentVersionId: 'version_complement', revenueRecognition: { state: 'active', quoteVersionId: 'version_complement', netHt: '20000' }, lines: [{ id: 'line_complement', planningSourceQuoteLineId: base.lines[0].id, sourceType: 'resource', sourceId: 'resource_forecast', label: 'Montage complément', unit: 'jour', quantityMilli: '2000', netHt: '20000' }] });
  const rows = require('../server.js').financeFlowLineRows(db, auth, { asOf: '2026-08-31' }).rows, baseRow = rows.find(value => value.quoteId === base.id), complementRow = rows.find(value => value.quoteId === 'quote_complement'), backlog = financeBacklog(db, auth, { asOf: '2026-08-31' });
  assert.equal(baseRow.earnedSignedRevenueMinor, '100000'); assert.equal(baseRow.billableValueMinor, '0');
  assert.equal(complementRow.earnedSignedRevenueMinor, '20000'); assert.equal(complementRow.backlogMinor, '0');
  assert.deepEqual(backlog.totals, { signedRevenueMinor: '120000', earnedSignedRevenueMinor: '120000', backlogMinor: '0' });
});

test('S7-C sépare forecast planifié, non planifié et sans date à 30/60/90 jours', () => {
  const { db, auth } = fixture(), result = financeForecast(db, auth, { asOf: '2026-08-31' });
  assert.equal(result.definitionVersion, 'FINANCE_FORECAST@1');
  assert.deepEqual(result.windows.map(value => [value.days, value.scheduledMinor, value.unscheduledMinor, value.totalMinor]), [['30', '30000', '0', '30000'], ['60', '30000', '50000', '80000'], ['90', '30000', '50000', '80000']].map(([days, ...rest]) => [Number(days), ...rest]));
  assert.deepEqual(result.undated, { amountMinor: '0', lineCount: 0 });
  assert.equal(result.items[0].quoteVersionId, 'version_forecast');
  delete db.projects[0].startDate; delete db.projects[0].endDate;
  const undated = financeForecast(db, auth, { asOf: '2026-08-31' });
  assert.deepEqual(undated.windows.map(value => value.unscheduledMinor), ['0', '0', '0']);
  assert.deepEqual(undated.undated, { amountMinor: '50000', lineCount: 1 });
});

test('S7-C applique les scopes avant agrégation et alimente planned/actual/billable', () => {
  const { db, auth, resourceId } = fixture(), visible = revenueChain(db, auth, { dimensions: ['resourceId'], filters: {} });
  assert.equal(visible.definitionVersion, 'revenue-chain-g7-v1');
  const group = visible.groups.find(value => value.dimensions.resourceId === resourceId), stages = Object.fromEntries(group.stages.map(value => [value.stage, value]));
  assert.equal(stages.planned.valueMinor, '50000'); assert.equal(stages.actual.valueMinor, '20000'); assert.equal(stages.billable.valueMinor, '0');
  assert.equal(stages.invoiced.availability, 'unavailable'); assert.equal(stages.collected.availability, 'unavailable');
  const restricted = structuredClone(auth); restricted.user.organizationScope = false; restricted.user.entityScopes = { client: ['client_forecast'], quote: ['quote_forecast'], resource: [] };
  assert.equal(financeBacklog(db, restricted, { asOf: '2026-08-31' }).totals.backlogMinor, '0');
  assert.equal(financeForecast(db, restricted, { asOf: '2026-08-31' }).itemCount, 0);
});

test('S7-C expose les contrats API et une interface Finance accessible sans persistance nouvelle', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs/api/openapi-v1.yaml'), 'utf8');
  for (const token of ["'/api/v1/analytics/backlog'", "'/api/v1/analytics/forecast'", 'FINANCE_BACKLOG@1', 'FINANCE_FORECAST@1']) assert.match(server, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const token of ['/api/v1/analytics/backlog', '/api/v1/analytics/forecast', 'Backlog signé', 'CA signé restant et prévision 30/60/90 jours', 'Sans date Projet']) assert.ok(app.includes(token), token);
  assert.ok(openapi.includes('/analytics/backlog:')); assert.ok(openapi.includes('/analytics/forecast:')); assert.ok(openapi.includes('FinanceForecastResponse:'));
  assert.equal(server.includes('SPRINT7_FORECAST_MIGRATION'), false, 'les read-models S7-C ne créent aucune collection persistée');
});
