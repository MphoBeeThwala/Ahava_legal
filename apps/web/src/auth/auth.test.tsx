import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import type { AuthConfig, PublicUser } from '@ahava88/shared';
import { api } from '../api';
import SignIn, { signInErrorMessage } from './SignIn';
import MfaSetup from './MfaSetup';
import InviteAccept from './InviteAccept';
import BetaSignUp from './BetaSignUp';

const config: AuthConfig = {
  passwordLogin: true,
  oidc: { enabled: true, label: 'Sign in with Microsoft' },
  microsoft: { enabled: false, label: '', enforced: false },
  beta: { mfaSkipped: false, openSignup: false },
  selfServiceReset: true,
};

const user = { id: 'u1', fullName: 'Ada', email: 'ada@example.com', role: 'admin' } as PublicUser;

afterEach(() => {
  vi.restoreAllMocks();
});

test('password sign-in continues to the authenticator code, then signs in', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValueOnce({ data: { status: 'mfa_required', challengeToken: 'challenge' } })
    .mockResolvedValueOnce({ data: { status: 'signed_in', user } });
  const onSignedIn = vi.fn();
  render(<SignIn config={config} onSignedIn={onSignedIn} onNotice={vi.fn()} />);

  expect(screen.getByRole('link', { name: 'Sign in with Microsoft' })).toHaveAttribute(
    'href',
    '/api/auth/oidc/start',
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secret-password-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  const code = await screen.findByLabelText(/6-digit code/);
  fireEvent.change(code, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(user));
  expect(post).toHaveBeenLastCalledWith('/auth/mfa/verify', {
    challengeToken: 'challenge',
    code: '123456',
  });
});

test('MFA set-up shows recovery codes and waits until they are saved', async () => {
  vi.spyOn(api, 'post')
    .mockResolvedValueOnce({
      data: {
        secret: 'ABCDEFGH',
        otpauthUrl: 'otpauth://totp/x',
        qrCodeDataUrl: 'data:image/svg+xml;base64,',
      },
    })
    .mockResolvedValueOnce({ data: { user, recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'] } });
  const onDone = vi.fn();
  render(<MfaSetup challengeToken="t" onDone={onDone} onError={vi.fn()} />);

  expect(await screen.findByAltText(/QR code/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  expect(await screen.findByText('aaaaa-bbbbb')).toBeInTheDocument();
  const open = screen.getByRole('button', { name: 'Open the workspace' });
  expect(open).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I have saved my recovery codes/));
  fireEvent.click(open);
  expect(onDone).toHaveBeenCalledWith(user);
});

test('an invitation offers Microsoft sign-in with the invite attached', async () => {
  vi.spyOn(api, 'get').mockResolvedValueOnce({
    data: {
      email: 'new@example.com',
      fullName: 'New Person',
      role: 'paralegal',
      firmName: 'Nkosi & Partners Inc.',
      expiresAt: '2030-01-01T00:00:00Z',
    },
  });
  render(<InviteAccept token="tok/en" config={config} onSignedIn={vi.fn()} onNotice={vi.fn()} />);
  expect(
    await screen.findByRole('heading', { name: 'Join Nkosi & Partners Inc.' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Paralegal')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in with Microsoft' })).toHaveAttribute(
    'href',
    '/api/auth/oidc/start?invite=tok%2Fen',
  );
});

test('Entra sign-in errors map to plain messages', () => {
  expect(signInErrorMessage('not_invited')).toMatch(/not linked/);
  expect(signInErrorMessage('something_else')).toMatch(/did not complete/);
  expect(signInErrorMessage(null)).toBeNull();
});

test('beta sign-up link creates the account and signs in when MFA is skipped', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { status: 'signed_in', user } });
  const onSignedIn = vi.fn();
  const beta = { ...config, beta: { mfaSkipped: true, openSignup: true } };
  render(<BetaSignUp config={beta} code="the-code" onSignedIn={onSignedIn} onNotice={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Secret-password-1' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'Secret-password-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(user));
  expect(post).toHaveBeenCalledWith('/auth/beta-signup', {
    code: 'the-code',
    email: 'ada@example.com',
    fullName: 'Ada',
    password: 'Secret-password-1',
  });
});

test('beta sign-up page says sign-up is closed when the switch is off', () => {
  render(<BetaSignUp config={config} code="the-code" onSignedIn={vi.fn()} onNotice={vi.fn()} />);
  expect(screen.getByText(/Sign-up is not open/)).toBeInTheDocument();
});
