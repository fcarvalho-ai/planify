'use strict';

const crypto = require('node:crypto');
const { DomainError } = require('../shared/errors');

const SENSITIVE_KEYS = /password|cookie|token|secret|authorization|contentBase64|taxIdentifiers/i;

function sanitizedDetails(details) {
  if (Array.isArray(details)) return details.map(sanitizedDetails);
  if (!details || typeof details !== 'object') return details;
  return Object.fromEntries(Object.entries(details).filter(([key]) => !SENSITIVE_KEYS.test(key)).map(([key, value]) => [key, sanitizedDetails(value)]));
}

function appendAudit(log, input, clock = () => new Date().toISOString()) {
  if (!Array.isArray(log)) throw new DomainError('AUDIT_LOG_INVALID', 'Le journal d’audit est invalide.');
  if (!input.companyId || !input.action || !input.entityType || !input.entityId) throw new DomainError('AUDIT_SCOPE_REQUIRED', 'La portée de l’audit est requise.');
  const auditId = input.auditId || crypto.randomUUID();
  const entry = Object.freeze({
    id: auditId,
    auditId,
    companyId: input.companyId,
    actorUserId: input.actorUserId || null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    occurredAt: clock(),
    error_id: input.errorId || crypto.randomUUID(),
    requestId: input.requestId || input.errorId || null,
    operationId: input.operationId || null,
    origin: input.origin || 'server',
    versionBefore: input.versionBefore ?? null,
    versionAfter: input.versionAfter ?? null,
    before: structuredClone(sanitizedDetails(input.before ?? null)),
    after: structuredClone(sanitizedDetails(input.after ?? null)),
    details: structuredClone(sanitizedDetails(input.details)),
  });
  log.push(entry);
  return entry;
}

module.exports = { appendAudit, sanitizedDetails };
