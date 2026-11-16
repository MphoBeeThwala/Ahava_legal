// Drafting from the standard templates: day counting, field checks, every
// template's build and checks, and the draft -> review -> final flow over HTTP
// with permissions, matter documents and firm isolation.
import { beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../server';
import { addBusinessDays, addMonths, isBusinessDay, publicHolidays } from '../drafting/days';
import { numberInWords, parseRand, randWithWords, validSaIdNumber } from '../drafting/fields';
import { renderDocx, renderPdf, renderText } from '../drafting/model';
import { TEMPLATES, findTemplate } from '../drafting/registry';
import { setAiClient } from '../lib/ai-client';
import { createFirm } from '../services/firm.service';
import { withTenant } from '../db/tenant';
import { rotateDataKey } from '../services/keys.service';
import { pendingReencryption, reencryptFirm } from '../services/reencrypt.service';
import { exportFirm } from '../services/firm-export.service';
import { createStaff, defaultFirm, type TestStaff } from './helpers';

const CTX = {
  today: '2026-11-16',
  caseNumber: 'MAT-2026-0001',
  firm: {
    legalName: 'Test Firm Inc.',
    address: '1 Main Road\nPretoria',
    email: 'office@test.example',
    phone: '012 000 0000',
  },
};

describe('counting days', () => {
  test('South African public holidays, including Easter and Sunday holidays', () => {
    const y2026 = publicHolidays(2026);
    expect(y2026.has('2026-04-03')).toBe(true); // Good Friday
    expect(y2026.has('2026-04-06')).toBe(true); // Family Day
    expect(y2026.has('2026-08-10')).toBe(true); // 9 August is a Sunday: Monday off
    expect(isBusinessDay('2026-12-16')).toBe(false);
    expect(isBusinessDay('2026-11-16')).toBe(true);
  });

  test('business days skip weekends and holidays; six months clamps to month end', () => {
    expect(addBusinessDays('2026-12-14', 3)).toBe('2026-12-18'); // skips 16 December
    expect(addBusinessDays('2026-04-02', 1)).toBe('2026-04-07'); // skips Easter
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });
});

describe('field checks', () => {
  test('ID numbers, Rand amounts and amounts in words', () => {
    expect(validSaIdNumber('8001015009087')).toBe(true);
    expect(validSaIdNumber('8001015009088')).toBe(false);
    expect(validSaIdNumber('8013015009087')).toBe(false); // month 13
    expect(parseRand('R12 500,50')).toBe(1_250_050);
    expect(parseRand('12,500.50')).toBe(1_250_050);
    expect(parseRand('twelve')).toBeNull();
    expect(numberInWords(1_250)).toBe('one thousand two hundred and fifty');
    expect(randWithWords(1_250_050)).toBe(
      'R12 500.50 (twelve thousand five hundred rand and fifty cents)',
    );
  });
});

describe('every template', () => {
  test('builds and renders with nothing filled in, and flags required fields', async () => {
    for (const template of TEMPLATES) {
      const model = template.build({}, CTX);
      expect(renderText(model, template.format).length, template.id).toBeGreaterThan(50);
      const docx = await renderDocx(model, template.format);
      expect(docx.subarray(0, 2).toString('latin1'), template.id).toBe('PK');
      const pdf = await renderPdf(model, template.format);
      expect(pdf.subarray(0, 5).toString('latin1'), template.id).toBe('%PDF-');
      expect(template.basis.length, template.id).toBeGreaterThan(0);
      expect(template.review.status).toBe('unreviewed');
    }
  });

  test('statutory checks: late s3 notice, oppose period, will witnesses', () => {
    const s3 = findTemplate('organ-of-state-s3-notice')!;
    const late = s3.checks({ debtDate: '2026-01-10', letterDate: '2026-11-16' }, CTX);
    expect(late.find((issue) => issue.field === 'debtDate')?.message).toMatch(/late.*10 July 2026/);

    const motion = findTemplate('notice-of-motion')!;
    const short = motion.checks(
      { opposeDays: '3', hearingDate: '2026-12-25', relief: 'Interdict' },
      CTX,
    );
    expect(short.filter((issue) => issue.severity === 'must').map((issue) => issue.field)).toEqual([
      'opposeDays',
      'hearingDate',
    ]);

    const will = findTemplate('last-will')!;
    const issues = will.checks(
      {
        residue: 'my daughter Lerato Mokoena',
        witness1: 'Lerato Mokoena',
        maritalStatus: 'Unmarried',
      },
      CTX,
    );
    expect(issues.find((issue) => issue.field === 'witness1')).toMatchObject({ severity: 'must' });
  });

  test('a letter of demand writes the amount in words and the deadline date', () => {
    const letter = findTemplate('letter-of-demand')!;
    const text = renderText(
      letter.build(
        {
          letterDate: '2026-11-16',
          clientName: 'Acme (Pty) Ltd',
          debtorName: 'Sipho Dlamini',
          cause: 'Goods sold and delivered on 1 October 2026.',
          amount: '12500',
          deadlineDays: '14',
        },
        CTX,
      ),
      letter.format,
    );
    expect(text).toContain('R12 500.00 (twelve thousand five hundred rand)');
    expect(text).toContain('by no later than 30 November 2026');
  });
});

describe('drafts on a matter', () => {
  let attorney: TestStaff;
  let secretary: TestStaff;
  let bookkeeper: TestStaff;
  let caseId = '';
  let draftId = '';

  beforeAll(async () => {
    setAiClient(null);
    attorney = await createStaff({
      email: 'attorney@drafting.example',
      fullName: 'Ann Attorney',
      role: 'attorney',
    });
    secretary = await createStaff({
      email: 'secretary@drafting.example',
      fullName: 'Sam Secretary',
      role: 'secretary',
    });
    bookkeeper = await createStaff({
      email: 'books@drafting.example',
      fullName: 'Bo Books',
      role: 'bookkeeper',
    });
    const intake = await request(app).post('/api/intake/submissions').set(attorney.auth).send({
      fullName: 'Lerato Mokoena',
      email: 'lerato@drafting.example',
      phone: '0725550101',
      practiceArea: 'Commercial',
      matterSummary: 'Unpaid invoices for goods delivered.',
      consentToAi: false,
      consentToStorage: true,
    });
    const assessed = await request(app)
      .post(`/api/intake/submissions/${intake.body.id}/assess`)
      .set(attorney.auth);
    caseId = assessed.body.matterCase.id;
  });

  test('the catalogue lists every kind, and the templates', async () => {
    const res = await request(app).get('/api/drafting/catalogue').set(secretary.auth);
    expect(res.status).toBe(200);
    expect(res.body.kinds.length).toBeGreaterThan(60);
    expect(res.body.templates.map((t: { id: string }) => t.id)).toContain('letter-of-demand');
    const withTemplate = res.body.kinds.filter(
      (kind: { availability: string }) => kind.availability === 'template',
    );
    expect(withTemplate).toHaveLength(res.body.templates.length);
    expect((await request(app).get('/api/drafting/catalogue').set(bookkeeper.auth)).status).toBe(
      403,
    );
  });

  test('a draft starts from the matter: client and case number filled in', async () => {
    const res = await request(app)
      .post(`/api/cases/${caseId}/drafts`)
      .set(secretary.auth)
      .send({ templateId: 'letter-of-demand' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    draftId = res.body.id;
    expect(res.body.values).toMatchObject({ clientName: 'Lerato Mokoena', deadlineDays: '14' });
    expect(res.body.values.ourRef).toBe(res.body.caseNumber);
    expect(res.body.issues.some((issue: { severity: string }) => issue.severity === 'must')).toBe(
      true,
    );
    expect(res.body.status).toBe('draft');
  });

  test('review flow: submit, an attorney finalises only without "must fix" issues', async () => {
    await request(app)
      .post(`/api/cases/${caseId}/drafts/${draftId}/submit`)
      .set(secretary.auth)
      .expect(200);
    // The secretary may draft but not finalise.
    expect(
      (
        await request(app)
          .post(`/api/cases/${caseId}/drafts/${draftId}/finalise`)
          .set(secretary.auth)
      ).status,
    ).toBe(403);
    const blocked = await request(app)
      .post(`/api/cases/${caseId}/drafts/${draftId}/finalise`)
      .set(attorney.auth);
    expect(blocked.status).toBe(422);

    const current = (
      await request(app).get(`/api/cases/${caseId}/drafts/${draftId}`).set(secretary.auth)
    ).body;
    const filled = await request(app)
      .put(`/api/cases/${caseId}/drafts/${draftId}`)
      .set(secretary.auth)
      .send({
        values: {
          ...current.values,
          debtorName: 'Sipho Dlamini',
          debtorAddress: '2 Side Street\nPretoria',
          cause: 'Goods sold and delivered on 1 October 2026.',
          amount: '12500',
          authorName: 'Ann Attorney',
          notAField: 'dropped',
        },
      });
    expect(filled.status).toBe(200);
    expect(filled.body.status).toBe('draft'); // a change sends it back to draft
    expect(filled.body.values.notAField).toBeUndefined();
    expect(
      filled.body.issues.filter((issue: { severity: string }) => issue.severity === 'must'),
    ).toEqual([]);
    expect(filled.body.preview).toContain('twelve thousand five hundred rand');

    await request(app)
      .post(`/api/cases/${caseId}/drafts/${draftId}/submit`)
      .set(secretary.auth)
      .expect(200);
    const final = await request(app)
      .post(`/api/cases/${caseId}/drafts/${draftId}/finalise`)
      .set(attorney.auth);
    expect(final.status, JSON.stringify(final.body)).toBe(200);
    expect(final.body).toMatchObject({ status: 'final' });
    expect(final.body.documentId).toBeTruthy();

    const edit = await request(app)
      .put(`/api/cases/${caseId}/drafts/${draftId}`)
      .set(secretary.auth)
      .send({ values: {} });
    expect(edit.status).toBe(409);
  });

  test('Word and PDF files', async () => {
    const docx = await request(app)
      .get(`/api/cases/${caseId}/drafts/${draftId}/file`)
      .set(secretary.auth)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(docx.status).toBe(200);
    expect(docx.headers['content-disposition']).toMatch(/Letter of demand\.docx/);
    expect((docx.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
    const pdf = await request(app)
      .get(`/api/cases/${caseId}/drafts/${draftId}/file?format=pdf`)
      .set(secretary.auth);
    expect(pdf.headers['content-type']).toBe('application/pdf');
  });

  test('drafts follow key rotation and are in the firm export', async () => {
    const firm = await defaultFirm();
    await withTenant(firm, () => rotateDataKey(), { system: true });
    const before = await withTenant(firm, () => pendingReencryption(), { system: true });
    expect(before.pending.documents).toBeGreaterThan(0);
    await reencryptFirm(firm);
    const after = await withTenant(firm, () => pendingReencryption(), { system: true });
    expect(after.pending.documents).toBe(0);
    const reread = await request(app)
      .get(`/api/cases/${caseId}/drafts/${draftId}`)
      .set(secretary.auth);
    expect(reread.body.values.debtorName).toBe('Sipho Dlamini');
    const data = await exportFirm(firm);
    expect(JSON.stringify(data.tables.documentDrafts)).toContain('Sipho Dlamini');
  });

  test('another firm cannot see or change the drafts', async () => {
    const other = await createFirm({
      slug: 'drafting-other',
      legalName: 'Other',
      domains: ['portal.drafting-other.test'],
    });
    const outsider = await createStaff({
      firm: other,
      host: 'portal.drafting-other.test',
      email: 'a@drafting-other.example',
      role: 'admin',
    });
    const get = await request(app)
      .get(`/api/cases/${caseId}/drafts/${draftId}`)
      .set('Host', 'portal.drafting-other.test')
      .set(outsider.auth);
    expect(get.status).toBe(404);
    const list = await request(app)
      .get(`/api/cases/${caseId}/drafts`)
      .set('Host', 'portal.drafting-other.test')
      .set(outsider.auth);
    expect(list.status).toBe(404);
    const create = await request(app)
      .post(`/api/cases/${caseId}/drafts`)
      .set('Host', 'portal.drafting-other.test')
      .set(outsider.auth)
      .send({ templateId: 'affidavit' });
    expect(create.status).toBe(404);
  });
});
