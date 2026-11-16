// Outgoing email (invites, password resets, invoices).
//
// Two transports:
// - SMTP2GO_API_KEY: SMTP2GO's HTTPS API. Use it where outbound SMTP ports
//   are blocked (Railway's Hobby plan blocks them).
// - SMTP_URL: any SMTP server (Azure Communication Services Email exposes SMTP).
// The API key wins when both are set. Without either, mail is not sent:
// callers fall back to showing the link to the administrator who created it.
// In tests, sent messages are kept in an in-memory outbox. Message bodies and
// recipients are never logged: they carry personal information.
import { currentTenant } from '../db/tenant-context';
import type { FirmRow } from '../db/schema';
import nodemailer, { type Transporter } from 'nodemailer';
import { scrub } from '../lib/monitoring';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
  /** From the platform itself (e.g. the firm's own subscription), not in the firm's name. */
  platform?: boolean;
  /** Set when sent (the test outbox records them). */
  from?: string;
  replyTo?: string;
}

/** A message ready to go: sender resolved. */
export interface MailEnvelope {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}

const outbox: MailMessage[] = [];
let transporter: Transporter | null | undefined;

const SMTP2GO_DEFAULT_API = 'https://api.smtp2go.com/v3';
const SMTP2GO_TIMEOUT_MS = 30_000;

function smtp2goApiKey(): string {
  return (process.env.SMTP2GO_API_KEY || '').trim();
}

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    const url = (process.env.SMTP_URL || '').trim();
    transporter = url ? nodemailer.createTransport(url) : null;
  }
  return transporter;
}

export function mailEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  return Boolean(smtp2goApiKey()) || getTransporter() !== null;
}

/** The SMTP2GO /email/send request body for a message. */
export function smtp2goRequestBody(envelope: MailEnvelope): Record<string, unknown> {
  return {
    sender: envelope.from,
    to: [envelope.to],
    subject: envelope.subject,
    text_body: envelope.text,
    ...(envelope.replyTo
      ? { custom_headers: [{ header: 'Reply-To', value: envelope.replyTo }] }
      : {}),
    ...(envelope.attachments?.length
      ? {
          attachments: envelope.attachments.map((attachment) => ({
            filename: attachment.filename,
            fileblob: attachment.content.toString('base64'),
            mimetype: attachment.contentType,
          })),
        }
      : {}),
  };
}

/**
 * Sends through SMTP2GO's HTTPS API. Throws when SMTP2GO does not confirm
 * delivery to the recipient; the error never names the recipient.
 */
export async function sendViaSmtp2go(
  envelope: MailEnvelope,
  options: { apiKey: string; apiUrl?: string; fetchImpl?: typeof fetch },
): Promise<void> {
  const base = (options.apiUrl || SMTP2GO_DEFAULT_API).replace(/\/+$/, '');
  const response = await (options.fetchImpl || fetch)(`${base}/email/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Smtp2go-Api-Key': options.apiKey,
    },
    body: JSON.stringify(smtp2goRequestBody(envelope)),
    signal: AbortSignal.timeout(SMTP2GO_TIMEOUT_MS),
  });
  let payload: { data?: { succeeded?: number; error?: string; error_code?: string } } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Not JSON: reported by status below.
  }
  const data = payload.data || {};
  if (!response.ok || !data.succeeded) {
    const reason = data.error_code || data.error || `HTTP ${response.status}`;
    throw new Error(`SMTP2GO did not accept the message (${reason})`);
  }
}

/**
 * Mail goes out from the platform's address (MAIL_FROM), in the firm's name,
 * with replies to the firm's own address when it has set one.
 */
export function senderFor(firm: FirmRow | undefined): { from: string; replyTo?: string } {
  const address = (process.env.MAIL_FROM || 'no-reply@localhost').replace(/^.*<([^>]+)>.*$/, '$1');
  if (!firm) {
    return { from: process.env.MAIL_FROM || address };
  }
  const name = (firm.tradingName || firm.legalName).replace(/["\\\r\n<>]/g, '').slice(0, 80);
  const replyTo = firm.profile?.replyToEmail || undefined;
  return { from: `"${name}" <${address}>`, ...(replyTo ? { replyTo } : {}) };
}

let failNextTestMail = false;

/** Sends a message. Returns false when no transport is configured. */
export async function sendMail(message: MailMessage): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') {
    if (failNextTestMail) {
      failNextTestMail = false;
      throw new Error('Test mail transport failure');
    }
    outbox.push({ ...message, ...senderFor(message.platform ? undefined : currentTenant()?.firm) });
    return true;
  }
  const envelope: MailEnvelope = {
    ...senderFor(message.platform ? undefined : currentTenant()?.firm),
    to: message.to,
    subject: message.subject,
    text: message.text,
    attachments: message.attachments,
  };
  const apiKey = smtp2goApiKey();
  if (apiKey) {
    await sendViaSmtp2go(envelope, { apiKey, apiUrl: process.env.SMTP2GO_API_URL });
    return true;
  }
  const transport = getTransporter();
  if (!transport) {
    return false;
  }
  await transport.sendMail(envelope);
  return true;
}

/**
 * For messages whose link is also shown on screen (invites, password resets):
 * a mail failure is logged (without personal information) and reported as
 * "not emailed" instead of failing the request, so the link still reaches
 * whoever created it.
 */
export async function sendMailOrShowLink(message: MailMessage): Promise<boolean> {
  try {
    return await sendMail(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.error(`Email not sent; the link is shown on screen instead: ${scrub(reason)}`);
    return false;
  }
}

/** Test helper: makes the next test-mode sendMail throw. */
export function failNextMailForTests(): void {
  failNextTestMail = true;
}

/** Test helper: messages "sent" so far. */
export function testOutbox(): MailMessage[] {
  return outbox;
}
