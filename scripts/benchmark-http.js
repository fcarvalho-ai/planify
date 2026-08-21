#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'planify-g0-http-'));
process.env.PLANIFY_DATA_FILE = path.join(temporaryDirectory, 'planify.json');
process.env.PLANIFY_ALLOW_ORIGINLESS_MUTATIONS = 'true';

const { createServer, makeSeed, resetData } = require('../server');

function percentile(values, ratio) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)]; }
function summary(values) { return { p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) }; }
function at(day, hour) { return new Date(Date.UTC(2026, 0, 1 + day, hour)).toISOString(); }

async function benchmarkHttp() {
  const seed = makeSeed(), companyId = 'company_northlight', siteId = 'site_paris';
  seed.resources = Array.from({ length: 250 }, (_, index) => ({ id: `perf_resource_${index + 1}`, companyId, siteId, name: `Ressource performance ${String(index + 1).padStart(3, '0')}`, type: 'room', capacity: 1, color: '#7667f5', active: true, version: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }));
  seed.reservations = Array.from({ length: 10_000 }, (_, index) => ({ id: `perf_reservation_${index + 1}`, companyId, siteId, projectId: 'project_1', title: `Réservation performance ${index + 1}`, status: index % 29 === 0 ? 'cancelled' : 'confirmed', startsAt: at(index % 181, 8), endsAt: at(index % 181, 18), resources: [{ resourceId: `perf_resource_${index % 250 + 1}`, quantity: 1 }], planningMode: 'continuous', includeWeekends: true, cellOverrides: [], version: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }));
  resetData(seed);
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginResponse = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }) });
    if (loginResponse.status !== 200) throw new Error(`Login HTTP ${loginResponse.status}`);
    const login = await loginResponse.json(), cookie = loginResponse.headers.get('set-cookie').split(';', 1)[0];
    const call = async (route, options = {}) => { const startedAt = performance.now(), response = await fetch(`${base}${route}`, { ...options, headers: { origin: base, cookie, ...(options.body ? { 'content-type': 'application/json', 'x-csrf-token': login.csrfToken } : {}), ...options.headers } }); await response.arrayBuffer(); return { status: response.status, durationMs: performance.now() - startedAt }; };
    for (let index = 0; index < 5; index++) await call('/api/v1/reservations?siteId=site_paris&from=2026-01-01T00%3A00%3A00.000Z&to=2026-07-01T00%3A00%3A00.000Z&pageSize=200');
    const reads = []; for (let index = 0; index < 30; index++) reads.push((await call(`/api/v1/reservations?siteId=site_paris&from=2026-01-01T00%3A00%3A00.000Z&to=2026-07-01T00%3A00%3A00.000Z&page=${index % 10 + 1}&pageSize=200`)).durationMs);
    const conflicts = []; for (let index = 0; index < 30; index++) { const result = await call('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': `perf-conflict-${index}` }, body: JSON.stringify({ siteId, projectId: 'project_1', title: `Conflit ${index}`, status: 'confirmed', startsAt: at(1, 8), endsAt: at(1, 18), resources: [{ resourceId: 'perf_resource_2', quantity: 1 }] }) }); if (result.status !== 409) throw new Error(`Conflit attendu, HTTP ${result.status}`); conflicts.push(result.durationMs); }
    const writes = []; let replayPayload, replayKey;
    for (let index = 0; index < 20; index++) { const payload = { siteId, projectId: 'project_1', title: `Écriture performance ${index}`, status: 'confirmed', startsAt: new Date(Date.UTC(2027, 0, 2 + index, 8)).toISOString(), endsAt: new Date(Date.UTC(2027, 0, 2 + index, 18)).toISOString(), resources: [{ resourceId: `perf_resource_${index + 1}`, quantity: 1 }] }, key = `perf-write-${index}`; const result = await call('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(payload) }); if (result.status !== 201) throw new Error(`Écriture attendue, HTTP ${result.status}`); writes.push(result.durationMs); if (index === 0) { replayPayload = payload; replayKey = key; } }
    const replay = await call('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': replayKey }, body: JSON.stringify(replayPayload) });
    if (replay.status !== 200) throw new Error(`Rejeu attendu, HTTP ${replay.status}`);
    const batch100 = [];
    for (let iteration = 0; iteration < 10; iteration++) {
      const date = new Date(Date.UTC(2028, 0, 1 + iteration)).toISOString().slice(0, 10), actions = Array.from({ length: 100 }, (_, index) => ({ type: 'create', title: `Lot performance ${iteration + 1}.${index + 1}`, siteId, projectId: 'project_1', status: 'confirmed', startsAt: `${date}T08:00:00.000Z`, endsAt: `${date}T18:00:00.000Z`, resources: [{ resourceId: `perf_resource_${index + 1}`, quantity: 1 }], includeWeekends: true, planningMode: 'dailyCells', timeGranularity: 'hour', snapMinutes: 60 }));
      const result = await call('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': `perf-batch-100-${iteration}` }, body: JSON.stringify({ actions }) });
      if (result.status !== 201) throw new Error(`Lot 100 attendu, HTTP ${result.status}`);
      batch100.push(result.durationMs);
    }
    return { node: process.version, dataset: { resources: 250, reservations: 10_000, fileBytes: fs.statSync(process.env.PLANIFY_DATA_FILE).size }, iterations: { reads: reads.length, conflicts: conflicts.length, writes: writes.length, batch100: batch100.length }, durationsMs: { reads: summary(reads), conflicts: summary(conflicts), writes: summary(writes), batch100: summary(batch100), idempotentReplay: replay.durationMs }, process: { rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed } };
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) benchmarkHttp().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });

module.exports = { benchmarkHttp };
