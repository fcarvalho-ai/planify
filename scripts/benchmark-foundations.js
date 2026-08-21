#!/usr/bin/env node
'use strict';

const { performance } = require('node:perf_hooks');
const { generatePerformanceDataset } = require('./generate-performance-dataset');
const { SchedulingEngine } = require('../packages/scheduling');

function percentile(values, ratio) {
  return values[Math.max(0, Math.ceil(values.length * ratio) - 1)];
}

function benchmarkFoundations(iterations = 220) {
  const dataset = generatePerformanceDataset(), engine = new SchedulingEngine(), durations = [];
  for (let index = 0; index < iterations; index++) {
    const resource = dataset.resources[index % dataset.resources.length], day = index % 181;
    const startsAt = new Date(Date.UTC(2026, 0, day + 1, 9)).toISOString(), endsAt = new Date(Date.UTC(2026, 0, day + 1, 17)).toISOString();
    const startedAt = performance.now();
    engine.checkAvailability({ companyId: dataset.companies[0].id, siteId: resource.siteId, startsAt, endsAt, allocations: [{ resourceId: resource.id, quantity: 1 }], resources: dataset.resources, reservations: dataset.reservations });
    durations.push(performance.now() - startedAt);
  }
  durations.sort((left, right) => left - right);
  return {
    dataset: { resources: dataset.resources.length, reservations: dataset.reservations.length, sites: dataset.sites.length, periodMonths: dataset.metadata.periodMonths },
    iterations,
    schedulingAvailabilityMs: { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), max: durations.at(-1) },
  };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(benchmarkFoundations(), null, 2)}\n`);

module.exports = { benchmarkFoundations };
