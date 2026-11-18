// The legal strategy engine: the practice-area router, the cartridges, the
// checks on the answer, and the intake pipeline end to end with a fake model.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { PRACTICE_AREAS, type CitedSource } from '@ahava88/shared';
import app from '../server';
import { db } from '../db/client';
import { assessments } from '../db/schema';
import { setAiClient, type AiClient, type AiRequest } from '../lib/ai-client';
import { CARTRIDGES, detectPracticeArea } from '../lib/legal-strategies';
import {
  checkAuthorities,
  checkDeadlines,
  guardStrategy,
  strategyAnswerSchema,
  strategySystemPrompt,
} from '../services/legal-strategy';
import { createStaff, inDefaultFirm, type TestStaff } from './helpers';

const source = (ref: string, text: string): CitedSource => ({
  ref,
  kind: 'case_law',
  sourceName: 'Supreme Court of Appeal',
  title: 'S v Trainor',
  citation: '[2002] ZASCA 125',
  pinpoint: '',
  url: 'https://example.org/trainor',
  versionDate: null,
  authorityLevel: 2,
  court: 'SCA',
  validity: 'in_force',
  effectiveDate: null,
  text,
});

describe('practice-area router', () => {
  test('the charge sheet and the form choose criminal law', () => {
    const result = detectPracticeArea({
      practiceArea: 'Criminal Defence',
      matterSummary: 'Arrested and charged with assault; bail granted.',
      chargeSheet: 'Count 1: Assault GBH',
    });
    expect(result.primary).toBe('criminal');
  });

  test('overlaps are found: criminal charges arising from workplace misconduct', () => {
    const result = detectPracticeArea({
      practiceArea: 'Labour Law',
      matterSummary:
        'The employer held a disciplinary hearing for misconduct and dismissed the employee. SAPS arrested him and he was charged with theft; bail was granted.',
    });
    expect(result.primary).toBe('labour');
    expect(result.secondary).toContain('criminal');
  });

  test('family with a property transfer', () => {
    const result = detectPracticeArea({
      practiceArea: 'Family Law',
      matterSummary:
        'Divorce; the spouses are married in community of property. The house must be transferred to the wife under the deed of sale; the bond must be cancelled and the rates clearance obtained.',
    });
    expect(result.primary).toBe('family');
    expect(result.secondary).toContain('conveyancing');
  });

  test('nothing recognisable means no strategy assessment', () => {
    expect(detectPracticeArea({ practiceArea: 'General', matterSummary: 'Hello.' }).primary).toBe(
      null,
    );
  });
});

describe('cartridges', () => {
  test('every practice area has a complete cartridge', () => {
    for (const id of PRACTICE_AREAS) {
      const cartridge = CARTRIDGES[id];
      expect(cartridge.id).toBe(id);
      expect(cartridge.governingStatutesAndRules.length).toBeGreaterThan(2);
      expect(cartridge.verifiedPrecedents.length).toBeGreaterThan(1);
      expect(cartridge.prescriptionAndDeadlineChecks.length).toBeGreaterThan(0);
      expect(cartridge.tacticalGuardrails.length).toBeGreaterThan(2);
      expect(cartridge.standingWarnings.length).toBeGreaterThan(0);
      for (const rule of cartridge.prescriptionAndDeadlineChecks) {
        expect(rule.id.startsWith(`${id}.`)).toBe(true);
        if (rule.compute) expect(rule.compute('2026-03-02')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      // Names only: no law report citations in the curated lists.
      for (const precedent of cartridge.verifiedPrecedents) {
        expect(precedent.authority).not.toMatch(/\d{4}|\(\d+\)\s*SA\b|\bSACR\b|\bZA[A-Z]{2,}\b/);
      }
    }
  });

  test('the prompt carries the primary and secondary cartridges', () => {
    const prompt = strategySystemPrompt('labour', ['criminal']);
    expect(prompt).toMatch(/PRACTICE AREA \(primary\): Labour law/);
    expect(prompt).toMatch(/PRACTICE AREA \(secondary\): Criminal law/);
    expect(prompt).toMatch(/labour\.dismissal-referral/);
    expect(prompt).toMatch(/Sidumo v Rustenburg Platinum Mines/);
  });
});

describe('deadlines', () => {
  const cartridges = [CARTRIDGES.labour, CARTRIDGES.estates];
  const alerts = checkDeadlines(
    strategyAnswerSchema.parse({
      deadlinesAndPrescriptionAlerts: [
        {
          ruleId: 'labour.dismissal-referral',
          rule: 'Refer the dismissal',
          triggerDate: '2026-11-02',
          deadline: '2027-05-01', // wrong: the app computes it
        },
        { ruleId: 'estates.report-death', rule: 'Report the estate', triggerDate: '2026-10-01' },
        { ruleId: null, rule: 'Contractual notice', deadline: '2027-02-01' },
        { ruleId: 'labour.review', rule: 'Review the award' },
      ],
    }).deadlinesAndPrescriptionAlerts,
    cartridges,
    '2026-11-28',
  );

  test('the app computes the date from its own rules and grades it', () => {
    const referral = alerts.find((a) => a.ruleId === 'labour.dismissal-referral')!;
    expect(referral).toMatchObject({ deadline: '2026-12-02', computed: true, status: 'urgent' });
    expect(referral.authority).toMatch(/s 191\(1\)\(b\)\(i\): 30 days/);
    expect(alerts.find((a) => a.ruleId === 'estates.report-death')).toMatchObject({
      deadline: '2026-10-15',
      status: 'overdue',
    });
  });

  test('a date the app cannot compute is kept as given and flagged; unknown dates last', () => {
    expect(alerts.find((a) => a.rule === 'Contractual notice')).toMatchObject({
      computed: false,
      status: 'upcoming',
    });
    expect(alerts.map((a) => a.status)).toEqual(['overdue', 'urgent', 'upcoming', 'unknown']);
  });
});

const BRIEF =
  'Practice area: Criminal Defence\n[Client] was arrested on 2 November 2026. Bail of R2000 was granted on 4 November 2026. No previous convictions.';

describe('guardrails', () => {
  test('each practice area removes its dangerous advice; negated advice is kept', () => {
    const answer = strategyAnswerSchema.parse({
      factAudit: {
        criticalGaps: ['What is the bail amount?', 'Was [Complainant] armed?'],
        corroborationRequired: ['Ensure POPIA compliance of the file'],
      },
      meritAndElementMatrix: [
        {
          item: 'Search of the vehicle',
          kind: 'issue',
          viabilityReasoning: 'The search was unlawful because the client did not consent.',
        },
        {
          item: 'Count 1: Assault GBH',
          kind: 'charge',
          viability: 'High Risk',
          fallbackAlternatives: ['Common assault as a competent verdict'],
        },
      ],
      winningStrategyRoadmap: {
        immediateActions_0_to_72h: [
          'The client should give a warning statement to the investigating officer',
          'Do not give SAPS a statement before docket disclosure',
        ],
        settlementOrADRPath: ['The verbal agreement to vary the sale price is binding'],
        litigationOrExecutionBlueprint: [
          'Distribute the house to the heirs now',
          'Distribute to the heirs once the L&D account has lain for inspection',
          'Dismiss the employee without a hearing',
        ],
      },
    });
    const guarded = guardStrategy(
      answer,
      { primary: 'criminal', secondary: ['conveyancing', 'estates'] },
      [],
      BRIEF,
    );
    const reasons = guarded.removed.map((r) => r.reason).join(' | ');
    expect(reasons).toMatch(/statement to SAPS/);
    expect(reasons).toMatch(/s 22\(b\)/);
    expect(reasons).toMatch(/oral sale or oral variation/);
    expect(reasons).toMatch(/distributing to heirs/);
    expect(reasons).toMatch(/generic POPIA/);
    expect(reasons).toMatch(/already gives this/);
    expect(guarded.meritAndElementMatrix.map((m) => m.item)).toEqual(['Count 1: Assault GBH']);
    expect(guarded.meritAndElementMatrix[0]!.viability).toBe('high-risk');
    expect(guarded.winningStrategyRoadmap.immediateActions_0_to_72h).toEqual([
      'Do not give SAPS a statement before docket disclosure',
    ]);
    expect(guarded.winningStrategyRoadmap.litigationOrExecutionBlueprint).toEqual([
      'Distribute to the heirs once the L&D account has lain for inspection',
      // Labour checks only run when labour is one of the areas.
      'Dismiss the employee without a hearing',
    ]);
    expect(guarded.factAudit.criticalGaps).toEqual(['Was [Complainant] armed?']);
    // Standing warnings of every area come first.
    expect(guarded.tacticalWarnings[0]).toBe(CARTRIDGES.criminal.standingWarnings[0]);
    expect(guarded.tacticalWarnings).toContain(CARTRIDGES.estates.standingWarnings[0]);
    // Forum and burden fall back to the cartridge.
    expect(guarded.forumAndJurisdiction.burdenOfProof).toMatch(/beyond reasonable doubt/);
  });

  test('labour: dismissal without a hearing is removed', () => {
    const guarded = guardStrategy(
      strategyAnswerSchema.parse({
        winningStrategyRoadmap: {
          litigationOrExecutionBlueprint: ['Dismiss the employee without a hearing'],
        },
      }),
      { primary: 'labour', secondary: [] },
      [],
      '',
    );
    expect(guarded.winningStrategyRoadmap.litigationOrExecutionBlueprint).toEqual([]);
  });

  test('authorities: verified in a passage, curated, or unverified', () => {
    const graded = checkAuthorities(
      [
        { authority: 'S v Trainor', principle: 'Private defence', sources: ['S1'] },
        { authority: 'S v Chretien', principle: 'Intoxication', sources: [] },
        { authority: 'S v Imaginary', principle: 'Made up', sources: ['S9'] },
        { authority: 'S v Tandwa', principle: 'Exclusion', sources: ['S1'] },
      ],
      [source('S1', 'In S v Trainor the court set out the test for private defence.')],
      [CARTRIDGES.criminal],
    );
    expect(graded.map((a) => [a.authority, a.status])).toEqual([
      ['S v Trainor', 'verified'],
      ['S v Chretien', 'curated'],
      ['S v Imaginary', 'unverified'],
      // A passage that does not name it does not verify it; it is still curated.
      ['S v Tandwa', 'curated'],
    ]);
  });

  test('a malformed answer parses to empty sections', () => {
    const empty = strategyAnswerSchema.parse({});
    expect(empty.meritAndElementMatrix).toEqual([]);
    expect(empty.winningStrategyRoadmap.immediateActions_0_to_72h).toEqual([]);
  });
});

// ------------------------------------------------------------------ end to end

const sent: AiRequest[] = [];

const STRATEGY_ANSWER = {
  forumAndJurisdiction: {
    forum: 'Regional Court',
    jurisdiction: 'Johannesburg',
    burdenOfProof: '',
  },
  caseTheory: '[Client] acted in private defence.',
  factAudit: { confirmedFacts: ['Bail granted'], corroborationRequired: [], criticalGaps: [] },
  meritAndElementMatrix: [
    {
      item: 'Count 1: Assault GBH',
      kind: 'charge',
      elements: [
        { element: 'Unlawfulness', burden: 'State', ourVersion: 'Attacked first', assessment: 'x' },
      ],
      viability: 'moderate',
    },
  ],
  deadlinesAndPrescriptionAlerts: [],
  precedentAndStatutoryAuthorities: [
    { authority: 'S v Trainor', principle: 'Private defence', appliesTo: 'Count 1', sources: [] },
  ],
  winningStrategyRoadmap: {
    immediateActions_0_to_72h: ['Send a CCTV preservation letter today'],
    settlementOrADRPath: [],
    litigationOrExecutionBlueprint: [],
  },
  tacticalWarnings: [],
};

const triage = (practiceArea: string) =>
  JSON.stringify({
    matterType: practiceArea,
    urgency: 'high',
    summary: '[Client] needs help.',
    keyFacts: [],
    attorneyQuestions: ['What is the bail amount?', 'Was anyone else present?'],
    recommendedDocuments: [],
    complianceFlags: [],
    nextActions: ['Consult the client'],
    confidence: 0.7,
  });

const fakeModel: AiClient = {
  provider: 'fake',
  async complete(req) {
    sent.push(req);
    const text = /senior South African litigation and transactional strategist/.test(req.system)
      ? JSON.stringify(STRATEGY_ANSWER)
      : /You prepare a legal strategy assessment/.test(req.system)
        ? JSON.stringify({ items: ['Count 1: Assault GBH'], queries: ['private defence [Client]'] })
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
    'Sipho Dlamini was arrested on 2 November 2026. Bail of R2000 was granted on 4 November 2026 and the matter was remanded to 9 December 2026. No previous convictions.',
  chargeSheet: 'State v Sipho Dlamini. Count 1: Assault with intent to do grievous bodily harm.',
  requestedOutcome: 'Acquittal.',
  consentToAi: true,
  consentToStorage: true,
};

beforeAll(async () => {
  attorney = await createStaff({ email: 'attorney@strategy.example', role: 'attorney' });
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

describe('intake pipeline', () => {
  test('a criminal intake with a J15 gets the strategy assessment, de-identified and encrypted', async () => {
    setAiClient(fakeModel);
    const body = await assess(intake);
    const strategy = body.assessment.strategy;
    expect(strategy.practiceArea.primary).toBe('criminal');
    expect(strategy.forumAndJurisdiction.burdenOfProof).toMatch(/beyond reasonable doubt/);
    expect(strategy.precedentAndStatutoryAuthorities[0]).toMatchObject({ status: 'curated' });
    expect(strategy.tacticalWarnings[0]).toBe(CARTRIDGES.criminal.standingWarnings[0]);
    expect(strategy.queries).toContain('private defence');
    expect(body.assessment.attorneyQuestions).toEqual(['Was anyone else present?']);
    expect(body.matterCase.nextAction).toBe('Send a CCTV preservation letter today');

    // Triage, plan and assessment; the charge sheet goes, without the name.
    expect(sent).toHaveLength(3);
    expect(sent[0]!.messages[0]!.content).toMatch(/Charge sheet \(J15\):[\s\S]*Count 1: Assault/);
    expect(sent[2]!.system).toMatch(/PRACTICE AREA \(primary\): Criminal law/);
    expect(JSON.stringify(sent)).not.toMatch(/Sipho|Dlamini/);

    const rows = await inDefaultFirm(() =>
      db().select({ value: assessments.strategyEncrypted }).from(assessments),
    );
    const stored = rows.map((r) => r.value).filter(Boolean);
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toMatch(/private defence|Assault/i);

    const listed = await request(app).get('/api/intake/submissions').set(attorney.auth);
    const match = listed.body.find((s: { id: string }) => s.id === body.id);
    expect(match.assessment.strategy.caseTheory).toMatch(/private defence/);
  });

  test('a labour intake is routed to labour law', async () => {
    setAiClient(fakeModel);
    const body = await assess({
      ...intake,
      email: 'labour@example.co.za',
      practiceArea: 'Labour Law',
      chargeSheet: '',
      matterSummary:
        'Sipho Dlamini was dismissed by his employer on 2 November 2026 after a disciplinary hearing for misconduct.',
    });
    expect(body.assessment.strategy.practiceArea.primary).toBe('labour');
    expect(sent[2]!.system).toMatch(/PRACTICE AREA \(primary\): Labour law/);
  });

  test('unrecognised matters and clients who declined AI get no strategy assessment', async () => {
    setAiClient(fakeModel);
    const general = await assess({
      ...intake,
      email: 'general@example.co.za',
      practiceArea: 'General',
      chargeSheet: '',
      matterSummary: 'Sipho Dlamini would like general advice.',
    });
    expect(general.assessment.strategy ?? null).toBeNull();
    expect(sent).toHaveLength(1);

    sent.length = 0;
    const declined = await assess({
      ...intake,
      email: 'declined@example.co.za',
      consentToAi: false,
    });
    expect(declined.assessment.strategy ?? null).toBeNull();
    expect(sent).toHaveLength(0);
  });
});
