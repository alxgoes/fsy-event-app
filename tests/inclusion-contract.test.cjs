const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const exportsUnderTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/types/inclusion.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsUnderTest, require });
const { createInclusionSchema, updateInclusionSchema, inclusionInterviewSchema, inclusionDecisionSchema } = exportsUnderTest;
const id = '123e4567-e89b-42d3-a456-426614174000';
const create = { medical_record_id: id, needs: 'Acompanhamento durante as atividades', contacts: { parent: {}, bishop: {} } };
const interview = { version: 1, scheduled_at: '2027-02-05T14:30:00-03:00', participants: 'Responsável e equipe', status: 'agendada' };
const decision = { version: 1, decision: 'participacao_confirmada', reason: 'Equipe avaliou as necessidades e o apoio disponível.', support_plan: '', confirmed_by_human: true };

test('case requires exactly one medical identity and rejects identity/author injection', () => {
  assert.equal(createInclusionSchema.safeParse(create).success, true);
  const { medical_record_id, ...unlinked } = create;
  assert.equal(createInclusionSchema.safeParse(unlinked).success, false);
  assert.equal(createInclusionSchema.safeParse({ ...create, new_record: { full_name: 'Participante' } }).success, false);
  assert.equal(createInclusionSchema.safeParse({ ...unlinked, new_record: { full_name: '  Participante  ' } }).data.new_record.full_name, 'Participante');
  assert.equal(createInclusionSchema.safeParse({ ...create, medical_record_id: 'nome-de-pessoa' }).success, false);
  for (const key of ['created_by', 'decided_by', 'decision', 'user_id', 'version']) {
    assert.equal(createInclusionSchema.safeParse({ ...create, [key]: id }).success, false, key);
  }
});

test('text is trimmed, bounded, and cannot contain only whitespace', () => {
  for (const needs of ['', '   ', 'a'.repeat(6001)]) assert.equal(createInclusionSchema.safeParse({ ...create, needs }).success, false);
  assert.equal(createInclusionSchema.safeParse({ ...create, needs: '  Apoio  ' }).data.needs, 'Apoio');
  assert.equal(createInclusionSchema.safeParse({ ...create, contacts: { parent: { role: 'medico' }, bishop: {} } }).success, false);
});

test('interviews require actual dates with timezone and a summary when completed', () => {
  assert.equal(inclusionInterviewSchema.safeParse(interview).success, true);
  for (const scheduled_at of ['2027-02-30T14:30:00-03:00', '2027-02-05', '2027-02-05T14:30:00', 'not-a-date']) {
    assert.equal(inclusionInterviewSchema.safeParse({ ...interview, scheduled_at }).success, false, scheduled_at);
  }
  assert.equal(inclusionInterviewSchema.safeParse({ ...interview, status: 'realizada', summary: ' ' }).success, false);
  assert.equal(inclusionInterviewSchema.safeParse({ ...interview, status: 'realizada', summary: 'A equipe registrou os apoios necessários.' }).success, true);
});

test('decision is explicit and human-confirmed with reason and support plan when needed', () => {
  assert.equal(inclusionDecisionSchema.safeParse(decision).success, true);
  for (const confirmed_by_human of [undefined, false, 'true', 1]) assert.equal(inclusionDecisionSchema.safeParse({ ...decision, confirmed_by_human }).success, false);
  assert.equal(inclusionDecisionSchema.safeParse({ ...decision, reason: ' ' }).success, false);
  assert.equal(inclusionDecisionSchema.safeParse({ ...decision, decision: 'participacao_com_apoio' }).success, false);
  assert.equal(inclusionDecisionSchema.safeParse({ ...decision, decision: 'participacao_com_apoio', support_plan: 'Acompanhamento individual pela equipe.' }).success, true);
  for (const key of ['decided_at', 'decided_by']) assert.equal(inclusionDecisionSchema.safeParse({ ...decision, [key]: id }).success, false);
});

test('all mutations require a positive integer concurrency version', () => {
  for (const [schema, body] of [[updateInclusionSchema, { version: 1, needs: 'Apoio' }], [inclusionInterviewSchema, interview], [inclusionDecisionSchema, decision]]) {
    for (const version of [undefined, 0, -1, 1.5, '1']) assert.equal(schema.safeParse({ ...body, version }).success, false);
  }
});
