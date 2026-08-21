#!/usr/bin/env node
'use strict';

const { createServer, makeSeed, resetData } = require('../server');

function at(day, hour) { return new Date(Date.UTC(2026, 0, 1 + day, hour)).toISOString(); }

const companyId = 'company_northlight';
const siteId = 'site_paris';
const seed = makeSeed();
seed.resources = Array.from({ length: 250 }, (_, index) => ({
  id: `perf_resource_${index + 1}`,
  companyId,
  siteId,
  name: `Ressource performance ${String(index + 1).padStart(3, '0')}`,
  type: 'room',
  capacity: 1,
  color: '#7667f5',
  active: true,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}));
seed.reservations = Array.from({ length: 10_000 }, (_, index) => ({
  id: `perf_reservation_${index + 1}`,
  companyId,
  siteId,
  projectId: 'project_1',
  title: `Réservation performance ${index + 1}`,
  status: index % 29 === 0 ? 'cancelled' : 'confirmed',
  startsAt: at(index % 181, 8),
  endsAt: at(index % 181, 18),
  resources: [{ resourceId: `perf_resource_${index % 250 + 1}`, quantity: 1 }],
  planningMode: 'continuous',
  includeWeekends: true,
  cellOverrides: [],
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}));
resetData(seed);

const port = Number(process.env.PORT || 8197);
const server = createServer();
server.listen(port, '127.0.0.1', () => process.stdout.write(`Planify performance preview: http://127.0.0.1:${port}\n`));

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
