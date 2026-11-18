import type { Assessment, PublicSubmission } from '@ahava88/shared';
import StrategyAssessmentView from './StrategyAssessmentView';

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== '').map(String);
  }
  if (value == null || value === '') {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .filter((item) => item != null && item !== '')
      .map(String);
  }
  return [String(value)];
}

interface AssessmentCardProps {
  matter: PublicSubmission | null;
  onGoToIntake?: () => void;
  onGoToCases?: () => void;
  /** Runs the assessment again after a background run failed. */
  onRetry?: (submissionId: string) => void;
  /** Clears the card (the assessment stays saved on the matter). */
  onClose?: () => void;
  /** Opens the matter the assessment belongs to. */
  onOpenMatter?: () => void;
  /** Text for the empty card. */
  emptyText?: string;
}

function CardActions({
  onClose,
  onOpenMatter,
  closeLabel = 'Close',
}: {
  onClose?: () => void;
  onOpenMatter?: () => void;
  closeLabel?: string;
}) {
  if (!onClose && !onOpenMatter) {
    return null;
  }
  return (
    <div className="assessment-actions">
      {onOpenMatter ? (
        <button type="button" className="secondary-button" onClick={onOpenMatter}>
          Open the matter
        </button>
      ) : null}
      {onClose ? (
        <button type="button" className="secondary-button" onClick={onClose}>
          {closeLabel}
        </button>
      ) : null}
    </div>
  );
}

function AssessmentCard({
  matter,
  onGoToIntake,
  onGoToCases,
  onRetry,
  onClose,
  onOpenMatter,
  emptyText,
}: AssessmentCardProps) {
  if (!matter) {
    return (
      <div className="panel assessment-panel">
        <p className="panel-kicker">Assessment</p>
        <h2>No matter selected</h2>
        <p className="muted">
          {emptyText || 'Submit an intake or choose a case to view the attorney-facing triage.'}
        </p>
        <div className="empty-actions">
          {onGoToIntake ? (
            <button type="button" className="primary-button" onClick={onGoToIntake}>
              New intake
            </button>
          ) : null}
          {onGoToCases ? (
            <button type="button" className="secondary-button" onClick={onGoToCases}>
              Browse cases
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const job = matter.assessmentJob;
  if (job?.state === 'running') {
    return (
      <div className="panel assessment-panel" aria-busy="true">
        <p className="panel-kicker">Assessment</p>
        <h2>Assessing {matter.clientLabel || 'the intake'}…</h2>
        <p className="muted" role="status">
          The AI is reading the intake, searching the approved sources and checking its answer. This
          usually takes one to three minutes; it will appear here when it is ready. You can keep
          working in the meantime.
        </p>
        <CardActions onClose={onClose} closeLabel="Hide (it keeps running and is saved)" />
      </div>
    );
  }
  if (job?.state === 'failed') {
    return (
      <div className="panel assessment-panel">
        <p className="panel-kicker">Assessment</p>
        <h2>The assessment did not finish</h2>
        <p className="notice notice-error" role="alert">
          {job.error || 'The assessment failed. Please try again.'}
        </p>
        <p className="muted">The intake is saved; nothing was lost.</p>
        {onRetry ? (
          <button type="button" className="primary-button" onClick={() => onRetry(matter.id)}>
            Run the assessment again
          </button>
        ) : null}
        <CardActions onClose={onClose} />
      </div>
    );
  }

  const assessment: Partial<Assessment> = matter.assessment || {};
  const popiaNotes = ensureStringArray(assessment.popiaNotes);

  return (
    <div className="panel assessment-panel">
      <p className="panel-kicker">Assessment</p>
      <h2>{assessment.matterType || matter.practiceArea || 'Matter triage'}</h2>
      <div className="assessment-meta">
        <span className={`chip chip-${String(assessment.urgency || 'medium')}`}>
          {assessment.urgency || 'medium'}
        </span>
        <span className="chip chip-neutral">{assessment.provider || 'rules'}</span>
        <span className="chip chip-neutral">{matter.clientLabel || 'Client A'}</span>
      </div>

      <p className="assessment-summary">
        {assessment.summary || matter.summary || 'The matter has not been assessed yet.'}
      </p>

      {assessment.strategy ? (
        // The strategy assessment replaces the generic triage lists.
        <StrategyAssessmentView assessment={assessment.strategy} />
      ) : (
        <>
          <Section title="Key facts" items={assessment.keyFacts} />
          <Section title="Attorney questions" items={assessment.attorneyQuestions} />
          <Section title="Recommended documents" items={assessment.recommendedDocuments} />
          <Section title="Compliance flags" items={assessment.complianceFlags} />
          <Section title="Next actions" items={assessment.nextActions} />
        </>
      )}

      <div className="assessment-footer">
        <div>
          <div className="mini-label">Confidence</div>
          <strong>{formatConfidence(assessment.confidence)}</strong>
        </div>
        <div>
          <div className="mini-label">Model</div>
          <strong>{assessment.model || 'offline-triage'}</strong>
        </div>
      </div>

      {popiaNotes.length ? (
        <div className="popia-callout">
          <div className="mini-label">POPIA notes</div>
          <ul>
            {popiaNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <CardActions
        onClose={onClose}
        onOpenMatter={matter.matterCase ? onOpenMatter : undefined}
        closeLabel="Done, close"
      />
    </div>
  );
}

function Section({ title, items }: { title: string; items: unknown }) {
  const list = ensureStringArray(items);
  if (!list.length) {
    return null;
  }

  return (
    <div className="assessment-section">
      <div className="mini-label">{title}</div>
      <ul>
        {list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function formatConfidence(confidence: unknown): string {
  if (typeof confidence !== 'number') {
    return 'n/a';
  }

  return `${Math.round(confidence * 100)}%`;
}

export default AssessmentCard;
