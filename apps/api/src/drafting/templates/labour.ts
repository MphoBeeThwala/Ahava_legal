// Labour: the referral of a dispute to conciliation (LRA Form 7.11), with
// proof of service and, when it is late, a condonation application.
// Standard wording: to be reviewed by an admitted attorney.
import type { DraftIssue } from '@ahava88/shared';
import { addCalendarDays, longDate } from '../days';
import type { Block } from '../model';
import { AGREEMENT_FORMAT, UNREVIEWED, lines, or, v, type DraftTemplate } from '../template';

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
  review: UNREVIEWED,
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
