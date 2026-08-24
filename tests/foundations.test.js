'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DomainError, errorEnvelope, successEnvelope } = require('../packages/shared/errors');
const { inspectCommand, rememberCommand } = require('../packages/shared/idempotency');
const { ROLES, standardRoleDefinitions, permissionsForRoles, authorize } = require('../packages/auth/rbac');
const { appendEvent, replayEvents } = require('../packages/events');
const { appendAudit, sanitizedDetails } = require('../packages/audit');
const { SchedulingEngine, overlaps } = require('../packages/scheduling');
const { PricingEngine } = require('../packages/pricing');
const { QuoteConsumptionEngine } = require('../packages/quote-consumption');
const { generatePerformanceDataset } = require('../scripts/generate-performance-dataset');
const { audit: appendServerAudit, domainEventTypeForAudit, ensureStandardRoles } = require('../server');
const fs = require('node:fs');

test('les enveloppes V1 exposent data/meta et error_id', () => {
  assert.deepEqual(successEnvelope({ id: 'x' }, { request_id: 'r' }), { data: { id: 'x' }, meta: { request_id: 'r' } });
  const result = errorEnvelope(new DomainError('INVALID', 'Invalide', { errorId: 'error-1' }));
  assert.deepEqual(result, { error: { code: 'INVALID', message: 'Invalide', error_id: 'error-1' } });
});

test('le serveur RC1 expose error_id sans retirer requestId pendant la transition', () => {
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  assert.match(source, /error_id: requestId, requestId/);
  assert.match(source, /appendAudit\(db\.auditEvents/);
  assert.match(source, /requestId: auth\.requestId \|\| errorId/);
  for (const token of ['correlationId: requestId', 'userId: auth.user.id', "req.headers['idempotency-key']", "route === '/api/v1/technical-metrics'"]) assert.ok(source.includes(token), `Observabilité incomplète : ${token}`);
});

test('le bouton de création de ressource reste branché après composition des modules frontend', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /querySelector\('\[data-add="resources"\]'\)/);
  assert.match(source, /createResource\.onclick=openResourceCreateDrawer/);
  assert.match(source, /'Idempotency-Key':editor\.idempotencyKey/);
  assert.match(css, /\.modal\{max-height:calc\(100dvh - 40px\);overflow:auto\}/);
  assert.match(css, /\.modal-actions\{position:sticky/);
  assert.match(css, /\.sidebar\{overflow-y:auto/);
});

test('le shell authentifié reste entièrement masqué hors session', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.match(shell, /class="app-shell" id="appShell" hidden aria-hidden="true"/);
  assert.match(source, /shell\.hidden=!authenticated/);
  assert.match(source, /shell\.setAttribute\('aria-hidden',String\(!authenticated\)\)/);
  assert.match(source, /shell\.inert=!authenticated/);
  assert.match(source, /\['modalBackdrop','commandPalette','stockDrawerBackdrop'\]/);
  assert.match(source, /overlay\.inert=!authenticated/);
  assert.match(source, /if\(!authenticated\)overlay\.hidden=true/);
  assert.match(source, /if\(!authenticated\)app\.replaceChildren\(\)/);
  assert.match(source, /loginForm\.elements\.email\.focus\(\{preventScroll:true\}\)/);
  assert.match(source, /render=function\(\)\{syncAuthenticatedSurfaces\(Boolean\(state\.user\)\);renderSprint8ExportsBase\(\)/);
  assert.match(css, /\.app-shell\[hidden\]\{display:none!important\}/);
});

test('les alias du design system utilisés par les modules métier sont définis', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const planningCss = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  for (const token of ['primary', 'surface', 'surface-soft', 'text', 'border']) {
    assert.match(css, new RegExp(`--${token}:var\\(--`), `variable --${token} manquante`);
  }
  assert.match(planningCss, /\.pilotage-tabs button:focus-visible,.pilotage-kpi button:focus-visible\{outline:3px solid var\(--primary\)/);
  assert.match(planningCss, /\.planning-matrix-scroll \.matrix-day\{z-index:10\}\.planning-fixed-column\{z-index:11\}\.planning-fixed-column \.matrix-corner\{z-index:12\}/);
});

test('les sept rôles V1 sont fermés et le scope masque un autre tenant ou site', () => {
  assert.deepEqual(ROLES, ['ADMIN', 'PLANNING_MANAGER', 'PLANNER', 'SALES', 'PROJECT_MANAGER', 'FINANCE', 'READ_ONLY']);
  assert.equal(standardRoleDefinitions('c1').length, 7);
  assert.equal(permissionsForRoles(['PLANNER']).has('planning.write'), true);
  assert.throws(() => authorize({ roleCodes: ['PLANNER'], companyId: 'c1', siteIds: ['s1'] }, 'planning.write', { companyId: 'c1', siteId: 's2' }), error => error.code === 'NOT_FOUND');
  assert.throws(() => authorize({ roleCodes: ['READ_ONLY'], companyId: 'c1', siteIds: ['s1'] }, 'planning.write', { companyId: 'c1', siteId: 's1' }), error => error.code === 'FORBIDDEN');
  assert.throws(() => authorize({ roleCodes: ['PLANNER'], companyId: 'c1', siteIds: ['s1'], entityScopes: { resource: ['r1'] } }, 'planning.write', { companyId: 'c1', siteId: 's1', entityType: 'resource', entityId: 'r2' }), error => error.code === 'NOT_FOUND');
  assert.throws(() => ensureStandardRoles({ roles: [{ id: 'forged', companyId: 'c1', code: 'ADMIN', permissions: ['planning.read'], systemManaged: true, active: true }] }, 'c1'), error => error.code === 'RBAC_STANDARD_ROLE_CONFLICT');
});

test('la migration du catalogue RBAC sauvegarde, rejoue et refuse une altération', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'planify-foundation-rbac-'));
  const dataFile = path.join(directory, 'planify.json');
  const script = `
    const fs = require('node:fs');
    const path = require('node:path');
    const server = require('./server');
    server.resetData(server.makeSeed());
    const first = server.readDb();
    const marker = first.migrations.find(value => value.id === 'foundation-00-rbac-catalog-v1');
    const backup = marker && path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile);
    const standard = first.roles.filter(value => value.companyId === 'company_northlight' && value.systemManaged && ['ADMIN','PLANNING_MANAGER','PLANNER','SALES','PROJECT_MANAGER','FINANCE','READ_ONLY'].includes(value.code));
    const replay = server.readDb();
    const replayStandard = replay.roles.filter(value => value.companyId === 'company_northlight' && value.systemManaged && ['ADMIN','PLANNING_MANAGER','PLANNER','SALES','PROJECT_MANAGER','FINANCE','READ_ONLY'].includes(value.code));
    replay.roles.find(value => value.id === marker.createdRoleIds[0]).permissions.push('tampered.permission');
    fs.writeFileSync(process.env.PLANIFY_DATA_FILE, JSON.stringify(replay));
    let conflictCode = null;
    try { server.readDb(); } catch (error) { conflictCode = error.code; }
    process.stdout.write(JSON.stringify({ marker, backupExists: Boolean(backup && fs.existsSync(backup)), backupMode: backup ? (fs.statSync(backup).mode & 0o777) : null, standardCount: standard.length, replayCount: replayStandard.length, conflictCode }));
  `;
  const execution = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PLANIFY_DATA_FILE: dataFile },
    encoding: 'utf8',
  });
  assert.equal(execution.status, 0, execution.stderr);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.marker.policyVersion, 'RBAC-V1@1');
  assert.equal(result.marker.createdRoleIds.length, 7);
  assert.equal(result.backupExists, true);
  assert.equal(result.backupMode, 0o600);
  assert.equal(result.standardCount, 7);
  assert.equal(result.replayCount, 7);
  assert.equal(result.conflictCode, 'MIGRATION_MARKER_CONFLICT');
});

test('une commande idempotente rejoue le même résultat et refuse un autre payload', () => {
  const records = [], input = { companyId: 'c1', actorUserId: 'u1', command: 'reservation.create', targetId: 'p1', key: 'key-1', payload: { b: 2, a: 1 } };
  const marker = inspectCommand(records, input);
  rememberCommand(records, marker, { id: 'r1' });
  assert.deepEqual(inspectCommand(records, { ...input, payload: { a: 1, b: 2 } }), { replay: true, result: { id: 'r1' } });
  assert.throws(() => inspectCommand(records, { ...input, payload: { a: 2 } }), error => error.code === 'IDEMPOTENCY_CONFLICT');
});

test('le journal de domaine est ordonné, borné au tenant et rejouable', () => {
  const journal = [];
  appendEvent(journal, { type: 'ClientCreated', companyId: 'c1', entityType: 'client', entityId: 'cl1' }, () => '2026-08-19T08:00:00.000Z');
  appendEvent(journal, { type: 'ProjectCreated', companyId: 'c2', entityType: 'project', entityId: 'p2' });
  appendEvent(journal, { type: 'ProjectCreated', companyId: 'c1', entityType: 'project', entityId: 'p1' });
  assert.deepEqual(replayEvents(journal, { companyId: 'c1', afterSequence: 1 }).map(event => event.entityId), ['p1']);
  assert.throws(() => appendEvent(journal, { type: 'Unknown', companyId: 'c1', entityType: 'x', entityId: 'x' }), error => error.code === 'EVENT_TYPE_UNKNOWN');
});

test('le serveur persiste les événements métier depuis la transaction auditée', () => {
  const db = { auditEvents: [], domainEvents: [] }, auth = { requestId: 'request-1', user: { id: 'u1', companyId: 'c1' } };
  appendServerAudit(db, auth, 'client.created', 'client', 'cl1', { versionAfter: 1, email: 'non publié' });
  assert.equal(domainEventTypeForAudit('client.created'), 'ClientCreated');
  assert.equal(domainEventTypeForAudit('quote.statusChanged', { status: 'accepted' }), 'QuoteValidated');
  assert.equal(db.domainEvents.length, 1);
  assert.deepEqual(db.domainEvents[0].payload, { action: 'client.created', versionBefore: null, versionAfter: 1 });
  assert.equal(db.auditEvents[0].error_id, 'request-1');
});

test('l’audit canonique exclut récursivement les champs sensibles et conserve les preuves de mutation', () => {
  const log = [];
  const before = { label: 'avant', nested: { password: 'secret', value: 1 } };
  const after = { label: 'après', nested: { token: 'secret', value: 2 } };
  const entry = appendAudit(log, { companyId: 'c1', actorUserId: 'u1', action: 'quote.updated', entityType: 'quote', entityId: 'q1', errorId: 'e1', requestId: 'request-1', operationId: 'operation-1', origin: 'ui', versionBefore: 1, versionAfter: 2, before, after, details: { label: 'ok', token: 'secret' } });
  assert.deepEqual(entry.details, { label: 'ok' });
  assert.deepEqual(entry.before, { label: 'avant', nested: { value: 1 } });
  assert.deepEqual(entry.after, { label: 'après', nested: { value: 2 } });
  assert.deepEqual(sanitizedDetails([{ authorization: 'secret', safe: true }]), [{ safe: true }]);
  assert.equal(entry.error_id, 'e1');
  assert.equal(entry.operationId, 'operation-1');
  assert.equal(entry.origin, 'ui');
  assert.equal(Object.isFrozen(entry), true);
});

test('SchedulingEngine applique les intervalles semi-ouverts et la capacité', () => {
  assert.equal(overlaps({ startsAt: '2026-08-19T08:00:00+02:00', endsAt: '2026-08-19T10:00:00+02:00' }, { startsAt: '2026-08-19T10:00:00+02:00', endsAt: '2026-08-19T11:00:00+02:00' }), false);
  const engine = new SchedulingEngine();
  const result = engine.checkAvailability({ companyId: 'c1', siteId: 's1', startsAt: '2026-08-19T09:00:00+02:00', endsAt: '2026-08-19T18:00:00+02:00', allocations: [{ resourceId: 'r1', quantity: 1 }], resources: [{ id: 'r1', companyId: 'c1', siteId: 's1', capacity: 1, active: true }], reservations: [{ id: 'existing', companyId: 'c1', siteId: 's1', status: 'confirmed', startsAt: '2026-08-19T08:00:00+02:00', endsAt: '2026-08-19T12:00:00+02:00', allocations: [{ resourceId: 'r1', quantity: 1 }] }] });
  assert.equal(result.available, false);
  assert.equal(result.conflicts[0].used, 1);
});

test('SchedulingEngine fige les contrats quantité, week-end et changements d’heure', () => {
  const engine = new SchedulingEngine();
  assert.equal(engine.calculateBusinessDays({ startDate: '2026-08-17', endDate: '2026-08-21' }), 5);
  assert.equal(engine.calculateBusinessDays({ startDate: '2026-08-21', endDate: '2026-08-24' }), 2);
  assert.equal(engine.calculateBusinessDays({ startDate: '2026-08-21', endDate: '2026-08-24', includeWeekends: true }), 4);
  assert.equal(engine.calculateBusinessDays({ startDate: '2026-08-17', endDate: '2026-08-21', holidays: ['2026-08-19'] }), 4);
  assert.equal(engine.calculateQuantity({ unit: 'hour', startsAt: '2026-03-29T00:00:00+01:00', endsAt: '2026-03-29T04:00:00+02:00' }), 3);
  assert.equal(engine.calculateQuantity({ unit: 'hour', startsAt: '2026-10-25T00:00:00+02:00', endsAt: '2026-10-25T04:00:00+01:00' }), 5);
  assert.equal(engine.detectOverlap({ startsAt: '2026-08-19T08:00:00+02:00', endsAt: '2026-08-19T10:00:00+02:00' }, { startsAt: '2026-08-19T10:00:00+02:00', endsAt: '2026-08-19T12:00:00+02:00' }), false);
  assert.throws(() => engine.validateReservation({ companyId: 'c1', siteId: 's1', startsAt: '2026-08-19T08:00:00+02:00', endsAt: '2026-08-19T10:00:00+02:00', allocations: [{ resourceId: 'r1', quantity: 1 }], resources: [], reservations: [] }), error => error.code === 'PROJECT_REQUIRED');
});

test('PricingEngine respecte projet puis client puis catalogue', () => {
  const engine = new PricingEngine();
  const base = { sourceType: 'resource', sourceId: 'room1', unit: 'jour', taxDate: '2026-08-19', projectId: 'p1', clientId: 'cl1' };
  const rates = [
    { id: 'catalogue', scope: 'catalogue', sourceType: 'resource', sourceId: 'room1', unit: 'jour', saleUnitMinor: '10000', currency: 'EUR' },
    { id: 'client', scope: 'client', clientId: 'cl1', sourceType: 'resource', sourceId: 'room1', unit: 'jour', saleUnitMinor: '9000', currency: 'EUR' },
    { id: 'project', scope: 'project', projectId: 'p1', sourceType: 'resource', sourceId: 'room1', unit: 'jour', saleUnitMinor: '8000', currency: 'EUR' },
  ];
  assert.deepEqual(engine.resolve({ ...base, rates }), { status: 'resolved', rateId: 'project', rateVersion: 1, origin: 'project', unit: 'jour', baseSaleUnitMinor: '8000', discountBps: 0, unitPriceMinor: '8000', currency: 'EUR', resolvedAt: '2026-08-19' });
  assert.deepEqual(engine.resolve({ ...base, sourceId: 'unknown', rates }), { status: 'missing', origin: null, unit: 'jour', resolvedAt: '2026-08-19' });
});

test('QuoteConsumptionEngine distingue reste, consommation et dépassement sans muter le vendu', () => {
  const engine = new QuoteConsumptionEngine();
  assert.deepEqual(engine.summarize({ soldQuantityMilli: '5000', reservations: [{ status: 'confirmed', quantityMilli: '6000' }], actuals: [] }), { soldQuantityMilli: '5000', plannedQuantityMilli: '6000', actualQuantityMilli: '0', remainingQuantityMilli: '0', overageQuantityMilli: '1000', state: 'overage' });
  assert.deepEqual(engine.summarizePlanningLine({ baseSoldQuantityMilli: '5000', acceptedComplementQuantityMilli: '2000', plannedQuantityMilli: '6000' }), { baseSoldQuantityMilli: '5000', acceptedComplementQuantityMilli: '2000', soldQuantityMilli: '7000', plannedQuantityMilli: '6000', differenceQuantityMilli: '-1000', remainingQuantityMilli: '1000', overageQuantityMilli: '0', state: 'partiallyPlanned' });
  assert.equal(engine.summarizePlanningLine({ baseSoldQuantityMilli: '5000', plannedQuantityMilli: '0' }).state, 'unplanned');
  assert.equal(engine.summarizePlanningLine({ baseSoldQuantityMilli: '5000', plannedQuantityMilli: '5000' }).state, 'compliant');
  assert.equal(engine.summarizePlanningLine({ baseSoldQuantityMilli: '5000', plannedQuantityMilli: '6000' }).state, 'overPlanned');
  assert.deepEqual(engine.summarizePlanningLine({ planifiable: false, baseSoldQuantityMilli: '5000', plannedQuantityMilli: '6000' }), { baseSoldQuantityMilli: '5000', acceptedComplementQuantityMilli: '0', soldQuantityMilli: '5000', plannedQuantityMilli: '0', differenceQuantityMilli: '0', remainingQuantityMilli: '0', overageQuantityMilli: '0', state: 'nonApplicable' });
  assert.throws(() => engine.summarizePlanningLine({ baseSoldQuantityMilli: '-1', plannedQuantityMilli: '0' }), error => error.code === 'QUANTITY_INVALID');
});

test('le dataset Gate G0 contient 250 ressources et 10 000 réservations sur six mois', () => {
  const dataset = generatePerformanceDataset();
  assert.equal(dataset.resources.length, 250);
  assert.equal(dataset.reservations.length, 10_000);
  assert.equal(dataset.metadata.periodMonths, 6);
  assert.equal(new Set(dataset.resources.map(resource => resource.siteId)).size, 5);
});

test('le contrat OpenAPI V1 couvre enveloppes, pagination, idempotence et version', () => {
  const source = fs.readFileSync(require.resolve('../docs/api/openapi-v1.yaml'), 'utf8');
  for (const token of ['openapi: 3.1.0', 'LoginResponse:', "schema: { $ref: '#/components/schemas/LoginResponse' }", 'SuccessEnvelope:', 'ErrorEnvelope:', 'error_id:', 'Idempotency-Key', 'pageSize', 'version:', '/memberships:', '/clients:', '/projects:', '/sites:', '/service-offerings:', '/resources:', '/rate-cards:', '/rates:', '/quotes:', '/reservations:', '/dashboard/revenue:', '/dashboard/occupancy:', '/planning/conflicts/check:', '/audit:', '/domain-events:', '/technical-metrics:', 'ReservationPatch:', 'resources:', 'example:']) assert.ok(source.includes(token), `OpenAPI incomplet : ${token}`);
  assert.equal(source.includes('allocations:'), false, 'Le contrat HTTP RC1 ne doit plus annoncer le champ allocations du moteur interne');
});
