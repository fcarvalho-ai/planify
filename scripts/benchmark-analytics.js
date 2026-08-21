#!/usr/bin/env node
'use strict';

const { performance } = require('node:perf_hooks');
const { generatePerformanceDataset } = require('./generate-performance-dataset');
const { revenueChain } = require('../server');

function percentile(values, ratio) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

function benchmarkAnalytics(iterations = 220) {
  const db = generatePerformanceDataset(), companyId = db.companies[0].id;
  db.clients = Array.from({ length: 40 }, (_, index) => ({ id: `client_${index + 1}`, companyId, name: `Client ${index + 1}`, active: true }));
  for (let index = 0; index < db.projects.length; index++) Object.assign(db.projects[index], { clientId: db.clients[index].id, salesOwnerId: `sales_${index % 5 + 1}` });
  db.serviceOfferings = Array.from({ length: 20 }, (_, index) => ({ id: `offering_${index + 1}`, companyId, name: `Prestation ${index + 1}`, active: true }));
  const document = (kind, index) => {
    const project = db.projects[index % db.projects.length], netHt = String(10000 + index * 10), id = `${kind}_${index + 1}`, accepted = kind === 'quote' && index % 3 === 0;
    return { id, companyId, kind, projectId: project.id, siteId: project.siteId, status: accepted ? 'accepted' : 'draft', sequence: 1, taxDate: `2026-${String(index % 6 + 1).padStart(2, '0')}-15`, currency: 'EUR', currencyExponent: 2, netHt, createdBy: `user_${index % 10 + 1}`, currentVersionId: `${id}_v1`, lines: [{ id: `${id}_line`, sourceType: 'serviceOffering', sourceId: db.serviceOfferings[index % db.serviceOfferings.length].id, netHt }], ...(accepted ? { revenueRecognition: { state: 'active', quoteVersionId: `${id}_v1`, netHt, recognizedAt: `2026-${String(index % 6 + 1).padStart(2, '0')}-16T10:00:00.000Z` } } : {}) };
  };
  db.budgets = Array.from({ length: 1000 }, (_, index) => document('budget', index));
  db.quotes = Array.from({ length: 1000 }, (_, index) => document('quote', index));
  const auth = { user: { companyId, organizationScope: true, projectScopeRestricted: false, projectIds: [], siteIds: db.sites.map(site => site.id), organizationUnitIds: [], entityScopes: {}, effectivePermissions: ['finance.read'] } };
  const input = { dimensions: ['date', 'clientId', 'projectId', 'serviceOfferingId', 'siteId', 'legalEntityId', 'salesOwnerId', 'userId'], filters: {}, from: '2026-01-01', to: '2026-06-30' };
  for (let index = 0; index < 20; index++) revenueChain(db, auth, input);
  const durations = [];
  for (let index = 0; index < iterations; index++) {
    const startedAt = performance.now(), result = revenueChain(db, auth, input);
    durations.push(performance.now() - startedAt);
    if (!result.groups.length) throw new Error('Le benchmark analytique doit produire des groupes.');
  }
  return { dataset: { budgets: db.budgets.length, quotes: db.quotes.length, lines: db.budgets.length + db.quotes.length, dimensions: input.dimensions.length }, iterations, p50Ms: Number(percentile(durations, 0.5).toFixed(3)), p95Ms: Number(percentile(durations, 0.95).toFixed(3)), maxMs: Number(Math.max(...durations).toFixed(3)), targetP95Ms: 300 };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(benchmarkAnalytics(), null, 2)}\n`);

module.exports = { benchmarkAnalytics };
