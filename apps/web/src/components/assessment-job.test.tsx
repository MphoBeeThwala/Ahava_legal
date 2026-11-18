import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PublicSubmission } from '@ahava88/shared';
import AssessmentCard from './AssessmentCard';
import IntakeForm from './IntakeForm';

const submission = (job: PublicSubmission['assessmentJob']): PublicSubmission => ({
  id: 'sub-1',
  clientLabel: 'Client 004',
  practiceArea: 'Criminal Defence',
  jurisdiction: 'South Africa',
  urgencyHint: 'medium',
  status: 'received',
  summary: '',
  createdAt: '2026-11-18T10:00:00Z',
  assessment: null,
  matterCase: null,
  assessmentJob: job,
});

describe('background assessment states', () => {
  test('a running assessment says so instead of showing an old one', () => {
    render(
      <AssessmentCard
        matter={submission({ state: 'running', error: null, startedAt: '2026-11-18T10:00:00Z' })}
      />,
    );
    expect(screen.getByText('Assessing Client 004…')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/one to three minutes/);
  });

  test('a failed assessment shows the reason and can be retried', () => {
    const retry = vi.fn();
    render(
      <AssessmentCard
        matter={submission({
          state: 'failed',
          error: 'Both AI services failed.',
          startedAt: '2026-11-18T10:00:00Z',
        })}
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Both AI services failed.');
    fireEvent.click(screen.getByRole('button', { name: 'Run the assessment again' }));
    expect(retry).toHaveBeenCalledWith('sub-1');
  });

  test('typing a new intake tells the page to clear the last assessment', () => {
    const onEdit = vi.fn();
    render(<IntakeForm onSubmit={async () => true} onEdit={onEdit} busy={false} />);
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'New client' } });
    expect(onEdit).toHaveBeenCalled();
  });
});

describe('closing the assessment', () => {
  test('a finished assessment can be closed or its matter opened', () => {
    const onClose = vi.fn();
    const onOpenMatter = vi.fn();
    render(
      <AssessmentCard
        matter={{
          ...submission(null),
          assessment: {
            id: 'assessment-1',
            provider: 'fake',
            model: 'fake-1',
            matterType: 'General',
            urgency: 'medium',
            summary: 'Done.',
            keyFacts: [],
            attorneyQuestions: [],
            recommendedDocuments: [],
            complianceFlags: [],
            nextActions: [],
            confidence: 0.5,
            popiaNotes: [],
            createdAt: '2026-11-18T10:00:00Z',
          } as PublicSubmission['assessment'],
          matterCase: {
            id: 'case-1',
            submissionId: 'sub-1',
            caseNumber: 'MAT-2026-0007',
            status: 'triage',
            urgency: 'medium',
            practiceArea: 'General',
            nextAction: null,
          } as PublicSubmission['matterCase'],
        }}
        onClose={onClose}
        onOpenMatter={onOpenMatter}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open the matter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done, close' }));
    expect(onOpenMatter).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
