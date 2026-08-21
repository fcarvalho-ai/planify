'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataFile = path.join(os.tmpdir(), `planify-equipment-assistant-${process.pid}-${Date.now()}.json`);
process.env.PLANIFY_DATA_FILE = dataFile;

const { createServer, resetData, makeSeed, readDb, validateStockLedger } = require('../server.js');

let server;
let baseUrl;
let admin;
let viewer;
let article;
let asset;

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
  const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) });
  assert.equal(result.response.status, 200);
  return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken };
}

before(async () => {
  resetData(makeSeed());
  server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  admin = await login('admin@northlight.fr');
  viewer = await login('viewer@northlight.fr');
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const filename of fs.readdirSync(path.dirname(dataFile))) if (filename.startsWith(path.basename(dataFile))) fs.rmSync(path.join(path.dirname(dataFile), filename), { force: true });
});

test('assistant local : « cam » propose des caméras illustrées et des fiches techniques', async () => {
  const result = await request('/api/v1/equipment/catalog/suggestions?q=cam&limit=8', {}, viewer);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.offline, true);
  assert.ok(result.data.items.length >= 6);
  assert.ok(result.data.items.every(item => item.category === 'camera'));
  assert.ok(result.data.items.every(item => item.photoUrl.startsWith('/assets/equipment/')));
  assert.ok(result.data.items.some(item => item.manufacturer === 'Canon'));
  assert.ok(result.data.items.some(item => item.manufacturer === 'Sony'));
  assert.ok(result.data.items.every(item => Object.keys(item.technicalSpecifications).length >= 5));

  const tooShort = await request('/api/v1/equipment/catalog/suggestions?q=c', {}, viewer);
  assert.equal(tooShort.response.status, 422);
  assert.equal(tooShort.data.error.code, 'QUERY_TOO_SHORT');
});

test('assistant enrichi : informatique, serveurs, Avid et licences sont compris avec leurs sources', async () => {
  for (const [query, expectedManufacturer, expectedCategory] of [
    ['lenovo', 'Lenovo', 'workstation'],
    ['hp montage', 'HP', 'workstation'],
    ['dell serveur', 'Dell', 'server'],
    ['avid stockage', 'Avid', 'storage'],
    ['licence adobe', 'Adobe', 'softwareLicense'],
    ['mail', 'Microsoft', 'emailLicense'],
  ]) {
    const result = await request(`/api/v1/equipment/catalog/suggestions?q=${encodeURIComponent(query)}&limit=12`, {}, viewer);
    assert.equal(result.response.status, 200, query);
    const suggestion = result.data.items.find(item => item.manufacturer === expectedManufacturer && item.category === expectedCategory);
    assert.ok(suggestion, `suggestion attendue pour ${query}`);
    assert.ok(suggestion.sourceUrl.startsWith('https://'));
    assert.ok(suggestion.matchReason);
  }

  for (const [photoPath, mime] of [
    ['/assets/equipment/photos/lenovo-thinkstation-p8.jpg', 'image/jpeg'],
    ['/assets/equipment/photos/hp-z8-fury.png', 'image/png'],
    ['/assets/equipment/photos/dell-precision-7875.png', 'image/png'],
    ['/assets/equipment/photos/avid-nexis-f2.jpg', 'image/jpeg'],
  ]) {
    const response = await fetch(`${baseUrl}${photoPath}`);
    assert.equal(response.status, 200, photoPath);
    assert.equal(response.headers.get('content-type'), mime);
    assert.ok((await response.arrayBuffer()).byteLength > 3000);
  }
});

test('création séquentielle : article assisté puis exemplaire avec série, numéro interne et coûts', async () => {
  const createdArticle = await request('/api/v1/stock/items', {
    method: 'POST',
    body: JSON.stringify({ catalogId: 'canon-c70', name: 'Canon EOS C70 — Location', sku: 'CAM-CAN-C70-LOC', category: 'camera', trackingMode: 'serialized', unit: 'piece', manufacturer: 'Canon', model: 'EOS C70', manufacturerReference: '4507C003', description: 'Fiche validée par le responsable matériel.', technicalSpecifications: { sensor: 'Super 35 DGO', mount: 'Canon RF' }, active: true }),
  }, admin);
  assert.equal(createdArticle.response.status, 201);
  article = createdArticle.data;
  assert.equal(article.catalogId, 'canon-c70');
  assert.equal(article.photoUrl, '/assets/equipment/camera.svg');
  assert.equal(article.manufacturer, 'Canon');
  assert.equal(article.technicalSpecifications.mount, 'Canon RF');

  const createdAsset = await request('/api/v1/equipment/assets', {
    method: 'POST',
    body: JSON.stringify({ stockItemId: article.id, serialNumber: 'C70-TEST-0001', internalCode: 'FAV-CAM-001', siteId: 'site_paris', stockLocationId: 'location_paris_store', condition: 'good', purchaseCostMinor: 499000, replacementValueMinor: 560000, dailyRentalPriceMinor: 29000, currency: 'EUR', purchaseDate: '2026-08-15', supplier: 'Fournisseur test', warrantyEndDate: '2028-08-15' }),
  }, admin);
  assert.equal(createdAsset.response.status, 201);
  asset = createdAsset.data;
  assert.equal(asset.internalCode, 'FAV-CAM-001');
  assert.equal(asset.purchaseCostMinor, 499000);
  assert.equal(asset.currency, 'EUR');

  const wrongCurrency = await request('/api/v1/equipment/assets', {
    method: 'POST',
    body: JSON.stringify({ stockItemId: article.id, serialNumber: 'C70-TEST-USD', internalCode: 'FAV-CAM-USD', siteId: 'site_paris', stockLocationId: 'location_paris_store', condition: 'good', currency: 'USD' }),
  }, admin);
  assert.equal(wrongCurrency.response.status, 422);
  assert.equal(wrongCurrency.data.error.code, 'CURRENCY_MISMATCH');

  const duplicate = await request('/api/v1/equipment/assets', {
    method: 'POST',
    body: JSON.stringify({ stockItemId: article.id, serialNumber: 'C70-TEST-0002', internalCode: 'FAV-CAM-001', siteId: 'site_paris', stockLocationId: 'location_paris_store', condition: 'good' }),
  }, admin);
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.data.error.code, 'INTERNAL_CODE_EXISTS');
});

test('RBAC : le lecteur consulte le catalogue mais ne crée ni n’installe de matériel', async () => {
  const create = await request('/api/v1/stock/items', { method: 'POST', body: JSON.stringify({}) }, viewer);
  assert.equal(create.response.status, 403);
  const assign = await request('/api/v1/resources/resource_3/equipment', { method: 'POST', body: JSON.stringify({}) }, viewer);
  assert.equal(assign.response.status, 403);
});

test('une salle reçoit un exemplaire du même site, le retire des candidats location puis permet sa dépose', async () => {
  const resources = await request('/api/v1/resources?active=true&pageSize=200', {}, admin);
  let room = resources.data.items.find(value => value.id === 'resource_3');
  assert.equal(room.type, 'room');

  const assigned = await request(`/api/v1/resources/${room.id}/equipment`, {
    method: 'POST',
    body: JSON.stringify({ assetId: asset.id, assetVersion: asset.version, roomVersion: room.version, reason: 'Installation dans la salle d’étalonnage' }),
  }, admin);
  assert.equal(assigned.response.status, 201);
  asset = assigned.data.asset;
  room = assigned.data.room;
  assert.equal(asset.assignedRoomId, room.id);
  assert.equal(asset.stockLocationId.startsWith('location_'), true);

  const projection = await request(`/api/v1/resources/${room.id}/equipment`, {}, admin);
  assert.equal(projection.response.status, 200);
  assert.equal(projection.data.items.length, 1);
  assert.equal(projection.data.items[0].stockItem.name, 'Canon EOS C70 — Location');

  const allocation = await request('/api/v1/stock/allocations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'installed-asset-not-rentable' },
    body: JSON.stringify({ orderId: 'reservation_1', window: { startsAt: '2026-08-17T07:00:00.000Z', endsAt: '2026-08-17T10:00:00.000Z' }, lines: [{ stockItemId: article.id, quantity: 1, siteId: 'site_paris', locationId: asset.stockLocationId, equipmentAssetIds: [asset.id], assetVersions: { [asset.id]: asset.version } }] }),
  }, admin);
  assert.equal(allocation.response.status, 409);
  assert.equal(allocation.data.error.code, 'STOCK_CONFLICT');

  const blockedDelete = await request(`/api/v1/resources/${room.id}`, { method: 'DELETE', body: JSON.stringify({ version: room.version }) }, admin);
  assert.equal(blockedDelete.response.status, 409);
  assert.equal(blockedDelete.data.error.code, 'ROOM_HAS_EQUIPMENT');

  const unassigned = await request(`/api/v1/resources/${room.id}/equipment/${asset.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ assetVersion: asset.version, roomVersion: room.version, destinationLocationId: 'location_paris_store', reason: 'Retour en réserve principale' }),
  }, admin);
  assert.equal(unassigned.response.status, 200);
  asset = unassigned.data.asset;
  assert.equal(asset.assignedRoomId, undefined);
  assert.equal(asset.stockLocationId, 'location_paris_store');
  assert.equal(validateStockLedger(readDb(), 'company_northlight').valid, true);
});

test('l’affectation d’un exemplaire d’un autre site est refusée sans fuite ni mouvement', async () => {
  const dbBefore = readDb();
  const movementCount = dbBefore.stockMovements.length;
  const boulogneAsset = dbBefore.equipmentAssets.find(value => value.id === 'asset_fx6_3');
  const room = dbBefore.resources.find(value => value.id === 'resource_3');
  const result = await request(`/api/v1/resources/${room.id}/equipment`, {
    method: 'POST',
    body: JSON.stringify({ assetId: boulogneAsset.id, assetVersion: boulogneAsset.version, roomVersion: room.version, reason: 'Tentative cross-site' }),
  }, admin);
  assert.equal(result.response.status, 409);
  assert.equal(result.data.error.code, 'SITE_MISMATCH');
  assert.equal(readDb().stockMovements.length, movementCount);
});
