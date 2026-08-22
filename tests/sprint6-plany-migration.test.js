'use strict';

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataFile = path.join(os.tmpdir(), `planify-sprint6-migration-${process.pid}-${Date.now()}.json`);
const exportFile = `${dataFile}.rollback-export.json`;
process.env.PLANIFY_DATA_FILE = dataFile;
const { makeSeed, resetData, readDb, rollbackSprint6PlanyBot } = require('../server.js');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const createdFiles = new Set([dataFile, exportFile]);

after(() => { for (const file of createdFiles) try { fs.unlinkSync(file); } catch {} });

test('migration PlanyBot additive : sauvegarde privée, marqueur intègre et rollback byte-exact', () => {
  resetData(makeSeed());
  const db = readDb(), marker = db.migrations.find(value => value.id === 'sprint-6-planybot-proposals-v1');
  assert.ok(marker); assert.deepEqual(marker.collections, ['planyProposals', 'planyProposalCommands']); assert.ok(Array.isArray(db.planyProposals)); assert.ok(Array.isArray(db.planyProposalCommands));
  const backupFile = path.join(path.dirname(dataFile), marker.backupFile); createdFiles.add(backupFile);
  assert.equal(fs.statSync(backupFile).mode & 0o777, 0o600); assert.equal(digest(fs.readFileSync(backupFile)), marker.sourceDigest);
  const currentRaw = fs.readFileSync(dataFile, 'utf8'), sourceRaw = fs.readFileSync(backupFile, 'utf8'), result = rollbackSprint6PlanyBot({ exportFile });
  assert.equal(result.exportDigest, digest(currentRaw)); assert.equal(result.restoredDigest, digest(sourceRaw)); assert.equal(fs.readFileSync(dataFile, 'utf8'), sourceRaw); assert.equal(fs.statSync(exportFile).mode & 0o777, 0o600);
});
