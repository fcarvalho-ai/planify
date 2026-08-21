'use strict';

const PRIORITY = Object.freeze({ project: 3, client: 2, catalog: 1, catalogue: 1 });

function roundHalfUp(numerator, denominator) { return (numerator + denominator / 2n) / denominator; }
function applicable(rate, input) { return rate.active !== false && rate.sourceType === input.sourceType && rate.sourceId === input.sourceId && rate.unit === input.unit && (!rate.validFrom || rate.validFrom <= input.taxDate) && (!rate.validTo || input.taxDate < rate.validTo) && (!['project'].includes(rate.scope) || rate.projectId === input.projectId) && (!['client'].includes(rate.scope) || rate.clientId === input.clientId); }

class PricingEngine {
  resolve(input) {
    const matching = (input.rates || []).filter(rate => applicable(rate, input)).sort((left, right) => (PRIORITY[right.scope] || 0) - (PRIORITY[left.scope] || 0) || String(right.validFrom || '').localeCompare(String(left.validFrom || '')) || String(left.id).localeCompare(String(right.id)));
    const resolved = matching[0];
    if (!resolved) return { status: 'missing', origin: null, unit: input.unit, resolvedAt: input.taxDate };
    const discountBps = Number(resolved.discountBps || 0), base = BigInt(resolved.saleUnitMinor), unitPriceMinor = String(roundHalfUp(base * BigInt(10000 - discountBps), 10000n));
    return { status: 'resolved', rateId: resolved.id, rateVersion: resolved.version || 1, origin: resolved.scope === 'catalogue' ? 'catalog' : resolved.scope, unit: input.unit, baseSaleUnitMinor: String(base), discountBps, unitPriceMinor, currency: resolved.currency, resolvedAt: input.taxDate };
  }
}

module.exports = { PricingEngine, PRIORITY, applicable };
