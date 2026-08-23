'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const prefix = `planify-finance-benchmark-${process.pid}-${Date.now()}.json`;
process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), prefix);
const { actualRevisionDigest, financeBacklog, financeForecast, financeMargins, financeOccupancy, financeProfitability, financeUnbilledOverages, financeRateDiscounts, makeSeed, readDb, resetData } = require('../server.js');

const percentile = (values, ratio) => values.slice().sort((left, right) => left - right)[Math.max(0, Math.ceil(values.length * ratio) - 1)] || 0;
const measure = (iterations, callback) => {
  const values = [];
  for (let index = 0; index < iterations; index++) { const started = performance.now(); callback(); values.push(performance.now() - started); }
  return { p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) };
};

function main() {
  resetData(makeSeed());
  const db = readDb(), companyId = 'company_northlight', project = db.projects.find(value => value.id === 'project_1'), client = db.clients.find(value => value.id === project.clientId), category = db.resourceCategories.find(value => value.siteId === 'site_paris' && value.active !== false), timestamp = '2026-08-01T08:00:00.000Z';
  while (db.resources.filter(value => value.companyId === companyId).length < 250) { const index = db.resources.length; db.resources.push({ id: `finance_benchmark_resource_${index}`, companyId, siteId: 'site_paris', resourceCategoryId: category.id, name: `Ressource Finance ${index}`, type: 'room', capacity: 1, active: true, version: 1 }); }
  db.quotes = []; db.actualRecords = []; db.actualRevisions = []; db.projectCosts = []; db.projectCostRevisions = []; db.costRates = []; db.plannedCostSnapshots = [];
  const resources = db.resources.filter(value => value.companyId === companyId).slice(0, 250);
  for (const resource of resources) db.costRates.push({ id: `finance_benchmark_rate_${resource.id}`, companyId, scopeType: 'resource', scopeId: resource.id, unit: 'unite', costUnitMinor: '2500', currency: 'EUR', validFrom: '2026-01-01', validTo: null, active: true, version: 1, createdAt: timestamp, updatedAt: timestamp });
  for (let index = 0; index < 2000; index++) {
    const resource = resources[index % resources.length], quoteId = `finance_benchmark_quote_${index}`, lineId = `finance_benchmark_line_${index}`;
    db.quotes.push({ id: quoteId, companyId, projectId: project.id, siteId: 'site_paris', kind: 'quote', status: 'accepted', number: `DEV-BENCH-${index}`, currency: 'EUR', currencyExponent: 2, version: 1, lines: [{ id: lineId, sourceType: 'resource', sourceId: resource.id, label: `Prestation ${index}`, unit: 'unite', quantityMilli: '5000', netHt: '10000', costTotal: '2500' }] });
  }
  for (let index = 0; index < 10000; index++) {
    const resource = resources[index % resources.length], quoteIndex = index % 2000, reservationId = `finance_benchmark_reservation_${index}`, quoteId = `finance_benchmark_quote_${quoteIndex}`, lineId = `finance_benchmark_line_${quoteIndex}`;
    db.reservations.push({ id: reservationId, companyId, siteId: 'site_paris', projectId: project.id, title: `Planifié ${index}`, startsAt: '2026-08-01T07:00:00.000Z', endsAt: '2026-08-01T08:00:00.000Z', status: index < 2000 ? 'completed' : 'confirmed', resources: [{ resourceId: resource.id, quantity: 1 }], planningMode: 'continuous', cellOverrides: [], sourceQuoteId: quoteId, sourceQuoteLineId: lineId, version: 1, createdBy: 'user_admin', createdAt: timestamp, updatedAt: timestamp });
    db.plannedCostSnapshots.push({ id: `finance_benchmark_planned_${index}`, companyId, reservationId, sourceReservationVersion: 1, frozenAt: timestamp, policyVersion: 'SPRINT7_FINANCE@1', state: 'resolved', at: '2026-08-01', unit: 'unite', entries: [{ resourceId: resource.id, quantityMilli: '1000', allocationQuantity: '1', costRateId: `finance_benchmark_rate_${resource.id}`, costRateVersion: 1, costUnitMinor: '2500', amountMinor: '2500', currency: 'EUR', resolvedAt: timestamp }], missingAllocationCount: 0, totalMinor: '2500' });
    if (index >= 2000) continue;
    const recordId = `finance_benchmark_actual_${index}`, revisionId = `finance_benchmark_revision_${index}`, plannedSnapshot = { startsAt: '2026-08-01T07:00:00.000Z', endsAt: '2026-08-01T08:00:00.000Z', quantityMilli: '1000', unit: 'unite', sourceQuoteId: quoteId, sourceQuoteVersionId: null, sourceQuoteLineId: lineId, resources: [{ resourceId: resource.id, quantity: 1 }] };
    db.actualRecords.push({ id: recordId, companyId, reservationId, projectId: project.id, siteId: 'site_paris', sourceReservationVersion: 1, sourceQuoteId: quoteId, sourceQuoteVersionId: null, sourceQuoteLineId: lineId, plannedSnapshot, currentRevisionId: revisionId, version: 1, createdBy: 'user_admin', createdAt: timestamp, updatedAt: timestamp });
    const costSnapshot = { policyVersion: 'SPRINT7_FINANCE@1', state: 'resolved', at: '2026-08-01', unit: 'unite', entries: [{ resourceId: resource.id, quantityMilli: '1000', allocationQuantity: '1', costRateId: `finance_benchmark_rate_${resource.id}`, costRateVersion: 1, costUnitMinor: '2500', amountMinor: '2500', currency: 'EUR', resolvedAt: timestamp }], missingAllocationCount: 0, totalMinor: '2500' }, revision = { id: revisionId, companyId, actualRecordId: recordId, revisionNumber: 1, startsAt: plannedSnapshot.startsAt, endsAt: plannedSnapshot.endsAt, quantityMilli: '1000', unit: 'unite', confirmationKind: 'confirmed', deviationReason: '', correctionReason: '', sourceReservationVersion: 1, priorRevisionId: null, confirmedBy: 'user_admin', confirmedAt: timestamp, createdBy: 'user_admin', createdAt: timestamp, digestVersion: 3, costSnapshot }; revision.sourceDigest = actualRevisionDigest(revision); db.actualRevisions.push(revision);
  }
  for (let index = 0; index < 2000; index++) db.projectCosts.push({ id: `finance_benchmark_project_cost_${index}`, companyId, projectId: project.id, siteId: 'site_paris', serviceOfferingId: null, reservationId: null, category: 'supplier', occurredOn: '2026-08-01', amountMinor: '100', currency: 'EUR', description: `Dépense ${index}`, supplierReference: null, status: 'confirmed', version: 1, createdBy: 'user_admin', createdAt: timestamp, updatedBy: 'user_admin', updatedAt: timestamp });
  const auth = { user: { id: 'user_admin', companyId, siteIds: db.sites.filter(value => value.companyId === companyId).map(value => value.id), organizationUnitIds: [], organizationScope: true, projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: ['finance.read', 'quote.read', 'actual.read'] } };
  const runMargins = () => financeMargins(db, auth, { projectId: project.id, asOf: '2026-08-23' }), runBacklog = () => financeBacklog(db, auth, { projectId: project.id, asOf: '2026-08-23' }), runForecast = () => financeForecast(db, auth, { projectId: project.id, asOf: '2026-08-23' }), runOccupancy = () => financeOccupancy(db, auth, { from: '2026-08-01', to: '2026-08-01', groupBy: 'day', dimension: 'resource' }), runProfitability = () => financeProfitability(db, auth, { projectId: project.id, asOf: '2026-08-23', dimension: 'resourceId' }), runUnbilled = () => financeUnbilledOverages(db, auth, { projectId: project.id, asOf: '2026-08-23' }), runDiscounts = () => financeRateDiscounts(db, auth, {}); runMargins(); runBacklog(); runForecast(); runOccupancy(); runProfitability(); runUnbilled(); runDiscounts();
  const margins = measure(8, runMargins), backlog = measure(8, runBacklog), forecast = measure(8, runForecast), occupancy = measure(8, runOccupancy), profitability = measure(8, runProfitability), unbilled = measure(8, runUnbilled), discounts = measure(8, runDiscounts), sample = runMargins(), output = { dataset: { resources: resources.length, reservations: 10000, commercialDocuments: db.quotes.length, actualRecords: db.actualRecords.length, projectCosts: db.projectCosts.length, clientId: client.id }, latencyMs: { margins, backlog, forecast, occupancy, profitability, unbilled, discounts }, result: { itemCount: sample.itemCount, signedRevenueMinor: sample.totals.signedRevenueMinor, plannedCostMinor: sample.totals.plannedCostMinor, actualCostMinor: sample.totals.actualCostMinor }, thresholdMs: { readP95: 300 } };
  console.log(JSON.stringify(output, null, 2)); if ([margins, backlog, forecast, occupancy, profitability, unbilled, discounts].some(value => value.p95 >= 300)) process.exitCode = 1;
}

try { main(); } finally { for (const name of fs.readdirSync(os.tmpdir())) if (name.startsWith(prefix)) try { fs.unlinkSync(path.join(os.tmpdir(), name)); } catch {} }
