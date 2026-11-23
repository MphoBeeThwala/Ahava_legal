// The TEMPORARY beta switches: sign-in without MFA (BETA_SKIP_MFA) and
// sign-up through a shared link (BETA_OPEN_SIGNUP + BETA_SIGNUP_CODE).
// With the switches off, nothing changes: MFA stays mandatory, no sign-up.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../server';
import { validateConfig } from '../config/env';
import { createFirm } from '../services/firm.service';
import { createStaff, sessionTokenFrom, STRONG_PASSWORD, type TestStaff } from './helpers';

const CODE = 'beta-link-code-123456';
let existing: TestStaff;

function setBeta(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function clearBeta() {
  setBeta({
    BETA_SKIP_MFA: undefined,
    BETA_OPEN_SIGNUP: undefined,
    BETA_SIGNUP_CODE: undefined,
    BETA_SIGNUP_ROLE: undefined,
  });
}

beforeAll(async () => {
  existing = await createStaff({ email: 'enrolled@example.com', role: 'attorney' });
});

afterEach(clearBeta);

describe('switches off (the default)', () => {
  test('password sign-in still asks for the authenticator code', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: existing.email, password: existing.password });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('mfa_required');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('beta sign-up answers 404, even with the right code', async () => {
    const res = await request(app).post('/api/auth/beta-signup').send({
      code: CODE,
      email: 'new@example.com',
      fullName: 'New Person',
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(404);
  });

  test('config reports both switches off', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.body.beta).toEqual({ mfaSkipped: false, openSignup: false });
  });

  test('open sign-up without a long enough code stays off', async () => {
    setBeta({ BETA_OPEN_SIGNUP: 'true', BETA_SIGNUP_CODE: 'short' });
    const res = await request(app).get('/api/auth/config');
    expect(res.body.beta.openSignup).toBe(false);
  });
});

describe('BETA_SKIP_MFA', () => {
  test('password sign-in issues a session straight away', async () => {
    setBeta({ BETA_SKIP_MFA: 'true' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: existing.email, password: existing.password });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('signed_in');
    const me = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${sessionTokenFrom(res)}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(existing.email);
  });

  test('a wrong password is still refused', async () => {
    setBeta({ BETA_SKIP_MFA: 'true' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: existing.email, password: 'Wrong-password-1' });
    expect(res.status).toBe(401);
  });
});

describe('BETA_OPEN_SIGNUP', () => {
  const signUp = (body: Record<string, string>, host?: string) => {
    const req = request(app).post('/api/auth/beta-signup');
    return (host ? req.set('Host', host) : req).send(body);
  };

  test('with the right code and MFA skipped, the account is signed in at once', async () => {
    setBeta({ BETA_OPEN_SIGNUP: 'true', BETA_SIGNUP_CODE: CODE, BETA_SKIP_MFA: 'true' });
    const res = await signUp({
      code: CODE,
      email: 'Tester@Example.com',
      fullName: 'Beta Tester',
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('signed_in');
    expect(res.body.user).toMatchObject({ email: 'tester@example.com', role: 'attorney' });

    const again = await request(app)
      .post('/api/auth/login')
      .send({ email: 'tester@example.com', password: STRONG_PASSWORD });
    expect(again.body.status).toBe('signed_in');
  });

  test('with MFA on, a new account goes to authenticator set-up', async () => {
    setBeta({ BETA_OPEN_SIGNUP: 'true', BETA_SIGNUP_CODE: CODE });
    const res = await signUp({
      code: CODE,
      email: 'tester2@example.com',
      fullName: 'Second Tester',
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('mfa_enrollment_required');
  });

  test('a wrong code, a duplicate email and a weak password are refused', async () => {
    setBeta({ BETA_OPEN_SIGNUP: 'true', BETA_SIGNUP_CODE: CODE });
    const wrong = await signUp({
      code: 'not-the-code-at-all',
      email: 'x@example.com',
      fullName: 'X',
      password: STRONG_PASSWORD,
    });
    expect(wrong.status).toBe(403);
    const duplicate = await signUp({
      code: CODE,
      email: existing.email,
      fullName: 'X',
      password: STRONG_PASSWORD,
    });
    expect(duplicate.status).toBe(409);
    const weak = await signUp({
      code: CODE,
      email: 'weak@example.com',
      fullName: 'X',
      password: 'short',
    });
    expect(weak.status).toBe(400);
  });

  test('BETA_SIGNUP_ROLE sets the role; support is never allowed', async () => {
    setBeta({ BETA_OPEN_SIGNUP: 'true', BETA_SIGNUP_CODE: CODE, BETA_SKIP_MFA: 'true' });
    setBeta({ BETA_SIGNUP_ROLE: 'admin' });
    const admin = await signUp({
      code: CODE,
      email: 'beta-admin@example.com',
      fullName: 'A',
      password: STRONG_PASSWORD,
    });
    expect(admin.body.user.role).toBe('admin');
    setBeta({ BETA_SIGNUP_ROLE: 'support' });
    const support = await signUp({
      code: CODE,
      email: 'beta-support@example.com',
      fullName: 'S',
      password: STRONG_PASSWORD,
    });
    expect(support.body.user.role).toBe('attorney');
  });

  test('an account signed up on one firm does not exist in another', async () => {
    setBeta({ BETA_OPEN_SIGNUP: 'true', BETA_SIGNUP_CODE: CODE, BETA_SKIP_MFA: 'true' });
    const host = 'beta-other.example.test';
    await createFirm({ slug: 'beta-other', legalName: 'Other', domains: [host] });
    const res = await signUp(
      { code: CODE, email: 'other@example.com', fullName: 'O', password: STRONG_PASSWORD },
      host,
    );
    expect(res.status).toBe(201);
    const elsewhere = await request(app)
      .post('/api/auth/login')
      .send({ email: 'other@example.com', password: STRONG_PASSWORD });
    expect(elsewhere.status).toBe(401);
  });
});

describe('production config check', () => {
  test('open sign-up without a code refuses to boot', () => {
    const problems = validateConfig({
      NODE_ENV: 'production',
      BETA_OPEN_SIGNUP: 'true',
    } as NodeJS.ProcessEnv);
    expect(problems).toContain(
      'BETA_OPEN_SIGNUP=true needs BETA_SIGNUP_CODE of at least 12 characters',
    );
  });
});
