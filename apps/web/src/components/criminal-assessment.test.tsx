import { describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { CriminalAssessment } from '@ahava88/shared';
import CriminalAssessmentView from './CriminalAssessmentView';

const assessment: CriminalAssessment = {
  caseTheory: '[Client] acted in private defence.',
  factAudit: {
    confirmed: ['Bail granted'],
    corroborationNeeded: ['SAPS 13 register'],
    criticalUnknowns: [],
  },
  counts: [
    {
      count: 'Count 1: Assault GBH',
      elements: [
        {
          element: 'Unlawfulness',
          stateBurden: 'No private defence',
          clientVersion: 'Attacked first',
          assessment: 'Proportionality decides it',
        },
      ],
      primaryDefence: 'Private defence',
      viability: 'high-risk',
      viabilityReasoning: 'Serious injuries.',
      prosecutionAttacks: ['Proportionality'],
      competentVerdicts: ['Common assault'],
      sentencing: 'Regional court.',
      authorities: [
        { authority: 'S v Trainor', principle: 'Test', sources: ['S1'], verified: true },
        { authority: 'S v Steyn', principle: 'Proportionality', sources: [], verified: false },
      ],
    },
  ],
  proceduralIssues: [],
  strategy: {
    immediatePreservation: ['CCTV letter'],
    witnessProtocol: [],
    trialBlueprint: ['Cross-examine on the J88'],
    representationsStrategy: [],
  },
  tacticalWarnings: ['No statement to SAPS before docket disclosure.'],
  sources: [
    {
      ref: 'S1',
      kind: 'case_law',
      sourceName: 'SCA',
      title: 'S v Trainor',
      citation: '[2002] ZASCA 125',
      pinpoint: '',
      url: 'https://example.org/trainor',
      versionDate: null,
      authorityLevel: 2,
      court: 'SCA',
      validity: 'in_force',
      effectiveDate: null,
      text: '…',
    },
  ],
  removed: [{ text: 'Give SAPS a statement', reason: 'Removed for safety' }],
  gaps: [],
  queries: [],
  model: 'fake-model',
  generatedAt: '2026-11-18T10:00:00Z',
};

describe('criminal merit assessment', () => {
  test('shows ratings, elements, authorities with verification, warnings and phases', () => {
    render(<CriminalAssessmentView assessment={assessment} />);
    const ratings = screen.getByLabelText('Merit ratings');
    expect(within(ratings).getByText('High risk')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'State must prove' })).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Not verified')).toBeTruthy();
    expect(screen.getByRole('link', { name: '[S1]' }).getAttribute('href')).toBe(
      'https://example.org/trainor',
    );
    expect(screen.getByLabelText('Tactical warnings').textContent).toMatch(/docket disclosure/);
    expect(screen.getByText('Path A: acquittal or s 174 discharge')).toBeTruthy();
    expect(screen.getByText(/1 item removed/)).toBeTruthy();
    expect(screen.getByText('None.')).toBeTruthy();
  });
});
