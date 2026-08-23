'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PLANIFY_DATA_FILE = path.join(os.tmpdir(), `planify-sprint7-migration-${process.pid}-${Date.now()}.json`);
const { makeSeed, resetData, readDb, rollbackSprint7Actuals } = require('../server.js');

test('migration Sprint 7 rejouable, falsification refusée et rollback byte-exact après export 0600', () => {
  resetData(makeSeed());
  const migrated = readDb(), marker = migrated.migrations.find(value => value.id === 'sprint-7-actuals-v1');
  assert.ok(marker); assert.equal(readDb().migrations.filter(value => value.id === marker.id).length, 1);
  const activeRaw = fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), backupPath = path.join(path.dirname(process.env.PLANIFY_DATA_FILE), marker.backupFile), backupRaw = fs.readFileSync(backupPath, 'utf8');
  const tampered = JSON.parse(activeRaw); tampered.migrations.find(value => value.id === marker.id).policyVersion = 'forged'; fs.writeFileSync(process.env.PLANIFY_DATA_FILE, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 });
  assert.throws(() => readDb(), error => error.code === 'MIGRATION_MARKER_CONFLICT');
  fs.writeFileSync(process.env.PLANIFY_DATA_FILE, activeRaw, { mode: 0o600 });
  const exportFile = `${process.env.PLANIFY_DATA_FILE}.recovery.json`, result = rollbackSprint7Actuals({ exportFile });
  assert.equal(fs.readFileSync(process.env.PLANIFY_DATA_FILE, 'utf8'), backupRaw); assert.equal(fs.readFileSync(exportFile, 'utf8'), activeRaw); assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600); assert.ok(result.restoredDigest); assert.ok(result.exportDigest);
  for (const name of fs.readdirSync(path.dirname(process.env.PLANIFY_DATA_FILE))) if (name.startsWith(path.basename(process.env.PLANIFY_DATA_FILE))) try { fs.unlinkSync(path.join(path.dirname(process.env.PLANIFY_DATA_FILE), name)); } catch {}
});
