'use strict';

const { DomainError } = require('../shared/errors');

function integer(value, field) {
  try { return BigInt(value); } catch { throw new DomainError('QUANTITY_INVALID', `${field} doit être un entier sérialisé.`); }
}

class QuoteConsumptionEngine {
  summarize(input) {
    const sold = integer(input.soldQuantityMilli, 'soldQuantityMilli');
    const planned = (input.reservations || []).filter(item => item.status !== 'cancelled').reduce((sum, item) => sum + integer(item.quantityMilli, 'quantityMilli'), 0n);
    const actual = (input.actuals || []).reduce((sum, item) => sum + integer(item.quantityMilli, 'quantityMilli'), 0n);
    const reference = actual > planned ? actual : planned;
    const difference = reference - sold;
    return {
      soldQuantityMilli: sold.toString(),
      plannedQuantityMilli: planned.toString(),
      actualQuantityMilli: actual.toString(),
      remainingQuantityMilli: (sold > reference ? sold - reference : 0n).toString(),
      overageQuantityMilli: (difference > 0n ? difference : 0n).toString(),
      state: difference > 0n ? 'overage' : reference === sold ? 'consumed' : 'remaining',
    };
  }

  summarizePlanningLine(input) {
    const baseSold = integer(input.baseSoldQuantityMilli, 'baseSoldQuantityMilli');
    const acceptedComplement = integer(input.acceptedComplementQuantityMilli || '0', 'acceptedComplementQuantityMilli');
    const planned = integer(input.plannedQuantityMilli || '0', 'plannedQuantityMilli');
    const sold = baseSold + acceptedComplement;
    if (baseSold < 0n || acceptedComplement < 0n || planned < 0n) throw new DomainError('QUANTITY_INVALID', 'Les quantités de continuité Devis/Planning doivent être positives.');
    if (input.planifiable === false) return {
      baseSoldQuantityMilli: baseSold.toString(), acceptedComplementQuantityMilli: acceptedComplement.toString(), soldQuantityMilli: sold.toString(), plannedQuantityMilli: '0', differenceQuantityMilli: '0', remainingQuantityMilli: '0', overageQuantityMilli: '0', state: 'nonApplicable',
    };
    const difference = planned - sold;
    return {
      baseSoldQuantityMilli: baseSold.toString(),
      acceptedComplementQuantityMilli: acceptedComplement.toString(),
      soldQuantityMilli: sold.toString(),
      plannedQuantityMilli: planned.toString(),
      differenceQuantityMilli: difference.toString(),
      remainingQuantityMilli: (difference < 0n ? -difference : 0n).toString(),
      overageQuantityMilli: (difference > 0n ? difference : 0n).toString(),
      state: planned === 0n ? 'unplanned' : difference < 0n ? 'partiallyPlanned' : difference === 0n ? 'compliant' : 'overPlanned',
    };
  }
}

module.exports = { QuoteConsumptionEngine };
