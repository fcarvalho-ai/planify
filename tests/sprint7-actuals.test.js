'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint7-test-${process.pid}-${Date.now()}.json`);
const { createServer, resetData, makeSeed, readDb, sprint7ActualsStateValid, ssePermissionsForEvent, actualRecordAllowed } = require('../server.js');
const { QuoteConsumptionEngine } = require('../packages/quote-consumption');

let server;
let baseUrl;
let admin;
let viewer;
let scopedPlanner;

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}

async function login(email) {
  const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) });
  assert.equal(result.response.status, 200);
  return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken, user: result.data.user };
}

before(async () => {
  const seed = makeSeed();
  seed.users.find(value => value.id === 'user_viewer').siteIds = ['site_paris'];
  const plannerSeed = seed.users.find(value => value.id === 'user_planner');
  seed.users.push({ ...plannerSeed, id: 'user_actual_planner', email: 'actual.planner@northlight.fr', displayName: 'Planner Actual Paris', siteIds: ['site_paris'] });
  const boulogneResource = seed.resources.find(value => value.siteId === 'site_boulogne');
  seed.reservations.push({ id: 'reservation_actual_boulogne', companyId: 'company_northlight', siteId: 'site_boulogne', projectId: 'project_1', title: 'Mixage terminé Boulogne', startsAt: '2026-08-20T07:00:00.000Z', endsAt: '2026-08-20T15:00:00.000Z', status: 'confirmed', resources: [{ resourceId: boulogneResource.id, quantity: 1 }], planningMode: 'continuous', cellOverrides: [], version: 1 });
  resetData(seed); server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login('admin@northlight.fr'); viewer = await login('viewer@northlight.fr'); scopedPlanner = await login('actual.planner@northlight.fr');
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {}
});

test('Sprint 7 migre les collections Actual avec sauvegarde privée et invariants rejouables', () => {
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-7-actuals-v1');
  assert.ok(marker); assert.deepEqual(marker.collections, ['actualRecords', 'actualRevisions', 'actualIdempotency']); assert.equal(sprint7ActualsStateValid(db), true);
  const backup = path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile); assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
  assert.ok(admin.user.permissions.includes('actual.read')); assert.ok(admin.user.permissions.includes('actual.confirm'));
  assert.deepEqual(ssePermissionsForEvent('actual.confirmed.v1'), ['actual.read']);
});

test('le moteur réconcilie vendu, planifié, réalisé et facturable en entiers exacts', () => {
  const engine = new QuoteConsumptionEngine();
  assert.deepEqual(engine.summarizeActualLine({ soldQuantityMilli: '5000', plannedQuantityMilli: '4000', actualQuantityMilli: '6500' }), { soldQuantityMilli: '5000', plannedQuantityMilli: '4000', actualQuantityMilli: '6500', plannedDeviationQuantityMilli: '2500', soldDeviationQuantityMilli: '1500', billableQuantityMilli: '1500', state: 'overActual' });
  assert.equal(engine.summarizeActualLine({ soldQuantityMilli: '5000', plannedQuantityMilli: '5000', actualQuantityMilli: '4000' }).billableQuantityMilli, '0');
  assert.throws(() => engine.summarizeActualLine({ soldQuantityMilli: '-1', plannedQuantityMilli: '0', actualQuantityMilli: '0' }), error => error.code === 'QUANTITY_INVALID');
});

test('la file à confirmer est dérivée sans écriture et respecte le périmètre site', async () => {
  const before = readDb(), auditCount = before.auditEvents.length;
  const adminResult = await request('/api/v1/actuals/pending?asOf=2026-08-23T00:00:00.000Z&pageSize=200', {}, admin);
  assert.equal(adminResult.response.status, 200); assert.ok(adminResult.data.items.some(value => value.reservationId === 'reservation_1')); assert.ok(adminResult.data.items.some(value => value.reservationId === 'reservation_actual_boulogne'));
  const viewerResult = await request('/api/v1/actuals/pending?asOf=2026-08-23T00:00:00.000Z&pageSize=200', {}, viewer);
  assert.equal(viewerResult.response.status, 200); assert.equal(viewerResult.data.items.some(value => value.reservationId === 'reservation_actual_boulogne'), false);
  const afterRead = readDb(); assert.equal(afterRead.actualRecords.length, 0); assert.equal(afterRead.actualRevisions.length, 0); assert.equal(afterRead.auditEvents.length, auditCount);
});

test('confirmation Actual idempotente, versionnée et auditable sans seconde écriture', async () => {
  const reservation = readDb().reservations.find(value => value.id === 'reservation_1'), body = JSON.stringify({ reservationVersion: reservation.version });
  const confirmed = await request('/api/v1/reservations/reservation_1/actual/confirm', { method: 'POST', headers: { 'Idempotency-Key': 'actual-confirm-1' }, body }, admin);
  assert.equal(confirmed.response.status, 201, JSON.stringify(confirmed.data)); assert.equal(confirmed.data.version, 1); assert.equal(confirmed.data.currentRevision.quantityMilli, confirmed.data.plannedSnapshot.quantityMilli); assert.equal(confirmed.data.currentRevision.confirmationKind, 'confirmed'); assert.equal(confirmed.data.currentRevision.priorRevisionId, null); assert.equal(confirmed.data.currentRevision.digestVersion, 2); assert.match(confirmed.data.currentRevision.sourceDigest, /^[a-f0-9]{64}$/); assert.equal(confirmed.data.reconciliation.state, 'compliant'); assert.equal(confirmed.data.reconciliation.commercialState, 'unmatched'); assert.equal(confirmed.data.reconciliation.billableQuantityMilli, '0');
  const replay = await request('/api/v1/reservations/reservation_1/actual/confirm', { method: 'POST', headers: { 'Idempotency-Key': 'actual-confirm-1' }, body }, admin);
  assert.equal(replay.response.status, 200); assert.equal(replay.data.id, confirmed.data.id);
  const db = readDb(); assert.equal(db.actualRecords.filter(value => value.reservationId === 'reservation_1').length, 1); assert.equal(db.actualRevisions.filter(value => value.actualRecordId === confirmed.data.id).length, 1); assert.equal(db.auditEvents.filter(value => value.action === 'actual.confirmed' && value.entityId === confirmed.data.id).length, 1); assert.equal(db.domainEvents.filter(value => value.type === 'ActualConfirmed' && value.entityId === confirmed.data.id).length, 1);
  const divergent = await request('/api/v1/reservations/reservation_1/actual/confirm', { method: 'POST', headers: { 'Idempotency-Key': 'actual-confirm-1' }, body: JSON.stringify({ reservationVersion: reservation.version, quantityMilli: '2000', deviationReason: 'Durée réelle' }) }, admin);
  assert.equal(divergent.response.status, 409); assert.equal(divergent.data.error.code, 'IDEMPOTENCY_CONFLICT');
});

test('une correction ajoute une révision, exige un motif et refuse une version obsolète', async () => {
  const record = readDb().actualRecords.find(value => value.reservationId === 'reservation_1'), prior = readDb().actualRevisions.find(value => value.id === record.currentRevisionId);
  const missingReason = await request(`/api/v1/actuals/${record.id}/revisions`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-correct-no-reason' }, body: JSON.stringify({ actualVersion: record.version, quantityMilli: '1500' }) }, admin);
  assert.equal(missingReason.response.status, 422); assert.equal(missingReason.data.error.code, 'ACTUAL_CORRECTION_REASON_REQUIRED');
  const changedUnit = await request(`/api/v1/actuals/${record.id}/revisions`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-correct-unit' }, body: JSON.stringify({ actualVersion: record.version, quantityMilli: '1500', unit: 'jour', correctionReason: 'Conversion arbitraire interdite' }) }, admin);
  assert.equal(changedUnit.response.status, 422); assert.equal(changedUnit.data.error.code, 'ACTUAL_UNIT_CONVERSION_REQUIRED');
  const corrected = await request(`/api/v1/actuals/${record.id}/revisions`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-correct-1' }, body: JSON.stringify({ actualVersion: record.version, quantityMilli: '1500', correctionReason: 'Durée constatée après contrôle' }) }, admin);
  assert.equal(corrected.response.status, 201); assert.equal(corrected.data.version, 2); assert.equal(corrected.data.revisions.length, 2); assert.equal(corrected.data.currentRevision.revisionNumber, 2); assert.equal(corrected.data.currentRevision.confirmationKind, 'corrected'); assert.equal(corrected.data.currentRevision.priorRevisionId, prior.id); assert.equal(corrected.data.currentRevision.quantityMilli, '1500'); assert.equal(corrected.data.reconciliation.actualQuantityMilli, '1500'); assert.equal(corrected.data.reconciliation.plannedDeviationQuantityMilli, '500');
  assert.equal(corrected.data.revisions[0].id, prior.id); assert.equal(corrected.data.revisions[0].quantityMilli, prior.quantityMilli);
  const metrics = await request('/api/v1/technical-metrics', {}, admin);
  assert.equal(metrics.response.status, 200); assert.equal(metrics.data.actuals.confirmations, 1); assert.equal(metrics.data.actuals.corrections, 1);
  const stale = await request(`/api/v1/actuals/${record.id}/revisions`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-correct-stale' }, body: JSON.stringify({ actualVersion: 1, quantityMilli: '1700', correctionReason: 'Nouvelle correction' }) }, admin);
  assert.equal(stale.response.status, 409); assert.equal(stale.data.error.code, 'VERSION_CONFLICT');
});

test('la lecture par réservation ne retourne jamais le réalisé d’une ancienne version', async () => {
  const reservation = readDb().reservations.find(value => value.id === 'reservation_1');
  const updated = await request(`/api/v1/reservations/${reservation.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'actual-reservation-v2' }, body: JSON.stringify({ version: reservation.version, notes: 'Version planning postérieure au réalisé V1' }) }, admin);
  assert.equal(updated.response.status, 200, JSON.stringify(updated.data)); assert.equal(updated.data.version, reservation.version + 1);
  const current = await request(`/api/v1/reservations/${reservation.id}/actual`, {}, admin);
  assert.equal(current.response.status, 200); assert.equal(current.data.state, 'pending'); assert.equal(current.data.reservationVersion, updated.data.version); assert.equal(current.data.id, undefined);
});

test('la provenance Devis exige quote.read et le scope du Devis source', () => {
  const db = readDb(), source = db.actualRecords.find(value => value.reservationId === 'reservation_1'), record = structuredClone(source), quoteId = 'quote_actual_protected';
  record.sourceQuoteId = quoteId; record.plannedSnapshot.sourceQuoteId = quoteId;
  db.quotes.push({ id: quoteId, companyId: record.companyId, projectId: record.projectId, siteId: record.siteId, status: 'accepted', lines: [], version: 1 });
  const resourceIds = record.plannedSnapshot.resources.map(value => value.resourceId).filter(Boolean), baseUser = { companyId: record.companyId, siteIds: [record.siteId], organizationScope: false, projectScopeRestricted: true, projectIds: [record.projectId], organizationUnitIds: [], entityScopes: { actual: [record.id], reservation: [record.reservationId], resource: resourceIds, quote: [quoteId] }, effectivePermissions: ['actual.read'] };
  assert.equal(actualRecordAllowed(db, { user: baseUser }, record), false);
  assert.equal(actualRecordAllowed(db, { user: { ...baseUser, effectivePermissions: ['actual.read', 'quote.read'] } }, record), true);
  assert.equal(actualRecordAllowed(db, { user: { ...baseUser, effectivePermissions: ['actual.read', 'quote.read'], entityScopes: { ...baseUser.entityScopes, quote: [] } } }, record), false);
});

test('un lecteur consulte les réalisations mais ne peut jamais confirmer ni corriger', async () => {
  const record = readDb().actualRecords.find(value => value.reservationId === 'reservation_1');
  const detail = await request(`/api/v1/actuals/${record.id}`, {}, viewer); assert.equal(detail.response.status, 200); assert.equal(detail.data.amountVisibility, undefined); assert.equal(detail.data.reconciliation.amountVisibility, 'restricted');
  const deniedConfirm = await request('/api/v1/reservations/reservation_3/actual/confirm', { method: 'POST', headers: { 'Idempotency-Key': 'viewer-confirm' }, body: JSON.stringify({ reservationVersion: readDb().reservations.find(value => value.id === 'reservation_3').version }) }, viewer); assert.equal(deniedConfirm.response.status, 403);
  const deniedCorrection = await request(`/api/v1/actuals/${record.id}/revisions`, { method: 'POST', headers: { 'Idempotency-Key': 'viewer-correct' }, body: JSON.stringify({ actualVersion: record.version, quantityMilli: '2000', correctionReason: 'Interdit' }) }, viewer); assert.equal(deniedCorrection.response.status, 403);
});

test('une version réservation obsolète est refusée sans écriture', async () => {
  const reservation = readDb().reservations.find(value => value.id === 'reservation_4'), before = readDb();
  const changedUnit = await request(`/api/v1/reservations/${reservation.id}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-confirm-unit' }, body: JSON.stringify({ reservationVersion: reservation.version, unit: 'jour', deviationReason: 'Conversion arbitraire interdite' }) }, admin);
  assert.equal(changedUnit.response.status, 422); assert.equal(changedUnit.data.error.code, 'ACTUAL_UNIT_CONVERSION_REQUIRED');
  const result = await request(`/api/v1/reservations/${reservation.id}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-stale-reservation' }, body: JSON.stringify({ reservationVersion: reservation.version - 1 }) }, admin);
  assert.equal(result.response.status, 409); assert.equal(result.data.error.code, 'ACTUAL_SOURCE_STALE');
  const after = readDb(); assert.equal(after.actualRecords.length, before.actualRecords.length); assert.equal(after.auditEvents.length, before.auditEvents.length);
});

test('un replay idempotent revalide le périmètre courant avant de restituer le résultat', async () => {
  const reservation = readDb().reservations.find(value => value.id === 'reservation_3'), payload = JSON.stringify({ reservationVersion: reservation.version });
  const first = await request(`/api/v1/reservations/${reservation.id}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-scoped-replay' }, body: payload }, scopedPlanner);
  assert.equal(first.response.status, 201, JSON.stringify(first.data));
  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin), membership = memberships.data.items.find(value => value.userId === 'user_actual_planner'); assert.ok(membership);
  const reduced = await request(`/api/v1/memberships/${membership.id}/scopes`, { method: 'PUT', headers: { 'Idempotency-Key': 'actual-scope-reduction' }, body: JSON.stringify({ version: membership.version, scope: 'sites', siteIds: ['site_boulogne'], organizationUnitIds: [], projectIds: [reservation.projectId], entityScopes: {} }) }, admin);
  assert.equal(reduced.response.status, 200);
  const replay = await request(`/api/v1/reservations/${reservation.id}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'actual-scoped-replay' }, body: payload }, scopedPlanner);
  assert.equal(replay.response.status, 404); assert.equal(replay.data.error.code, 'NOT_FOUND');
  assert.equal(readDb().actualRecords.filter(value => value.reservationId === reservation.id).length, 1);
});

test('le rejeu de migration refuse une révision réalisée falsifiée', () => {
  const raw = fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), tampered = JSON.parse(raw), revision = tampered.actualRevisions[0]; assert.ok(revision);
  revision.quantityMilli = String(BigInt(revision.quantityMilli) + 1n); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 });
  assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const metadataTampered = JSON.parse(raw), metadataRevision = metadataTampered.actualRevisions.find(value => value.digestVersion === 2); assert.ok(metadataRevision); metadataRevision.confirmedAt = new Date(Date.parse(metadataRevision.confirmedAt) + 1000).toISOString(); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(metadataTampered, null, 2)}\n`, { mode: 0o600 });
  assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  fs.writeFileSync(process.env.PLANIFY_DATA_FILE, raw, { mode: 0o600 }); assert.equal(sprint7ActualsStateValid(readDb()), true);
});

test('l’interface expose une page dédiée, une confirmation et une correction accessibles', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), shell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(shell, /href="#actuals"[^>]*data-actual-nav/); assert.match(source, /Réalisations à confirmer/); assert.match(source, /data-actual-confirm/); assert.match(source, /data-actual-correct/); assert.match(source, /aria-labelledby="actual-dialog-title"/); assert.match(source, /name="unit" readonly/); assert.match(source, /startsWith\('actual\.'\)/); assert.match(css, /\.actual-dialog/);
});
