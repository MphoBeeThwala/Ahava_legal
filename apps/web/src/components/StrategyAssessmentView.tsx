import {
  PRACTICE_AREA_LABELS,
  type AuthorityReference,
  type AuthorityStatus,
  type CitedSource,
  type DeadlineAlert,
  type DefenceViability,
  type MeritItem,
  type StrategyAssessment,
} from '@ahava88/shared';

const VIABILITY: Record<DefenceViability, { label: string; chip: string }> = {
  high: { label: 'High viability', chip: 'chip-low' },
  moderate: { label: 'Moderate', chip: 'chip-high' },
  'high-risk': { label: 'High risk', chip: 'chip-critical' },
};

const DEADLINE: Record<DeadlineAlert['status'], { label: string; chip: string }> = {
  overdue: { label: 'Overdue', chip: 'chip-critical' },
  urgent: { label: 'Within 7 days', chip: 'chip-high' },
  upcoming: { label: 'Upcoming', chip: 'chip-medium' },
  unknown: { label: 'Date unknown', chip: 'chip-neutral' },
};

const AUTHORITY: Record<AuthorityStatus, { label: string; chip: string; title: string }> = {
  verified: {
    label: 'Verified',
    chip: 'chip-low',
    title: "Found in a passage from the firm's approved sources.",
  },
  curated: {
    label: 'Curated',
    chip: 'chip-high',
    title: "On the practice area's curated list; not found in the approved sources. Read it first.",
  },
  unverified: {
    label: 'Not verified',
    chip: 'chip-critical',
    title: 'Named by the model only. Check that it exists and says this before relying on it.',
  },
};

const KIND: Record<MeritItem['kind'], string> = {
  charge: 'Charge',
  claim: 'Claim',
  defence: 'Defence',
  transaction: 'Transaction',
  issue: 'Issue',
};

function longDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
}

/** The practice-area strategy assessment: one layout for every practice area. */
function StrategyAssessmentView({ assessment }: { assessment: StrategyAssessment }) {
  const sources = new Map(assessment.sources.map((source) => [source.ref, source]));
  const { factAudit, forumAndJurisdiction: forum, winningStrategyRoadmap: roadmap } = assessment;

  return (
    <div className="strategy-assessment">
      <div className="strategy-domains" aria-label="Practice areas">
        <span className="chip strategy-domain-primary">
          {PRACTICE_AREA_LABELS[assessment.practiceArea.primary]}
        </span>
        {assessment.practiceArea.secondary.map((area) => (
          <span key={area} className="chip chip-neutral">
            + {PRACTICE_AREA_LABELS[area]}
          </span>
        ))}
      </div>

      <Deadlines alerts={assessment.deadlinesAndPrescriptionAlerts} />

      <div className="strategy-warnings" role="note" aria-label="Tactical warnings">
        <div className="mini-label">Tactical warnings</div>
        <ul>
          {assessment.tacticalWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>

      <dl className="strategy-forum">
        <div>
          <dt className="mini-label">Forum</dt>
          <dd>{forum.forum}</dd>
        </div>
        {forum.jurisdiction ? (
          <div>
            <dt className="mini-label">Jurisdiction</dt>
            <dd>{forum.jurisdiction}</dd>
          </div>
        ) : null}
        <div>
          <dt className="mini-label">Burden of proof</dt>
          <dd>{forum.burdenOfProof}</dd>
        </div>
      </dl>

      {assessment.caseTheory ? (
        <div className="strategy-card">
          <div className="mini-label">Case theory</div>
          <p>{assessment.caseTheory}</p>
        </div>
      ) : null}

      {assessment.meritAndElementMatrix.length ? (
        <div className="strategy-ratings" aria-label="Merit ratings">
          {assessment.meritAndElementMatrix.map((item) => (
            <div key={item.item} className="strategy-rating">
              <span>{item.item}</span>
              <span className={`chip ${VIABILITY[item.viability].chip}`}>
                {VIABILITY[item.viability].label}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <h3 className="strategy-heading">Fact audit</h3>
      <div className="strategy-facts">
        <List title="Confirmed" items={factAudit.confirmedFacts} />
        <List title="Corroborate" items={factAudit.corroborationRequired} />
        <List title="Critical gaps" items={factAudit.criticalGaps} empty="None." />
      </div>

      <h3 className="strategy-heading">Merits, element by element</h3>
      {assessment.meritAndElementMatrix.map((item) => (
        <MeritCard key={item.item} item={item} />
      ))}

      <h3 className="strategy-heading">Phased strategy</h3>
      <ol className="strategy-phases">
        <Phase title="Immediate actions (0–72 hours)" items={roadmap.immediateActions_0_to_72h} />
        <Phase title="Settlement or ADR" items={roadmap.settlementOrADRPath} />
        <Phase title="Litigation or execution" items={roadmap.litigationOrExecutionBlueprint} />
      </ol>

      <Authorities items={assessment.precedentAndStatutoryAuthorities} sources={sources} />

      {assessment.removed.length || assessment.gaps.length ? (
        <details className="strategy-removed">
          <summary>
            Checks: {assessment.removed.length} item{assessment.removed.length === 1 ? '' : 's'}{' '}
            removed
            {assessment.gaps.length ? `, ${assessment.gaps.length} retrieval note(s)` : ''}
          </summary>
          <ul>
            {assessment.removed.map((item) => (
              <li key={`${item.reason}:${item.text}`}>
                <strong>{item.reason}.</strong> {item.text}
              </li>
            ))}
            {assessment.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="muted strategy-footnote">
        Strategy notes for the attorney, not advice to the client. Read every authority marked
        “Curated” or “Not verified” before relying on it. Model {assessment.model}.
      </p>
    </div>
  );
}

function Deadlines({ alerts }: { alerts: DeadlineAlert[] }) {
  if (!alerts.length) {
    return null;
  }
  return (
    <div className="strategy-deadlines" role="alert" aria-label="Deadlines and prescription">
      <div className="mini-label">Deadlines and prescription</div>
      <ul>
        {alerts.map((alert) => (
          <li key={`${alert.rule}:${alert.deadline}`} className={`deadline-${alert.status}`}>
            <span className={`chip ${DEADLINE[alert.status].chip}`}>
              {DEADLINE[alert.status].label}
            </span>{' '}
            <strong>{alert.deadline ? longDate(alert.deadline) : 'Check the date'}</strong>{' '}
            {alert.rule}
            <div className="muted strategy-deadline-detail">
              {alert.trigger}
              {alert.triggerDate ? ` (${longDate(alert.triggerDate)})` : ''}. {alert.authority}
              {alert.deadline && !alert.computed ? ' Date as given by the model: check it.' : ''}
              {alert.note ? ` ${alert.note}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeritCard({ item }: { item: MeritItem }) {
  const viability = VIABILITY[item.viability];
  return (
    <section className="strategy-card strategy-merit" aria-label={item.item}>
      <header className="strategy-merit-header">
        <span>
          <span className="mini-label">{KIND[item.kind]}</span> <strong>{item.item}</strong>
        </span>
        <span className={`chip ${viability.chip}`}>{viability.label}</span>
      </header>
      {item.viabilityReasoning ? <p className="muted">{item.viabilityReasoning}</p> : null}
      {item.elements.length ? (
        <div className="strategy-table-wrap">
          <table className="strategy-elements">
            <thead>
              <tr>
                <th scope="col">Element</th>
                <th scope="col">Burden</th>
                <th scope="col">Our version</th>
                <th scope="col">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {item.elements.map((element) => (
                <tr key={element.element}>
                  <th scope="row">{element.element}</th>
                  <td>{element.burden}</td>
                  <td>{element.ourVersion}</td>
                  <td>{element.assessment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <List
        title="Vulnerabilities: where the other side will attack"
        items={item.opposingAttackVectors}
      />
      <List title="Fallbacks and alternatives" items={item.fallbackAlternatives} />
    </section>
  );
}

function Authorities({
  items,
  sources,
}: {
  items: AuthorityReference[];
  sources: Map<string, CitedSource>;
}) {
  if (!items.length) {
    return null;
  }
  return (
    <>
      <h3 className="strategy-heading">Precedent and statutory authorities</h3>
      <ul className="strategy-authorities">
        {items.map((item) => {
          const status = AUTHORITY[item.status];
          return (
            <li key={`${item.authority}:${item.principle}`}>
              <span className={`chip ${status.chip}`} title={status.title}>
                {status.label}
              </span>{' '}
              <strong>{item.authority}</strong>
              {item.principle ? `: ${item.principle}` : ''}
              {item.appliesTo ? <span className="muted"> ({item.appliesTo})</span> : null}
              {item.sources.map((ref) => {
                const source = sources.get(ref);
                return source?.url ? (
                  <a key={ref} href={source.url} target="_blank" rel="noreferrer">
                    {' '}
                    [{ref}]
                  </a>
                ) : (
                  <span key={ref}> [{ref}]</span>
                );
              })}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Phase({ title, items }: { title: string; items: string[] }) {
  return (
    <li className="strategy-card strategy-phase">
      <strong>{title}</strong>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing suggested.</p>
      )}
    </li>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (!items.length && !empty) {
    return null;
  }
  return (
    <div className="assessment-section">
      <div className="mini-label">{title}</div>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </div>
  );
}

export default StrategyAssessmentView;
