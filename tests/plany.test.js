'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-plany-test-${process.pid}-${Date.now()}.json`);
const { createServer, resetData, makeSeed, readDb } = require('../server.js');

let server;
let baseUrl;
let admin;

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}
async function login() {
  const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }) });
  assert.equal(result.response.status, 200);
  return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken };
}
async function ask(message, key, context = {}, conversationId) {
  return request('/api/v1/plany/messages', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ message, context, ...(conversationId ? { conversationId } : {}) }) }, admin);
}

before(async () => {
  const seed = makeSeed();
  const conflictCapacity = seed.resources.find(value => value.id === 'resource_1').capacity;
  seed.reservations.push({ id: 'reservation_plany_conflict_a', companyId: 'company_northlight', siteId: 'site_paris', projectId: 'project_1', title: 'Conflit Plany A', startsAt: '2026-10-05T09:00:00.000Z', endsAt: '2026-10-05T12:00:00.000Z', status: 'confirmed', resources: [{ resourceId: 'resource_1', quantity: conflictCapacity }], planningMode: 'continuous', cellOverrides: [], version: 1 });
  seed.reservations.push({ id: 'reservation_plany_conflict_b', companyId: 'company_northlight', siteId: 'site_paris', projectId: 'project_2', title: 'Conflit Plany B', startsAt: '2026-10-05T10:00:00.000Z', endsAt: '2026-10-05T11:00:00.000Z', status: 'option', resources: [{ resourceId: 'resource_1', quantity: 1 }], planningMode: 'continuous', cellOverrides: [], version: 1 });
  seed.quotes = [{ id: 'quote_plany_client_planning', companyId: 'company_northlight', siteId: 'site_paris', projectId: 'project_1', number: 'DEV-PLANY-001', kind: 'quote', status: 'accepted', version: 1 }];
  resetData(seed); server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login();
});
after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); try { fs.unlinkSync(process.env.PLANIFY_DATA_FILE); } catch {} });

test('PlanyBot exige une authentification et la protection CSRF', async () => {
  const anonymous = await request('/api/v1/plany/messages', { method: 'POST', headers: { 'Idempotency-Key': 'anonymous' }, body: JSON.stringify({ message: 'Bonjour' }) });
  assert.equal(anonymous.response.status, 401);
  const noCsrf = await request('/api/v1/plany/messages', { method: 'POST', headers: { cookie: admin.cookie, 'Idempotency-Key': 'no-csrf', 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Bonjour' }) });
  assert.equal(noCsrf.response.status, 403);
});

test('PlanyBot répond à l’aide et conserve une conversation privée', async () => {
  const result = await ask('Bonjour PlanyBot', 'help-1');
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'help'); assert.match(result.data.assistantMessage, /salles libres/i);
  const history = await request(`/api/v1/plany/conversations/${result.data.conversationId}/messages`, {}, admin);
  assert.equal(history.response.status, 200); assert.equal(history.data.items.length, 2); assert.deepEqual(history.data.items.map(value => value.role), ['user', 'assistant']);
});

test('la recherche de disponibilité ne modifie aucune réservation', async () => {
  const before = readDb().reservations.length;
  const result = await ask('Quelles salles de montage sont libres du 06/10/2026 au 07/10/2026 ?', 'availability-1', { siteId: 'site_paris' });
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'availability'); assert.equal(result.data.facts.from, '2026-10-06'); assert.ok(result.data.facts.resources.every(value => value.siteId === 'site_paris'));
  assert.equal(readDb().reservations.length, before);
});

test('le résumé utilise uniquement le projet accessible du contexte', async () => {
  const result = await ask('Résume le projet actif', 'summary-1', { projectId: 'project_1' });
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'projectSummary'); assert.equal(result.data.facts.project.id, 'project_1'); assert.ok(Number.isInteger(result.data.facts.reservationCount));
  const foreign = await ask('Résume le projet actif', 'summary-foreign', { projectId: 'project_inconnu' });
  assert.equal(foreign.response.status, 404); assert.equal(foreign.data.error.code, 'NOT_FOUND');
});

test('PlanyBot détecte un chevauchement visible sans l’arbitrer', async () => {
  const result = await ask('Y a-t-il des conflits ?', 'conflicts-1', { siteId: 'site_paris' });
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'conflicts'); assert.ok(result.data.facts.count >= 1); assert.ok(result.data.facts.conflicts.some(value => value.reservationIds.includes('reservation_plany_conflict_a')));
  assert.deepEqual(result.data.actions, []);
});

test('une demande de réservation produit seulement un préremplissage', async () => {
  const before = readDb().reservations.length;
  const result = await ask('Prépare une salle de montage du 12/10/2026 au 14/10/2026', 'draft-1', { projectId: 'project_1', siteId: 'site_paris' });
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'bookingDraft'); assert.equal(result.data.actions[0].type, 'prepareBooking'); assert.equal(result.data.actions[0].startDate, '2026-10-12'); assert.equal(result.data.actions[0].endDate, '2026-10-14');
  assert.equal(readDb().reservations.length, before);
});

test('PlanyBot accompagne les phases du planning client sans mutation', async () => {
  const before = readDb().reservations.length;
  const upload = await ask('Que va-t-il se passer ?', 'client-guide-upload', { workflow: 'clientPlanning', phase: 'upload', quoteId: 'quote_plany_client_planning' });
  assert.equal(upload.response.status, 201); assert.equal(upload.data.intent, 'clientPlanningGuide'); assert.match(upload.data.assistantMessage, /Excel, CSV ou PDF/i);
  const confirmation = await ask('Puis-je confirmer ?', 'client-guide-confirm', { workflow: 'clientPlanning', phase: 'confirmation', quoteId: 'quote_plany_client_planning' });
  assert.equal(confirmation.response.status, 201); assert.match(confirmation.data.assistantMessage, /confirmation explicite/i);
  const foreign = await ask('Explique', 'client-guide-foreign', { workflow: 'clientPlanning', phase: 'compare', quoteId: 'quote_inconnue' });
  assert.equal(foreign.response.status, 404); assert.equal(readDb().reservations.length, before);
});

test('le replay idempotent ne double pas les messages et un autre corps est refusé', async () => {
  const first = await ask('Bonjour encore', 'replay-1'); assert.equal(first.response.status, 201); const count = readDb().planyMessages.length;
  const replay = await ask('Bonjour encore', 'replay-1'); assert.equal(replay.response.status, 201); assert.equal(replay.data.conversationId, first.data.conversationId); assert.equal(readDb().planyMessages.length, count);
  const conflict = await ask('Un autre message', 'replay-1'); assert.equal(conflict.response.status, 409); assert.equal(conflict.data.error.code, 'IDEMPOTENCY_CONFLICT');
});

test('l’interface annonce PlanyBot et le contrôle humain sans mutation directe', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(source, /PlanyBot prépare, vous confirmez/); assert.match(source, /data-plany-prompt/); assert.match(source, /action\.type!=='prepareBooking'/);
  assert.match(source, /Guide de l’analyse du planning client/); assert.match(source, /workflow:'clientPlanning'/);
  assert.match(source, /rooms=planningDomain==='postProduction'\?state\.resources\.filter/, 'le formulaire doit conserver toutes les salles éligibles même lorsqu’une vue Projet est vide');
  const planyBlock = source.slice(source.indexOf('const plany=')); assert.doesNotMatch(planyBlock, /api\('\/api\/v1\/reservations',\{method:'POST'/);
});
