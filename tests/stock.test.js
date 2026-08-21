'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataFile = path.join(os.tmpdir(), `planify-stock-test-${process.pid}-${Date.now()}.json`);
process.env.PLANIFY_DATA_FILE = dataFile;
process.env.PLANIFY_SSE_REVALIDATE_MS = '50';

const {
  createServer,
  resetData,
  makeSeed,
  readDb,
  reconstructStockBalances,
  validateStockLedger,
  checkStockAvailability,
  allocateStock,
  releaseStock,
  openAssetMaintenance,
  completeAssetMaintenance,
} = require('../server.js');

let server;
let baseUrl;
let admin;
let viewer;

const authFor = (db, id) => ({ user: db.users.find(user => user.id === id) });

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}

async function login(email) {
  const result = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'demo2026' }),
  });
  assert.equal(result.response.status, 200);
  return {
    cookie: result.response.headers.get('set-cookie').split(';', 1)[0],
    csrf: result.data.csrfToken,
    user: result.data.user,
  };
}

const reservationWindow = {
  startsAt: '2026-08-17T07:00:00.000Z',
  endsAt: '2026-08-17T10:00:00.000Z',
};

before(async () => {
  const seed = makeSeed();
  seed.users.find(user => user.id === 'user_viewer').siteIds = ['site_paris'];
  resetData(seed);
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const filename of fs.readdirSync(path.dirname(dataFile))) {
    if (filename.startsWith(path.basename(dataFile))) fs.rmSync(path.join(path.dirname(dataFile), filename), { force: true });
  }
});

test('le seed migré v3 possède toujours un ledger Stock reconstructible et cohérent', () => {
  const db = readDb();
  assert.equal(db.schemaVersion, 3);
  assert.equal(db.migrations.filter(value => value.id === 'foundation-01-organization-v2-to-v3').length, 1);
  assert.equal(db.stockLocations.length, 3);
  assert.equal(db.stockItems.length, 8);
  assert.equal(db.equipmentAssets.length, 12);
  assert.ok(db.stockMovements.length > db.equipmentAssets.length);
  assert.deepEqual(validateStockLedger(db, 'company_northlight'), {
    valid: true,
    movementCount: db.stockMovements.length,
  });

  const xlr = reconstructStockBalances(db, 'company_northlight', {
    stockItemId: 'stock_xlr', locationId: 'location_paris_store',
  });
  assert.equal(xlr.length, 1);
  assert.equal(xlr[0].onHandAvailable, 20);
  assert.equal(xlr[0].physicalOnSite, 20);
  assert.equal(xlr[0].ownedPhysical, 20);
});

test('les helpers exigent un emplacement pour un article en quantité', () => {
  const db = makeSeed();
  const auth = authFor(db, 'user_admin');
  assert.throws(
    () => checkStockAvailability(db, auth, reservationWindow, [{ stockItemId: 'stock_xlr', quantity: 1 }]),
    error => error.status === 422 && error.code === 'VALIDATION_ERROR',
  );
});

test('allocation et libération helpers ne rendent jamais la réservation négative', () => {
  const db = makeSeed();
  const auth = authFor(db, 'user_admin');
  const lines = [{
    stockItemId: 'stock_xlr', quantity: 2, locationId: 'location_paris_store', allocationId: 'helper-allocation',
  }];
  const allocated = allocateStock(db, auth, 'reservation_1', reservationWindow, lines);
  assert.equal(allocated.movements.length, 1);
  assert.equal(allocated.movements[0].entries[0].delta, 2);
  const released = releaseStock(db, auth, 'reservation_1', ['helper-allocation']);
  assert.equal(released.movements[0].entries[0].delta, -2);
  assert.throws(
    () => releaseStock(db, auth, 'reservation_1', ['helper-allocation']),
    error => error.status === 409 && error.code === 'ASSET_UNAVAILABLE',
  );
  assert.equal(validateStockLedger(db, 'company_northlight').valid, true);
});

test('les helpers maintenance couvrent disponible, quarantaine, versions et transitions', () => {
  const db = makeSeed();
  const auth = authFor(db, 'user_admin');

  assert.throws(
    () => openAssetMaintenance(db, auth, 'asset_rec_1', 'Diagnostic', { requireVersion: true, version: 99 }),
    error => error.status === 409 && error.code === 'VERSION_CONFLICT',
  );
  const opened = openAssetMaintenance(db, auth, 'asset_rec_1', 'Diagnostic', { requireVersion: true, version: 1 });
  assert.equal(opened.asset.status, 'maintenance');
  const completed = completeAssetMaintenance(db, auth, opened.maintenance.id, 'RAS', 'good', 1, {
    requireAssetVersion: true, assetVersion: 2,
  });
  assert.equal(completed.asset.status, 'available');
  assert.equal(completed.asset.condition, 'good');
  assert.throws(
    () => completeAssetMaintenance(db, auth, opened.maintenance.id, 'Encore', 'good', 2, {
      requireAssetVersion: true, assetVersion: 3,
    }),
    error => error.status === 409 && error.code === 'INVALID_MAINTENANCE_TRANSITION',
  );

  const quarantined = openAssetMaintenance(db, auth, 'asset_lens_2', 'Réparation choc', {
    requireVersion: true, version: 1,
  });
  assert.equal(quarantined.movement.entries[0].account, 'onHandQuarantine');
  const damaged = completeAssetMaintenance(db, auth, quarantined.maintenance.id, 'Non réparable', 'damaged', 1, {
    requireAssetVersion: true, assetVersion: 2,
  });
  assert.equal(damaged.asset.status, 'quarantine');

  assert.throws(
    () => openAssetMaintenance(db, auth, 'asset_fx6_2', 'Doublon', { requireVersion: true, version: 1 }),
    error => error.status === 409 && error.code === 'ASSET_UNAVAILABLE',
  );
  assert.equal(validateStockLedger(db, 'company_northlight').valid, true);
});

test('migration Stock v1 vers v2 puis Organisation v2 vers v3 conserve RC1 et les backups sans doublon', () => {
  const legacy = makeSeed();
  legacy.schemaVersion = 1;
  for (const key of ['stockItems', 'equipmentAssets', 'stockLocations', 'stockMovements', 'maintenanceRecords', 'stockIdempotency']) delete legacy[key];
  delete legacy.migrations;
  const raw = `${JSON.stringify(legacy, null, 2)}\n`;
  fs.writeFileSync(dataFile, raw, { mode: 0o600 });

  const migrated = readDb();
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.reservations.length, legacy.reservations.length);
  assert.deepEqual(migrated.reservations, legacy.reservations);
  assert.ok(['stockItems', 'equipmentAssets', 'stockLocations', 'stockMovements', 'maintenanceRecords', 'stockIdempotency']
    .every(key => Array.isArray(migrated[key]) && migrated[key].length === 0));
  assert.equal(migrated.migrations.filter(value => value.id === 'schema-v1-to-v2').length, 1);
  assert.equal(migrated.migrations.filter(value => value.id === 'foundation-01-organization-v2-to-v3').length, 1);

  const backups = fs.readdirSync(path.dirname(dataFile)).filter(filename =>
    filename.startsWith(`${path.basename(dataFile)}.schema-v1.`) && filename.endsWith('.backup.json'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(path.dirname(dataFile), backups[0]), 'utf8'), raw);

  const replay = readDb();
  assert.equal(replay.migrations.filter(value => value.id === 'schema-v1-to-v2').length, 1);
  assert.equal(replay.migrations.filter(value => value.id === 'foundation-01-organization-v2-to-v3').length, 1);
  assert.equal(fs.readdirSync(path.dirname(dataFile)).filter(filename =>
    filename.startsWith(`${path.basename(dataFile)}.schema-v1.`) && filename.endsWith('.backup.json')).length, 1);

  const seed = makeSeed();
  seed.users.find(user => user.id === 'user_viewer').siteIds = ['site_paris'];
  resetData(seed);
});

test('login admin et viewer expose les permissions Stock attendues', async () => {
  admin = await login('admin@northlight.fr');
  viewer = await login('viewer@northlight.fr');
  assert.ok(admin.user.permissions.includes('stock.move'));
  assert.ok(admin.user.permissions.includes('maintenance.manage'));
  assert.ok(viewer.user.permissions.includes('stock.read'));
  assert.ok(!viewer.user.permissions.includes('stock.move'));
});

test('Origin hostile bloque login et mutation, Origin loopback est accepté', async () => {
  const evilLogin = await request('/api/v1/auth/login', {
    method: 'POST', headers: { origin: 'https://evil.example' },
    body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }),
  });
  assert.equal(evilLogin.response.status, 403);
  assert.equal(evilLogin.data.error.code, 'ORIGIN_INVALID');
  assert.ok(!evilLogin.response.headers.get('set-cookie'));

  const loopback = await request('/api/v1/auth/login', {
    method: 'POST', headers: { origin: baseUrl },
    body: JSON.stringify({ email: 'planner@northlight.fr', password: 'demo2026' }),
  });
  assert.equal(loopback.response.status, 200);
  assert.ok(loopback.response.headers.get('set-cookie'));

  const beforeCount = readDb().stockItems.length;
  const evilMutation = await request('/api/v1/stock/items', {
    method: 'POST', headers: { origin: 'https://evil.example' },
    body: JSON.stringify({ name: 'Origine hostile', sku: 'EVIL-ORIGIN', category: 'qa', trackingMode: 'quantity' }),
  }, admin);
  assert.equal(evilMutation.response.status, 403);
  assert.equal(evilMutation.data.error.code, 'ORIGIN_INVALID');
  assert.equal(readDb().stockItems.length, beforeCount);

  const accepted = await request('/api/v1/stock/items', {
    method: 'POST', headers: { origin: baseUrl },
    body: JSON.stringify({ name: 'Origine locale', sku: 'LOCAL-ORIGIN', category: 'qa', trackingMode: 'quantity' }),
  }, admin);
  assert.equal(accepted.response.status, 201);
});

test('HTTP impose les emplacements et isole Paris de Boulogne', async () => {
  const missingLocation = await request('/api/v1/stock/availability/check', {
    method: 'POST', body: JSON.stringify({ window: reservationWindow, lines: [{ stockItemId: 'stock_xlr', quantity: 1 }] }),
  }, admin);
  assert.equal(missingLocation.response.status, 422);
  assert.equal(missingLocation.data.error.code, 'VALIDATION_ERROR');

  const invalidAsset = await request('/api/v1/equipment/assets', {
    method: 'POST', body: JSON.stringify({
      stockItemId: 'stock_camera_fx6', serialNumber: 'QA-NO-LOCATION', siteId: 'site_paris', condition: 'good',
    }),
  }, admin);
  assert.equal(invalidAsset.response.status, 422);

  const locations = await request('/api/v1/stock/locations', {}, viewer);
  assert.equal(locations.response.status, 200);
  assert.ok(locations.data.items.every(item => item.siteId === 'site_paris'));
  assert.ok(!locations.data.items.some(item => item.id === 'location_boulogne_store'));

  const forbidden = await request('/api/v1/stock/availability/check', {
    method: 'POST', body: JSON.stringify({
      window: reservationWindow,
      lines: [{ stockItemId: 'stock_battery', quantity: 1, siteId: 'site_boulogne', locationId: 'location_boulogne_store' }],
    }),
  }, viewer);
  assert.equal(forbidden.response.status, 404);
  assert.equal(forbidden.data.error.code, 'NOT_FOUND');
});

test('HTTP accepte la réservation canonique et refuse une source ou période forgée', async () => {
  const valid = await request('/api/v1/stock/availability/check', {
    method: 'POST', body: JSON.stringify({
      window: reservationWindow,
      lines: [{ stockItemId: 'stock_xlr', quantity: 2, siteId: 'site_paris', locationId: 'location_paris_store' }],
    }),
  }, admin);
  assert.equal(valid.response.status, 200);
  assert.equal(valid.data.available, true);

  const forgedPeriod = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'forged-period' }, body: JSON.stringify({
      orderId: 'reservation_1',
      window: { startsAt: reservationWindow.startsAt, endsAt: '2026-08-17T11:00:00.000Z' },
      lines: [{ stockItemId: 'stock_xlr', quantity: 1, locationId: 'location_paris_store', allocationId: 'forged' }],
    }),
  }, admin);
  assert.equal(forgedPeriod.response.status, 422);

  const forgedSource = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'forged-source' }, body: JSON.stringify({
      orderId: 'reservation_unknown', window: reservationWindow,
      lines: [{ stockItemId: 'stock_xlr', quantity: 1, locationId: 'location_paris_store', allocationId: 'forged-2' }],
    }),
  }, admin);
  assert.equal(forgedSource.response.status, 404);
  assert.equal(forgedSource.data.error.code, 'NOT_FOUND');
});

test('HTTP garantit idempotence allocate/release et absence de solde réservé négatif', async () => {
  const payload = {
    orderId: 'reservation_1', window: reservationWindow,
    lines: [{ stockItemId: 'stock_xlr', quantity: 2, locationId: 'location_paris_store', allocationId: 'http-allocation' }],
  };
  const first = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'allocate-http-1' }, body: JSON.stringify(payload),
  }, admin);
  assert.equal(first.response.status, 201);
  assert.equal(first.data.movements.length, 1);

  const replay = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'allocate-http-1' }, body: JSON.stringify(payload),
  }, admin);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.idempotentReplay, true);
  assert.equal(replay.data.movements[0].id, first.data.movements[0].id);

  const conflict = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'allocate-http-1' }, body: JSON.stringify({
      ...payload, lines: [{ ...payload.lines[0], quantity: 3 }],
    }),
  }, admin);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.data.error.code, 'IDEMPOTENCY_CONFLICT');

  const releasePayload = { orderId: 'reservation_1', allocationIds: ['http-allocation'] };
  const released = await request('/api/v1/stock/releases', {
    method: 'POST', headers: { 'idempotency-key': 'release-http-1' }, body: JSON.stringify(releasePayload),
  }, admin);
  assert.equal(released.response.status, 200);
  const releaseReplay = await request('/api/v1/stock/releases', {
    method: 'POST', headers: { 'idempotency-key': 'release-http-1' }, body: JSON.stringify(releasePayload),
  }, admin);
  assert.equal(releaseReplay.response.status, 200);
  assert.equal(releaseReplay.data.idempotentReplay, true);

  const secondRelease = await request('/api/v1/stock/releases', {
    method: 'POST', headers: { 'idempotency-key': 'release-http-2' }, body: JSON.stringify(releasePayload),
  }, admin);
  assert.equal(secondRelease.response.status, 409);
  assert.equal(secondRelease.data.error.code, 'ASSET_UNAVAILABLE');
  assert.equal(validateStockLedger(readDb(), 'company_northlight').valid, true);
});

test('un replay idempotent revalide le site et l’acteur sans divulguer le résultat antérieur', async () => {
  const planner = await login('planner@northlight.fr');
  const payload = {
    orderId: 'reservation_1', window: reservationWindow,
    lines: [{ stockItemId: 'stock_xlr', quantity: 1, locationId: 'location_paris_store', allocationId: 'secure-replay' }],
  };
  const first = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'secure-replay-key', origin: baseUrl }, body: JSON.stringify(payload),
  }, planner);
  assert.equal(first.response.status, 201);
  const priorMovementId = first.data.movements[0].id;

  const loseSite = readDb();
  loseSite.users.find(user => user.id === 'user_planner').siteIds = ['site_boulogne'];
  fs.writeFileSync(dataFile, `${JSON.stringify(loseSite, null, 2)}\n`, { mode: 0o600 });
  const siteReplay = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'secure-replay-key', origin: baseUrl }, body: JSON.stringify(payload),
  }, planner);
  assert.equal(siteReplay.response.status, 404);
  assert.equal(siteReplay.data.error.code, 'NOT_FOUND');
  assert.doesNotMatch(JSON.stringify(siteReplay.data), new RegExp(priorMovementId));

  const restoreSite = readDb();
  restoreSite.users.find(user => user.id === 'user_planner').siteIds = ['site_paris', 'site_boulogne'];
  fs.writeFileSync(dataFile, `${JSON.stringify(restoreSite, null, 2)}\n`, { mode: 0o600 });
  const allowedReplay = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'secure-replay-key', origin: baseUrl }, body: JSON.stringify(payload),
  }, planner);
  assert.equal(allowedReplay.response.status, 200);
  assert.equal(allowedReplay.data.idempotentReplay, true);

  const revokeActor = readDb();
  revokeActor.users.find(user => user.id === 'user_planner').active = false;
  fs.writeFileSync(dataFile, `${JSON.stringify(revokeActor, null, 2)}\n`, { mode: 0o600 });
  const actorReplay = await request('/api/v1/stock/allocations', {
    method: 'POST', headers: { 'idempotency-key': 'secure-replay-key', origin: baseUrl }, body: JSON.stringify(payload),
  }, planner);
  assert.equal(actorReplay.response.status, 401);
  assert.equal(actorReplay.data.error.code, 'AUTH_REQUIRED');
  assert.doesNotMatch(JSON.stringify(actorReplay.data), new RegExp(priorMovementId));

  const restoreActor = readDb();
  restoreActor.users.find(user => user.id === 'user_planner').active = true;
  fs.writeFileSync(dataFile, `${JSON.stringify(restoreActor, null, 2)}\n`, { mode: 0o600 });
});

test('la route publique adjustment reste absente', async () => {
  const result = await request('/api/v1/stock/adjustments', {
    method: 'POST', body: JSON.stringify({
      stockItemId: 'stock_xlr', locationId: 'location_paris_store', delta: 1, reason: 'Interdit lot 07a',
    }),
  }, admin);
  assert.equal(result.response.status, 404);
  assert.equal(result.data.error.code, 'NOT_FOUND');
});

test('RBAC viewer autorise la lecture et refuse toute mutation Stock/Maintenance', async () => {
  const list = await request('/api/v1/stock/items', {}, viewer);
  assert.equal(list.response.status, 200);
  const create = await request('/api/v1/stock/items', {
    method: 'POST', body: JSON.stringify({ name: 'Interdit', sku: 'DENIED', category: 'qa', trackingMode: 'quantity' }),
  }, viewer);
  assert.equal(create.response.status, 403);
  assert.equal(create.data.error.code, 'FORBIDDEN');
  const maintenance = await request('/api/v1/maintenance', {
    method: 'POST', body: JSON.stringify({ equipmentAssetId: 'asset_rec_1', reason: 'Interdit', version: 1 }),
  }, viewer);
  assert.equal(maintenance.response.status, 403);
});

test('HTTP maintenance valide versions, transitions available et quarantine', async () => {
  const stale = await request('/api/v1/maintenance', {
    method: 'POST', headers: { 'idempotency-key': 'maint-stale' },
    body: JSON.stringify({ equipmentAssetId: 'asset_rec_2', reason: 'QA', version: 99 }),
  }, admin);
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error.code, 'VERSION_CONFLICT');

  const opened = await request('/api/v1/maintenance', {
    method: 'POST', headers: { 'idempotency-key': 'maint-open-rec2' },
    body: JSON.stringify({ equipmentAssetId: 'asset_rec_2', reason: 'Contrôle QA', version: 1 }),
  }, admin);
  assert.equal(opened.response.status, 201);
  const complete = await request(`/api/v1/maintenance/${opened.data.id}/complete`, {
    method: 'POST', headers: { 'idempotency-key': 'maint-complete-rec2' },
    body: JSON.stringify({ resolution: 'RAS', condition: 'good', version: 1, assetVersion: 2 }),
  }, admin);
  assert.equal(complete.response.status, 200);
  assert.equal(complete.data.status, 'completed');

  const repeated = await request(`/api/v1/maintenance/${opened.data.id}/complete`, {
    method: 'POST', headers: { 'idempotency-key': 'maint-complete-rec2-other' },
    body: JSON.stringify({ resolution: 'Encore', condition: 'good', version: 2, assetVersion: 3 }),
  }, admin);
  assert.equal(repeated.response.status, 409);
  assert.equal(repeated.data.error.code, 'INVALID_MAINTENANCE_TRANSITION');

  const quarantineOpen = await request('/api/v1/maintenance', {
    method: 'POST', headers: { 'idempotency-key': 'maint-open-quarantine' },
    body: JSON.stringify({ equipmentAssetId: 'asset_lens_2', reason: 'Choc', version: 1 }),
  }, admin);
  assert.equal(quarantineOpen.response.status, 201);
  const quarantineClose = await request(`/api/v1/maintenance/${quarantineOpen.data.id}/complete`, {
    method: 'POST', headers: { 'idempotency-key': 'maint-close-quarantine' },
    body: JSON.stringify({ resolution: 'Non réparable', condition: 'damaged', version: 1, assetVersion: 2 }),
  }, admin);
  assert.equal(quarantineClose.response.status, 200);
  const assets = await request('/api/v1/equipment/assets?status=quarantine', {}, admin);
  assert.ok(assets.data.items.some(asset => asset.id === 'asset_lens_2' && asset.condition === 'damaged'));
});

test('audit et SSE sont émis après une mutation Stock réussie', async () => {
  const controller = new AbortController();
  const stream = await fetch(`${baseUrl}/api/v1/events`, {
    headers: { cookie: admin.cookie }, signal: controller.signal,
  });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  const connected = decoder.decode((await reader.read()).value);
  assert.match(connected, /connected/);

  const created = await request('/api/v1/stock/items', {
    method: 'POST', body: JSON.stringify({
      name: 'Article SSE QA', sku: 'SSE-QA-01', category: 'qa', trackingMode: 'quantity', unit: 'piece',
    }),
  }, admin);
  assert.equal(created.response.status, 201);

  const chunk = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE non reçu sous 2 s')), 2000)),
  ]);
  const event = decoder.decode(chunk.value);
  assert.match(event, /event: invalidation/);
  assert.match(event, /stockItem\.updated\.v1/);
  assert.match(event, new RegExp(created.data.id));
  controller.abort();

  const audit = await request('/api/v1/audit', {}, admin);
  assert.equal(audit.response.status, 200);
  const record = audit.data.items.find(item => item.entityId === created.data.id);
  assert.equal(record.action, 'stockItem.created');
  assert.equal(record.actorUserId, 'user_admin');
});

test('logout ferme immédiatement le flux SSE de la session', async () => {
  const session = await login('admin@northlight.fr');
  const stream = await fetch(`${baseUrl}/api/v1/events`, { headers: { cookie: session.cookie } });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /connected/);

  const logout = await request('/api/v1/auth/logout', {
    method: 'POST', headers: { origin: baseUrl }, body: JSON.stringify({}),
  }, session);
  assert.equal(logout.response.status, 204);
  const closed = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE encore ouvert après logout')), 1000)),
  ]);
  assert.equal(closed.done, true);
});

test('la révocation utilisateur ferme le flux SSE sans attendre un événement métier', async () => {
  const session = await login('planner@northlight.fr');
  const stream = await fetch(`${baseUrl}/api/v1/events`, { headers: { cookie: session.cookie } });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /connected/);

  const revoked = readDb();
  revoked.users.find(user => user.id === 'user_planner').active = false;
  fs.writeFileSync(dataFile, `${JSON.stringify(revoked, null, 2)}\n`, { mode: 0o600 });
  const closed = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE encore ouvert après révocation')), 1000)),
  ]);
  assert.equal(closed.done, true);

  const restored = readDb();
  restored.users.find(user => user.id === 'user_planner').active = true;
  fs.writeFileSync(dataFile, `${JSON.stringify(restored, null, 2)}\n`, { mode: 0o600 });
});
