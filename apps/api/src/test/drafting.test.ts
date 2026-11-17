// Drafting from the standard templates: day counting, field checks, every
// template's build and checks, and the draft -> review -> final flow over HTTP
// with permissions, matter documents and firm isolation.
import { beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../server';
import {
  addBusinessDays,
  addCalendarDays,
  addMonths,
  isBusinessDay,
  publicHolidays,
} from '../drafting/days';
import { defendDeadline } from '../drafting/templates/litigation';
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

describe('second batch of templates', () => {
  const mustFields = (id: string, values: Record<string, string>) =>
    findTemplate(id)!
      .checks(values, CTX)
      .filter((issue) => issue.severity === 'must')
      .map((issue) => issue.field);
  const text = (id: string, values: Record<string, string>) => {
    const template = findTemplate(id)!;
    return renderText(template.build(values, CTX), template.format);
  };

  test('counting: court days skip 16 December to 15 January; calendar days skip a holiday last day', () => {
    expect(defendDeadline('2026-12-10', 10)).toBe('2027-01-26');
    expect(addCalendarDays('2026-11-16', 30)).toBe('2026-12-17'); // 16 December is a holiday
    const late = findTemplate('notice-of-intention-to-defend')!.checks(
      { servedOn: '2026-10-01', defendDays: '10' },
      CTX,
    );
    expect(late.find((issue) => issue.field === 'servedOn')?.message).toMatch(
      /due by 15 October 2026/,
    );
  });

  test('a plea must answer every paragraph, and "noted" is flagged', () => {
    const issues = findTemplate('plea')!.checks(
      { paragraphCount: '5', responses: '1: Admitted.\n2 to 3: Denied.\n4: Noted.' },
      CTX,
    );
    expect(issues.find((issue) => issue.severity === 'must')?.message).toMatch(/Paragraph 5 /);
    expect(issues.some((issue) => /Noted/.test(issue.message))).toBe(true);
    expect(text('plea', { responses: '2 to 3: Denied.' })).toContain(
      'Ad paragraphs 2 to 3: Denied.',
    );
  });

  test('a combined summons follows Rules 18(6), 18(10) and 19(1)', () => {
    expect(
      mustFields('combined-summons', {
        defendDays: '5',
        contract: 'Written contract',
        claimType: 'Damages',
        amount: '100000',
      }),
    ).toEqual(['defendDays', 'contractDetails', 'annexures', 'damages']);
    expect(
      text('combined-summons', {
        firstParty: 'Acme (Pty) Ltd',
        secondParty: 'Sipho Dlamini',
        amount: '12500',
        claimType: 'Liquidated amount',
      }),
    ).toContain('Payment of the sum of R12 500.00 (twelve thousand five hundred rand)');
  });

  test('a late CCMA referral needs condonation, and the application is added', () => {
    const values = {
      disputeType: 'Unfair dismissal',
      disputeDate: '2026-09-01',
      referralDate: '2026-11-16',
    };
    expect(mustFields('lra-7-11-referral', values)).toContain('lateReasons');
    expect(text('lra-7-11-referral', values)).toContain('APPLICATION FOR CONDONATION');
    expect(text('lra-7-11-referral', { ...values, disputeDate: '2026-11-01' })).not.toContain(
      'CONDONATION OF',
    );
  });

  test('property: spouse consent, bond dates, cooling-off and long consumer leases', () => {
    expect(
      mustFields('deed-of-sale', {
        sellerMarital: 'Married in community of property',
        bond: 'Yes',
      }),
    ).toEqual(expect.arrayContaining(['sellerSpouse', 'bondDate', 'bondAmount']));
    expect(text('deed-of-sale', { price: '200000', purchaserMarital: 'Unmarried' })).toContain(
      'section 29A of the Alienation of Land Act',
    );
    expect(text('deed-of-sale', { price: '900000', purchaserMarital: 'Unmarried' })).not.toContain(
      'section 29A',
    );
    const lease = findTemplate('residential-lease')!.checks(
      { startDate: '2026-12-01', endDate: '2029-11-30', cpa: 'Yes' },
      CTX,
    );
    expect(lease.find((issue) => issue.field === 'endDate')?.severity).toBe('should');
    expect(
      mustFields('poa-to-pass-transfer', { saleDate: '2026-11-10', signDate: '2026-11-01' }),
    ).toEqual(expect.arrayContaining(['titleDeed', 'signDate']));
  });

  test('suretyship, acknowledgment of debt and contingency fee caps', () => {
    expect(
      mustFields('suretyship', {
        suretyMarital: 'Married in community of property',
        scope: 'A specific debt',
      }),
    ).toEqual(expect.arrayContaining(['specificDebt', 'suretySpouse']));
    expect(
      text('acknowledgment-of-debt', {
        amount: '10000',
        instalment: '3000',
        repayment: 'Monthly instalments',
        firstPayment: '2026-12-01',
      }),
    ).toContain('about 4 instalments');
    expect(
      mustFields('contingency-fees-agreement', {
        upliftPercent: '150',
        money: 'Yes',
        capPercent: '30',
      }),
    ).toEqual(expect.arrayContaining(['upliftPercent', 'capPercent']));
  });

  test('every template in the registry is marked ready in the catalogue, and the reverse', async () => {
    const { DRAFTING_CATALOGUE } = await import('@ahava88/shared');
    const ready = DRAFTING_CATALOGUE.filter((kind) => kind.availability === 'template').map(
      (kind) => kind.id,
    );
    expect(ready.sort()).toEqual(TEMPLATES.map((template) => template.id).sort());
    for (const template of TEMPLATES) {
      expect(DRAFTING_CATALOGUE.find((kind) => kind.id === template.id)?.category).toBe(
        template.category,
      );
    }
  });
});

describe('third batch of templates', () => {
  const issuesFor = (id: string, values: Record<string, string>) =>
    findTemplate(id)!.checks(values, CTX);
  const must = (id: string, values: Record<string, string>) =>
    issuesFor(id, values)
      .filter((issue) => issue.severity === 'must')
      .map((issue) => issue.field);
  const text = (id: string, values: Record<string, string>) => {
    const template = findTemplate(id)!;
    return renderText(template.build(values, CTX), template.format);
  };

  test('answering affidavit: bare denials, unanswered paragraphs and the 15-day limit', () => {
    const issues = issuesFor('answering-affidavit', {
      paragraphCount: '4',
      responses: '1 to 2: Admitted.\n3: Denied.',
      opposeDate: '2026-10-01',
    });
    expect(issues.some((issue) => /Paragraph 4 /.test(issue.message))).toBe(true);
    expect(issues.some((issue) => /bare denial/.test(issue.message))).toBe(true);
    expect(issues.find((issue) => issue.field === 'opposeDate')?.message).toMatch(
      /due by 22 October 2026/,
    );
    expect(text('replying-affidavit', { responses: '12: Denied, as appears from AA2.' })).toContain(
      'Ad paragraph 12: Denied',
    );
  });

  test('simple summons, notice of bar and Rule 41A notice', () => {
    expect(must('simple-summons', { defendDays: '5' })).toContain('defendDays');
    expect(
      text('simple-summons', { amount: '8000', cause: 'money lent', secondParty: 'T Nkosi' }),
    ).toContain('Payment of the sum of R8 000.00');
    expect(must('notice-of-bar', { dueDate: '2026-11-20' })).toContain('dueDate');
    expect(must('notice-of-bar', { dueDate: '2026-11-02' })).not.toContain('dueDate');
    expect(
      text('rule-41a-notice', { ourRole: 'Respondent', agrees: 'Opposes', reasons: 'x' }),
    ).toContain('the respondent opposes the referral of this application to mediation');
  });

  test('letters: a without-prejudice offer and a notice of breach', () => {
    expect(must('without-prejudice-offer', {})).toContain('amount');
    expect(
      text('without-prejudice-offer', { amount: '5000', side: 'Accept', letterDate: '2026-11-16' }),
    ).toMatch(/WITHOUT PREJUDICE[\s\S]*accept payment of R5 000\.00[\s\S]*30 November 2026/);
    expect(must('notice-of-breach', { consumer: 'Yes', remedyDays: '7' })).toContain('remedyDays');
    expect(
      text('notice-of-breach', {
        consumer: 'Yes',
        remedyDays: '20',
        letterDate: '2026-11-16',
        clause: 'clause 18: notice',
      }),
    ).toContain(
      'In terms of clause 18 of the agreement, you are hereby called upon to remedy the breach within 20 business days',
    );
  });

  test('labour: arbitration time limits and BCEA minimums', () => {
    expect(
      must('lra-7-13-arbitration', { certificateDate: '2026-07-01', requestDate: '2026-11-16' }),
    ).toContain('lateReasons');
    expect(
      must('lra-7-13-arbitration', {
        conciliationReferred: '2026-11-01',
        requestDate: '2026-11-16',
      }),
    ).toContain('conciliationReferred');
    expect(
      issuesFor('lra-7-13-arbitration', {
        reason: 'Automatically unfair dismissal',
        certificateDate: '2026-11-01',
      }).find((issue) => issue.field === 'reason')?.severity,
    ).toBe('should');
    expect(
      must('employment-contract', {
        weeklyHours: '48',
        overtimeRate: '1',
        leaveDays: '10',
        daysPerWeek: '5',
      }),
    ).toEqual(['weeklyHours', 'overtimeRate', 'leaveDays']);
    expect(
      issuesFor('employment-contract', { startDate: '2026-12-01', endDate: '2027-11-30' }).some(
        (issue) => issue.field === 'fixedTermReason',
      ),
    ).toBe(true);
  });

  test('general power of attorney: standard powers, and land needs a special power', () => {
    expect(text('general-power-of-attorney', {})).toContain('lose the mental capacity');
    expect(
      issuesFor('general-power-of-attorney', { powers: 'to sell my house in Soweto' }).some(
        (issue) => issue.field === 'powers',
      ),
    ).toBe(true);
  });
});

describe('High Court batch', () => {
  const issuesFor = (id: string, values: Record<string, string>) =>
    findTemplate(id)!.checks(values, CTX);
  const must = (id: string, values: Record<string, string>) =>
    issuesFor(id, values)
      .filter((issue) => issue.severity === 'must')
      .map((issue) => issue.field);
  const text = (id: string, values: Record<string, string>) => {
    const template = findTemplate(id)!;
    return renderText(template.build({ ...template.defaults, ...values }, CTX), template.format);
  };

  test('hearing dates must be court days, and urgent interim relief needs a return date', () => {
    expect(must('ex-parte-notice-of-motion', { hearingDate: '2026-12-25' })).toContain(
      'hearingDate',
    );
    expect(must('urgent-application', { hearingDate: '2026-11-24', interim: 'Yes' })).toEqual([
      'returnDate',
    ]);
    expect(text('urgent-application', { prayers: 'Interdicting the respondent.' })).toContain(
      'heard as one of urgency in terms of rule 6(12)',
    );
  });

  test('exception, Rule 30 and leave to appeal time limits', () => {
    expect(must('exception', { ground: 'is vague and embarrassing' })).toContain('noticeDate');
    expect(
      must('exception', { ground: 'is vague and embarrassing', noticeDate: '2026-11-10' }),
    ).toContain('noticeDate');
    expect(
      must('exception', { ground: 'is vague and embarrassing', noticeDate: '2026-10-01' }),
    ).toEqual([]);
    expect(issuesFor('rule-30-notice', { awareOn: '2026-10-01' })[0]?.severity).toBe('should');
    expect(must('leave-to-appeal', { judgmentDate: '2026-10-01' })).toContain('judgmentDate');
    expect(
      text('exception', { proceedings: 'Action', ourRole: 'Defendant', ground: GROUND }),
    ).toContain('the defendant excepts to the plaintiff’s particulars of claim');
  });

  test('draft orders name the costs scale; heads list full citations; the index paginates', () => {
    expect(
      issuesFor('draft-order', { terms: 'The respondent pays the costs.' }).some((i) =>
        /scale A, B or C/.test(i.message),
      ),
    ).toBe(true);
    expect(
      issuesFor('draft-order', {
        terms: 'The respondent pays the costs, counsel on scale B.',
      }).some((i) => /scale A, B or C/.test(i.message)),
    ).toBe(false);
    const heads = issuesFor('heads-of-argument', {
      authorities: 'Plascon-Evans 1984 (3) SA 623 (A)\nSome case I remember',
    });
    expect(heads.find((i) => i.field === 'authorities')?.message).toMatch(/Some case I remember/);
    const index = text('index-and-pagination', {
      documents: 'Notice of motion | 2026-03-01 | 3\nFounding affidavit | 2026-03-01 | 20',
    });
    expect(index).toContain('pages 1–3');
    expect(index).toContain('pages 4–23');
  });

  test('discovery: privilege needs a ground', () => {
    expect(
      issuesFor('discovery-affidavit', { partTwo: 'Letters to our attorney' }).some(
        (i) => i.field === 'partTwo',
      ),
    ).toBe(true);
    expect(text('discovery-affidavit', { partOne: 'Loan agreement' })).toContain(
      'SCHEDULE: PART 1',
    );
  });
});

const GROUND = 'lacks averments necessary to sustain a cause of action';

describe('Magistrates’ Court and criminal batch', () => {
  const issuesFor = (id: string, values: Record<string, string>) =>
    findTemplate(id)!.checks(values, CTX);
  const must = (id: string, values: Record<string, string>) =>
    issuesFor(id, values)
      .filter((issue) => issue.severity === 'must')
      .map((issue) => issue.field);
  const text = (id: string, values: Record<string, string>) => {
    const template = findTemplate(id)!;
    return renderText(template.build({ ...template.defaults, ...values }, CTX), template.format);
  };

  test('civil: NCA allegations, opposition periods and the s 65A registered letter', () => {
    expect(must('mc-summons', { credit: 'Yes', defendDays: '5' })).toEqual([
      'defendDays',
      's129Date',
    ]);
    expect(text('mc-summons', { credit: 'Yes', s129Date: '2026-09-01' })).toContain(
      'sections 129 and 130 of the National Credit Act',
    );
    expect(must('mc-application', { opposeDays: '5' })).toContain('opposeDays');
    expect(must('section-65-documents', { presence: 'No' })).toContain('letterDate');
    expect(must('mc-plea', { paragraphCount: '3', responses: '1 to 2: Admitted.' })).toContain(
      'responses',
    );
  });

  test('criminal: Schedule 6 bail, s 112 fault and appeal time limits', () => {
    expect(must('bail-affidavit', { schedule: 'Schedule 6' })).toContain('exceptional');
    expect(text('bail-affidavit', { previous: 'none' })).toContain('section 60(11B)(a)');
    expect(
      issuesFor('s112-statement', { fault: 'I did it.' }).some((i) => i.field === 'fault'),
    ).toBe(true);
    expect(
      issuesFor('s112-statement', { fault: 'I knew it was wrong and intended to take it.' }).some(
        (i) => i.field === 'fault',
      ),
    ).toBe(false);
    expect(must('criminal-appeal-notice', { sentenceDate: '2026-10-01' })).toContain(
      'sentenceDate',
    );
    expect(must('criminal-appeal-notice', { sentenceDate: '2026-11-10' })).not.toContain(
      'sentenceDate',
    );
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
