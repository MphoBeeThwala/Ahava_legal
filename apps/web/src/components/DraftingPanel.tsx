import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  hasPermission,
  type Draft,
  type DraftField,
  type DraftingCatalogue,
  type DraftingCategory,
  type PublicUser,
} from '@ahava88/shared';
import { api, apiErrorMessage } from '../api';

interface DraftingPanelProps {
  caseId: string | null;
  currentUser: PublicUser;
}

const STATUS_LABEL: Record<Draft['status'], string> = {
  draft: 'Draft',
  review: 'Awaiting review',
  final: 'Final',
};

const SEVERITY_LABEL = { must: 'Must fix', should: 'Should fix', note: 'Note' } as const;

/**
 * Drafting from the standard templates: pick a document kind, fill in the
 * facts (most come from the matter), fix what the checks flag, then submit
 * for review; an attorney finalises it onto the matter.
 */
function DraftingPanel({ caseId, currentUser }: DraftingPanelProps) {
  const canApprove = hasPermission(currentUser.role, 'drafting.approve');
  const [catalogue, setCatalogue] = useState<DraftingCatalogue | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [kindId, setKindId] = useState('');
  const [open, setOpen] = useState<Draft | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The finalising attorney confirms they checked this document for the matter.
  const [checked, setChecked] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    api
      .get<DraftingCatalogue>('/drafting/catalogue')
      .then(({ data }) => setCatalogue(data))
      .catch((err) =>
        setError(apiErrorMessage(err, 'The document catalogue could not be loaded.')),
      );
  }, []);

  const loadDrafts = useCallback(async () => {
    if (!caseId) {
      setDrafts([]);
      return;
    }
    const { data } = await api.get<Draft[]>(`/cases/${caseId}/drafts`);
    setDrafts(data);
  }, [caseId]);

  useEffect(() => {
    setOpen(null);
    loadDrafts().catch((err) => setError(apiErrorMessage(err, 'Drafts could not be loaded.')));
  }, [loadDrafts]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  const show = (draft: Draft) => {
    setOpen(draft);
    setValues(draft.values);
    setDirty(false);
  };

  const template = useMemo(
    () => catalogue?.templates.find((item) => item.id === open?.templateId) ?? null,
    [catalogue, open],
  );
  const kind = catalogue?.kinds.find((item) => item.id === kindId) ?? null;
  const kindTemplate = catalogue?.templates.find((item) => item.id === kindId) ?? null;
  const byCategory = useMemo(() => {
    const groups = new Map<DraftingCategory, DraftingCatalogue['kinds']>();
    for (const item of catalogue?.kinds ?? []) {
      groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    }
    return groups;
  }, [catalogue]);

  const start = () =>
    run(async () => {
      if (!caseId || !kindId) return;
      const { data } = await api.post<Draft>(`/cases/${caseId}/drafts`, { templateId: kindId });
      await loadDrafts();
      show(data);
    });

  const save = () =>
    run(async () => {
      if (!caseId || !open) return;
      const { data } = await api.put<Draft>(`/cases/${caseId}/drafts/${open.id}`, { values });
      show(data);
      await loadDrafts();
    });

  const act = (path: 'submit' | 'finalise') =>
    run(async () => {
      if (!caseId || !open) return;
      if (dirty) {
        await api.put(`/cases/${caseId}/drafts/${open.id}`, { values });
      }
      const { data } = await api.post<Draft>(
        `/cases/${caseId}/drafts/${open.id}/${path}`,
        path === 'finalise' ? { checked: true } : {},
      );
      setChecked(false);
      show(data);
      await loadDrafts();
    });

  const remove = () =>
    run(async () => {
      if (!caseId || !open) return;
      await api.delete(`/cases/${caseId}/drafts/${open.id}`);
      setOpen(null);
      await loadDrafts();
    });

  if (!caseId) {
    return (
      <section className="panel drafting-panel">
        <p className="panel-kicker">Drafting</p>
        <h2>Draft a document</h2>
        <p className="field-hint">Open a matter above to draft documents for it.</p>
      </section>
    );
  }

  const readOnly = open?.status === 'final';
  const must = open?.issues.filter((issue) => issue.severity === 'must').length ?? 0;
  const input = (field: DraftField) => {
    const common = {
      id: `draft-${field.key}`,
      value: values[field.key] ?? '',
      disabled: readOnly || busy,
      ref: (node: HTMLElement | null) => {
        fieldRefs.current[field.key] = node;
      },
      onChange: (event: { target: { value: string } }) => {
        setValues((current) => ({ ...current, [field.key]: event.target.value }));
        setDirty(true);
      },
    };
    if (field.type === 'longtext') return <textarea rows={4} {...common} />;
    if (field.type === 'choice') {
      return (
        <select {...common}>
          <option value="">Choose…</option>
          {field.choices?.map((choice) => (
            <option key={choice}>{choice}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={field.type === 'date' ? 'date' : 'text'}
        inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined}
        {...common}
      />
    );
  };

  return (
    <section className="panel drafting-panel" aria-label="Drafting">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Drafting</p>
          <h2>Draft a document</h2>
        </div>
      </div>
      {error ? (
        <p className="inline-status inline-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="drafting-start">
        <label htmlFor="draft-kind">
          Document
          <select
            id="draft-kind"
            value={kindId}
            onChange={(event) => setKindId(event.target.value)}
          >
            <option value="">
              Choose a document ({catalogue?.templates.length ?? 0} of{' '}
              {catalogue?.kinds.length ?? 0} ready to draft)…
            </option>
            {[...byCategory.entries()].map(([category, kinds]) => (
              <optgroup key={category} label={catalogue?.categories[category]}>
                {kinds.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.availability === 'template' ? '' : ' (template coming)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="primary-button"
          disabled={busy || kind?.availability !== 'template'}
          onClick={start}
        >
          Start draft
        </button>
      </div>
      {kind ? (
        <div className="drafting-kind">
          <p>
            <strong>{kind.name}</strong>{' '}
            <span
              className={`status-pill ${kind.availability === 'template' ? 'status-active' : 'status-past_due'}`}
            >
              {kind.availability === 'template' ? 'Ready to draft' : 'Template coming'}
            </span>
          </p>
          <p>{kind.purpose}</p>
          <p className="field-hint">
            <strong>Used in:</strong> {kind.forum}
          </p>
          <p className="field-hint">
            <strong>Legal basis:</strong> {kind.basis.join('; ')}
          </p>
          {kindTemplate?.review.status === 'reviewed' ? (
            <p className="field-hint">
              <strong>Standard wording approved</strong> by {kindTemplate.review.by}
              {kindTemplate.review.on ? ` on ${kindTemplate.review.on}` : ''}. The drafting attorney
              checks grammar, wording and inputs for each matter.
            </p>
          ) : kindTemplate ? (
            <p className="field-hint">
              The standard wording of this template has not yet been reviewed by an admitted
              attorney.
            </p>
          ) : null}
          {kind.availability !== 'template' ? (
            <p className="field-hint">
              The standard template for this document has not been written yet. It is listed so you
              can see what it is for and what it must comply with.
            </p>
          ) : null}
        </div>
      ) : null}

      {drafts.length ? (
        <ul className="drafting-list">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <button
                type="button"
                className={`mini-item list-button ${open?.id === draft.id ? 'drafting-open' : ''}`}
                onClick={() => show(draft)}
              >
                <strong>{draft.title}</strong>
                <span
                  className={`status-pill status-${draft.status === 'final' ? 'active' : draft.status === 'review' ? 'past_due' : 'trialing'}`}
                >
                  {STATUS_LABEL[draft.status]}
                </span>
                <span className="muted">{new Date(draft.updatedAt).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">No drafts on this matter yet.</p>
      )}

      {open && template ? (
        <div className="drafting-editor">
          <div className="drafting-form">
            <h3>
              {open.title} <span className="muted">· template {open.templateVersion}</span>
            </h3>
            {open.issues.length ? (
              <ul className="drafting-issues" aria-label="Checks">
                {open.issues.map((issue, index) => (
                  <li key={index} className={`drafting-issue drafting-issue-${issue.severity}`}>
                    <strong>{SEVERITY_LABEL[issue.severity]}</strong>{' '}
                    {issue.field ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => fieldRefs.current[issue.field!]?.focus()}
                      >
                        {issue.message}
                      </button>
                    ) : (
                      issue.message
                    )}
                    {issue.basis ? <span className="drafting-basis"> {issue.basis}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {template.sections.map((section) => (
              <fieldset key={section.key} className="drafting-section">
                <legend>{section.title}</legend>
                {section.fields.map((field) => (
                  <div key={field.key} className="field">
                    <label className="field-label" htmlFor={`draft-${field.key}`}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {input(field)}
                    {field.help ? <span className="field-hint">{field.help}</span> : null}
                  </div>
                ))}
              </fieldset>
            ))}
            <div className="action-row">
              {!readOnly ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || !dirty}
                  onClick={save}
                >
                  Save and check
                </button>
              ) : null}
              {open.status === 'draft' ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() => act('submit')}
                >
                  Submit for review
                </button>
              ) : null}
              {open.status === 'review' && canApprove ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  I have checked the grammar, wording and every input for this matter.
                </label>
              ) : null}
              {open.status === 'review' && canApprove ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || must > 0 || dirty || !checked}
                  title={
                    must
                      ? 'Fix the “must fix” items first'
                      : !checked
                        ? 'Confirm that you have checked the document first'
                        : undefined
                  }
                  onClick={() => act('finalise')}
                >
                  Finalise to matter
                </button>
              ) : null}
              {open.status === 'review' && !canApprove ? (
                <span className="field-hint">An attorney finalises this document.</span>
              ) : null}
              {!readOnly ? (
                <button type="button" className="link-button" disabled={busy} onClick={remove}>
                  Delete draft
                </button>
              ) : null}
            </div>
          </div>
          <div className="drafting-preview">
            <div className="drafting-preview-head">
              <strong>Preview</strong>
              <a
                className="secondary-button"
                href={`/api/cases/${caseId}/drafts/${open.id}/file?format=docx`}
              >
                Word
              </a>
              <a
                className="secondary-button"
                href={`/api/cases/${caseId}/drafts/${open.id}/file?format=pdf`}
              >
                PDF
              </a>
            </div>
            {dirty ? (
              <p className="field-hint">Unsaved changes: save to update the preview and checks.</p>
            ) : null}
            <pre className="drafting-page">{open.preview}</pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default DraftingPanel;
