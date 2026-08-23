'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDataFile = path.join(os.tmpdir(), `planify-sprint1-data-${process.pid}-${Date.now()}.json`);
process.env.PLANIFY_DATA_FILE = testDataFile;

const { createServer, resetData, makeSeed, readDb, canonicalProjectStatus, resolvedRatePrice, rateForSource, universalSearch, revenueChain, rollbackSprint1Migrations } = require('../server.js');

let server;
let baseUrl;
let admin;
let viewer;
let operation = 0;
let sprintUnit;

async function request(route, options = {}, auth = admin) {
  const method = options.method || 'GET';
  const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (!['GET', 'HEAD'].includes(method) && !headers['Idempotency-Key']) headers['Idempotency-Key'] = `sprint1-${++operation}`;
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, method, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { response, data };
}

before(async () => {
  const seed = makeSeed(), company = seed.companies[0];
  Object.assign(company, { registrationNumber: '184207833', establishmentNumber: '18420783300094', vatNumber: 'FR84184207833', taxCountry: 'FR', vatStatus: 'registered', fiscalValidatedAt: '2026-08-20T08:00:00.000Z', fiscalValidatedBy: 'user_admin', defaultVatRateId: 'vat_sprint1_standard' });
  seed.organizationAddresses = [{ id: 'address_sprint1_registered', companyId: company.id, type: 'registeredOffice', line1: '10 rue Sprint 1', postalCode: '75011', city: 'Paris', country: 'FR', isPrimary: true, version: 1 }];
  seed.vatRates = [{ id: 'vat_sprint1_standard', companyId: company.id, code: 'STANDARD', label: 'Taux normal', rateBps: 2000, active: true, validFrom: '2020-01-01', version: 1 }];
  seed.resources.push({ id: 'resource_sprint1_person', companyId: company.id, siteId: 'site_paris', name: 'Sophie Monteuse', type: 'person', capacity: 1, active: true, version: 1 });
  seed.clientContacts = [{ id: 'contact_sprint1_private', companyId: company.id, clientId: 'client_1', firstName: 'Contact', lastName: 'Confidentiel', jobTitle: 'Production', email: 'secret-sprint1-contact@example.test', phone: '+33199887766', active: true, version: 1 }];
  resetData(seed);
  server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }) }, null);
  assert.equal(login.response.status, 200);
  admin = { cookie: login.response.headers.get('set-cookie').split(';', 1)[0], csrf: login.data.csrfToken };
  const viewerLogin = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'viewer@northlight.fr', password: 'demo2026' }) }, null);
  assert.equal(viewerLogin.response.status, 200);
  viewer = { cookie: viewerLogin.response.headers.get('set-cookie').split(';', 1)[0], csrf: viewerLogin.data.csrfToken };
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const filename of fs.readdirSync(path.dirname(testDataFile))) {
    if (filename.startsWith(path.basename(testDataFile))) fs.rmSync(path.join(path.dirname(testDataFile), filename), { force: true });
  }
});

test('migration S1-A ajoute le cycle canonique et structure les prestations sans réécrire le statut historique', () => {
  const db = readDb();
  const marker = db.migrations.find(value => value.id === 'sprint-1-referentials-v1');
  const pricingMarker = db.migrations.find(value => value.id === 'sprint-1-pricing-v1');
  const analyticsMarker = db.migrations.find(value => value.id === 'sprint-1-analytics-v1');
  assert.ok(marker);
  assert.ok(pricingMarker);
  assert.ok(analyticsMarker);
  assert.match(marker.sourceDigest, /^[a-f0-9]{64}$/);
  assert.match(marker.outputDigest, /^[a-f0-9]{64}$/);
  assert.match(marker.integrityDigest, /^[a-f0-9]{64}$/);
  assert.match(pricingMarker.integrityDigest, /^[a-f0-9]{64}$/);
  assert.match(analyticsMarker.integrityDigest, /^[a-f0-9]{64}$/);
  assert.ok(db.roles.filter(role => ['organizationAdmin', 'FINANCE'].includes(role.code)).every(role => role.permissions.includes('finance.read')));
  assert.ok(db.rates.every(rate => rate.scope && rate.validFrom && Number.isInteger(rate.discountBps) && Array.isArray(rate.surcharges)));
  assert.ok(db.projects.every(project => project.lifecycleStatus));
  assert.equal(db.projects.find(project => project.id === 'project_1').status, 'active');
  assert.equal(db.projects.find(project => project.id === 'project_1').lifecycleStatus, 'confirmed');
  assert.deepEqual(['budget_preparation', 'quote_sent', 'post_production', 'archived'].map(canonicalProjectStatus), ['budget', 'quote', 'production', 'completed']);
});

test('S1 contrats canoniques : clients, responsabilités Projet et catégories Ressource sont complets', async () => {
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-1-contracts-v2');
  assert.ok(marker);
  assert.match(marker.integrityDigest, /^[a-f0-9]{64}$/);
  assert.ok(db.clients.every(client => /^[A-Z]{3}$/.test(client.currency) && Number.isInteger(client.paymentTermsDays) && client.paymentTermsDays >= 0 && client.paymentTermsDays <= 365 && client.billingTerms && client.billingAddress?.country));
  const activeMember = (companyId, userId) => db.users.some(user => user.id === userId && user.active !== false) && db.organizationMemberships.some(membership => membership.companyId === companyId && membership.userId === userId && membership.status === 'active');
  assert.ok(db.projects.every(project => ['salesOwnerId', 'projectManagerId', 'planningOwnerId'].every(field => activeMember(project.companyId, project[field]))));
  assert.ok(db.resources.every(resource => db.resourceCategories.some(category => category.id === resource.resourceCategoryId && category.companyId === resource.companyId && category.siteId === resource.siteId && category.resourceType === resource.type)));

  const categories = await request('/api/v1/resource-categories?siteId=site_paris&resourceType=room&pageSize=100');
  assert.equal(categories.response.status, 200);
  assert.ok(categories.data.items.length > 0);
  const badClient = await request('/api/v1/clients', { method: 'POST', body: JSON.stringify({ name: 'Client contrat invalide', code: 'BAD-CONTRACT', currency: 'EURO', paymentTermsDays: 500, billingTerms: 'Paiement.', billingAddress: { line1: '1 rue Test', postalCode: '75001', city: 'Paris', country: 'FR' } }) });
  assert.equal(badClient.response.status, 422);
  const missingAddress = await request('/api/v1/clients', { method: 'POST', body: JSON.stringify({ name: 'Client sans adresse', code: 'NO-ADDRESS', paymentTermsDays: 30, billingTerms: 'Paiement à 30 jours.' }) });
  assert.equal(missingAddress.response.status, 422);
  const inheritedCurrency = await request('/api/v1/clients', { method: 'POST', body: JSON.stringify({ name: 'Client devise société', code: 'COMPANY-CURRENCY', paymentTermsDays: 30, billingTerms: 'Paiement à 30 jours.', billingAddress: { line1: '2 rue Test', postalCode: '75001', city: 'Paris', country: 'FR' } }) });
  assert.equal(inheritedCurrency.response.status, 201, JSON.stringify(inheritedCurrency.data));
  assert.equal(inheritedCurrency.data.currency, 'EUR');
  const badProject = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Projet responsabilités invalides', code: 'BAD-OWNERS', clientId: 'client_1', siteId: 'site_paris', lifecycleStatus: 'prospect', salesOwnerId: 'user_absent', projectManagerId: 'user_admin', planningOwnerId: 'user_admin' }) });
  assert.equal(badProject.response.status, 422);
  const missingSite = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Projet sans site', code: 'NO-SITE', clientId: 'client_1', lifecycleStatus: 'prospect', salesOwnerId: 'user_admin', projectManagerId: 'user_admin', planningOwnerId: 'user_admin' }) });
  assert.equal(missingSite.response.status, 422);
  const missingOwners = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Projet sans responsables', code: 'NO-OWNERS', clientId: 'client_1', siteId: 'site_paris', lifecycleStatus: 'prospect' }) });
  assert.equal(missingOwners.response.status, 422);
  const legacyStatus = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Projet statut historique', code: 'LEGACY-STATUS', clientId: 'client_1', siteId: 'site_paris', status: 'active', salesOwnerId: 'user_admin', projectManagerId: 'user_admin', planningOwnerId: 'user_admin' }) });
  assert.equal(legacyStatus.response.status, 400);
  assert.equal(legacyStatus.data.error.code, 'VALIDATION_ERROR');
  const referencedClient = readDb().clients.find(value => value.id === 'client_1');
  const blockedClient = await request(`/api/v1/clients/${referencedClient.id}`, { method: 'PATCH', body: JSON.stringify({ version: referencedClient.version, active: false }) });
  assert.equal(blockedClient.response.status, 409);
  assert.equal(blockedClient.data.error.code, 'CLIENT_HAS_PROJECTS');
  const project = readDb().projects.find(value => value.id === 'project_1'), plannerMembership = readDb().organizationMemberships.find(value => value.companyId === project.companyId && value.userId === 'user_planner');
  const assigned = await request(`/api/v1/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ version: project.version, salesOwnerId: 'user_planner' }) });
  assert.equal(assigned.response.status, 200, JSON.stringify(assigned.data));
  const blockedMembership = await request(`/api/v1/memberships/${plannerMembership.id}`, { method: 'PATCH', body: JSON.stringify({ version: plannerMembership.version, status: 'suspended' }) });
  assert.equal(blockedMembership.response.status, 409);
  assert.equal(blockedMembership.data.error.code, 'PROJECT_OWNER_REASSIGNMENT_REQUIRED');
  assert.equal(readDb().organizationMemberships.find(value => value.id === plannerMembership.id).status, 'active');
});

test('le marqueur S1 protège la migration sans figer les champs Client modifiables', () => {
  const db = JSON.parse(fs.readFileSync(testDataFile, 'utf8')), client = db.clients[0];
  client.billingTerms = 'Paiement à 45 jours fin de mois.';
  client.paymentTermsDays = 45;
  client.billingAddress = { ...client.billingAddress, line1: '42 avenue des Contrats' };
  fs.writeFileSync(testDataFile, `${JSON.stringify(db, null, 2)}\n`, { mode: 0o600 });
  const reread = readDb(), persisted = reread.clients.find(value => value.id === client.id);
  assert.equal(persisted.billingTerms, 'Paiement à 45 jours fin de mois.');
  assert.equal(persisted.paymentTermsDays, 45);
  assert.equal(persisted.billingAddress.line1, '42 avenue des Contrats');

  const validRaw = fs.readFileSync(testDataFile, 'utf8'), tampered = JSON.parse(validRaw), marker = tampered.migrations.find(value => value.id === 'sprint-1-contracts-v2');
  marker.outputDigest = `${marker.outputDigest[0] === 'a' ? 'b' : 'a'}${marker.outputDigest.slice(1)}`;
  fs.writeFileSync(testDataFile, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 });
  try { assert.throws(() => readDb(), error => error?.code === 'MIGRATION_MARKER_CONFLICT'); }
  finally { fs.writeFileSync(testDataFile, validRaw, { mode: 0o600 }); }
});

test('le rejeu S1 refuse un Projet lié à un Client ou à un responsable inexistant', () => {
  const validRaw = fs.readFileSync(testDataFile, 'utf8');
  const assertInvalidReference = mutateProject => {
    const tampered = JSON.parse(validRaw), project = tampered.projects.find(value => value.id === 'project_1') || tampered.projects[0];
    assert.ok(project);
    mutateProject(project);
    fs.writeFileSync(testDataFile, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 });
    try { assert.throws(() => readDb(), error => error?.code === 'MIGRATION_MARKER_CONFLICT'); }
    finally { fs.writeFileSync(testDataFile, validRaw, { mode: 0o600 }); }
  };
  assertInvalidReference(project => { project.clientId = 'client_absent'; });
  assertInvalidReference(project => { project.salesOwnerId = 'user_absent'; });
});

test('S1-A crée une prestation structurée et refuse une prestation planifiable sans compatibilité', async () => {
  const units = await request('/api/v1/organization-units?pageSize=100');
  assert.equal(units.response.status, 200);
  let unit = units.data.items[0];
  if (!unit) {
    const created = await request('/api/v1/organization-units', { method: 'POST', body: JSON.stringify({ code: 'S1CAT', name: 'Catalogue Sprint 1', kind: 'service', activities: ['postProduction'], active: true }) });
    assert.equal(created.response.status, 201, JSON.stringify(created.data));
    unit = created.data;
  }
  sprintUnit = unit;
  const created = await request('/api/v1/service-offerings', { method: 'POST', body: JSON.stringify({ organizationUnitId: unit.id, code: 'S1_EDIT', name: 'Montage image Sprint 1', category: 'editing', defaultUnit: 'demi_journee', plannable: true, compatibleResourceTypes: ['room', 'suite'], compatibleResourceCategoryIds: [], active: true }) });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.defaultUnit, 'demi_journee');
  assert.equal(created.data.plannable, true);
  assert.deepEqual(created.data.compatibleResourceTypes, ['room', 'suite']);
  const invalid = await request('/api/v1/service-offerings', { method: 'POST', body: JSON.stringify({ organizationUnitId: unit.id, code: 'S1_INVALID', name: 'Prestation invalide', category: 'editing', defaultUnit: 'jour', plannable: true, compatibleResourceTypes: [], compatibleResourceCategoryIds: [] }) });
  assert.equal(invalid.response.status, 422);
  assert.equal(invalid.data.error.code, 'VALIDATION_ERROR');
  const unknownCategory = await request('/api/v1/service-offerings', { method: 'POST', body: JSON.stringify({ organizationUnitId: unit.id, code: 'S1_UNKNOWN_CATEGORY', name: 'Prestation catégorie inconnue', category: 'editing', defaultUnit: 'jour', plannable: true, compatibleResourceTypes: [], compatibleResourceCategoryIds: ['resourceCategory_absent'] }) });
  assert.equal(unknownCategory.response.status, 422);
  assert.equal(unknownCategory.data.error.code, 'VALIDATION_ERROR');
});

test('S1-A permet de maintenir une catégorie inutilisée et protège les catégories référencées', async () => {
  let created = await request('/api/v1/resource-categories', { method: 'POST', body: JSON.stringify({ siteId: 'site_paris', code: 'S1_TEMP', name: 'Catégorie temporaire', resourceType: 'other', active: true }) });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  let category = created.data;
  const updated = await request(`/api/v1/resource-categories/${category.id}`, { method: 'PATCH', body: JSON.stringify({ version: category.version, name: 'Catégorie temporaire renommée' }) });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  category = updated.data;
  const archived = await request(`/api/v1/resource-categories/${category.id}`, { method: 'DELETE', body: JSON.stringify({ version: category.version }) });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.data));
  assert.equal(archived.data.active, false);

  const inUse = readDb().resourceCategories.find(value => value.id === readDb().resources.find(resource => resource.id === 'resource_1').resourceCategoryId);
  const blocked = await request(`/api/v1/resource-categories/${inUse.id}`, { method: 'DELETE', body: JSON.stringify({ version: inUse.version }) });
  assert.equal(blocked.response.status, 409);
  assert.equal(blocked.data.error.code, 'RESOURCE_CATEGORY_IN_USE');
  const badResourceCategory = await request('/api/v1/resources/resource_1', { method: 'PATCH', body: JSON.stringify({ version: readDb().resources.find(resource => resource.id === 'resource_1').version, resourceCategoryId: 'resourceCategory_absent' }) });
  assert.equal(badResourceCategory.response.status, 422);
});

test('S1-A remappe catégories, ressources et prestations lors du remplacement sûr d’un site', async () => {
  const siteBody = (code, name) => ({ code, name, siteType: 'postProduction', address: { line1: '1 rue Sprint', postalCode: '75001', city: 'Paris', country: 'FR' }, timezone: 'Europe/Paris', activities: ['postProduction'], active: true });
  const oldSiteResult = await request('/api/v1/sites', { method: 'POST', body: JSON.stringify(siteBody('S1OLD', 'Site Sprint ancien')) });
  const newSiteResult = await request('/api/v1/sites', { method: 'POST', body: JSON.stringify(siteBody('S1NEW', 'Site Sprint remplacement')) });
  assert.equal(oldSiteResult.response.status, 201, JSON.stringify(oldSiteResult.data));
  assert.equal(newSiteResult.response.status, 201, JSON.stringify(newSiteResult.data));
  const oldSite = oldSiteResult.data, newSite = newSiteResult.data;
  const categoryResult = await request('/api/v1/resource-categories', { method: 'POST', body: JSON.stringify({ siteId: oldSite.id, code: 'S1_MOVE_ROOM', name: 'Salles à déplacer', resourceType: 'room', active: true }) });
  assert.equal(categoryResult.response.status, 201, JSON.stringify(categoryResult.data));
  const category = categoryResult.data;
  const resourceResult = await request('/api/v1/resources', { method: 'POST', body: JSON.stringify({ siteId: oldSite.id, resourceCategoryId: category.id, name: 'Salle Sprint mobile', type: 'room', capacity: 1, active: true }) });
  assert.equal(resourceResult.response.status, 201, JSON.stringify(resourceResult.data));
  const unitResult = await request('/api/v1/organization-units', { method: 'POST', body: JSON.stringify({ siteId: oldSite.id, code: 'S1MOVEUNIT', name: 'Unité mobile', kind: 'service', activities: ['postProduction'], active: true }) });
  assert.equal(unitResult.response.status, 201, JSON.stringify(unitResult.data));
  const offeringResult = await request('/api/v1/service-offerings', { method: 'POST', body: JSON.stringify({ organizationUnitId: unitResult.data.id, code: 'S1_MOVE_OFFERING', name: 'Prestation mobile', category: 'editing', defaultUnit: 'jour', plannable: true, compatibleResourceTypes: [], compatibleResourceCategoryIds: [category.id], active: true }) });
  assert.equal(offeringResult.response.status, 201, JSON.stringify(offeringResult.data));
  const replaced = await request(`/api/v1/sites/${oldSite.id}`, { method: 'PATCH', body: JSON.stringify({ version: oldSite.version, active: false, replacementSiteId: newSite.id }) });
  assert.equal(replaced.response.status, 200, JSON.stringify(replaced.data));
  const db = readDb(), movedResource = db.resources.find(value => value.id === resourceResult.data.id), movedUnit = db.organizationUnits.find(value => value.id === unitResult.data.id), movedOffering = db.serviceOfferings.find(value => value.id === offeringResult.data.id), mappedCategory = db.resourceCategories.find(value => value.id === movedResource.resourceCategoryId);
  assert.equal(movedResource.siteId, newSite.id);
  assert.equal(movedUnit.siteId, newSite.id);
  assert.equal(mappedCategory.siteId, newSite.id);
  assert.equal(mappedCategory.resourceType, movedResource.type);
  assert.deepEqual(movedOffering.compatibleResourceCategoryIds, [mappedCategory.id]);
});

test('S1-A historise le cycle Projet canonique et refuse une transition aléatoire', async () => {
  let result = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Projet Sprint 1', code: 'S1-PROJECT', clientId: 'client_1', siteId: 'site_paris', lifecycleStatus: 'prospect', salesOwnerId: 'user_admin', projectManagerId: 'user_admin', planningOwnerId: 'user_admin', startDate: '2026-09-01', endDate: '2026-09-30' }) });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  let project = result.data;
  assert.equal(project.lifecycleStatus, 'prospect');
  result = await request(`/api/v1/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ version: project.version, lifecycleStatus: 'budget' }) });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  project = result.data;
  assert.equal(project.lifecycleStatus, 'budget');
  const invalid = await request(`/api/v1/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ version: project.version, lifecycleStatus: 'planned' }) });
  assert.equal(invalid.response.status, 409);
  assert.equal(invalid.data.error.code, 'PROJECT_STATUS_TRANSITION_INVALID');
  const filtered = await request('/api/v1/projects?lifecycleStatus=budget&pageSize=100');
  assert.equal(filtered.response.status, 200);
  assert.ok(filtered.data.items.some(value => value.id === project.id));
});

test('S1-B versionne les tarifs datés, refuse les chevauchements et calcule nuit plus week-end', async () => {
  const offering = await request('/api/v1/service-offerings', { method: 'POST', body: JSON.stringify({ organizationUnitId: sprintUnit.id, code: 'S1_MIX', name: 'Mixage Sprint 1', category: 'mixing', defaultUnit: 'jour', plannable: true, compatibleResourceTypes: ['room'], compatibleResourceCategoryIds: [], active: true }) });
  assert.equal(offering.response.status, 201, JSON.stringify(offering.data));
  const cards = await request('/api/v1/rate-cards?pageSize=100');
  assert.equal(cards.response.status, 200);
  const card = cards.data.items.find(value => !value.clientId && !value.projectId) || cards.data.items[0];
  assert.ok(card);
  const payload = { rateCardId: card.id, sourceType: 'serviceOffering', sourceId: offering.data.id, unit: 'jour', costUnitMinor: '5000', saleUnitMinor: '10000', discountBps: 1000, validFrom: '2026-09-01', validTo: '2026-10-01', surcharges: [{ kind: 'weekend', adjustmentBps: 2000, timezone: 'Europe/Paris' }, { kind: 'night', adjustmentBps: 3000, timezone: 'Europe/Paris', startsAtLocal: '22:00', endsAtLocal: '06:00' }], active: true };
  const created = await request('/api/v1/rates', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.deepEqual({ scope: created.data.scope, validFrom: created.data.validFrom, validTo: created.data.validTo, discountBps: created.data.discountBps }, { scope: 'catalog', validFrom: '2026-09-01', validTo: '2026-10-01', discountBps: 1000 });
  const price = resolvedRatePrice(created.data, { serviceStartsAt: '2026-09-05T20:30:00.000Z', serviceEndsAt: '2026-09-05T22:30:00.000Z' });
  assert.equal(price.resolvedSaleUnitMinor, '13500');
  assert.deepEqual(price.appliedSurcharges.map(value => value.kind).sort(), ['night', 'weekend']);
  const overlap = await request('/api/v1/rates', { method: 'POST', body: JSON.stringify({ ...payload, validFrom: '2026-09-15', validTo: '2026-11-01' }) });
  assert.equal(overlap.response.status, 409);
  assert.equal(overlap.data.error.code, 'RATE_PERIOD_OVERLAP');
  const adjacent = await request('/api/v1/rates', { method: 'POST', body: JSON.stringify({ ...payload, validFrom: '2026-10-01', validTo: '2026-11-01' }) });
  assert.equal(adjacent.response.status, 201, JSON.stringify(adjacent.data));
  assert.equal(adjacent.data.validFrom, '2026-10-01');
});

test('S1-B applique le snapshot tarifaire et bloque un devis final sans tarif', async () => {
  const db = readDb(), pricedOffering = db.serviceOfferings.find(value => value.code === 'S1_MIX');
  const priced = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'sprint1-priced-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Devis tarifé Sprint 1', taxDate: '2026-09-05', lines: [{ category: 'technical', sourceType: 'serviceOffering', sourceId: pricedOffering.id, unit: 'jour', quantityMilli: '1000', serviceStartsAt: '2026-09-05T20:30:00.000Z', serviceEndsAt: '2026-09-05T22:30:00.000Z' }] }) });
  assert.equal(priced.response.status, 201, JSON.stringify(priced.data));
  assert.equal(priced.data.lines[0].pricingStatus, 'resolved');
  assert.equal(priced.data.lines[0].unitPriceMinor, '13500');
  assert.equal(priced.data.lines[0].appliedRateSnapshot.rateVersion, 1);
  const unpricedOffering = await request('/api/v1/service-offerings', { method: 'POST', body: JSON.stringify({ organizationUnitId: sprintUnit.id, code: 'S1_FREE', name: 'Prestation sans tarif Sprint 1', category: 'other', defaultUnit: 'forfait', plannable: false, compatibleResourceTypes: [], compatibleResourceCategoryIds: [], active: true }) });
  assert.equal(unpricedOffering.response.status, 201);
  const draft = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'sprint1-missing-rate' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Devis incomplet Sprint 1', taxDate: '2026-09-05', lines: [{ category: 'technical', sourceType: 'serviceOffering', sourceId: unpricedOffering.data.id, unit: 'forfait', quantityMilli: '1000' }] }) });
  assert.equal(draft.response.status, 201, JSON.stringify(draft.data));
  assert.equal(draft.data.lines[0].pricingStatus, 'missing');
  const sent = await request(`/api/v1/quotes/${draft.data.id}/status`, { method: 'POST', body: JSON.stringify({ version: draft.data.version, status: 'sent' }) });
  assert.equal(sent.response.status, 409);
  assert.equal(sent.data.error.code, 'COMMERCIAL_MISSING_RATES');
  assert.deepEqual(sent.data.error.details.lineIds, [draft.data.lines[0].id]);
});

test('S1-C recherche les entités autorisées sans exposer les coordonnées des contacts', async () => {
  const invalidQuery = await request('/api/v1/search?q=a');
  assert.equal(invalidQuery.response.status, 422);
  assert.equal(invalidQuery.data.error.code, 'SEARCH_QUERY_INVALID');
  const invalidTypes = await request('/api/v1/search?q=sprint&types=client,password');
  assert.equal(invalidTypes.response.status, 422);
  assert.equal(invalidTypes.data.error.code, 'SEARCH_TYPES_INVALID');
  const invalidLimit = await request('/api/v1/search?q=sprint&limit=101');
  assert.equal(invalidLimit.response.status, 422);
  assert.equal(invalidLimit.data.error.code, 'SEARCH_LIMIT_INVALID');

  const expectations = [
    ['arte', 'client', 'client_1'],
    ['horizons', 'project', 'project_1'],
    ['devis tarife', 'quote', null],
    ['sophie monteuse', 'person', 'resource_sprint1_person'],
    ['mixage sprint', 'serviceOffering', null]
  ];
  for (const [query, type, id] of expectations) {
    const result = await request(`/api/v1/search?q=${encodeURIComponent(query)}&types=${type}&limit=10`);
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.page, 1);
    assert.equal(result.data.pageSize, 10);
    assert.ok(result.data.items.some(item => item.type === type && (!id || item.id === id)), `${query} doit retourner ${type}`);
    assert.ok(result.data.items.every(item => Object.keys(item).every(key => !['email', 'phone', 'contact'].includes(key))));
  }
  const confidential = await request('/api/v1/search?q=secret-sprint1-contact');
  assert.equal(confidential.response.status, 200);
  assert.equal(confidential.data.total, 0);
  assert.doesNotMatch(JSON.stringify(confidential.data), /example\.test|\+33199887766/);

  const db = readDb(), adminContext = db.users.find(user => user.email === 'admin@northlight.fr');
  const scoped = universalSearch(db, { user: { ...adminContext, companyId: db.companies[0].id, siteIds: ['site_paris'], organizationUnitIds: [], organizationScope: false, projectScopeRestricted: true, projectIds: ['project_1'], entityScopes: { client: ['client_1'], resource: ['resource_1'], quote: [] }, effectivePermissions: ['planning.read', 'resource.read', 'quote.read', 'serviceOffering.read'] } }, { q: 'sprint', types: ['client', 'project', 'quote', 'resource', 'person', 'serviceOffering'], limit: 100 });
  assert.ok(scoped.items.every(item => item.type !== 'quote' && item.type !== 'person'));
  assert.ok(scoped.items.filter(item => item.type === 'resource').every(item => item.id === 'resource_1'));
  assert.ok(scoped.items.filter(item => item.type === 'project').every(item => item.projectId === 'project_1'));
  const permissionless = universalSearch(db, { user: { ...adminContext, companyId: db.companies[0].id, siteIds: ['site_paris', 'site_boulogne'], organizationUnitIds: [], organizationScope: true, projectScopeRestricted: false, projectIds: [], entityScopes: {}, effectivePermissions: [] } }, { q: 'arte', types: ['client'], limit: 10 });
  assert.equal(permissionless.total, 0);
});

test('S1-B résout l’unité avant la priorité et refuse le scope d’une grille incompatible', async () => {
  const db = structuredClone(readDb()), project = db.projects.find(value => value.id === 'project_1'), sourceId = 'resource_1';
  db.rates = db.rates.filter(value => !(value.sourceType === 'resource' && value.sourceId === sourceId));
  db.rates.push(
    { id: 'rate_catalog_correct_unit', companyId: project.companyId, rateCardId: 'catalog_test', sourceType: 'resource', sourceId, scope: 'catalog', unit: 'jour', saleUnitMinor: '41000', costUnitMinor: '20000', validFrom: '1970-01-01', validTo: null, discountBps: 0, surcharges: [], active: true, version: 1 },
    { id: 'rate_project_wrong_unit', companyId: project.companyId, rateCardId: 'project_test', projectId: project.id, sourceType: 'resource', sourceId, scope: 'project', unit: 'mois', saleUnitMinor: '99000', costUnitMinor: '30000', validFrom: '1970-01-01', validTo: null, discountBps: 0, surcharges: [], active: true, version: 1 },
  );
  assert.equal(rateForSource(db, { companyId: project.companyId, projectId: project.id, taxDate: '2026-09-05' }, 'resource', sourceId, 'jour').id, 'rate_catalog_correct_unit');
  const catalogCard = readDb().rateCards.find(value => !value.clientId && !value.projectId && value.active);
  const mismatch = await request('/api/v1/rates', { method: 'POST', body: JSON.stringify({ rateCardId: catalogCard.id, sourceType: 'resource', sourceId, clientId: 'client_1', unit: 'jour', costUnitMinor: '100', saleUnitMinor: '200' }) });
  assert.equal(mismatch.response.status, 422);
  assert.equal(mismatch.data.error.code, 'RATE_SCOPE_MISMATCH');
});

test('S1-D réconcilie budget, devis et CA signé sur neuf dimensions sans inventer les étapes futures', async () => {
  const dimensions = await request('/api/v1/analytics/dimensions');
  assert.equal(dimensions.response.status, 200);
  assert.deepEqual(dimensions.data.dimensions.map(value => value.name), ['date', 'clientId', 'projectId', 'serviceOfferingId', 'resourceId', 'siteId', 'legalEntityId', 'salesOwnerId', 'userId']);
  assert.equal(dimensions.data.recognizedRevenueStage, 'signed');
  const forbidden = await request('/api/v1/analytics/revenue-chain', {}, viewer);
  assert.equal(forbidden.response.status, 403);
  assert.equal((await request('/api/v1/analytics/backlog', {}, viewer)).response.status, 403);
  assert.equal((await request('/api/v1/analytics/forecast', {}, viewer)).response.status, 403);

  const db = readDb(), offering = db.serviceOfferings.find(value => value.code === 'S1_MIX'), commercialLine = { category: 'technical', sourceType: 'serviceOffering', sourceId: offering.id, unit: 'jour', quantityMilli: '1000', serviceStartsAt: '2026-09-05T20:30:00.000Z', serviceEndsAt: '2026-09-05T22:30:00.000Z' };
  const budgetResult = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'sprint1-analytics-budget' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'budget', title: 'Budget analytique Sprint 1', taxDate: '2026-09-05', lines: [commercialLine] }) });
  assert.equal(budgetResult.response.status, 201, JSON.stringify(budgetResult.data));
  const quoteResult = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'sprint1-analytics-quote' }, body: JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', kind: 'quote', title: 'Devis analytique Sprint 1', taxDate: '2026-09-05', lines: [commercialLine] }) });
  assert.equal(quoteResult.response.status, 201, JSON.stringify(quoteResult.data));
  let accepted = quoteResult.data;
  for (const status of ['validated', 'sent', 'accepted']) { const changed = await request(`/api/v1/quotes/${accepted.id}/status`, { method: 'POST', body: JSON.stringify({ version: accepted.version, status }) }); assert.equal(changed.response.status, 200, JSON.stringify(changed.data)); accepted = changed.data; }

  const allDimensions = dimensions.data.dimensions.map(value => value.name).join(','), query = `/api/v1/analytics/revenue-chain?dimensions=${allDimensions}&serviceOfferingId=${encodeURIComponent(offering.id)}&projectId=project_1`;
  const analytics = await request(query);
  assert.equal(analytics.response.status, 200, JSON.stringify(analytics.data));
  assert.equal(analytics.data.definitionVersion, 'revenue-chain-g7-v1');
  const totals = Object.fromEntries(['budgeted', 'quoted', 'signed'].map(stage => [stage, analytics.data.groups.reduce((total, group) => total + BigInt(group.stages.find(value => value.stage === stage).valueMinor), 0n)]));
  assert.equal(totals.budgeted, BigInt(budgetResult.data.netHt));
  assert.equal(totals.quoted, BigInt(quoteResult.data.netHt) * 2n);
  assert.equal(totals.signed, BigInt(accepted.netHt));
  for (const group of analytics.data.groups) for (const stage of ['planned', 'actual', 'billable']) { const value = group.stages.find(item => item.stage === stage); assert.equal(value.availability, 'available'); }
  for (const group of analytics.data.groups) for (const stage of ['invoiced', 'collected']) { const value = group.stages.find(item => item.stage === stage); assert.deepEqual({ availability: value.availability, valueMinor: value.valueMinor, sourceCount: value.sourceCount }, { availability: 'unavailable', valueMinor: null, sourceCount: 0 }); }
  const representative = analytics.data.groups.find(group => group.stages.some(stage => stage.sourceCount));
  for (const dimension of dimensions.data.dimensions.map(value => value.name)) { const expected = representative.dimensions[dimension], filtered = await request(`/api/v1/analytics/revenue-chain?dimensions=${dimension}&${dimension}=${encodeURIComponent(expected ?? '')}`); assert.equal(filtered.response.status, 200); assert.ok(filtered.data.groups.every(group => String(group.dimensions[dimension] ?? '') === String(expected ?? '')), dimension); }

  const successor = await request(`/api/v1/quotes/${accepted.id}/new-version`, { method: 'POST', body: JSON.stringify({ version: accepted.version }) });
  assert.equal(successor.response.status, 201, JSON.stringify(successor.data));
  const afterReplacement = await request(`/api/v1/analytics/revenue-chain?serviceOfferingId=${encodeURIComponent(offering.id)}&projectId=project_1`);
  assert.equal(afterReplacement.response.status, 200);
  const signedAfter = afterReplacement.data.groups.reduce((total, group) => total + BigInt(group.stages.find(value => value.stage === 'signed').valueMinor), 0n);
  assert.equal(signedAfter, 0n);
  assert.equal(readDb().quotes.find(value => value.id === accepted.id).revenueRecognition.state, 'superseded');
});

test('S1-D ne reporte jamais le montant d’une ligne hors scope sur une ligne analytique visible', () => {
  const companyId = 'company_scope', document = { id: 'quote_scope', companyId, kind: 'quote', projectId: 'project_scope', siteId: 'site_scope', status: 'accepted', taxDate: '2026-08-20', currency: 'EUR', currencyExponent: 2, netHt: '30000', currentVersionId: 'quote_scope_v1', createdBy: 'user_finance', lines: [{ id: 'line_visible', sourceType: 'resource', sourceId: 'resource_visible', netHt: '10000' }, { id: 'line_hidden', sourceType: 'resource', sourceId: 'resource_hidden', netHt: '20000' }], revenueRecognition: { state: 'active', quoteVersionId: 'quote_scope_v1', netHt: '30000', recognizedAt: '2026-08-20T10:00:00.000Z' } };
  const db = { clients: [{ id: 'client_scope', companyId }], projects: [{ id: 'project_scope', companyId, clientId: 'client_scope', siteId: 'site_scope' }], resources: [{ id: 'resource_visible', companyId, siteId: 'site_scope' }, { id: 'resource_hidden', companyId, siteId: 'site_scope' }], serviceOfferings: [], organizationUnits: [], budgets: [], quotes: [document] };
  const auth = { user: { companyId, organizationScope: false, siteIds: ['site_scope'], organizationUnitIds: [], projectScopeRestricted: true, projectIds: ['project_scope'], entityScopes: { client: ['client_scope'], quote: ['quote_scope'], resource: ['resource_visible'] }, effectivePermissions: ['finance.read'] } };
  const result = revenueChain(db, auth, { dimensions: ['resourceId'], filters: {} });
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].dimensions.resourceId, 'resource_visible');
  assert.equal(result.groups[0].stages.find(value => value.stage === 'signed').valueMinor, '10000');
});

test('rollback Sprint 1 exige un export vérifié et restaure exactement la source antérieure', () => {
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-1-referentials-v1'), backupPath = path.join(path.dirname(testDataFile), marker.backupFile), expected = fs.readFileSync(backupPath, 'utf8'), exportFile = `${testDataFile}.recovery.json`;
  assert.throws(() => rollbackSprint1Migrations(), error => error?.code === 'ROLLBACK_EXPORT_REQUIRED');
  assert.throws(() => rollbackSprint1Migrations({ allowDataLoss: true }), error => error?.code === 'ROLLBACK_EXPORT_REQUIRED');
  const validRaw = fs.readFileSync(testDataFile, 'utf8'), missingMarkerExport = `${testDataFile}.missing-marker-recovery.json`, missingMarker = JSON.parse(validRaw);
  missingMarker.migrations = missingMarker.migrations.filter(value => value.id !== 'sprint-1-contracts-v2');
  fs.writeFileSync(testDataFile, `${JSON.stringify(missingMarker, null, 2)}\n`, { mode: 0o600 });
  try {
    assert.throws(() => rollbackSprint1Migrations({ exportFile: missingMarkerExport }), error => error?.code === 'MIGRATION_MARKER_CONFLICT');
    assert.equal(fs.existsSync(missingMarkerExport), false);
  } finally {
    fs.writeFileSync(testDataFile, validRaw, { mode: 0o600 });
  }
  const result = rollbackSprint1Migrations({ exportFile });
  assert.equal(fs.readFileSync(testDataFile, 'utf8'), expected);
  const recovery = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
  assert.equal(recovery.kind, 'planify-sprint1-recovery-export');
  assert.deepEqual(recovery.migrations, ['sprint-1-referentials-v1', 'sprint-1-pricing-v1', 'sprint-1-analytics-v1', 'sprint-1-contracts-v2']);
  assert.match(result.exportDigest, /^[a-f0-9]{64}$/);
  assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600);
});
