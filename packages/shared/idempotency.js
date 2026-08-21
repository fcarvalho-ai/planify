'use strict';

const crypto = require('node:crypto');
const { DomainError } = require('./errors');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function digestPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

function commandScope(input) {
  return [input.companyId, input.actorUserId, input.command, input.targetId, input.key].join(':');
}

function inspectCommand(records, input) {
  if (!input.key) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'La clé d’idempotence est requise.', { status: 400 });
  const scope = commandScope(input);
  const payloadDigest = digestPayload(input.payload);
  const prior = records.find(record => record.scope === scope);
  if (prior && prior.payloadDigest !== payloadDigest) throw new DomainError('IDEMPOTENCY_CONFLICT', 'Cette clé a déjà été utilisée avec un autre contenu.', { status: 409 });
  return prior ? { replay: true, result: structuredClone(prior.result) } : { replay: false, scope, payloadDigest };
}

function rememberCommand(records, marker, result) {
  if (marker.replay) return marker.result;
  records.push(Object.freeze({ scope: marker.scope, payloadDigest: marker.payloadDigest, result: structuredClone(result) }));
  return result;
}

module.exports = { digestPayload, inspectCommand, rememberCommand };
