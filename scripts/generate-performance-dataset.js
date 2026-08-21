#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function dateAt(day, hour = 8) {
  return new Date(Date.UTC(2026, 0, 1 + day, hour)).toISOString();
}

function generatePerformanceDataset() {
  const companyId = 'company_performance';
  const sites = Array.from({ length: 5 }, (_, index) => ({ id: `site_${index + 1}`, companyId, name: `Site ${index + 1}`, timezone: 'Europe/Paris', active: true }));
  const resources = Array.from({ length: 250 }, (_, index) => ({ id: `resource_${index + 1}`, companyId, siteId: sites[index % sites.length].id, name: `Ressource ${String(index + 1).padStart(3, '0')}`, capacity: index % 10 === 0 ? 4 : 1, active: true }));
  const projects = Array.from({ length: 40 }, (_, index) => ({ id: `project_${index + 1}`, companyId, siteId: sites[index % sites.length].id, name: `Projet ${index + 1}` }));
  const reservations = Array.from({ length: 10_000 }, (_, index) => {
    const resource = resources[index % resources.length];
    const startDay = index % 181;
    return { id: `reservation_${index + 1}`, companyId, siteId: resource.siteId, projectId: projects[index % projects.length].id, status: index % 29 === 0 ? 'cancelled' : 'confirmed', startsAt: dateAt(startDay), endsAt: dateAt(startDay, 18), allocations: [{ resourceId: resource.id, quantity: 1 }] };
  });
  return { metadata: { generatedAt: '2026-08-19T00:00:00.000Z', periodMonths: 6 }, companies: [{ id: companyId }], sites, projects, resources, reservations };
}

if (require.main === module) {
  const outputFlag = process.argv.indexOf('--output');
  if (outputFlag < 0 || !process.argv[outputFlag + 1]) throw new Error('Usage: node scripts/generate-performance-dataset.js --output <fichier.json>');
  const destination = path.resolve(process.argv[outputFlag + 1]);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(generatePerformanceDataset())}\n`, { mode: 0o600 });
  process.stdout.write(`${destination}\n`);
}

module.exports = { generatePerformanceDataset };
