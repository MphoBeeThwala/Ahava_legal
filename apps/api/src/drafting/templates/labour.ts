// Labour: the referral of a dispute to conciliation (LRA Form 7.11), with
// proof of service and, when it is late, a condonation application; the
// request for arbitration (LRA Form 7.13); and the employment contract.
// Standard wording: to be reviewed by an admitted attorney.
import type { DraftIssue } from '@ahava88/shared';
import { addCalendarDays, longDate, parseDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import { AGREEMENT_FORMAT, APPROVED, lines, or, v, type DraftTemplate } from '../template';

type Values = Record<string, string>;

const DISPUTES = [
  'Unfair dismissal',
  'Automatically unfair dismissal',
  'Unfair labour practice',
  'Other dispute',
];

/** The time limit for a referral (LRA s 191(1)(b)), or null when another limit applies. */
export function referralLimit(values: Values): { days: number; last: string } | null {
  const type = v(values, 'disputeType');
  const days = /dismissal/i.test(type) ? 30 : type === 'Unfair labour practice' ? 90 : null;
  const from = v(values, 'disputeDate');
  if (!days || !from) return null;
  const last = addCalendarDays(from, days);
  return last ? { days, last } : null;
}

const isLate = (values: Values, today: string) => {
  const limit = referralLimit(values);
  return limit !== null && (v(values, 'referralDate') || today) > limit.last;
};

export const ccmaReferral: DraftTemplate = {
  id: 'lra-7-11-referral',
  version: '2026.11-1',
  name: 'Referral to the CCMA for conciliation (LRA Form 7.11)',
  category: 'labour',
  purpose:
    'Refers a dispute to conciliation with what LRA Form 7.11 asks for, the confirmation of service on the other party, and a condonation application when the referral is late.',
  basis: [
    'Labour Relations Act 66 of 1995 s 191(1) (30 days for dismissals, 90 days for unfair labour practices), s 191(2) (condonation)',
    'CCMA Rules: referral on the prescribed form, signed, served on the other party with proof of service; condonation application (rule 9)',
    'Interpretation Act 33 of 1957 s 4 (counting days)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  defaults: { disputeType: 'Unfair dismissal', forum: 'CCMA' },
  sections: [
    {
      key: 'referring',
      title: 'Referring party (employee)',
      fields: [
        {
          key: 'employeeName',
          label: 'Full names',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'employeeAddress', label: 'Address', type: 'longtext', prefill: 'client.address' },
        { key: 'employeePhone', label: 'Telephone', type: 'text', prefill: 'client.phone' },
        { key: 'employeeEmail', label: 'Email', type: 'text', prefill: 'client.email' },
        {
          key: 'representative',
          label: 'Representative (if any)',
          type: 'text',
          help: 'e.g. a trade union official. Legal practitioners may not appear at conciliation.',
        },
      ],
    },
    {
      key: 'employer',
      title: 'Other party (employer)',
      fields: [
        { key: 'employerName', label: 'Employer', type: 'text', required: true },
        { key: 'employerAddress', label: 'Address', type: 'longtext', required: true },
        { key: 'employerContact', label: 'Contact person, phone or email', type: 'text' },
        {
          key: 'forum',
          label: 'Where it is referred',
          type: 'text',
          required: true,
          help: 'CCMA, or the bargaining council with jurisdiction in the sector.',
        },
      ],
    },
    {
      key: 'dispute',
      title: 'The dispute',
      fields: [
        {
          key: 'disputeType',
          label: 'Kind of dispute',
          type: 'choice',
          required: true,
          choices: DISPUTES,
        },
        {
          key: 'disputeDate',
          label: 'Date of dismissal, or the date the dispute arose',
          type: 'date',
          required: true,
          help: 'For a dismissal: the date of dismissal, or the later date of the employer’s final decision (e.g. after an internal appeal).',
        },
        { key: 'startDate', label: 'Date employment began', type: 'date' },
        { key: 'jobTitle', label: 'Job title', type: 'text' },
        { key: 'pay', label: 'Pay (e.g. R12 000 per month)', type: 'text' },
        {
          key: 'summary',
          label: 'What happened, one point per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'outcome',
          label: 'Outcome sought',
          type: 'choice',
          required: true,
          choices: ['Reinstatement', 'Re-employment', 'Compensation', 'Other'],
        },
        { key: 'outcomeDetail', label: 'Details of the outcome sought', type: 'text' },
      ],
    },
    {
      key: 'service',
      title: 'Referral and service',
      fields: [
        { key: 'referralDate', label: 'Date of referral', type: 'date', prefill: 'today' },
        {
          key: 'serviceMethod',
          label: 'How a copy is served on the employer',
          type: 'choice',
          required: true,
          choices: ['Email', 'Hand delivery', 'Registered post', 'Courier'],
        },
        {
          key: 'lateReasons',
          label: 'If late: why, one point per line',
          type: 'longtext',
          help: 'Becomes the condonation application: how late, why, prospects of success, prejudice.',
        },
        {
          key: 'prospects',
          label: 'If late: prospects of success',
          type: 'longtext',
        },
      ],
    },
  ],
  build(values, ctx) {
    const late = isLate(values, ctx.today);
    const limit = referralLimit(values);
    const row = (label: string, value: string): Block => ({
      kind: 'text',
      text: `${label}: ${value || '—'}`,
    });
    const blocks: Block[] = [
      { kind: 'text', text: `Referred to: ${or(v(values, 'forum'), 'CCMA / bargaining council')}` },
      { kind: 'heading', text: 'Part A: Referring party' },
      row('Name', v(values, 'employeeName')),
      row('Address', v(values, 'employeeAddress').split('\n').join(', ')),
      row('Telephone', v(values, 'employeePhone')),
      row('Email', v(values, 'employeeEmail')),
      row('Representative', v(values, 'representative')),
      { kind: 'heading', text: 'Part B: Other party' },
      row('Employer', v(values, 'employerName')),
      row('Address', v(values, 'employerAddress').split('\n').join(', ')),
      row('Contact', v(values, 'employerContact')),
      { kind: 'heading', text: 'Part C: The dispute' },
      row('Nature of the dispute', v(values, 'disputeType')),
      row(
        /dismissal/i.test(v(values, 'disputeType')) ? 'Date of dismissal' : 'Date dispute arose',
        longDate(v(values, 'disputeDate')),
      ),
      row('Employment began', longDate(v(values, 'startDate'))),
      row('Job title', v(values, 'jobTitle')),
      row('Pay', v(values, 'pay')),
      { kind: 'text', text: 'Summary of the facts:' },
      ...lines(values, 'summary').map((text) => ({ kind: 'para' as const, text })),
      row(
        'Outcome sought',
        [v(values, 'outcome'), v(values, 'outcomeDetail')].filter(Boolean).join(': '),
      ),
      row('Condonation applied for', late ? 'Yes (attached)' : 'No'),
      { kind: 'heading', text: 'Part D: Signature' },
      {
        kind: 'text',
        text: `Signed by the referring party on ${longDate(v(values, 'referralDate') || ctx.today)}.`,
      },
      { kind: 'signature', lines: [or(v(values, 'employeeName'), 'Referring party')] },
      { kind: 'heading', text: 'Confirmation of service' },
      {
        kind: 'text',
        text: `I confirm that a copy of this referral was served on ${or(v(values, 'employerName'), 'the employer')} by ${(v(values, 'serviceMethod') || '[method]').toLowerCase()} on ____ __________________ 20____. Proof of service is attached.`,
      },
      { kind: 'signature', lines: ['Referring party or representative'] },
      ...(late
        ? [
            { kind: 'spacer' as const },
            {
              kind: 'centred' as const,
              text: 'APPLICATION FOR CONDONATION OF THE LATE REFERRAL',
              bold: true,
            },
            {
              kind: 'para' as const,
              text: `The referral was due by ${longDate(limit?.last)} (${limit?.days} days after ${longDate(v(values, 'disputeDate'))}) and is made on ${longDate(v(values, 'referralDate') || ctx.today)}.`,
            },
            ...lines(values, 'lateReasons').map((text) => ({ kind: 'para' as const, text })),
            ...(v(values, 'prospects')
              ? [{ kind: 'para' as const, text: `Prospects of success: ${v(values, 'prospects')}` }]
              : []),
            {
              kind: 'para' as const,
              text: 'The employer will suffer no prejudice that cannot be addressed if condonation is granted, and it is in the interests of justice that the dispute be heard.',
            },
            {
              kind: 'text' as const,
              text: 'The referring party asks that the late referral be condoned. This application is to be supported by an affidavit (see the CCMA Rules).',
            },
          ]
        : []),
    ];
    return { title: 'Referral of a dispute to conciliation (LRA Form 7.11)', blocks };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const limit = referralLimit(values);
    if (limit && isLate(values, ctx.today)) {
      issues.push({
        severity: 'must',
        field: 'lateReasons',
        message: `The referral is late (due by ${longDate(limit.last)}). It needs a condonation application: give the degree of lateness, the reasons, the prospects of success and any prejudice, on affidavit.`,
        basis: 'LRA s 191(2); CCMA Rules (rule 9)',
      });
      if (!v(values, 'lateReasons')) {
        issues.push({
          severity: 'must',
          field: 'lateReasons',
          message: 'Give the reasons for the late referral.',
        });
      }
    } else if (limit) {
      issues.push({
        severity: 'note',
        field: 'disputeDate',
        message: `Refer by ${longDate(limit.last)} (${limit.days} days).`,
        basis: 'LRA s 191(1)(b)',
      });
    }
    if (v(values, 'disputeType') === 'Other dispute') {
      issues.push({
        severity: 'note',
        field: 'disputeType',
        message:
          'Check the time limit and form for this kind of dispute (e.g. mutual-interest disputes and severance pay disputes have their own rules).',
        basis: 'LRA ss 64, 191; CCMA Rules',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Serve a copy on the employer and attach proof of service, and check that the CCMA (and not a bargaining council) has jurisdiction. Legal practitioners may not represent parties in conciliation.',
      basis: 'CCMA Rules (service, rule 25(1)(a)); LRA s 191(1)(a)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ request for arbitration (Form 7.13)

const REASONS = [
  'Misconduct',
  'Incapacity (poor performance or ill health)',
  'Constructive dismissal',
  'Unfair labour practice',
  'Reason for dismissal unknown',
  'Operational requirements (retrenchment)',
  'Automatically unfair dismissal',
];

const LABOUR_COURT = ['Operational requirements (retrenchment)', 'Automatically unfair dismissal'];

export const arbitrationRequest: DraftTemplate = {
  id: 'lra-7-13-arbitration',
  version: '2026.11-1',
  name: 'Request for arbitration (LRA Form 7.13)',
  category: 'labour',
  purpose:
    'Asks the CCMA or bargaining council to arbitrate a dispute that conciliation did not resolve, within 90 days of the certificate.',
  basis: [
    'Labour Relations Act 66 of 1995 s 191(5) (arbitration or Labour Court, depending on the reason)',
    'LRA s 136(1) (request within 90 days of the certificate of outcome); s 191(11) (Labour Court referrals)',
    'CCMA Rules (service, proof of service, condonation)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  defaults: { forum: 'CCMA' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        {
          key: 'employeeName',
          label: 'Employee (requesting party)',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'employeeContact', label: 'Employee’s address, phone and email', type: 'longtext' },
        { key: 'employerName', label: 'Employer', type: 'text', required: true },
        { key: 'employerAddress', label: 'Employer’s address', type: 'longtext', required: true },
        { key: 'forum', label: 'CCMA or bargaining council', type: 'text', required: true },
      ],
    },
    {
      key: 'dispute',
      title: 'Conciliation and the dispute',
      fields: [
        { key: 'caseNumber', label: 'Conciliation case number', type: 'text', required: true },
        { key: 'conciliationReferred', label: 'Date referred to conciliation', type: 'date' },
        {
          key: 'certificateDate',
          label: 'Date of the certificate of outcome (leave empty if none was issued)',
          type: 'date',
        },
        {
          key: 'reason',
          label: 'Reason for the dismissal or dispute',
          type: 'choice',
          required: true,
          choices: REASONS,
        },
        {
          key: 'issues',
          label: 'Issues to be decided, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'outcome', label: 'Outcome sought', type: 'text', required: true },
        { key: 'requestDate', label: 'Date of this request', type: 'date', prefill: 'today' },
        { key: 'lateReasons', label: 'If late: why, one point per line', type: 'longtext' },
      ],
    },
  ],
  build(values, ctx) {
    const date = v(values, 'requestDate') || ctx.today;
    const late = arbitrationLate(values, date);
    const row = (label: string, value: string): Block => ({
      kind: 'text',
      text: `${label}: ${value || '—'}`,
    });
    const blocks: Block[] = [
      { kind: 'text', text: `To: ${or(v(values, 'forum'), 'CCMA / bargaining council')}` },
      row('Case number', v(values, 'caseNumber')),
      { kind: 'heading', text: 'Requesting party' },
      row('Name', v(values, 'employeeName')),
      row('Contact details', v(values, 'employeeContact').split('\n').join(', ')),
      { kind: 'heading', text: 'Other party' },
      row('Employer', v(values, 'employerName')),
      row('Address', v(values, 'employerAddress').split('\n').join(', ')),
      { kind: 'heading', text: 'The dispute' },
      row('Referred to conciliation on', longDate(v(values, 'conciliationReferred'))),
      row(
        'Certificate of outcome',
        v(values, 'certificateDate')
          ? `issued on ${longDate(v(values, 'certificateDate'))}`
          : 'not issued; 30 days have passed since referral',
      ),
      row('Reason for the dismissal or dispute', v(values, 'reason')),
      { kind: 'text', text: 'Issues the arbitrator is asked to decide:' },
      ...lines(values, 'issues').map((text) => ({ kind: 'para' as const, text })),
      row('Outcome sought', v(values, 'outcome')),
      row('Condonation applied for', late ? 'Yes (attached)' : 'No'),
      {
        kind: 'text',
        text: `The requesting party asks that the dispute be arbitrated. Signed on ${longDate(date)}.`,
      },
      { kind: 'signature', lines: [or(v(values, 'employeeName'), 'Requesting party')] },
      { kind: 'heading', text: 'Confirmation of service' },
      {
        kind: 'text',
        text: `A copy of this request was served on ${or(v(values, 'employerName'), 'the employer')} on ____ __________________ 20____. Proof of service is attached.`,
      },
      { kind: 'signature', lines: ['Requesting party or representative'] },
      ...(late
        ? [
            { kind: 'spacer' as const },
            {
              kind: 'centred' as const,
              text: 'APPLICATION FOR CONDONATION OF THE LATE REQUEST',
              bold: true,
            },
            ...lines(values, 'lateReasons').map((text) => ({ kind: 'para' as const, text })),
            {
              kind: 'text' as const,
              text: 'The requesting party asks that the late request be condoned. This application is to be supported by an affidavit (see the CCMA Rules).',
            },
          ]
        : []),
    ];
    return { title: 'Request for arbitration (LRA Form 7.13)', blocks };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const date = v(values, 'requestDate') || ctx.today;
    if (LABOUR_COURT.includes(v(values, 'reason'))) {
      issues.push({
        severity: 'should',
        field: 'reason',
        message:
          'Dismissals for operational requirements and automatically unfair dismissals go to the Labour Court, not arbitration (except a single employee’s retrenchment, where the employee may choose arbitration, or if the parties agree).',
        basis: 'LRA s 191(5)(b), (12); s 141',
      });
    }
    const cert = v(values, 'certificateDate');
    if (!cert) {
      const referred = v(values, 'conciliationReferred');
      const ready = referred ? addCalendarDays(referred, 30) : null;
      if (!referred) {
        issues.push({
          severity: 'must',
          field: 'certificateDate',
          message:
            'Enter the date of the certificate of outcome, or the date the dispute was referred to conciliation.',
        });
      } else if (ready && date <= ready) {
        issues.push({
          severity: 'must',
          field: 'conciliationReferred',
          message: `Without a certificate, arbitration may be requested only once 30 days have passed since the referral (after ${longDate(ready)}).`,
          basis: 'LRA s 191(5)',
        });
      }
    }
    if (arbitrationLate(values, date)) {
      issues.push({
        severity: 'must',
        field: 'lateReasons',
        message:
          'The request is more than 90 days after the certificate: it needs a condonation application, on affidavit, with the reasons for the delay and the prospects of success.',
        basis: 'LRA s 136(1)(b); CCMA Rules',
      });
    }
    return issues;
  },
};

function arbitrationLate(values: Values, date: string): boolean {
  const cert = v(values, 'certificateDate');
  const last = cert ? addCalendarDays(cert, 90) : null;
  return last !== null && date > last;
}

// ------------------------------------------------------------ employment contract

/** Minimum BCEA notice for the length of service (s 37(1)). */
const NOTICE =
  'one week during the first six months of employment, two weeks after six months but within the first year, and four weeks after one year';

export const employmentContract: DraftTemplate = {
  id: 'employment-contract',
  version: '2026.11-1',
  name: 'Employment contract',
  category: 'labour',
  purpose:
    'Records the terms of employment, including every particular the BCEA requires an employer to give in writing.',
  basis: [
    'Basic Conditions of Employment Act 75 of 1997 s 29 (written particulars), ss 9–10 (hours, overtime), 20, 22, 25–27 (leave), 34 (deductions), 37 (notice)',
    'Labour Relations Act 66 of 1995 s 198B (fixed-term contracts)',
    'National Minimum Wage Act 9 of 2018',
    'Protection of Personal Information Act 4 of 2013',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  defaults: {
    payFrequency: 'Monthly',
    weeklyHours: '45',
    daysPerWeek: '5',
    leaveDays: '15',
    overtimeRate: '1.5',
    probationMonths: '3',
  },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        {
          key: 'employerName',
          label: 'Employer',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'employerAddress',
          label: 'Employer’s address',
          type: 'longtext',
          required: true,
          prefill: 'client.address',
        },
        { key: 'employeeName', label: 'Employee', type: 'text', required: true },
        { key: 'employeeId', label: 'Employee’s ID or passport number', type: 'id_number' },
        { key: 'employeeAddress', label: 'Employee’s address', type: 'longtext' },
      ],
    },
    {
      key: 'job',
      title: 'The job',
      fields: [
        { key: 'jobTitle', label: 'Job title', type: 'text', required: true },
        { key: 'duties', label: 'Main duties, one per line', type: 'longtext', required: true },
        { key: 'workplace', label: 'Place of work', type: 'text', required: true },
        { key: 'startDate', label: 'Start date', type: 'date', required: true },
        { key: 'endDate', label: 'End date (fixed-term only)', type: 'date' },
        { key: 'fixedTermReason', label: 'Reason for the fixed term', type: 'text' },
        { key: 'probationMonths', label: 'Probation (months, 0 for none)', type: 'number' },
        { key: 'previousService', label: 'Previous service counted (if any)', type: 'text' },
        {
          key: 'council',
          label: 'Bargaining council or sectoral determination that applies',
          type: 'text',
        },
      ],
    },
    {
      key: 'pay',
      title: 'Hours and pay',
      fields: [
        { key: 'weeklyHours', label: 'Ordinary hours a week', type: 'number', required: true },
        { key: 'daysPerWeek', label: 'Days worked a week', type: 'number', required: true },
        {
          key: 'workingHours',
          label: 'Working days and hours',
          type: 'text',
          help: 'e.g. Monday to Friday, 08:00 to 17:00, with a one-hour lunch break',
        },
        { key: 'salary', label: 'Pay (R, before deductions)', type: 'money', required: true },
        {
          key: 'payFrequency',
          label: 'Paid',
          type: 'choice',
          required: true,
          choices: ['Monthly', 'Fortnightly', 'Weekly'],
        },
        {
          key: 'overtimeRate',
          label: 'Overtime rate (× ordinary rate)',
          type: 'number',
          required: true,
        },
        {
          key: 'benefits',
          label: 'Other payments and benefits, one per line',
          type: 'longtext',
          help: 'Include payment in kind and its value.',
        },
        {
          key: 'deductions',
          label: 'Deductions agreed, one per line',
          type: 'longtext',
          help: 'Other than tax, UIF and those required by law.',
        },
      ],
    },
    {
      key: 'terms',
      title: 'Leave and other terms',
      fields: [
        {
          key: 'leaveDays',
          label: 'Annual leave (working days a year)',
          type: 'number',
          required: true,
        },
        {
          key: 'restraint',
          label: 'Restraint of trade or confidentiality terms, one per line',
          type: 'longtext',
        },
        {
          key: 'documents',
          label: 'Other documents that form part of the contract',
          type: 'longtext',
          help: 'e.g. the disciplinary code, leave policy.',
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const salary = parseRand(v(values, 'salary'));
    const fixed = Boolean(v(values, 'endDate'));
    const probation = Number(v(values, 'probationMonths')) || 0;
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${or(v(values, 'employerName'), 'Employer')} of ${or(v(values, 'employerAddress').split('\n').join(', '), 'address')} ("the employer") and ${or(v(values, 'employeeName'), 'Employee')}${v(values, 'employeeId') ? ` (identity number ${v(values, 'employeeId')})` : ''}${v(values, 'employeeAddress') ? ` of ${v(values, 'employeeAddress').split('\n').join(', ')}` : ''} ("the employee").`,
      },
      { kind: 'heading', text: 'Appointment' },
      {
        kind: 'para',
        text: `The employer employs the employee as ${or(v(values, 'jobTitle'), 'job title')}, at ${or(v(values, 'workplace'), 'place of work')}, from ${longDate(v(values, 'startDate')) || '[start date]'}${fixed ? ` until ${longDate(v(values, 'endDate'))}${v(values, 'fixedTermReason') ? `, for the following reason: ${v(values, 'fixedTermReason')}` : ''}` : ', for an indefinite period'}.${v(values, 'previousService') ? ` Previous service counted: ${v(values, 'previousService')}.` : ''}`,
      },
      {
        kind: 'para',
        text: `The employee’s main duties are: ${lines(values, 'duties').join('; ') || '[duties]'}. The employee will also do other reasonable tasks that fit the position.`,
      },
      ...(probation > 0
        ? [
            {
              kind: 'para' as const,
              text: `The first ${probation} months are a probationary period, during which the employer will give the employee guidance, training and feedback on performance. The period may be extended only for a fair reason, after consulting the employee.`,
            },
          ]
        : []),
      { kind: 'heading', text: 'Hours of work' },
      {
        kind: 'para',
        text: `The employee’s ordinary hours are ${or(v(values, 'weeklyHours'), '45')} hours a week over ${or(v(values, 'daysPerWeek'), '5')} days${v(values, 'workingHours') ? ` (${v(values, 'workingHours')})` : ''}. Overtime is worked only by agreement, may not exceed 10 hours a week, and is paid at ${or(v(values, 'overtimeRate'), '1.5')} times the ordinary rate.`,
      },
      { kind: 'heading', text: 'Remuneration' },
      {
        kind: 'para',
        text: `The employer pays the employee ${salary !== null ? randWithWords(salary) : '[amount]'} ${(v(values, 'payFrequency') || 'monthly').toLowerCase()} before deductions, by electronic transfer, with a written payslip showing the details section 33 of the Basic Conditions of Employment Act requires.`,
      },
      ...lines(values, 'benefits').map((text) => ({
        kind: 'para' as const,
        text: `Benefit: ${text}`,
      })),
      {
        kind: 'para',
        text: `The employer deducts income tax, UIF and other amounts the law requires${lines(values, 'deductions').length ? `, and, with the employee’s written consent given by signing this contract, the following: ${lines(values, 'deductions').join('; ')}` : ''}. No other deduction is made without the employee’s written consent.`,
      },
      { kind: 'heading', text: 'Leave' },
      {
        kind: 'para',
        text: `Annual leave: ${or(v(values, 'leaveDays'), '15')} working days on full pay for each 12 months of employment.`,
      },
      {
        kind: 'para',
        text: 'Sick leave: in each 36-month cycle, paid sick leave equal to the number of days the employee normally works in six weeks. For more than two consecutive days’ absence, or more than two occasions in eight weeks, the employer may require a medical certificate.',
      },
      {
        kind: 'para',
        text: 'Family responsibility leave, maternity leave and parental leave are given as the Basic Conditions of Employment Act provides from time to time.',
      },
      { kind: 'heading', text: 'Ending the contract' },
      {
        kind: 'para',
        text: `Either party may end this contract by written notice of at least ${NOTICE}. Notice may not be given during leave. The employer may end the contract only for a fair reason and after a fair procedure.`,
      },
      ...(v(values, 'council')
        ? [
            {
              kind: 'para' as const,
              text: `The following applies to this employment: ${v(values, 'council')}.`,
            },
          ]
        : []),
      ...lines(values, 'restraint').map((text) => ({ kind: 'para' as const, text })),
      { kind: 'heading', text: 'General' },
      {
        kind: 'para',
        text: 'The employer processes the employee’s personal information only for the employment relationship and as the law requires, in line with the Protection of Personal Information Act 4 of 2013.',
      },
      {
        kind: 'para',
        text: `${v(values, 'documents') ? `The following documents form part of this contract: ${lines(values, 'documents').join('; ')}. ` : ''}This contract may be changed only in writing signed by both parties. Where the law gives the employee better terms than this contract, the law applies.`,
      },
      {
        kind: 'text',
        text: `SIGNED at ${or(v(values, 'place'), 'place')} on ${v(values, 'signDate') ? longDate(v(values, 'signDate')) : 'this ____ day of __________________ 20____'}.`,
      },
      {
        kind: 'signature',
        lines: [`For the employer: ${or(v(values, 'employerName'), 'Employer')}`],
      },
      { kind: 'signature', lines: [`Employee: ${or(v(values, 'employeeName'), 'Employee')}`] },
    ];
    return { title: 'Contract of employment', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const hours = Number(v(values, 'weeklyHours'));
    if (Number.isFinite(hours) && hours > 45) {
      issues.push({
        severity: 'must',
        field: 'weeklyHours',
        message: 'Ordinary hours may not exceed 45 a week.',
        basis: 'BCEA s 9(1)(a)',
      });
    }
    const rate = Number(v(values, 'overtimeRate'));
    if (v(values, 'overtimeRate') && Number.isFinite(rate) && rate < 1.5) {
      issues.push({
        severity: 'must',
        field: 'overtimeRate',
        message: 'Overtime is paid at least 1.5 times the ordinary wage.',
        basis: 'BCEA s 10(2)',
      });
    }
    const days = Number(v(values, 'daysPerWeek')) || 5;
    const minimumLeave = days >= 6 ? 18 : 15;
    const leave = Number(v(values, 'leaveDays'));
    if (v(values, 'leaveDays') && Number.isFinite(leave) && leave < minimumLeave) {
      issues.push({
        severity: 'must',
        field: 'leaveDays',
        message: `Annual leave is at least 21 consecutive days a year, which is ${minimumLeave} working days for a ${days >= 6 ? 'six' : 'five'}-day week.`,
        basis: 'BCEA s 20(2)(a)',
      });
    }
    const start = parseDate(v(values, 'startDate'));
    const end = parseDate(v(values, 'endDate'));
    if (start && end) {
      if (end <= start) {
        issues.push({
          severity: 'must',
          field: 'endDate',
          message: 'The end date must be after the start date.',
        });
      } else if (end.getTime() - start.getTime() > 92 * 86_400_000) {
        issues.push({
          severity: 'should',
          field: 'fixedTermReason',
          message:
            'For an employee earning below the BCEA earnings threshold, a fixed term of more than three months needs a justifiable reason (e.g. a project, seasonal work, replacing an absent employee), stated in the contract; otherwise the employment is treated as indefinite.',
          basis: 'LRA s 198B(3), (4), (10)',
        });
      }
    }
    if (v(values, 'restraint')) {
      issues.push({
        severity: 'note',
        field: 'restraint',
        message:
          'A restraint of trade is enforced only so far as it is reasonable: it must protect a real interest (trade secrets, customer connections) and be limited in time and area.',
        basis: 'Magna Alloys and Research (SA) (Pty) Ltd v Ellis 1984 (4) SA 874 (A)',
      });
    }
    issues.push({
      severity: 'note',
      field: 'salary',
      message:
        'Check the pay against the current national minimum wage and any sectoral determination or bargaining council agreement that applies.',
      basis: 'National Minimum Wage Act 9 of 2018; BCEA s 55',
    });
    return issues;
  },
};
