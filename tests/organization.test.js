'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataFile = path.join(os.tmpdir(), `planify-organization-test-${process.pid}-${Date.now()}.json`);
process.env.PLANIFY_DATA_FILE = dataFile;
process.env.PLANIFY_SSE_REVALIDATE_MS = '50';

const {
  createServer,
  resetData,
  makeSeed,
  readDb,
  migrateOrganizationV2ToV3,
  migrateOrganizationFiscalV3,
  organizationCompleteness,
} = require('../server.js');

let server;
let baseUrl;
let admin;
let viewer;
let propsCompany;
let propsSite;
let createdCompany;
let mutationOperation = 0;

const clone = value => structuredClone(value);
const companyPayload = suffix => ({
  legalName: `Organisation QA ${suffix}`,
  code: `QA-${suffix}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32),
  legalForm: 'SAS', registrationCountry: 'FR', registrationNumber: `8${String(suffix).replace(/\D/g, '').padStart(8, '0').slice(-8)}`,
  activities: ['services'], primaryActivity: 'services', activityRequirements: [],
  defaultTimezone: 'Europe/Paris', currency: 'EUR', locale: 'fr-FR', defaultCountry: 'FR',
});

async function request(route, options = {}, auth) {
  const headers = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...options.headers,
  };
  if (!['GET', 'HEAD'].includes(options.method || 'GET') && !headers['Idempotency-Key'] && !headers['idempotency-key']) headers['Idempotency-Key'] = `organization-mutation-${++mutationOperation}`;
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
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return {
    cookie: result.response.headers.get('set-cookie').split(';', 1)[0],
    csrf: result.data.csrfToken,
    user: result.data.user,
  };
}

async function startReadyFixture() {
  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  viewer = await login('viewer@northlight.fr');
  const companies = await request('/api/v1/companies?pageSize=20', {}, admin);
  assert.equal(companies.response.status, 200, JSON.stringify(companies.data));
  propsCompany = companies.data.items.find(item => item.id === 'company_eliote_props_prod');
  assert.ok(propsCompany, 'Eliote Props Prod doit être visible par l’administrateur multi-organisations');
  const switched = await request('/api/v1/session/company-context', {
    method: 'POST',
    body: JSON.stringify({ companyId: propsCompany.id }),
  }, admin);
  assert.equal(switched.response.status, 200, JSON.stringify(switched.data));
  admin.csrf = switched.data.csrfToken;
  const sites = await request('/api/v1/sites?pageSize=20', {}, admin);
  assert.equal(sites.response.status, 200, JSON.stringify(sites.data));
  propsSite = sites.data.items[0] || null;
}

before(async () => {
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

test('migration Organisation v2 vers v3 : backup exact, idempotence et préservation des collections Stock', async () => {
  assert.equal(typeof migrateOrganizationV2ToV3, 'function');
  assert.equal(typeof organizationCompleteness, 'function');

  const legacy = clone(makeSeed());
  legacy.schemaVersion = 2;
  legacy.migrations = (legacy.migrations || []).filter(item => item.id !== 'foundation-01-organization-v2-to-v3');
  for (const company of legacy.companies) {
    company.name = company.legalName || company.name;
    for (const key of ['legalName', 'tradeName', 'code', 'legalForm', 'registrationCountry', 'registrationNumber', 'establishmentNumber', 'vatNumber', 'activities', 'primaryActivity', 'activityRequirements', 'activityDescription', 'currency', 'locale', 'defaultCountry', 'status', 'onboardingStage', 'legalValidationPolicy', 'validatedAt', 'validatedBy', 'version']) delete company[key];
  }
  for (const key of ['organizationAddresses', 'organizationContacts', 'organizationUnits', 'serviceOfferings', 'organizationMemberships', 'roles', 'membershipRoles', 'membershipScopes']) delete legacy[key];

  const preservedKeys = ['resources', 'clients', 'projects', 'reservations', 'stockItems', 'equipmentAssets', 'stockLocations', 'stockMovements', 'maintenanceRecords', 'stockIdempotency'];
  const preserved = Object.fromEntries(preservedKeys.map(key => [key, clone(legacy[key] || [])]));
  resetData(legacy);
  const rawV2 = fs.readFileSync(dataFile, 'utf8');
  const migrated = readDb();

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.migrations.filter(item => item.id === 'foundation-01-organization-v2-to-v3').length, 1);
  for (const key of preservedKeys) {
    const actual = key === 'projects'
      ? migrated[key].map(({ lifecycleStatus, legacyStatus, siteId, salesOwnerId, projectManagerId, planningOwnerId, ...project }) => project)
      : key === 'resources'
        ? migrated[key].map(({ resourceCategoryId, ...resource }) => resource)
        : key === 'clients'
          ? migrated[key].map(({ currency, paymentTermsDays, billingTerms, billingAddress, ...client }) => client)
          : migrated[key];
    assert.deepEqual(actual, preserved[key], `${key} a été modifiée par ORG-01`);
  }
  assert.ok(migrated.resources.every(resource => migrated.resourceCategories.some(category => category.id === resource.resourceCategoryId && category.companyId === resource.companyId && category.siteId === resource.siteId)), 'chaque ressource migrée doit référencer une catégorie du même site et de la même société');
  const migration = migrated.migrations.find(item => item.id === 'foundation-01-organization-v2-to-v3');
  assert.ok(migration.backupFile);
  assert.equal(fs.readFileSync(path.join(path.dirname(dataFile), migration.backupFile), 'utf8'), rawV2);

  const replay = readDb();
  assert.equal(replay.migrations.filter(item => item.id === 'foundation-01-organization-v2-to-v3').length, 1);
  assert.deepEqual(replay, migrated);
  await startReadyFixture();
});

test('seed déterministe : trois organisations distinctes et contexte explicite', async () => {
  const first = await request('/api/v1/companies?pageSize=20', {}, admin);
  assert.equal(first.response.status, 200);
  assert.deepEqual(
    ['company_eliote_props_prod', 'company_eliote_location', 'company_fav_location'],
    ['company_eliote_props_prod', 'company_eliote_location', 'company_fav_location'].filter(id => first.data.items.some(item => item.id === id)),
  );
  assert.equal(new Set(first.data.items.map(item => item.code)).size, first.data.items.length);

  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  const replay = await request('/api/v1/companies?pageSize=20', {}, admin);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.items.filter(item => item.id === 'company_eliote_props_prod').length, 1);
  viewer = await login('viewer@northlight.fr');
  propsCompany = replay.data.items.find(item => item.id === 'company_eliote_props_prod');
  const sites = await request('/api/v1/sites?pageSize=20', {}, admin);
  propsSite = sites.data.items[0];
});

test('création : champs légaux validés, tradeName facultatif et complétude O1 calculée serveur', async () => {
  const registrationNumber = String(700000000 + Number(String(Date.now()).slice(-8))).padStart(9, '7').slice(0, 9);
  const payload = {
    legalName: 'Organisation QA Démonstration',
    code: `ORGQA${String(Date.now()).slice(-6)}`,
    legalForm: 'SAS',
    registrationCountry: 'FR',
    registrationNumber,
    activities: ['services'],
    primaryActivity: 'services',
    activityRequirements: [],
    defaultTimezone: 'Europe/Paris',
    currency: 'EUR',
    locale: 'fr-FR',
    defaultCountry: 'FR',
  };
  const result = await request('/api/v1/companies', {
    method: 'POST',
    headers: { 'idempotency-key': `organization-create-${crypto.randomUUID()}` },
    body: JSON.stringify(payload),
  }, admin);
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.legalName, payload.legalName);
  assert.equal(result.data.tradeName, undefined);
  assert.equal(result.data.status, 'draft');
  assert.equal(result.data.onboardingStage, 'identity');
  createdCompany = result.data;

  const completeness = await request(`/api/v1/companies/${createdCompany.id}/completeness`, {}, admin);
  assert.equal(completeness.response.status, 200, JSON.stringify(completeness.data));
  assert.equal(completeness.data.companyId, createdCompany.id);
  assert.equal(completeness.data.stages.find(stage => stage.code === 'identity').state, 'incomplete');
  assert.ok(completeness.data.stages.find(stage => stage.code === 'identity').missingFields.length > 0);
});

test('organizationId et alias de relation sont rejetés sans normalisation', async () => {
  for (const body of [
    { organizationId: propsCompany.id, code: 'BAD-ORG', name: 'Site interdit' },
    { companyId: propsCompany.id, code: 'BAD-COMPANY', name: 'Site interdit' },
    { serviceId: 'unit_unknown', code: 'BAD-SERVICE', name: 'Alias interdit' },
  ]) {
    const result = await request('/api/v1/sites', { method: 'POST', body: JSON.stringify(body) }, admin);
    assert.equal(result.response.status, 400, JSON.stringify(result.data));
    assert.equal(result.data.error.code, 'VALIDATION_ERROR');
  }
});

test('O1 incomplet refuse la validation et ne produit aucune écriture partielle', async () => {
  const beforeDb = readDb();
  const beforeAuditCount = beforeDb.auditEvents.length;
  const result = await request(`/api/v1/companies/${createdCompany.id}/validate-stage`, {
    method: 'POST',
    body: JSON.stringify({ stage: 'identity', version: createdCompany.version }),
  }, admin);
  assert.equal(result.response.status, 422, JSON.stringify(result.data));
  assert.equal(result.data.error.code, 'ONBOARDING_INCOMPLETE');
  const afterDb = readDb();
  assert.equal(afterDb.companies.find(item => item.id === createdCompany.id).version, createdCompany.version);
  assert.equal(afterDb.auditEvents.length, beforeAuditCount);
});

test('sites, unités et prestations sont paginés et ne prennent jamais le tenant depuis le corps', async () => {
  const switched = await request('/api/v1/session/company-context', {
    method: 'POST',
    body: JSON.stringify({ companyId: propsCompany.id }),
  }, admin);
  assert.equal(switched.response.status, 200, JSON.stringify(switched.data));
  admin.csrf = switched.data.csrfToken;

  const address = await request('/api/v1/organization-addresses', {
    method: 'POST',
    body: JSON.stringify({
      type: 'registeredOffice', label: 'Siège', line1: '1 rue de la Post-production',
      postalCode: '75001', city: 'Paris', country: 'FR', isPrimary: true,
    }),
  }, admin);
  assert.equal(address.response.status, 201, JSON.stringify(address.data));
  const contact = await request('/api/v1/organization-contacts', {
    method: 'POST',
    body: JSON.stringify({ type: 'operations', name: 'Responsable QA', email: 'qa@example.test', isPrimary: true, active: true }),
  }, admin);
  assert.equal(contact.response.status, 201, JSON.stringify(contact.data));
  const currentCompany = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const validated = await request(`/api/v1/companies/${propsCompany.id}/validate-stage`, {
    method: 'POST',
    body: JSON.stringify({ stage: 'identity', version: currentCompany.data.version }),
  }, admin);
  assert.equal(validated.response.status, 200, JSON.stringify(validated.data));
  assert.equal(validated.data.onboardingStage, 'sitesServices');
  propsCompany = validated.data;

  const suffix = String(Date.now()).slice(-6);
  const site = await request('/api/v1/sites', {
    method: 'POST',
    headers: { 'idempotency-key': `site-${crypto.randomUUID()}` },
    body: JSON.stringify({
      code: `QA${suffix}`,
      name: `Site QA ${suffix}`,
      siteType: 'postProduction',
      address: { line1: '1 rue de la QA', postalCode: '75001', city: 'Paris', country: 'FR' },
      timezone: 'Europe/Paris',
      activities: ['postProduction'],
      active: true,
    }),
  }, admin);
  assert.equal(site.response.status, 201, JSON.stringify(site.data));
  assert.equal(site.data.companyId, propsCompany.id);

  const unit = await request('/api/v1/organization-units', {
    method: 'POST',
    headers: { 'idempotency-key': `unit-${crypto.randomUUID()}` },
    body: JSON.stringify({ siteId: site.data.id, code: `UNIT${suffix}`, name: 'Montage QA', kind: 'service', activities: ['postProduction'], active: true }),
  }, admin);
  assert.equal(unit.response.status, 201, JSON.stringify(unit.data));
  assert.equal(unit.data.companyId, propsCompany.id);

  const offering = await request('/api/v1/service-offerings', {
    method: 'POST',
    headers: { 'idempotency-key': `offering-${crypto.randomUUID()}` },
    body: JSON.stringify({ organizationUnitId: unit.data.id, code: `EDIT${suffix}`, name: 'Montage QA', category: 'editing', active: true }),
  }, admin);
  assert.equal(offering.response.status, 201, JSON.stringify(offering.data));
  assert.equal(offering.data.organizationUnitId, unit.data.id);

  const page = await request('/api/v1/service-offerings?page=1&pageSize=1', {}, admin);
  assert.equal(page.response.status, 200);
  assert.equal(page.data.items.length, 1);
  assert.equal(page.data.pageSize, 1);
  assert.ok(page.data.total >= 1);
});

test('RBAC : un lecteur ne peut muter ni identité, ni structure, ni gouvernance', async () => {
  for (const [route, method, body] of [
    [`/api/v1/companies/${propsCompany.id}`, 'PATCH', { version: propsCompany.version, tradeName: 'Interdit' }],
    ['/api/v1/sites', 'POST', { code: 'VIEWER', name: 'Interdit' }],
    ['/api/v1/memberships', 'POST', { userId: 'user_admin' }],
  ]) {
    const result = await request(route, { method, body: JSON.stringify(body) }, viewer);
    assert.equal(result.response.status, 403, `${method} ${route}: ${JSON.stringify(result.data)}`);
    assert.equal(result.data.error.code, 'FORBIDDEN');
  }
});

test('contrôle optimiste : une ancienne version ne peut écraser une organisation', async () => {
  const freshRead = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  assert.equal(freshRead.response.status, 200);
  const current = freshRead.data;
  const updated = await request(`/api/v1/companies/${propsCompany.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ version: current.version, activityDescription: 'Description QA versionnée' }),
  }, admin);
  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  const stale = await request(`/api/v1/companies/${propsCompany.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ version: current.version, activityDescription: 'Écrasement interdit' }),
  }, admin);
  assert.equal(stale.response.status, 409, JSON.stringify(stale.data));
  assert.equal(stale.data.error.code, 'VERSION_CONFLICT');
  const persisted = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  assert.equal(persisted.data.activityDescription, 'Description QA versionnée');
  propsCompany = updated.data;
});

test('Origin stricte : une origine trompeuse est refusée avant mutation, audit et SSE', async () => {
  const before = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const auditBefore = await request('/api/v1/audit?pageSize=200', {}, admin);
  const result = await request(`/api/v1/companies/${propsCompany.id}`, {
    method: 'PATCH',
    headers: { origin: `${baseUrl}.evil.example` },
    body: JSON.stringify({ version: before.data.version, activityDescription: 'Ne doit pas être écrit' }),
  }, admin);
  assert.equal(result.response.status, 403, JSON.stringify(result.data));
  assert.equal(result.data.error.code, 'ORIGIN_INVALID');
  const afterRead = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const auditAfter = await request('/api/v1/audit?pageSize=200', {}, admin);
  assert.equal(afterRead.data.version, before.data.version);
  assert.equal(auditAfter.data.total, auditBefore.data.total);
});

test('changement de contexte : membership requise et isolation non révélatrice', async () => {
  const propsSites = await request('/api/v1/sites?pageSize=200', {}, admin);
  assert.ok(propsSites.data.total > 0);
  const switched = await request('/api/v1/session/company-context', {
    method: 'POST',
    body: JSON.stringify({ companyId: 'company_eliote_location' }),
  }, admin);
  assert.equal(switched.response.status, 200, JSON.stringify(switched.data));
  admin = {
    ...admin,
    ...(switched.response.headers.get('set-cookie') ? { cookie: switched.response.headers.get('set-cookie').split(';', 1)[0] } : {}),
    ...(switched.data.csrfToken ? { csrf: switched.data.csrfToken } : {}),
  };
  const locationSites = await request('/api/v1/sites?pageSize=200', {}, admin);
  assert.ok(locationSites.data.items.every(item => item.companyId === 'company_eliote_location'));

  const guessed = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const absent = await request('/api/v1/companies/company_absent', {}, admin);
  assert.equal(guessed.response.status, 404);
  assert.equal(absent.response.status, 404);
  assert.equal(guessed.data.error.code, absent.data.error.code);
  assert.equal(guessed.data.error.message, absent.data.error.message);

  const back = await request('/api/v1/session/company-context', {
    method: 'POST',
    body: JSON.stringify({ companyId: 'company_eliote_props_prod' }),
  }, admin);
  assert.equal(back.response.status, 200, JSON.stringify(back.data));
  admin = {
    ...admin,
    ...(back.response.headers.get('set-cookie') ? { cookie: back.response.headers.get('set-cookie').split(';', 1)[0] } : {}),
    ...(back.data.csrfToken ? { csrf: back.data.csrfToken } : {}),
  };
});

test('audit et SSE Organisation sont post-commit et ne divulguent aucune donnée sensible', async () => {
  const controller = new AbortController();
  const streamResponse = await fetch(`${baseUrl}/api/v1/events`, {
    headers: { cookie: admin.cookie, accept: 'text/event-stream' },
    signal: controller.signal,
  });
  assert.equal(streamResponse.status, 200);
  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  await reader.read();

  const current = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const updated = await request(`/api/v1/companies/${propsCompany.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ version: current.data.version, activityDescription: 'Mutation SSE QA' }),
  }, admin);
  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));

  let eventText = '';
  const deadline = Date.now() + 2_000;
  while (!eventText.includes('organization.updated.v1') && Date.now() < deadline) {
    const result = await Promise.race([
      reader.read(),
      new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 100)),
    ]);
    if (result.timeout) continue;
    if (result.done) break;
    eventText += decoder.decode(result.value, { stream: true });
  }
  controller.abort();
  assert.match(eventText, /organization\.updated\.v1/);
  assert.doesNotMatch(eventText, /registrationNumber|vatNumber|organizationContacts|@/i);

  const audit = await request('/api/v1/audit?pageSize=200', {}, admin);
  const entry = audit.data.items.find(item => item.entityId === propsCompany.id && item.action === 'organization.updated');
  assert.ok(entry);
  const serialized = JSON.stringify(entry);
  assert.doesNotMatch(serialized, /registrationNumber|vatNumber|password|cookie|csrf/i);
});

test('P1 migration : une base v2 ne reçoit ni tenants de démonstration ni promotion implicite des viewers', async () => {
  const legacy = clone(makeSeed());
  legacy.schemaVersion = 2;
  delete legacy.migrations;
  for (const key of ['organizationAddresses', 'organizationContacts', 'organizationUnits', 'serviceOfferings', 'organizationMemberships', 'roles', 'membershipRoles', 'membershipScopes']) delete legacy[key];
  resetData(legacy);
  const migrated = readDb();
  const viewerMembership = migrated.organizationMemberships.find(item => item.userId === 'user_viewer');
  const viewerRoleIds = migrated.membershipRoles.filter(item => item.membershipId === viewerMembership.id).map(item => item.roleId);
  const viewerRoles = migrated.roles.filter(item => viewerRoleIds.includes(item.id));
  assert.deepEqual({
    companyIds: migrated.companies.map(item => item.id),
    viewerHasRole: viewerRoles.length > 0,
    viewerCanManageOrganization: viewerRoles.some(role => role.permissions.includes('organization.manage')),
  }, { companyIds: ['company_northlight'], viewerHasRole: true, viewerCanManageOrganization: false });
  await startReadyFixture();
});

test('P1 RBAC : permissions issues des membershipRoles et révocation effective sur la session courante', async () => {
  resetData(makeSeed());
  let db = readDb();
  const propsMembership = db.organizationMemberships.find(item => item.userId === 'user_admin' && item.companyId === 'company_eliote_props_prod');
  db.membershipRoles = db.membershipRoles.filter(item => item.membershipId !== propsMembership.id);
  resetData(db);
  const roleless = await login('admin@northlight.fr');
  const switched = await request('/api/v1/session/company-context', { method: 'POST', body: JSON.stringify({ companyId: 'company_eliote_props_prod' }) }, roleless);
  assert.equal(switched.response.status, 200);
  roleless.csrf = switched.data.csrfToken;
  const company = await request('/api/v1/companies/company_eliote_props_prod', {}, roleless);
  const forbidden = await request('/api/v1/companies/company_eliote_props_prod', {
    method: 'PATCH', body: JSON.stringify({ version: company.data.version, activityDescription: 'Interdit sans rôle' }),
  }, roleless);
  const rolelessStatus = forbidden.response.status;

  await startReadyFixture();
  db = readDb();
  const liveMembership = db.organizationMemberships.find(item => item.userId === 'user_admin' && item.companyId === propsCompany.id);
  db.membershipRoles = db.membershipRoles.filter(item => item.membershipId !== liveMembership.id);
  fs.writeFileSync(dataFile, `${JSON.stringify(db, null, 2)}\n`, { mode: 0o600 });
  const current = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const revoked = await request(`/api/v1/companies/${propsCompany.id}`, {
    method: 'PATCH', body: JSON.stringify({ version: current.data.version, activityDescription: 'Interdit après révocation' }),
  }, admin);
  assert.deepEqual({ rolelessStatus, revokedStatus: revoked.response.status }, { rolelessStatus: 403, revokedStatus: 403 });
  await startReadyFixture();
});

test('P1 scopes : listes et mutations unités/prestations respectent les sites autorisés', async () => {
  resetData(makeSeed());
  const db = readDb();
  const membership = db.organizationMemberships.find(item => item.userId === 'user_admin' && item.companyId === 'company_northlight');
  const scope = db.membershipScopes.find(item => item.membershipId === membership.id);
  Object.assign(scope, { scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [] });
  db.organizationUnits.push(
    { id: 'unit_scope_paris', companyId: 'company_northlight', siteId: 'site_paris', parentUnitId: null, code: 'SCOPE-PAR', name: 'Paris visible', kind: 'service', activities: ['postProduction'], active: true, version: 1 },
    { id: 'unit_scope_boulogne', companyId: 'company_northlight', siteId: 'site_boulogne', parentUnitId: null, code: 'SCOPE-BLG', name: 'Boulogne caché', kind: 'service', activities: ['postProduction'], active: true, version: 1 },
  );
  db.serviceOfferings.push(
    { id: 'offering_scope_paris', companyId: 'company_northlight', organizationUnitId: 'unit_scope_paris', code: 'OFF-PAR', name: 'Offre Paris', category: 'editing', active: true, version: 1 },
    { id: 'offering_scope_boulogne', companyId: 'company_northlight', organizationUnitId: 'unit_scope_boulogne', code: 'OFF-BLG', name: 'Offre Boulogne', category: 'editing', active: true, version: 1 },
  );
  resetData(db);
  const scopedAdmin = await login('admin@northlight.fr');
  const units = await request('/api/v1/organization-units?pageSize=20', {}, scopedAdmin);
  const offerings = await request('/api/v1/service-offerings?pageSize=20', {}, scopedAdmin);
  const forbidden = await request('/api/v1/organization-units/unit_scope_boulogne', {
    method: 'PATCH', body: JSON.stringify({ version: 1, name: 'Mutation interdite' }),
  }, scopedAdmin);
  assert.deepEqual({
    unitIds: units.data.items.map(item => item.id),
    offeringIds: offerings.data.items.map(item => item.id),
    outOfScopeMutationStatus: forbidden.response.status,
  }, { unitIds: ['unit_scope_paris'], offeringIds: ['offering_scope_paris'], outOfScopeMutationStatus: 404 });
  await startReadyFixture();
});

test('P1 activités : post-production/laboratoire exigent leurs décisions structurées', async () => {
  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  const postProduction = await request('/api/v1/companies', {
    method: 'POST',
    headers: { 'idempotency-key': `postprod-${crypto.randomUUID()}` },
    body: JSON.stringify({ ...companyPayload('51000001'), activities: ['postProduction'], primaryActivity: 'postProduction', activityRequirements: [] }),
  }, admin);
  const laboratory = await request('/api/v1/companies', {
    method: 'POST',
    headers: { 'idempotency-key': `laboratory-${crypto.randomUUID()}` },
    body: JSON.stringify({ ...companyPayload('51000002'), activities: ['laboratory'], primaryActivity: 'laboratory', activityRequirements: [] }),
  }, admin);
  assert.deepEqual({ postProduction: postProduction.response.status, laboratory: laboratory.response.status }, { postProduction: 422, laboratory: 422 });
  await startReadyFixture();
});

test('P1 gates aval : organisation draft bloque ressources, clients, projets et réservations', async () => {
  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  const created = await request('/api/v1/companies', {
    method: 'POST', headers: { 'idempotency-key': `draft-${crypto.randomUUID()}` }, body: JSON.stringify(companyPayload('52000001')),
  }, admin);
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const observed = {};
  for (const [route, payload] of [
    ['/api/v1/resources', { siteId: 'site_absent', name: 'Ressource prématurée', type: 'room', capacity: 1 }],
    ['/api/v1/clients', { name: 'Client prématuré', code: 'EARLY-C' }],
    ['/api/v1/projects', { name: 'Projet prématuré', code: 'EARLY-P', clientId: 'client_absent' }],
    ['/api/v1/reservations', { title: 'Réservation prématurée', siteId: 'site_absent', projectId: 'project_absent', status: 'confirmed', startsAt: '2026-10-01T08:00:00.000Z', endsAt: '2026-10-01T09:00:00.000Z', resources: [{ resourceId: 'resource_absent', quantity: 1 }] }],
  ]) {
    const result = await request(route, { method: 'POST', body: JSON.stringify(payload) }, admin);
    observed[route] = { status: result.response.status, code: result.data?.error?.code };
  }
  assert.deepEqual(observed, Object.fromEntries(Object.keys(observed).map(route => [route, { status: 409, code: 'PREREQUISITE_NOT_MET' }])));
  await startReadyFixture();
});

test('P1 transitions et gouvernance : routes suspend/archive/roles et dépendances site sont exécutables', async () => {
  const transitionSeed = makeSeed();
  Object.assign(transitionSeed.reservations[0], { startsAt: '2099-01-10T09:00:00.000Z', endsAt: '2099-01-10T18:00:00.000Z' });
  resetData(transitionSeed);
  admin = await login('admin@northlight.fr');
  const company = (await request('/api/v1/companies/company_northlight', {}, admin)).data;
  const suspendWithoutReason = await request('/api/v1/companies/company_northlight/suspend', {
    method: 'POST', body: JSON.stringify({ version: company.version }),
  }, admin);

  const roles = await request('/api/v1/roles?pageSize=20', {}, admin);
  const roleCreate = await request('/api/v1/roles', {
    method: 'POST', body: JSON.stringify({ code: 'qaLimited', name: 'QA limité', permissions: ['organization.read'], active: true }),
  }, admin);
  const rolePatch = await request(`/api/v1/roles/${roleCreate.data.id}`, {
    method: 'PATCH', body: JSON.stringify({ version: roleCreate.data.version, name: 'QA limité modifié' }),
  }, admin);

  const site = (await request('/api/v1/sites?siteId=site_paris&pageSize=20', {}, admin)).data.items.find(item => item.id === 'site_paris');
  const deactivate = await request('/api/v1/sites/site_paris', {
    method: 'PATCH', body: JSON.stringify({ version: site.version, active: false }),
  }, admin);
  const archive = await request('/api/v1/companies/company_northlight/archive', {
    method: 'POST', body: JSON.stringify({ version: company.version, confirmation: 'company_northlight', reason: 'Archivage QA justifié' }),
  }, admin);
  assert.deepEqual({
    suspendWithoutReason: suspendWithoutReason.response.status,
    rolesList: roles.response.status,
    roleCreate: roleCreate.response.status,
    rolePatch: rolePatch.response.status,
    siteDeactivate: { status: deactivate.response.status, code: deactivate.data?.error?.code },
    archive: { status: archive.response.status, code: archive.data?.error?.code },
  }, {
    suspendWithoutReason: 422,
    rolesList: 200,
    roleCreate: 201,
    rolePatch: 200,
    siteDeactivate: { status: 409, code: 'SITE_REPLACEMENT_REQUIRED' },
    archive: { status: 409, code: 'ORGANIZATION_HAS_FUTURE_RESERVATIONS' },
  });
  await startReadyFixture();
});

test('suppression logique : organisation, service et prestation sont réservés aux administrateurs', async () => {
  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  const viewerAuth = await login('viewer@northlight.fr');

  const unit = await request('/api/v1/organization-units', {
    method: 'POST', headers: { 'idempotency-key': `unit-delete-${crypto.randomUUID()}` },
    body: JSON.stringify({ code: 'DELETE_QA', name: 'Service à supprimer', kind: 'service', siteId: 'site_paris', activities: ['postProduction'], active: true }),
  }, admin);
  assert.equal(unit.response.status, 201, JSON.stringify(unit.data));
  const offering = await request('/api/v1/service-offerings', {
    method: 'POST', headers: { 'idempotency-key': `offering-delete-${crypto.randomUUID()}` },
    body: JSON.stringify({ code: 'DELETE_QA', name: 'Prestation à supprimer', category: 'other', organizationUnitId: unit.data.id, active: true }),
  }, admin);
  assert.equal(offering.response.status, 201, JSON.stringify(offering.data));

  const forbidden = await request(`/api/v1/service-offerings/${offering.data.id}`, {
    method: 'DELETE', body: JSON.stringify({ version: offering.data.version }),
  }, viewerAuth);
  assert.equal(forbidden.response.status, 403);
  const blockedUnit = await request(`/api/v1/organization-units/${unit.data.id}`, {
    method: 'DELETE', body: JSON.stringify({ version: unit.data.version }),
  }, admin);
  assert.equal(blockedUnit.response.status, 409);
  assert.equal(blockedUnit.data.error.code, 'UNIT_HAS_ACTIVE_OFFERINGS');
  const removedOffering = await request(`/api/v1/service-offerings/${offering.data.id}`, {
    method: 'DELETE', body: JSON.stringify({ version: offering.data.version }),
  }, admin);
  assert.equal(removedOffering.response.status, 200);
  assert.equal(removedOffering.data.active, false);
  const removedUnit = await request(`/api/v1/organization-units/${unit.data.id}`, {
    method: 'DELETE', body: JSON.stringify({ version: unit.data.version }),
  }, admin);
  assert.equal(removedUnit.response.status, 200);
  assert.equal(removedUnit.data.active, false);

  const created = await request('/api/v1/companies', {
    method: 'POST', headers: { 'idempotency-key': `company-delete-${crypto.randomUUID()}` }, body: JSON.stringify(companyPayload('55000001')),
  }, admin);
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const archived = await request(`/api/v1/companies/${created.data.id}`, {
    method: 'DELETE', body: JSON.stringify({ version: created.data.version, confirmation: created.data.id, reason: 'Suppression logique demandée par QA' }),
  }, admin);
  assert.equal(archived.response.status, 200);
  assert.equal(archived.data.status, 'archived');
  assert.equal(readDb().companies.find(company => company.id === created.data.id).status, 'archived');
  await startReadyFixture();
});

test('P1 idempotence : même clé rejoue le résultat et refuse un payload différent', async () => {
  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  const key = `organization-idempotency-${crypto.randomUUID()}`;
  const payload = companyPayload('53000001');
  const first = await request('/api/v1/companies', {
    method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify(payload),
  }, admin);
  assert.equal(first.response.status, 201, JSON.stringify(first.data));
  const replay = await request('/api/v1/companies', {
    method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify(payload),
  }, admin);
  const conflict = await request('/api/v1/companies', {
    method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify({ ...payload, legalName: 'Payload différent' }),
  }, admin);
  assert.deepEqual({
    replayStatus: replay.response.status,
    replaySameId: replay.data?.id === first.data.id,
    conflictStatus: conflict.response.status,
    conflictCode: conflict.data?.error?.code,
    persistedCount: readDb().companies.filter(item => item.code === payload.code).length,
  }, { replayStatus: 200, replaySameId: true, conflictStatus: 409, conflictCode: 'IDEMPOTENCY_CONFLICT', persistedCount: 1 });
  await startReadyFixture();
});

test('P1 audit : création rattachée au nouveau tenant et requestId présent sur chaque événement', async () => {
  resetData(makeSeed());
  admin = await login('admin@northlight.fr');
  const created = await request('/api/v1/companies', {
    method: 'POST', headers: { 'idempotency-key': `audit-${crypto.randomUUID()}` }, body: JSON.stringify(companyPayload('54000001')),
  }, admin);
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const audit = await request('/api/v1/audit?pageSize=200', {}, admin);
  assert.equal(audit.response.status, 200);
  const entry = audit.data.items.find(item => item.action === 'organization.created' && item.entityId === created.data.id);
  assert.deepEqual({
    creationAuditVisible: Boolean(entry),
    creationAuditCompanyId: entry?.companyId,
    creationAuditHasRequestId: /^[0-9a-f-]{36}$/i.test(entry?.requestId || ''),
    allEventsHaveRequestId: audit.data.items.every(item => typeof item.requestId === 'string' && item.requestId.length > 0),
  }, { creationAuditVisible: true, creationAuditCompanyId: created.data.id, creationAuditHasRequestId: true, allEventsHaveRequestId: true });
  await startReadyFixture();
});

test('01b migration fiscale : marker additif unique, schema v3 conservé et collections métier intactes', async () => {
  resetData(makeSeed());
  const before = readDb();
  const preservedKeys = ['resources', 'clients', 'projects', 'reservations', 'stockItems', 'equipmentAssets', 'stockLocations', 'stockMovements', 'maintenanceRecords'];
  const preserved = Object.fromEntries(preservedKeys.map(key => [key, clone(before[key] || [])]));
  const migrated = readDb();
  assert.deepEqual({
    schemaVersion: migrated.schemaVersion,
    historicMarkerCount: migrated.migrations.filter(item => item.id === 'foundation-01-organization-v2-to-v3').length,
    fiscalMarkerCount: migrated.migrations.filter(item => item.id === 'foundation-01b-organization-fiscal-v3').length,
    hasVatRates: Array.isArray(migrated.vatRates),
    profilesVersioned: migrated.companies.every(item => Number.isInteger(item.fiscalProfileVersion) && item.fiscalProfileVersion >= 1),
    preserved: preservedKeys.every(key => JSON.stringify(migrated[key] || []) === JSON.stringify(preserved[key])),
  }, { schemaVersion: 3, historicMarkerCount: 1, fiscalMarkerCount: 1, hasVatRates: true, profilesVersioned: true, preserved: true });
  const replay = readDb();
  assert.equal(replay.migrations.filter(item => item.id === 'foundation-01b-organization-fiscal-v3').length, 1);
  assert.equal(replay.auditEvents.filter(item => item.action === 'company.fiscalProfile.migrated').length, migrated.auditEvents.filter(item => item.action === 'company.fiscalProfile.migrated').length);
  await startReadyFixture();
});

test('01b migration fiscale : un marqueur falsifié est refusé au rejeu', () => {
  resetData(makeSeed());
  const tampered = clone(readDb());
  const marker = tampered.migrations.find(item => item.id === 'foundation-01b-organization-fiscal-v3');
  assert.ok(marker, 'le marqueur 01b doit exister avant falsification');
  marker.outputDigest = `${marker.outputDigest[0] === 'a' ? 'b' : 'a'}${marker.outputDigest.slice(1)}`;
  assert.throws(
    () => migrateOrganizationFiscalV3(tampered, JSON.stringify(tampered)),
    error => error?.code === 'MIGRATION_MARKER_CONFLICT' && error?.status === 409,
  );
});

test('01b seed fiscal : profils FR complets, taux STANDARD 2000 modifiable et tenant non-FR sans défaut français', async () => {
  resetData(makeSeed());
  const db = readDb();
  const frenchIds = ['company_eliote_props_prod', 'company_eliote_location', 'company_fav_location'];
  const french = db.companies.filter(item => frenchIds.includes(item.id));
  const frenchProfilesComplete = french.every(company => company.taxCountry === 'FR' && company.currency === 'EUR' && company.vatStatus === 'registered' && company.taxIdentifiers?.some(item => item.type === 'businessRegistration') && company.taxIdentifiers?.some(item => item.type === 'establishment') && company.taxIdentifiers?.some(item => item.type === 'vat') && db.vatRates?.some(rate => rate.id === company.defaultVatRateId && rate.companyId === company.id && rate.code === 'STANDARD' && rate.rateBps === 2000) && db.vatRates?.some(rate => rate.companyId === company.id && rate.id !== company.defaultVatRateId && rate.active));
  const foreign = db.companies.find(item => item.taxCountry && item.taxCountry !== 'FR');
  assert.deepEqual({
    frenchCount: french.length,
    frenchProfilesComplete,
    foreignExists: Boolean(foreign),
    foreignHasExplicitRate: Boolean(foreign && db.vatRates?.some(rate => rate.id === foreign.defaultVatRateId && rate.companyId === foreign.id)),
    foreignHasInjectedFrenchStandard: Boolean(foreign && db.vatRates?.some(rate => rate.companyId === foreign.id && rate.code === 'STANDARD' && rate.rateBps === 2000)),
  }, { frenchCount: 3, frenchProfilesComplete: true, foreignExists: true, foreignHasExplicitRate: true, foreignHasInjectedFrenchStandard: false });
  await startReadyFixture();
});

test('01b confidentialité : liste et détail masquent le fiscal même avec fiscalProfile.read, seule la route dédiée le restitue', async () => {
  resetData(makeSeed());
  const db = readDb();
  const viewerMembership = db.organizationMemberships.find(item => item.userId === 'user_viewer' && item.status === 'active');
  assert.ok(viewerMembership, 'membership viewer active requis');
  const viewerRoleIds = db.membershipRoles.filter(item => item.membershipId === viewerMembership.id).map(item => item.roleId);
  const viewerRole = db.roles.find(item => viewerRoleIds.includes(item.id) && item.active);
  assert.ok(viewerRole, 'rôle viewer actif requis');
  viewerRole.permissions = [...new Set([...(viewerRole.permissions || []), 'organization.read', 'fiscalProfile.read'])];
  resetData(db);

  const fiscalViewer = await login('viewer@northlight.fr');
  assert.ok(fiscalViewer.user.permissions.includes('fiscalProfile.read'));
  const listResult = await request('/api/v1/companies?pageSize=20', {}, fiscalViewer);
  assert.equal(listResult.response.status, 200, JSON.stringify(listResult.data));
  const listed = listResult.data.items.find(item => item.id === fiscalViewer.user.companyId);
  assert.ok(listed, 'organisation active du viewer absente de la liste');
  const detailResult = await request(`/api/v1/companies/${listed.id}`, {}, fiscalViewer);
  assert.equal(detailResult.response.status, 200, JSON.stringify(detailResult.data));

  const fiscalKeys = ['taxIdentifiers', 'taxCountry', 'vatStatus', 'defaultVatRateId', 'fiscalProfileVersion', 'fiscalValidatedAt', 'fiscalValidatedBy', 'taxValidationPolicy'];
  for (const [surface, company] of [['list', listed], ['detail', detailResult.data]]) {
    for (const key of fiscalKeys) assert.ok(!Object.prototype.hasOwnProperty.call(company, key), `${surface} expose ${key}`);
  }

  const profileResult = await request(`/api/v1/companies/${listed.id}/fiscal-profile`, {}, fiscalViewer);
  assert.equal(profileResult.response.status, 200, JSON.stringify(profileResult.data));
  assert.equal(profileResult.data.companyId, listed.id);
  assert.ok(Array.isArray(profileResult.data.taxIdentifiers));
  for (const key of ['taxCountry', 'vatStatus', 'fiscalProfileVersion', 'taxValidationPolicy']) {
    assert.ok(Object.prototype.hasOwnProperty.call(profileResult.data, key), `profil fiscal incomplet: ${key}`);
  }
  await startReadyFixture();
});

test('01b API fiscal profile : lecture/mutation isolées, RBAC dédié et double contrôle de version', async () => {
  await startReadyFixture();
  for (const permission of ['fiscalProfile.read', 'fiscalProfile.manage', 'vatRate.read', 'vatRate.manage']) {
    assert.ok(admin.user.permissions.includes(permission), `permission fiscale admin absente au login: ${permission}`);
    assert.ok(!viewer.user.permissions.includes(permission), `permission fiscale viewer accordée au login: ${permission}`);
  }
  const profile = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {}, admin);
  const viewerRead = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {}, viewer);
  const foreign = await request('/api/v1/companies/company_eliote_location/fiscal-profile', {}, admin);
  const patch = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {
    method: 'PATCH',
    body: JSON.stringify({
      version: profile.data?.version,
      fiscalProfileVersion: profile.data?.fiscalProfileVersion,
      taxCountry: profile.data?.taxCountry,
      currency: profile.data?.currency,
      vatStatus: profile.data?.vatStatus,
      taxIdentifiers: profile.data?.taxIdentifiers,
      defaultVatRateId: profile.data?.defaultVatRateId,
    }),
  }, admin);
  const stale = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {
    method: 'PATCH', body: JSON.stringify({ version: profile.data?.version, fiscalProfileVersion: profile.data?.fiscalProfileVersion, taxCountry: 'FR', currency: 'EUR', vatStatus: 'registered', taxIdentifiers: profile.data?.taxIdentifiers, defaultVatRateId: profile.data?.defaultVatRateId }),
  }, admin);
  assert.deepEqual({
    profileRead: profile.response.status,
    profileCompanyId: profile.data?.companyId,
    viewerRead: viewerRead.response.status,
    otherTenantRead: foreign.response.status,
    patch: patch.response.status,
    versionIncremented: patch.data?.version === profile.data?.version + 1,
    fiscalVersionIncremented: patch.data?.fiscalProfileVersion === profile.data?.fiscalProfileVersion + 1,
    stale: { status: stale.response.status, code: stale.data?.error?.code },
  }, { profileRead: 200, profileCompanyId: propsCompany.id, viewerRead: 403, otherTenantRead: 404, patch: 200, versionIncremented: true, fiscalVersionIncremented: true, stale: { status: 409, code: 'VERSION_CONFLICT' } });
});

test('01b O1 progressif : territoire et statut sont sauvegardés sans identifiants ni taux', async () => {
  await startReadyFixture();
  const created = await request('/api/v1/companies', {
    method: 'POST',
    headers: { 'idempotency-key': `fiscal-draft-${crypto.randomUUID()}` },
    body: JSON.stringify(companyPayload('61000001')),
  }, admin);
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const profile = await request(`/api/v1/companies/${created.data.id}/fiscal-profile`, {}, admin);
  const territory = await request(`/api/v1/companies/${created.data.id}/fiscal-profile`, {
    method: 'PATCH',
    body: JSON.stringify({
      version: profile.data.version,
      fiscalProfileVersion: profile.data.fiscalProfileVersion,
      taxCountry: 'FR',
      vatStatus: 'notApplicable',
    }),
  }, admin);
  assert.deepEqual({
    status: territory.response.status,
    taxCountry: territory.data?.taxCountry,
    vatStatus: territory.data?.vatStatus,
    identifiers: territory.data?.taxIdentifiers,
    defaultVatRateId: territory.data?.defaultVatRateId,
    fiscalValidatedAt: territory.data?.fiscalValidatedAt,
  }, {
    status: 200,
    taxCountry: 'FR',
    vatStatus: 'notApplicable',
    identifiers: [],
    defaultVatRateId: null,
    fiscalValidatedAt: null,
  });
});

test('01b revalidation : changer de policy invalide identifiants, taux et validation', async () => {
  await startReadyFixture();
  const profile = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {}, admin);
  assert.ok(profile.data.taxIdentifiers.length > 0 && profile.data.defaultVatRateId);
  const changed = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {
    method: 'PATCH',
    body: JSON.stringify({
      version: profile.data.version,
      fiscalProfileVersion: profile.data.fiscalProfileVersion,
      taxCountry: 'GB',
      vatStatus: 'notApplicable',
    }),
  }, admin);
  const completeness = await request(`/api/v1/companies/${propsCompany.id}/completeness`, {}, admin);
  const missing = completeness.data?.stages?.find(item => item.code === 'identity')?.missingFields || [];
  assert.deepEqual({
    status: changed.response.status,
    taxCountry: changed.data?.taxCountry,
    policy: changed.data?.taxValidationPolicy,
    identifiers: changed.data?.taxIdentifiers,
    defaultVatRateId: changed.data?.defaultVatRateId,
    fiscalValidatedAt: changed.data?.fiscalValidatedAt,
    defaultRateMissing: missing.includes('fiscalProfile.defaultVatRateId'),
    validationMissing: missing.includes('fiscalProfile.validation'),
  }, {
    status: 200,
    taxCountry: 'GB',
    policy: { country: 'GB', policyVersion: 'GENERIC@1' },
    identifiers: [],
    defaultVatRateId: null,
    fiscalValidatedAt: null,
    defaultRateMissing: true,
    validationMissing: true,
  });
});

test('01b validation explicite : PATCH remet la validation à null et validate-stage la confirme', async () => {
  await startReadyFixture();
  const profile = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {}, admin);
  const draft = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {
    method: 'PATCH',
    body: JSON.stringify({
      version: profile.data.version,
      fiscalProfileVersion: profile.data.fiscalProfileVersion,
      vatStatus: profile.data.vatStatus,
    }),
  }, admin);
  assert.equal(draft.response.status, 200, JSON.stringify(draft.data));
  assert.equal(draft.data.fiscalValidatedAt, null);
  const validated = await request(`/api/v1/companies/${propsCompany.id}/validate-stage`, {
    method: 'POST',
    body: JSON.stringify({ stage: 'identity', version: draft.data.version }),
  }, admin);
  const confirmed = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {}, admin);
  const audit = await request('/api/v1/audit?pageSize=200', {}, admin);
  assert.deepEqual({
    validateStatus: validated.response.status,
    onboardingStage: validated.data?.onboardingStage,
    confirmedAt: typeof confirmed.data?.fiscalValidatedAt === 'string',
    validationAudit: audit.data?.items?.some(item => item.action === 'company.fiscalProfile.validated'),
  }, {
    validateStatus: 200,
    onboardingStage: 'sitesServices',
    confirmedAt: true,
    validationAudit: true,
  });
});

test('P1 activités : le client régénère les requirements lors du changement d’activité', async () => {
  await startReadyFixture();
  const current = await request(`/api/v1/companies/${propsCompany.id}`, {}, admin);
  const requirements = [{ activity: 'rental', category: 'rental', decision: 'enabled' }];
  const changed = await request(`/api/v1/companies/${propsCompany.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      version: current.data.version,
      activities: ['rental'],
      primaryActivity: 'rental',
      activityRequirements: requirements,
    }),
  }, admin);
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const activeIdentityConsumer = appSource.slice(
    appSource.indexOf('async function submitIdentityBase'),
    appSource.indexOf('function fiscalVersions'),
  );
  assert.deepEqual({
    status: changed.response.status,
    activities: changed.data?.activities,
    requirements: changed.data?.activityRequirements,
    clientRegenerates: /activityRequirements:requirementsFor\(activities\)/.test(activeIdentityConsumer),
    clientDoesNotReuseStale: !/activityRequirements:company\.activityRequirements\?\.length\?company\.activityRequirements:requirementsFor\(activities\)/.test(activeIdentityConsumer),
  }, {
    status: 200,
    activities: ['rental'],
    requirements,
    clientRegenerates: true,
    clientDoesNotReuseStale: true,
  });
});

test('O1 fiscal : une organisation active mais non validée conserve le bouton de validation', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const reviewSource = appSource.slice(
    appSource.indexOf('function o1Review'),
    appSource.indexOf('function renderOrganizationIdentity'),
  );
  assert.equal(reviewSource.includes("${validated&&workflowAdvanced?'<a class=\"primary-button link-button\""), true);
  assert.equal(reviewSource.includes("${workflowAdvanced?'<a class=\"primary-button link-button\""), false);
});

test('navigation Équipe ouvre la gouvernance du personnel et active son entrée dédiée', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(appSource, /organizationRoutes=new Set\(\[[^\]]*'team'/);
  assert.match(appSource, /route==='team'\?teamPage\(\):route==='organization-governance'\?governancePage\(\)/);
  assert.match(appSource, /function teamPage\(\)/);
  assert.match(appSource, /Membres, compétences et disponibilités utilisés par le planning/);
  assert.match(appSource, /\/api\/v1\/personnel-directory\?pageSize=200/);
  assert.match(appSource, /const members=personnelAdmin\.directory/);
  assert.match(appSource, /can\('membership\.read'\)\?'<a class="secondary-button link-button" href="#organization-governance">Gérer les accès<\/a>':''/);
  assert.match(appSource, /route==='team'\?'Équipe'/);
  assert.match(appSource, /route==='team'\?'team':'organization'/);
});

test('01b taux TVA : points de base entiers, périodes, défaut modifiable et aucune seconde autorité décimale', async () => {
  await startReadyFixture();
  const rates = await request('/api/v1/vat-rates?active=true&pageSize=50', {}, admin);
  const standard = rates.data?.items?.find(item => item.code === 'STANDARD');
  const key = `vat-rate-${crypto.randomUUID()}`;
  const future = await request('/api/v1/vat-rates', {
    method: 'POST', headers: { 'idempotency-key': key },
    body: JSON.stringify({ code: 'FUTURE', label: 'Taux futur QA', rateBps: 1750, active: true, validFrom: '2027-01-01' }),
  }, admin);
  const float = await request('/api/v1/vat-rates', {
    method: 'POST', headers: { 'idempotency-key': `vat-float-${crypto.randomUUID()}` },
    body: JSON.stringify({ code: 'FLOAT', label: 'Taux flottant interdit', rateBps: 20.5, rate: 0.205, active: true, validFrom: '2027-01-01' }),
  }, admin);
  const deactivateDefault = await request(`/api/v1/vat-rates/${standard?.id || 'missing'}`, {
    method: 'PATCH', body: JSON.stringify({ version: standard?.version, active: false }),
  }, admin);
  assert.deepEqual({
    list: rates.response.status,
    standardRateBps: standard?.rateBps,
    future: future.response.status,
    futureRateBps: future.data?.rateBps,
    float: { status: float.response.status, reason: float.data?.error?.details?.reason },
    deactivateDefault: deactivateDefault.response.status,
  }, { list: 200, standardRateBps: 2000, future: 201, futureRateBps: 1750, float: { status: 400, reason: 'FIELD_NOT_ALLOWED' }, deactivateDefault: 409 });
});

test('01b O1 : complétude expose les chemins fiscaux stables tant que la validation manque', async () => {
  await startReadyFixture();
  const completeness = await request(`/api/v1/companies/${propsCompany.id}/completeness`, {}, admin);
  const missing = completeness.data?.stages?.find(item => item.code === 'identity')?.missingFields || [];
  assert.ok(missing.includes('fiscalProfile.validation') || (!missing.some(item => item.startsWith('fiscalProfile.')) && completeness.data?.stages?.find(item => item.code === 'identity')?.state === 'complete'));
});

test('01b audit/SSE : invalidation post-commit sans identifiant fiscal sensible', async () => {
  await startReadyFixture();
  const controller = new AbortController();
  const stream = await fetch(`${baseUrl}/api/v1/events`, { headers: { cookie: admin.cookie, accept: 'text/event-stream' }, signal: controller.signal });
  const reader = stream.body.getReader();
  await reader.read();
  const profile = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {}, admin);
  const updated = await request(`/api/v1/companies/${propsCompany.id}/fiscal-profile`, {
    method: 'PATCH', body: JSON.stringify({ version: profile.data?.version, fiscalProfileVersion: profile.data?.fiscalProfileVersion, taxCountry: profile.data?.taxCountry, currency: profile.data?.currency, vatStatus: profile.data?.vatStatus, taxIdentifiers: profile.data?.taxIdentifiers, defaultVatRateId: profile.data?.defaultVatRateId }),
  }, admin);
  let text = '';
  const deadline = Date.now() + 1_000;
  while (!text.includes('company.fiscalProfile.updated.v1') && Date.now() < deadline) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += new TextDecoder().decode(chunk.value);
  }
  controller.abort();
  const audit = await request('/api/v1/audit?pageSize=200', {}, admin);
  const fiscalAudit = audit.data?.items?.find(item => item.action === 'company.fiscalProfile.updated');
  assert.deepEqual({
    patch: updated.response.status,
    sseTypePresent: text.includes('company.fiscalProfile.updated.v1'),
    sseLeaksIdentifier: /taxIdentifiers|registrationNumber|vatNumber|851000001/i.test(text),
    auditVisible: Boolean(fiscalAudit),
    auditLeaksIdentifier: /taxIdentifiers|registrationNumber|vatNumber|851000001/i.test(JSON.stringify(fiscalAudit || {})),
  }, { patch: 200, sseTypePresent: true, sseLeaksIdentifier: false, auditVisible: true, auditLeaksIdentifier: false });
});
