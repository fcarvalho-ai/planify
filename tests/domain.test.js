'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mins,
  time,
  overlaps,
  bookingIssues,
  occupancy,
  seed,
  clone,
  unauthenticatedState,
  shouldEndSession,
} = require('../app.js');

const resource = (overrides = {}) => ({
  id: 'resource-1',
  name: 'Salle QA',
  type: 'room',
  siteId: 'site-1',
  capacity: 1,
  ...overrides,
});

const booking = (overrides = {}) => ({
  id: 'booking-candidate',
  title: 'Session QA',
  projectId: 'project-1',
  resourceId: 'resource-1',
  date: '2026-08-17',
  start: '09:00',
  end: '10:00',
  status: 'confirmed',
  people: 1,
  ...overrides,
});

test('mins et time convertissent les heures aux limites utiles', () => {
  assert.equal(mins('00:00'), 0);
  assert.equal(mins('09:30'), 570);
  assert.equal(mins('23:59'), 1439);
  assert.equal(time(0), '00:00');
  assert.equal(time(570), '09:30');
  assert.equal(time(1439), '23:59');
});

test('le démarrage ignore un utilisateur restauré localement jusqu’à une nouvelle connexion', () => {
  const persisted = clone(seed);
  persisted.user = { id: 'persisted-user', role: 'admin' };

  const initial = unauthenticatedState(persisted);

  assert.equal(initial.user, null);
  assert.equal(persisted.user.id, 'persisted-user');
});

test('une réponse non authentifiée quitte la session sans confondre un échec de connexion', () => {
  assert.equal(shouldEndSession('/api/v1/reservations', 401), true);
  assert.equal(shouldEndSession('/api/v1/auth/login', 401), false);
  assert.equal(shouldEndSession('/api/v1/reservations', 403), false);
});

test('overlaps applique des intervalles semi-ouverts : deux créneaux adjacents sont acceptés', () => {
  const left = booking({ id: 'left', start: '09:00', end: '10:00' });
  const right = booking({ id: 'right', start: '10:00', end: '11:00' });

  assert.equal(overlaps(left, right), false);
  assert.equal(overlaps(right, left), false);
});

test('overlaps détecte les intersections partielles, incluses, englobantes et identiques', () => {
  const existing = booking({ id: 'existing', start: '10:00', end: '12:00' });
  const candidates = [
    booking({ start: '09:00', end: '11:00' }),
    booking({ start: '11:00', end: '13:00' }),
    booking({ start: '10:30', end: '11:30' }),
    booking({ start: '09:00', end: '13:00' }),
    booking({ start: '10:00', end: '12:00' }),
  ];

  for (const candidate of candidates) assert.equal(overlaps(existing, candidate), true);
});

test('overlaps exige la même date et la même ressource', () => {
  const base = booking({ id: 'base' });
  assert.equal(overlaps(base, booking({ date: '2026-08-18' })), false);
  assert.equal(overlaps(base, booking({ resourceId: 'resource-2' })), false);
});

test('overlaps ignore une réservation annulée dans les deux sens', () => {
  const active = booking({ id: 'active' });
  const cancelled = booking({ id: 'cancelled', status: 'cancelled' });
  assert.equal(overlaps(active, cancelled), false);
  assert.equal(overlaps(cancelled, active), false);
});

test('bookingIssues refuse une fin égale ou antérieure au début', () => {
  const resources = [resource()];
  assert.match(bookingIssues(booking({ end: '09:00' }), [], resources).join(' '), /fin/i);
  assert.match(bookingIssues(booking({ end: '08:59' }), [], resources).join(' '), /fin/i);
});

test('bookingIssues accepte une réservation valide et adjacente', () => {
  const existing = booking({ id: 'existing', start: '08:00', end: '09:00' });
  assert.deepEqual(bookingIssues(booking(), [existing], [resource()]), []);
});

test('bookingIssues refuse une ressource absente ou inconnue', () => {
  const missing = booking({ resourceId: '' });
  const unknown = booking({ resourceId: 'resource-does-not-exist' });
  assert.ok(bookingIssues(missing, [], [resource()]).length > 0);
  assert.ok(bookingIssues(unknown, [], [resource()]).length > 0);
});

test('bookingIssues refuse une date invalide', () => {
  for (const date of ['', '17/08/2026', '2026-02-30']) {
    assert.ok(bookingIssues(booking({ date }), [], [resource()]).length > 0, `date acceptée : ${date}`);
  }
});

test('bookingIssues refuse les statuts hors catalogue fermé', () => {
  for (const status of ['', 'pending', 'CONFIRMED']) {
    assert.ok(bookingIssues(booking({ status }), [], [resource()]).length > 0, `statut accepté : ${status}`);
  }
});

test('bookingIssues accepte les sept statuts Sprint 2', () => {
  for (const status of ['draft', 'option', 'confirmed', 'completed', 'cancelled', 'unavailable', 'maintenance']) {
    assert.deepEqual(bookingIssues(booking({ status }), [], [resource()]), [], `statut refusé : ${status}`);
  }
});

test('bookingIssues refuse une quantité non positive, non entière ou non numérique', () => {
  for (const people of [0, -1, 1.5, Number.NaN]) {
    assert.ok(bookingIssues(booking({ people }), [], [resource({ capacity: 3 })]).length > 0, `quantité acceptée : ${people}`);
  }
});

test('bookingIssues refuse une réservation dépassant à elle seule la capacité', () => {
  const issues = bookingIssues(booking({ people: 4 }), [], [resource({ capacity: 3 })]);
  assert.match(issues.join(' '), /capacité.*dépassée/i);
});

test('bookingIssues calcule la capacité agrégée sur les réservations simultanées', () => {
  const resources = [resource({ capacity: 3 })];
  const existing = [
    booking({ id: 'existing-1', start: '09:00', end: '11:00', people: 2 }),
  ];
  const candidate = booking({ id: 'candidate', start: '10:00', end: '12:00', people: 2 });
  assert.match(bookingIssues(candidate, existing, resources).join(' '), /capacité.*dépassée/i);
});

test('bookingIssues ignore la capacité consommée par une réservation annulée', () => {
  const existing = booking({ id: 'old', status: 'cancelled', people: 3 });
  assert.deepEqual(
    bookingIssues(booking({ people: 3 }), [existing], [resource({ capacity: 3 })]),
    [],
  );
});

test('occupancy additionne uniquement les heures des réservations actives', () => {
  const metrics = occupancy([
    booking({ start: '09:00', end: '11:00', status: 'confirmed' }),
    booking({ id: 'option', start: '12:00', end: '13:30', status: 'option' }),
    booking({ id: 'cancelled', start: '14:00', end: '18:00', status: 'cancelled' }),
  ]);
  assert.equal(metrics.hours, 3.5);
});

test('occupancy retourne 0 heure et 0 % pour une période vide', () => {
  assert.deepEqual(occupancy([]), { hours: 0, rate: 0 });
});

test('occupancy pondère le taux par la quantité réservée et la capacité', () => {
  const oneSeat = occupancy([booking({ people: 1, start: '09:00', end: '10:00' })], seed.resources.slice(0,1));
  const threeSeats = occupancy([booking({ people: 3, start: '09:00', end: '10:00' })], seed.resources.slice(0,1));
  assert.notEqual(oneSeat.rate, threeSeats.rate);
  assert.ok(threeSeats.rate > oneSeat.rate);
});

test('le seed est déterministe, cohérent et couvre confirmé et option', () => {
  const copy = clone(seed);
  assert.deepEqual(copy, seed);
  assert.notEqual(copy, seed);
  assert.equal(seed.version, 3);
  assert.equal(seed.sites.length, 2);
  assert.equal(seed.clients.length, 3);
  assert.equal(seed.projects.length, 5);
  assert.equal(seed.resources.length, 75);
  assert.equal(seed.resources.filter(({ name }) => name.startsWith('Salle de montage AVID ')).length, 55);
  assert.equal(seed.resources.filter(({ name }) => name.startsWith('Poste Remote AVID ')).length, 20);
  assert.equal(seed.bookings.length, 5);
  assert.deepEqual(new Set(seed.bookings.map(({ status }) => status)), new Set(['confirmed', 'option', 'cancelled']));
  assert.ok(seed.bookings.every(({ projectId }) => seed.projects.some(({ id }) => id === projectId)));
  assert.ok(seed.bookings.every(({ resourceId }) => seed.resources.some(({ id }) => id === resourceId)));
  assert.ok(seed.bookings.every(({ start, end }) => mins(start) < mins(end)));
  assert.ok(seed.resources.every(({ capacity }) => Number.isInteger(capacity) && capacity > 0));
});

test('le seed couvre aussi les statuts et cas limites annoncés pour la démonstration', () => {
  assert.ok(seed.bookings.some(({ status }) => status === 'cancelled'), 'réservation annulée absente');
  assert.ok(
    seed.bookings.some((a, index) => seed.bookings.slice(index + 1).some((b) =>
      a.resourceId === b.resourceId && a.date === b.date && a.end === b.start)),
    'réservations adjacentes absentes',
  );
});
