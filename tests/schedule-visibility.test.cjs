const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRoute } = require('./helpers/route-harness.cjs');

const { scheduleVisibleTo } = loadRoute('src/services/scheduleService.ts', {
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
