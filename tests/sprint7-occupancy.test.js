'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { financeOccupancy, financeProfitability, financeUnbilledOverages, financeRateDiscounts, sprint7OccupancyStateValid } = require('../server.js');

function fixture() {
  const companyId = 'company_occ', siteId = 'site_occ', projectId = 'project_occ', resourceId = 'resource_occ', quoteId = 'quote_occ';
  const db = {
    companies: [{ id: companyId, currency: 'EUR' }], sites: [{ id: siteId, companyId }], clients: [{ id: 'client_occ', companyId }],
    projects: [{ id: projectId, companyId, clientId: 'client_occ', siteId, name: 'Projet Occupation' }],
    resources: [{ id: resourceId, companyId, siteId, resourceCategoryId: 'category_occ', capacity: 1, active: true }], resourceCategories: [{ id: 'category_occ', companyId, siteId }], serviceOfferings: [], organizationUnits: [], stockItems: [],
    reservations: [
      { id: 'planned', companyId, siteId, projectId, status: 'confirmed', startsAt: '2026-09-01T08:00:00.000Z', endsAt: '2026-09-01T16:00:00.000Z', resources: [{ resourceId, quantity: 1 }], version: 1, sourceQuoteId: quoteId, sourceQuoteVersionId: 'version_occ', sourceQuoteLineId: 'line_occ', planningQuantityMilli: '1000', planningUnit: 'jour' },
      { id: 'blocked', companyId, siteId, projectId, status: 'maintenance', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-01T04:00:00.000Z', resources: [{ resourceId, quantity: 1 }], version: 1 },
    ],
    quotes: [{ id: quoteId, companyId, projectId, siteId, kind: 'quote', status: 'accepted', number: 'DEV-OCC', currentVersionId: 'version_occ', revenueRecognition: { quoteVersionId: 'version_occ' }, lines: [{ id: 'line_occ', sourceType: 'resource', sourceId: resourceId, label: 'Montage', unit: 'jour', quantityMilli: '1000', unitPriceMinor: '8000', netHt: '8000', costTotal: '3000', appliedRateId: 'rate_client', priceOrigin: 'client' }] }], budgets: [], quoteVersions: [],
    actualRecords: [{ id: 'actual_occ', companyId, projectId, siteId, reservationId: 'planned', sourceReservationVersion: 1, sourceQuoteId: quoteId, sourceQuoteVersionId: 'version_occ', sourceQuoteLineId: 'line_occ', plannedSnapshot: { startsAt: '2026-09-01T08:00:00.000Z', endsAt: '2026-09-01T16:00:00.000Z', quantityMilli: '1000', unit: 'jour', resources: [{ resourceId, quantity: 1 }] }, currentRevisionId: 'revision_occ', version: 1 }],
    actualRevisions: [{ id: 'revision_occ', companyId, actualRecordId: 'actual_occ', revisionNumber: 1, startsAt: '2026-09-01T08:00:00.000Z', endsAt: '2026-09-01T18:00:00.000Z', quantityMilli: '1500', unit: 'jour', costSnapshot: { totalMinor: '4000' } }],
    plannedCostSnapshots: [{ reservationId: 'planned', sourceReservationVersion: 1, totalMinor: '3000', missingAllocationCount: 0 }], projectCosts: [],
    rates: [{ id: 'rate_catalog', companyId, rateCardId: 'card_catalog', scope: 'catalog', sourceType: 'resource', sourceId: resourceId, unit: 'jour', saleUnitMinor: '10000', costUnitMinor: '3000', validFrom: '2026-01-01', validTo: null, active: true }], rateCards: [{ id: 'card_catalog', companyId, scope: 'catalog', active: true }],
    occupancyThresholds: [{ id: 'threshold_occ', companyId, siteId, underutilizedBps: 3000, saturatedBps: 7000, version: 1 }], occupancyThresholdRevisions: [], occupancyThresholdIdempotency: [],
  };
  const auth = { user: { id: 'finance', companyId, organizationScope: true, siteIds: [siteId], organizationUnitIds: [], projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: ['finance.read', 'quote.read', 'actual.read', 'planning.read', 'resource.read'] } };
  return { db, auth, resourceId };
}

test('S7-D réconcilie capacité nette, planifié, réel et seuils', () => {
  const { db, auth, resourceId } = fixture(), result = financeOccupancy(db, auth, { from: '2026-09-01', to: '2026-09-01', dimension: 'resource' }), row = result.items.find(value => value.dimensionId === resourceId);
  assert.equal(row.grossCapacityMs, 86400000); assert.equal(row.blockedCapacityMs, 14400000); assert.equal(row.availableCapacityMs, 72000000);
  assert.equal(row.plannedCapacityMs, 28800000); assert.equal(row.actualCapacityMs, 36000000); assert.equal(row.actualOccupancyBps, 5000); assert.equal(row.status, 'balanced');
  db.reservations.push({ ...structuredClone(db.reservations[1]), id: 'blocked-overlap' });
  assert.equal(financeOccupancy(db, auth, { from: '2026-09-01', to: '2026-09-01' }).items[0].blockedCapacityMs, 14400000);
  assert.throws(() => financeOccupancy(db, auth, { from: '2025-01-01', to: '2026-09-01' }), error => error.code === 'ANALYTICS_PERIOD_TOO_LARGE');
});

test('S7-D compte une seule double option canonique et conserve le signal planifié sans réalisé', () => {
  const { db, auth } = fixture(), template = db.reservations[0];
  db.reservations = [
    { ...template, id: 'option-priority-2', status: 'option', optionGroupId: 'group-a', optionPriority: 2 },
    { ...template, id: 'option-priority-1', status: 'option', optionGroupId: 'group-a', optionPriority: 1 },
  ];
  db.actualRecords = []; db.actualRevisions = [];
  const row = financeOccupancy(db, auth, { from: '2026-09-01', to: '2026-09-01' }).items[0];
  assert.equal(row.plannedCapacityMs, 28800000);
  assert.equal(row.actualOccupancyBps, null);
  assert.equal(row.plannedOccupancyBps, 3333);

  db.reservations = [
    { ...template, id: 'option-winner', status: 'confirmed', optionGroupId: 'group-decided', optionPriority: 2, optionDecision: { state: 'won' } },
    { ...template, id: 'option-loser', status: 'option', optionGroupId: 'group-decided', optionPriority: 1, optionDecision: { state: 'lost', winnerReservationId: 'option-winner' } },
  ];
  assert.equal(financeOccupancy(db, auth, { from: '2026-09-01', to: '2026-09-01' }).items[0].plannedCapacityMs, 28800000);
});

test('S7-D arbitre les doubles options après filtrage des scopes', () => {
  const { db, auth } = fixture(), visible = db.reservations[0], hiddenSiteId = 'site_hidden', hiddenResourceId = 'resource_hidden';
  db.sites.push({ id: hiddenSiteId, companyId: 'company_occ' });
  db.resources.push({ id: hiddenResourceId, companyId: 'company_occ', siteId: hiddenSiteId, resourceCategoryId: 'category_hidden', capacity: 1, active: true });
  db.reservations = [
    { ...visible, id: 'visible-option', status: 'option', optionGroupId: 'group-scoped', optionPriority: 2 },
    { ...visible, id: 'hidden-option', siteId: hiddenSiteId, status: 'option', optionGroupId: 'group-scoped', optionPriority: 1, resources: [{ resourceId: hiddenResourceId, quantity: 1 }] },
  ];
  const result = financeOccupancy(db, auth, { from: '2026-09-01', to: '2026-09-01' });
  assert.equal(result.items[0].plannedCapacityMs, 28800000);
  assert.equal(result.sources.reservationCount, 1);
});

test('S7-D expose rentabilité, non-facturé et remise sans gonfler le CA signé', () => {
  const { db, auth } = fixture(), profitability = financeProfitability(db, auth, { dimension: 'projectId', asOf: '2026-09-30' }), overages = financeUnbilledOverages(db, auth, { asOf: '2026-09-30' }), discounts = financeRateDiscounts(db, auth);
  assert.equal(profitability.items[0].dimensionId, 'project_occ'); assert.equal(profitability.items[0].signedRevenueMinor, '8000');
  assert.equal(overages.items[0].billableQuantityMilli, '500'); assert.equal(overages.items[0].includedInSignedRevenue, false); assert.equal(overages.items[0].includedInInvoicedRevenue, false);
  assert.deepEqual(overages.items[0].reservationIds, ['planned']); assert.equal(overages.items[0].suggestedAction, 'createComplementaryQuote');
  assert.equal(discounts.items[0].catalogueUnitPriceMinor, '10000'); assert.equal(discounts.items[0].frozenUnitPriceMinor, '8000'); assert.equal(discounts.items[0].discountBps, 2000);
  assert.equal(discounts.weightedMarginBps, 6250);
});

test('S7-D respecte asOf et ventile les dépenses Projet dans la rentabilité', () => {
  const { db, auth } = fixture();
  db.serviceOfferings.push({ id: 'offering_occ', companyId: 'company_occ', organizationUnitId: null });
  db.projectCosts.push({ id: 'project-cost', companyId: 'company_occ', projectId: 'project_occ', siteId: 'site_occ', serviceOfferingId: 'offering_occ', category: 'supplier', description: 'Prestataire', amountMinor: '1200', occurredOn: '2026-09-10', status: 'confirmed' });
  const before = financeProfitability(db, auth, { dimension: 'projectId', asOf: '2026-08-31' }).items[0], after = financeProfitability(db, auth, { dimension: 'projectId', asOf: '2026-09-30' }).items[0];
  assert.equal(before.actualCostMinor, '0'); assert.equal(before.plannedCostMinor, '4200');
  assert.equal(after.actualCostMinor, '5200'); assert.equal(after.plannedCostMinor, '4200');
  const site = financeProfitability(db, auth, { dimension: 'siteId', asOf: '2026-09-30' }).items[0]; assert.equal(site.dimensionId, 'site_occ'); assert.equal(site.actualCostMinor, '5200');
  const offering = financeProfitability(db, auth, { dimension: 'serviceOfferingId', asOf: '2026-09-30' }).items.find(value => value.dimensionId === 'offering_occ'); assert.equal(offering.actualCostMinor, '1200');
});

test('S7-D distingue explicitement une référence catalogue indisponible', () => {
  const { db, auth } = fixture(); db.rates = [];
  const result = financeRateDiscounts(db, auth);
  assert.equal(result.weightedDiscountBps, null); assert.equal(result.catalogueComparableCount, 0);
  assert.equal(result.items[0].catalogueReferenceStatus, 'unavailable'); assert.equal(result.items[0].catalogueUnitPriceMinor, null); assert.equal(result.items[0].discountBps, null);
});

test('S7-D agrège la rentabilité complète au-delà de la pagination du détail', () => {
  const { db, auth } = fixture(), template = db.quotes[0].lines[0];
  db.quotes[0].lines = Array.from({ length: 250 }, (_, index) => ({ ...template, id: `line_${index}`, netHt: '8000', costTotal: '3000' }));
  const result = financeProfitability(db, auth, { dimension: 'projectId', asOf: '2026-09-30' });
  assert.equal(result.items[0].signedRevenueMinor, '2000000');
  assert.equal(result.items[0].sourceIds.length, 200);
  const discounts = financeRateDiscounts(db, auth, { page: '2', pageSize: '50' }); assert.equal(discounts.itemCount, 250); assert.equal(discounts.page, 2); assert.equal(discounts.items.length, 50);
});

test('S7-D valide les seuils persistés et ses contrats publics', () => {
  const { db } = fixture(); const snapshot = structuredClone(db.occupancyThresholds[0]); db.occupancyThresholdRevisions.push({ thresholdId: snapshot.id, companyId: snapshot.companyId, version: 1, snapshot, snapshotDigest: require('../packages/shared/idempotency').digestPayload(snapshot) });
  assert.equal(sprint7OccupancyStateValid(db), true); db.occupancyThresholds[0].saturatedBps = 200; assert.equal(sprint7OccupancyStateValid(db), false);
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs/api/openapi-v1.yaml'), 'utf8');
  for (const token of ['/api/v1/analytics/occupancy', '/api/v1/analytics/profitability', '/api/v1/analytics/unbilled-overages', '/api/v1/analytics/rate-discounts', '/api/v1/finance/occupancy-thresholds']) assert.ok(server.includes(token));
  for (const token of ['/analytics/occupancy:', '/analytics/profitability:', '/analytics/unbilled-overages:', '/analytics/rate-discounts:', '/finance/occupancy-thresholds:']) assert.ok(openapi.includes(token));
  for (const token of ['Capacité nette et contrôle opérationnel', 'Réalisé non facturé', 'Remise / marge pondérées', 'Créer un devis complémentaire', 'renderFinanceOperations']) assert.ok(app.includes(token));
});
