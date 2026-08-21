'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-quotes-test-${process.pid}-${Date.now()}.json`);

const { createServer, resetData, makeSeed, readDb, quoteLineAmounts } = require('../server.js');

let server;
let baseUrl;
let admin;
let planner;
let viewer;
let quote;
let reservationOperation = 0;
let mutationOperation = 0;

function quoteReadySeed() {
  const seed = makeSeed(), company = seed.companies[0];
  seed.users.find(value => value.id === 'user_viewer').siteIds = ['site_paris'];
  Object.assign(company, {
    registrationNumber: '184207833', establishmentNumber: '18420783300094', vatNumber: 'FR84184207833',
    taxCountry: 'FR', vatStatus: 'registered', fiscalValidatedAt: '2026-08-14T08:00:00.000Z',
    fiscalValidatedBy: 'user_admin', defaultVatRateId: 'vat_northlight_standard',
  });
  seed.organizationAddresses = [{ id: 'address_northlight_registered', companyId: company.id, type: 'registeredOffice', label: 'Siège social', line1: '10 rue de la Post-production', postalCode: '75011', city: 'Paris', country: 'FR', isPrimary: true, version: 1, createdAt: '2026-08-14T08:00:00.000Z', updatedAt: '2026-08-14T08:00:00.000Z' }];
  seed.vatRates = [
    { id: 'vat_northlight_standard', companyId: company.id, code: 'STANDARD', label: 'Taux normal', rateBps: 2000, active: true, validFrom: '2020-01-01', version: 1, createdAt: '2026-08-14T08:00:00.000Z', updatedAt: '2026-08-14T08:00:00.000Z' },
    { id: 'vat_northlight_reduced', companyId: company.id, code: 'REDUCED', label: 'Taux réduit', rateBps: 1000, active: true, validFrom: '2020-01-01', version: 1, createdAt: '2026-08-14T08:00:00.000Z', updatedAt: '2026-08-14T08:00:00.000Z' },
  ];
  seed.clients.push({ id: 'client_foreign', companyId: 'company_eliote_location', name: 'Client autre société', code: 'FOREIGN', active: true, version: 1, createdAt: '2026-08-14T08:00:00.000Z', updatedAt: '2026-08-14T08:00:00.000Z' });
  return seed;
}

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (route === '/api/v1/reservations' && options.method === 'POST' && !headers['Idempotency-Key'] && !headers['idempotency-key']) headers['Idempotency-Key'] = `quotes-reservation-${++reservationOperation}`;
  if (!['GET', 'HEAD'].includes(options.method || 'GET') && route !== '/api/v1/auth/login' && !headers['Idempotency-Key'] && !headers['idempotency-key']) headers['Idempotency-Key'] = `quotes-mutation-${++mutationOperation}`;
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}

async function login(email) {
  const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) });
  assert.equal(result.response.status, 200); return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken, user: result.data.user };
}

async function openEventStream(auth) {
  const controller = new AbortController(), response = await fetch(`${baseUrl}/api/v1/events`, { headers: { cookie: auth.cookie, accept: 'text/event-stream' }, signal: controller.signal }); assert.equal(response.status, 200);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffered = '';
  while (!buffered.includes(': connected')) { const chunk = await reader.read(); if (chunk.done) throw new Error('Flux SSE fermé avant connexion.'); buffered += decoder.decode(chunk.value, { stream: true }); }
  return { controller, reader, decoder, buffered: buffered.replace(/^.*?: connected\n\n/s, '') };
}
async function nextInvalidation(stream, timeoutMs = 1000) {
  const read = async () => { while (!stream.buffered.includes('event: invalidation')) { const chunk = await stream.reader.read(); if (chunk.done) return null; stream.buffered += stream.decoder.decode(chunk.value, { stream: true }); } const boundary = stream.buffered.indexOf('\n\n'), event = stream.buffered.slice(0, boundary + 2); stream.buffered = stream.buffered.slice(boundary + 2); return event; };
  return Promise.race([read(), new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))]);
}
function closeEventStream(stream) { stream.controller.abort(); stream.reader.cancel().catch(() => {}); }
function storedZip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, content] of Object.entries(entries)) { const nameBuffer = Buffer.from(name), data = Buffer.from(content), local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuffer.length, 26); const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42); locals.push(local, nameBuffer, data); centrals.push(central, nameBuffer); offset += local.length + nameBuffer.length + data.length; }
  const directory = Buffer.concat(centrals), eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(entries).length, 8); eocd.writeUInt16LE(Object.keys(entries).length, 10); eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(offset, 16); return Buffer.concat([...locals, directory, eocd]);
}
function clientPlanningXlsx() {
  const rows = [['Date','Prestation','Salle','Heure début','Heure fin'],['14/06/2028','Montage Avid','Salle Montage A','09:00','18:00'],['15/06/2028','Montage Avid','Salle Montage A','09:00','18:00']], xmlRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${rowIndex + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`).join(''); return storedZip({ 'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData>${xmlRows}</sheetData></worksheet>` });
}
function les50PlanningXlsx() {
  const cell = (ref, value, type = 'inlineStr') => type === 'inlineStr' ? `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>` : `<c r="${ref}"><v>${value}</v></c>`;
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1">${cell('A1', 'PLANNING POST-PROD LES 50 S5')}</row>
    <row r="2">${cell('U2', '44747', 'n')}${cell('V2', '44748', 'n')}${cell('W2', '44749', 'n')}</row>
    <row r="49">${cell('B49', 'E01')}${cell('C49', 'CHEF MONTEUR')}${cell('D49', "Ludo D'HERMY")}${cell('F49', '2', 'n')}${cell('U49', 'E01')}${cell('V49', 'E01')}</row>
    <row r="50">${cell('B50', 'E01')}${cell('C50', "Chef d'ed")}${cell('D50', 'Véro KRUHAK')}${cell('F50', '2', 'n')}${cell('U50', 'E01')}${cell('W50', 'E01')}</row>
  </sheetData></worksheet>`;
  return storedZip({ 'xl/workbook.xml': '<?xml version="1.0"?><workbook><workbookPr date1904="1"/></workbook>', 'xl/worksheets/sheet1.xml': sheet });
}

before(async () => {
  resetData(quoteReadySeed());
  const db = readDb(), timestamp = '2026-08-14T08:00:00.000Z';
  db.rateCards.push(
    { id: 'rateCard_test_client_1', companyId: 'company_northlight', clientId: 'client_1', name: 'Grille client test', scope: 'client', active: true, version: 1, createdAt: timestamp, updatedAt: timestamp },
    { id: 'rateCard_test_project_1', companyId: 'company_northlight', projectId: 'project_1', name: 'Grille projet test', scope: 'project', active: true, version: 1, createdAt: timestamp, updatedAt: timestamp },
  );
  resetData(db); server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login('admin@northlight.fr'); planner = await login('planner@northlight.fr'); viewer = await login('viewer@northlight.fr');
});

after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

test('le calcul monétaire entier applique half-up sans Number', () => {
  assert.deepEqual(quoteLineAmounts('500', '1', 5000), { baseNetHt: '1', discountAmount: '0', netHt: '1', vatAmount: '1', grossTtc: '2' });
  assert.deepEqual(quoteLineAmounts('1000', '1', 0), { baseNetHt: '1', discountAmount: '0', netHt: '1', vatAmount: '0', grossTtc: '1' });
  assert.deepEqual(quoteLineAmounts('1000', '101', 2000, 1000), { baseNetHt: '101', discountAmount: '10', netHt: '91', vatAmount: '18', grossTtc: '109' });
  assert.throws(() => quoteLineAmounts('1000', '9223372036854775807', 2000), error => error.code === 'AMOUNT_OVERFLOW');
});

test('la migration Commercial 08 est additive, marquée et idempotente', () => {
  const first = readDb(), second = readDb(), markers = second.migrations.filter(value => value.id === 'commercial-08-quotes-v1');
  assert.equal(markers.length, 1); assert.equal(markers[0].additive, true); assert.deepEqual(markers[0].collections, ['quotes', 'quoteIdempotency', 'quoteNumberCounters']);
  for (const key of markers[0].collections) assert.ok(Array.isArray(second[key]));
  assert.equal(first.quotes.length, second.quotes.length);
  assert.ok(second.roles.find(value => value.code === 'organizationAdmin').permissions.includes('quote.overrideVatRate'));
  assert.ok(second.roles.find(value => value.code === 'organizationAdmin').permissions.includes('quote.accept'));
  assert.equal(second.migrations.filter(value => value.id === 'commercial-08-project-to-validated-quote-v4').length, 1);
  assert.equal(second.migrations.filter(value => value.id === 'commercial-08-review-p1-v3').length, 1);
});

test('la migration Review sauvegarde les octets, authentifie le replay et se restaure', () => {
  const migrationId = 'commercial-08-review-p1-v3', serverPath = path.join(__dirname, '..', 'server.js'), sourceDb = structuredClone(readDb()); sourceDb.migrations = sourceDb.migrations.filter(value => value.id !== migrationId); sourceDb.quotes = [{ id: 'quote_legacy_security', companyId: 'company_northlight', projectId: 'project_1', siteId: 'site_paris', kind: 'quote', entityType: 'quote', title: 'Legacy security', status: 'draft', lines: [], version: 2, createdBy: 'user_admin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }]; sourceDb.budgets = []; sourceDb.quoteVersions = [{ id: 'quote_version_legacy_security', companyId: 'company_northlight', documentId: 'quote_legacy_security', versionNumber: 7, revision: 2, status: 'draft', snapshot: { id: 'quote_legacy_security', title: 'État historique sans snapshot' }, reason: 'legacy', createdBy: 'user_admin', createdAt: '2026-01-01T00:00:00.000Z' }]; sourceDb.budgetVersions = [];
  const raw = ` {\n  "schemaVersion": ${sourceDb.schemaVersion},\n  ${JSON.stringify(sourceDb).slice(1, -1)}\n}\n`, file = path.join(os.tmpdir(), `planify-commercial-review-${process.pid}-${Date.now()}.json`); fs.writeFileSync(file, raw, { mode: 0o600 });
  const run = expression => spawnSync(process.execPath, ['-e', `const api=require(${JSON.stringify(serverPath)});${expression}`], { cwd: path.dirname(serverPath), env: { ...process.env, PLANIFY_DATA_FILE: file }, encoding: 'utf8' });
  let result = run('api.readDb()'); assert.equal(result.status, 0, result.stderr); const migratedRaw = fs.readFileSync(file, 'utf8'), migrated = JSON.parse(migratedRaw), marker = migrated.migrations.find(value => value.id === migrationId); assert.ok(marker); assert.match(marker.sourceDigest, /^[a-f0-9]{64}$/); assert.match(marker.outputDigest, /^[a-f0-9]{64}$/); assert.match(marker.integrityDigest, /^[a-f0-9]{64}$/); assert.deepEqual(marker.inputCounts, { documents: 1, versions: 1 }); assert.equal(marker.outputCounts.documentsBackfilled, 1); assert.equal(marker.outputCounts.versionsRenumbered, 1);
  const backupPath = path.join(path.dirname(file), marker.backupFile); assert.equal(fs.readFileSync(backupPath, 'utf8'), raw); assert.equal(fs.statSync(backupPath).mode & 0o777, 0o600); assert.equal(migrated.quotes[0].commercialSnapshot.historicalAccuracy, 'unknown-current-state-backfill'); assert.equal(migrated.quoteVersions[0].snapshot.commercialSnapshot, undefined); assert.equal(migrated.quoteVersions[0].snapshot.commercialSnapshotBackfill.status, 'unavailable');
  result = run('api.readDb()'); assert.equal(result.status, 0, result.stderr); assert.equal(fs.readFileSync(file, 'utf8'), migratedRaw);
  const tampered = JSON.parse(migratedRaw); tampered.migrations.find(value => value.id === migrationId).integrityDigest = '0'.repeat(64); fs.writeFileSync(file, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 }); result = run('api.readDb()'); assert.notEqual(result.status, 0); assert.match(result.stderr, /MIGRATION_MARKER_CONFLICT|marqueur Commercial Review/);
  fs.writeFileSync(file, migratedRaw, { mode: 0o600 }); result = run('api.rollbackCommercialReviewMigration()'); assert.equal(result.status, 0, result.stderr); assert.equal(fs.readFileSync(file, 'utf8'), raw);
  const interruptedFile = `${file}.interrupted`, digest = crypto.createHash('sha256').update(raw).digest('hex'), interruptedBackup = `${interruptedFile}.${migrationId}.${digest.slice(0, 12)}.backup.json`; fs.writeFileSync(interruptedFile, raw, { mode: 0o600 }); fs.writeFileSync(interruptedBackup, raw, { mode: 0o600 }); result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(serverPath)}).readDb()`], { cwd: path.dirname(serverPath), env: { ...process.env, PLANIFY_DATA_FILE: interruptedFile }, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); assert.equal(fs.readFileSync(interruptedBackup, 'utf8'), raw);
});

test('créer un devis direct calcule HT/TVA/TTC sans créer de réservation', async () => {
  const beforeCount = readDb().reservations.length;
  const result = await request('/api/v1/quotes', {
    method: 'POST', headers: { 'Idempotency-Key': 'quote-direct-project-1' }, body: JSON.stringify({
      projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Budget Nouvelle émission TF1', taxDate: '2026-08-16',
      lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_3', unit: 'jour', quantityMilli: '2000', unitPriceMinor: '10000', priceOverrideReason: 'Tarif commercial négocié', requestedDurationDays: 20 }],
    }),
  }, admin);
  assert.equal(result.response.status, 201); quote = result.data;
  assert.match(quote.number, /^DEV-2026-/); assert.equal(quote.lines[0].planning.status, 'unplanned'); assert.deepEqual(quote.lines[0].planning.bookingIds, []);
  assert.deepEqual({ netHt: quote.netHt, vatAmount: quote.vatAmount, grossTtc: quote.grossTtc }, { netHt: '20000', vatAmount: '4000', grossTtc: '24000' });
  assert.equal(typeof quote.netHt, 'string'); assert.equal(readDb().reservations.length, beforeCount);
});

test('rejouer la création avec la même clé est idempotent', async () => {
  const payload = { projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Budget Nouvelle émission TF1', taxDate: '2026-08-16', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_3', unit: 'jour', quantityMilli: '2000', unitPriceMinor: '10000', priceOverrideReason: 'Tarif commercial négocié', requestedDurationDays: 20 }] };
  const replay = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-direct-project-1' }, body: JSON.stringify(payload) }, admin);
  assert.equal(replay.response.status, 200); assert.equal(replay.data.id, quote.id); assert.equal(readDb().quotes.filter(value => value.id === quote.id).length, 1);
});

test('un taux explicite configuré exige la permission override dédiée', async () => {
  const payload = { projectId: 'project_1', siteId: 'site_paris', kind: 'budget', title: 'Variante à taux réduit', taxDate: '2026-08-16', requestedVatRateId: 'vat_northlight_reduced' };
  const denied = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-reduced-planner' }, body: JSON.stringify(payload) }, planner); assert.equal(denied.response.status, 403);
  const allowed = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-reduced-admin' }, body: JSON.stringify(payload) }, admin); assert.equal(allowed.response.status, 201); assert.equal(allowed.data.fiscalSnapshot.vatRate.rateBps, 1000);
});

test('le catalogue réunit salles, matériel, prestations et forfaits sans réseau', async () => {
  const result = await request('/api/v1/quote-catalog?siteId=site_paris&pageSize=200', {}, planner); assert.equal(result.response.status, 200);
  assert.ok(result.data.items.some(value => value.sourceType === 'resource' && value.category === 'room'));
  assert.ok(result.data.items.some(value => value.sourceType === 'stockItem' && value.category === 'equipment'));
  assert.ok(result.data.items.some(value => value.sourceType === 'manual' && value.category === 'flatFee'));
  for (const label of ['Montage image', 'Étalonnage image', 'Mixage son', 'PAD et contrôle qualité', 'Stockage NEXIS production', 'Stockage Nearline']) assert.ok(result.data.items.some(value => value.label === label), label);
});

test('l’intention planning préremplit la demande sans écrire', async () => {
  const count = readDb().reservations.length; const result = await request(`/api/v1/quotes/${quote.id}/lines/${quote.lines[0].id}/planning-intent`, {}, admin);
  assert.equal(result.response.status, 200); assert.deepEqual({ projectId: result.data.projectId, siteId: result.data.siteId, label: result.data.label, duration: result.data.requestedDurationDays, createsReservation: result.data.createsReservation }, { projectId: 'project_1', siteId: 'site_paris', label: 'Salle de montage AVID 103', duration: 20, createsReservation: false }); assert.equal(readDb().reservations.length, count);
});

test('lier ensuite une réservation ne déplace ni ne recrée le planning', async () => {
  const reservationBefore = structuredClone(readDb().reservations.find(value => value.id === 'reservation_1'));
  const result = await request(`/api/v1/quotes/${quote.id}/lines/${quote.lines[0].id}/bookings`, { method: 'POST', body: JSON.stringify({ version: quote.version, reservationIds: ['reservation_1'] }) }, admin);
  assert.equal(result.response.status, 200); quote = result.data; assert.equal(quote.lines[0].planning.status, 'partiallyPlanned'); assert.deepEqual(quote.lines[0].planning.bookingIds, ['reservation_1']); assert.deepEqual(readDb().reservations.find(value => value.id === 'reservation_1'), reservationBefore);
});

test('l’import planning complète un devis mais refuse le double comptage', async () => {
  const booking = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Mixage Nouvelle émission TF1', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2026-09-21T07:00:00.000Z', endsAt: '2026-09-23T16:00:00.000Z', resources: [{ resourceId: 'resource_4', quantity: 1 }] }) }, admin);
  assert.equal(booking.response.status, 201);
  const imported = await request(`/api/v1/quotes/${quote.id}/import-reservations`, { method: 'POST', body: JSON.stringify({ version: quote.version, reservationIds: [booking.data.id], unitPriceMinor: '5000', priceOverrideReason: 'Tarif import planning' }) }, admin);
  assert.equal(imported.response.status, 200); quote = imported.data; const line = quote.lines.find(value => value.planning.bookingIds.includes(booking.data.id)); assert.ok(line); assert.equal(line.planning.status, 'fullyPlanned'); assert.equal(line.planning.plannedQuantityMilli, '3000'); assert.equal(line.quantityMilli, '3000');
  const duplicate = await request(`/api/v1/quotes/${quote.id}/import-reservations`, { method: 'POST', body: JSON.stringify({ version: quote.version, reservationIds: [booking.data.id] }) }, admin);
  assert.equal(duplicate.response.status, 409); assert.equal(duplicate.data.error.code, 'QUOTE_RESERVATION_ALREADY_IMPORTED');
});

test('une ligne libre reste non planifiée et suit le contrôle de version', async () => {
  const created = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: quote.version, category: 'free', sourceType: 'manual', label: 'Forfait livraison', unit: 'forfait', quantityMilli: '1000', unitPriceMinor: '100', priceOverrideReason: 'Forfait commercial saisi' }) }, admin);
  assert.equal(created.response.status, 201); quote = created.data; let line = quote.lines.find(value => value.label === 'Forfait livraison'); assert.equal(line.planning.status, 'unplanned'); assert.deepEqual(line.planning.bookingIds, []); assert.deepEqual({ netHt: line.netHt, vatAmount: line.vatAmount, grossTtc: line.grossTtc }, { netHt: '100', vatAmount: '20', grossTtc: '120' }); assert.equal(readDb().auditEvents.find(value => value.action === 'quote.lineAdded' && value.details.lineId === line.id).details.priceOverride.reason, 'Forfait commercial saisi');
  const updated = await request(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { method: 'PATCH', body: JSON.stringify({ version: quote.version, unitPriceMinor: '200', priceOverrideReason: 'Révision du forfait commercial' }) }, admin); assert.equal(updated.response.status, 200); quote = updated.data; line = quote.lines.find(value => value.id === line.id); assert.equal(line.netHt, '200'); assert.equal(readDb().auditEvents.find(value => value.action === 'quote.lineUpdated' && value.details.lineId === line.id).details.priceOverride.reason, 'Révision du forfait commercial');
  const removed = await request(`/api/v1/quotes/${quote.id}/lines/${line.id}`, { method: 'DELETE', body: JSON.stringify({ version: quote.version }) }, admin); assert.equal(removed.response.status, 200); quote = removed.data; assert.ok(!quote.lines.some(value => value.id === line.id));
});

test('une version obsolète et un champ fiscal de ligne sont refusés sans écriture', async () => {
  const before = structuredClone(readDb().quotes.find(value => value.id === quote.id));
  const stale = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: 1, category: 'free', sourceType: 'manual', label: 'Frais', quantityMilli: '1000', unitPriceMinor: '100' }) }, admin);
  assert.equal(stale.response.status, 409); assert.equal(stale.data.error.code, 'VERSION_CONFLICT');
  const tax = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: quote.version, category: 'free', sourceType: 'manual', label: 'Frais', quantityMilli: '1000', unitPriceMinor: '100', rateBps: 0 }) }, admin);
  assert.equal(tax.response.status, 400); assert.equal(tax.data.error.details.field, 'rateBps'); assert.deepEqual(readDb().quotes.find(value => value.id === quote.id), before);
});

test('les valeurs hors int64 sont refusées sans arrondi flottant', async () => {
  const result = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: quote.version, category: 'free', sourceType: 'manual', label: 'Overflow', quantityMilli: '1000', unitPriceMinor: '9223372036854775807', priceOverrideReason: 'Test borne monétaire' }) }, admin);
  assert.equal(result.response.status, 422); assert.equal(result.data.error.code, 'AMOUNT_OVERFLOW');
});

test('le snapshot fiscal du devis reste immuable après modification du taux Organisation', async () => {
  const before = structuredClone(quote.fiscalSnapshot), rate = readDb().vatRates.find(value => value.id === 'vat_northlight_standard');
  const changed = await request(`/api/v1/vat-rates/${rate.id}`, { method: 'PATCH', body: JSON.stringify({ version: rate.version, rateBps: 1000 }) }, admin);
  assert.equal(changed.response.status, 200); assert.equal(changed.data.rateBps, 1000);
  const current = await request(`/api/v1/quotes/${quote.id}`, {}, admin); assert.equal(current.response.status, 200); assert.deepEqual(current.data.fiscalSnapshot, before); assert.equal(current.data.fiscalSnapshot.vatRate.rateBps, 2000);
});

test('archiver est logique et rend le document non modifiable', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-to-archive' }, body: JSON.stringify({ projectId: 'project_1', kind: 'budget', title: 'Budget à archiver', taxDate: '2026-08-16' }) }, admin); assert.equal(created.response.status, 201);
  const archived = await request(`/api/v1/quotes/${created.data.id}/archive`, { method: 'POST', body: JSON.stringify({ version: created.data.version }) }, admin); assert.equal(archived.response.status, 200); assert.equal(archived.data.status, 'archived'); assert.ok(archived.data.archivedAt);
  const edit = await request(`/api/v1/quotes/${created.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: archived.data.version, title: 'Impossible' }) }, admin); assert.equal(edit.response.status, 409); assert.equal(edit.data.error.code, 'QUOTE_NOT_EDITABLE');
});

test('un lecteur peut consulter mais ne peut pas modifier un devis', async () => {
  const read = await request(`/api/v1/quotes/${quote.id}`, {}, viewer); assert.equal(read.response.status, 200);
  const write = await request(`/api/v1/quotes/${quote.id}`, { method: 'PATCH', body: JSON.stringify({ version: quote.version, title: 'Interdit' }) }, viewer); assert.equal(write.response.status, 403); assert.equal(write.data.error.code, 'FORBIDDEN');
});

test('le périmètre site masque les devis hors site et exige un site pour un acteur limité', async () => {
  const offScope = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-boulogne-scope' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_boulogne', kind: 'quote', title: 'Devis Boulogne', taxDate: '2026-08-16' }) }, admin);
  assert.equal(offScope.response.status, 201);
  const hidden = await request(`/api/v1/quotes/${offScope.data.id}`, {}, viewer); assert.equal(hidden.response.status, 404);
  const siteRequired = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-planner-without-site' }, body: JSON.stringify({ projectId: 'project_1', kind: 'quote', title: 'Sans site', taxDate: '2026-08-16' }) }, planner);
  assert.equal(siteRequired.response.status, 422); assert.equal(siteRequired.data.error.code, 'SITE_REQUIRED');
});

test('Commercial v2 sépare les budgets, conserve des versions et fournit des rate cards locales', async () => {
  const db = readDb(), marker = db.migrations.filter(value => value.id === 'commercial-08-project-rates-v2');
  assert.equal(marker.length, 1); for (const key of ['budgets', 'budgetVersions', 'quoteVersions', 'rateCards', 'rates']) assert.ok(Array.isArray(db[key]));
  assert.ok(db.budgets.some(value => value.kind === 'budget')); assert.ok(db.quotes.every(value => value.kind === 'quote'));
  const cards = await request('/api/v1/rate-cards?pageSize=20', {}, admin); assert.equal(cards.response.status, 200); assert.ok(cards.data.items[0].rates.length > 50);
  const catalog = await request('/api/v1/quote-catalog?siteId=site_paris&pageSize=200', {}, admin); assert.ok(catalog.data.items.some(value => value.sourceType === 'resource' && value.rate?.saleUnitMinor));
  const versions = await request(`/api/v1/quotes/${quote.id}/versions?pageSize=200`, {}, admin); assert.equal(versions.response.status, 200); assert.ok(versions.data.items.length >= 4); assert.ok(versions.data.items.every(value => value.snapshot === undefined));
});

test('coût, vente, marge et seuil non bloquant sont calculés en entiers', async () => {
  const result = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: quote.version, category: 'free', section: 'Technique', sourceType: 'manual', label: 'Contrôle marge', unit: 'jour', quantityMilli: '2000', costUnitMinor: '4000', unitPriceMinor: '10000', priceOverrideReason: 'Tarif commercial de contrôle' }) }, admin);
  assert.equal(result.response.status, 201); quote = result.data; const line = quote.lines.find(value => value.label === 'Contrôle marge');
  assert.deepEqual({ cost: line.costTotal, sale: line.netHt, margin: line.marginAmount, marginBps: line.marginBps }, { cost: '8000', sale: '20000', margin: '12000', marginBps: 6000 });
  assert.equal(typeof quote.costTotal, 'string'); assert.ok(['healthy', 'belowTarget'].includes(quote.marginAlert));
});

test('une remise fixe HT reproduit exactement les gestes commerciaux du devis source', async () => {
  const result = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: quote.version, category: 'technical', section: 'Postes Light - Imports', sourceType: 'manual', label: 'Import Avid Media Composer', unit: 'jour/poste', quantityMilli: '30000', unitPriceMinor: '5000', priceOverrideReason: 'Tarif de vente import Avid', fixedDiscountAmountMinor: '45000', discountReason: 'Remise exceptionnelle Studio89' }) }, admin);
  assert.equal(result.response.status, 201); quote = result.data; const line = quote.lines.find(value => value.label === 'Import Avid Media Composer');
  assert.deepEqual({ base: line.baseNetHt, discount: line.discountAmount, net: line.netHt, fixed: line.fixedDiscountAmountMinor }, { base: '150000', discount: '45000', net: '105000', fixed: '45000' });
  const incompatible = await request(`/api/v1/quotes/${quote.id}/lines`, { method: 'POST', body: JSON.stringify({ version: quote.version, category: 'free', sourceType: 'manual', label: 'Double remise interdite', quantityMilli: '1000', unitPriceMinor: '10000', priceOverrideReason: 'Test incompatibilité remises', discountBps: 1000, fixedDiscountAmountMinor: '1000' }) }, admin);
  assert.equal(incompatible.response.status, 422); assert.equal(incompatible.data.error.code, 'VALIDATION_ERROR');
});

test('un projet enrichi expose ses champs métier et son dashboard sans imposer de planning', async () => {
  const created = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Comedy Class Saison 3', code: 'CCS3', clientId: 'client_1', siteId: 'site_paris', lifecycleStatus: 'prospect', salesOwnerId: 'user_admin', projectManagerId: 'user_admin', planningOwnerId: 'user_admin', projectNumber: 'PRJ-2027-0042', projectType: 'emission', productionCompany: 'Production Exemple', contactClient: 'Camille Martin', salesOwner: 'Alice Dupont', projectManager: 'Marc Leroy', internalOwner: 'Sophie Bernard', startDate: '2027-01-10', endDate: '2027-03-20', description: 'Nouvelle saison', notes: 'Dates prévisionnelles', costCenter: 'CC-POST-42', color: '#4f46e5' }) }, admin);
  assert.equal(created.response.status, 201); assert.equal(created.data.projectNumber, 'PRJ-2027-0042'); assert.equal(created.data.status, 'prospect');
  const dashboard = await request(`/api/v1/projects/${created.data.id}/dashboard`, {}, admin); assert.equal(dashboard.response.status, 200); assert.deepEqual({ reservations: dashboard.data.reservationCount, resources: dashboard.data.resourceCount, unplanned: dashboard.data.unplannedLines }, { reservations: 0, resources: 0, unplanned: 0 });
});

test('un projet refuse les références client et site d’une autre société', async () => {
  const current = readDb().projects.find(value => value.id === 'project_1');
  const foreignClient = await request(`/api/v1/projects/${current.id}`, { method: 'PATCH', body: JSON.stringify({ version: current.version, clientId: 'client_foreign' }) }, admin);
  assert.equal(foreignClient.response.status, 422); assert.equal(foreignClient.data.error.code, 'VALIDATION_ERROR');
  const foreignSite = await request(`/api/v1/projects/${current.id}`, { method: 'PATCH', body: JSON.stringify({ version: current.version, siteId: 'site_eliote_props_paris' }) }, admin);
  assert.equal(foreignSite.response.status, 422); assert.equal(foreignSite.data.error.code, 'VALIDATION_ERROR');
  const preserved = readDb().projects.find(value => value.id === current.id); assert.equal(preserved.clientId, current.clientId); assert.equal(preserved.siteId, current.siteId);
});

test('le PDF client est local, valide et exclut coûts et marges internes', async () => {
  const response = await fetch(`${baseUrl}/api/v1/quotes/${quote.id}/pdf`, { headers: { cookie: admin.cookie } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf'); const pdf = Buffer.from(await response.arrayBuffer());
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4'); const text = pdf.toString('latin1'); assert.match(text, /ELIOTE/); assert.match(text, /REMISE/); assert.match(text, /TOTAL HT/); assert.doesNotMatch(text, /Marge\s*:|Cout interne|costTotal|marginAmount/i);
});

test('la prévisualisation Planning supporte les trois modes sans écrire et respecte RBAC/site', async () => {
  const before = readDb().quotes.length;
  for (const mode of ['detailed', 'grouped', 'commercial']) {
    const result = await request('/api/v1/quotes/preview-reservations', { method: 'POST', body: JSON.stringify({ projectId: 'project_1', reservationIds: ['reservation_1'], mode }) }, admin);
    assert.equal(result.response.status, 200); assert.equal(result.data.mode, mode); assert.equal(result.data.totals.bookings, 1); assert.ok(result.data.lines.length >= 1);
  }
  assert.equal(readDb().quotes.length, before);
  const denied = await request('/api/v1/quotes/preview-reservations', { method: 'POST', body: JSON.stringify({ projectId: 'project_1', reservationIds: ['reservation_1'], mode: 'detailed' }) }, viewer);
  assert.equal(denied.response.status, 403); assert.equal(denied.data.error.code, 'FORBIDDEN');
  const offSite = readDb().reservations.find(value => value.siteId === 'site_boulogne');
  if (offSite) { const hidden = await request('/api/v1/quotes/preview-reservations', { method: 'POST', body: JSON.stringify({ projectId: offSite.projectId, reservationIds: [offSite.id], mode: 'detailed' }) }, viewer); assert.equal(hidden.response.status, 404); }
});

test('le double rattachement commercial exige une confirmation explicite et reste traçable', async () => {
  const booking = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Sélection commerciale explicite', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2026-10-05T07:00:00.000Z', endsAt: '2026-10-07T16:00:00.000Z', resources: [{ resourceId: 'resource_3', quantity: 1 }] }) }, admin);
  assert.equal(booking.response.status, 201);
  const create = async key => request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: key, taxDate: '2026-08-16' }) }, admin);
  let first = (await create('double-billing-first')).data, second = (await create('double-billing-second')).data;
  const firstImport = await request(`/api/v1/quotes/${first.id}/import-reservations`, { method: 'POST', body: JSON.stringify({ version: first.version, reservationIds: [booking.data.id], mode: 'detailed' }) }, admin); assert.equal(firstImport.response.status, 200); first = firstImport.data;
  const preview = await request('/api/v1/quotes/preview-reservations', { method: 'POST', body: JSON.stringify({ projectId: 'project_1', documentId: second.id, reservationIds: [booking.data.id], mode: 'commercial' }) }, admin); assert.equal(preview.response.status, 200); assert.equal(preview.data.duplicateLinks[0].documentId, first.id);
  const blocked = await request(`/api/v1/quotes/${second.id}/import-reservations`, { method: 'POST', body: JSON.stringify({ version: second.version, reservationIds: [booking.data.id], mode: 'commercial' }) }, admin); assert.equal(blocked.response.status, 409); assert.equal(blocked.data.error.code, 'COMMERCIAL_DOUBLE_BILLING_CONFIRMATION_REQUIRED');
  const confirmed = await request(`/api/v1/quotes/${second.id}/import-reservations`, { method: 'POST', body: JSON.stringify({ version: second.version, reservationIds: [booking.data.id], mode: 'commercial', confirmDuplicateBookingIds: [booking.data.id] }) }, admin); assert.equal(confirmed.response.status, 200); second = confirmed.data; assert.equal(second.lines[0].importTrace.duplicateConfirmed, true);
  const links = await request(`/api/v1/reservations/${booking.data.id}/commercial-links`, {}, admin); assert.equal(links.response.status, 200); assert.equal(links.data.links.length, 2);
});

test('envoyé et accepté sont figés; nouvelle version et avenant créent des brouillons distincts', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'protected-commercial-document' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Devis à protéger', taxDate: '2026-08-16', lines: [{ category: 'free', sourceType: 'manual', label: 'Forfait protégé', quantityMilli: '1000', unitPriceMinor: '10000', priceOverrideReason: 'Forfait commercial protégé' }] }) }, admin); let protectedQuote = created.data;
  const invalid = await request(`/api/v1/quotes/${protectedQuote.id}/status`, { method: 'POST', body: JSON.stringify({ version: protectedQuote.version, status: 'accepted' }) }, admin); assert.equal(invalid.response.status, 409); assert.equal(invalid.data.error.code, 'QUOTE_STATUS_TRANSITION_INVALID');
  const sent = await request(`/api/v1/quotes/${protectedQuote.id}/status`, { method: 'POST', body: JSON.stringify({ version: protectedQuote.version, status: 'sent' }) }, admin); assert.equal(sent.response.status, 200); protectedQuote = sent.data;
  const mutation = await request(`/api/v1/quotes/${protectedQuote.id}/lines/${protectedQuote.lines[0].id}`, { method: 'PATCH', body: JSON.stringify({ version: protectedQuote.version, quantityMilli: '2000' }) }, admin); assert.equal(mutation.response.status, 409); assert.equal(mutation.data.error.code, 'QUOTE_NOT_EDITABLE');
  const accepted = await request(`/api/v1/quotes/${protectedQuote.id}/status`, { method: 'POST', body: JSON.stringify({ version: protectedQuote.version, status: 'accepted' }) }, admin); assert.equal(accepted.response.status, 200); protectedQuote = accepted.data;
  const amendment = await request(`/api/v1/quotes/${protectedQuote.id}/amendments`, { method: 'POST', body: JSON.stringify({ version: protectedQuote.version }) }, admin); assert.equal(amendment.response.status, 201); assert.equal(amendment.data.status, 'draft'); assert.equal(amendment.data.parentDocumentId, protectedQuote.id); assert.deepEqual(amendment.data.fiscalSnapshot, protectedQuote.fiscalSnapshot); assert.equal(amendment.data.lines[0].label, 'Forfait protégé'); assert.equal(amendment.data.sentAt, undefined); assert.equal(amendment.data.acceptedAt, undefined);
  const replaced = await request(`/api/v1/quotes/${protectedQuote.id}`, {}, admin); assert.equal(replaced.data.status, 'replaced');
  const successor = await request(`/api/v1/quotes/${amendment.data.id}/new-version`, { method: 'POST', body: JSON.stringify({ version: amendment.data.version }) }, admin); assert.equal(successor.response.status, 201); assert.equal(successor.data.documentMode, 'version'); assert.notEqual(successor.data.id, amendment.data.id);
  const budget = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'internal-budget-cycle' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'budget', title: 'Budget interne', taxDate: '2026-08-16' }) }, admin);
  const budgetSent = await request(`/api/v1/quotes/${budget.data.id}/status`, { method: 'POST', body: JSON.stringify({ version: budget.data.version, status: 'sent' }) }, admin); assert.equal(budgetSent.response.status, 409);
  const budgetAmendment = await request(`/api/v1/quotes/${budget.data.id}/amendments`, { method: 'POST', body: JSON.stringify({ version: budget.data.version }) }, admin); assert.equal(budgetAmendment.response.status, 409); assert.equal(budgetAmendment.data.error.code, 'COMMERCIAL_SUCCESSOR_INVALID');
});

test('les écarts Devis/Planning exposent seulement les actions compatibles avec le statut', async () => {
  const booking = readDb().reservations.find(value => value.title === 'Sélection commerciale explicite'), document = readDb().quotes.find(value => value.title === 'double-billing-first');
  const line = document.lines.find(value => value.planning.bookingIds.includes(booking.id));
  const changed = await request(`/api/v1/quotes/${document.id}/lines/${line.id}`, { method: 'PATCH', body: JSON.stringify({ version: document.version, quantityMilli: '1000' }) }, admin); assert.equal(changed.response.status, 200);
  const draftDiff = await request(`/api/v1/quotes/${document.id}/deviations`, {}, admin); assert.equal(draftDiff.response.status, 200); const item = draftDiff.data.items.find(value => value.lineId === line.id); assert.equal(item.state, 'overPlanned'); assert.deepEqual(item.actions, ['updateDocument', 'ignore']);
  const sent = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: changed.data.version, status: 'sent' }) }, admin); assert.equal(sent.response.status, 200);
  const protectedDiff = await request(`/api/v1/quotes/${document.id}/deviations`, {}, admin); assert.deepEqual(protectedDiff.data.items.find(value => value.lineId === line.id).actions, ['newVersion', 'amendment', 'ignore']);
  const stale = await request(`/api/v1/quotes/${document.id}/new-version`, { method: 'POST', body: JSON.stringify({ version: changed.data.version }) }, admin); assert.equal(stale.response.status, 409); assert.equal(stale.data.error.code, 'VERSION_CONFLICT');
});

test('la liaison directe applique la même protection inter-document puis se délie sans supprimer le Planning', async () => {
  const booking = readDb().reservations.find(value => value.title === 'Sélection commerciale explicite'), source = readDb().quotes.find(value => value.title === 'double-billing-second');
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'direct-link-protected' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Liaison directe protégée', taxDate: '2026-08-16', lines: [{ category: 'free', sourceType: 'manual', label: 'Ligne à lier', quantityMilli: '1000', unitPriceMinor: '1000', priceOverrideReason: 'Forfait de liaison commerciale' }] }) }, admin); let document = created.data, line = document.lines[0];
  const blocked = await request(`/api/v1/quotes/${document.id}/lines/${line.id}/bookings`, { method: 'POST', body: JSON.stringify({ version: document.version, reservationIds: [booking.id] }) }, admin); assert.equal(blocked.response.status, 409); assert.equal(blocked.data.error.code, 'COMMERCIAL_DOUBLE_BILLING_CONFIRMATION_REQUIRED');
  const linked = await request(`/api/v1/quotes/${document.id}/lines/${line.id}/bookings`, { method: 'POST', body: JSON.stringify({ version: document.version, reservationIds: [booking.id], confirmDuplicateBookingIds: [booking.id] }) }, admin); assert.equal(linked.response.status, 200); document = linked.data; line = document.lines[0]; assert.deepEqual(line.linkTrace.duplicateConfirmed, [booking.id]);
  const linkAudit = readDb().auditEvents.find(value => value.action === 'quote.lineBookingsLinked' && value.entityId === document.id); assert.deepEqual(linkAudit.details.duplicateConfirmed, [booking.id]);
  const reservationBefore = structuredClone(readDb().reservations.find(value => value.id === booking.id)); const unlinked = await request(`/api/v1/quotes/${document.id}/lines/${line.id}/bookings/${booking.id}`, { method: 'DELETE', body: JSON.stringify({ version: document.version }) }, admin); assert.equal(unlinked.response.status, 200); assert.equal(unlinked.data.lines[0].planning.status, 'unplanned'); assert.deepEqual(readDb().reservations.find(value => value.id === booking.id), reservationBefore); assert.ok(source);
});

test('les tarifs suivent projet puis client puis catalogue et toute saisie manuelle est tracée', async () => {
  const db = readDb(), catalogCard = db.rateCards.find(value => value.companyId === 'company_northlight' && !value.clientId && !value.projectId && value.active), clientCard = db.rateCards.find(value => value.id === 'rateCard_test_client_1'), projectCard = db.rateCards.find(value => value.id === 'rateCard_test_project_1');
  const createRate = body => request('/api/v1/rates', { method: 'POST', body: JSON.stringify({ rateCardId: body.projectId ? projectCard.id : body.clientId ? clientCard.id : catalogCard.id, sourceType: 'resource', sourceId: 'resource_3', unit: 'jour', costUnitMinor: '5000', ...body }) }, admin);
  assert.equal((await createRate({ clientId: 'client_1', saleUnitMinor: '11100' })).response.status, 201); assert.equal((await createRate({ projectId: 'project_1', saleUnitMinor: '22200' })).response.status, 201);
  const projectQuote = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'project-rate-priority' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Tarif projet', taxDate: '2026-08-16', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_3', quantityMilli: '1000' }] }) }, admin); assert.equal(projectQuote.data.lines[0].unitPriceMinor, '22200'); assert.equal(projectQuote.data.lines[0].priceOrigin, 'project');
  const clientProject = readDb().projects.find(value => value.name === 'Comedy Class Saison 3'); const clientQuote = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'client-rate-priority' }, body: JSON.stringify({ projectId: clientProject.id, siteId: 'site_paris', kind: 'quote', title: 'Tarif client', taxDate: '2026-08-16', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_3', quantityMilli: '1000' }] }) }, admin); assert.equal(clientQuote.data.lines[0].unitPriceMinor, '11100'); assert.equal(clientQuote.data.lines[0].priceOrigin, 'client');
  const manual = await request(`/api/v1/quotes/${clientQuote.data.id}/lines`, { method: 'POST', body: JSON.stringify({ version: clientQuote.data.version, category: 'room', sourceType: 'resource', sourceId: 'resource_3', quantityMilli: '1000', unitPriceMinor: '12345', priceOverrideReason: 'Accord commercial spécifique' }) }, admin); const manualLine = manual.data.lines.at(-1); assert.equal(manualLine.priceOrigin, 'manual'); assert.equal(manualLine.manualPriceTrace.setBy, admin.user.id); assert.equal(manualLine.manualPriceTrace.reason, 'Accord commercial spécifique');
  const inactive = await request('/api/v1/rates', { method: 'POST', body: JSON.stringify({ rateCardId: projectCard.id, sourceType: 'resource', sourceId: 'resource_4', projectId: 'project_1', unit: 'jour', costUnitMinor: '1', saleUnitMinor: '999999', active: false }) }, admin); assert.equal(inactive.response.status, 201);
  const inactiveIgnored = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'inactive-rate-ignored' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Tarif inactif ignoré', taxDate: '2026-08-16', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_4', quantityMilli: '1000' }] }) }, admin); assert.equal(inactiveIgnored.response.status, 201); assert.notEqual(inactiveIgnored.data.lines[0].unitPriceMinor, '999999'); assert.notEqual(inactiveIgnored.data.lines[0].appliedRateId, inactive.data.id);
  const foreign = await createRate({ clientId: 'client_inconnu', saleUnitMinor: '99900' }); assert.equal(foreign.response.status, 422);
});

test('conversion Budget vers Devis, remises et versions immuables restent exactes', async () => {
  const lines = Array.from({ length: 40 }, (_, index) => ({ category: 'free', sourceType: 'manual', label: `Prestation PDF ${String(index + 1).padStart(2, '0')}`, quantityMilli: '1000', unitPriceMinor: '101', priceOverrideReason: 'Tarif de contrôle PDF', discountBps: 1000, discountReason: 'Remise série' }));
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'budget-conversion-remises' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'budget', title: 'Budget snapshot multipage', taxDate: '2026-08-16', documentDiscountBps: 1000, paymentTerms: 'Paiement test à 45 jours.', validUntil: '2026-12-31', lines }) }, admin); assert.equal(created.response.status, 201); const budget = created.data; assert.deepEqual({ subtotal: budget.subtotalHt, lineDiscount: budget.lineDiscountTotal, documentDiscount: budget.documentDiscountAmount, net: budget.netHt }, { subtotal: '3640', lineDiscount: '400', documentDiscount: '364', net: '3276' });
  const premature = await request(`/api/v1/quotes/${budget.id}/convert-to-quote`, { method: 'POST', headers: { 'Idempotency-Key': 'convert-budget-too-soon' }, body: JSON.stringify({ version: budget.version }) }, admin); assert.equal(premature.response.status, 409); assert.equal(premature.data.error.code, 'BUDGET_CLIENT_CONFIRMATION_REQUIRED');
  const confirmed = await request(`/api/v1/quotes/${budget.id}/status`, { method: 'POST', body: JSON.stringify({ version: budget.version, status: 'clientConfirmed' }) }, admin); assert.equal(confirmed.response.status, 200); assert.equal(confirmed.data.status, 'clientConfirmed'); assert.ok(confirmed.data.clientConfirmedAt); assert.equal(readDb().budgets.find(value => value.id === budget.id).revenueRecognition, undefined);
  const converted = await request(`/api/v1/quotes/${budget.id}/convert-to-quote`, { method: 'POST', headers: { 'Idempotency-Key': 'convert-budget-once' }, body: JSON.stringify({ version: confirmed.data.version }) }, admin); assert.equal(converted.response.status, 201); let document = converted.data; assert.equal(document.sourceBudgetId, budget.id); assert.equal(document.creationMethod, 'budgetConversion'); assert.equal(document.lines.length, 40); assert.equal(readDb().budgets.find(value => value.id === budget.id).status, 'converted');
  const replay = await request(`/api/v1/quotes/${budget.id}/convert-to-quote`, { method: 'POST', headers: { 'Idempotency-Key': 'convert-budget-once' }, body: JSON.stringify({ version: confirmed.data.version }) }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.id, document.id);
  const patched = await request(`/api/v1/quotes/${document.id}`, { method: 'PATCH', body: JSON.stringify({ version: document.version, title: 'Devis snapshot V2', documentDiscountBps: 500 }) }, admin); document = patched.data;
  const versions = await request(`/api/v1/quotes/${document.id}/versions?pageSize=200`, {}, admin); assert.deepEqual(versions.data.items.map(value => value.versionNumber), [1, 2]); const v1 = await request(`/api/v1/quotes/${document.id}/versions/${versions.data.items[0].id}`, {}, admin); assert.equal(v1.data.snapshot.title, 'Devis · Budget snapshot multipage'); assert.equal(v1.data.snapshot.lines.length, 40);
  const project = readDb().projects.find(value => value.id === 'project_1'); await request(`/api/v1/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ version: project.version, name: 'PROJET LIVE MODIFIÉ' }) }, admin);
  const response = await fetch(`${baseUrl}/api/v1/quotes/${document.id}/pdf`, { headers: { cookie: admin.cookie } }), pdf = Buffer.from(await response.arrayBuffer()), text = pdf.toString('latin1'), snapProjectToken = budget.commercialSnapshot.project.name.split(/\s+/)[0], snapClientToken = budget.commercialSnapshot.client.name.split(/\s+/)[0]; assert.equal(response.status, 200); assert.match(text, /Prestation PDF 40/); assert.ok(text.includes(snapProjectToken)); assert.ok(text.includes(snapClientToken)); assert.doesNotMatch(text, /PROJET LIVE MODIFIE/); assert.match(text, /REMISE DOCUMENT/); assert.match(text, /Paiement test a 45 jours/); assert.match(text, /signature client/i); assert.match(text, /\/Count [2-9]/);
});

test('accepter un devis lié exige une confirmation explicite des bookings', async () => {
  const booking = readDb().reservations.find(value => value.title === 'Sélection commerciale explicite'); const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'accept-linked-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Acceptation liée', taxDate: '2026-08-16' }) }, admin); let document = created.data;
  const imported = await request(`/api/v1/quotes/${document.id}/import-reservations`, { method: 'POST', body: JSON.stringify({ version: document.version, reservationIds: [booking.id], confirmDuplicateBookingIds: [booking.id] }) }, admin); document = imported.data;
  const sent = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status: 'sent' }) }, admin); document = sent.data;
  const blocked = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status: 'accepted' }) }, admin); assert.equal(blocked.response.status, 409); assert.equal(blocked.data.error.code, 'BOOKING_ACCEPTANCE_CONFIRMATION_REQUIRED');
  const accepted = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status: 'accepted', confirmBookingIds: [booking.id] }) }, admin); assert.equal(accepted.response.status, 200); assert.deepEqual(accepted.data.acceptedBookingIds, [booking.id]);
});

test('un devis accepté prépare puis crée atomiquement son planning sans altérer ses montants', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-to-planning-create' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Conversion planning contrôlée', taxDate: '2026-08-16', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_3', label: 'Montage Avid', unit: 'jour/salle', quantityMilli: '2000', unitPriceMinor: '45000', priceOverrideReason: 'Prix validé avant planification', requestedDurationDays: 2 }] }) }, admin); assert.equal(created.response.status, 201); let document = created.data;
  for (const status of ['validated', 'sent', 'accepted']) { const changed = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status }) }, admin); assert.equal(changed.response.status, 200); document = changed.data; }
  const amountsBefore = { netHt: document.netHt, vatAmount: document.vatAmount, grossTtc: document.grossTtc, fiscalSnapshot: structuredClone(document.fiscalSnapshot) }, items = [{ quoteLineId: document.lines[0].id, startDate: '2027-06-14', resourceIds: ['resource_3'], status: 'option', startTime: '09:00', endTime: '18:00' }], payload = { version: document.version, quoteVersionId: document.currentVersionId, items };
  const preview = await request(`/api/v1/quotes/${document.id}/planning-conversion/preview`, { method: 'POST', body: JSON.stringify(payload) }, admin); assert.equal(preview.response.status, 200); assert.equal(preview.data.canConvert, true); assert.equal(preview.data.candidates[0].durationDays, 2); assert.equal(readDb().reservations.some(value => value.sourceQuoteId === document.id), false);
  const converted = await request(`/api/v1/quotes/${document.id}/planning-conversion`, { method: 'POST', headers: { 'Idempotency-Key': 'quote-to-planning-once' }, body: JSON.stringify(payload) }, admin); assert.equal(converted.response.status, 201); assert.equal(converted.data.reservations.length, 1); assert.equal(converted.data.reservations[0].sourceQuoteLineId, document.lines[0].id); assert.equal(converted.data.reservations[0].projectId, document.projectId); assert.deepEqual({ netHt: converted.data.quote.netHt, vatAmount: converted.data.quote.vatAmount, grossTtc: converted.data.quote.grossTtc, fiscalSnapshot: converted.data.quote.fiscalSnapshot }, amountsBefore); assert.equal(converted.data.project.status, 'confirmed');
  const replay = await request(`/api/v1/quotes/${document.id}/planning-conversion`, { method: 'POST', headers: { 'Idempotency-Key': 'quote-to-planning-once' }, body: JSON.stringify(payload) }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.replay, true); assert.equal(readDb().reservations.filter(value => value.sourceQuoteId === document.id).length, 1);
});

test('un planning client Excel est analysé, comparé puis converti sous contrôle humain', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'client-planning-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Planning client contrôlé', taxDate: '2026-08-16', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_3', label: 'Montage Avid', unit: 'jour/salle', quantityMilli: '2000', unitPriceMinor: '45000', priceOverrideReason: 'Prix validé avec le client', requestedDurationDays: 2 }] }) }, admin); let document = created.data;
  for (const status of ['validated', 'sent', 'accepted']) document = (await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status }) }, admin)).data;
  const amountsBefore = { netHt: document.netHt, vatAmount: document.vatAmount, grossTtc: document.grossTtc, fiscalSnapshot: structuredClone(document.fiscalSnapshot) }, beforeReservations = readDb().reservations.length, workbook = clientPlanningXlsx(), analysis = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'planning-client-studio89.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentBase64: workbook.toString('base64') }) }, admin);
  assert.equal(analysis.response.status, 201); assert.equal(analysis.data.rows.length, 2); assert.equal(analysis.data.summary.matched, 2); assert.equal(readDb().reservations.length, beforeReservations); const stored = readDb().clientPlanningImports.find(value => value.id === analysis.data.id); assert.equal(stored.quoteId, document.id); assert.equal(stored.sha256, crypto.createHash('sha256').update(workbook).digest('hex')); assert.equal(fs.statSync(`${process.env.PLANIFY_DATA_FILE}.uploads/${stored.storageName}`).mode & 0o777, 0o600);
  const denied = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'planning.xlsx', mimeType: analysis.data.mimeType, contentBase64: workbook.toString('base64') }) }, viewer); assert.equal(denied.response.status, 403);
  const items = analysis.data.rows.map(row => ({ quoteLineId: document.lines[0].id, startDate: row.startDate, durationDays: 1, resourceIds: ['resource_3'], status: 'option', startTime: row.startTime, endTime: row.endTime, clientPlanningRowId: String(row.rowNumber) })), payload = { version: document.version, quoteVersionId: document.currentVersionId, clientPlanningImportId: analysis.data.id, items }, preview = await request(`/api/v1/quotes/${document.id}/planning-conversion/preview`, { method: 'POST', body: JSON.stringify(payload) }, admin); assert.equal(preview.response.status, 200); assert.equal(preview.data.canConvert, true); assert.equal(preview.data.clientPlanningImportId, analysis.data.id);
  const converted = await request(`/api/v1/quotes/${document.id}/planning-conversion`, { method: 'POST', headers: { 'Idempotency-Key': 'client-planning-convert-once' }, body: JSON.stringify(payload) }, admin); assert.equal(converted.response.status, 201); assert.equal(converted.data.reservations.length, 2); assert.ok(converted.data.reservations.every(value => value.sourceClientPlanningImportId === analysis.data.id)); assert.deepEqual({ netHt: converted.data.quote.netHt, vatAmount: converted.data.quote.vatAmount, grossTtc: converted.data.quote.grossTtc, fiscalSnapshot: converted.data.quote.fiscalSnapshot }, amountsBefore); assert.ok(readDb().auditEvents.some(value => value.action === 'quote.clientPlanningAnalyzed' && value.entityId === analysis.data.id));
});

test('un planning client PDF texte est analysé sans réservation automatique', async () => {
  const document = readDb().quotes.find(value => value.title === 'Planning client contrôlé'), before = readDb().reservations.length, content = 'BT (16/06/2028 Montage Avid Salle Montage A) Tj ET', pdf = Buffer.from(`%PDF-1.4\n1 0 obj<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF`), result = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'planning-client.pdf', mimeType: 'application/pdf', contentBase64: pdf.toString('base64') }) }, admin); assert.equal(result.response.status, 201, JSON.stringify(result.data)); assert.equal(result.data.rows.length, 1); assert.equal(result.data.rows[0].startDate, '2028-06-16'); assert.equal(readDb().reservations.length, before);
});

test('un budget analyse un planning client sans accès à la conversion Planning', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'budget-client-planning-analysis' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'budget', title: 'Budget avec planning client', taxDate: '2026-08-18' }) }, admin), document = created.data, workbook = clientPlanningXlsx(), before = readDb().reservations.length;
  const analysis = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'planning-client-preparatoire.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentBase64: workbook.toString('base64') }) }, admin);
  assert.equal(analysis.response.status, 201, JSON.stringify(analysis.data)); assert.equal(analysis.data.preliminary, true); assert.equal(analysis.data.summary.unmatched, 2); assert.equal(readDb().reservations.length, before);
  const preview = await request(`/api/v1/quotes/${document.id}/planning-conversion/preview`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, clientPlanningImportId: analysis.data.id, items: [{ quoteLineId: 'none', startDate: '2028-06-15', resourceIds: ['resource_3'], status: 'option' }] }) }, admin);
  assert.equal(preview.response.status, 409); assert.equal(preview.data.error.code, 'QUOTE_NOT_ACCEPTED'); assert.equal(readDb().reservations.length, before);
  const confirmed = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status: 'clientConfirmed' }) }, admin); assert.equal(confirmed.response.status, 200);
  const converted = await request(`/api/v1/quotes/${document.id}/convert-to-quote`, { method: 'POST', headers: { 'Idempotency-Key': 'budget-planning-analysis-to-quote' }, body: JSON.stringify({ version: confirmed.data.version, title: 'Devis avec analyse planning' }) }, admin); assert.equal(converted.response.status, 201); const carried = readDb().clientPlanningImports.find(value => value.quoteId === converted.data.id && value.sourceBudgetImportId === analysis.data.id); assert.ok(carried); assert.equal(carried.quoteVersionId, converted.data.currentVersionId); assert.equal(carried.preliminary, false); assert.equal(carried.sha256, analysis.data.sha256);
});

test('un planning client crée un devis brouillon traçable sans réservation', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'direct-client-planning-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', creationMethod: 'clientPlanningImport', title: 'Devis direct via PlanyBot', taxDate: '2026-08-18' }) }, admin); let document = created.data;
  assert.equal(created.response.status, 201); assert.equal(document.creationMethod, 'clientPlanningImport'); assert.equal(document.lines.length, 0);
  const beforeReservations = readDb().reservations.length, workbook = clientPlanningXlsx(), analysis = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'planning-client-direct.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentBase64: workbook.toString('base64') }) }, admin);
  assert.equal(analysis.response.status, 201, JSON.stringify(analysis.data)); assert.equal(analysis.data.preliminary, true); assert.equal(readDb().reservations.length, beforeReservations);
  const applied = await request(`/api/v1/quotes/${document.id}/client-planning/apply-lines`, { method: 'POST', headers: { 'Idempotency-Key': 'apply-client-planning-lines' }, body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, clientPlanningImportId: analysis.data.id, items: [{ rowNumber: analysis.data.rows[0].rowNumber, sourceType: 'resource', sourceId: 'resource_3', category: 'room', unit: 'jour' }] }) }, admin); assert.equal(applied.response.status, 201, JSON.stringify(applied.data)); document = applied.data;
  assert.equal(document.lines.length, 1); assert.equal(document.lines[0].planning.status, 'unplanned'); assert.equal(document.lines[0].clientPlanningTrace.importId, analysis.data.id); assert.notEqual(document.lines[0].priceOrigin, 'manual'); assert.equal(readDb().reservations.length, beforeReservations);
  const replay = await request(`/api/v1/quotes/${document.id}/client-planning/apply-lines`, { method: 'POST', headers: { 'Idempotency-Key': 'apply-client-planning-lines' }, body: JSON.stringify({ version: created.data.version, quoteVersionId: created.data.currentVersionId, clientPlanningImportId: analysis.data.id, items: [{ rowNumber: analysis.data.rows[0].rowNumber, sourceType: 'resource', sourceId: 'resource_3', category: 'room', unit: 'jour' }] }) }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.lines.length, 1);
});

test('seul un devis accepté alimente le chiffre d’affaires avec son instantané', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'revenue-recognition-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', creationMethod: 'manual', title: 'Devis CA accepté', taxDate: '2026-08-18', lines: [{ category: 'free', sourceType: 'manual', label: 'Forfait CA', quantityMilli: '1000', unitPriceMinor: '10000', priceOverrideReason: 'Forfait commercial pour test CA' }] }) }, admin); let document = created.data;
  const before = await request('/api/v1/dashboard/revenue', {}, admin); assert.equal(before.response.status, 200); assert.equal(before.data.items.some(item => item.quoteId === document.id), false);
  for (const status of ['validated', 'sent', 'accepted']) { const changed = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status }) }, admin); assert.equal(changed.response.status, 200, JSON.stringify(changed.data)); document = changed.data; }
  assert.equal(document.revenueRecognition.state, 'active'); assert.equal(document.revenueRecognition.netHt, created.data.netHt); assert.equal(document.revenueRecognition.vatAmount, created.data.vatAmount); assert.equal(document.revenueRecognition.grossTtc, created.data.grossTtc); assert.equal(document.revenueRecognition.quoteVersionId, document.currentVersionId);
  const revenue = await request('/api/v1/dashboard/revenue', {}, admin); assert.equal(revenue.response.status, 200); const item = revenue.data.items.find(value => value.quoteId === document.id); assert.ok(item); assert.deepEqual({ netHt: item.netHt, vatAmount: item.vatAmount, grossTtc: item.grossTtc }, { netHt: created.data.netHt, vatAmount: created.data.vatAmount, grossTtc: created.data.grossTtc }); assert.ok(readDb().auditEvents.some(value => value.action === 'quote.revenueRecognized' && value.entityId === document.id));
});

test('la matrice post-production LES 50 utilise les dates 1904 et conserve les jours ouvrés', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'budget-les50-matrix' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'budget', title: 'Budget LES 50 matrice', taxDate: '2026-08-18' }) }, admin), document = created.data, workbook = les50PlanningXlsx(), before = readDb().reservations.length;
  const analysis = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'PLANNING 50.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', contentBase64: workbook.toString('base64') }) }, admin);
  assert.equal(analysis.response.status, 201, JSON.stringify(analysis.data)); assert.equal(analysis.data.rows.length, 2); assert.deepEqual(analysis.data.rows.map(row => [row.label, row.startDate, row.endDate, row.durationDays, row.personnel, row.sourceStatus]), [["Montage Avid E01", '2026-07-06', '2026-07-07', 2, "Ludo D'HERMY", 'Planifié'], ["Chef d’édition E01", '2026-07-06', '2026-07-08', 2, 'Véro KRUHAK', 'Planifié']]); assert.match(analysis.data.rows[0].resourceText, /Salle de montage Avid/); assert.match(analysis.data.rows[1].resourceText, /Chef d'Ed/); assert.equal(readDb().reservations.length, before);
});

test('un PDF sans texte exploitable est refusé sans créer de réservation', async () => {
  const document = readDb().quotes.find(value => value.title === 'Planning client contrôlé'), before = readDb().reservations.length, pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'); const result = await request(`/api/v1/quotes/${document.id}/client-planning/analyze`, { method: 'POST', body: JSON.stringify({ version: document.version, quoteVersionId: document.currentVersionId, fileName: 'scan.pdf', mimeType: 'application/pdf', contentBase64: pdf.toString('base64') }) }, admin); assert.equal(result.response.status, 422); assert.equal(result.data.error.code, 'CLIENT_PLANNING_TEXT_UNAVAILABLE'); assert.equal(readDb().reservations.length, before);
});

test('le PDF conserve des pages A4 non condensées et réserve le bloc final à la dernière page', async () => {
  const document = readDb().quotes.find(value => value.title === 'Devis snapshot V2');
  const response = await fetch(`${baseUrl}/api/v1/quotes/${document.id}/pdf`, { headers: { cookie: admin.cookie } }), text = Buffer.from(await response.arrayBuffer()).toString('latin1');
  assert.equal(response.status, 200); assert.match(text, /\/MediaBox \[0 0 595 842\]/); assert.match(text, /\/Count 5/); assert.equal((text.match(/TOTAL TTC/g) || []).length, 1); assert.equal((text.match(/signature client/gi) || []).length, 1);
});

test('les sélections commerciales mal typées reçoivent un 422 stable sans mutation', async () => {
  const current = readDb().quotes.find(value => value.id === quote.id), line = current.lines[0], beforeVersion = current.version;
  const cases = [
    ['/api/v1/quotes/preview-reservations', { projectId: 'project_1', reservationIds: { id: 'reservation_1' }, mode: 'detailed' }],
    [`/api/v1/quotes/${current.id}/import-reservations`, { version: current.version, reservationIds: ['reservation_1'], confirmDuplicateBookingIds: 'reservation_1' }],
    [`/api/v1/quotes/${current.id}/import-reservations`, { version: current.version, reservationIds: ['reservation_1'], lineAdjustments: { key: 'invalid' } }],
    [`/api/v1/quotes/${current.id}/lines/${line.id}/bookings`, { version: current.version, reservationIds: ['reservation_1'], confirmDuplicateBookingIds: { id: 'reservation_1' } }],
    [`/api/v1/quotes/${current.id}/status`, { version: current.version, status: 'inReview', confirmBookingIds: 'reservation_1' }],
  ];
  for (const [route, body] of cases) { const result = await request(route, { method: 'POST', body: JSON.stringify(body) }, admin); assert.equal(result.response.status, 422, route); assert.equal(result.data.error.code, 'VALIDATION_ERROR'); }
  assert.equal(readDb().quotes.find(value => value.id === current.id).version, beforeVersion);
});

test('PlanyBot contrôle manuellement le devis accepté, invalide un contrôle obsolète et prépare l’avenant de dépassement', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'manual-planning-control-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Devis suivi par PlanyBot', taxDate: '2026-08-16', lines: [
    { category: 'room', sourceType: 'resource', sourceId: 'resource_3', label: 'Montage Avid suivi', unit: 'jour', quantityMilli: '2000', unitPriceMinor: '45000', priceOverrideReason: 'Tarif validé pour le contrôle' },
    { category: 'free', sourceType: 'manual', label: 'Stockage non planifiable', unit: 'forfait', quantityMilli: '1000', unitPriceMinor: '10000', priceOverrideReason: 'Forfait commercial validé' },
  ] }) }, admin); assert.equal(created.response.status, 201); let document = created.data;
  for (const status of ['validated', 'sent', 'accepted']) { const changed = await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status }) }, admin); assert.equal(changed.response.status, 200); document = changed.data; }
  const control0 = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(control0.response.status, 200); assert.equal(control0.data.items[0].state, 'unplanned'); assert.equal(control0.data.items[1].state, 'nonApplicable'); assert.equal(control0.data.progressPercent, 0);
  const reservation = date => request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: `Montage ${date}`, siteId: 'site_paris', projectId: document.projectId, status: 'confirmed', startsAt: `${date}T09:00:00+02:00`, endsAt: `${date}T18:00:00+02:00`, resources: [{ resourceId: 'resource_3', quantity: 1 }], planningMode: 'dailyCells', sourceQuoteId: document.id, sourceQuoteVersionId: document.currentVersionId, sourceQuoteLineId: document.lines[0].id, planningUnit: 'jour' }) }, admin);
  assert.equal((await reservation('2030-01-07')).response.status, 201); const partial = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(partial.data.items[0].state, 'partiallyPlanned'); assert.equal(partial.data.items[0].plannedQuantityMilli, '1000'); assert.equal(partial.data.progressPercent, 50);
  assert.equal((await reservation('2030-01-08')).response.status, 201); const complete = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(complete.data.items[0].state, 'compliant'); assert.equal(complete.data.entirelyPlanned, true);
  const validated = await request(`/api/v1/quotes/${document.id}/planning-control/validate`, { method: 'POST', headers: { 'Idempotency-Key': 'validate-manual-planning-control' }, body: JSON.stringify({ quoteVersionId: document.currentVersionId, confirmOverages: false, overageReason: '' }) }, admin); assert.equal(validated.response.status, 201); assert.equal(validated.data.project.status, 'planned'); assert.match(validated.data.control.snapshotDigest, /^[a-f0-9]{64}$/); const current = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(current.data.status, 'validated'); assert.equal(current.data.snapshotDigest, validated.data.control.snapshotDigest);
  const third = await reservation('2030-01-09'); assert.equal(third.response.status, 201); const over = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(over.data.items[0].state, 'overPlanned'); assert.equal(over.data.items[0].differenceQuantityMilli, '1000'); assert.equal(over.data.items[0].estimatedOverageNetHt, '45000'); assert.equal(over.data.status, 'inProgress'); assert.equal(over.data.latestValidation.current, false); assert.ok(over.data.complementaryDraft);
  const duplicateInput = { targetDate: '2030-01-10', targetResourceId: 'resource_3' }, duplicate = await request(`/api/v1/reservations/${third.data.id}/duplicate`, { method: 'POST', headers: { 'Idempotency-Key': 'duplicate-planning-control' }, body: JSON.stringify(duplicateInput) }, admin), replay = await request(`/api/v1/reservations/${third.data.id}/duplicate`, { method: 'POST', headers: { 'Idempotency-Key': 'duplicate-planning-control' }, body: JSON.stringify(duplicateInput) }, admin); assert.equal(duplicate.response.status, 201); assert.equal(replay.response.status, 200); assert.equal(replay.data.id, duplicate.data.id);
  let synchronized = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(synchronized.data.complementaryDraft.id, over.data.complementaryDraft.id); assert.equal(readDb().quotes.find(value => value.id === over.data.complementaryDraft.id).lines[0].quantityMilli, '2000');
  const removed = await request(`/api/v1/reservations/${duplicate.data.id}`, { method: 'DELETE', body: JSON.stringify({ version: duplicate.data.version }) }, admin); assert.equal(removed.response.status, 200); synchronized = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(synchronized.data.complementaryDraft.id, over.data.complementaryDraft.id); assert.equal(readDb().quotes.find(value => value.id === over.data.complementaryDraft.id).lines[0].quantityMilli, '1000');
  const amendment = await request(`/api/v1/quotes/${document.id}/planning-control/amendment`, { method: 'POST', headers: { 'Idempotency-Key': 'planning-overage-amendment' }, body: JSON.stringify({ quoteVersionId: document.currentVersionId }) }, admin); assert.equal(amendment.response.status, 201); assert.equal(amendment.data.id, over.data.complementaryDraft.id); assert.equal(amendment.data.status, 'draft'); assert.equal(amendment.data.parentDocumentId, document.id); assert.equal(amendment.data.lines.length, 1); assert.equal(amendment.data.lines[0].quantityMilli, '1000'); assert.match(amendment.data.lines[0].label, /supplément planning/);
  let acceptedAmendment = amendment.data; for (const status of ['validated', 'sent', 'accepted']) { const changed = await request(`/api/v1/quotes/${acceptedAmendment.id}/status`, { method: 'POST', body: JSON.stringify({ version: acceptedAmendment.version, status }) }, admin); assert.equal(changed.response.status, 200); acceptedAmendment = changed.data; }
  const covered = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(covered.data.items[0].baseSoldQuantityMilli, '2000'); assert.equal(covered.data.items[0].acceptedComplementQuantityMilli, '1000'); assert.equal(covered.data.items[0].soldQuantityMilli, '3000'); assert.equal(covered.data.items[0].plannedQuantityMilli, '3000'); assert.equal(covered.data.items[0].state, 'compliant'); assert.equal(covered.data.complementaryDraft, null);
  const fourth = await reservation('2030-01-11'); assert.equal(fourth.response.status, 201); const secondOverage = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(secondOverage.data.items[0].soldQuantityMilli, '3000'); assert.equal(secondOverage.data.items[0].plannedQuantityMilli, '4000'); assert.equal(secondOverage.data.items[0].overageQuantityMilli, '1000'); assert.equal(secondOverage.data.items[0].state, 'overPlanned'); assert.ok(secondOverage.data.complementaryDraft); assert.notEqual(secondOverage.data.complementaryDraft.id, acceptedAmendment.id);
  const expanded = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'planning-complement-plus-five' }, body: JSON.stringify({ actions: ['12', '13', '14', '15'].map(day => ({ type: 'duplicate', reservationId: fourth.data.id, sourceDate: '2030-01-11', sourceResourceId: 'resource_3', targetDate: `2030-01-${day}`, targetResourceId: 'resource_3' })) }) }, admin); assert.equal(expanded.response.status, 201, JSON.stringify(expanded.data)); assert.equal(expanded.data.items.length, 4);
  let exactCycle = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); const cycleDraftId = exactCycle.data.complementaryDraft.id; assert.equal(cycleDraftId, secondOverage.data.complementaryDraft.id); assert.equal(exactCycle.data.items[0].overageQuantityMilli, '5000'); assert.equal(readDb().quotes.find(value => value.id === cycleDraftId).lines[0].quantityMilli, '5000');
  const reduced = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'planning-complement-plus-three' }, body: JSON.stringify({ actions: expanded.data.items.slice(0, 2).map(item => ({ type: 'cancel', reservationId: item.id, version: item.version })) }) }, admin); assert.equal(reduced.response.status, 201); exactCycle = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(exactCycle.data.complementaryDraft.id, cycleDraftId); assert.equal(exactCycle.data.items[0].overageQuantityMilli, '3000'); assert.equal(readDb().quotes.find(value => value.id === cycleDraftId).lines[0].quantityMilli, '3000');
  const cleared = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'planning-complement-zero' }, body: JSON.stringify({ actions: [fourth.data, ...expanded.data.items.slice(2)].map(item => ({ type: 'cancel', reservationId: item.id, version: item.version })) }) }, admin); assert.equal(cleared.response.status, 201); exactCycle = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(exactCycle.data.items[0].overageQuantityMilli, '0'); assert.equal(exactCycle.data.items[0].state, 'compliant'); assert.equal(exactCycle.data.complementaryDraft, null); assert.equal(readDb().quotes.find(value => value.id === cycleDraftId).status, 'cancelled');
  assert.equal(readDb().quotes.find(value => value.id === document.id).status, 'accepted');
  assert.equal(readDb().quotes.find(value => value.id === acceptedAmendment.id).status, 'accepted');
});

test('exclure les week-ends retire samedi et dimanche du volume planifié', async () => {
  const created = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'weekdays-only-control' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Devis cinq jours ouvrés', taxDate: '2026-08-18', lines: [{ category: 'room', sourceType: 'resource', sourceId: 'resource_4', label: 'Montage semaine ouvrée', unit: 'jour', quantityMilli: '5000', unitPriceMinor: '45000', priceOverrideReason: 'Tarif test jours ouvrés' }] }) }, admin); let document = created.data;
  for (const status of ['validated', 'sent', 'accepted']) document = (await request(`/api/v1/quotes/${document.id}/status`, { method: 'POST', body: JSON.stringify({ version: document.version, status }) }, admin)).data;
  const reservation = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Semaine sans week-end', siteId: 'site_paris', projectId: document.projectId, status: 'confirmed', startsAt: '2030-01-07T09:00:00+01:00', endsAt: '2030-01-13T18:00:00+01:00', includeWeekends: false, resources: [{ resourceId: 'resource_4', quantity: 1 }], planningMode: 'dailyCells', sourceQuoteId: document.id, sourceQuoteVersionId: document.currentVersionId, sourceQuoteLineId: document.lines[0].id, planningUnit: 'jour' }) }, admin); assert.equal(reservation.response.status, 201, JSON.stringify(reservation.data)); assert.equal(reservation.data.includeWeekends, false);
  const control = await request(`/api/v1/quotes/${document.id}/planning-control`, {}, admin); assert.equal(control.response.status, 200); assert.equal(control.data.items[0].plannedQuantityMilli, '5000'); assert.equal(control.data.items[0].state, 'compliant'); assert.equal(control.data.complementaryDraft, null);
});

test('copier une cellule multi-jours crée uniquement une journée indépendante et rejouable', async () => {
  const source = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Série à copier cellule par cellule', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2031-02-03T09:00:00+01:00', endsAt: '2031-02-05T18:00:00+01:00', includeWeekends: true, resources: [{ resourceId: 'resource_3', quantity: 1 }], planningMode: 'dailyCells' }) }, admin);
  assert.equal(source.response.status, 201, JSON.stringify(source.data));
  const input = { sourceDate: '2031-02-04', sourceResourceId: 'resource_3', targetDate: '2031-02-11', targetResourceId: 'resource_4' };
  const copied = await request(`/api/v1/reservations/${source.data.id}/duplicate`, { method: 'POST', headers: { 'Idempotency-Key': 'copy-one-cell-only' }, body: JSON.stringify(input) }, admin);
  const replay = await request(`/api/v1/reservations/${source.data.id}/duplicate`, { method: 'POST', headers: { 'Idempotency-Key': 'copy-one-cell-only' }, body: JSON.stringify(input) }, admin);
  assert.equal(copied.response.status, 201, JSON.stringify(copied.data));
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.id, copied.data.id);
  assert.equal(copied.data.startsAt.slice(0, 10), '2031-02-11');
  assert.equal(copied.data.endsAt.slice(0, 10), '2031-02-11');
  assert.deepEqual(copied.data.resources, [{ resourceId: 'resource_4', quantity: 1 }]);
  assert.equal(copied.data.cellOverrides.length, 0);
  assert.ok(readDb().auditEvents.some(item => item.action === 'reservation.cellDuplicated' && item.entityId === copied.data.id));
});

test('SSE Commercial revalide quote.read en direct et conserve l’isolation site', async () => {
  const readRole = await request('/api/v1/roles', { method: 'POST', body: JSON.stringify({ code: 'commercialStreamReader', name: 'Lecteur flux commercial', permissions: ['quote.read'] }) }, admin), deniedRole = await request('/api/v1/roles', { method: 'POST', body: JSON.stringify({ code: 'planningSansCommercial', name: 'Planning sans commercial', permissions: ['planning.read'] }) }, admin); assert.equal(readRole.response.status, 201); assert.equal(deniedRole.response.status, 201);
  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin), membership = memberships.data.items.find(value => value.userId === viewer.user.id); let assigned = await request(`/api/v1/memberships/${membership.id}/roles`, { method: 'PUT', body: JSON.stringify({ version: membership.version, roleIds: [readRole.data.id] }) }, admin); assert.equal(assigned.response.status, 200); viewer = await login('viewer@northlight.fr');
  const adminStream = await openEventStream(admin), siteStream = await openEventStream(viewer);
  const createQuote = (key, siteId) => request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ projectId: 'project_1', siteId, kind: 'quote', title: key, taxDate: '2026-08-16' }) }, admin);
  assert.equal((await createQuote('sse-commercial-boulogne', 'site_boulogne')).response.status, 201); assert.match(await nextInvalidation(adminStream), /quote\.created\.v1/); assert.equal(await nextInvalidation(siteStream, 150), null); closeEventStream(siteStream);
  const liveStream = await openEventStream(viewer); assert.equal((await createQuote('sse-commercial-paris-before-revoke', 'site_paris')).response.status, 201); assert.match(await nextInvalidation(adminStream), /quote\.created\.v1/); assert.match(await nextInvalidation(liveStream), /quote\.created\.v1/);
  assigned = await request(`/api/v1/memberships/${membership.id}/roles`, { method: 'PUT', body: JSON.stringify({ version: assigned.data.version, roleIds: [deniedRole.data.id] }) }, admin); assert.equal(assigned.response.status, 200); assert.match(await nextInvalidation(adminStream), /membership\.updated\.v1/); assert.match(await nextInvalidation(liveStream), /membership\.updated\.v1/);
  assert.equal((await createQuote('sse-commercial-paris-after-revoke', 'site_paris')).response.status, 201); assert.match(await nextInvalidation(adminStream), /quote\.created\.v1/); assert.equal(await nextInvalidation(liveStream, 150), null); closeEventStream(liveStream); closeEventStream(adminStream);
  viewer = await login('viewer@northlight.fr'); for (const route of ['/api/v1/rate-cards', '/api/v1/projects/project_1/dashboard', '/api/v1/reservations/reservation_1/commercial-links']) { const denied = await request(route, {}, viewer); assert.equal(denied.response.status, 403, route); assert.equal(denied.data.error.code, 'FORBIDDEN'); }
});

test('l’interface limite la sélection jour au DOM visible et expose les confirmations protégées', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /\.planning-cell\[data-date="\$\{CSS\.escape\(day\.dataset\.planningDay\)\}"\] \[data-select-booking\]/);
  assert.match(source, /COMMERCIAL_DOUBLE_BILLING_CONFIRMATION_REQUIRED/);
  assert.match(source, /confirmDuplicateBookingIds/);
  assert.match(source, /BOOKING_ACCEPTANCE_CONFIRMATION_REQUIRED|confirmBookingIds/);
  assert.match(source, /data-quote-line-row/);
  assert.match(source, /data-booking-unlink/);
  assert.doesNotMatch(source, /selectedLineId\)\|\|quote\.lines\[0\]/);
  assert.match(source, /explicitLineSelections=new Map/);
  assert.match(source, /emptyQuoteLineDetail/);
  assert.doesNotMatch(source, /nulldocument/);
  assert.match(source, /else quotesModule\.selectedLineId=null;document\.querySelectorAll/);
  assert.doesNotMatch(css, /\.quote-lines-panel tbody tr:first-child/);
  assert.match(css, /tr\[data-quote-line-row\]:focus-visible/);
  assert.match(source, /planningContextMenuTrigger/);
  assert.match(source, /trigger\.focus\(\{preventScroll:true\}\)/);
  assert.match(source, /FISCAL_PROFILE_INCOMPLETE/);
  assert.match(source, /data-complete-fiscal-profile/);
  assert.match(source, /Compléter le profil fiscal \(O1\)/);
  assert.match(source, /organization\.o1Step=o1StepForFields\(fields\)/);
  assert.match(source, /workflowAdvanced=c\.onboardingStage!==['"]identity['"]/);
  assert.match(source, /Valider O1 et continuer/);
  assert.match(source, /quote-a4-sheet/);
  assert.match(source, /quote-a4-editor-layout/);
  assert.match(source, /data-quote-catalog-preset/);
  assert.match(source, /Étalonnage image/);
  assert.match(source, /Mixage son/);
  assert.match(source, /PAD et contrôle qualité/);
  assert.match(source, /Stockage NEXIS production/);
  assert.match(source, /Stockage Nearline/);
  assert.match(source, /unit:'To\/mois'/);
  assert.match(source, /price:'900'/);
  assert.match(source, /price:'750'/);
  assert.match(source, /unitPrice\.dataset\.manual='true'/);
  assert.match(source, /Motif de modification du prix/);
  assert.match(source, /manualPriceOverridePayload/);
  assert.match(source, /placeholder="Tarif automatique"/);
  assert.match(source, /placeholder="Laisser vide pour le tarif automatique"/);
  assert.match(source, /priceOverrideReason/);
  assert.match(source, /Document client A4/);
  assert.match(source, /Valider le devis/);
  assert.match(source, /Convertir en planning/);
  assert.match(source, /Planifier le devis/);
  assert.match(source, /planning-control/);
  assert.match(source, /sourceQuoteLineId/);
  assert.match(source, /Tout dépassement du vendu alimente automatiquement un seul devis complémentaire brouillon/);
  assert.match(source, /complementaryDraft/);
  assert.match(source, /data-planning-copy/);
  assert.match(source, /planningCellSelection/);
  assert.match(source, /data-select-cell/);
  assert.match(source, /data-resize-booking/);
  assert.doesNotMatch(source, /data-resize-edge="start"[^>]*>‹<\/button>/);
  assert.doesNotMatch(source, /data-resize-edge="end"[^>]*>›<\/button>/);
  assert.match(source, /filters\.project='';activePlanningProjectId=quote\.projectId/);
  assert.match(source, /Ajouter depuis le planning existant/);
  assert.match(source, /Il ne sert pas à analyser un fichier de planning client/);
  assert.match(source, /Importer le planning client/);
  assert.match(source, /Créer un devis depuis un planning client/);
  assert.match(source, /clientPlanningImport/);
  assert.match(source, /client-planning\/apply-lines/);
  assert.match(source, /CA devis acceptés/);
  assert.match(source, /Import planning client/);
  assert.match(source, /openBudgetClientPlanningImport/);
  assert.match(source, /Ce budget ne crée aucune réservation/);
  assert.match(source, /selectClientPlanningFileWithPlanyBotBase/);
  assert.match(source, /if\(panel\)panel\.hidden=false/);
  assert.match(source, /Glissez le planning client ici/);
  assert.match(source, /client-planning\/analyze/);
  assert.match(source, /Comparer et corriger/);
  assert.match(source, /aucune réservation créée/i);
  assert.match(source, /planning-conversion\/preview/);
  assert.match(source, /Guide de l’analyse du planning client/);
  assert.match(source, /PlanyBot explique et prépare/);
  assert.match(source, /Le devis et son instantané fiscal resteront inchangés/);
  assert.match(source, /<th>Remise<\/th>/);
  assert.match(css, /min-height:297mm/);
  assert.match(css, /grid-template-columns:210px minmax\(680px,1fr\) 270px/);
  assert.match(css, /quote-editor-internals/);
  assert.match(css, /client-planning-dropzone/);
  assert.match(css, /client-planning-compare-row/);
  assert.match(css, /client-planning-planybot-float/);
  assert.match(css, /planning-quote-control/);
});

test('un autre contexte société ne révèle pas le devis', async () => {
  const switched = await request('/api/v1/session/company-context', { method: 'POST', body: JSON.stringify({ companyId: 'company_eliote_location' }) }, admin); assert.equal(switched.response.status, 200); admin.csrf = switched.data.csrfToken;
  const guessed = await request(`/api/v1/quotes/${quote.id}`, {}, admin); assert.equal(guessed.response.status, 404); assert.equal(guessed.data.error.code, 'NOT_FOUND');
});
