'use strict';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint5-realtime-${process.pid}-${Date.now()}.json`);

const { createServer, makeSeed, resetData } = require('../server.js');

let server;
let baseUrl;
let operation = 0;

async function listen() {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function closeServer() {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
}

async function request(route, options = {}, auth) {
  const method = options.method || 'GET';
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (!['GET', 'HEAD'].includes(method) && route !== '/api/v1/auth/login' && !headers['Idempotency-Key']) headers['Idempotency-Key'] = `s5-realtime-${++operation}`;
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, method, headers });
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

async function openEventStream(auth) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/v1/events`, { headers: { cookie: auth.cookie, accept: 'text/event-stream' }, signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffered = '';
  while (!buffered.includes(': connected')) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error('Flux SSE fermé avant connexion.');
    buffered += decoder.decode(chunk.value, { stream: true });
  }
  return { controller, reader, decoder, buffered: buffered.replace(/^.*?: connected\n\n/s, '') };
}

async function nextEvent(stream, predicate, timeoutMs = 1500) {
  const read = async () => {
    while (true) {
      while (!stream.buffered.includes('\n\n')) {
        const chunk = await stream.reader.read();
        if (chunk.done) return null;
        stream.buffered += stream.decoder.decode(chunk.value, { stream: true });
      }
      const boundary = stream.buffered.indexOf('\n\n'), raw = stream.buffered.slice(0, boundary);
      stream.buffered = stream.buffered.slice(boundary + 2);
      const dataLine = raw.split('\n').find(line => line.startsWith('data: '));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6));
      if (predicate(event)) return event;
    }
  };
  return Promise.race([read(), new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))]);
}

function closeEventStream(stream) {
  stream.controller.abort();
  stream.reader.cancel().catch(() => {});
}

before(async () => {
  resetData(makeSeed());
  await listen();
});

after(async () => {
  await closeServer();
});

test('Sprint 5 temps réel : trois sessions, SSE, présence, conflit et redémarrage', async () => {
  const admin = await login('admin@northlight.fr');
  const plannerA = await login('planner@northlight.fr');
  const plannerB = await login('planner@northlight.fr');
  const streamA = await openEventStream(plannerA), streamB = await openEventStream(plannerB);
  const duplicateStream = await request('/api/v1/events', { headers: { accept: 'text/event-stream' } }, plannerA);
  assert.equal(duplicateStream.response.status, 429);
  assert.equal(duplicateStream.data.error.code, 'SSE_SESSION_LIMIT');

  const memberships = await request('/api/v1/memberships?pageSize=200', {}, admin);
  const plannerMembership = memberships.data.items.find(value => value.userId === 'user_planner');
  const skill = await request('/api/v1/person-skills', {
    method: 'POST', headers: { 'Idempotency-Key': 's5-three-sessions-skill' },
    body: JSON.stringify({ membershipId: plannerMembership.id, code: 'TECHNICAL', name: 'Support technique', level: 3 }),
  }, admin);
  assert.equal(skill.response.status, 201);
  assert.equal((await nextEvent(streamA, event => event.type === 'personSkill.updated.v1'))?.entityId, skill.data.id);
  assert.equal((await nextEvent(streamB, event => event.type === 'personSkill.updated.v1'))?.entityId, skill.data.id);

  const created = await request('/api/v1/reservations', {
    method: 'POST',
    headers: { 'Idempotency-Key': 's5-three-sessions-create' },
    body: JSON.stringify({
      title: 'Sprint 5 · trois sessions', siteId: 'site_paris', projectId: 'project_1', status: 'draft',
      startsAt: '2035-04-15T07:00:00.000Z', endsAt: '2035-04-15T09:00:00.000Z',
      resources: [{ resourceId: 'resource_5', quantity: 1 }],
    }),
  }, admin);
  assert.equal(created.response.status, 201);
  assert.ok(await nextEvent(streamA, event => event.entityId === created.data.id));
  assert.ok(await nextEvent(streamB, event => event.entityId === created.data.id));

  const acquired = await request(`/api/v1/reservations/${created.data.id}/presence`, {
    method: 'PUT', body: JSON.stringify({ version: created.data.version, intent: 'editing' }),
  }, plannerA);
  assert.equal(acquired.response.status, 200);
  const locked = await request(`/api/v1/reservations/${created.data.id}/presence`, {
    method: 'PUT', body: JSON.stringify({ version: created.data.version, intent: 'moving' }),
  }, plannerB);
  assert.equal(locked.response.status, 423);
  assert.equal(locked.data.error.code, 'RESERVATION_LOCKED');

  const updated = await request(`/api/v1/reservations/${created.data.id}`, {
    method: 'PATCH', headers: { 'Idempotency-Key': 's5-three-sessions-update' },
    body: JSON.stringify({ version: created.data.version, title: 'Sprint 5 · mise à jour concurrente' }),
  }, admin);
  assert.equal(updated.response.status, 200);
  assert.ok(await nextEvent(streamA, event => event.entityId === created.data.id && event.entityVersion === updated.data.version));
  assert.ok(await nextEvent(streamB, event => event.entityId === created.data.id && event.entityVersion === updated.data.version));

  const stale = await request(`/api/v1/reservations/${created.data.id}`, {
    method: 'PATCH', headers: { 'Idempotency-Key': 's5-three-sessions-stale' },
    body: JSON.stringify({ version: created.data.version, title: 'Écrasement interdit' }),
  }, plannerB);
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.error.code, 'VERSION_CONFLICT');
  const unchanged = await request(`/api/v1/reservations/${created.data.id}`, {}, plannerB);
  assert.equal(unchanged.data.title, updated.data.title);
  assert.equal(unchanged.data.version, updated.data.version);

  const logout = await request('/api/v1/auth/logout', { method: 'POST' }, plannerA);
  assert.equal(logout.response.status, 204);
  const released = await nextEvent(streamB, event => event.type === 'reservation.presenceReleased.v1' && event.entityId === created.data.id);
  assert.equal(released?.entityId, created.data.id);
  const reacquired = await request(`/api/v1/reservations/${created.data.id}/presence`, {
    method: 'PUT', body: JSON.stringify({ version: updated.data.version, intent: 'editing' }),
  }, plannerB);
  assert.equal(reacquired.response.status, 200);

  closeEventStream(streamA); closeEventStream(streamB);
  await closeServer();
  await listen();

  const afterRestart = await login('planner@northlight.fr');
  const persisted = await request(`/api/v1/reservations/${created.data.id}`, {}, afterRestart);
  assert.equal(persisted.response.status, 200);
  assert.equal(persisted.data.title, 'Sprint 5 · mise à jour concurrente');
  assert.equal(persisted.data.version, updated.data.version);

  const reconnected = await openEventStream(afterRestart);
  const adminAfterRestart = await login('admin@northlight.fr');
  const finalUpdate = await request(`/api/v1/reservations/${created.data.id}`, {
    method: 'PATCH', headers: { 'Idempotency-Key': 's5-after-restart-update' },
    body: JSON.stringify({ version: persisted.data.version, title: 'Sprint 5 · persistance confirmée' }),
  }, adminAfterRestart);
  assert.equal(finalUpdate.response.status, 200);
  assert.ok(await nextEvent(reconnected, event => event.entityId === created.data.id && event.entityVersion === finalUpdate.data.version));
  closeEventStream(reconnected);
});
