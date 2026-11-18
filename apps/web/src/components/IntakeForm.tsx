import { useRef, useState, type FormEvent } from 'react';
import type { IntakeSubmissionInput } from '@ahava88/shared';
import Field from './Field';
import type { Notice } from './DismissibleNotice';

type IntakeFormState = Required<Omit<IntakeSubmissionInput, 'allowDuplicate'>>;

const defaultState: IntakeFormState = {
  fullName: '',
  email: '',
  phone: '',
  practiceArea: 'Family Law',
  jurisdiction: 'Gauteng Division, Johannesburg',
  urgencyHint: 'medium',
  matterSummary: '',
  requestedOutcome: '',
  documentsMentioned: '',
  chargeSheet: '',
  preferredLanguage: 'English',
  // Consent is asked for during the interview and recorded as given, never assumed.
  consentToStorage: false,
  consentToAi: false,
};

interface IntakeFormProps {
  onSubmit: (payload: IntakeSubmissionInput) => Promise<boolean>;
  /** Called when the user starts typing a new intake (clears the last assessment). */
  onEdit?: () => void;
  busy: boolean;
  sampleMatter?: Partial<IntakeSubmissionInput>;
  onGoToCases?: () => void;
}

function IntakeForm({ onSubmit, onEdit, busy, sampleMatter, onGoToCases }: IntakeFormProps) {
  const [form, setForm] = useState<IntakeFormState>(defaultState);
  const [status, setStatus] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const updateField = <K extends keyof IntakeFormState>(name: K, value: IntakeFormState[K]) => {
    onEdit?.();
    setForm((current) => ({ ...current, [name]: value }));
  };

  const loadSample = () => {
    onEdit?.();
    setForm({ ...defaultState, ...sampleMatter });
    setStatus({
      tone: 'info',
      message: 'Sample matter loaded. Review the redaction note before sending.',
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || submitting || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const success = await onSubmit(form);
      if (success) {
        const withAi = form.consentToAi;
        setForm(defaultState);
        setStatus({
          tone: 'success',
          message: withAi
            ? 'Encrypted intake submitted. The assessment is running and appears alongside when it is ready.'
            : 'Encrypted intake submitted. Not assessed by AI: the client did not consent.',
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const isDisabled = busy || submitting;

  return (
    <form className="intake-form" onSubmit={handleSubmit} noValidate={false}>
      <div className="grid-2">
        <Field label="Client name" id="intake-fullName">
          <input
            id="intake-fullName"
            name="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(event) => updateField('fullName', event.target.value)}
            placeholder="Thandi Nkosi"
            required
            disabled={isDisabled}
          />
        </Field>
        <Field label="Email" id="intake-email">
          <input
            id="intake-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="client@example.com"
            required
            disabled={isDisabled}
          />
        </Field>
        <Field label="Phone" id="intake-phone">
          <input
            id="intake-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            placeholder="+27821234567"
            required
            disabled={isDisabled}
          />
        </Field>
        <Field label="Practice area" id="intake-practiceArea">
          <select
            id="intake-practiceArea"
            name="practiceArea"
            value={form.practiceArea}
            onChange={(event) => updateField('practiceArea', event.target.value)}
            disabled={isDisabled}
          >
            <option>Family Law</option>
            <option>Labour Law</option>
            <option>Conveyancing</option>
            <option>Commercial</option>
            <option>Estate Administration</option>
            <option>Criminal Defence</option>
          </select>
        </Field>
        <Field label="Jurisdiction" id="intake-jurisdiction">
          <input
            id="intake-jurisdiction"
            name="jurisdiction"
            value={form.jurisdiction}
            onChange={(event) => updateField('jurisdiction', event.target.value)}
            placeholder="Gauteng Division, Johannesburg"
            disabled={isDisabled}
          />
        </Field>
        <Field label="Urgency" id="intake-urgency">
          <select
            id="intake-urgency"
            name="urgencyHint"
            value={form.urgencyHint}
            onChange={(event) => updateField('urgencyHint', event.target.value)}
            disabled={isDisabled}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>

      <Field
        label="Matter summary"
        id="intake-matterSummary"
        hint="Do not paste ID numbers, bank details, or unnecessary personal data into this box."
      >
        <textarea
          id="intake-matterSummary"
          name="matterSummary"
          rows={6}
          value={form.matterSummary}
          onChange={(event) => updateField('matterSummary', event.target.value)}
          placeholder="Describe the dispute, deadlines, and what outcome the client wants."
          required
          disabled={isDisabled}
        />
      </Field>

      <Field label="Requested outcome" id="intake-requestedOutcome">
        <input
          id="intake-requestedOutcome"
          name="requestedOutcome"
          value={form.requestedOutcome}
          onChange={(event) => updateField('requestedOutcome', event.target.value)}
          placeholder="Urgent interdict, settlement draft, summons, estate guidance..."
          disabled={isDisabled}
        />
      </Field>

      {/criminal/i.test(form.practiceArea) ? (
        <Field
          label="Charge sheet (J15)"
          id="intake-chargeSheet"
          hint="Type or paste the counts as charged, the court, the case number and the remand and bail details. Names are removed before anything is sent to AI."
        >
          <textarea
            id="intake-chargeSheet"
            name="chargeSheet"
            rows={5}
            value={form.chargeSheet}
            onChange={(event) => updateField('chargeSheet', event.target.value)}
            placeholder="Count 1: Assault with intent to do grievous bodily harm (s 1 ...). Court: ... Next date: ..."
            disabled={isDisabled}
          />
        </Field>
      ) : null}

      <div className="grid-2">
        <Field label="Documents mentioned" id="intake-documents">
          <textarea
            id="intake-documents"
            name="documentsMentioned"
            rows={4}
            value={form.documentsMentioned}
            onChange={(event) => updateField('documentsMentioned', event.target.value)}
            placeholder="Notices, contracts, WhatsApp messages, court papers..."
            disabled={isDisabled}
          />
        </Field>
        <Field label="Preferred language" id="intake-language">
          <select
            id="intake-language"
            name="preferredLanguage"
            value={form.preferredLanguage}
            onChange={(event) => updateField('preferredLanguage', event.target.value)}
            disabled={isDisabled}
          >
            <option>English</option>
            <option>isiZulu</option>
            <option>isiXhosa</option>
            <option>Sesotho</option>
            <option>Afrikaans</option>
          </select>
        </Field>
      </div>

      <fieldset className="consent-stack">
        <legend className="field-label">Client consent (ask during the interview)</legend>
        <label className="consent-row" htmlFor="intake-consent-storage">
          <input
            id="intake-consent-storage"
            type="checkbox"
            checked={form.consentToStorage}
            onChange={(event) => updateField('consentToStorage', event.target.checked)}
            disabled={isDisabled}
            required
          />
          <span>
            The client consents to the firm keeping their information securely (encrypted) for this
            matter. <em>Required.</em>
          </span>
        </label>
        <label className="consent-row" htmlFor="intake-consent-ai">
          <input
            id="intake-consent-ai"
            type="checkbox"
            checked={form.consentToAi}
            onChange={(event) => updateField('consentToAi', event.target.checked)}
            disabled={isDisabled}
          />
          <span>
            The client was told that, to assess and research their matter, the firm uses AI and
            other technology within the law and applicable guidelines, with their personal details
            removed first, and consents to this.
          </span>
        </label>
        <p className="field-hint">
          If the client does not consent to AI, leave it unticked: the intake is still taken and
          marked &ldquo;Not assessed by AI&rdquo;, and AI research stays off for the matter.
        </p>
      </fieldset>

      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          onClick={loadSample}
          disabled={isDisabled}
        >
          Load sample matter
        </button>
        <button type="submit" className="primary-button" disabled={isDisabled}>
          {isDisabled ? 'Processing...' : 'Submit and assess'}
        </button>
      </div>

      {status ? (
        <div className={`inline-status inline-${status.tone}`} role="status">
          {status.message}
          {status.tone === 'success' && onGoToCases ? (
            <>
              {' '}
              <button type="button" className="link-button" onClick={onGoToCases}>
                View cases
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export default IntakeForm;
