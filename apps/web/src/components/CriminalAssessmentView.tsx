import type {
  AuthorityReference,
  CitedSource,
  CountAssessment,
  CriminalAssessment,
  DefenceViability,
} from '@ahava88/shared';

const VIABILITY: Record<DefenceViability, { label: string; chip: string }> = {
  high: { label: 'High viability', chip: 'chip-low' },
  moderate: { label: 'Moderate', chip: 'chip-high' },
  'high-risk': { label: 'High risk', chip: 'chip-critical' },
};

/** The count-by-count merit assessment for a criminal matter. */
function CriminalAssessmentView({ assessment }: { assessment: CriminalAssessment }) {
  const sources = new Map(assessment.sources.map((source) => [source.ref, source]));
  const { factAudit, strategy } = assessment;

  return (
    <div className="criminal-assessment">
      <div className="criminal-theory">
        <div className="mini-label">Case theory</div>
        <p>{assessment.caseTheory || 'No case theory was given.'}</p>
      </div>

      <div className="criminal-warnings" role="note" aria-label="Tactical warnings">
        <div className="mini-label">Tactical warnings</div>
        <ul>
          {assessment.tacticalWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>

      <div className="criminal-ratings" aria-label="Merit ratings">
        {assessment.counts.map((count) => (
          <div key={count.count} className="criminal-rating">
            <span className="criminal-rating-count">{count.count}</span>
            <span className={`chip ${VIABILITY[count.viability].chip}`}>
              {VIABILITY[count.viability].label}
            </span>
          </div>
        ))}
      </div>

      <h3 className="criminal-heading">Fact audit</h3>
      <div className="criminal-facts">
        <List title="Confirmed" items={factAudit.confirmed} />
        <List title="Corroborate" items={factAudit.corroborationNeeded} />
        <List title="Critical unknowns" items={factAudit.criticalUnknowns} empty="None." />
      </div>

      <h3 className="criminal-heading">Counts</h3>
      {assessment.counts.map((count) => (
        <CountCard key={count.count} count={count} sources={sources} />
      ))}

      {assessment.proceduralIssues.length ? (
        <>
          <h3 className="criminal-heading">Constitutional and procedural issues</h3>
          {assessment.proceduralIssues.map((issue) => (
            <div key={issue.issue} className="criminal-issue">
              <strong>{issue.issue}</strong>
              <p>{issue.analysis}</p>
              <Authorities items={issue.authorities} sources={sources} />
            </div>
          ))}
        </>
      ) : null}

      <h3 className="criminal-heading">Phased strategy</h3>
      <ol className="criminal-phases">
        <Phase title="Immediate preservation (0–72 hours)" items={strategy.immediatePreservation} />
        <Phase title="Witnesses and bail conditions" items={strategy.witnessProtocol} />
        <Phase title="Path A: acquittal or s 174 discharge" items={strategy.trialBlueprint} />
        <Phase
          title="Path B: representations and resolution"
          items={strategy.representationsStrategy}
        />
      </ol>

      {assessment.removed.length || assessment.gaps.length ? (
        <details className="criminal-removed">
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

      <p className="muted criminal-footnote">
        Strategy notes for the attorney, not advice to the client. Authorities marked “not verified”
        were not found in the firm’s approved sources: read them before relying on them. Model{' '}
        {assessment.model}.
      </p>
    </div>
  );
}

function CountCard({
  count,
  sources,
}: {
  count: CountAssessment;
  sources: Map<string, CitedSource>;
}) {
  const viability = VIABILITY[count.viability];
  return (
    <section className="criminal-count" aria-label={count.count}>
      <header className="criminal-count-header">
        <strong>{count.count}</strong>
        <span className={`chip ${viability.chip}`}>{viability.label}</span>
      </header>
      <p>
        <span className="mini-label">Primary defence</span> {count.primaryDefence}
      </p>
      {count.viabilityReasoning ? <p className="muted">{count.viabilityReasoning}</p> : null}

      {count.elements.length ? (
        <table className="criminal-elements">
          <thead>
            <tr>
              <th scope="col">Element</th>
              <th scope="col">State must prove</th>
              <th scope="col">Client’s version</th>
              <th scope="col">Assessment</th>
            </tr>
          </thead>
          <tbody>
            {count.elements.map((element) => (
              <tr key={element.element}>
                <th scope="row">{element.element}</th>
                <td>{element.stateBurden}</td>
                <td>{element.clientVersion}</td>
                <td>{element.assessment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <List title="Vulnerabilities: where the State will attack" items={count.prosecutionAttacks} />
      <List title="Competent verdicts and fallbacks" items={count.competentVerdicts} />
      {count.sentencing ? (
        <p>
          <span className="mini-label">Sentencing exposure</span> {count.sentencing}
        </p>
      ) : null}
      <Authorities items={count.authorities} sources={sources} />
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
    <div className="assessment-section">
      <div className="mini-label">Precedent and statutory authorities</div>
      <ul className="criminal-authorities">
        {items.map((item) => (
          <li key={`${item.authority}:${item.principle}`}>
            <span className={`chip ${item.verified ? 'chip-low' : 'chip-high'}`}>
              {item.verified ? 'Verified' : 'Not verified'}
            </span>{' '}
            <strong>{item.authority}</strong>
            {item.principle ? `: ${item.principle}` : ''}
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
        ))}
      </ul>
    </div>
  );
}

function Phase({ title, items }: { title: string; items: string[] }) {
  return (
    <li className="criminal-phase">
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

export default CriminalAssessmentView;
