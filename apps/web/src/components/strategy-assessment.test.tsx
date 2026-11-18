import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { StrategyAssessment } from '@ahava88/shared';
import StrategyAssessmentView from './StrategyAssessmentView';
import IntakeForm from './IntakeForm';

const assessment: StrategyAssessment = {
  practiceArea: { primary: 'labour', secondary: ['criminal'] },
  forumAndJurisdiction: {
    forum: 'CCMA',
    jurisdiction: 'Gauteng',
    burdenOfProof: 'The employer must prove fairness.',
  },
  factAudit: { confirmedFacts: ['Dismissed'], corroborationRequired: [], criticalGaps: [] },
  caseTheory: 'The dismissal was substantively unfair.',
  meritAndElementMatrix: [
    {
      item: 'Claim: unfair dismissal',
      kind: 'claim',
      elements: [
        {
          element: 'Rule existed',
          burden: 'Employer',
          ourVersion: 'No rule',
          assessment: 'Weak for employer',
        },
      ],
      viability: 'high',
      viabilityReasoning: 'No hearing was held.',
      opposingAttackVectors: ['Prior warnings'],
      fallbackAlternatives: ['Compensation'],
    },
  ],
  deadlinesAndPrescriptionAlerts: [
    {
      ruleId: 'labour.dismissal-referral',
      rule: 'Refer the dismissal to the CCMA',
      trigger: 'Date of dismissal',
      triggerDate: '2026-11-02',
      deadline: '2026-12-02',
      computed: true,
      status: 'urgent',
      authority: 'LRA s 191(1)(b)(i): 30 days',
      note: '',
    },
  ],
  precedentAndStatutoryAuthorities: [
    { authority: 'Sidumo', principle: 'Review', appliesTo: '', sources: [], status: 'curated' },
    { authority: 'X v Y', principle: 'Made up', appliesTo: '', sources: [], status: 'unverified' },
  ],
  winningStrategyRoadmap: {
    immediateActions_0_to_72h: ['Refer to the CCMA this week'],
    settlementOrADRPath: ['Conciliation'],
    litigationOrExecutionBlueprint: [],
  },
  tacticalWarnings: ['Check the referral limits.'],
  sources: [],
  removed: [],
  gaps: [],
  queries: [],
  model: 'fake',
  generatedAt: '2026-11-18T10:00:00Z',
};

describe('strategy assessment view', () => {
  test('shows domains, deadlines first, ratings, the matrix, authorities and the roadmap', () => {
    render(<StrategyAssessmentView assessment={assessment} />);
    const domains = screen.getByLabelText('Practice areas');
    expect(within(domains).getByText('Labour law')).toBeTruthy();
    expect(within(domains).getByText('+ Criminal law')).toBeTruthy();
    const deadlines = screen.getByRole('alert', { name: 'Deadlines and prescription' });
    expect(within(deadlines).getByText('Within 7 days')).toBeTruthy();
    expect(within(deadlines).getByText('2 December 2026')).toBeTruthy();
    expect(within(screen.getByLabelText('Merit ratings')).getByText('High viability')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Our version' })).toBeTruthy();
    expect(screen.getByText('Curated')).toBeTruthy();
    expect(screen.getByText('Not verified')).toBeTruthy();
    expect(screen.getByText('Immediate actions (0–72 hours)')).toBeTruthy();
    expect(screen.getByText('Nothing suggested.')).toBeTruthy();
  });
});

describe('intake form', () => {
  test('asks for the charge sheet only in criminal matters', () => {
    render(<IntakeForm onSubmit={async () => true} busy={false} />);
    expect(screen.queryByLabelText(/Charge sheet \(J15\)/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Practice area'), {
      target: { value: 'Criminal Defence' },
    });
    expect(screen.getByLabelText(/Charge sheet \(J15\)/)).toBeTruthy();
  });
});
