'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const prefix = `planify-actuals-benchmark-${process.pid}-${Date.now()}.json`;
process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), prefix);
const { actualRevisionDigest, createServer, makeSeed, readDb, resetData } = require('../server.js');

const percentile = (values, ratio) => values.slice().sort((left, right) => left - right)[Math.max(0, Math.ceil(values.length * ratio) - 1)] || 0;
const measure = async (iterations, callback) => { const values = []; for (let index = 0; index < iterations; index++) { const started = performance.now(); await callback(index); values.push(performance.now() - started); } return { p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) }; };

async function main() {
  resetData(makeSeed()); const db = readDb(), companyId = 'company_northlight', timestamp = '2026-08-01T08:00:00.000Z';
  const reservationCount = 10000, actualCount = 2500;
  for (let index = 0; index < reservationCount; index++) {
    const reservationId = `actual_benchmark_reservation_${index}`, recordId = `actual_benchmark_record_${index}`, revisionId = `actual_benchmark_revision_${index}`;
    const reservation = { id: reservationId, companyId, siteId: 'site_paris', projectId: 'project_1', title: `Réalisation ${index}`, startsAt: '2026-08-01T07:00:00.000Z', endsAt: '2026-08-01T08:00:00.000Z', status: 'completed', resources: [{ resourceId: 'resource_1', quantity: 1 }], planningMode: 'continuous', cellOverrides: [], version: 1, createdBy: 'user_admin', createdAt: timestamp, updatedAt: timestamp };
    db.reservations.push(reservation);
    if (index >= actualCount) continue;
    const plannedSnapshot = { startsAt: reservation.startsAt, endsAt: reservation.endsAt, quantityMilli: '1000', unit: 'unite', sourceQuoteId: null, sourceQuoteVersionId: null, sourceQuoteLineId: null, resources: structuredClone(reservation.resources) };
    const record = { id: recordId, companyId, reservationId, projectId: reservation.projectId, siteId: reservation.siteId, sourceReservationVersion: 1, sourceQuoteId: null, sourceQuoteVersionId: null, sourceQuoteLineId: null, plannedSnapshot, currentRevisionId: revisionId, version: 1, createdBy: 'user_admin', createdAt: timestamp, updatedAt: timestamp };
    const revision = { id: revisionId, companyId, actualRecordId: recordId, revisionNumber: 1, startsAt: reservation.startsAt, endsAt: reservation.endsAt, quantityMilli: '1000', unit: 'unite', confirmationKind: 'confirmed', deviationReason: '', correctionReason: '', sourceReservationVersion: 1, priorRevisionId: null, confirmedBy: 'user_admin', confirmedAt: timestamp, createdBy: 'user_admin', createdAt: timestamp, digestVersion: 2 }; revision.sourceDigest = actualRevisionDigest(revision);
    db.actualRecords.push(record); db.actualRevisions.push(revision);
  }
  for (let index = 0; index < 6; index++) db.reservations.push({ id: `actual_benchmark_pending_${index}`, companyId, siteId: 'site_paris', projectId: 'project_1', title: `À confirmer ${index}`, startsAt: '2026-08-02T07:00:00.000Z', endsAt: '2026-08-02T08:00:00.000Z', status: 'confirmed', resources: [{ resourceId: 'resource_1', quantity: 1 }], planningMode: 'continuous', cellOverrides: [], version: 1, createdBy: 'user_admin', createdAt: timestamp, updatedAt: timestamp });
  fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(db)}\n`, { mode: 0o600 });

  const server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }) }), auth = await login.json(), cookie = login.headers.get('set-cookie').split(';', 1)[0];
  const request = async (route, options = {}) => { const headers = { cookie, ...(options.body ? { 'content-type': 'application/json', 'x-csrf-token': auth.csrfToken } : {}), ...options.headers }; const response = await fetch(`${base}${route}`, { ...options, headers }); if (!response.ok) throw new Error(`${route}: HTTP ${response.status} ${await response.text()}`); await response.arrayBuffer(); };
  await request('/api/v1/actuals?pageSize=200');
  const list = await measure(20, () => request('/api/v1/actuals?pageSize=200')), pending = await measure(20, () => request('/api/v1/actuals/pending?pageSize=200')), detail = await measure(20, index => request(`/api/v1/actuals/actual_benchmark_record_${index}`));
  const confirm = await measure(5, index => request(`/api/v1/reservations/actual_benchmark_pending_${index}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': `benchmark-confirm-${index}` }, body: JSON.stringify({ reservationVersion: 1 }) }));
  const correction = await measure(5, index => request(`/api/v1/actuals/actual_benchmark_record_${index}/revisions`, { method: 'POST', headers: { 'Idempotency-Key': `benchmark-correct-${index}` }, body: JSON.stringify({ actualVersion: 1, quantityMilli: '1100', correctionReason: 'Mesure représentative' }) }));
  console.log(JSON.stringify({ dataset: { resources: db.resources.length, reservations: db.reservations.length, actualRecords: db.actualRecords.length }, latencyMs: { list, pending, detail, confirm, correction }, thresholdsMs: { readP95: 300, writeP95: 250 } }, null, 2));
  if ([list.p95, pending.p95, detail.p95].some(value => value >= 300) || [confirm.p95, correction.p95].some(value => value >= 250)) process.exitCode = 1;
  await new Promise(resolve => server.close(resolve));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { for (const name of fs.readdirSync(os.tmpdir())) if (name.startsWith(prefix)) try { fs.unlinkSync(path.join(os.tmpdir(), name)); } catch {} });
