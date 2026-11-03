const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRoute } = require('./helpers/route-harness.cjs');
const { calculateActiveAndNextEvents: calculate } = loadRoute('src/services/scheduleService.ts', { extraModules: { '@/lib/supabase/client': {}, '@/data/officialSchedule': { OFFICIAL_FSY_SCHEDULE: {} } } });
const items = [
  { id: 'tomorrow', day: 'dia2', date: '2027-02-07', start_time: '08:00', end_time: '09:00' },
  { id: 'late', day: 'dia1', date: '2027-02-06', start_time: '22:00', end_time: '23:30' },
  { id: 'morning', day: 'dia1', date: '2027-02-06', start_time: '08:00', end_time: '09:00' },
];
test('activity uses Sao Paulo date even when UTC has crossed midnight', () => {
  const result = calculate(items, new Date('2027-02-07T01:30:00Z'));
  assert.equal(result.currentEvent.id, 'late');
  assert.equal(result.nextEvent.id, 'tomorrow');
});
test('gaps have no invented active event and next is chronologically sorted', () => {
  const result = calculate(items, new Date('2027-02-06T15:00:00Z'));
  assert.equal(result.currentEvent, null);
  assert.equal(result.nextEvent.id, 'late');
});
test('before and after event do not claim an activity is running', () => {
  const before = calculate(items, new Date('2026-10-20T12:00:00Z'));
  assert.equal(before.currentEvent, null);
  assert.equal(before.nextEvent.id, 'morning');
  const after = calculate(items, new Date('2027-02-11T03:00:00Z'));
  assert.equal(after.currentEvent, null);
  assert.equal(after.nextEvent, null);
});
test('activity without end time runs until the next one of the same day', () => {
  const open = [
    { id: 'abertura', day: 'dia1', date: '2027-02-06', start_time: '09:00', end_time: '--' },
    { id: 'almoco', day: 'dia1', date: '2027-02-06', start_time: '12:00', end_time: '' },
  ];
  // 10:30 em São Paulo = 13:30 UTC
  assert.equal(calculate(open, new Date('2027-02-06T13:30:00Z')).currentEvent.id, 'abertura');
  // Última do dia sem término: uma hora a partir do início
  assert.equal(calculate(open, new Date('2027-02-06T15:30:00Z')).currentEvent.id, 'almoco');
  assert.equal(calculate(open, new Date('2027-02-06T16:30:00Z')).currentEvent, null);
});
