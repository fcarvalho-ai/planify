'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint7-finance-${process.pid}-${Date.now()}.json`);
const { actualRevisionDigest, createServer, financeMargins, resetData, makeSeed, readDb, sprint7FinanceStateValid, resolveInternalCostRate, rollbackSprint7Finance, ssePermissionsForEvent } = require('../server.js');

let server; let baseUrl; let admin; let viewer; let financeParis; let auditOnly;
async function request(route, options = {}, auth) { const headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }; if (auth?.cookie) headers.cookie = auth.cookie; if (auth?.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['x-csrf-token'] = auth.csrf; const response = await fetch(`${baseUrl}${route}`, { ...options, headers }); const text = await response.text(); let data; try { data = text ? JSON.parse(text) : undefined; } catch { data = text; } return { response, data }; }
async function login(email) { const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) }); assert.equal(result.response.status, 200); return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken, user: result.data.user }; }

before(async () => {
  resetData(makeSeed());
  const seeded = readDb(), template = seeded.users.find(value => value.id === 'user_viewer'), timestamp = new Date().toISOString(), userId = 'user_finance_paris', membershipId = 'membership_finance_paris', roleId = 'role_finance_manager', boulogneUserId = 'user_finance_boulogne_scope', boulogneMembershipId = 'membership_finance_boulogne_scope', auditUserId = 'user_audit_only', auditMembershipId = 'membership_audit_only', auditRoleId = 'role_audit_only';
  seeded.users.push({ ...template, id: userId, email: 'finance.paris@northlight.fr', displayName: 'Finance Paris', role: 'financeManager', siteIds: ['site_paris'] }, { ...template, id: boulogneUserId, email: 'finance.boulogne.scope@northlight.fr', displayName: 'Personne Boulogne', role: 'viewer', siteIds: ['site_boulogne'] }, { ...template, id: auditUserId, email: 'audit.only@northlight.fr', displayName: 'Audit sans finance', role: 'auditOnly', siteIds: ['site_paris'] });
  seeded.organizationMemberships.push({ id: membershipId, userId, companyId: 'company_northlight', displayName: 'Finance Paris', status: 'active', defaultSiteId: 'site_paris', version: 1, createdAt: timestamp, updatedAt: timestamp }, { id: boulogneMembershipId, userId: boulogneUserId, companyId: 'company_northlight', displayName: 'Personne Boulogne', status: 'active', defaultSiteId: 'site_boulogne', version: 1, createdAt: timestamp, updatedAt: timestamp }, { id: auditMembershipId, userId: auditUserId, companyId: 'company_northlight', displayName: 'Audit sans finance', status: 'active', defaultSiteId: 'site_paris', version: 1, createdAt: timestamp, updatedAt: timestamp });
  seeded.roles.push({ id: roleId, companyId: 'company_northlight', code: 'financeManager', name: 'Finance gestion', permissions: ['finance.read', 'finance.cost.manage'], systemManaged: false, active: true, version: 1, createdAt: timestamp, updatedAt: timestamp }, { id: auditRoleId, companyId: 'company_northlight', code: 'auditOnly', name: 'Audit sans finance', permissions: ['audit.read'], systemManaged: false, active: true, version: 1, createdAt: timestamp, updatedAt: timestamp });
  seeded.membershipRoles.push({ membershipId, roleId }, { membershipId: auditMembershipId, roleId: auditRoleId });
  seeded.membershipScopes.push({ membershipId, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [], entityScopes: { client: ['client_1'] } }, { membershipId: boulogneMembershipId, scope: 'sites', siteIds: ['site_boulogne'], organizationUnitIds: [] }, { membershipId: auditMembershipId, scope: 'sites', siteIds: ['site_paris'], organizationUnitIds: [] });
  seeded.organizationUnits.push({ id: 'unit_finance_boulogne', companyId: 'company_northlight', siteId: 'site_boulogne', parentUnitId: null, code: 'FIN-BLG', name: 'Finance Boulogne', kind: 'service', activities: ['postProduction'], active: true, version: 1 });
  seeded.projects.push({ ...structuredClone(seeded.projects.find(value => value.id === 'project_1')), id: 'project_finance_boulogne', code: 'FIN-BLG', projectNumber: 'FIN-BLG', name: 'Projet Finance Boulogne', siteId: 'site_boulogne', version: 1 });
  fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(seeded, null, 2)}\n`, { mode: 0o600 });
  server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login('admin@northlight.fr'); viewer = await login('viewer@northlight.fr'); financeParis = await login('finance.paris@northlight.fr'); auditOnly = await login('audit.only@northlight.fr');
});
after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {} });

test('la migration Finance S7 est additive, privée et rejouable', () => {
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-7-finance-costs-v1');
  assert.ok(marker); assert.deepEqual(marker.collections, ['costRates', 'plannedCostSnapshots', 'projectCosts', 'projectCostRevisions', 'financeIdempotency']); assert.equal(sprint7FinanceStateValid(db), true);
  assert.equal(fs.statSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile)).mode & 0o777, 0o600);
  assert.ok(admin.user.permissions.includes('finance.cost.manage')); assert.deepEqual(ssePermissionsForEvent('costRate.updated.v1'), ['finance.read']);
  const clientName = db.clients[0].name; db.clients[0].name = 'Mutation locale interdite'; assert.equal(readDb().clients[0].name, clientName, 'chaque lecture doit rester isolée du cache validé');
});

test('les coûts datés sont idempotents, sans chevauchement et résolus ressource avant catégorie', async () => {
  const resource = readDb().resources.find(value => value.id === 'resource_3'), categoryBody = JSON.stringify({ scopeType: 'resourceCategory', scopeId: resource.resourceCategoryId, unit: 'unite', costUnitMinor: '800', currency: 'EUR', validFrom: '2026-01-01', active: true });
  const category = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-category-1' }, body: categoryBody }, admin); assert.equal(category.response.status, 201, JSON.stringify(category.data));
  const directBody = JSON.stringify({ scopeType: 'resource', scopeId: resource.id, unit: 'unite', costUnitMinor: '1000', currency: 'EUR', validFrom: '2026-01-01', active: true }), direct = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-rate-1' }, body: directBody }, admin); assert.equal(direct.response.status, 201, JSON.stringify(direct.data));
  const replay = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-rate-1' }, body: directBody }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.id, direct.data.id);
  const overlap = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-overlap' }, body: JSON.stringify({ ...JSON.parse(directBody), validFrom: '2026-06-01', costUnitMinor: '1200' }) }, admin); assert.equal(overlap.response.status, 409); assert.equal(overlap.data.error.code, 'COST_RATE_PERIOD_OVERLAP');
  assert.equal(resolveInternalCostRate(readDb(), { companyId: resource.companyId, resourceId: resource.id, unit: 'unite', at: '2026-08-17' }).id, direct.data.id);
});

test('la lecture des coûts internes résout la source et masque les quatre scopes hors site', async () => {
  const db = readDb(), boulogneResource = db.resources.find(value => value.siteId === 'site_boulogne' && value.active !== false), boulogneCategory = db.resourceCategories.find(value => value.siteId === 'site_boulogne' && value.active !== false), boulogneUnit = db.organizationUnits.find(value => value.siteId === 'site_boulogne' && value.active !== false), boulogneMembership = db.organizationMemberships.find(value => value.defaultSiteId === 'site_boulogne' && value.status === 'active'), boulognePerson = boulogneMembership && db.users.find(value => value.id === boulogneMembership.userId && value.active !== false); assert.ok(boulogneResource); assert.ok(boulogneCategory); assert.ok(boulogneUnit); assert.ok(boulognePerson);
  const sources = [['resource', boulogneResource.id], ['resourceCategory', boulogneCategory.id], ['person', boulognePerson.id], ['personCategory', boulogneUnit.id]], createdIds = [];
  for (const [scopeType, scopeId] of sources) { const created = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': `hidden-${scopeType}` }, body: JSON.stringify({ scopeType, scopeId, unit: 'mois', costUnitMinor: '1234', currency: 'EUR', validFrom: '2026-01-01', active: true }) }, admin); assert.equal(created.response.status, 201, JSON.stringify(created.data)); createdIds.push(created.data.id); }
  const hidden = await request('/api/v1/finance/cost-rates?pageSize=200', {}, financeParis); assert.equal(hidden.response.status, 200); assert.equal(hidden.data.items.some(value => createdIds.includes(value.id)), false);
});

test('les mutations de coûts restent bornées au site, au Client et au Projet autorisés', async () => {
  const db = readDb(), parisResource = db.resources.find(value => value.siteId === 'site_paris' && value.active !== false), boulogneMembership = db.organizationMemberships.find(value => value.id === 'membership_finance_boulogne_scope'), boulognePerson = db.users.find(value => value.id === boulogneMembership.userId);
  assert.ok(parisResource); assert.ok(boulognePerson);

  const hiddenPersonRate = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-person-hidden-create' }, body: JSON.stringify({ scopeType: 'person', scopeId: boulognePerson.id, unit: 'forfait', costUnitMinor: '4200', currency: 'EUR', validFrom: '2026-01-01', active: true }) }, financeParis);
  assert.equal(hiddenPersonRate.response.status, 404); assert.equal(hiddenPersonRate.data.error.code, 'NOT_FOUND');

  const visibleRate = await request('/api/v1/finance/cost-rates', { method: 'POST', headers: { 'Idempotency-Key': 'finance-resource-visible-create' }, body: JSON.stringify({ scopeType: 'resource', scopeId: parisResource.id, unit: 'forfait', costUnitMinor: '1500', currency: 'EUR', validFrom: '2026-01-01', active: true }) }, financeParis);
  assert.equal(visibleRate.response.status, 201, JSON.stringify(visibleRate.data));
  const hiddenRetarget = await request(`/api/v1/finance/cost-rates/${visibleRate.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'finance-resource-hidden-retarget' }, body: JSON.stringify({ version: visibleRate.data.version, scopeType: 'person', scopeId: boulognePerson.id }) }, financeParis);
  assert.equal(hiddenRetarget.response.status, 404); assert.equal(hiddenRetarget.data.error.code, 'NOT_FOUND');
  const unchangedRate = readDb().costRates.find(value => value.id === visibleRate.data.id); assert.equal(unchangedRate.scopeType, 'resource'); assert.equal(unchangedRate.scopeId, parisResource.id); assert.equal(unchangedRate.version, visibleRate.data.version);

  const projectCostBody = { siteId: null, category: 'supplier', occurredOn: '2026-08-18', amountMinor: '2500', currency: 'EUR', description: 'Dépense périmètre Finance', status: 'draft' };
  const hiddenSiteCost = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'finance-project-hidden-site' }, body: JSON.stringify({ ...projectCostBody, projectId: 'project_finance_boulogne' }) }, financeParis);
  assert.equal(hiddenSiteCost.response.status, 404); assert.equal(hiddenSiteCost.data.error.code, 'NOT_FOUND');
  const hiddenClientCost = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'finance-project-hidden-client' }, body: JSON.stringify({ ...projectCostBody, projectId: 'project_2' }) }, financeParis);
  assert.equal(hiddenClientCost.response.status, 404); assert.equal(hiddenClientCost.data.error.code, 'NOT_FOUND');

  const visibleCost = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'finance-project-visible-create' }, body: JSON.stringify({ ...projectCostBody, projectId: 'project_1', siteId: 'site_paris' }) }, financeParis);
  assert.equal(visibleCost.response.status, 201, JSON.stringify(visibleCost.data));
  const hiddenProjectRetarget = await request(`/api/v1/finance/project-costs/${visibleCost.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'finance-project-hidden-retarget' }, body: JSON.stringify({ version: visibleCost.data.version, projectId: 'project_finance_boulogne', siteId: null, correctionReason: 'Correction de rattachement' }) }, financeParis);
  assert.equal(hiddenProjectRetarget.response.status, 404); assert.equal(hiddenProjectRetarget.data.error.code, 'NOT_FOUND');
  const unchangedCost = readDb().projectCosts.find(value => value.id === visibleCost.data.id); assert.equal(unchangedCost.projectId, 'project_1'); assert.equal(unchangedCost.siteId, 'site_paris'); assert.equal(unchangedCost.version, visibleCost.data.version);
});

test('les marges filtrent Client, Devis, Ressource et Prestation avant agrégation', () => {
  const db = readDb(), project = db.projects.find(value => value.id === 'project_1'), client = db.clients.find(value => value.id === project.clientId), resource = db.resources.find(value => value.id === 'resource_3'), quote = { id: 'quote_margin_scope', companyId: project.companyId, projectId: project.id, siteId: project.siteId, kind: 'quote', status: 'accepted', number: 'DEV-SCOPE', lines: [{ id: 'line_margin_resource', sourceType: 'resource', sourceId: resource.id, label: 'Ligne ressource privée', netHt: '10000', costTotal: '2000' }] }; db.quotes.push(quote);
  const scoped = resourceIds => ({ user: { id: 'finance_scope', companyId: project.companyId, siteIds: [project.siteId], organizationScope: false, organizationUnitIds: [], projectScopeRestricted: true, projectIds: [project.id], entityScopes: { client: [client.id], quote: [quote.id], resource: resourceIds }, effectivePermissions: ['finance.read', 'quote.read'] } });
  const hidden = financeMargins(db, scoped([]), { projectId: project.id, asOf: '2026-08-23' }); assert.equal(hidden.totals.signedRevenueMinor, '0'); assert.equal(hidden.itemCount, 0);
  const visible = financeMargins(db, scoped([resource.id]), { projectId: project.id, asOf: '2026-08-23' }); assert.equal(visible.totals.signedRevenueMinor, '10000'); assert.equal(visible.items.some(value => value.quoteLineId === 'line_margin_resource' && value.resourceId === resource.id), true); assert.equal(visible.definitionVersion, 'FINANCE_MARGIN@1');
  const clientHidden = scoped([resource.id]); clientHidden.user.entityScopes.client = []; assert.equal(financeMargins(db, clientHidden, { projectId: project.id, asOf: '2026-08-23' }).totals.signedRevenueMinor, '0');
});

test('une dépense Projet confirmée est corrigée par révision append-only', async () => {
  const payload = JSON.stringify({ projectId: 'project_1', siteId: 'site_paris', category: 'supplier', occurredOn: '2026-08-17', amountMinor: '5000', currency: 'EUR', description: 'Prestataire montage', status: 'confirmed' });
  const created = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'project-cost-1' }, body: payload }, admin); assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const corrected = await request(`/api/v1/finance/project-costs/${created.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'project-cost-patch-1' }, body: JSON.stringify({ version: 1, amountMinor: '6000', correctionReason: 'Facture fournisseur définitive' }) }, admin); assert.equal(corrected.response.status, 200); assert.equal(corrected.data.amountMinor, '6000'); assert.equal(corrected.data.version, 2);
  const db = readDb(), revision = db.projectCostRevisions.find(value => value.projectCostId === created.data.id); assert.equal(revision.snapshot.amountMinor, '5000'); assert.equal(revision.revisionNumber, 1); assert.equal(revision.snapshotDigest.length, 64);
  const terminalSource = await request('/api/v1/finance/project-costs', { method: 'POST', headers: { 'Idempotency-Key': 'project-cost-terminal-1' }, body: JSON.stringify({ ...JSON.parse(payload), description: 'Dépense à annuler', amountMinor: '100', status: 'draft' }) }, admin); assert.equal(terminalSource.response.status, 201);
  const cancelled = await request(`/api/v1/finance/project-costs/${terminalSource.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'project-cost-cancel-1' }, body: JSON.stringify({ version: 1, status: 'cancelled', correctionReason: 'Dépense finalement annulée' }) }, admin); assert.equal(cancelled.response.status, 200); assert.equal(cancelled.data.status, 'cancelled');
  const reopened = await request(`/api/v1/finance/project-costs/${terminalSource.data.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'project-cost-reopen-1' }, body: JSON.stringify({ version: 2, status: 'confirmed', correctionReason: 'Tentative de réouverture' }) }, admin); assert.equal(reopened.response.status, 409); assert.equal(reopened.data.error.code, 'PROJECT_COST_TERMINAL'); assert.equal(readDb().projectCosts.find(value => value.id === terminalSource.data.id).version, 2);
});

test('le coût réalisé est figé dans la révision et les marges restent réservées à finance.read', async () => {
  const reservation = readDb().reservations.find(value => value.id === 'reservation_1'), confirmed = await request(`/api/v1/reservations/${reservation.id}/actual/confirm`, { method: 'POST', headers: { 'Idempotency-Key': 'finance-actual-1' }, body: JSON.stringify({ reservationVersion: reservation.version }) }, admin); assert.equal(confirmed.response.status, 201, JSON.stringify(confirmed.data)); assert.equal(confirmed.data.currentRevision.costSnapshot.totalMinor, '1000');
  const plannedBefore = await request('/api/v1/analytics/margins?projectId=project_1&asOf=2026-08-23', {}, admin); assert.equal(plannedBefore.response.status, 200); assert.equal(plannedBefore.data.definitionVersion, 'FINANCE_MARGIN@1'); assert.ok(plannedBefore.data.generatedAt); assert.ok(plannedBefore.data.sources); assert.ok(Array.isArray(plannedBefore.data.items));
  const frozenDb = readDb(); assert.ok(frozenDb.plannedCostSnapshots.some(value => value.reservationId === reservation.id && value.sourceReservationVersion === reservation.version)); assert.equal(frozenDb.reservations.some(value => Object.hasOwn(value, 'plannedCostSnapshot')), false, 'les coûts internes ne doivent jamais être inclus dans les DTO Réservation');
  const completedDb = structuredClone(frozenDb), completedReservation = completedDb.reservations.find(value => value.id === reservation.id); completedReservation.status = 'completed'; const completedMargins = financeMargins(completedDb, { user: { ...admin.user, effectivePermissions: admin.user.permissions } }, { projectId: 'project_1', asOf: '2026-08-23' }); assert.equal(completedMargins.totals.plannedCostMinor, plannedBefore.data.totals.plannedCostMinor, 'terminer une réservation ne doit pas effacer son coût planifié historique');
  const rate = readDb().costRates.find(value => value.scopeType === 'resource' && value.scopeId === 'resource_3'), changed = await request(`/api/v1/finance/cost-rates/${rate.id}`, { method: 'PATCH', headers: { 'Idempotency-Key': 'finance-rate-patch-1' }, body: JSON.stringify({ version: rate.version, costUnitMinor: '2000' }) }, admin); assert.equal(changed.response.status, 200);
  const detail = await request(`/api/v1/actuals/${confirmed.data.id}`, {}, admin); assert.equal(detail.response.status, 200); assert.equal(detail.data.currentRevision.costSnapshot.totalMinor, '1000');
  const margins = await request('/api/v1/analytics/margins?projectId=project_1&asOf=2026-08-23', {}, admin); assert.equal(margins.response.status, 200, JSON.stringify(margins.data)); assert.equal(margins.data.currency, 'EUR'); assert.equal(margins.data.totals.actualCostMinor, '7000');
  assert.equal(margins.data.totals.plannedCostMinor, plannedBefore.data.totals.plannedCostMinor, 'le coût planifié doit rester figé après modification du tarif');
  const readerDetail = await request(`/api/v1/actuals/${confirmed.data.id}`, {}, viewer); assert.equal(readerDetail.response.status, 200); assert.equal(Object.hasOwn(readerDetail.data.currentRevision, 'costSnapshot'), false); assert.equal((readerDetail.data.revisions || []).some(value => Object.hasOwn(value, 'costSnapshot')), false);
  const denied = await request('/api/v1/analytics/margins?projectId=project_1', {}, viewer); assert.equal(denied.response.status, 403);
  const deniedCosts = await request('/api/v1/finance/project-costs', {}, viewer); assert.equal(deniedCosts.response.status, 403);
});

test('l’audit sans finance.read masque les montants et snapshots financiers', async () => {
  const restricted = await request('/api/v1/audit?pageSize=200', {}, auditOnly); assert.equal(restricted.response.status, 200);
  const financial = restricted.data.items.filter(value => ['actualRecord', 'costRate', 'projectCost'].includes(value.entityType)); assert.ok(financial.length > 0);
  for (const event of financial) { assert.equal(event.before, null); assert.equal(event.after, null); assert.equal(event.financialDetailsRestricted, true); }
  assert.doesNotMatch(JSON.stringify(financial), /costSnapshot|costUnitMinor|amountMinor|totalMinor/);
  const unrestricted = await request('/api/v1/audit?pageSize=200', {}, admin); assert.equal(unrestricted.response.status, 200); assert.ok(unrestricted.data.items.some(value => value.entityType === 'actualRecord' && value.after?.revision?.costSnapshot));
});

test('une falsification du snapshot de dépense ou du coût réel rend la base indisponible', () => {
  const raw = fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), tampered = JSON.parse(raw); tampered.projectCostRevisions[0].snapshot.amountMinor = '9999'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const actualTampered = JSON.parse(raw), revision = actualTampered.actualRevisions.find(value => value.digestVersion === 3); revision.costSnapshot.totalMinor = '9999'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(actualTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT'); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, raw, { mode: 0o600 });
  const structurallyTampered = JSON.parse(raw), structuralRevision = structurallyTampered.actualRevisions.find(value => value.digestVersion === 3); structuralRevision.costSnapshot.totalMinor = '9999'; structuralRevision.sourceDigest = actualRevisionDigest(structuralRevision); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(structurallyTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const plannedTampered = JSON.parse(raw), plannedSnapshot = plannedTampered.plannedCostSnapshots[0]; plannedSnapshot.sourceReservationVersion = 9999; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(plannedTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const referenceTampered = JSON.parse(raw); referenceTampered.costRates[0].scopeId = 'resource_absent'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(referenceTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  const markerTampered = JSON.parse(raw); markerTampered.financeIdempotency[0].resultId = 'costRate_absent'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(markerTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT'); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, raw, { mode: 0o600 });
  const chainTampered = JSON.parse(raw); chainTampered.projectCostRevisions.shift(); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(chainTampered, null, 2)}\n`, { mode: 0o600 }); assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT'); fs.writeFileSync(process.env.PLANIFY_DATA_FILE, raw, { mode: 0o600 });
});

test('le rollback Finance exige un export privé et restaure exactement la source', () => {
  assert.throws(() => rollbackSprint7Finance(), error => error.code === 'ROLLBACK_EXPORT_REQUIRED');
  const before = readDb(), marker = before.migrations.find(value => value.id === 'sprint-7-finance-costs-v1'), expected = fs.readFileSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile), 'utf8'), exportFile = `${process.env.PLANIFY_DATA_FILE}.finance-export.json`, result = rollbackSprint7Finance({ exportFile });
  assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600); assert.equal(fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), expected); assert.match(result.restoredDigest, /^[a-f0-9]{64}$/);
});

test('la page Finance est autonome, accessible et sépare lecture et gestion', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), shell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8'), contract = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(shell, /href="#finance"[^>]*data-finance-nav/); assert.match(source, /Finance & marges/); assert.match(source, /can\('finance\.cost\.manage'\)/); assert.match(source, /data-cost-rate-form/); assert.match(source, /data-project-cost-form/); assert.match(source, /data-finance-drilldown/); assert.match(source, /Détail des marges par prestation/); assert.match(source, /role="region" aria-label="Coûts internes" tabindex="0"/); assert.match(css, /\.finance-page/); assert.match(contract, /\/analytics\/margins:/); assert.match(contract, /definitionVersion:/); assert.match(contract, /CostRatePatchCommand:/); assert.match(contract, /ProjectCostPatchCommand:/);
});
