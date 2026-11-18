// Intake assessments run in the background (?background=1): the request
// answers at once and the client polls the submission.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../server';
import { db } from '../db/client';
import { submissions } from '../db/schema';
import { setAiClient, type AiClient } from '../lib/ai-client';
import { httpError } from '../lib/http';
import { createFirm } from '../services/firm.service';
import { createStaff, inDefaultFirm, type TestStaff } from './helpers';

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

let calls = 0;

// PGlite has one connection, so a test cannot poll while the job's
// transaction is open: the fake model answers quickly instead.
function model(fail = false): AiClient {
  return {
    provider: 'fake',
    async complete() {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (fail) throw httpError('The AI service failed (404). Please try again.', 502);
      return {
        text: TRIAGE,
        provider: 'fake',
        model: 'fake-1',
        inputTokens: 1,
        outputTokens: 1,
        stopReason: 'end_turn',
      };
    },
  };
}

let attorney: TestStaff;
const intake = {
  fullName: 'Thandi Mokoena',
  email: 'thandi@example.co.za',
  phone: '082 555 1111',
  practiceArea: 'General',
  matterSummary: 'Thandi Mokoena would like general advice about a neighbour.',
  requestedOutcome: 'Advice.',
  consentToAi: true,
  consentToStorage: true,
};

beforeAll(async () => {
  attorney = await createStaff({ email: 'attorney@background.example', role: 'attorney' });
});

afterEach(() => {
  setAiClient(undefined);
  calls = 0;
});

async function submit(email: string) {
  const created = await request(app)
    .post('/api/intake/submissions')
    .set(attorney.auth)
    .send({ ...intake, email });
  expect(created.status).toBe(201);
  return created.body.id as string;
}

const get = (id: string) => request(app).get(`/api/intake/submissions/${id}`).set(attorney.auth);
const start = (id: string) =>
  request(app).post(`/api/intake/submissions/${id}/assess?background=1`).set(attorney.auth);

async function until(id: string, done: (body: Record<string, any>) => boolean) {
  for (let i = 0; i < 100; i += 1) {
    const res = await get(id);
    if (done(res.body)) return res.body;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timed out waiting for the background assessment');
}

const markRunning = (id: string, startedAt: Date) =>
  inDefaultFirm(() =>
    db()
      .update(submissions)
      .set({ assessmentState: 'running', assessmentStartedAt: startedAt })
      .where(eq(submissions.id, id)),
  );

describe('background assessment', () => {
  test('answers 202 at once and the result appears when it is ready', async () => {
    setAiClient(model());
    const id = await submit('bg1@example.co.za');
    const started = await start(id);
    expect(started.status).toBe(202);
    expect(started.body.assessmentJob).toMatchObject({ state: 'running', error: null });
    expect(started.body.assessment).toBeNull();

    const done = await until(id, (body) => Boolean(body.assessment));
    expect(done.assessmentJob ?? null).toBeNull();
    expect(done.assessment.summary).toMatch(/needs advice/);
    expect(done.matterCase).toBeTruthy();
    expect(calls).toBe(1);
  });

  test('a job already running is not started twice', async () => {
    setAiClient(model());
    const id = await submit('bg5@example.co.za');
    await markRunning(id, new Date());
    const again = await start(id);
    expect(again.status).toBe(202);
    expect(again.body.assessmentJob.state).toBe('running');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toBe(0);
  });

  test('a failure is recorded with a safe message and can be retried', async () => {
    setAiClient(model(true));
    const id = await submit('bg2@example.co.za');
    await start(id);
    const failed = await until(id, (body) => body.assessmentJob?.state === 'failed');
    expect(failed.assessmentJob.error).toBe('The AI service failed (404). Please try again.');
    expect(failed.assessment).toBeNull();

    setAiClient(model());
    const retried = await start(id);
    expect(retried.body.assessmentJob.state).toBe('running');
    const done = await until(id, (body) => Boolean(body.assessment));
    expect(done.assessmentJob ?? null).toBeNull();
  });

  test('a job that died (still "running" after ten minutes) shows as failed and can restart', async () => {
    setAiClient(model());
    const id = await submit('bg3@example.co.za');
    await markRunning(id, new Date(Date.now() - 11 * 60_000));
    const res = await get(id);
    expect(res.body.assessmentJob).toMatchObject({ state: 'failed' });
    expect(res.body.assessmentJob.error).toMatch(/stopped before it finished/);
    expect((await start(id)).body.assessmentJob.state).toBe('running');
    await until(id, (body) => Boolean(body.assessment));
  });

  test('another firm cannot start the job or see it', async () => {
    const id = await submit('bg4@example.co.za');
    await createFirm({ slug: 'bg-other', legalName: 'Other', domains: ['bg-other.example'] });
    const other = await request(app)
      .post(`/api/intake/submissions/${id}/assess?background=1`)
      .set(attorney.auth)
      .set('Host', 'bg-other.example');
    expect(other.status).not.toBe(202);
    const seen = await get(id).set('Host', 'bg-other.example');
    expect(seen.status).not.toBe(200);
  });
});
