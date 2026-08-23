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
let viewer;

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const text = await response.text(); let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}
async function login(email = 'admin@northlight.fr') {
  const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) });
  assert.equal(result.response.status, 200);
  return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken };
}
async function ask(message, key, context = {}, conversationId, actor = admin) {
  return request('/api/v1/plany/messages', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ message, context, ...(conversationId ? { conversationId } : {}) }) }, actor);
}

before(async () => {
  const seed = makeSeed();
  const timestamp = '2026-08-23T08:00:00.000Z'; seed.rateCards ||= []; seed.rates ||= []; seed.rateCards.push({ id: 'rateCard_plany_client', companyId: 'company_northlight', clientId: 'client_1', scope: 'client', name: 'Préférences commerciales PlanyBot', active: true, version: 1, createdAt: timestamp, updatedAt: timestamp }); seed.rates.push({ id: 'rate_plany_client_resource_4', companyId: 'company_northlight', clientId: 'client_1', rateCardId: 'rateCard_plany_client', scope: 'client', sourceType: 'resource', sourceId: 'resource_4', unit: 'jour', costUnitMinor: '19000', saleUnitMinor: '42000', active: true, version: 1, createdAt: timestamp, updatedAt: timestamp });
  const conflictCapacity = seed.resources.find(value => value.id === 'resource_1').capacity;
  seed.reservations.push({ id: 'reservation_plany_conflict_a', companyId: 'company_northlight', siteId: 'site_paris', projectId: 'project_1', title: 'Conflit Plany A', startsAt: '2026-10-05T09:00:00.000Z', endsAt: '2026-10-05T12:00:00.000Z', status: 'confirmed', resources: [{ resourceId: 'resource_1', quantity: conflictCapacity }], planningMode: 'continuous', cellOverrides: [], version: 1 });
  seed.reservations.push({ id: 'reservation_plany_conflict_b', companyId: 'company_northlight', siteId: 'site_paris', projectId: 'project_2', title: 'Conflit Plany B', startsAt: '2026-10-05T10:00:00.000Z', endsAt: '2026-10-05T11:00:00.000Z', status: 'option', resources: [{ resourceId: 'resource_1', quantity: 1 }], planningMode: 'continuous', cellOverrides: [], version: 1 });
  const boulogneResource = seed.resources.find(value => value.siteId === 'site_boulogne');
  seed.reservations.push({ id: 'reservation_plany_boulogne', companyId: 'company_northlight', siteId: 'site_boulogne', projectId: 'project_1', title: 'Résumé multisite Plany', startsAt: '2026-10-08T09:00:00.000Z', endsAt: '2026-10-08T12:00:00.000Z', status: 'confirmed', resources: [{ resourceId: boulogneResource.id, quantity: 1 }], planningMode: 'continuous', cellOverrides: [], version: 1 });
  seed.quotes = [{ id: 'quote_plany_client_planning', companyId: 'company_northlight', siteId: 'site_paris', projectId: 'project_1', number: 'DEV-PLANY-001', kind: 'quote', status: 'accepted', version: 1 }];
  resetData(seed); server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login(); viewer = await login('viewer@northlight.fr');
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
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'availability'); assert.equal(result.data.facts.from, '2026-10-06'); assert.ok(result.data.facts.resources.every(value => value.siteId === 'site_paris')); assert.deepEqual(result.data.facts.ranking, ['availability', 'continuity', 'clientPreference', 'projectSite', 'configuredCost', 'stableNameAndId']); assert.ok(result.data.facts.resources.every(value => value.reasons.includes('Disponible sur toute la période')));
  assert.equal(readDb().reservations.length, before);
});

test('le classement ne révèle pas le coût interne à un lecteur sans finance.read', async () => {
  const result = await ask('Quelles salles de montage sont libres du 06/10/2026 au 07/10/2026 ?', 'availability-viewer-cost', { projectId: 'project_1', siteId: 'site_paris' }, undefined, viewer);
  assert.equal(result.response.status, 201); const preferred = result.data.facts.resources.find(value => value.id === 'resource_4'); assert.equal(preferred.clientPreference, true); assert.equal(Object.hasOwn(preferred, 'configuredCost'), false); assert.ok(!preferred.reasons.some(reason => reason.includes('Coût interne')));
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

test('une demande de réservation produit une proposition persistée sans mutation', async () => {
  const before = readDb().reservations.length;
  const result = await ask('Prépare une salle de montage du 12/10/2026 au 14/10/2026', 'draft-1', { projectId: 'project_1', siteId: 'site_paris' });
  assert.equal(result.response.status, 201); assert.equal(result.data.intent, 'bookingDraft'); assert.equal(result.data.actions[0].type, 'confirmProposal'); assert.ok(result.data.actions[0].proposalId); assert.ok(result.data.actions[0].proposalDigest); assert.equal(result.data.actions[0].preview.projectName, 'Horizons — Saison 2'); assert.ok(result.data.facts.recommendations[0].reasons.length >= 2); const preferred = result.data.facts.recommendations.find(value => value.id === 'resource_4'); assert.equal(preferred.clientPreference, true); assert.ok(preferred.reasons.includes('Tarif dédié actif pour ce client')); assert.equal(Object.hasOwn(preferred, 'configuredCost'), false);
  const proposal = await request(`/api/v1/plany/proposals/${result.data.actions[0].proposalId}`, {}, admin); assert.equal(proposal.response.status, 200); assert.equal(proposal.data.status, 'prepared'); assert.equal(proposal.data.command.status, 'option');
  const hidden = await request(`/api/v1/plany/proposals/${result.data.actions[0].proposalId}`, {}, viewer); assert.equal(hidden.response.status, 404);
  assert.equal(readDb().reservations.length, before);
});

test('seule une confirmation explicite valide crée la réservation et le rejeu reste unique', async () => {
  const prepared = await ask('Prépare une salle de montage du 20/10/2026 au 21/10/2026', 'proposal-confirm-prepare', { projectId: 'project_1', siteId: 'site_paris' }), action = prepared.data.actions[0], before = readDb().reservations.length;
  const wrong = await request(`/api/v1/plany/proposals/${action.proposalId}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'proposal-confirm-wrong' }, body: JSON.stringify({ proposalDigest: 'digest-invalide' }) }, admin); assert.equal(wrong.response.status, 409); assert.equal(wrong.data.error.code, 'PLANY_PROPOSAL_CHANGED'); assert.equal(readDb().reservations.length, before);
  const confirmed = await request(`/api/v1/plany/proposals/${action.proposalId}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'proposal-confirm-once' }, body: JSON.stringify({ proposalDigest: action.proposalDigest }) }, admin); assert.equal(confirmed.response.status, 201, JSON.stringify(confirmed.data)); assert.equal(confirmed.data.proposal.status, 'executed'); assert.equal(confirmed.data.reservation.projectId, 'project_1'); assert.equal(readDb().reservations.length, before + 1);
  const audits = readDb().auditEvents.filter(value => value.action === 'plany.proposalExecuted' && value.entityId === action.proposalId); assert.equal(audits.length, 1);
  const replay = await request(`/api/v1/plany/proposals/${action.proposalId}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'proposal-confirm-once' }, body: JSON.stringify({ proposalDigest: action.proposalDigest }) }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.reservation.id, confirmed.data.reservation.id); assert.equal(readDb().reservations.length, before + 1); assert.equal(readDb().auditEvents.filter(value => value.action === 'plany.proposalExecuted' && value.entityId === action.proposalId).length, 1);
  const divergent = await request(`/api/v1/plany/proposals/${action.proposalId}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'proposal-confirm-once' }, body: JSON.stringify({ proposalDigest: `${action.proposalDigest}0` }) }, admin); assert.equal(divergent.response.status, 409); assert.equal(divergent.data.error.code, 'IDEMPOTENCY_CONFLICT'); assert.equal(readDb().reservations.length, before + 1);
});

test('un lecteur peut consulter mais pas confirmer une proposition et un refus ne crée rien', async () => {
  const prepared = await request('/api/v1/plany/messages', { method: 'POST', headers: { 'Idempotency-Key': 'viewer-proposal-prepare' }, body: JSON.stringify({ message: 'Prépare une salle de montage le 22/10/2026', context: { projectId: 'project_1', siteId: 'site_paris' } }) }, viewer), action = prepared.data.actions[0], before = readDb().reservations.length;
  const denied = await request(`/api/v1/plany/proposals/${action.proposalId}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'viewer-proposal-confirm' }, body: JSON.stringify({ proposalDigest: action.proposalDigest }) }, viewer); assert.equal(denied.response.status, 403); assert.equal(readDb().reservations.length, before);
  const rejected = await request(`/api/v1/plany/proposals/${action.proposalId}/reject`, { method: 'POST', headers: { 'Idempotency-Key': 'viewer-proposal-reject' }, body: JSON.stringify({ reason: 'Période à revoir' }) }, viewer); assert.equal(rejected.response.status, 200); assert.equal(rejected.data.proposal.status, 'rejected'); assert.equal(readDb().reservations.length, before);
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

test('le replay et l’historique revalident les projets inférés après réduction des scopes', async () => {
  const first = await ask('Résume Horizons — Saison 2', 'inferred-project-scope', {}, undefined, viewer); assert.equal(first.response.status, 201); assert.equal(first.data.facts.project.id, 'project_1');
  const visible = await request(`/api/v1/plany/conversations/${first.data.conversationId}/messages`, {}, viewer); assert.equal(visible.response.status, 200); assert.ok(visible.data.items.some(item => item.facts?.project?.id === 'project_1'));
  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin), membership = memberships.data.items.find(item => item.userId === 'user_viewer'); assert.ok(membership);
  const reduced = await request(`/api/v1/memberships/${membership.id}/scopes`, { method: 'PUT', headers: { 'Idempotency-Key': 'plany-inferred-scope-reduction' }, body: JSON.stringify({ version: membership.version, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], projectIds: ['project_2'], entityScopes: {} }) }, admin); assert.equal(reduced.response.status, 200);
  const replay = await ask('Résume Horizons — Saison 2', 'inferred-project-scope', {}, undefined, viewer); assert.equal(replay.response.status, 404); assert.equal(replay.data.error.code, 'NOT_FOUND');
  const hidden = await request(`/api/v1/plany/conversations/${first.data.conversationId}/messages`, {}, viewer); assert.equal(hidden.response.status, 404); assert.equal(hidden.data.error.code, 'NOT_FOUND');
});

test('les réponses PlanyBot revalident les permissions commerciales et les sources des agrégats', async () => {
  let memberships = await request('/api/v1/memberships?pageSize=200', {}, admin), membership = memberships.data.items.find(item => item.userId === 'user_viewer'); assert.ok(membership);
  const restored = await request(`/api/v1/memberships/${membership.id}/scopes`, { method: 'PUT', headers: { 'Idempotency-Key': 'plany-source-scope-restore' }, body: JSON.stringify({ version: membership.version, scope: 'sites', siteIds: ['site_paris', 'site_boulogne'], organizationUnitIds: [], projectIds: ['project_1'], entityScopes: {} }) }, admin); assert.equal(restored.response.status, 200);
  const multiSiteSummary = await ask('Résume le projet actif', 'plany-multisite-summary', { projectId: 'project_1' }, undefined, viewer); assert.equal(multiSiteSummary.response.status, 201); assert.ok(multiSiteSummary.data.assistant.access.scopeGuards.site.length); assert.ok(multiSiteSummary.data.facts.reservationCount >= 2);
  const narrowedSites = await request(`/api/v1/memberships/${membership.id}/scopes`, { method: 'PUT', headers: { 'Idempotency-Key': 'plany-site-source-reduction' }, body: JSON.stringify({ version: restored.data.version, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], projectIds: ['project_1'], entityScopes: {} }) }, admin); assert.equal(narrowedSites.response.status, 200);
  const multiSiteReplay = await ask('Résume le projet actif', 'plany-multisite-summary', { projectId: 'project_1' }, undefined, viewer); assert.equal(multiSiteReplay.response.status, 404); assert.equal((await request(`/api/v1/plany/conversations/${multiSiteSummary.data.conversationId}/messages`, {}, viewer)).response.status, 404);
  const commercial = await ask('Explique le planning client', 'plany-quote-permission', { workflow: 'clientPlanning', phase: 'compare', quoteId: 'quote_plany_client_planning' }, undefined, viewer); assert.equal(commercial.response.status, 201); assert.ok(commercial.data.assistant.access.requiredPermissions.includes('quote.read'));
  const commercialHistory = await request(`/api/v1/plany/conversations/${commercial.data.conversationId}/messages`, {}, viewer); assert.equal(commercialHistory.response.status, 200);
  const recommendation = await ask('Quelles salles de montage sont libres du 06/10/2026 au 07/10/2026 ?', 'plany-recommendation-sources', { projectId: 'project_1', siteId: 'site_paris' }, undefined, viewer); assert.equal(recommendation.response.status, 201); assert.ok(recommendation.data.assistant.access.requiredPermissions.includes('quote.read')); assert.ok(recommendation.data.assistant.access.scopeGuards.reservation.length); assert.ok(recommendation.data.assistant.access.scopeGuards.resource.length);
  const summary = await ask('Résume le projet actif', 'plany-summary-sources', { projectId: 'project_1', siteId: 'site_paris' }, undefined, viewer); assert.equal(summary.response.status, 201); assert.ok(summary.data.assistant.access.scopeGuards.reservation.length); assert.ok(summary.data.assistant.access.scopeGuards.resource.length); assert.ok(JSON.stringify(summary.data.assistant.access).length < 2000);
  const planningRole = await request('/api/v1/roles', { method: 'POST', headers: { 'Idempotency-Key': 'plany-planning-only-role' }, body: JSON.stringify({ code: 'planyPlanningOnly', name: 'Planning sans devis', permissions: ['planning.read'] }) }, admin); assert.equal(planningRole.response.status, 201);
  const assigned = await request(`/api/v1/memberships/${membership.id}/roles`, { method: 'PUT', headers: { 'Idempotency-Key': 'plany-remove-quote-read' }, body: JSON.stringify({ version: narrowedSites.data.version, roleIds: [planningRole.data.id] }) }, admin); assert.equal(assigned.response.status, 200);
  const commercialReplay = await ask('Explique le planning client', 'plany-quote-permission', { workflow: 'clientPlanning', phase: 'compare', quoteId: 'quote_plany_client_planning' }, undefined, viewer); assert.equal(commercialReplay.response.status, 404); assert.equal((await request(`/api/v1/plany/conversations/${commercial.data.conversationId}/messages`, {}, viewer)).response.status, 404);
  const recommendationReplay = await ask('Quelles salles de montage sont libres du 06/10/2026 au 07/10/2026 ?', 'plany-recommendation-sources', { projectId: 'project_1', siteId: 'site_paris' }, undefined, viewer); assert.equal(recommendationReplay.response.status, 404); assert.equal((await request(`/api/v1/plany/conversations/${recommendation.data.conversationId}/messages`, {}, viewer)).response.status, 404);
  const restricted = await request(`/api/v1/memberships/${membership.id}/scopes`, { method: 'PUT', headers: { 'Idempotency-Key': 'plany-summary-source-reduction' }, body: JSON.stringify({ version: assigned.data.version, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], projectIds: ['project_1'], entityScopes: { reservation: [], resource: [] } }) }, admin); assert.equal(restricted.response.status, 200);
  const summaryReplay = await ask('Résume le projet actif', 'plany-summary-sources', { projectId: 'project_1', siteId: 'site_paris' }, undefined, viewer); assert.equal(summaryReplay.response.status, 404); assert.equal((await request(`/api/v1/plany/conversations/${summary.data.conversationId}/messages`, {}, viewer)).response.status, 404);
});

test('l’interface annonce PlanyBot et le contrôle humain sans mutation directe', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(source, /PlanyBot prépare, vous confirmez/); assert.match(source, /data-plany-prompt/); assert.match(source, /data-plany-confirm/); assert.match(source, /Confirmer et créer/);
  assert.match(source, /Guide de l’analyse du planning client/); assert.match(source, /workflow:'clientPlanning'/);
  assert.match(source, /proposalKeys\[`confirm:\$\{proposalId\}`\]/, 'la clé de confirmation doit rester stable pendant un retry UI');
  assert.match(source, /rooms=planningDomain==='postProduction'\?state\.resources\.filter/, 'le formulaire doit conserver toutes les salles éligibles même lorsqu’une vue Projet est vide');
  const planyBlock = source.slice(source.indexOf('const plany=')); assert.doesNotMatch(planyBlock, /api\('\/api\/v1\/reservations',\{method:'POST'/); assert.match(planyBlock, /\/plany\/proposals\/\$\{encodeURIComponent\(proposalId\)\}\/confirm/);
  assert.match(contract, /\/plany\/conversations\/\{conversationId\}\/messages:/);
  for(const template of ['/quotes/{quoteId}/client-planning/analyze','/quotes/{quoteId}/client-planning/apply-lines','/quotes/{quoteId}/planning-conversion/preview','/quotes/{quoteId}/planning-conversion']){const start=contract.indexOf(`  ${template}:`),next=contract.indexOf('\n  /',start+3),block=contract.slice(start,next<0?contract.length:next);assert.ok(start>=0,`${template} doit être documenté`);assert.match(block,/name: quoteId, in: path, required: true/,`${template} doit déclarer quoteId comme paramètre de chemin requis`)}
});
