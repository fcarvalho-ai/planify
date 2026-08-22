'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(
  os.tmpdir(),
  `planify-api-test-${process.pid}-${Date.now()}.json`,
);

const { createServer, resetData, makeSeed, readDb, personnelSnapshotAllowed, ssePermissionsForEvent, sseScopeAllowed } = require('../server.js');

let server;
let baseUrl;
let admin;
let viewer;
let planner;
let parisPlanner;
let created;
let reservationOperation = 0;
let mutationOperation = 0;

async function request(route, options = {}, auth) {
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (route === '/api/v1/reservations' && options.method === 'POST' && !headers['Idempotency-Key'] && !headers['idempotency-key']) headers['Idempotency-Key'] = `api-reservation-${++reservationOperation}`;
  if (['PUT', 'PATCH', 'DELETE'].includes(options.method) && !headers['Idempotency-Key'] && !headers['idempotency-key']) headers['Idempotency-Key'] = `api-mutation-${++mutationOperation}`;
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}

async function login(email) {
  const { response, data } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'demo2026' }),
  });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  return { cookie: setCookie.split(';', 1)[0], csrf: data.csrfToken, user: data.user, setCookie };
}

before(async () => {
  const seed = makeSeed();
  seed.users.find(({ id }) => id === 'user_viewer').siteIds = ['site_paris'];
  const plannerSeed = seed.users.find(({ id }) => id === 'user_planner');
  seed.users.push({ ...plannerSeed, id: 'user_paris_planner', email: 'paris.planner@northlight.fr', displayName: 'Planner Paris', siteIds: ['site_paris'] });
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
});

test('une route API protégée refuse un appel non authentifié', async () => {
  const { response, data } = await request('/api/v1/reservations');
  assert.equal(response.status, 401);
  assert.equal(data.error.code, 'AUTH_REQUIRED');
  assert.ok(data.error.error_id);
  assert.ok(data.error.requestId);
  assert.equal(data.error.error_id, data.error.requestId);
});

test('login émet cookie de session défensif et jeton CSRF', async () => {
  admin = await login('admin@northlight.fr');
  planner = await login('planner@northlight.fr');
  parisPlanner = await login('paris.planner@northlight.fr');
  viewer = await login('viewer@northlight.fr');
  assert.match(admin.setCookie, /HttpOnly/i);
  assert.match(admin.setCookie, /SameSite=Lax/i);
  assert.ok(admin.csrf);
  assert.equal(admin.user.role, 'admin');

  const me = await request('/api/v1/auth/me', {}, admin);
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.email, 'admin@northlight.fr');
});

test('Sprint 5 persistance : marqueur intègre et sauvegarde locale privée', () => {
  const db = JSON.parse(fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'));
  for (const migrationId of ['sprint-5-advanced-resources-v1', 'sprint-5-personnel-v1']) {
    const marker = db.migrations.find(value => value.id === migrationId);
    assert.ok(marker?.integrityDigest); assert.match(marker.sourceDigest, /^[a-f0-9]{64}$/);
    const backup = path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile), mode = fs.statSync(backup).mode & 0o777;
    assert.equal(mode, 0o600); assert.equal(fs.existsSync(backup), true);
  }
});

test('Sprint 5 présence : verrou court, scopes, renouvellement et libération', async () => {
  const made = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({
    title: 'S5 présence', siteId: 'site_paris', projectId: 'project_1', status: 'draft',
    startsAt: '2028-02-10T08:00:00.000Z', endsAt: '2028-02-10T09:00:00.000Z',
    resources: [{ resourceId: 'resource_11', quantity: 1 }], timeGranularity: 'hour', snapMinutes: 30,
  }) }, admin);
  assert.equal(made.response.status, 201);
  const acquired = await request(`/api/v1/reservations/${made.data.id}/presence`, { method: 'PUT', body: JSON.stringify({ version: made.data.version, intent: 'editing' }) }, admin);
  assert.equal(acquired.response.status, 200);
  assert.equal(acquired.data.actorUserId, admin.user.id);
  assert.equal(acquired.data.intent, 'editing');
  assert.ok(Date.parse(acquired.data.expiresAt) > Date.now());

  const visible = await request('/api/v1/planning/presence?siteId=site_paris', {}, planner);
  assert.equal(visible.response.status, 200);
  assert.equal(visible.data.items.some(item => item.reservationId === made.data.id && item.actorDisplayName), true);
  const blocked = await request(`/api/v1/reservations/${made.data.id}/presence`, { method: 'PUT', body: JSON.stringify({ version: made.data.version, intent: 'moving' }) }, planner);
  assert.equal(blocked.response.status, 423);
  assert.equal(blocked.data.error.code, 'RESERVATION_LOCKED');

  const renewed = await request(`/api/v1/reservations/${made.data.id}/presence`, { method: 'PUT', body: JSON.stringify({ version: made.data.version, intent: 'resizing' }) }, admin);
  assert.equal(renewed.response.status, 200);
  assert.equal(renewed.data.acquiredAt, acquired.data.acquiredAt);
  assert.equal(renewed.data.intent, 'resizing');

  const released = await request(`/api/v1/reservations/${made.data.id}/presence`, { method: 'DELETE' }, admin);
  assert.equal(released.response.status, 204);
  const afterRelease = await request('/api/v1/planning/presence?siteId=site_paris', {}, planner);
  assert.equal(afterRelease.data.items.some(item => item.reservationId === made.data.id), false);
  const viewerMutation = await request(`/api/v1/reservations/${made.data.id}/presence`, { method: 'PUT', body: JSON.stringify({ version: made.data.version, intent: 'editing' }) }, viewer);
  assert.equal(viewerMutation.response.status, 403);
});

test('Sprint 5 double option : priorité déterministe et perdant conservé avec alerte', async () => {
  const base = { title: 'S5 double option', siteId: 'site_paris', projectId: 'project_1', status: 'option', startsAt: '2029-04-10T08:00:00.000Z', endsAt: '2029-04-10T10:00:00.000Z', resources: [{ resourceId: 'resource_11', quantity: 1 }], optionGroupId: 'option-group-s5', optionExpiresAt: '2029-04-01T12:00:00.000Z' };
  const first = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...base, title: 'Option prioritaire', optionPriority: 1 }) }, admin);
  const second = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...base, title: 'Option secondaire', optionPriority: 2 }) }, admin);
  assert.equal(first.response.status, 201); assert.equal(second.response.status, 201);
  const blocked = await request(`/api/v1/reservations/${second.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: second.data.version, status: 'confirmed' }) }, admin);
  assert.equal(blocked.response.status, 409); assert.equal(blocked.data.error.code, 'OPTION_PRIORITY_BLOCKED');
  const won = await request(`/api/v1/reservations/${first.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: first.data.version, status: 'confirmed' }) }, admin);
  assert.equal(won.response.status, 200); assert.equal(won.data.status, 'confirmed'); assert.equal(won.data.optionDecision.state, 'won');
  const loser = await request(`/api/v1/reservations/${second.data.id}`, {}, admin);
  assert.equal(loser.response.status, 200); assert.equal(loser.data.status, 'option'); assert.equal(loser.data.optionDecision.state, 'lost'); assert.equal(loser.data.optionDecision.winnerReservationId, first.data.id);
  assert.equal(Array.isArray(loser.data.optionDecision.alternatives), true);
});

test('Sprint 5 option simple : confirmer une option sans groupe ne décide aucune autre option', async () => {
  const common = { siteId: 'site_paris', projectId: 'project_1', status: 'option', startsAt: '2029-04-12T08:00:00.000Z', endsAt: '2029-04-12T10:00:00.000Z' };
  const first = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...common, title: 'Option simple A', resources: [{ resourceId: 'resource_12', quantity: 1 }] }) }, admin);
  const independent = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...common, title: 'Option simple B', resources: [{ resourceId: 'resource_13', quantity: 1 }] }) }, admin);
  assert.equal(first.response.status, 201); assert.equal(independent.response.status, 201);
  const confirmed = await request(`/api/v1/reservations/${first.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: first.data.version, status: 'confirmed' }) }, admin);
  assert.equal(confirmed.response.status, 200); assert.equal(confirmed.data.status, 'confirmed'); assert.equal(confirmed.data.optionDecision, undefined);
  const untouched = await request(`/api/v1/reservations/${independent.data.id}`, {}, admin);
  assert.equal(untouched.response.status, 200); assert.equal(untouched.data.status, 'option'); assert.equal(untouched.data.version, independent.data.version); assert.equal(untouched.data.optionDecision, undefined);
});

test('Sprint 5 SSE et personnel : permissions fermées et site de l’indisponibilité respecté', () => {
  assert.deepEqual(ssePermissionsForEvent('reservation.updated.v1'), ['planning.read']);
  assert.deepEqual(ssePermissionsForEvent('resource.updated.v1'), ['resource.read']);
  assert.deepEqual(ssePermissionsForEvent('familleInconnue.updated.v1'), []);
  const db = readDb(), membership = db.organizationMemberships.find(value => value.userId === 'user_planner' && value.companyId === 'company_northlight');
  const scopedAuth = { user: { companyId: 'company_northlight', organizationScope: false, siteIds: ['site_paris'], organizationUnitIds: [], entityScopes: {} } };
  const snapshot = { companyId: 'company_northlight', membershipId: membership.id, siteId: 'site_boulogne' };
  assert.equal(personnelSnapshotAllowed(db, scopedAuth, snapshot), false);
  assert.equal(sseScopeAllowed(scopedAuth, 'personUnavailability.updated.v1', snapshot, db), false);
});

test('Sprint 5 ressource générique : catégorie puis affectation réelle traçable', async () => {
  const resources = await request('/api/v1/resources?siteId=site_paris', {}, admin), target = resources.data.items.find(item => item.id === 'resource_11');
  assert.ok(target?.resourceCategoryId);
  const made = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Salle à définir', siteId: 'site_paris', projectId: 'project_1', status: 'draft', startsAt: '2029-05-10T08:00:00.000Z', endsAt: '2029-05-10T10:00:00.000Z', resources: [{ generic: true, resourceCategoryId: target.resourceCategoryId, quantity: 1 }] }) }, admin);
  assert.equal(made.response.status, 201); assert.equal(made.data.resources[0].generic, true); assert.ok(made.data.resources[0].genericAllocationId);
  const assignmentBody = { version: made.data.version, genericAllocationId: made.data.resources[0].genericAllocationId, resourceId: target.id };
  const assigned = await request(`/api/v1/reservations/${made.data.id}/generic-assignments`, { method: 'POST', headers: { 'Idempotency-Key': 's5-generic-replay' }, body: JSON.stringify(assignmentBody) }, admin);
  assert.equal(assigned.response.status, 200); assert.equal(assigned.data.resources[0].resourceId, target.id); assert.equal(assigned.data.resources[0].genericAllocationId, made.data.resources[0].genericAllocationId); assert.equal(assigned.data.resources[0].generic, undefined);
  const replay = await request(`/api/v1/reservations/${made.data.id}/generic-assignments`, { method: 'POST', headers: { 'Idempotency-Key': 's5-generic-replay' }, body: JSON.stringify(assignmentBody) }, admin);
  assert.equal(replay.response.status, 200); assert.equal(replay.data.version, assigned.data.version);
});

test('Sprint 5 personnel : compétences, indisponibilités et filtrage PlanyBot', async () => {
  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin), person = memberships.data.items.find(item => item.userId === 'user_planner');
  assert.ok(person?.id);
  const skillBody = { membershipId: person.id, code: 'EDITING', name: 'Montage Avid', level: 4 };
  const skill = await request('/api/v1/person-skills', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-skill' }, body: JSON.stringify(skillBody) }, admin);
  assert.equal(skill.response.status, 201); assert.equal(skill.data.level, 4);
  const skillReplay = await request('/api/v1/person-skills', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-skill' }, body: JSON.stringify(skillBody) }, admin);
  assert.equal(skillReplay.response.status, 200); assert.equal(skillReplay.data.id, skill.data.id);
  const skillConflict = await request('/api/v1/person-skills', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-skill' }, body: JSON.stringify({ ...skillBody, level: 5 }) }, admin);
  assert.equal(skillConflict.response.status, 409); assert.equal(skillConflict.data.error.code, 'IDEMPOTENCY_CONFLICT');
  const listed = await request(`/api/v1/person-skills?membershipId=${encodeURIComponent(person.id)}`, {}, planner);
  assert.equal(listed.response.status, 200); assert.equal(listed.data.items.some(item => item.code === 'EDITING'), true);
  const available = await request('/api/v1/plany/messages', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-available' }, body: JSON.stringify({ message: 'Quels monteurs sont disponibles du 10/06/2030 au 11/06/2030 ?' }) }, admin);
  assert.equal(available.response.status, 201); assert.equal(available.data.intent, 'personnelAvailability'); assert.equal(available.data.facts.people.some(item => item.id === person.id), true);
  const absenceBody = { membershipId: person.id, siteId: 'site_paris', startsAt: '2030-06-10T00:00:00.000Z', endsAt: '2030-06-12T00:00:00.000Z', type: 'leave', reason: 'Congé validé' };
  const absence = await request('/api/v1/person-unavailabilities', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-absence' }, body: JSON.stringify(absenceBody) }, admin);
  assert.equal(absence.response.status, 201); assert.equal(absence.data.status, 'confirmed');
  const absenceReplay = await request('/api/v1/person-unavailabilities', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-absence' }, body: JSON.stringify(absenceBody) }, admin);
  assert.equal(absenceReplay.response.status, 200); assert.equal(absenceReplay.data.id, absence.data.id);
  const overlap = await request('/api/v1/person-unavailabilities', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-overlap' }, body: JSON.stringify({ membershipId: person.id, siteId: 'site_paris', startsAt: '2030-06-11T00:00:00.000Z', endsAt: '2030-06-13T00:00:00.000Z', type: 'rtt' }) }, admin);
  assert.equal(overlap.response.status, 409); assert.equal(overlap.data.error.code, 'PERSON_UNAVAILABILITY_OVERLAP');
  const filtered = await request('/api/v1/plany/messages', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-unavailable' }, body: JSON.stringify({ message: 'Quels monteurs sont disponibles du 10/06/2030 au 11/06/2030 ?' }) }, admin);
  assert.equal(filtered.response.status, 201); assert.equal(filtered.data.facts.people.some(item => item.id === person.id), false);
  const viewerWrite = await request('/api/v1/person-skills', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-viewer' }, body: JSON.stringify({ membershipId: person.id, code: 'MIXING', name: 'Mixage', level: 2 }) }, viewer);
  assert.equal(viewerWrite.response.status, 403);
});

test('Sprint 5 annuaire opérationnel : un planificateur lit uniquement les champs nécessaires', async () => {
  const governance = await request('/api/v1/memberships?pageSize=200', {}, planner);
  assert.equal(governance.response.status, 403);
  const directory = await request('/api/v1/personnel-directory?pageSize=200', {}, planner);
  assert.equal(directory.response.status, 200);
  assert.ok(directory.data.items.length > 0);
  assert.deepEqual(Object.keys(directory.data.items[0]).sort(), ['defaultSiteId', 'displayName', 'id', 'jobTitle']);
  assert.equal(directory.data.items.some(item => item.userId || item.email || item.roles || item.scopes), false);
  const scopedDirectory = await request('/api/v1/personnel-directory?pageSize=200', {}, parisPlanner);
  assert.equal(scopedDirectory.response.status, 200);
  assert.equal(scopedDirectory.data.items.some(item => item.defaultSiteId === 'site_boulogne'), false);
});

test('Sprint 5 personnel : une indisponibilité reste masquée et non annulable hors site', async () => {
  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin), person = memberships.data.items.find(item => item.userId === 'user_planner');
  const made = await request('/api/v1/person-unavailabilities', { method: 'POST', headers: { 'Idempotency-Key': 's5-person-boulogne' }, body: JSON.stringify({ membershipId: person.id, siteId: 'site_boulogne', startsAt: '2030-07-10T00:00:00.000Z', endsAt: '2030-07-11T00:00:00.000Z', type: 'leave', reason: 'Boulogne uniquement' }) }, admin);
  assert.equal(made.response.status, 201);
  const listed = await request(`/api/v1/person-unavailabilities?membershipId=${encodeURIComponent(person.id)}`, {}, parisPlanner);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.data.items.some(item => item.id === made.data.id), false);
  const hiddenDelete = await request(`/api/v1/person-unavailabilities/${made.data.id}`, { method: 'DELETE', body: JSON.stringify({ version: made.data.version }) }, parisPlanner);
  assert.equal(hiddenDelete.response.status, 404);
  const unchanged = await request(`/api/v1/person-unavailabilities?membershipId=${encodeURIComponent(person.id)}`, {}, admin);
  assert.equal(unchanged.data.items.find(item => item.id === made.data.id).status, 'confirmed');
});

test('le catalogue RBAC V1 expose exactement les sept rôles standards', async () => {
  const roles = await request('/api/v1/roles?pageSize=200', {}, admin);
  assert.equal(roles.response.status, 200);
  const standard = roles.data.items.filter(role => ['ADMIN', 'PLANNING_MANAGER', 'PLANNER', 'SALES', 'PROJECT_MANAGER', 'FINANCE', 'READ_ONLY'].includes(role.code));
  assert.deepEqual(standard.map(role => role.code).sort(), ['ADMIN', 'FINANCE', 'PLANNER', 'PLANNING_MANAGER', 'PROJECT_MANAGER', 'READ_ONLY', 'SALES']);
  assert.ok(standard.every(role => role.systemManaged && role.active && role.version === 1));
});

test('une mutation sans CSRF est refusée', async () => {
  const { response, data } = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({}),
  }, { cookie: admin.cookie });
  assert.equal(response.status, 403);
  assert.equal(data.error.code, 'CSRF_INVALID');
});

test('un viewer reçoit 403 sur une mutation même avec un CSRF valide', async () => {
  const { response, data } = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({}),
  }, viewer);
  assert.equal(response.status, 403);
  assert.equal(data.error.code, 'FORBIDDEN');
});

test('le périmètre site du viewer isole listes et identifiants devinés', async () => {
  const resources = await request('/api/v1/resources?siteId=site_boulogne', {}, viewer);
  assert.equal(resources.response.status, 200);
  assert.equal(resources.data.total, 0);

  const outside = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'QA API — hors périmètre', siteId: 'site_boulogne', projectId: 'project_1', status: 'confirmed',
      startsAt: '2026-08-22T07:00:00.000Z', endsAt: '2026-08-22T08:00:00.000Z',
      resources: [{ resourceId: 'resource_34', quantity: 1 }],
    }),
  }, admin);
  assert.equal(outside.response.status, 201);
  const guessed = await request(`/api/v1/reservations/${outside.data.id}`, {}, viewer);
  assert.equal(guessed.response.status, 404);
  assert.equal(guessed.data.error.code, 'NOT_FOUND');
});

test('CRUD réservation : création puis lecture canonique', async () => {
  const payload = {
    title: 'QA API — création',
    siteId: 'site_paris',
    projectId: 'project_1',
    status: 'confirmed',
    startsAt: '2026-08-20T07:00:00.000Z',
    endsAt: '2026-08-20T08:00:00.000Z',
    resources: [{ resourceId: 'resource_3', quantity: 1 }],
    includeWeekends: false,
    timeGranularity: 'hour',
    snapMinutes: 30,
    holidayCalendarId: 'FR-national',
  };
  const result = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify(payload) }, admin);
  assert.equal(result.response.status, 201);
  assert.equal(result.data.version, 1);
  assert.equal(result.data.companyId, 'company_northlight');
  created = result.data;

  const read = await request(`/api/v1/reservations/${created.id}`, {}, admin);
  assert.equal(read.response.status, 200);
  assert.deepEqual(read.data.resources, payload.resources);
  assert.equal(read.data.includeWeekends, false);
  assert.equal(read.data.timeGranularity, 'hour');
  assert.equal(read.data.snapMinutes, 30);
  assert.equal(read.data.holidayCalendarId, 'FR-national');

  const invalidGranularity = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...payload, title: 'Granularité invalide', startsAt: '2026-08-21T07:00:00.000Z', endsAt: '2026-08-21T08:00:00.000Z', timeGranularity: 'minute', snapMinutes: 15 }) }, admin);
  assert.equal(invalidGranularity.response.status, 422);
  assert.equal(invalidGranularity.data.error.code, 'VALIDATION_ERROR');

  const incompatibleSnap = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...payload, title: 'Pas incompatible', startsAt: '2026-08-22T07:00:00.000Z', endsAt: '2026-08-22T08:00:00.000Z', timeGranularity: 'day', snapMinutes: 30 }) }, admin);
  assert.equal(incompatibleSnap.response.status, 422);
  assert.equal(incompatibleSnap.data.error.code, 'VALIDATION_ERROR');

  const unknownCalendar = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...payload, title: 'Calendrier inconnu', startsAt: '2026-08-23T07:00:00.000Z', endsAt: '2026-08-23T08:00:00.000Z', holidayCalendarId: 'calendar-forged' }) }, admin);
  assert.equal(unknownCalendar.response.status, 422);
  assert.equal(unknownCalendar.data.error.code, 'VALIDATION_ERROR');
});

test('Sprint 2 expose les sept statuts et applique les transitions auditées', async () => {
  const statuses = ['draft', 'option', 'confirmed', 'completed', 'cancelled', 'unavailable', 'maintenance'];
  for (const [index, status] of statuses.entries()) {
    const result = await request('/api/v1/reservations', {
      method: 'POST',
      body: JSON.stringify({
        title: `Sprint 2 — ${status}`,
        siteId: 'site_paris',
        projectId: 'project_1',
        status,
        startsAt: `2027-01-${String(index + 2).padStart(2, '0')}T07:00:00.000Z`,
        endsAt: `2027-01-${String(index + 2).padStart(2, '0')}T08:00:00.000Z`,
        resources: [{ resourceId: 'resource_8', quantity: 1 }],
      }),
    }, admin);
    assert.equal(result.response.status, 201, status);
    assert.equal(result.data.status, status);
  }

  const draft = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({ title: 'Cycle Sprint 2', siteId: 'site_paris', projectId: 'project_1', status: 'draft', startsAt: '2027-02-01T07:00:00.000Z', endsAt: '2027-02-01T08:00:00.000Z', resources: [{ resourceId: 'resource_8', quantity: 1 }] }),
  }, admin);
  const option = await request(`/api/v1/reservations/${draft.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: draft.data.version, status: 'option' }) }, admin);
  const confirmed = await request(`/api/v1/reservations/${draft.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: option.data.version, status: 'confirmed' }) }, admin);
  const completed = await request(`/api/v1/reservations/${draft.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: confirmed.data.version, status: 'completed' }) }, admin);
  assert.equal(option.response.status, 200);
  assert.equal(confirmed.response.status, 200);
  assert.equal(completed.response.status, 200);

  const terminal = await request(`/api/v1/reservations/${draft.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: completed.data.version, notes: 'interdit' }) }, admin);
  assert.equal(terminal.response.status, 409);
  assert.equal(terminal.data.error.code, 'RESERVATION_TERMINAL');

  const moveCompletedCell = await request(`/api/v1/reservations/${draft.data.id}/cells/2027-02-01/resource_8`, { method: 'PATCH', body: JSON.stringify({ version: completed.data.version, targetDate: '2027-02-01', targetResourceId: 'resource_3' }) }, admin);
  assert.equal(moveCompletedCell.response.status, 409);
  assert.equal(moveCompletedCell.data.error.code, 'RESERVATION_TERMINAL');

  const cancelCompleted = await request(`/api/v1/reservations/${draft.data.id}`, { method: 'DELETE', headers: { 'Idempotency-Key': 'cancel-completed-terminal' }, body: JSON.stringify({ version: completed.data.version }) }, admin);
  assert.equal(cancelCompleted.response.status, 409);
  assert.equal(cancelCompleted.data.error.code, 'RESERVATION_STATUS_TRANSITION_INVALID');
  const completedUnchanged = await request(`/api/v1/reservations/${draft.data.id}`, {}, admin);
  assert.equal(completedUnchanged.data.status, 'completed');
  assert.equal(completedUnchanged.data.version, completed.data.version);

  const alreadyCancelled = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Annulation terminale Sprint 2', siteId: 'site_paris', projectId: 'project_1', status: 'cancelled', startsAt: '2027-02-02T07:00:00.000Z', endsAt: '2027-02-02T08:00:00.000Z', resources: [{ resourceId: 'resource_8', quantity: 1 }] }) }, admin);
  const cancelAgain = await request(`/api/v1/reservations/${alreadyCancelled.data.id}`, { method: 'DELETE', headers: { 'Idempotency-Key': 'cancel-cancelled-terminal' }, body: JSON.stringify({ version: alreadyCancelled.data.version }) }, admin);
  assert.equal(cancelAgain.response.status, 409);
  assert.equal(cancelAgain.data.error.code, 'RESERVATION_STATUS_TRANSITION_INVALID');

  const auditLog = await request('/api/v1/audit?pageSize=500', {}, admin);
  const transitions = auditLog.data.items.filter(item => item.action === 'reservation.updated' && item.entityId === draft.data.id);
  assert.equal(transitions.length, 3);
  assert.deepEqual(transitions.toReversed().map(item => [item.before.status, item.after.status]), [['draft', 'option'], ['option', 'confirmed'], ['confirmed', 'completed']]);
});

test('Sprint 2 distingue les statuts consommateurs et refuse une transition illégale sans mutation', async () => {
  const common = { siteId: 'site_paris', projectId: 'project_1', startsAt: '2027-03-01T07:00:00.000Z', endsAt: '2027-03-01T08:00:00.000Z', resources: [{ resourceId: 'resource_8', quantity: 1 }] };
  const draft = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...common, title: 'Brouillon non consommateur', status: 'draft' }) }, admin);
  const confirmed = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...common, title: 'Confirmée consommatrice', status: 'confirmed' }) }, admin);
  assert.equal(draft.response.status, 201);
  assert.equal(confirmed.response.status, 201);

  const invalid = await request(`/api/v1/reservations/${confirmed.data.id}`, { method: 'PATCH', body: JSON.stringify({ version: confirmed.data.version, status: 'draft' }) }, admin);
  assert.equal(invalid.response.status, 409);
  assert.equal(invalid.data.error.code, 'RESERVATION_STATUS_TRANSITION_INVALID');
  const unchanged = await request(`/api/v1/reservations/${confirmed.data.id}`, {}, admin);
  assert.equal(unchanged.data.status, 'confirmed');
  assert.equal(unchanged.data.version, confirmed.data.version);

  const maintenance = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...common, title: 'Maintenance bloquante', status: 'maintenance', startsAt: '2027-03-02T07:00:00.000Z', endsAt: '2027-03-02T08:00:00.000Z' }) }, admin);
  assert.equal(maintenance.response.status, 201);
  const conflict = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ ...common, title: 'Conflit maintenance', status: 'option', startsAt: '2027-03-02T07:00:00.000Z', endsAt: '2027-03-02T08:00:00.000Z' }) }, admin);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.data.error.code, 'PLANNING_CONFLICT');
});

test('les exemples OpenAPI de création et mise à jour sont exécutables contre le runtime', async () => {
  const contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.ok(contract.includes('resources: [{ resourceId: resource_1, quantity: 1 }]'));
  assert.equal(contract.includes('allocations:'), false);
  const createdFromContract = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': 'openapi-reservation-create' }, body: JSON.stringify({ siteId: 'site_paris', projectId: 'project_1', title: 'Montage émission', startsAt: '2026-12-01T07:00:00.000Z', endsAt: '2026-12-01T16:00:00.000Z', status: 'confirmed', resources: [{ resourceId: 'resource_1', quantity: 1 }] }) }, admin);
  assert.equal(createdFromContract.response.status, 201);
  assert.equal(createdFromContract.data.companyId, 'company_northlight');
  const updatedFromContract = await request(`/api/v1/reservations/${createdFromContract.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'openapi-reservation-patch' }, body: JSON.stringify({ version: createdFromContract.data.version, title: 'Montage émission — confirmé', resources: [{ resourceId: 'resource_1', quantity: 1 }] }) }, admin);
  assert.equal(updatedFromContract.response.status, 200);
  assert.equal(updatedFromContract.data.version, 2);
});

test('le journal de domaine HTTP est audité, rejouable et réservé aux rôles autorisés', async () => {
  const forbidden = await request('/api/v1/domain-events', {}, viewer);
  assert.equal(forbidden.response.status, 403);
  assert.equal(forbidden.data.error.code, 'FORBIDDEN');
  assert.ok(forbidden.data.error.error_id);

  const replay = await request('/api/v1/domain-events?afterSequence=0&limit=1000', {}, admin);
  assert.equal(replay.response.status, 200);
  assert.ok(Array.isArray(replay.data.data));
  assert.ok(replay.data.data.some(event => event.type === 'ReservationCreated' && event.entityId === created.id));
  assert.ok(replay.data.data.every(event => event.companyId === admin.user.companyId));
  assert.equal(replay.data.meta.nextSequence, replay.data.data.at(-1).sequence);

  const after = await request(`/api/v1/domain-events?afterSequence=${replay.data.meta.nextSequence}&limit=10`, {}, admin);
  assert.equal(after.response.status, 200);
  assert.deepEqual(after.data.data, []);
  assert.equal(after.data.meta.nextSequence, replay.data.meta.nextSequence);
});

test('les métriques techniques restent protégées et exposent latence, erreurs et SSE', async () => {
  const forbidden = await request('/api/v1/technical-metrics', {}, viewer);
  assert.equal(forbidden.response.status, 403);
  const result = await request('/api/v1/technical-metrics', {}, admin);
  assert.equal(result.response.status, 200);
  assert.ok(result.data.requests > 0);
  assert.ok(result.data.errors > 0);
  assert.equal(typeof result.data.latencyMs.p95, 'number');
  assert.equal(typeof result.data.sse.active, 'number');
  assert.equal(typeof result.data.domainEvents, 'number');
});

test('la création de réservation exige une clé et son rejeu ne duplique rien', async () => {
  const payload = {
    title: 'QA API — idempotence', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
    startsAt: '2026-12-01T08:00:00.000Z', endsAt: '2026-12-01T09:00:00.000Z',
    resources: [{ resourceId: 'resource_7', quantity: 1 }],
  };
  const missing = await request('/api/v1/reservations', { method: 'POST', headers: { 'Idempotency-Key': ' ' }, body: JSON.stringify(payload) }, admin);
  assert.equal(missing.response.status, 400);
  assert.equal(missing.data.error.code, 'IDEMPOTENCY_KEY_REQUIRED');

  const before = (await request('/api/v1/reservations', {}, admin)).data.total;
  const headers = { 'Idempotency-Key': 'reservation-create-replay' };
  const first = await request('/api/v1/reservations', { method: 'POST', headers, body: JSON.stringify(payload) }, admin);
  const replay = await request('/api/v1/reservations', { method: 'POST', headers, body: JSON.stringify({ ...payload, resources: [{ quantity: 1, resourceId: 'resource_7' }] }) }, admin);
  assert.equal(first.response.status, 201);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.id, first.data.id);
  assert.equal((await request('/api/v1/reservations', {}, admin)).data.total, before + 1);

  const conflict = await request('/api/v1/reservations', { method: 'POST', headers, body: JSON.stringify({ ...payload, title: 'Autre réservation' }) }, admin);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.data.error.code, 'IDEMPOTENCY_CONFLICT');
});

test('une réservation sans projet est refusée sans écriture', async () => {
  const before = (await request('/api/v1/reservations', {}, admin)).data.total;
  const result = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Orpheline interdite', siteId: 'site_paris', status: 'option', startsAt: '2026-11-02T08:00:00.000Z', endsAt: '2026-11-02T17:00:00.000Z', resources: [{ resourceId: 'resource_8', quantity: 1 }] }) }, admin);
  assert.equal(result.response.status, 422);
  assert.equal(result.data.error.code, 'VALIDATION_ERROR');
  assert.ok(result.data.error.details.fields.some(field => field.field === 'projectId'));
  assert.equal((await request('/api/v1/reservations', {}, admin)).data.total, before);
});

test('un projet commercial actif reste planifiable avant confirmation du devis', async () => {
  const projects = await request('/api/v1/projects', {}, admin);
  const project = projects.data.items.find(item => item.id === 'project_1');
  assert.equal(project.lifecycleStatus, 'confirmed');
  const prepared = await request('/api/v1/projects/project_1', { method: 'PATCH', body: JSON.stringify({ version: project.version, notes: 'Planning parallèle au devis autorisé' }) }, admin);
  assert.equal(prepared.response.status, 200);
  const result = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Planning parallèle au devis', projectId: 'project_1', siteId: 'site_paris', startsAt: '2026-09-20T09:00:00.000Z', endsAt: '2026-09-20T17:00:00.000Z', status: 'confirmed', resources: [{ resourceId: 'resource_1', quantity: 1 }] }) }, admin);
  assert.equal(result.response.status, 201);
  assert.equal(result.data.projectId, 'project_1');
  assert.equal(prepared.data.lifecycleStatus, 'confirmed');
});

test('déplacer une cellule quotidienne ne déplace pas le reste de la réservation', async () => {
  const independent = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Réservation indépendante à conserver', siteId: 'site_paris', projectId: 'project_2', status: 'confirmed', startsAt: '2026-09-08T09:00:00.000Z', endsAt: '2026-09-08T17:00:00.000Z', resources: [{ resourceId: 'resource_5', quantity: 1 }], planningMode: 'dailyCells', cellOverrides: [] }) }, admin);
  assert.equal(independent.response.status, 201);
  const payload = {
    title: 'The Voice — série cellules', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
    startsAt: '2026-09-07T07:00:00.000Z', endsAt: '2026-09-09T16:00:00.000Z',
    resources: [{ resourceId: 'resource_3', quantity: 1 }], planningMode: 'dailyCells', cellOverrides: [],
  };
  const createdSeries = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify(payload) }, admin);
  assert.equal(createdSeries.response.status, 201);
  const totalBeforeMove = (await request('/api/v1/reservations', {}, admin)).data.total;
  const moveHeaders = { 'Idempotency-Key': 'reservation-cell-move-replay' };
  const moved = await request(`/api/v1/reservations/${createdSeries.data.id}/cells/2026-09-08/resource_3`, {
    method: 'PATCH',
    headers: moveHeaders,
    body: JSON.stringify({ version: createdSeries.data.version, targetDate: '2026-09-08', targetResourceId: 'resource_4' }),
  }, admin);
  assert.equal(moved.response.status, 200);
  assert.equal(moved.data.startsAt, payload.startsAt);
  assert.equal(moved.data.endsAt, payload.endsAt);
  assert.deepEqual(moved.data.resources, payload.resources);
  assert.deepEqual(moved.data.cellOverrides, [{ sourceDate: '2026-09-08', sourceResourceId: 'resource_3', targetDate: '2026-09-08', targetResourceId: 'resource_4' }]);
  const afterMove = await request('/api/v1/reservations', {}, admin);
  assert.equal(afterMove.data.total, totalBeforeMove);
  assert.ok(afterMove.data.items.some(value => value.id === independent.data.id && value.title === 'Réservation indépendante à conserver'));
  const replay = await request(`/api/v1/reservations/${createdSeries.data.id}/cells/2026-09-08/resource_3`, {
    method: 'PATCH', headers: moveHeaders,
    body: JSON.stringify({ version: createdSeries.data.version, targetDate: '2026-09-08', targetResourceId: 'resource_4' }),
  }, admin);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.version, moved.data.version);
  assert.deepEqual(replay.data.cellOverrides, moved.data.cellOverrides);
  const divergentReplay = await request(`/api/v1/reservations/${createdSeries.data.id}/cells/2026-09-08/resource_3`, {
    method: 'PATCH', headers: moveHeaders,
    body: JSON.stringify({ version: createdSeries.data.version, targetDate: '2026-09-08', targetResourceId: 'resource_5' }),
  }, admin);
  assert.equal(divergentReplay.response.status, 409);
  assert.equal(divergentReplay.data.error.code, 'IDEMPOTENCY_CONFLICT');
  const audit = await request('/api/v1/audit', {}, admin);
  const events = audit.data.items.filter(value => value.entityId === moved.data.id && value.action === 'reservation.cellMoved');
  assert.equal(events.length, 1);
  const event = events[0];
  assert.deepEqual({ sourceDate: event.details.sourceDate, targetResourceId: event.details.targetResourceId }, { sourceDate: '2026-09-08', targetResourceId: 'resource_4' });
});

test('un chevauchement au-delà de la capacité reçoit 409', async () => {
  const result = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'QA API — conflit', siteId: 'site_paris', projectId: 'project_1', status: 'option',
      startsAt: '2026-08-20T07:30:00.000Z', endsAt: '2026-08-20T07:45:00.000Z',
      resources: [{ resourceId: 'resource_3', quantity: 1 }],
    }),
  }, admin);
  assert.equal(result.response.status, 409);
  assert.equal(result.data.error.code, 'PLANNING_CONFLICT');
  assert.equal(result.data.error.details.conflicts[0].resourceId, 'resource_3');
});

test('une réservation adjacente est acceptée', async () => {
  const result = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'QA API — adjacente', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
      startsAt: '2026-08-20T08:00:00.000Z', endsAt: '2026-08-20T09:00:00.000Z',
      resources: [{ resourceId: 'resource_3', quantity: 1 }],
    }),
  }, admin);
  assert.equal(result.response.status, 201);
});

test('les horaires explicites respectent réellement le pas 30 minutes', async () => {
  const invalid = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Créneau mal aligné', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
      startsAt: '2027-02-01T08:15:00.000Z', endsAt: '2027-02-01T09:00:00.000Z',
      timeGranularity: 'hour', snapMinutes: 30,
      resources: [{ resourceId: 'resource_8', quantity: 1 }],
    }),
  }, admin);
  assert.equal(invalid.response.status, 422);
  assert.equal(invalid.data.error.code, 'VALIDATION_ERROR');
  assert.ok(invalid.data.error.details.fields.some(field => field.field === 'startsAt'));

  const aligned = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Créneau aligné', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
      startsAt: '2027-02-01T08:30:00.000Z', endsAt: '2027-02-01T09:30:00.000Z',
      timeGranularity: 'hour', snapMinutes: 30,
      resources: [{ resourceId: 'resource_8', quantity: 1 }],
    }),
  }, admin);
  assert.equal(aligned.response.status, 201);
  assert.equal(aligned.data.timePolicyVersion, 'sprint3-v1');
});

test('un override motivé est accepté et audité', async () => {
  const reason = 'Arbitrage QA autorisé';
  const result = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'QA API — override', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
      startsAt: '2026-08-20T07:30:00.000Z', endsAt: '2026-08-20T07:45:00.000Z',
      resources: [{ resourceId: 'resource_3', quantity: 1 }],
      conflictPolicy: 'override', overrideReason: reason,
    }),
  }, admin);
  assert.equal(result.response.status, 201);

  const audit = await request('/api/v1/audit', {}, admin);
  assert.equal(audit.response.status, 200);
  const event = audit.data.items.find(item => item.entityId === result.data.id);
  assert.equal(event.action, 'reservation.created');
  assert.equal(event.details.overrideReason, reason);
  assert.ok(event.details.conflicts.length > 0);
});

test('mise à jour réussie puis version obsolète refusée sans écrasement', async () => {
  const fresh = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'QA API — version', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
      startsAt: '2026-08-21T07:00:00.000Z', endsAt: '2026-08-21T08:00:00.000Z',
      resources: [{ resourceId: 'resource_5', quantity: 1 }],
    }),
  }, admin);
  assert.equal(fresh.response.status, 201);
  created = fresh.data;

  const updated = await request(`/api/v1/reservations/${created.id}`, {
    method: 'PATCH', body: JSON.stringify({ version: created.version, title: 'QA API — modifiée' }),
  }, admin);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.version, 2);
  assert.equal(updated.data.title, 'QA API — modifiée');
  created = updated.data;

  const stale = await request(`/api/v1/reservations/${created.id}`, {
    method: 'PATCH', body: JSON.stringify({ version: 1, title: 'Écrasement interdit' }),
  }, admin);
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error.code, 'VERSION_CONFLICT');

  const read = await request(`/api/v1/reservations/${created.id}`, {}, admin);
  assert.equal(read.data.title, 'QA API — modifiée');
  assert.equal(read.data.version, 2);
});

test('la mise à jour de réservation est idempotente et refuse un contenu divergent', async () => {
  const fresh = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({ title: 'QA API — rejeu PATCH', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2026-08-22T07:00:00.000Z', endsAt: '2026-08-22T08:00:00.000Z', resources: [{ resourceId: 'resource_5', quantity: 1 }] }),
  }, admin);
  assert.equal(fresh.response.status, 201);
  const headers = { 'Idempotency-Key': 'reservation-patch-replay' }, body = JSON.stringify({ version: fresh.data.version, title: 'QA API — rejeu confirmé' });
  const first = await request(`/api/v1/reservations/${fresh.data.id}`, { method: 'PATCH', headers, body }, admin);
  const replay = await request(`/api/v1/reservations/${fresh.data.id}`, { method: 'PATCH', headers, body }, admin);
  assert.equal(first.response.status, 200);
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.data, first.data);
  const conflict = await request(`/api/v1/reservations/${fresh.data.id}`, { method: 'PATCH', headers, body: JSON.stringify({ version: fresh.data.version, title: 'Contenu divergent' }) }, admin);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.data.error.code, 'IDEMPOTENCY_CONFLICT');
  const audit = await request('/api/v1/audit', {}, admin);
  assert.equal(audit.data.items.filter(item => item.entityId === fresh.data.id && item.action === 'reservation.updated').length, 1);
});

test('annulation logique libère la réservation et interdit sa modification', async () => {
  const cancelled = await request(`/api/v1/reservations/${created.id}`, {
    method: 'DELETE', body: JSON.stringify({ version: created.version }),
  }, admin);
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.data.status, 'cancelled');
  assert.equal(cancelled.data.version, 3);

  const patch = await request(`/api/v1/reservations/${created.id}`, {
    method: 'PATCH', body: JSON.stringify({ version: 3, title: 'Interdit' }),
  }, admin);
  assert.equal(patch.response.status, 409);
  assert.equal(patch.data.error.code, 'RESERVATION_CANCELLED');
});

test('les fichiers serveur et données sensibles ne sont jamais servis', async () => {
  for (const route of ['/server.js', '/package.json', '/data/planify.json', '/.env', '/%2e%2e/server.js']) {
    const { response } = await request(route);
    assert.equal(response.status, 404, `${route} a répondu ${response.status}`);
  }
});

test('dashboard calcule occupation bornée et exclut les annulations', async () => {
  const route = '/api/v1/dashboard/occupancy?siteId=site_paris&resourceIds=resource_3&from=2026-08-17T06:00:00.000Z&to=2026-08-17T10:00:00.000Z';
  const { response, data } = await request(route, {}, admin);
  assert.equal(response.status, 200);
  assert.equal(data.bookedCapacityHours, 3);
  assert.equal(data.availableCapacityHours, 4);
  assert.equal(data.occupancyRate, 75);
  assert.equal(data.resources[0].resourceId, 'resource_3');
});

test('suppression logique d’une ressource : admin uniquement, historique conservé', async () => {
  const forbidden = await request('/api/v1/resources/resource_9', {
    method: 'DELETE', body: JSON.stringify({ version: 1 }),
  }, viewer);
  assert.equal(forbidden.response.status, 403);

  const removed = await request('/api/v1/resources/resource_9', {
    method: 'DELETE', headers: { 'Idempotency-Key': 'resource-archive-replay' }, body: JSON.stringify({ version: 1 }),
  }, admin);
  assert.equal(removed.response.status, 200);
  assert.equal(removed.data.active, false);
  assert.equal(removed.data.version, 2);
  const replay = await request('/api/v1/resources/resource_9', {
    method: 'DELETE', headers: { 'Idempotency-Key': 'resource-archive-replay' }, body: JSON.stringify({ version: 1 }),
  }, admin);
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.data, removed.data);

  const active = await request('/api/v1/resources?active=true&pageSize=200', {}, admin);
  assert.equal(active.data.items.some(resource => resource.id === 'resource_9'), false);
});

test('quatre mutations critiques exposent un audit canonique reconstructible', async () => {
  const projects = await request('/api/v1/projects?pageSize=200', {}, admin), project = projects.data.items.find(item => item.id === 'project_1');
  const resources = await request('/api/v1/resources?pageSize=200', {}, admin), resource = resources.data.items.find(item => item.id === 'resource_5');
  const clients = await request('/api/v1/clients?pageSize=200', {}, admin), client = clients.data.items.find(item => item.id === 'client_1');
  const projectUpdate = await request('/api/v1/projects/project_1', { method: 'PATCH', headers: { 'Idempotency-Key': 'audit-project-update' }, body: JSON.stringify({ version: project.version, notes: 'Preuve audit G0 projet' }) }, admin);
  const resourceUpdate = await request('/api/v1/resources/resource_5', { method: 'PATCH', headers: { 'Idempotency-Key': 'audit-resource-update' }, body: JSON.stringify({ version: resource.version, color: '#556677' }) }, admin);
  const clientUpdate = await request('/api/v1/clients/client_1', { method: 'PATCH', headers: { 'Idempotency-Key': 'audit-client-update' }, body: JSON.stringify({ version: client.version, notes: 'Preuve audit G0 client' }) }, admin);
  assert.equal(projectUpdate.response.status, 200);
  assert.equal(resourceUpdate.response.status, 200);
  assert.equal(clientUpdate.response.status, 200);
  const audit = await request('/api/v1/audit?pageSize=500', {}, admin);
  const expected = [
    ['project.updated', 'project_1'],
    ['resource.updated', 'resource_5'],
    ['client.updated', 'client_1'],
    ['reservation.updated', created.id],
  ];
  for (const [action, entityId] of expected) {
    const entry = audit.data.items.find(item => item.action === action && item.entityId === entityId);
    assert.ok(entry, `${action} absent`);
    assert.ok(entry.operationId);
    assert.ok(entry.origin);
    assert.ok(entry.before);
    assert.ok(entry.after);
    assert.ok(Number.isInteger(entry.versionBefore));
    assert.ok(Number.isInteger(entry.versionAfter));
  }
});

test('les rôles sensibles sont idempotents et audités avec état avant/après', async () => {
  const payload = { code: 'g0AuditRole', name: 'Rôle audit G0', permissions: ['planning.read'] };
  const createdRole = await request('/api/v1/roles', { method: 'POST', headers: { 'Idempotency-Key': 'role-create-replay' }, body: JSON.stringify(payload) }, admin);
  assert.equal(createdRole.response.status, 201);
  const replay = await request('/api/v1/roles', { method: 'POST', headers: { 'Idempotency-Key': 'role-create-replay' }, body: JSON.stringify(payload) }, admin);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.id, createdRole.data.id);
  assert.equal(replay.data.version, 1);
  const updatedRole = await request(`/api/v1/roles/${createdRole.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'role-update-replay' }, body: JSON.stringify({ version: 1, name: 'Rôle audit G0 mis à jour' }) }, admin);
  assert.equal(updatedRole.response.status, 200);
  const updateReplay = await request(`/api/v1/roles/${createdRole.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'role-update-replay' }, body: JSON.stringify({ version: 1, name: 'Rôle audit G0 mis à jour' }) }, admin);
  assert.equal(updateReplay.response.status, 200);
  assert.equal(updateReplay.data.version, 2);
  const auditLog = await request('/api/v1/audit?pageSize=500', {}, admin);
  const creationAudit = auditLog.data.items.find(item => item.action === 'role.created' && item.entityId === createdRole.data.id);
  const updateAudit = auditLog.data.items.find(item => item.action === 'role.updated' && item.entityId === createdRole.data.id);
  assert.equal(creationAudit.before, null);
  assert.equal(creationAudit.after.id, createdRole.data.id);
  assert.equal(updateAudit.before.version, 1);
  assert.equal(updateAudit.after.version, 2);
});

test('les événements SSE inconnus échouent fermés et les familles connues respectent les scopes', () => {
  const auth = { user: { companyId: 'company_1', siteIds: ['site_paris'], organizationScope: false, projectScopeRestricted: true, projectIds: ['project_1'], entityScopes: { resource: ['resource_3'], client: ['client_1'], quote: ['quote_1'], reservation: ['reservation_1'] } } };
  assert.equal(sseScopeAllowed(auth, 'unknownFamily.updated.v1', { id: 'resource_3', companyId: 'company_1' }), false);
  assert.equal(sseScopeAllowed(auth, 'resource.updated.v1', { id: 'resource_3', companyId: 'company_1', siteId: 'site_paris' }), true);
  assert.equal(sseScopeAllowed(auth, 'resource.updated.v1', { id: 'resource_5', companyId: 'company_1', siteId: 'site_paris' }), false);
  assert.equal(sseScopeAllowed(auth, 'project.updated.v1', { id: 'project_2', companyId: 'company_1' }), false);
});

test('les scopes projet et entité filtrent listes et identifiants devinés', async () => {
  const hiddenReservation = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Réservation hors scope entité', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2026-11-05T08:00:00.000Z', endsAt: '2026-11-05T09:00:00.000Z', resources: [{ resourceId: 'resource_5', quantity: 1 }] }) }, admin);
  assert.equal(hiddenReservation.response.status, 201);
  const allowedReservation = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({ title: 'Réservation autorisée, cible masquée', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: '2026-11-05T10:00:00.000Z', endsAt: '2026-11-05T11:00:00.000Z', resources: [{ resourceId: 'resource_3', quantity: 1 }], planningMode: 'dailyCells', cellOverrides: [] }) }, admin);
  assert.equal(allowedReservation.response.status, 201);
  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin);
  const membership = memberships.data.items.find(item => item.userId === 'user_viewer');
  assert.ok(membership);
  const scoped = await request(`/api/v1/memberships/${membership.id}/scopes`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'membership-scope-replay' },
    body: JSON.stringify({ version: membership.version, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], projectIds: ['project_1'], entityScopes: { resource: ['resource_3'], client: ['client_1'], reservation: [allowedReservation.data.id] } }),
  }, admin);
  assert.equal(scoped.response.status, 200);
  const scopedReplay = await request(`/api/v1/memberships/${membership.id}/scopes`, {
    method: 'PUT',
    headers: { 'Idempotency-Key': 'membership-scope-replay' },
    body: JSON.stringify({ version: membership.version, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], projectIds: ['project_1'], entityScopes: { resource: ['resource_3'], client: ['client_1'], reservation: [allowedReservation.data.id] } }),
  }, admin);
  assert.equal(scopedReplay.response.status, 200);
  assert.equal(scopedReplay.data.version, scoped.data.version);
  const projects = await request('/api/v1/projects?pageSize=200', {}, viewer);
  assert.deepEqual(projects.data.items.map(item => item.id), ['project_1']);
  const resources = await request('/api/v1/resources?pageSize=200', {}, viewer);
  assert.deepEqual(resources.data.items.map(item => item.id), ['resource_3']);
  const occupancy = await request('/api/v1/dashboard/occupancy?siteId=site_paris&from=2026-08-17T06:00:00.000Z&to=2026-08-17T10:00:00.000Z', {}, viewer);
  assert.equal(occupancy.response.status, 200);
  assert.deepEqual(occupancy.data.resources.map(item => item.resourceId), ['resource_3']);
  assert.equal(occupancy.data.bookedCapacityHours, 0);
  const hiddenProject = await request('/api/v1/projects/project_2/dashboard', {}, viewer);
  assert.equal(hiddenProject.response.status, 404);
  const hiddenByResourceScope = await request(`/api/v1/reservations/${hiddenReservation.data.id}`, {}, viewer);
  assert.equal(hiddenByResourceScope.response.status, 404);
  const hiddenCommercialLinks = await request(`/api/v1/reservations/${hiddenReservation.data.id}/commercial-links`, {}, viewer);
  assert.equal(hiddenCommercialLinks.response.status, 404);
  const hiddenCatalog = await request('/api/v1/quote-catalog?projectId=project_2&pageSize=200', {}, viewer);
  assert.equal(hiddenCatalog.response.status, 404);
  const hiddenClientContacts = await request('/api/v1/clients/client_2/contacts?pageSize=200', {}, viewer);
  assert.equal(hiddenClientContacts.response.status, 404);
  const hiddenClientRates = await request('/api/v1/clients/client_2/rates?pageSize=200', {}, viewer);
  assert.equal(hiddenClientRates.response.status, 404);

  const writerRole = await request('/api/v1/roles', { method: 'POST', headers: { 'Idempotency-Key': 'scoped-planning-writer-role' }, body: JSON.stringify({ code: 'scopedPlanningWriter', name: 'Planning restreint', permissions: ['planning.read', 'planning.write'] }) }, admin);
  assert.equal(writerRole.response.status, 201);
  const writerMembership = await request(`/api/v1/memberships/${membership.id}/roles`, { method: 'PUT', headers: { 'Idempotency-Key': 'scoped-planning-writer-membership' }, body: JSON.stringify({ version: scoped.data.version, roleIds: [writerRole.data.id] }) }, admin);
  assert.equal(writerMembership.response.status, 200);
  viewer = await login('viewer@northlight.fr');
  const duplicateHidden = await request(`/api/v1/reservations/${hiddenReservation.data.id}/duplicate`, { method: 'POST', headers: { 'Idempotency-Key': 'duplicate-hidden-reservation' }, body: JSON.stringify({ targetDate: '2026-11-06', targetResourceId: 'resource_3' }) }, viewer);
  assert.equal(duplicateHidden.response.status, 404);
  assert.equal(duplicateHidden.data.error.code, 'NOT_FOUND');
  const duplicateHiddenCell = await request(`/api/v1/reservations/${hiddenReservation.data.id}/duplicate`, { method: 'POST', headers: { 'Idempotency-Key': 'duplicate-hidden-cell' }, body: JSON.stringify({ sourceDate: '2026-11-05', sourceResourceId: 'resource_5', targetDate: '2026-11-06', targetResourceId: 'resource_3' }) }, viewer);
  assert.equal(duplicateHiddenCell.response.status, 404);
  const moveHiddenCell = await request(`/api/v1/reservations/${hiddenReservation.data.id}/cells/2026-11-05/resource_5`, { method: 'PATCH', body: JSON.stringify({ version: hiddenReservation.data.version, targetDate: '2026-11-05', targetResourceId: 'resource_3' }) }, viewer);
  assert.equal(moveHiddenCell.response.status, 404);
  assert.equal(moveHiddenCell.data.error.code, 'NOT_FOUND');
  const allowedBeforeMove = await request(`/api/v1/reservations/${allowedReservation.data.id}`, {}, viewer);
  assert.equal(allowedBeforeMove.response.status, 200);
  const moveToHiddenTarget = await request(`/api/v1/reservations/${allowedReservation.data.id}/cells/2026-11-05/resource_3`, { method: 'PATCH', body: JSON.stringify({ version: allowedReservation.data.version, targetDate: '2026-11-05', targetResourceId: 'resource_5' }) }, viewer);
  assert.equal(moveToHiddenTarget.response.status, 404);
  assert.equal(moveToHiddenTarget.data.error.code, 'NOT_FOUND');
  const allowedAfterMove = await request(`/api/v1/reservations/${allowedReservation.data.id}`, {}, viewer);
  assert.equal(allowedAfterMove.data.version, allowedReservation.data.version);
  assert.deepEqual(allowedAfterMove.data.cellOverrides, []);
  const scopedBatchPayload = { actions: [{ type: 'move', reservationId: allowedReservation.data.id, version: allowedReservation.data.version, targetDate: '2026-11-06', targetResourceId: 'resource_3' }] };
  const scopedBatchHeaders = { 'Idempotency-Key': 'scoped-batch-replay' };
  const scopedBatch = await request('/api/v1/reservations/batch', { method: 'POST', headers: scopedBatchHeaders, body: JSON.stringify(scopedBatchPayload) }, viewer);
  assert.equal(scopedBatch.response.status, 201);
  const currentMovedByAdmin = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'admin-moves-scoped-batch-result' },
    body: JSON.stringify({ actions: [{ type: 'move', reservationId: allowedReservation.data.id, version: scopedBatch.data.items[0].version, targetDate: '2026-11-07', targetResourceId: 'resource_5' }] }),
  }, admin);
  assert.equal(currentMovedByAdmin.response.status, 201);
  const reducedScope = await request(`/api/v1/memberships/${membership.id}/scopes`, {
    method: 'PUT', headers: { 'Idempotency-Key': 'membership-scope-reduced-after-batch' },
    body: JSON.stringify({ version: writerMembership.data.version, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], projectIds: ['project_1'], entityScopes: { resource: ['resource_5'], client: ['client_1'], reservation: [allowedReservation.data.id] } }),
  }, admin);
  assert.equal(reducedScope.response.status, 200);
  viewer = await login('viewer@northlight.fr');
  const currentAfterScopeReduction = await request(`/api/v1/reservations/${allowedReservation.data.id}`, {}, viewer);
  assert.equal(currentAfterScopeReduction.response.status, 200);
  assert.equal(currentAfterScopeReduction.data.resources[0].resourceId, 'resource_5');
  const replayAfterScopeReduction = await request('/api/v1/reservations/batch', { method: 'POST', headers: scopedBatchHeaders, body: JSON.stringify(scopedBatchPayload) }, viewer);
  assert.equal(replayAfterScopeReduction.response.status, 404);
  assert.equal(replayAfterScopeReduction.data.error.code, 'NOT_FOUND');
  const auditLog = await request('/api/v1/audit?pageSize=500', {}, admin);
  const scopeAudit = auditLog.data.items.find(item => item.action === 'membership.scopesUpdated' && item.entityId === membership.id && item.operationId === 'membership-scope-replay');
  assert.ok(scopeAudit?.before?.membership);
  assert.ok(scopeAudit?.after?.scope);
  assert.equal(scopeAudit.operationId, 'membership-scope-replay');
});

test('le collage multi-cellules est atomique, idempotent et sans création partielle', async () => {
  const source = await request('/api/v1/reservations', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Source batch Sprint 4', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
      startsAt: '2027-04-01T08:00:00.000Z', endsAt: '2027-04-01T09:00:00.000Z',
      resources: [{ resourceId: 'resource_8', quantity: 1 }], planningMode: 'dailyCells', timeGranularity: 'hour', snapMinutes: 60, cellOverrides: [],
    }),
  }, admin);
  assert.equal(source.response.status, 201);
  const before = (await request('/api/v1/reservations?pageSize=200', {}, admin)).data.total;
  const invalidBatch = {
    actions: [
      { type: 'duplicate', reservationId: source.data.id, sourceDate: '2027-04-01', sourceResourceId: 'resource_8', targetDate: '2027-04-02', targetResourceId: 'resource_8' },
      { type: 'duplicate', reservationId: source.data.id, sourceDate: '2027-04-09', sourceResourceId: 'resource_8', targetDate: '2027-04-03', targetResourceId: 'resource_8' },
    ],
  };
  const rejected = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'sprint4-batch-rollback' }, body: JSON.stringify(invalidBatch) }, admin);
  assert.equal(rejected.response.status, 404, JSON.stringify(rejected.data));
  assert.equal(rejected.data.error.code, 'CELL_NOT_FOUND');
  assert.equal((await request('/api/v1/reservations?pageSize=200', {}, admin)).data.total, before);

  const validBatch = {
    actions: [
      { type: 'duplicate', reservationId: source.data.id, sourceDate: '2027-04-01', sourceResourceId: 'resource_8', targetDate: '2027-04-02', targetResourceId: 'resource_8' },
      { type: 'duplicate', reservationId: source.data.id, sourceDate: '2027-04-01', sourceResourceId: 'resource_8', targetDate: '2027-04-03', targetResourceId: 'resource_8' },
    ],
  };
  const headers = { 'Idempotency-Key': 'sprint4-batch-success' };
  const createdBatch = await request('/api/v1/reservations/batch', { method: 'POST', headers, body: JSON.stringify(validBatch) }, admin);
  assert.equal(createdBatch.response.status, 201);
  assert.equal(createdBatch.data.items.length, 2);
  assert.equal(new Set(createdBatch.data.items.map(item => item.id)).size, 2);
  const replay = await request('/api/v1/reservations/batch', { method: 'POST', headers, body: JSON.stringify(validBatch) }, admin);
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.data.items.map(item => item.id), createdBatch.data.items.map(item => item.id));
  assert.equal((await request('/api/v1/reservations?pageSize=200', {}, admin)).data.total, before + 2);
  const divergence = await request('/api/v1/reservations/batch', { method: 'POST', headers, body: JSON.stringify({ actions: validBatch.actions.slice(0, 1) }) }, admin);
  assert.equal(divergence.response.status, 409);
  assert.equal(divergence.data.error.code, 'IDEMPOTENCY_CONFLICT');

  const invalidCancel = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-batch-cancel-rollback' },
    body: JSON.stringify({ actions: [
      { type: 'cancel', reservationId: createdBatch.data.items[0].id, version: createdBatch.data.items[0].version },
      { type: 'cancel', reservationId: createdBatch.data.items[1].id, version: 999 },
    ] }),
  }, admin);
  assert.equal(invalidCancel.response.status, 409);
  assert.equal(invalidCancel.data.error.code, 'VERSION_CONFLICT');
  assert.equal((await request(`/api/v1/reservations/${createdBatch.data.items[0].id}`, {}, admin)).data.status, 'confirmed');

  const cancelPayload = { actions: createdBatch.data.items.map(item => ({ type: 'cancel', reservationId: item.id, version: item.version })) };
  const cancelHeaders = { 'Idempotency-Key': 'sprint4-batch-cancel' };
  const cancelled = await request('/api/v1/reservations/batch', { method: 'POST', headers: cancelHeaders, body: JSON.stringify(cancelPayload) }, admin);
  assert.equal(cancelled.response.status, 201);
  assert.ok(cancelled.data.items.every(item => item.status === 'cancelled' && item.version === 2));
  const cancelReplay = await request('/api/v1/reservations/batch', { method: 'POST', headers: cancelHeaders, body: JSON.stringify(cancelPayload) }, admin);
  assert.equal(cancelReplay.response.status, 200);
  assert.deepEqual(cancelReplay.data.items.map(item => item.id), cancelled.data.items.map(item => item.id));
  const restorePayload = { actions: cancelled.data.items.map(item => ({ type: 'restore', reservationId: item.id, version: item.version })) };
  const restoreHeaders = { 'Idempotency-Key': 'sprint4-batch-restore' };
  const restored = await request('/api/v1/reservations/batch', { method: 'POST', headers: restoreHeaders, body: JSON.stringify(restorePayload) }, admin);
  assert.equal(restored.response.status, 201);
  assert.ok(restored.data.items.every(item => item.status === 'confirmed' && item.version === 3 && item.cancelledFromStatus === undefined));
  const restoreReplay = await request('/api/v1/reservations/batch', { method: 'POST', headers: restoreHeaders, body: JSON.stringify(restorePayload) }, admin);
  assert.equal(restoreReplay.response.status, 200);
  assert.deepEqual(restoreReplay.data.items.map(item => item.id), restored.data.items.map(item => item.id));

  const rejectedMove = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-batch-move-rollback' },
    body: JSON.stringify({ actions: [
      { type: 'move', reservationId: restored.data.items[0].id, version: restored.data.items[0].version, targetDate: '2027-04-18', targetResourceId: 'resource_8' },
      { type: 'move', reservationId: restored.data.items[1].id, version: 999, targetDate: '2027-04-19', targetResourceId: 'resource_8' },
    ] }),
  }, admin);
  assert.equal(rejectedMove.response.status, 409);
  assert.equal(rejectedMove.data.error.code, 'VERSION_CONFLICT');
  assert.equal((await request(`/api/v1/reservations/${restored.data.items[0].id}`, {}, admin)).data.startsAt.slice(0, 10), '2027-04-02');
  const movePayload = { actions: restored.data.items.map((item, index) => ({ type: 'move', reservationId: item.id, version: item.version, targetDate: `2027-04-${20 + index}`, targetResourceId: index ? 'resource_3' : 'resource_8' })) };
  const moveHeaders = { 'Idempotency-Key': 'sprint4-batch-move-success' };
  const moved = await request('/api/v1/reservations/batch', { method: 'POST', headers: moveHeaders, body: JSON.stringify(movePayload) }, admin);
  assert.equal(moved.response.status, 201);
  assert.deepEqual(moved.data.items.map(item => item.startsAt.slice(0, 10)), ['2027-04-20', '2027-04-21']);
  assert.deepEqual(moved.data.items.map(item => item.resources[0].resourceId), ['resource_8', 'resource_3']);
  assert.ok(moved.data.items.every(item => item.version === 4));
  const moveReplay = await request('/api/v1/reservations/batch', { method: 'POST', headers: moveHeaders, body: JSON.stringify(movePayload) }, admin);
  assert.equal(moveReplay.response.status, 200);
  assert.deepEqual(moveReplay.data.items.map(item => item.id), moved.data.items.map(item => item.id));

  const rejectedResize = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-batch-resize-rollback' },
    body: JSON.stringify({ actions: [
      { type: 'resize', reservationId: moved.data.items[0].id, version: moved.data.items[0].version, startsAt: moved.data.items[0].startsAt, endsAt: '2027-04-22T09:00:00.000Z' },
      { type: 'resize', reservationId: moved.data.items[1].id, version: 999, startsAt: moved.data.items[1].startsAt, endsAt: '2027-04-23T09:00:00.000Z' },
    ] }),
  }, admin);
  assert.equal(rejectedResize.response.status, 409);
  assert.equal(rejectedResize.data.error.code, 'VERSION_CONFLICT');
  assert.equal((await request(`/api/v1/reservations/${moved.data.items[0].id}`, {}, admin)).data.endsAt.slice(0, 10), '2027-04-20');
  const resizePayload = { actions: moved.data.items.map((item, index) => ({ type: 'resize', reservationId: item.id, version: item.version, startsAt: item.startsAt, endsAt: `2027-04-${22 + index}T09:00:00.000Z` })) };
  const resizeHeaders = { 'Idempotency-Key': 'sprint4-batch-resize-success' };
  const resized = await request('/api/v1/reservations/batch', { method: 'POST', headers: resizeHeaders, body: JSON.stringify(resizePayload) }, admin);
  assert.equal(resized.response.status, 201);
  assert.deepEqual(resized.data.items.map(item => item.endsAt.slice(0, 10)), ['2027-04-22', '2027-04-23']);
  assert.ok(resized.data.items.every(item => item.version === 5));
  const resizeReplay = await request('/api/v1/reservations/batch', { method: 'POST', headers: resizeHeaders, body: JSON.stringify(resizePayload) }, admin);
  assert.equal(resizeReplay.response.status, 200);
  assert.deepEqual(resizeReplay.data.items.map(item => item.id), resized.data.items.map(item => item.id));

  const paintAction = date => ({ type: 'create', title: 'Peinture Sprint 4', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed', startsAt: `${date}T08:00:00.000Z`, endsAt: `${date}T09:00:00.000Z`, resources: [{ resourceId: 'resource_8', quantity: 1 }], includeWeekends: true, planningMode: 'dailyCells', timeGranularity: 'hour', snapMinutes: 60 });
  const beforePaint = (await request('/api/v1/reservations?pageSize=200', {}, admin)).data.total;
  const rejectedPaint = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'sprint4-paint-rollback' }, body: JSON.stringify({ actions: [paintAction('2027-04-10'), paintAction('2027-04-10')] }) }, admin);
  assert.equal(rejectedPaint.response.status, 409);
  assert.equal(rejectedPaint.data.error.code, 'PLANNING_CONFLICT');
  assert.equal((await request('/api/v1/reservations?pageSize=200', {}, admin)).data.total, beforePaint);
  const paintPayload = { actions: [paintAction('2027-04-10'), paintAction('2027-04-11')] };
  const painted = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'sprint4-paint-success' }, body: JSON.stringify(paintPayload) }, admin);
  assert.equal(painted.response.status, 201);
  assert.equal(painted.data.items.length, 2);
  assert.ok(painted.data.items.every(item => item.projectId === 'project_1' && item.resources[0].resourceId === 'resource_8'));
  const paintedReplay = await request('/api/v1/reservations/batch', { method: 'POST', headers: { 'Idempotency-Key': 'sprint4-paint-success' }, body: JSON.stringify(paintPayload) }, admin);
  assert.equal(paintedReplay.response.status, 200);
  assert.deepEqual(paintedReplay.data.items.map(item => item.id), painted.data.items.map(item => item.id));
});

test('les déplacements et copies batch conservent les heures locales autour du changement DST', async () => {
  const nonexistentLocalTimeSource = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({
    title: 'Batch DST heure inexistante', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
    startsAt: '2027-03-26T01:30:00.000Z', endsAt: '2027-03-26T02:30:00.000Z',
    resources: [{ resourceId: 'resource_7', quantity: 1 }], includeWeekends: true, planningMode: 'dailyCells',
  }) }, admin);
  assert.equal(nonexistentLocalTimeSource.response.status, 201);
  const nonexistentMove = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-dst-nonexistent-move' },
    body: JSON.stringify({ actions: [{ type: 'move', reservationId: nonexistentLocalTimeSource.data.id, version: nonexistentLocalTimeSource.data.version, targetDate: '2027-03-28', targetResourceId: 'resource_7' }] }),
  }, admin);
  assert.equal(nonexistentMove.response.status, 422);
  assert.equal(nonexistentMove.data.error.code, 'VALIDATION_ERROR');
  const unchangedAfterMove = await request(`/api/v1/reservations/${nonexistentLocalTimeSource.data.id}`, {}, admin);
  assert.equal(unchangedAfterMove.data.startsAt, nonexistentLocalTimeSource.data.startsAt);
  assert.equal(unchangedAfterMove.data.version, nonexistentLocalTimeSource.data.version);
  const nonexistentCopy = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-dst-nonexistent-copy' },
    body: JSON.stringify({ actions: [{ type: 'duplicate', reservationId: nonexistentLocalTimeSource.data.id, sourceDate: '2027-03-26', sourceResourceId: 'resource_7', targetDate: '2027-03-28', targetResourceId: 'resource_7' }] }),
  }, admin);
  assert.equal(nonexistentCopy.response.status, 422);
  assert.equal(nonexistentCopy.data.error.code, 'VALIDATION_ERROR');

  const ambiguousMoveSource = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({
    title: 'Batch DST ambigu move', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
    startsAt: '2027-10-30T00:30:00.000Z', endsAt: '2027-10-30T01:30:00.000Z',
    resources: [{ resourceId: 'resource_7', quantity: 1 }], includeWeekends: true, planningMode: 'dailyCells',
  }) }, admin);
  assert.equal(ambiguousMoveSource.response.status, 201);
  const ambiguousMoved = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-dst-ambiguous-move' },
    body: JSON.stringify({ actions: [{ type: 'move', reservationId: ambiguousMoveSource.data.id, version: ambiguousMoveSource.data.version, targetDate: '2027-10-31', targetResourceId: 'resource_7' }] }),
  }, admin);
  assert.equal(ambiguousMoved.response.status, 201, JSON.stringify(ambiguousMoved.data));
  assert.equal(ambiguousMoved.data.items[0].startsAt, '2027-10-31T00:30:00.000Z');

  const ambiguousCopySource = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({
    title: 'Batch DST ambigu duplicate', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
    startsAt: '2027-10-30T00:30:00.000Z', endsAt: '2027-10-30T01:30:00.000Z',
    resources: [{ resourceId: 'resource_8', quantity: 1 }], includeWeekends: true, planningMode: 'dailyCells',
  }) }, admin);
  assert.equal(ambiguousCopySource.response.status, 201);
  const ambiguousCopied = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-dst-ambiguous-copy' },
    body: JSON.stringify({ actions: [{ type: 'duplicate', reservationId: ambiguousCopySource.data.id, sourceDate: '2027-10-30', sourceResourceId: 'resource_8', targetDate: '2027-10-31', targetResourceId: 'resource_8' }] }),
  }, admin);
  assert.equal(ambiguousCopied.response.status, 201, JSON.stringify(ambiguousCopied.data));
  assert.equal(ambiguousCopied.data.items[0].startsAt, '2027-10-31T00:30:00.000Z');

  const source = await request('/api/v1/reservations', { method: 'POST', body: JSON.stringify({
    title: 'Batch DST local', siteId: 'site_paris', projectId: 'project_1', status: 'confirmed',
    startsAt: '2027-03-27T22:30:00.000Z', endsAt: '2027-03-28T01:30:00.000Z',
    resources: [{ resourceId: 'resource_7', quantity: 1 }], includeWeekends: true, planningMode: 'dailyCells',
  }) }, admin);
  assert.equal(source.response.status, 201);
  const moved = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-dst-move' },
    body: JSON.stringify({ actions: [{ type: 'move', reservationId: source.data.id, version: source.data.version, targetDate: '2027-03-29', targetResourceId: 'resource_7' }] }),
  }, admin);
  assert.equal(moved.response.status, 201, JSON.stringify(moved.data));
  assert.equal(moved.data.items[0].startsAt, '2027-03-29T21:30:00.000Z');
  assert.equal(moved.data.items[0].endsAt, '2027-03-30T01:30:00.000Z');
  const copied = await request('/api/v1/reservations/batch', {
    method: 'POST', headers: { 'Idempotency-Key': 'sprint4-dst-copy' },
    body: JSON.stringify({ actions: [{ type: 'duplicate', reservationId: source.data.id, sourceDate: '2027-03-29', sourceResourceId: 'resource_7', targetDate: '2027-04-02', targetResourceId: 'resource_7' }] }),
  }, admin);
  assert.equal(copied.response.status, 201, JSON.stringify(copied.data));
  assert.equal(copied.data.items[0].startsAt, '2027-04-02T21:30:00.000Z');
  assert.equal(copied.data.items[0].endsAt, '2027-04-03T01:30:00.000Z');
});
