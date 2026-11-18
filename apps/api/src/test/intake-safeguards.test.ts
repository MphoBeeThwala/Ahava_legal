// Safeguards against paying twice for the same work: duplicate intakes are
// refused (409) unless the attorney confirms; an assessed intake is not
// assessed again unless forced; a malformed AI answer is retried once.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../server';
import { setAiClient, type AiClient } from '../lib/ai-client';
import { createStaff, type TestStaff } from './helpers';

const TRIAGE = JSON.stringify({
  matterType: 'General',
  urgency: 'medium',
  summary: '[Client] needs advice.',
  keyFacts: [],
  attorneyQuestions: [],
  recommendedDocuments: [],
  complianceFlags: [],
  nextActions: ['Consult the client'],
  confidence: 0.6,
});

let answers: string[] = [];
let calls = 0;
const model: AiClient = {
  provider: 'fake',
  async complete() {
    const text = answers[calls] ?? TRIAGE;
    calls += 1;
    return {
      text,
      provider: 'fake',
      model: 'fake-1',
      inputTokens: 1,
      outputTokens: 1,
      stopReason: 'end_turn',
    };
  },
};

let attorney: TestStaff;
const intake = {
  fullName: 'Lerato Nkosi',
  email: 'lerato@example.co.za',
  phone: '082 555 2222',
  practiceArea: 'General',
  matterSummary: 'Lerato Nkosi would like general advice about a neighbour.',
  requestedOutcome: 'Advice.',
  consentToAi: true,
  consentToStorage: true,
};

beforeAll(async () => {
  attorney = await createStaff({ email: 'attorney@safeguards.example', role: 'attorney' });
});

afterEach(() => {
  setAiClient(undefined);
  answers = [];
  calls = 0;
});

const post = (body: Record<string, unknown>) =>
  request(app).post('/api/intake/submissions').set(attorney.auth).send(body);
const assess = (id: string, query = '') =>
  request(app).post(`/api/intake/submissions/${id}/assess${query}`).set(attorney.auth);

describe('duplicate intakes', () => {
  test('the same intake again is refused with the existing one named; retyped spacing does not matter', async () => {
    const first = await post(intake);
    expect(first.status).toBe(201);
    const again = await post({
      ...intake,
      matterSummary: '  lerato nkosi would like GENERAL advice about a neighbour  ',
    });
    expect(again.status).toBe(409);
    expect(again.body.duplicate).toMatchObject({
      submissionId: first.body.id,
      clientLabel: first.body.clientLabel,
      identical: true,
    });
    // The answer names numbers only, never the client.
    expect(JSON.stringify(again.body)).not.toMatch(/Lerato|Nkosi|lerato@/i);
  });

  test('the same client and practice area within a day is flagged as possibly the same matter', async () => {
    const res = await post({ ...intake, matterSummary: 'A different description of the problem.' });
    expect(res.status).toBe(409);
    expect(res.body.duplicate.identical).toBe(false);
    expect(res.body.message).toMatch(/Is this the same matter\?/);
  });

  test('the attorney can confirm it is a different matter; other clients are not affected', async () => {
    const confirmed = await post({
      ...intake,
      matterSummary: 'A different description of the problem.',
      allowDuplicate: true,
    });
    expect(confirmed.status).toBe(201);
    const other = await post({
      ...intake,
      email: 'someone.else@example.co.za',
      phone: '082 555 3001',
    });
    expect(other.status).toBe(201);
  });
});

describe('assessing again', () => {
  test('an assessed intake is not assessed again (no AI calls) unless forced', async () => {
    setAiClient(model);
    const created = await post({
      ...intake,
      email: 'assess-once@example.co.za',
      phone: '082 555 3002',
    });
    expect((await assess(created.body.id)).status).toBe(200);
    expect(calls).toBe(1);

    const again = await assess(created.body.id);
    expect(again.status).toBe(200);
    expect(again.body.assessment.summary).toMatch(/needs advice/);
    const background = await assess(created.body.id, '?background=1');
    expect(background.status).toBe(200);
    expect(background.body.assessmentJob ?? null).toBeNull();
    expect(calls).toBe(1);

    expect((await assess(created.body.id, '?force=1')).status).toBe(200);
    expect(calls).toBe(2);
  });
});

describe('malformed AI answers', () => {
  test('a cut-off answer is retried once with an instruction to be concise', async () => {
    setAiClient(model);
    answers = ['{"matterType": "General", "summary": "cut o'];
    const created = await post({ ...intake, email: 'retry@example.co.za', phone: '082 555 3003' });
    const res = await assess(created.body.id);
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  test('two malformed answers are an error the user sees', async () => {
    setAiClient(model);
    answers = ['not json', 'still not json'];
    const created = await post({ ...intake, email: 'retry2@example.co.za', phone: '082 555 3004' });
    const res = await assess(created.body.id);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/not in the expected format twice/);
  });
});
