// Criminal matters: the two-pass merit assessment, its guardrails, and how it
// is stored (encrypted) and shown, with a fake model.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import type { CitedSource } from '@ahava88/shared';
import app from '../server';
import { db } from '../db/client';
import { assessments } from '../db/schema';
import { setAiClient, type AiClient, type AiRequest } from '../lib/ai-client';
import {
  STANDING_WARNINGS,
  checkAuthorities,
  criminalAnswerSchema,
  guardAssessment,
  isCriminalMatter,
} from '../services/criminal-assessment';
import { alreadyAnswered } from '../services/answered-facts';
import { createStaff, inDefaultFirm, type TestStaff } from './helpers';

const BRIEF = `Practice area: Criminal Defence
Facts:
[Client] was arrested on 2 November 2026 and charged with Count 1: Assault with intent to do grievous bodily harm and Count 2: Theft of a jacket.
Bail of R2000 was granted on 4 November 2026; the matter was remanded to 9 December 2026. No previous convictions.`;

const source = (ref: string, text: string): CitedSource => ({
  ref,
  kind: 'case_law',
  sourceName: 'Supreme Court of Appeal',
  title: 'S v Trainor',
  citation: '[2002] ZASCA 125',
  pinpoint: 'para 13',
  url: 'https://www.supremecourtofappeal.org.za/trainor',
  versionDate: null,
  authorityLevel: 2,
  court: 'SCA',
  validity: 'in_force',
  effectiveDate: null,
  text,
});

const ANSWER = {
  case_theory_summary: '[Client] acted in private defence and took his own jacket by mistake.',
  fact_audit: {
    confirmed: ['Bail of R2000 granted on 4 November 2026'],
    corroboration_needed: ['Obtain the SAPS 13 register and OB entries for the jacket'],
    critical_unknowns: [
      'What is the bail amount?',
      'When is the next court date?',
      'Did [Complainant] have a weapon?',
    ],
  },
  count_assessments: [
    {
      count: 'Count 1: Assault GBH',
      elements_analysis: [
        {
          element: 'Unlawfulness',
          state_burden: 'That the force was not in private defence',
          client_version: 'He was attacked first',
          assessment: 'Proportionality is the battleground',
        },
      ],
      primary_defence: 'Private defence',
      viability_score: 'Moderate',
      viability_reasoning: 'Fist against fist; injuries are serious.',
      prosecution_attack_vectors: [
        'Proportionality of the force used',
        'The client should give a warning statement to the investigating officer to explain himself',
      ],
      competent_verdicts: ['Common assault'],
      sentencing: 'Within the regional court jurisdiction; no minimum sentence.',
      applicable_precedent: [
        { authority: 'S v Trainor', principle: 'Private defence test', sources: ['S1'] },
        { authority: 'S v Steyn', principle: 'Proportionality', sources: [] },
        { authority: 'S v Imaginary', principle: 'Made up', sources: ['S9'] },
      ],
    },
  ],
  constitutional_and_procedural_issues: [
    {
      issue: 'Search of the vehicle',
      analysis: 'The search was unlawful because the client did not consent.',
      authorities: [],
    },
    {
      issue: 'Search at the scene',
      analysis: 'Consider whether the police had reasonable grounds under s 22(b).',
      authorities: [],
    },
  ],
  winning_strategy: {
    immediate_preservation: ['Send a CCTV preservation letter to the tavern today'],
    witness_protocol: ['Do not give SAPS a statement; check whether the witness has deposed'],
    trial_defence_blueprint: ['Cross-examine on the J88 against the SAPS statement'],
    prosecutorial_representations_strategy: [
      'After docket disclosure, make written representations to withdraw Count 2',
      'Ensure POPIA compliance when storing the client file',
    ],
  },
  tactical_warnings: ['Watch the bail conditions'],
};

describe('guardrails', () => {
  const sources = [source('S1', 'In S v Trainor the court set out the test for private defence.')];
  const guarded = guardAssessment(criminalAnswerSchema.parse(ANSWER), sources, BRIEF);
  const removed = guarded.removed.map((r) => r.text);

  test('advice to give SAPS a statement is removed; advice not to is kept', () => {
    expect(removed.some((t) => /warning statement to the investigating officer/.test(t))).toBe(
      true,
    );
    expect(guarded.counts[0]!.prosecutionAttacks).toEqual(['Proportionality of the force used']);
    expect(guarded.strategy.witnessProtocol).toHaveLength(1);
  });

  test('a search called unlawful for want of consent alone is removed; s 22(b) analysis is kept', () => {
    expect(guarded.proceduralIssues.map((i) => i.issue)).toEqual(['Search at the scene']);
    expect(guarded.removed.some((r) => /22\(b\)/.test(r.reason))).toBe(true);
  });

  test('questions the intake already answers are dropped', () => {
    expect(guarded.factAudit.criticalUnknowns).toEqual(['Did [Complainant] have a weapon?']);
  });

  test('generic POPIA text is dropped', () => {
    expect(guarded.strategy.representationsStrategy).toEqual([
      'After docket disclosure, make written representations to withdraw Count 2',
    ]);
  });

  test('standing warnings always come first', () => {
    expect(guarded.tacticalWarnings.slice(0, STANDING_WARNINGS.length)).toEqual(STANDING_WARNINGS);
    expect(guarded.tacticalWarnings).toContain('Watch the bail conditions');
  });

  test('only authorities found in a retrieved passage count as verified', () => {
    const authorities = guarded.counts[0]!.authorities;
    expect(authorities.map((a) => [a.authority, a.verified, a.sources])).toEqual([
      ['S v Trainor', true, ['S1']],
      ['S v Steyn', false, []],
      ['S v Imaginary', false, []],
    ]);
    // A passage that exists but does not name the authority does not verify it.
    expect(
      checkAuthorities([{ authority: 'S v Steyn', principle: 'x', sources: ['S1'] }], sources)[0]!
        .verified,
    ).toBe(false);
  });

  test('viability is normalised and unknown values fall back to moderate', () => {
    expect(guarded.counts[0]!.viability).toBe('moderate');
    const odd = criminalAnswerSchema.parse({
      ...ANSWER,
      count_assessments: [{ ...ANSWER.count_assessments[0], viability_score: 'excellent' }],
    });
    expect(odd.count_assessments[0]!.viability_score).toBe('moderate');
    const risky = criminalAnswerSchema.parse({
      ...ANSWER,
      count_assessments: [{ ...ANSWER.count_assessments[0], viability_score: 'High Risk' }],
    });
    expect(risky.count_assessments[0]!.viability_score).toBe('high-risk');
  });

  test('a malformed answer parses to empty sections rather than crashing', () => {
    const empty = criminalAnswerSchema.parse({});
    expect(empty.count_assessments).toEqual([]);
    expect(empty.fact_audit.critical_unknowns).toEqual([]);
  });

  test('which matters are criminal', () => {
    expect(isCriminalMatter('Criminal Defence')).toBe(true);
    expect(isCriminalMatter('Housing', 'Bail application')).toBe(true);
    expect(isCriminalMatter('Housing', 'Eviction')).toBe(false);
    expect(alreadyAnswered('What are the bail conditions?', 'Housing dispute.')).toBe(false);
  });
});

// ------------------------------------------------------------------ end to end

const sent: AiRequest[] = [];

const triage = (practiceArea: string) =>
  JSON.stringify({
    matterType: practiceArea,
    urgency: 'high',
    summary: '[Client] faces assault and theft charges.',
    keyFacts: [],
    attorneyQuestions: ['What is the bail amount?', 'Was the jacket recovered?'],
    recommendedDocuments: [],
    complianceFlags: [],
    nextActions: ['Consult the client'],
    confidence: 0.7,
  });

const fakeModel: AiClient = {
  provider: 'fake',
  async complete(req) {
    sent.push(req);
    const text = /senior criminal litigation strategist/i.test(req.system)
      ? JSON.stringify(ANSWER)
      : /Read the charge sheet/.test(req.system)
        ? JSON.stringify({
            counts: ['Count 1: Assault GBH', 'Count 2: Theft'],
            queries: ['private defence [Client]'],
          })
        : triage(/Practice area: ([^\n]+)/.exec(req.messages[0]!.content)?.[1] ?? 'General');
    return {
      text,
      provider: 'fake',
      model: 'fake-model-1',
      inputTokens: 100,
      outputTokens: 100,
      stopReason: 'end_turn',
    };
  },
};

let attorney: TestStaff;

const intake = {
  fullName: 'Sipho Dlamini',
  email: 'sipho.d@example.co.za',
  phone: '082 555 9876',
  practiceArea: 'Criminal Defence',
  matterSummary:
    'Sipho Dlamini was arrested on 2 November 2026 and charged (J15) with assault GBH and theft of a jacket. Bail of R2000 was granted on 4 November 2026 and the matter was remanded to 9 December 2026. No previous convictions.',
  requestedOutcome: 'Acquittal.',
  consentToAi: true,
  consentToStorage: true,
};

beforeAll(async () => {
  attorney = await createStaff({ email: 'attorney@criminal.example', role: 'attorney' });
});

afterEach(() => {
  setAiClient(undefined);
  sent.length = 0;
});

async function assess(body: Record<string, unknown>) {
  const created = await request(app).post('/api/intake/submissions').set(attorney.auth).send(body);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const res = await request(app)
    .post(`/api/intake/submissions/${created.body.id}/assess`)
    .set(attorney.auth);
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  return res.body;
}

describe('criminal intake', () => {
  test('a criminal intake gets the merit assessment, de-identified and stored encrypted', async () => {
    setAiClient(fakeModel);
    const body = await assess(intake);
    const criminal = body.assessment.criminal;
    expect(criminal.counts[0]).toMatchObject({ count: 'Count 1: Assault GBH' });
    expect(criminal.counts[0].authorities.every((a: { verified: boolean }) => !a.verified)).toBe(
      true,
    );
    expect(criminal.gaps.join(' ')).toMatch(/No passage in the approved sources/);
    expect(criminal.queries).not.toContain('private defence [Client]');
    expect(criminal.queries).toContain('private defence');
    // Redundant triage questions are dropped too.
    expect(body.assessment.attorneyQuestions).toEqual(['Was the jacket recovered?']);
    // Triage, plan and assessment: the model never sees the client's name.
    expect(sent).toHaveLength(3);
    expect(JSON.stringify(sent)).not.toMatch(/Sipho|Dlamini/);
    expect(body.matterCase.nextAction).toBe('Send a CCTV preservation letter to the tavern today');

    const [row] = await inDefaultFirm(() =>
      db().select({ value: assessments.criminalEncrypted }).from(assessments),
    );
    expect(row!.value).toBeTruthy();
    expect(row!.value).not.toMatch(/private defence|Assault/i);

    const listed = await request(app).get('/api/intake/submissions').set(attorney.auth);
    const match = listed.body.find((s: { id: string }) => s.id === body.id);
    expect(match.assessment.criminal.caseTheory).toMatch(/private defence/);
  });

  test('other matters, and clients who declined AI, get no merit assessment', async () => {
    setAiClient(fakeModel);
    const housing = await assess({
      ...intake,
      email: 'housing@example.co.za',
      practiceArea: 'Housing',
      matterSummary: 'Sipho Dlamini was locked out of his flat by the landlord.',
    });
    expect(housing.assessment.criminal ?? null).toBeNull();

    sent.length = 0;
    const declined = await assess({
      ...intake,
      email: 'declined@example.co.za',
      consentToAi: false,
    });
    expect(declined.assessment.criminal ?? null).toBeNull();
    expect(sent).toHaveLength(0);
  });
});
