'use strict';

const crypto = require('node:crypto');

class DomainError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = options.status || 422;
    this.details = options.details;
    this.errorId = options.errorId || crypto.randomUUID();
  }
}

function errorEnvelope(error, errorId = error?.errorId || crypto.randomUUID()) {
  return {
    error: {
      code: error?.code || 'INTERNAL_ERROR',
      message: error?.code ? error.message : 'Erreur interne.',
      ...(error?.details ? { details: error.details } : {}),
      error_id: errorId,
    },
  };
}

function successEnvelope(data, meta = {}) {
  return { data, meta };
}

module.exports = { DomainError, errorEnvelope, successEnvelope };
