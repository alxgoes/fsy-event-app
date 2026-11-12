const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRoute } = require('./helpers/route-harness.cjs');

const { scheduleVisibleTo, isStaffOnlyActivity } = loadRoute('src/services/scheduleService.ts', {
  extraModules: { '@/lib/supabase/client': {}, '@/data/officialSchedule': { OFFICIAL_FSY_SCHEDULE: {} } },
});

test('agenda do jovem oculta dia zero e atividades da equipe', () => {
  const agenda = [
    { id: 'preparo', day: 'dia0', category: 'Atividade' },
    { id: 'reuniao', day: 'dia1', category: 'Equipe' },
    { id: 'abertura', day: 'dia1', category: 'Espiritual' },
  ];
  assert.deepEqual(scheduleVisibleTo('jovem', agenda).map((item) => item.id), ['abertura']);
  assert.deepEqual(scheduleVisibleTo(null, agenda).map((item) => item.id), ['abertura']);
  assert.deepEqual(scheduleVisibleTo('consultor', agenda), agenda);
});

test('cinza na agenda só para atividades da equipe; logística para todos continua colorida', () => {
  assert.equal(isStaffOnlyActivity({ day: 'dia1', category: 'Equipe', title: 'Reunião administrativa' }), true);
  assert.equal(isStaffOnlyActivity({ day: 'dia0', category: 'Atividade', title: 'Visita às instalações' }), true);
  assert.equal(isStaffOnlyActivity({ day: 'dia1', category: 'Logística', title: 'Preparação para o Check-in' }), true);
  assert.equal(isStaffOnlyActivity({ day: 'dia1', category: 'Logística', title: 'Check-in' }), false);
  assert.equal(isStaffOnlyActivity({ day: 'dia2', category: 'Espiritual', title: 'Reunião sacramental' }), false);
});
