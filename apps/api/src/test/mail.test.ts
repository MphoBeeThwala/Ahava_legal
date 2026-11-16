// Outgoing mail: SMTP2GO's HTTPS API transport, and invites that still hand
// over their link when the mail transport fails.
import { beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../server';
import {
  failNextMailForTests,
  sendViaSmtp2go,
  smtp2goRequestBody,
  type MailEnvelope,
} from '../services/mail.service';
import { createStaff, type TestStaff } from './helpers';

const envelope: MailEnvelope = {
  from: '"Test Firm Inc." <no-reply@example.com>',
  replyTo: 'office@example.com',
  to: 'client@example.com',
  subject: 'Invoice INV-0001',
  text: 'Please find the invoice attached.',
  attachments: [
    { filename: 'INV-0001.pdf', content: Buffer.from('%PDF-1.7'), contentType: 'application/pdf' },
  ],
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('SMTP2GO API transport', () => {
  test('builds the send request: sender, recipient, Reply-To and base64 attachments', () => {
    expect(smtp2goRequestBody(envelope)).toEqual({
      sender: '"Test Firm Inc." <no-reply@example.com>',
      to: ['client@example.com'],
      subject: 'Invoice INV-0001',
      text_body: 'Please find the invoice attached.',
      custom_headers: [{ header: 'Reply-To', value: 'office@example.com' }],
      attachments: [
        {
          filename: 'INV-0001.pdf',
          fileblob: Buffer.from('%PDF-1.7').toString('base64'),
          mimetype: 'application/pdf',
        },
      ],
    });
    const plain = smtp2goRequestBody({ ...envelope, replyTo: undefined, attachments: [] });
    expect(plain).not.toHaveProperty('custom_headers');
    expect(plain).not.toHaveProperty('attachments');
  });

  test('posts to /email/send with the API key header', async () => {
    const fake = fakeFetch(200, { data: { succeeded: 1, failed: 0 } });
    await sendViaSmtp2go(envelope, {
      apiKey: 'api-test',
      apiUrl: 'https://eu-api.smtp2go.com/v3/',
      fetchImpl: fake.impl,
    });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.url).toBe('https://eu-api.smtp2go.com/v3/email/send');
    const headers = fake.calls[0]?.init.headers as Record<string, string>;
    expect(headers['X-Smtp2go-Api-Key']).toBe('api-test');
    expect(JSON.parse(String(fake.calls[0]?.init.body)).to).toEqual(['client@example.com']);
  });

  test('refusals are errors that never name the recipient', async () => {
    const refused = fakeFetch(400, { data: { error_code: 'E_ApiResponseCodes.API_KEY_INVALID' } });
    const error = await sendViaSmtp2go(envelope, { apiKey: 'bad', fetchImpl: refused.impl }).catch(
      (caught: unknown) => caught as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('API_KEY_INVALID');
    expect(error?.message).not.toContain('client@example.com');

    const notDelivered = fakeFetch(200, { data: { succeeded: 0, failed: 1 } });
    await expect(
      sendViaSmtp2go(envelope, { apiKey: 'api-test', fetchImpl: notDelivered.impl }),
    ).rejects.toThrow('SMTP2GO did not accept the message');
  });
});

describe('invites when mail fails', () => {
  let admin: TestStaff;

  beforeAll(async () => {
    admin = await createStaff({
      email: 'mail.admin@example.com',
      fullName: 'Mail Admin',
      role: 'admin',
    });
  });

  test('the invite is still created and its link shown, marked as not emailed', async () => {
    failNextMailForTests();
    const created = await request(app)
      .post('/api/users/invites')
      .set(admin.auth)
      .send({ email: 'mail.down@example.com', fullName: 'Mail Down', role: 'paralegal' });
    expect(created.status).toBe(201);
    expect(created.body.emailed).toBe(false);
    expect(created.body.url).toContain('/invite/');
    const token = created.body.url.split('/invite/')[1];
    const preview = await request(app).get(`/api/auth/invites/${token}`);
    expect(preview.body).toMatchObject({ email: 'mail.down@example.com' });
  });
});
