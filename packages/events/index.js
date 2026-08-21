'use strict';

const crypto = require('node:crypto');
const { DomainError } = require('../shared/errors');

const EVENT_TYPES = Object.freeze([
  'ClientCreated',
  'ProjectCreated',
  'QuoteCreated',
  'QuoteValidated',
  'ReservationCreated',
  'ReservationUpdated',
  'ReservationDeleted',
  'ResourceConflictDetected',
  'ActualConfirmed',
  'OverageDetected',
  'SupplementaryQuoteCreated',
]);

function appendEvent(journal, input, clock = () => new Date().toISOString()) {
  if (!Array.isArray(journal)) throw new DomainError('EVENT_JOURNAL_INVALID', 'Le journal d’événements est invalide.');
  if (!EVENT_TYPES.includes(input.type)) throw new DomainError('EVENT_TYPE_UNKNOWN', 'Le type d’événement est inconnu.', { details: { type: input.type } });
  if (!input.companyId || !input.entityType || !input.entityId) throw new DomainError('EVENT_SCOPE_REQUIRED', 'La portée de l’événement est requise.');
  const lastSequence = journal.reduce((maximum, event) => Math.max(maximum, Number(event.sequence) || 0), 0);
  const event = Object.freeze({
    eventId: input.eventId || crypto.randomUUID(),
    sequence: lastSequence + 1,
    type: input.type,
    version: 1,
    occurredAt: clock(),
    companyId: input.companyId,
    actorUserId: input.actorUserId || null,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: structuredClone(input.payload || {}),
  });
  journal.push(event);
  return event;
}

function replayEvents(journal, options = {}) {
  const afterSequence = Number(options.afterSequence || 0);
  const limit = Math.min(Math.max(Number(options.limit || 100), 1), 1000);
  return journal
    .filter(event => event.companyId === options.companyId && event.sequence > afterSequence)
    .sort((left, right) => left.sequence - right.sequence)
    .slice(0, limit)
    .map(event => structuredClone(event));
}

module.exports = { EVENT_TYPES, appendEvent, replayEvents };
