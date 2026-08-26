'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataFile = path.join(os.tmpdir(), `planify-article-benchmark-${process.pid}-${Date.now()}.json`);
process.env.PLANIFY_DATA_FILE = dataFile;
const { createServer, makeSeed, resetData } = require('../server');

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

async function main() {
  const seed = makeSeed(), timestamp = '2026-08-26T00:00:00.000Z';
  seed.articleCatalogItems = Array.from({ length: 10_000 }, (_, index) => ({
    id: `article_benchmark_${index}`,
    companyId: 'company_northlight',
    sageCode: `BENCH-${index % 2500}`,
    normalizedCode: `BENCH-${index}`,
    analyticsCode: `BENCH-${index}`,
    family: 'Benchmark',
    category1: `Catégorie ${index % 20}`,
    category2: `Sous-catégorie ${index % 100}`,
    designation: `Prestation benchmark ${index}`,
    sourceDesignation: '',
    active: true,
    version: 1,
    createdBy: 'benchmark',
    updatedBy: 'benchmark',
    createdAt: timestamp,
    updatedAt: timestamp
  }));
  resetData(seed);
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@northlight.fr', password: 'demo2026' }) });
    const auth = await login.json(), cookie = login.headers.get('set-cookie').split(';', 1)[0], headers = { cookie };
    const reads = [];
    for (let index = 0; index < 50; index++) {
      const started = performance.now(), response = await fetch(`${baseUrl}/api/v1/article-catalog?q=benchmark&pageSize=100`, { headers });
      if (!response.ok || (await response.json()).total !== 10_000) throw new Error(`Lecture benchmark invalide (${response.status}).`);
      reads.push(performance.now() - started);
    }
    const writes = []; let version = 1;
    for (let index = 0; index < 20; index++) {
      const started = performance.now(), response = await fetch(`${baseUrl}/api/v1/article-catalog/article_benchmark_0`, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json', 'x-csrf-token': auth.csrfToken, 'idempotency-key': `benchmark-article-${index}` }, body: JSON.stringify({ version, designation: `Prestation benchmark version ${index + 2}`, reason: 'Mesure de performance versionnée' }) });
      const body = await response.json(); if (!response.ok) throw new Error(`Écriture benchmark invalide (${response.status} ${JSON.stringify(body)}).`); version = body.version;
      writes.push(performance.now() - started);
    }
    process.stdout.write(`${JSON.stringify({ node: process.version, articleCount: 10_071, readSamples: reads.length, readP95Ms: Number(percentile(reads, 0.95).toFixed(2)), writeSamples: writes.length, writeP95Ms: Number(percentile(writes, 0.95).toFixed(2)) })}\n`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const file of fs.readdirSync(path.dirname(dataFile)).filter(value => value.startsWith(path.basename(dataFile)))) fs.rmSync(path.join(path.dirname(dataFile), file), { force: true });
  }
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
