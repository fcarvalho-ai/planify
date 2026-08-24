const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  bookingDates,
  bookingRenderedCells,
  bookingCellState,
  bookingIssues,
  overlaps,
  postProductionKind,
  fromApiReservation,
  toApiReservation,
  planningDatesFor,
  planningCreationRange,
  planningMovedPeriod,
  planningResizedPeriod,
  planningTimelineSlots,
  planningCellInterval,
  planningShiftedInstants,
  planningZonedCandidates,
  planningZonedIso,
  planningLocalParts,
  francePublicHolidayLabel,
  snapPlanningTime,
  planningVirtualSlice,
  planningVirtualWindowNeedsRender,
  planningColumnSlice,
  planningColumnWidth,
  planningMaxCellStack,
  planningCellEntriesBySlot,
  planningRowHeight,
} = require('../app.js');
const { eliotePostProductionResources, migrateEliotePostProductionResources } = require('../server.js');

const room = { id: 'room_edit_01', name: 'Salle de montage 01', type: 'room', siteId: 'site_paris', capacity: 4 };
const period = {
  id: 'booking_period',
  title: 'Émission Horizon',
  projectId: 'project_horizon',
  resourceId: room.id,
  allocations: [{ resourceId: room.id, quantity: 1 }],
  date: '2026-08-17',
  endDate: '2026-08-23',
  start: '09:00',
  end: '18:00',
  status: 'confirmed',
  people: 1,
  version: 1,
};

test('les quatre vues temporelles conservent la date de référence dans une plage civile déterministe', () => {
  assert.deepEqual(planningDatesFor('day', '2026-08-19'), ['2026-08-19']);
  const week = planningDatesFor('week', '2026-08-19');
  assert.equal(week.length, 21);
  assert.equal(week[0], '2026-08-10');
  assert.equal(week[9], '2026-08-19');
  assert.equal(week.at(-1), '2026-08-30');
  const month = planningDatesFor('month', '2026-08-19');
  assert.equal(month.length, 92);
  assert.equal(month[0], '2026-07-01');
  assert.equal(month.at(-1), '2026-09-30');
  assert.ok(month.includes('2026-08-19'));
  const quarter = planningDatesFor('quarter', '2026-08-19');
  assert.equal(quarter.length, 92);
  assert.equal(quarter[0], '2026-07-01');
  assert.equal(quarter.at(-1), '2026-09-30');
  assert.ok(quarter.includes('2026-08-19'));
});

test('les vues Jour, Semaine, Mois et 3 mois restent disponibles hors plein écran', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /views=\['day','week','month','quarter'\]/);
  assert.doesNotMatch(source, /sixWeeks|6 semaines/);
  assert.match(source, /quarter:'3 mois'/);
  assert.match(source, /view==='quarter'\?3:1/);
  assert.match(css, /view-quarter/);
});

test('le plein écran partage les mêmes largeurs entre CSS et virtualisation horizontale', () => {
  assert.equal(planningColumnWidth('month', 'day', true), 52);
  assert.equal(planningColumnWidth('quarter', 'day', true), 38);
  assert.equal(planningColumnWidth('month', 'day', false), 104);
  assert.equal(planningColumnWidth('quarter', 'day', false), 76);
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.equal((css.match(/minmax\(var\(--planning-day-width\),1fr\)/g)||[]).length, 2);
  assert.match(source,/matrixTrack\.style\.width=`\$\{Number\(matrixShell\.dataset\.totalColumns\)\*Number\(matrixShell\.dataset\.columnWidth\)\}px`/);
  assert.match(css,/\.planning-matrix-shell \.postprod-matrix\.is-virtualized\{box-sizing:border-box\}/);
  const quarterWidth=planningColumnWidth('quarter','day',true),quarter=planningVirtualSlice(92,99999,2239,quarterWidth,5);
  assert.equal(quarter.end,92);
  assert.equal(quarter.before+quarter.count*quarterWidth+quarter.after,92*quarterWidth);
});

test('les vues longues gardent toutes leurs colonnes montées pendant le scroll horizontal', () => {
  const complete=planningColumnSlice(92,1800,1200,38,true);
  assert.deepEqual(complete,{start:0,end:92,before:0,after:0,count:92,total:92});
  const virtual=planningColumnSlice(288,1800,1200,38,false);
  assert.ok(virtual.start>0);
  assert.ok(virtual.end<288);
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(source,/planningColumnSlice\(slots\.length,planningVirtualState\.scrollLeft,planningVirtualState\.viewportWidth,columnWidth,compactView\)/);
});

test('le ghost de création normalise une sélection souris dans les deux directions', () => {
  assert.deepEqual(planningCreationRange('2026-08-17', '2026-08-20'), [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
  ]);
  assert.deepEqual(planningCreationRange('2026-08-20', '2026-08-17'), [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
  ]);
});

test('une salle à définir conserve son contrat sans créer de cellule fantôme', () => {
  const mapped = fromApiReservation({
    id: 'reservation_generic_ui', version: 1, title: 'Montage à affecter', projectId: 'project_horizon',
    siteId: 'site_paris', startsAt: '2026-08-17T07:00:00.000Z', endsAt: '2026-08-17T16:00:00.000Z',
    status: 'option', optionGroupId: 'LES50-MONTAGE', optionPriority: 2,
    optionExpiresAt: '2026-08-10T12:00:00.000Z',
    resources: [{ generic: true, resourceCategoryId: 'category_montage', genericAllocationId: 'generic_1', quantity: 2 }],
  });
  assert.deepEqual(mapped.allocations, [{ generic: true, resourceCategoryId: 'category_montage', genericAllocationId: 'generic_1', quantity: 2 }]);
  assert.equal(mapped.optionGroupId, 'LES50-MONTAGE');
  assert.equal(mapped.optionPriority, 2);
  assert.deepEqual(bookingRenderedCells(mapped), []);
});

test('l’interface S5-B distingue salle précise, salle à définir et double option', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(shell, /value="generic">Salle à définir/);
  assert.match(shell, /id="bookingOptionFields"/);
  assert.match(source, /generic-assignments/);
  assert.match(source, /bookingGenericQueue/);
  assert.match(source, /Option perdue/);
  assert.match(css, /\.planning-unassigned/);
  assert.match(css, /\.option-decision\.won/);
});

test('le clic-glisser affiche un ghost puis ouvre seulement le formulaire prérempli', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /cell\.onpointerdown=/);
  assert.match(source, /cell\.onpointerenter=/);
  assert.match(source, /document\.addEventListener\('pointerup',finishPlanningCreationDrag\)/);
  assert.match(source, /if\(!drag\.moved\)return/);
  assert.match(source, /openBooking\('',\{date:startDate,endDate,resourceId:drag\.resourceId/);
  assert.match(source, /startSlotIndex:Number\(cell\.dataset\.slotIndex\)/);
  assert.match(source, /endDate:defaults\.endDate\|\|defaults\.date\|\|anchor/);
  assert.doesNotMatch(source, /finishPlanningCreationDrag[\s\S]{0,500}api\(/);
  assert.match(css, /\.planning-cell\.is-create-ghost/);
  assert.match(css, /content:attr\(data-create-ghost-label\)/);
});

test('déplacement et redimensionnement calculent des périodes civiles déterministes', () => {
  assert.deepEqual(planningMovedPeriod('2026-08-17', '2026-08-23', '2026-09-02'), {
    date: '2026-09-02', endDate: '2026-09-08',
  });
  assert.deepEqual(planningResizedPeriod('2026-08-17', '2026-08-23', 'start', '2026-08-15'), {
    date: '2026-08-15', endDate: '2026-08-23',
  });
  assert.deepEqual(planningResizedPeriod('2026-08-17', '2026-08-23', 'end', '2026-08-28'), {
    date: '2026-08-17', endDate: '2026-08-28',
  });
  assert.equal(planningResizedPeriod('2026-08-17', '2026-08-23', 'start', '2026-08-24'), null);
});

test('les gestes planning montrent un ghost et restaurent le snapshot sur refus API', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /showPlanningOperationGhost\(cell\)/);
  assert.match(source, /planningOperationDrag=\{type:'resize'/);
  assert.match(source, /state\.bookings\[index\]=snapshot;render\(\);toast\(`Redimensionnement annulé/);
  assert.match(source, /state\.bookings\[index\]=snapshot;render\(\);toast\(`Déplacement annulé/);
  assert.match(source, /seule cette cellule passe/);
  assert.match(css, /\.planning-cell\.is-operation-ghost/);
  assert.match(css, /data-operation-ghost-label/);
});

test('le calendrier français et le snapping sont reproductibles', () => {
  assert.equal(francePublicHolidayLabel('2026-07-14'), 'Fête nationale');
  assert.equal(francePublicHolidayLabel('2026-04-06'), 'Lundi de Pâques');
  assert.equal(francePublicHolidayLabel('2026-08-18'), '');
  assert.equal(snapPlanningTime('10:17', 'hour', 'start'), '10:30');
  assert.equal(snapPlanningTime('10:30', 'halfDay', 'start'), '09:00');
  assert.equal(snapPlanningTime('16:10', 'halfDay', 'end'), '18:00');
  assert.equal(snapPlanningTime('14:25', 'day', 'start'), '09:00');
  assert.equal(snapPlanningTime('14:25', 'day', 'end'), '18:00');
});

test('la vue Jour produit une vraie grille horaire ou demi-journée', () => {
  const hourly = planningTimelineSlots('day', 'hour', ['2026-08-19']);
  assert.equal(hourly.length, 48);
  assert.deepEqual({ date: hourly[0].date, time: hourly[0].time, endTime: hourly[0].endTime, startMinutes: hourly[0].startMinutes, endMinutes: hourly[0].endMinutes, label: hourly[0].label }, { date: '2026-08-19', time: '00:00', endTime: '00:30', startMinutes: 0, endMinutes: 30, label: '00:00' });
  assert.equal(hourly[18].time, '09:00');
  assert.equal(hourly.at(-1).endTime, '24:00');
  const halfDays = planningTimelineSlots('day', 'halfDay', ['2026-08-19']);
  assert.deepEqual(halfDays.map(slot => slot.label), ['09:00–13:00', '13:00–18:00']);
  assert.equal(planningTimelineSlots('week', 'hour', ['2026-08-17', '2026-08-18']).length, 2);
});

test('le planning expose déplacement et redimensionnement au clavier', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /data-planning-time/);
  assert.match(source, /data-slot-index/);
  assert.match(source, /aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift\+ArrowLeft Shift\+ArrowRight"/);
  assert.match(source, /movePlanningCellByRoom/);
  assert.match(source, /changePlanningBookingTime/);
  assert.match(source, /handle\.setAttribute\('aria-keyshortcuts','ArrowLeft ArrowRight'\)/);
  assert.match(source, /restorePlanningKeyboardFocus/);
  assert.match(source, /planningKeyboardFocusIntent=\{bookingId,edge,cellDate,expiresAt:Date\.now\(\)\+2500\}/);
  assert.match(source, /applyPlanningKeyboardFocus\(\)/);
  assert.match(source, /active!==document\.body/);
  assert.match(source, /target\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(source, /moved\.date!==anchor/);
  assert.match(source, /focusDate=edge==='start'\?resized\?\.date:resized\?\.endDate/);
  assert.match(source, /focusDate&&focusDate!==anchor/);
  assert.match(source, /document\.querySelector\('\.planning-matrix-scroll'\)/);
  assert.match(source, /class="planning-matrix-scroll" tabindex="0" role="region"/);
  assert.match(css, /\.planning-event\[tabindex="0"\]:focus-visible/);
});

test('les heures Planning suivent le fuseau IANA été comme hiver', () => {
  assert.equal(planningZonedIso('2026-08-17', '09:00', 'site_paris'), '2026-08-17T07:00:00.000Z');
  assert.equal(planningZonedIso('2026-12-17', '09:00', 'site_paris'), '2026-12-17T08:00:00.000Z');
  assert.deepEqual(planningLocalParts('2026-12-17T08:00:00.000Z', 'site_paris'), { date: '2026-12-17', time: '09:00' });
});

test('la grille Jour représente exactement les transitions DST Europe/Paris', () => {
  const spring = planningTimelineSlots('day', 'hour', ['2026-03-29']);
  assert.equal(spring.length, 46, 'le passage à l’heure d’été retire deux demi-heures inexistantes');
  assert.equal(spring.some(slot => slot.time === '02:00' || slot.time === '02:30'), false);
  assert.throws(() => planningZonedIso('2026-03-29', '02:00', 'site_paris'), /n’existe pas/);
  const autumn = planningTimelineSlots('day', 'hour', ['2026-10-25']);
  assert.equal(autumn.length, 50, 'le passage à l’heure d’hiver répète deux demi-heures');
  assert.deepEqual(autumn.filter(slot => slot.time === '02:00').map(slot => slot.label), ['02:00 (1/2)', '02:00 (2/2)']);
  const candidates = planningZonedCandidates('2026-10-25', '02:30', 'site_paris');
  assert.equal(candidates.length, 2);
  assert.notEqual(planningZonedIso('2026-10-25', '02:30', 'site_paris', 'earlier'), planningZonedIso('2026-10-25', '02:30', 'site_paris', 'later'));
});

test('une réservation quotidienne multi-jours reste bornée à la cellule horaire courante', () => {
  const booking = {
    ...period,
    planningMode: 'dailyCells',
    siteId: 'Europe/Paris',
    startsAt: '2026-08-17T07:00:00.000Z',
    endsAt: '2026-08-23T16:00:00.000Z',
  };
  const first = planningCellInterval(booking, { date: '2026-08-17' });
  const middle = planningCellInterval(booking, { date: '2026-08-19' });
  assert.equal((first.endMs - first.startMs) / 3600000, 9);
  assert.equal((middle.endMs - middle.startMs) / 3600000, 9);
});

test('les flèches horaires avancent par instants réels aux deux bascules DST', () => {
  const spring = planningShiftedInstants({ siteId: 'Europe/Paris', startsAt: '2026-03-29T00:30:00.000Z', endsAt: '2026-03-29T01:30:00.000Z' }, 'both', 30);
  assert.deepEqual(spring.start, { date: '2026-03-29', time: '03:00' });
  assert.deepEqual(spring.end, { date: '2026-03-29', time: '04:00' });
  const firstFall = planningShiftedInstants({ siteId: 'Europe/Paris', startsAt: '2026-10-25T00:30:00.000Z', endsAt: '2026-10-25T01:30:00.000Z' }, 'both', 30);
  assert.deepEqual(firstFall.start, { date: '2026-10-25', time: '02:00' });
  assert.equal(firstFall.startMs, Date.parse('2026-10-25T01:00:00.000Z'));
  const secondFallBack = planningShiftedInstants({ siteId: 'Europe/Paris', startsAt: '2026-10-25T01:30:00.000Z', endsAt: '2026-10-25T02:30:00.000Z' }, 'both', -30);
  assert.deepEqual(secondFallBack.start, { date: '2026-10-25', time: '02:00' });
  assert.equal(secondFallBack.startMs, Date.parse('2026-10-25T01:00:00.000Z'));
});

test('S3-D expose week-ends, jours fériés et granularité sans dépendance distante', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /data-planning-weekends/);
  assert.match(source, /data-planning-granularity/);
  assert.match(source, /planningShowWeekends\?dates:dates\.filter/);
  assert.match(source, /jour férié/);
  assert.match(css, /\.matrix-day\.is-holiday/);
  assert.match(css, /\.planning-cell\.is-holiday/);
});

test('une réservation hebdomadaire produit une cellule par jour civil', () => {
  assert.deepEqual(bookingDates(period), [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
    '2026-08-21', '2026-08-22', '2026-08-23',
  ]);
  assert.equal(bookingCellState(period, '2026-08-17'), 'start');
  assert.equal(bookingCellState(period, '2026-08-20'), 'middle');
  assert.equal(bookingCellState(period, '2026-08-23'), 'end');
});

test('une réservation sans week-end ne compte ni samedi ni dimanche', () => {
  const weekdaysOnly = { ...period, includeWeekends: false };
  assert.deepEqual(bookingDates(weekdaysOnly), [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21',
  ]);
  assert.equal(bookingRenderedCells(weekdaysOnly).length, 5);
});

test('une exception déplace uniquement sa cellule source', () => {
  const moved = {
    ...period,
    planningMode: 'dailyCells',
    cellOverrides: [{
      sourceDate: '2026-08-19',
      sourceResourceId: room.id,
      targetDate: '2026-08-20',
      targetResourceId: 'room_mix_02',
    }],
  };
  const cells = bookingRenderedCells(moved);
  assert.equal(cells.length, 7);
  assert.deepEqual(cells.find(cell => cell.sourceDate === '2026-08-19'), {
    sourceDate: '2026-08-19', sourceResourceId: room.id,
    date: '2026-08-20', resourceId: 'room_mix_02', quantity: 1, moved: true,
  });
  assert.equal(cells.find(cell => cell.sourceDate === '2026-08-18').date, '2026-08-18');
  assert.equal(cells.find(cell => cell.sourceDate === '2026-08-20').resourceId, room.id);
});

test('la période complète est conservée dans le DTO API aller-retour', () => {
  const dto = toApiReservation(period);
  assert.equal(dto.startsAt, '2026-08-17T07:00:00.000Z');
  assert.equal(dto.endsAt, '2026-08-23T16:00:00.000Z');
  assert.equal('timeGranularity' in dto, false, 'une réservation historique ne doit pas adopter implicitement la politique Sprint 3');
  assert.equal('snapMinutes' in dto, false);
  assert.equal(dto.planningMode, 'dailyCells');
  const mapped = fromApiReservation({ ...dto, id: period.id, version: 2 });
  assert.equal(mapped.date, '2026-08-17');
  assert.equal(mapped.endDate, '2026-08-23');
  assert.equal(bookingDates(mapped).length, 7);
});

test('une réservation portant explicitement la politique Sprint 3 conserve sa granularité', () => {
  const dto = toApiReservation({ ...period, timePolicyVersion: 'sprint3-v1', timeGranularity: 'hour', snapMinutes: 30 });
  assert.equal(dto.timeGranularity, 'hour');
  assert.equal(dto.snapMinutes, 30);
  const mapped = fromApiReservation({ ...dto, id: period.id, version: 3, timePolicyVersion: 'sprint3-v1' });
  assert.equal(mapped.timePolicyVersion, 'sprint3-v1');
  assert.equal(mapped.start, '09:00');
});

test('une fin de période antérieure est refusée', () => {
  const invalid = { ...period, endDate: '2026-08-16' };
  assert.match(bookingIssues(invalid, [], [room]).join(' '), /dernier jour/i);
});

test('les conflits sont détectés sur deux périodes qui se croisent', () => {
  const other = { ...period, id: 'other', date: '2026-08-22', endDate: '2026-08-25' };
  assert.equal(overlaps(period, other), true);
  assert.equal(overlaps(period, { ...other, date: '2026-08-23', start: '18:00' }), false);
});

test('les salles sont classées par métier de post-production', () => {
  assert.equal(postProductionKind(room), 'editing');
  assert.equal(postProductionKind({ name: 'Salle Étalonnage HDR', type: 'room' }), 'grading');
  assert.equal(postProductionKind({ name: 'Studio Mix Atmos', type: 'room' }), 'mixing');
  assert.equal(postProductionKind({ name: 'Laboratoire PAD', type: 'room' }), 'pad');
});

test('ELIOTE possède le parc Northlight complété par 8 mixages Pro Tools et 3 étalonnages Resolve', () => {
  const resources = eliotePostProductionResources();
  assert.equal(resources.filter(({ name }) => /^Salle de montage AVID \d{3}$/.test(name)).length, 55);
  assert.equal(resources.filter(({ name }) => /^Poste Remote AVID \d+$/.test(name)).length, 20);
  assert.equal(resources.filter(({ name }) => name.startsWith('Studio Pro Tools Mixage 5.1 ')).length, 3);
  assert.equal(resources.filter(({ name }) => name.startsWith('Studio Pro Tools Mixage Stéréo ')).length, 5);
  assert.equal(resources.filter(({ name }) => name.startsWith('Salle Étalonnage DaVinci Resolve ')).length, 3);
  assert.equal(resources.length, 86);
  assert.equal(new Set(resources.map(resource => resource.id)).size, 86);
  assert.ok(resources.every(resource => resource.companyId === 'company_eliote_props_prod' && resource.siteId === 'site_eliote_props_paris'));
});

test('la migration Planning ELIOTE est additive et idempotente', () => {
  const db = { companies: [{ id: 'company_eliote_props_prod' }], sites: [{ id: 'site_eliote_props_paris', companyId: 'company_eliote_props_prod' }], resources: [{ id: 'resource_user', companyId: 'company_eliote_props_prod', siteId: 'site_eliote_props_paris', name: 'Salle utilisateur' }], migrations: [] };
  assert.equal(migrateEliotePostProductionResources(db), true);
  assert.equal(db.resources.length, 87);
  assert.ok(db.resources.some(resource => resource.id === 'resource_user'));
  assert.equal(migrateEliotePostProductionResources(db), false);
  assert.equal(db.resources.length, 87);
  const marker = db.migrations.find(value => value.id === 'demo-planning-eliote-resources-v1');
  assert.deepEqual({ editingRooms: marker.editingRooms, remoteRooms: marker.remoteRooms, mixingRooms: marker.mixingRooms, gradingRooms: marker.gradingRooms, total: marker.total }, { editingRooms: 55, remoteRooms: 20, mixingRooms: 8, gradingRooms: 3, total: 86 });
});

test('la vue projet est distincte du projet de création et la synchro recharge la fenêtre visible', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(source, /aria-label="Vue par projet" data-filter="project"/);
  assert.match(source, /data-active-planning-project aria-label="Projet utilisé pour une nouvelle réservation"/);
  assert.match(source, /function planningProjectRoomIds\(projectId\)/);
  assert.match(source, /projectRooms\.has\(r\.id\)/);
  assert.match(source, /data-clear-project-view/);
  assert.match(source, /filters\.project=projectViewSelector\.value;filters\.resource='';render\(\)/);
  assert.match(source, /function planningReservationPath\(\)/);
  assert.match(source, /await apiAll\(planningReservationPath\(\)\)/);
  assert.match(source, /await loadPlanningWindow\(\);await loadDashboardMetrics\(\)/);
  assert.doesNotMatch(source, /state\.bookings=listItems\(await api\('\/api\/v1\/reservations'\)\)/);
  assert.doesNotMatch(source, /apiAll\('\/api\/v1\/reservations'\)/);
});

test('la fenêtre virtuelle borne lignes et dates tout en conservant les dimensions avant et après', () => {
  assert.deepEqual(planningVirtualSlice(250, 920, 736, 92, 4), {
    start: 6, end: 22, before: 552, after: 20976, count: 16, total: 250,
  });
  assert.deepEqual(planningVirtualSlice(126, 4160, 1040, 104, 3), {
    start: 37, end: 53, before: 3848, after: 7592, count: 16, total: 126,
  });
  assert.deepEqual(planningVirtualSlice(2, 0, 800, 92, 4), {
    start: 0, end: 2, before: 0, after: 0, count: 2, total: 2,
  });
});

test('une vue Projet agrandit uniformément les lignes qui empilent plusieurs réservations', () => {
  const second = { ...period, id: 'booking_period_2', title: 'Deuxième session' };
  const third = { ...period, id: 'booking_period_3', title: 'Troisième session' };
  const fourth = { ...period, id: 'booking_period_4', title: 'Quatrième session' };
  const slots = [{ date: '2026-08-17', key: '2026-08-17' }];
  assert.equal(planningMaxCellStack([period, second], [room], slots), 2);
  const indexed = planningCellEntriesBySlot([period, second], [room], slots);
  assert.deepEqual(indexed.get(`${room.id}|2026-08-17`).map(({ booking }) => booking.id), [period.id, second.id]);
  const halfDaySlots = planningTimelineSlots('day', 'halfDay', ['2026-08-17']);
  const outsideHalfDays = [
    { ...period, id: 'before_half_day', start: '06:00', end: '08:00' },
    { ...period, id: 'after_half_day', start: '19:00', end: '20:00' },
  ];
  assert.equal(planningCellEntriesBySlot(outsideHalfDays, [room], halfDaySlots, true, 'halfDay').size, 0);
  assert.equal(planningMaxCellStack([period, second, third, fourth], [room], slots), 3);
  assert.equal(planningRowHeight(92, 1), 92);
  assert.equal(planningRowHeight(92, 2), 132);
  assert.equal(planningRowHeight(92, 3), 194);
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /stackDepth=filters\.project\?planningMaxCellStack/);
  assert.match(source, /data-row-height="\$\{rowHeight\}"/);
  assert.match(source, /rowHeight=Number\(matrix\?\.dataset\.rowHeight\)\|\|92/);
  assert.match(source, /event\(booking,cell,stacked\)/);
  assert.match(source, /const PLANNING_CELL_RENDER_LIMIT=50/);
  assert.match(source, /visibleCells=cells\.slice\(0,PLANNING_CELL_RENDER_LIMIT\)/);
  assert.match(source, /cellsBySlot\.get\(`\$\{room\.id\}\|\$\{slot\.key\}`\)\|\|\[\]/);
  assert.doesNotMatch(source, /visibleSlots\.map\(\(slot,visibleSlotIndex\)=>\{[^\n]*bookings\.flatMap/);
  assert.match(source, /planning-stack-summary/);
  assert.equal((source.match(/planningEventOperationsBase\(booking,cell,compact\)|commercialPlanningEventBase\(booking,cell,compact\)/g)||[]).length, 2);
  assert.match(css, /\.planning-cell\.is-stacked \.planning-event\.is-compact-stack\{[^}]*height:58px/);
  assert.match(css, /\.planning-cell\.is-time-slot\.is-stacked\{overflow-x:hidden;overflow-y:auto/);
  assert.match(css, /\.planning-cell\.is-time-slot\.is-stacked \.planning-timed-event\{width:calc\(var\(--planning-day-width\) - 8px\)\}/);
});

test('le planning rend des fenêtres virtualisées et restaure les deux axes de défilement', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /data-virtual-row-start=/);
  assert.match(source, /data-virtual-column-start=/);
  assert.match(source, /visibleRooms=rooms\.slice\(rowWindow\.start,rowWindow\.end\)/);
  assert.match(source, /visibleSlots=slots\.slice\(columnWindow\.start,columnWindow\.end\)/);
  assert.match(source, /timeline\.scrollLeft=planningVirtualState\.scrollLeft/);
  assert.match(source, /timeline\.scrollTop=planningVirtualState\.scrollTop/);
  assert.match(source, /const restorePlanningScroll=/);
  assert.match(source, /fixedColumn\.onscroll=\(\)=>syncVertical\(fixedColumn,timeline\)/);
  assert.match(source, /syncVertical\(timeline,fixedColumn\)/);
  assert.doesNotMatch(source, /fixedColumn\?\.addEventListener\('wheel'/);
  assert.match(css, /\.postprod-matrix\.is-virtualized/);
  assert.match(css, /var\(--planning-virtual-left\)/);
  assert.match(css, /var\(--planning-virtual-top\)/);
  assert.match(css, /scrollbar-gutter:stable both-edges/);
  assert.match(css, /\.planning-matrix-scroll::-webkit-scrollbar/);
  assert.match(css, /\.planning-fixed-column\{[^}]*overflow-y:auto/);
  assert.match(css, /\.planning-matrix-shell \.planning-fixed-column\{height:calc\(100% - var\(--planning-scrollbar-size\)\)\}/);
  assert.match(css, /scrollbar-width:none/);
  assert.match(source, /style\.setProperty\('--planning-scrollbar-size'/);
  assert.match(source, /timeline\.offsetHeight-timeline\.clientHeight/);
});

test('la fenêtre virtuelle conserve un tampon pour ne pas reconstruire la grille à chaque cran de molette', () => {
  assert.equal(planningVirtualWindowNeedsRender(0, 29, 250, 670, 760, 92), false);
  assert.equal(planningVirtualWindowNeedsRender(0, 29, 250, 1800, 760, 92), true);
  assert.equal(planningVirtualWindowNeedsRender(12, 41, 250, 1500, 760, 92), false);
  assert.equal(planningVirtualWindowNeedsRender(12, 41, 250, 800, 760, 92), true);
});

test('les sept statuts sont filtrables et les états terminaux ou de maintenance restent explicites', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /bookingStatuses\.map\(status=>/);
  assert.match(source, /!bookingTerminalStatuses\.has\(b\.status\)/);
  assert.match(source, /class="event-status-label"/);
  assert.match(source, /if\(b&&!bookingTerminalStatuses\.has\(b\.status\)\)/);
  assert.match(css, /\.planning-event\.maintenance/);
  assert.match(css, /\.planning-event\.unavailable/);
  assert.match(css, /repeating-linear-gradient/);
});

test('le collage multi-cellules utilise une seule commande batch atomique', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const implementation = source.match(/async function duplicatePlanningItems\(items\)\{[^\n]+/s)?.[0] || '';
  const undo = source.match(/async function undoPlanningOperation\(\)\{[\s\S]+?async function redoPlanningOperation/)?.[0] || '';
  assert.match(implementation, /api\('\/api\/v1\/reservations\/batch'/);
  assert.match(implementation, /actions:items\.map/);
  assert.match(implementation, /'Idempotency-Key':uid\('planning-batch-'/);
  assert.doesNotMatch(implementation, /for\(const item of items\)/);
  assert.match(undo, /api\('\/api\/v1\/reservations\/batch'/);
  assert.match(undo, /type:'cancel'/);
  assert.doesNotMatch(undo, /for\(const item of action\.items\)/);
});

test('le planning annonce explicitement la sauvegarde, la synchronisation et le mode hors connexion', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /planningSyncLabels=\{saving:'Sauvegarde…',synced:'Synchronisé',offline:'Hors connexion'\}/);
  assert.match(source, /data-planning-sync data-state=/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /planningMutation=mutation&&\/\^\\\/api\\\/v1\\\/reservations/);
  assert.match(source, /window\.addEventListener\('offline'/);
  assert.match(source, /window\.addEventListener\('online'/);
  assert.match(css, /\.planning-sync-status\[data-state="offline"\]/);
});

test('le mode peinture sélectionne des cellules non contiguës puis crée un lot atomique', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  const commit = source.match(/async function commitPlanningPaint\(\)\{[^\n]+/s)?.[0] || '';
  assert.match(source, /planningPaintCells=new Map\(\)/);
  assert.match(source, /data-planning-paint-confirm/);
  assert.match(source, /planningPaintCells\.has\(key\)\?planningPaintCells\.delete\(key\):planningPaintCells\.set\(key,data\)/);
  assert.match(commit, /api\('\/api\/v1\/reservations\/batch'/);
  assert.match(commit, /JSON\.stringify\(\{actions\}\)/);
  assert.match(commit, /rememberPlanningUndo\(\{type:'paint'/);
  assert.match(css, /\.planning-cell\.is-paint-target/);
});

test('annuler et rétablir une réservation utilisent des compensations serveur', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const undo = source.match(/async function undoPlanningOperation\(\)\{[\s\S]+?async function redoPlanningOperation/)?.[0] || '';
  const redo = source.match(/async function redoPlanningOperation\(\)\{[\s\S]+?async function moveWholePlanningBooking/)?.[0] || '';
  assert.match(source, /rememberPlanningUndo\(\{type:'cancel'/);
  assert.match(undo, /type:'restore'/);
  assert.match(undo, /planning-undo-cancel-/);
  assert.match(redo, /type:'cancel'/);
  assert.match(redo, /planning-redo-cancel-/);
});

test('déplacer une sélection utilise une seule commande batch compensable', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const move = source.match(/async function movePlanningSelectionToTarget\(\)\{[^\n]+/s)?.[0] || '';
  const undo = source.match(/async function undoPlanningOperation\(\)\{[\s\S]+?async function redoPlanningOperation/)?.[0] || '';
  const redo = source.match(/async function redoPlanningOperation\(\)\{[\s\S]+?async function moveWholePlanningBooking/)?.[0] || '';
  assert.match(move, /\/api\/v1\/reservations\/batch/);
  assert.match(move, /type:'move'/);
  assert.match(move, /rememberPlanningUndo\(\{type:'batchMove'/);
  assert.match(undo, /action\.type==='batchMove'/);
  assert.match(undo, /planning-undo-move-/);
  assert.match(redo, /action\.type==='batchMove'/);
  assert.match(redo, /planning-redo-move-/);
});

test('redimensionner une sélection utilise une seule commande batch compensable', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const resize = source.match(/async function resizePlanningSelectionToTarget\(\)\{[^\n]+/s)?.[0] || '';
  const undo = source.match(/async function undoPlanningOperation\(\)\{[\s\S]+?async function redoPlanningOperation/)?.[0] || '';
  const redo = source.match(/async function redoPlanningOperation\(\)\{[\s\S]+?async function moveWholePlanningBooking/)?.[0] || '';
  assert.match(resize, /\/api\/v1\/reservations\/batch/);
  assert.match(resize, /type:'resize'/);
  assert.match(resize, /rememberPlanningUndo\(\{type:'batchResize'/);
  assert.match(undo, /action\.type==='batchResize'/);
  assert.match(undo, /planning-undo-resize-/);
  assert.match(redo, /action\.type==='batchResize'/);
  assert.match(redo, /planning-redo-resize-/);
});

test('Maj + sélection étend un rectangle de cellules visible et reste accessible au clavier', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const rectangle = source.match(/function selectPlanningRectangle\(item,additive=false\)\{[^\n]+/s)?.[0] || '';
  assert.match(rectangle, /dateBounds/);
  assert.match(rectangle, /resourceBounds/);
  assert.match(rectangle, /planningCellSelection\.add/);
  assert.match(source, /if\(click\.shiftKey\)selectPlanningRectangle/);
  assert.match(source, /if\(keyboard\.shiftKey\)selectPlanningRectangle/);
});

test('les historiques Planning sont bornés, scopés par société et refusent une version divergente', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const undo = source.match(/async function undoPlanningOperation\(\)\{[\s\S]+?async function redoPlanningOperation/)?.[0] || '';
  const redo = source.match(/async function redoPlanningOperation\(\)\{[\s\S]+?async function moveWholePlanningBooking/)?.[0] || '';
  assert.match(source, /function pushPlanningHistory\(stack,action\).*stack\.length>50/);
  assert.match(source, /function clearPlanningTransientState\(\).*planningUndo=\[\].*planningCellSelection\.clear/);
  assert.match(source, /state\.user\?\.companyId!==previous\)clearPlanningTransientState\(\)/);
  assert.match(undo, /version:item\.version/);
  assert.doesNotMatch(undo, /version:find\(state\.bookings,item\.id\)\?\.version/);
  assert.match(redo, /version:item\.version/);
  assert.doesNotMatch(redo, /version:find\(state\.bookings,item\.id\)\?\.version/);
});

test('l’indicateur de sauvegarde attend la fin de toutes les mutations concurrentes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(source, /planningPendingMutations=0,planningNetworkFailure=false/);
  assert.match(source, /function beginPlanningMutation\(\)\{planningPendingMutations\+\+;setPlanningSyncState\('saving'\)\}/);
  assert.match(source, /function finishPlanningMutation\(networkFailure=false\).*if\(planningPendingMutations\)setPlanningSyncState\('saving'\)/);
  assert.match(source, /if\(planningMutation\)beginPlanningMutation\(\)/);
  assert.match(source, /if\(planningMutation\)finishPlanningMutation\(false\)/);
});

test('Sprint 5 affiche et renouvelle une présence courte sans remplacer le contrôle de version', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /PLANNING_PRESENCE_HEARTBEAT_MS=8000/);
  assert.match(source, /api\(`\/api\/v1\/reservations\/\$\{encodeURIComponent\(reservationId\)\}\/presence`/);
  assert.match(source, /JSON\.stringify\(\{version:live\.version,intent\}\)/);
  assert.match(source, /setInterval\(renew,PLANNING_PRESENCE_HEARTBEAT_MS\)/);
  assert.match(source, /async function withPlanningPresence\(reservationId,intent,operation\).*acquirePlanningPresence.*finally\{await releasePlanningPresence\(\)\}/);
  assert.match(source, /withPlanningPresence\(bookingId,'moving'.*movePlanningCellByRoom/);
  assert.match(source, /withPlanningPresence\(live\.id,'moving'/);
  assert.match(source, /withPlanningPresence\(live\.id,'resizing'/);
  assert.match(source, /MutationObserver.*modalBackdrop\.hidden.*releasePlanningPresence\(\)/);
  assert.match(source, /type==='reservation\.presence\.v1'\|\|type==='reservation\.presenceReleased\.v1'/);
  assert.match(source, /aria-disabled="true"/);
  assert.match(css, /\.planning-event\.is-presence-locked/);
  assert.match(css, /\.planning-presence-label/);
});

test('Sprint 5 ne fait pas clignoter l’autosave lors du heartbeat de présence', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(source, /planningMutation=mutation&&\/\^\\\/api\\\/v1\\\/reservations.*&&!\/\\\/presence\$\//);
});

test('Sprint 5 expose une gestion structurée des compétences et indisponibilités', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'planning.css'), 'utf8');
  assert.match(source, /\/api\/v1\/person-skills\?pageSize=200/);
  assert.match(source, /data-person-skill-form/);
  assert.match(source, /data-person-unavailability-form/);
  assert.match(source, /new Date\(input\.startsAt\)\.toISOString\(\)/);
  assert.match(source, /PlanyBot filtre automatiquement/);
  assert.match(css, /\.personnel-columns/);
});
