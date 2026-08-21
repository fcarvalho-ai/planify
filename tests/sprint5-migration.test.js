'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint5-migration-${process.pid}-${Date.now()}.json`);

const { makeSeed, readDb, resetData, rollbackSprint5Personnel } = require('../server.js');

const digest = value => crypto.createHash('sha256').update(value).digest('hex');

test('Sprint 5 Personnel se restaure byte-exactement après un export privé obligatoire', () => {
  resetData(makeSeed());
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-5-personnel-v1');
  assert.ok(marker?.backupFile);
  const backupPath = path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile);
  const source = fs.readFileSync(backupPath);
  const exportFile = path.join(os.tmpdir(), `planify-sprint5-personnel-export-${process.pid}-${Date.now()}.json`);

  assert.throws(() => rollbackSprint5Personnel(), error => error.code === 'ROLLBACK_EXPORT_REQUIRED');
  const result = rollbackSprint5Personnel({ exportFile });
  const restored = fs.readFileSync(process.env.PLANIFY_DATA_FILE), exported = fs.readFileSync(exportFile);

  assert.equal(Buffer.compare(restored, source), 0);
  assert.equal(result.restoredDigest, digest(source));
  assert.equal(result.exportDigest, digest(exported));
  assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600);
  assert.equal(JSON.parse(restored).migrations.some(value => value.id === 'sprint-5-personnel-v1'), false);
});
