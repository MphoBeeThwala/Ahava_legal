// TEMPORARY beta sign-up through a shared link (/signup?code=...). Shown only
// while the API's BETA_OPEN_SIGNUP switch is on; see betaSettings() in the API.
import { useState, type FormEvent } from 'react';
import type { AuthConfig, BetaSignupRequest, PublicUser, SignInResult } from '@ahava88/shared';
import { api, apiErrorMessage } from '../api';
import Field from '../components/Field';
import MfaSetup from './MfaSetup';

interface BetaSignUpProps {
  config: AuthConfig;
  code: string;
  onSignedIn: (user: PublicUser) => void;
  onNotice: (tone: 'info' | 'success' | 'warn' | 'error', message: string) => void;
}

function BetaSignUp({ config, code, onSignedIn, onNotice }: BetaSignUpProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  if (!config.beta.openSignup || !code) {
    return (
      <p>
        Sign-up is not open. Use the link you were sent, or ask for an invitation, then{' '}
        <a href="/">sign in</a>.
      </p>
    );
  }

  if (challengeToken) {
    return (
      <MfaSetup
        challengeToken={challengeToken}
        onDone={onSignedIn}
        onError={(message) => onNotice('error', message)}
      />
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      onNotice('error', 'The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const body: BetaSignupRequest = { code, email, fullName, password };
      const { data } = await api.post<SignInResult>('/auth/beta-signup', body);
      if (data.status === 'signed_in') {
        onSignedIn(data.user);
      } else if (data.status === 'mfa_enrollment_required') {
        setChallengeToken(data.challengeToken);
      }
    } catch (error) {
      onNotice('error', apiErrorMessage(error, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sign-in">
      <h2>Create your beta account</h2>
      <p className="field-hint">
        This is a test version. Please use made-up matters and clients only, never real client
        information.
      </p>
      <form className="auth-form" onSubmit={submit}>
        <Field label="Full name" id="signup-name">
          <input
            id="signup-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Email" id="signup-email">
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        <Field
          label="Password"
          id="signup-password"
          hint="At least 12 characters, with upper-case, lower-case and a number."
        >
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            required
          />
        </Field>
        <Field label="Confirm password" id="signup-confirm">
          <input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </Field>
        <div className="action-row">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create my account'}
          </button>
          <a className="secondary-button" href="/">
            I already have an account
          </a>
        </div>
      </form>
    </div>
  );
}

export default BetaSignUp;
