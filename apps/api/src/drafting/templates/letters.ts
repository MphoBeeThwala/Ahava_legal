// More letters: the without-prejudice settlement offer and the notice of
// breach. Standard wording: to be reviewed by an admitted attorney.
import type { DraftIssue } from '@ahava88/shared';
import { addBusinessDays, longDate, parseDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import { LETTER_FORMAT, APPROVED, letterhead, lines, or, v, type DraftTemplate } from '../template';
import { letterFields, sender, signOff } from './correspondence';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const recipient = (label: string) => ({
  key: 'recipient',
  title: 'Recipient',
  fields: [
    { key: 'toName', label, type: 'text' as const, required: true },
    {
      key: 'toAddress',
      label: 'Address or email',
      type: 'longtext' as const,
      required: true,
    },
  ],
});

const to = (values: Values) => [
  or(v(values, 'toName'), 'Recipient'),
  ...v(values, 'toAddress').split('\n').filter(Boolean),
];

const calendarDaysAfter = (from: string, days: number) => {
  const date = parseDate(from);
  return date ? new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10) : '';
};

// ------------------------------------------------------------ without-prejudice offer

export const withoutPrejudiceOffer: DraftTemplate = {
  id: 'without-prejudice-offer',
  version: VERSION,
  name: 'Without-prejudice settlement offer',
  category: 'correspondence',
  purpose:
    'Proposes a settlement in a letter that cannot be used against the client as an admission, open for a fixed time.',
  basis: [
    'Common law privilege for genuine settlement negotiations (Naidoo v Marine & Trade Insurance Co Ltd 1978 (3) SA 666 (A))',
    'Exception: an admission of insolvency is not protected (KLD Residential CC v Empire Earth Investments 17 (Pty) Ltd 2017 (6) SA 55 (SCA))',
    'Uniform Rule 34 (formal offers to settle once proceedings have begun)',
  ],
  review: APPROVED,
  format: LETTER_FORMAT,
  defaults: { openDays: '14', side: 'Pay' },
  sections: [
    { key: 'letter', title: 'Letter', fields: letterFields },
    recipient('Addressed to (the other party or its attorneys)'),
    {
      key: 'offer',
      title: 'The offer',
      fields: [
        {
          key: 'clientName',
          label: 'Our client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'dispute',
          label: 'The dispute',
          type: 'longtext',
          required: true,
          help: 'One sentence, e.g. your client’s claim for damages arising from the collision on 3 May 2026.',
        },
        {
          key: 'side',
          label: 'Our client offers to',
          type: 'choice',
          required: true,
          choices: ['Pay', 'Accept'],
        },
        { key: 'amount', label: 'Amount (R)', type: 'money' },
        {
          key: 'terms',
          label: 'Other terms, one per line',
          type: 'longtext',
          help: 'e.g. payment within 30 days of acceptance; each party pays its own costs.',
        },
        {
          key: 'openDays',
          label: 'Offer open for (days)',
          type: 'number',
          required: true,
        },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const date = v(values, 'letterDate') || ctx.today;
    const closes = calendarDaysAfter(date, Number(v(values, 'openDays')) || 14);
    const amount = parseRand(v(values, 'amount'));
    const pays = v(values, 'side') !== 'Accept';
    const blocks: Block[] = [
      { kind: 'centred', text: 'WITHOUT PREJUDICE', bold: true },
      {
        kind: 'heading',
        text: `Settlement proposal: ${or(v(values, 'clientName'), 'Client')} / ${or(v(values, 'toName'), 'Recipient')}`,
      },
      { kind: 'para', text: `We act for ${or(v(values, 'clientName'), 'Client')} ("our client").` },
      {
        kind: 'para',
        text: `We refer to ${or(v(values, 'dispute'), 'the dispute')} ${pays ? 'Our client denies liability. Nevertheless, to avoid the cost and inconvenience of litigation, and without admitting liability, our client' : 'Our client remains confident of its claim. Nevertheless, to avoid the cost and delay of litigation, our client'} makes the following offer in full and final settlement of all claims arising from this matter:`,
      },
      ...(amount !== null
        ? [
            {
              kind: 'para' as const,
              text: pays
                ? `Our client will pay ${randWithWords(amount)}.`
                : `Our client will accept payment of ${randWithWords(amount)}.`,
            },
          ]
        : []),
      ...lines(values, 'terms').map((text) => ({ kind: 'para' as const, text })),
      {
        kind: 'para',
        text: `This offer is open for acceptance in writing until ${longDate(closes) || '[date]'}, after which it lapses without further notice.`,
      },
      {
        kind: 'para',
        text: 'This letter is written without prejudice, in a genuine attempt to settle the dispute. It may not be disclosed to any court or tribunal, and our client’s rights are fully reserved if the offer is not accepted.',
      },
      ...signOff(values, ctx.firm.legalName),
    ];
    return {
      title: 'Without-prejudice offer',
      letterhead: letterhead(ctx, values, to(values)),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (!v(values, 'amount') && !lines(values, 'terms').length) {
      issues.push({
        severity: 'must',
        field: 'amount',
        message: 'Set out what is offered: an amount, other terms, or both.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The privilege protects only a genuine attempt to settle, and not an admission that the client cannot pay its debts. Once proceedings have begun, consider a formal Rule 34 offer, which affects costs.',
      basis: 'Naidoo 1978 (3) SA 666 (A); KLD Residential 2017 (6) SA 55 (SCA); Uniform Rule 34',
    });
    return issues;
  },
};

// ------------------------------------------------------------ notice of breach

export const noticeOfBreach: DraftTemplate = {
  id: 'notice-of-breach',
  version: VERSION,
  name: 'Notice of breach and cancellation',
  category: 'correspondence',
  purpose:
    'Places the other party on terms to remedy a breach within the period the agreement allows, failing which the agreement is cancelled.',
  basis: [
    'The agreement’s breach clause (lex commissoria)',
    'Common law: cancellation for material breach; mora and notice making time of the essence',
    'Consumer Protection Act 68 of 2008 s 14(2)(b)(ii) (20 business days to remedy, fixed-term consumer agreements)',
  ],
  review: APPROVED,
  format: LETTER_FORMAT,
  defaults: { remedyDays: '7', consumer: 'No', onFailure: 'Cancel the agreement' },
  sections: [
    { key: 'letter', title: 'Letter', fields: letterFields },
    recipient('The party in breach'),
    {
      key: 'agreement',
      title: 'The agreement and the breach',
      fields: [
        {
          key: 'clientName',
          label: 'Our client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'agreement',
          label: 'The agreement',
          type: 'text',
          required: true,
          help: 'e.g. the lease agreement concluded on 1 March 2026 for Shop 4, Main Road Centre',
        },
        {
          key: 'clause',
          label: 'Breach clause (number and what it says)',
          type: 'longtext',
          help: 'e.g. clause 18: 7 days’ written notice to remedy, failing which the innocent party may cancel. Leave empty if there is none.',
        },
        {
          key: 'breach',
          label: 'The breach, one point per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'remedy',
          label: 'What must be done to remedy it',
          type: 'longtext',
          required: true,
        },
        {
          key: 'remedyDays',
          label: 'Days to remedy',
          type: 'number',
          required: true,
        },
        {
          key: 'businessDays',
          label: 'Are those business days?',
          type: 'choice',
          choices: ['No', 'Yes'],
        },
        {
          key: 'consumer',
          label: 'Fixed-term consumer agreement (Consumer Protection Act)?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        {
          key: 'onFailure',
          label: 'If not remedied, our client will',
          type: 'choice',
          required: true,
          choices: ['Cancel the agreement', 'Claim performance'],
        },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const date = v(values, 'letterDate') || ctx.today;
    const days = Number(v(values, 'remedyDays')) || 7;
    const business = v(values, 'businessDays') === 'Yes' || v(values, 'consumer') === 'Yes';
    const last = business ? addBusinessDays(date, days) : calendarDaysAfter(date, days);
    const cancel = v(values, 'onFailure') !== 'Claim performance';
    const clause = v(values, 'clause');
    const blocks: Block[] = [
      {
        kind: 'heading',
        text: `Notice of breach: ${or(v(values, 'agreement'), 'the agreement')}`,
      },
      { kind: 'para', text: `We act for ${or(v(values, 'clientName'), 'Client')} ("our client").` },
      {
        kind: 'para',
        text: `We refer to ${or(v(values, 'agreement'), 'the agreement')} between you and our client ("the agreement").`,
      },
      { kind: 'para', text: 'You are in breach of the agreement, in that:' },
      ...lines(values, 'breach').map((text) => ({ kind: 'text' as const, text: `• ${text}` })),
      {
        kind: 'para',
        text: `${clause ? `In terms of ${clause.split(/[:\n]/)[0]} of the agreement, you` : 'You'} are hereby called upon to remedy the breach within ${days} ${business ? 'business ' : ''}days of the date of this notice, that is by no later than ${longDate(last ?? '') || '[date]'}, by: ${or(v(values, 'remedy'), 'what must be done')}`,
      },
      {
        kind: 'para',
        text: cancel
          ? 'Should you fail to remedy the breach within that period, the agreement will be cancelled without further notice, and our client will claim the damages it has suffered, together with the costs of any proceedings.'
          : 'Should you fail to remedy the breach within that period, our client will institute proceedings to enforce the agreement and claim the damages it has suffered, together with costs.',
      },
      {
        kind: 'para',
        text: 'Our client’s rights are fully reserved, including its right to claim damages for the breach already committed. Any indulgence our client gives does not waive those rights.',
      },
      ...signOff(values, ctx.firm.legalName),
    ];
    return { title: 'Notice of breach', letterhead: letterhead(ctx, values, to(values)), blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const days = Number(v(values, 'remedyDays'));
    if (v(values, 'consumer') === 'Yes' && Number.isFinite(days) && days < 20) {
      issues.push({
        severity: 'must',
        field: 'remedyDays',
        message:
          'Before cancelling a fixed-term consumer agreement for the consumer’s breach, the supplier must give 20 business days’ written notice to remedy it.',
        basis: 'Consumer Protection Act 68 of 2008 s 14(2)(b)(ii)',
      });
    }
    if (!v(values, 'clause') && v(values, 'onFailure') === 'Cancel the agreement') {
      issues.push({
        severity: 'should',
        field: 'clause',
        message:
          'Without a breach clause, cancellation needs a material breach. For late performance, this notice must give a reasonable period and make time of the essence; check that the period is reasonable.',
        basis: 'Common law (mora ex persona; material breach)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Deliver the notice exactly as the agreement requires (to the chosen address, by the stated method) and keep proof of delivery. Check whether a credit agreement needs a section 129 notice instead.',
      basis: 'The agreement’s notice clause; National Credit Act s 129',
    });
    return issues;
  },
};
