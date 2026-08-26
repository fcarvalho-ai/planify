'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-articles-${process.pid}-${Date.now()}.json`);
const { createServer, resetData, makeSeed, readDb, rollbackArticleCatalogSageV1 } = require('../server.js');
let server, baseUrl, admin, planner, viewer, project, quote, article, operation = 0;

async function request(route, options = {}, auth) {
  const method = options.method || 'GET', headers = { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers };
  if (!['GET', 'HEAD'].includes(method) && route !== '/api/v1/auth/login' && !headers['Idempotency-Key']) headers['Idempotency-Key'] = `article-${++operation}`;
  if (auth?.cookie) headers.cookie = auth.cookie;
  if (auth?.csrf && !['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = auth.csrf;
  const response = await fetch(`${baseUrl}${route}`, { ...options, headers }), buffer = Buffer.from(await response.arrayBuffer()), text = buffer.toString('utf8'); let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = buffer; }
  return { response, data, buffer };
}
async function login(email) { const result = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'demo2026' }) }); assert.equal(result.response.status, 200); return { cookie: result.response.headers.get('set-cookie').split(';', 1)[0], csrf: result.data.csrfToken }; }

before(async () => {
  const seed = makeSeed(), company = seed.companies[0]; Object.assign(company, { registrationNumber: '184207833', establishmentNumber: '18420783300094', vatNumber: 'FR84184207833', taxCountry: 'FR', vatStatus: 'registered', fiscalValidatedAt: '2026-08-14T08:00:00.000Z', fiscalValidatedBy: 'user_admin', defaultVatRateId: 'vat_standard' }); seed.organizationAddresses = [{ id: 'address_registered', companyId: company.id, type: 'registeredOffice', line1: '10 rue Test', postalCode: '75011', city: 'Paris', country: 'FR', isPrimary: true, version: 1 }]; seed.vatRates = [{ id: 'vat_standard', companyId: company.id, code: 'STANDARD', label: 'Taux normal', rateBps: 2000, active: true, validFrom: '2020-01-01', version: 1 }];
  resetData(seed); server = createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); baseUrl = `http://127.0.0.1:${server.address().port}`; admin = await login('admin@northlight.fr'); planner = await login('planner@northlight.fr'); viewer = await login('viewer@northlight.fr');
});
after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); for (const file of fs.readdirSync(os.tmpdir()).filter(value => value.startsWith(path.basename(process.env.PLANIFY_DATA_FILE)))) fs.rmSync(path.join(os.tmpdir(), file), { recursive: true, force: true }); });

test('migration SAGE additive, déterministe et permissions dédiées', () => {
  const first = readDb(), second = readDb(), items = first.articleCatalogItems.filter(value => value.companyId === 'company_northlight');
  assert.equal(items.length, 71); assert.equal(new Set(items.map(value => value.analyticsCode)).size, 71); assert.equal(items.filter(value => value.sageCode === 'T TECH').length, 10); assert.equal(second.migrations.filter(value => value.id === 'article-catalog-sage-v1').length, 1); assert.equal(second.articleCatalogRevisions.length, 71); assert.ok(second.roles.find(value => value.code === 'organizationAdmin').permissions.includes('article.manage')); assert.ok(second.roles.find(value => value.code === 'PLANNER').permissions.includes('article.read'));
});

test('catalogue listable, création idempotente et mutations refusées aux non-administrateurs', async () => {
  let result = await request('/api/v1/article-catalog?pageSize=100', {}, planner); assert.equal(result.response.status, 200); assert.equal(result.data.total, 71); assert.ok(result.data.items.some(value => value.analyticsCode === 'TTECH-EXPORT'));
  result = await request('/api/v1/article-catalog', { method: 'POST', body: JSON.stringify({ sageCode: 'TEST SAGE', normalizedCode: 'TEST-SAGE', analyticsCode: 'TEST-ARTICLE', family: 'Postproduction', category1: 'Test', category2: 'Test', designation: 'Article de test' }) }, viewer); assert.equal(result.response.status, 403);
  const body = JSON.stringify({ sageCode: 'TEST SAGE', normalizedCode: 'TEST-SAGE', analyticsCode: 'TEST-ARTICLE', family: 'Postproduction', category1: 'Test', category2: 'Test', designation: 'Article de test' }), headers = { 'Idempotency-Key': 'article-create-test' };
  result = await request('/api/v1/article-catalog', { method: 'POST', headers, body }, admin); assert.equal(result.response.status, 201, JSON.stringify(result.data)); article = result.data;
  const replay = await request('/api/v1/article-catalog', { method: 'POST', headers, body }, admin); assert.equal(replay.response.status, 200); assert.equal(replay.data.id, article.id); assert.equal(readDb().articleCatalogItems.filter(value => value.analyticsCode === 'TEST-ARTICLE').length, 1);
  const duplicate = await request('/api/v1/article-catalog', { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), sageCode: 'AUTRE' }) }, admin); assert.equal(duplicate.response.status, 409); assert.equal(duplicate.data.error.code, 'ARTICLE_ANALYTICS_CODE_DUPLICATE');
  const invalidActive = await request('/api/v1/article-catalog', { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), analyticsCode: 'TEST-ACTIVE', active: 'false' }) }, admin); assert.equal(invalidActive.response.status, 422); assert.deepEqual(invalidActive.data.error.details.fields, ['active']);
  const forgedTenant = await request('/api/v1/article-catalog', { method: 'POST', body: JSON.stringify({ ...JSON.parse(body), analyticsCode: 'TEST-TENANT', companyId: 'company_eliote_props_prod' }) }, admin); assert.equal(forgedTenant.response.status, 400); assert.equal(forgedTenant.data.error.code, 'VALIDATION_ERROR');
  const forbidden = await request(`/api/v1/article-catalog/${article.id}`, { method: 'PATCH', body: JSON.stringify({ version: article.version, designation: 'Interdit', reason: 'Test refus' }) }, planner); assert.equal(forbidden.response.status, 403);
  const switched = await request('/api/v1/session/company-context', { method: 'POST', body: JSON.stringify({ companyId: 'company_eliote_props_prod' }) }, admin); assert.equal(switched.response.status, 200); admin.csrf = switched.data.csrfToken;
  const hidden = await request(`/api/v1/article-catalog/${article.id}`, {}, admin), empty = await request('/api/v1/article-catalog?pageSize=100', {}, admin); assert.equal(hidden.response.status, 404); assert.equal(empty.data.total, 0);
  const back = await request('/api/v1/session/company-context', { method: 'POST', body: JSON.stringify({ companyId: 'company_northlight' }) }, admin); assert.equal(back.response.status, 200); admin.csrf = back.data.csrfToken;
});

test('ligne de devis fige le snapshot article, versions et PDF', async () => {
  let result = await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Projet articles SAGE', code: 'ARTSAGE', clientId: 'client_1', siteId: 'site_paris', lifecycleStatus: 'prospect', salesOwnerId: 'user_planner', projectManagerId: 'user_planner', planningOwnerId: 'user_planner' }) }, planner); assert.equal(result.response.status, 201, JSON.stringify(result.data)); project = result.data;
  const catalog = await request('/api/v1/quote-catalog?pageSize=200', {}, admin), source = catalog.data.items.find(value => value.analyticsCode === '66-MONT'), longestSource = catalog.data.items.find(value => value.reference === '66-iIMPORT A'); assert.ok(source); assert.ok(longestSource); assert.equal(source.reference, '66-MONT');
  result = await request('/api/v1/quotes', { method: 'POST', headers: { 'Idempotency-Key': 'quote-article-snapshot' }, body: JSON.stringify({ projectId: project.id, siteId: 'site_paris', kind: 'quote', title: 'Devis articles SAGE', taxDate: '2026-08-26', lines: [{ category: 'technical', section: 'Montage', sourceType: 'article', sourceId: source.id, unit: 'jour', quantityMilli: '1000', unitPriceMinor: '100000', priceOverrideReason: 'Tarif démonstration' }, { category: 'technical', section: 'Import', sourceType: 'article', sourceId: longestSource.id, unit: 'forfait', quantityMilli: '1000', unitPriceMinor: '25000', priceOverrideReason: 'Tarif démonstration' }] }) }, admin); assert.equal(result.response.status, 201, JSON.stringify(result.data)); quote = result.data; const snapshot = structuredClone(quote.lines[0].articleSnapshot); assert.deepEqual([snapshot.sageCode, snapshot.normalizedCode, snapshot.analyticsCode, snapshot.designation, snapshot.version], ['66-MONT', '66-MONT', '66-MONT', 'Salle de montage image avec assistance technique', 1]);
  const updated = await request(`/api/v1/article-catalog/${source.id}`, { method: 'PATCH', body: JSON.stringify({ version: 1, designation: 'Salle de montage image premium', reason: 'Évolution du catalogue' }) }, admin); assert.equal(updated.response.status, 200); assert.equal(updated.data.version, 2);
  const reloaded = await request(`/api/v1/quotes/${quote.id}`, {}, admin); assert.deepEqual(reloaded.data.lines[0].articleSnapshot, snapshot); const versions = await request(`/api/v1/quotes/${quote.id}/versions?pageSize=20`, {}, admin), version = await request(`/api/v1/quotes/${quote.id}/versions/${versions.data.items[0].id}`, {}, admin); assert.deepEqual(version.data.snapshot.lines[0].articleSnapshot, snapshot);
  const revenue = await request('/api/v1/analytics/revenue-chain?dimensions=articleAnalyticsCode,sageArticleCode&articleAnalyticsCode=66-MONT', {}, admin); assert.equal(revenue.response.status, 200, JSON.stringify(revenue.data)); assert.ok(revenue.data.groups.some(group => group.dimensions.articleAnalyticsCode === '66-MONT' && group.dimensions.sageArticleCode === '66-MONT'));
  const pdf = await request(`/api/v1/quotes/${quote.id}/pdf`, {}, admin); assert.equal(pdf.response.status, 200); assert.match(pdf.buffer.toString('latin1'), /66-MONT/); assert.match(pdf.buffer.toString('latin1'), /66-iIMPORT A/);
});

test('contrats UI et OpenAPI exposent le catalogue et la référence du devis', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8'), openapi = fs.readFileSync(path.join(__dirname, '..', 'docs', 'api', 'openapi-v1.yaml'), 'utf8');
  assert.match(index, /data-route="articles"/); assert.match(app, /articleCatalogPage/); assert.match(app, /quote-article-ref/); assert.match(app, /articleSnapshot\?\.sageCode/); assert.match(styles, /\.article-catalog-table/);
  const articleUi = app.slice(app.indexOf('const articleCatalogModule=')); assert.match(articleUi, /apiAll\('\/api\/v1\/article-catalog'\)/); assert.match(articleUi, /requestedCompanyId=state\.user\.companyId/); assert.match(articleUi, /articleCatalogModule\.requestToken!==requestToken/); assert.match(articleUi, /startsWith\('articleCatalog\.'\)/); assert.match(articleUi, /route!=='articles'\)return renderArticleCatalogBase\(\);syncAuthenticatedSurfaces\(true\)/); assert.doesNotMatch(articleUi, /quoteWorkspacePage=quoteA4Workspace;/); assert.match(app, /const quoteWorkspaceFinanceBase=quoteWorkspacePage;[\s\S]*return can\('finance\.read'\)\?html:html\.replace/);
  for (const token of ['/article-catalog:', '/article-catalog/{articleId}:', '/article-catalog/{articleId}/revisions:', 'ArticleCatalogItem:', 'ArticleSnapshot:', 'ArticleQuoteLineSource:', 'sageArticleCode', 'articleAnalyticsCode']) assert.ok(openapi.includes(token), token);
  const snapshotSchema = openapi.slice(openapi.indexOf('    ArticleSnapshot:'), openapi.indexOf('    ArticleCatalogCreateCommand:')); assert.match(snapshotSchema, /required: \[[^\]]*normalizedCode/); assert.match(snapshotSchema, /articleSnapshot: \{ \$ref: '#\/components\/schemas\/ArticleSnapshot' \}/);
  const datasetPath = openapi.slice(openapi.indexOf('  /analytics/datasets/{dataset}:'), openapi.indexOf('  /analytics/dimensions:')); assert.match(datasetPath, /name: sageArticleCode/); assert.match(datasetPath, /name: articleAnalyticsCode/);
  const dimensionSchema = openapi.slice(openapi.indexOf('    AnalyticsDimensionName:'), openapi.indexOf('    RevenueStageName:')); assert.match(dimensionSchema, /sageArticleCode/); assert.match(dimensionSchema, /articleAnalyticsCode/); assert.match(openapi, /minItems: 11\s+maxItems: 11/);
});

test('révisions append-only, conflit optimiste et rollback restaurable', async () => {
  const revisions = await request(`/api/v1/article-catalog/${article.id}/revisions?pageSize=20`, {}, admin); assert.equal(revisions.response.status, 200); assert.equal(revisions.data.total, 1); const stale = await request(`/api/v1/article-catalog/${article.id}`, { method: 'PATCH', body: JSON.stringify({ version: 999, designation: 'Stale', reason: 'Conflit attendu' }) }, admin); assert.equal(stale.response.status, 409);
  assert.throws(() => rollbackArticleCatalogSageV1(), error => error?.code === 'ROLLBACK_EXPORT_REQUIRED');
  const marker = readDb().migrations.find(value => value.id === 'article-catalog-sage-v1'), backupPath = path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile), backupRaw = fs.readFileSync(backupPath, 'utf8'); fs.writeFileSync(backupPath, `${backupRaw}\n`); assert.throws(() => rollbackArticleCatalogSageV1({ exportFile: `${process.env.PLANIFY_DATA_FILE}.tampered-recovery.json` }), error => error?.code === 'MIGRATION_BACKUP_CONFLICT'); fs.writeFileSync(backupPath, backupRaw);
  const activeRaw = fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), exportFile = `${process.env.PLANIFY_DATA_FILE}.recovery.json`, rollback = rollbackArticleCatalogSageV1({ exportFile });
  assert.equal(fs.readFileSync(exportFile, 'utf8'), activeRaw); assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600); assert.match(rollback.restoredDigest, /^[a-f0-9]{64}$/);
  const raw = JSON.parse(fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8')); assert.equal((raw.migrations || []).some(value => value.id === 'article-catalog-sage-v1'), false); assert.equal(raw.articleCatalogItems?.length || 0, 0); assert.equal(readDb().articleCatalogItems.length, 71);
});
