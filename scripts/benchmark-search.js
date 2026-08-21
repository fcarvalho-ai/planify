#!/usr/bin/env node
'use strict';

const { performance } = require('node:perf_hooks');
const { generatePerformanceDataset } = require('./generate-performance-dataset');
const { universalSearch } = require('../server');

function percentile(values, ratio) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

function benchmarkSearch(iterations = 500) {
  const db = generatePerformanceDataset();
  Object.assign(db, { clients: [], budgets: [], quotes: [], serviceOfferings: [], organizationUnits: [] });
  const auth = { user: { companyId: db.companies[0].id, siteIds: db.sites.map(site => site.id), organizationUnitIds: [], organizationScope: true, projectScopeRestricted: false, projectIds: db.projects.map(project => project.id), entityScopes: {}, effectivePermissions: ['planning.read', 'resource.read', 'quote.read', 'serviceOffering.read'] } };
  const queries = ['ressource 001', 'ressource 125', 'ressource 250', 'projet 17'];
  for (let index = 0; index < 30; index++) universalSearch(db, auth, { q: queries[index % queries.length], limit: 20 });
  const durations = [];
  for (let index = 0; index < iterations; index++) {
    const startedAt = performance.now();
    const result = universalSearch(db, auth, { q: queries[index % queries.length], limit: 20 });
    durations.push(performance.now() - startedAt);
    if (!result.items.length) throw new Error('Le benchmark doit produire au moins un résultat.');
  }
  return { dataset: { resources: db.resources.length, reservations: db.reservations.length, projects: db.projects.length }, iterations, p50Ms: Number(percentile(durations, 0.5).toFixed(3)), p95Ms: Number(percentile(durations, 0.95).toFixed(3)), maxMs: Number(Math.max(...durations).toFixed(3)), targetP95Ms: 300 };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(benchmarkSearch(), null, 2)}\n`);

module.exports = { benchmarkSearch };
