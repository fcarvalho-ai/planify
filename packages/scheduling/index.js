'use strict';

const { DomainError } = require('../shared/errors');

function instant(value, field) {
  if (Number.isFinite(value)) return Number(value);
  const milliseconds = Date.parse(value);
  if (!value || Number.isNaN(milliseconds) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new DomainError('TIME_INSTANT_INVALID', `${field} doit être un instant ISO 8601 avec offset.`, { details: { field } });
  return milliseconds;
}

function interval(input) {
  const startsAt = instant(input.startsAt, 'startsAt');
  const endsAt = instant(input.endsAt, 'endsAt');
  if (startsAt >= endsAt) throw new DomainError('TIME_INTERVAL_INVALID', 'La fin doit être postérieure au début.');
  return { startsAt, endsAt };
}

function overlaps(left, right) {
  const a = interval(left);
  const b = interval(right);
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

function calendarDate(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) throw new DomainError('TIME_DATE_INVALID', `${field} doit être une date civile ISO 8601.`);
  return value;
}

function calculateBusinessDays({ startDate, endDate, includeWeekends = false, holidays = [] }) {
  const start = calendarDate(startDate, 'startDate');
  const end = calendarDate(endDate, 'endDate');
  const cursor = new Date(`${start}T12:00:00Z`), limit = new Date(`${end}T12:00:00Z`);
  if (cursor > limit) throw new DomainError('TIME_INTERVAL_INVALID', 'La date de fin doit être postérieure ou égale à la date de début.');
  const excluded = new Set(holidays.map(value => calendarDate(value, 'holidays')));
  let quantity = 0;
  while (cursor <= limit) {
    const date = cursor.toISOString().slice(0, 10), day = cursor.getUTCDay();
    if ((includeWeekends || (day !== 0 && day !== 6)) && !excluded.has(date)) quantity++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return quantity;
}

class SchedulingEngine {
  validateDateRange(input) {
    return interval(input);
  }

  calculateBusinessDays(input) {
    return calculateBusinessDays(input);
  }

  calculateQuantity(input) {
    const unit = input.unit || 'day';
    if (unit === 'hour') {
      const value = interval(input);
      return (value.endsAt - value.startsAt) / 3_600_000;
    }
    if (unit === 'halfDay') return calculateBusinessDays(input) * 2;
    if (unit === 'day') return calculateBusinessDays(input);
    if (unit === 'week') return calculateBusinessDays(input) / (input.includeWeekends ? 7 : 5);
    throw new DomainError('UNIT_NOT_SUPPORTED', 'Cette unité de calcul n’est pas prise en charge.', { details: { unit } });
  }

  detectOverlap(left, right) {
    return overlaps(left, right);
  }

  checkAvailability(command) {
    const candidate = interval(command);
    const requested = new Map((command.allocations || []).map(allocation => [allocation.resourceId, Number(allocation.quantity)]));
    if (!requested.size || [...requested.values()].some(quantity => !Number.isFinite(quantity) || quantity <= 0)) throw new DomainError('ALLOCATION_INVALID', 'Une allocation positive est requise.');
    const resources = new Map((command.resources || []).map(resource => [resource.id, resource]));
    const conflicts = [];
    for (const [resourceId, quantity] of requested) {
      const resource = resources.get(resourceId);
      if (!resource || resource.companyId !== command.companyId || resource.siteId !== command.siteId || resource.active === false) throw new DomainError('RESOURCE_NOT_AVAILABLE', 'La ressource est introuvable ou hors périmètre.', { status: 404 });
      const concurrent = (command.reservations || [])
        .filter(reservation => reservation.status !== 'cancelled' && reservation.companyId === command.companyId && reservation.siteId === command.siteId && reservation.id !== command.reservationId && overlaps(candidate, reservation))
        .flatMap(reservation => (reservation.allocations || []).filter(allocation => allocation.resourceId === resourceId).map(allocation => ({ reservationId: reservation.id, quantity: Number(allocation.quantity) })));
      const used = concurrent.reduce((sum, allocation) => sum + allocation.quantity, 0);
      if (used + quantity > Number(resource.capacity)) conflicts.push({ resourceId, capacity: Number(resource.capacity), used, requested: quantity, reservationIds: concurrent.map(item => item.reservationId) });
    }
    return { available: conflicts.length === 0, conflicts };
  }

  checkCapacity(command) {
    return this.checkAvailability(command);
  }

  validateReservation(command) {
    interval(command);
    if (!command.projectId) throw new DomainError('PROJECT_REQUIRED', 'Une réservation doit être rattachée à un projet.');
    return this.checkAvailability(command);
  }
}

module.exports = { SchedulingEngine, interval, overlaps, calculateBusinessDays };
