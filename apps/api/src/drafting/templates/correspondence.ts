// Letters and statutory notices. Standard wording: to be reviewed by an
// admitted attorney (review status "unreviewed" until then).
import type { DraftIssue } from '@ahava88/shared';
import { addBusinessDays, addMonths, longDate, parseDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import { LETTER_FORMAT, APPROVED, letterhead, or, v, type DraftTemplate } from '../template';

export const sender = [
  { key: 'authorName', label: 'Signed by', type: 'text' as const, required: true },
  {
    key: 'authorCapacity',
    label: 'Capacity',
    type: 'text' as const,
    help: 'e.g. Director, Associate',
  },
];

export const letterFields = [
  {
    key: 'letterDate',
    label: 'Date',
    type: 'date' as const,
    required: true,
    prefill: 'today' as const,
  },
  {
    key: 'ourRef',
    label: 'Our reference',
    type: 'text' as const,
    prefill: 'matter.caseNumber' as const,
  },
  { key: 'yourRef', label: 'Your reference', type: 'text' as const },
];

export const signOff = (values: Record<string, string>, firm: string): Block[] => [
  { kind: 'text', text: 'Yours faithfully' },
  {
    kind: 'signature',
    lines: [or(v(values, 'authorName'), 'Name'), v(values, 'authorCapacity'), firm].filter(Boolean),
  },
];

const looksLikeOrganOfState =
  /\b(municipality|metro|department|minister|mec\b|province|provincial|saps|police|government|road accident fund)\b/i;
const looksLikeCredit = /\b(loan|credit|instal(l)?ment|finance|overdraft|credit card|account)\b/i;

// ------------------------------------------------------------ letter of demand

export const letterOfDemand: DraftTemplate = {
  id: 'letter-of-demand',
  version: '2026.11-1',
  name: 'Letter of demand',
  category: 'correspondence',
  purpose:
    'Demands payment or performance by a date, warning that proceedings will follow; sets the debtor in mora and supports a costs order.',
  basis: [
    'Common law (demand and mora)',
    'Prescription Act 68 of 1969 ss 11, 14, 15 (time limits)',
  ],
  review: APPROVED,
  format: LETTER_FORMAT,
  defaults: { deadlineDays: '14', deliveryMethod: 'Email and registered post' },
  sections: [
    { key: 'letter', title: 'Letter', fields: letterFields },
    {
      key: 'recipient',
      title: 'Recipient',
      fields: [
        { key: 'debtorName', label: 'Debtor', type: 'text', required: true },
        { key: 'debtorAddress', label: 'Debtor’s address', type: 'longtext', required: true },
        {
          key: 'deliveryMethod',
          label: 'Delivered by',
          type: 'choice',
          required: true,
          choices: [
            'Email',
            'Registered post',
            'Email and registered post',
            'Hand delivery',
            'Sheriff',
          ],
        },
      ],
    },
    {
      key: 'claim',
      title: 'Claim',
      fields: [
        {
          key: 'clientName',
          label: 'Our client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'cause',
          label: 'What the claim arises from',
          type: 'longtext',
          required: true,
          help: 'The agreement, event or obligation, with dates. Full sentences.',
        },
        { key: 'amount', label: 'Amount claimed (R)', type: 'money' },
        {
          key: 'interest',
          label: 'Interest',
          type: 'text',
          help: 'e.g. at the prescribed rate from 1 March 2026',
        },
        { key: 'performance', label: 'Performance demanded (if not money)', type: 'longtext' },
        { key: 'deadlineDays', label: 'Days to comply', type: 'number', required: true },
        {
          key: 'paymentDetails',
          label: 'Payment details',
          type: 'longtext',
          help: 'Trust account details, with the reference to use.',
        },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const amount = parseRand(v(values, 'amount'));
    const days = Number(v(values, 'deadlineDays') || 14);
    const date = parseDate(v(values, 'letterDate'));
    const deadline = date
      ? longDate(new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10))
      : '';
    const what = amount !== null ? 'pay the amount set out above' : 'perform as set out above';
    const blocks: Block[] = [
      { kind: 'text', text: `By ${v(values, 'deliveryMethod').toLowerCase() || 'email'}` },
      {
        kind: 'heading',
        text: `Letter of demand: ${or(v(values, 'clientName'), 'Client')} / ${or(v(values, 'debtorName'), 'Debtor')}`,
      },
      { kind: 'para', text: `We act for ${or(v(values, 'clientName'), 'Client')} ("our client").` },
      {
        kind: 'para',
        text: `Our client's claim arises as follows: ${or(v(values, 'cause'), 'what the claim arises from')}`,
      },
    ];
    if (amount !== null) {
      blocks.push({
        kind: 'para',
        text: `You are indebted to our client in the amount of ${randWithWords(amount)}${v(values, 'interest') ? `, together with interest ${v(values, 'interest')}` : ''}, which amount is due and payable.`,
      });
    }
    if (v(values, 'performance')) {
      blocks.push({ kind: 'para', text: `Our client requires you to ${v(values, 'performance')}` });
    }
    blocks.push(
      {
        kind: 'para',
        text: `We hereby demand that you ${what} within ${days} days of the date of this letter, that is by no later than ${deadline || '[date]'}.`,
      },
      ...(v(values, 'paymentDetails')
        ? [
            {
              kind: 'para' as const,
              text: `Payment may be made as follows: ${v(values, 'paymentDetails')}`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'Should you fail to do so, we hold instructions to institute legal proceedings against you without further notice, in which event our client will also claim the costs of those proceedings.',
      },
      {
        kind: 'para',
        text: "This letter is written without prejudice to any of our client's rights, all of which remain reserved.",
      },
      ...signOff(values, ctx.firm.legalName),
    );
    return {
      title: 'Letter of demand',
      letterhead: letterhead(ctx, values, [
        or(v(values, 'debtorName'), "Debtor's name"),
        ...v(values, 'debtorAddress').split('\n').filter(Boolean),
      ]),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (!v(values, 'amount') && !v(values, 'performance')) {
      issues.push({
        severity: 'must',
        field: 'amount',
        message: 'State the amount claimed or the performance demanded.',
      });
    }
    const days = Number(v(values, 'deadlineDays'));
    if (Number.isFinite(days) && days > 0 && days < 7) {
      issues.push({
        severity: 'should',
        field: 'deadlineDays',
        message: 'Fewer than 7 days to comply may be found unreasonable; 14 days is usual.',
        basis: 'Practice',
      });
    }
    if (looksLikeCredit.test(v(values, 'cause'))) {
      issues.push({
        severity: 'should',
        field: 'cause',
        message:
          'If this is a credit agreement under the National Credit Act, send the section 129(1)(a) notice instead: enforcement needs it first.',
        basis: 'National Credit Act 34 of 2005 ss 129(1), 130(1)',
      });
    }
    if (looksLikeOrganOfState.test(v(values, 'debtorName'))) {
      issues.push({
        severity: 'should',
        field: 'debtorName',
        message:
          'For a debt (including damages) against an organ of state, serve the section 3 notice within six months of the debt becoming due.',
        basis:
          'Institution of Legal Proceedings against certain Organs of State Act 40 of 2002 s 3',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Check prescription: most debts prescribe after three years. A letter of demand does not interrupt prescription; service of process or an acknowledgment of debt does.',
      basis: 'Prescription Act 68 of 1969 ss 11(d), 14, 15',
    });
    return issues;
  },
};

// ------------------------------------------------------------ NCA s129 notice

export const ncaS129Notice: DraftTemplate = {
  id: 'nca-s129-notice',
  version: '2026.11-1',
  name: 'Section 129(1)(a) default notice (National Credit Act)',
  category: 'correspondence',
  purpose:
    'Draws the consumer’s default to their attention and proposes referral to a debt counsellor, ADR agent, consumer court or ombud, before the agreement is enforced.',
  basis: [
    'National Credit Act 34 of 2005 ss 129(1)(a), 130(1)',
    'Sebola v Standard Bank of South Africa Ltd [2012] ZACC 11',
    'Kubyana v Standard Bank of South Africa Ltd [2014] ZACC 1',
  ],
  review: APPROVED,
  format: LETTER_FORMAT,
  defaults: { deliveryMethod: 'Registered post' },
  sections: [
    { key: 'letter', title: 'Notice', fields: letterFields },
    {
      key: 'consumer',
      title: 'Consumer',
      fields: [
        { key: 'consumerName', label: 'Consumer', type: 'text', required: true },
        {
          key: 'consumerAddress',
          label: 'Address chosen in the agreement',
          type: 'longtext',
          required: true,
          help: 'The address (domicilium) the consumer chose in the agreement for notices.',
        },
        {
          key: 'deliveryMethod',
          label: 'Delivered by',
          type: 'choice',
          required: true,
          choices: ['Registered post', 'Personal delivery', 'Email (chosen in the agreement)'],
        },
      ],
    },
    {
      key: 'agreement',
      title: 'Credit agreement',
      fields: [
        {
          key: 'creditProvider',
          label: 'Credit provider',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'agreement',
          label: 'Agreement',
          type: 'text',
          required: true,
          help: 'e.g. Home loan agreement number 1234567',
        },
        { key: 'arrears', label: 'Arrears (R)', type: 'money', required: true },
        { key: 'arrearsDate', label: 'Arrears as at', type: 'date', required: true },
        {
          key: 'defaultSince',
          label: 'In default since',
          type: 'date',
          help: 'Used to check the 20-business-day default period.',
        },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const arrears = parseRand(v(values, 'arrears'));
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `By ${v(values, 'deliveryMethod').toLowerCase() || 'registered post'}`,
      },
      {
        kind: 'heading',
        text: 'Notice in terms of section 129(1)(a) of the National Credit Act 34 of 2005',
      },
      {
        kind: 'para',
        text: `We act for ${or(v(values, 'creditProvider'), 'Credit provider')} ("the credit provider"), with whom you concluded the following agreement: ${or(v(values, 'agreement'), 'agreement')} ("the agreement").`,
      },
      {
        kind: 'para',
        text: `You are in default under the agreement. As at ${longDate(v(values, 'arrearsDate')) || '[date]'} the arrears amount to ${arrears !== null ? randWithWords(arrears) : '[amount]'}.`,
      },
      {
        kind: 'para',
        text: 'In terms of section 129(1)(a) of the National Credit Act 34 of 2005 ("the Act"), the credit provider draws your default to your notice and proposes that you refer the agreement to a debt counsellor, alternative dispute resolution agent, consumer court or ombud with jurisdiction, with the intent that the parties resolve any dispute under the agreement or develop and agree on a plan to bring the payments under the agreement up to date.',
      },
      {
        kind: 'para',
        text: 'You may also contact us to bring the arrears up to date or to agree on a plan to do so.',
      },
      {
        kind: 'para',
        text: 'If you do not respond, the credit provider may, once the periods in section 130(1) of the Act have passed (at least 10 business days after this notice is delivered to you, and at least 20 business days of default), approach the court for an order to enforce the agreement.',
      },
      {
        kind: 'para',
        text: `This notice is delivered by ${v(values, 'deliveryMethod').toLowerCase() || 'registered post'} to the address you chose in the agreement.`,
      },
      ...signOff(values, ctx.firm.legalName),
    ];
    return {
      title: 'Notice in terms of section 129(1)(a)',
      letterhead: letterhead(ctx, values, [
        or(v(values, 'consumerName'), "Consumer's name"),
        ...v(values, 'consumerAddress').split('\n').filter(Boolean),
      ]),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const sent = v(values, 'letterDate');
    const earliest = sent ? addBusinessDays(sent, 10) : null;
    if (earliest) {
      issues.push({
        severity: 'note',
        message: `If the notice is delivered on ${longDate(sent)}, proceedings may start no earlier than ${longDate(earliest)} (10 business days after delivery); later if delivery is later.`,
        basis: 'National Credit Act s 130(1)(a)',
      });
    }
    const since = v(values, 'defaultSince');
    const twenty = since ? addBusinessDays(since, 20) : null;
    if (twenty) {
      issues.push({
        severity: 'note',
        field: 'defaultSince',
        message: `The consumer must also have been in default for 20 business days: from ${longDate(twenty)}.`,
        basis: 'National Credit Act s 130(1)',
      });
    }
    if (v(values, 'deliveryMethod') === 'Registered post') {
      issues.push({
        severity: 'should',
        field: 'deliveryMethod',
        message:
          'Keep the track-and-trace record showing the notice reached the right post office and that the consumer was notified to collect it; a court will want this proof.',
        basis: 'Sebola [2012] ZACC 11; Kubyana [2014] ZACC 1',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ organ of state s3 notice

export const organOfStateNotice: DraftTemplate = {
  id: 'organ-of-state-s3-notice',
  version: '2026.11-1',
  name: 'Notice of intended legal proceedings to an organ of state',
  category: 'correspondence',
  purpose:
    'The notice required before legal proceedings for the recovery of a debt (including damages) may be instituted against an organ of state.',
  basis: [
    'Institution of Legal Proceedings against certain Organs of State Act 40 of 2002 s 3 (notice within six months), s 4 (service), s 5(2) (30 days before process is served)',
  ],
  review: APPROVED,
  format: LETTER_FORMAT,
  defaults: { serviceMethod: 'By hand' },
  sections: [
    { key: 'letter', title: 'Notice', fields: letterFields },
    {
      key: 'organ',
      title: 'Organ of state',
      fields: [
        { key: 'organName', label: 'Organ of state', type: 'text', required: true },
        {
          key: 'servedOn',
          label: 'Served on',
          type: 'text',
          required: true,
          help: 'The functionary s 4(1) requires, e.g. the Municipal Manager, or the Head of Department.',
        },
        { key: 'organAddress', label: 'Address', type: 'longtext', required: true },
        {
          key: 'serviceMethod',
          label: 'Served by',
          type: 'choice',
          required: true,
          choices: ['By hand', 'Certified mail'],
        },
      ],
    },
    {
      key: 'debt',
      title: 'Debt',
      fields: [
        {
          key: 'claimantName',
          label: 'Claimant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'debtDate',
          label: 'Date the debt became due',
          type: 'date',
          required: true,
          help: 'Usually the date of the incident, or when the claimant knew the facts and the debtor.',
        },
        { key: 'facts', label: 'Facts giving rise to the debt', type: 'longtext', required: true },
        { key: 'amount', label: 'Amount (R), if known', type: 'money' },
        { key: 'particulars', label: 'Other particulars of the debt', type: 'longtext' },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const amount = parseRand(v(values, 'amount'));
    const blocks: Block[] = [
      { kind: 'text', text: `${v(values, 'serviceMethod') || 'By hand'}` },
      {
        kind: 'heading',
        text: 'Notice in terms of section 3(1) of the Institution of Legal Proceedings against certain Organs of State Act 40 of 2002',
      },
      {
        kind: 'para',
        text: `TAKE NOTICE that ${or(v(values, 'claimantName'), 'Claimant')} ("the claimant") intends to institute legal proceedings against ${or(v(values, 'organName'), 'Organ of state')} for the recovery of a debt.`,
      },
      {
        kind: 'para',
        text: `The facts giving rise to the debt are briefly as follows: ${or(v(values, 'facts'), 'facts')}`,
      },
      {
        kind: 'para',
        text: `The debt became due on ${longDate(v(values, 'debtDate')) || '[date]'}.`,
      },
      {
        kind: 'para',
        text: `The particulars of the debt within the claimant's knowledge are: ${amount !== null ? `an amount of ${randWithWords(amount)}` : 'the amount will be quantified when proceedings are instituted'}${v(values, 'particulars') ? `; ${v(values, 'particulars')}` : ''}.`,
      },
      {
        kind: 'para',
        text: `This notice is served ${v(values, 'serviceMethod') === 'Certified mail' ? 'by certified mail' : 'by hand'} on ${or(v(values, 'servedOn'), 'the functionary')} in terms of section 4(1) of the Act.`,
      },
      ...signOff(values, ctx.firm.legalName),
    ];
    return {
      title: 'Notice in terms of section 3(1)',
      letterhead: letterhead(ctx, values, [
        or(v(values, 'servedOn'), 'Functionary'),
        or(v(values, 'organName'), 'Organ of state'),
        ...v(values, 'organAddress').split('\n').filter(Boolean),
      ]),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const due = v(values, 'debtDate');
    const sent = v(values, 'letterDate');
    const limit = due ? addMonths(due, 6) : null;
    if (limit && sent && sent > limit) {
      issues.push({
        severity: 'should',
        field: 'debtDate',
        message: `This notice is late: it had to be served by ${longDate(limit)} (six months after the debt became due). Serve it anyway, and apply for condonation when proceedings are instituted.`,
        basis: 'Act 40 of 2002 s 3(2)(a), s 3(4)',
      });
    } else if (limit) {
      issues.push({
        severity: 'note',
        field: 'debtDate',
        message: `Serve by ${longDate(limit)} at the latest (six months after the debt became due).`,
        basis: 'Act 40 of 2002 s 3(2)(a)',
      });
    }
    issues.push({
      severity: 'note',
      message: 'Process may not be served until 30 days after this notice has been served.',
      basis: 'Act 40 of 2002 s 5(2)',
    });
    return issues;
  },
};
