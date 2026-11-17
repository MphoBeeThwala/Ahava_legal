// Commercial agreements and practice documents: confidentiality agreement,
// service agreement, shareholders' agreement, company resolution, cession,
// file note, statement of account, reporting letter and bill of costs.
// Standard wording: to be reviewed by an admitted attorney.
import type { DraftIssue } from '@ahava88/shared';
import { longDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import {
  AGREEMENT_FORMAT,
  COURT_FORMAT,
  LETTER_FORMAT,
  UNREVIEWED,
  letterhead,
  lines,
  or,
  v,
  type DraftTemplate,
} from '../template';
import { courtFields, courtHeading } from './court';
import { letterFields, sender, signOff } from './correspondence';
import { attorneysBlock, attorneysFields } from './litigation';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const rand = (cents: number | null, placeholder = 'amount') =>
  cents !== null ? randWithWords(cents) : `[${placeholder}]`;

const signed = (values: Values) =>
  `SIGNED at ${or(v(values, 'place'), 'place')} on ${v(values, 'signDate') ? longDate(v(values, 'signDate')) : 'this ____ day of __________________ 20____'}.`;

const witnesses: Block[] = [
  { kind: 'text', text: 'AS WITNESSES:' },
  { kind: 'signature', lines: ['1. Full names:'] },
  { kind: 'signature', lines: ['2. Full names:'] },
];

const partyFields = (prefix: string, label: string, client = false) => [
  {
    key: `${prefix}Name`,
    label,
    type: 'text' as const,
    required: true,
    ...(client ? { prefill: 'client.name' as const } : {}),
  },
  { key: `${prefix}Reg`, label: 'Registration or ID number', type: 'id_number' as const },
  { key: `${prefix}Address`, label: 'Address for notices', type: 'longtext' as const },
];

const describe = (values: Values, prefix: string, placeholder: string) =>
  `${or(v(values, `${prefix}Name`), placeholder)}${v(values, `${prefix}Reg`) ? ` (${v(values, `${prefix}Reg`)})` : ''}`;

const paraLines = (values: Values, key: string): Block[] =>
  lines(values, key).map((text) => ({ kind: 'para' as const, text }));

/** "date | description | amount" lines. */
function ledger(
  values: Values,
  key: string,
): { date: string; label: string; cents: number | null }[] {
  return lines(values, key).map((line) => {
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length >= 3)
      return { date: parts[0]!, label: parts[1]!, cents: parseRand(parts[2]!) };
    return { date: '', label: parts[0] ?? '', cents: parseRand(parts[1] ?? '') };
  });
}

const sum = (entries: { cents: number | null }[]) =>
  entries.reduce((total, entry) => total + (entry.cents ?? 0), 0);

const ledgerRows = (entries: ReturnType<typeof ledger>): Block[] =>
  entries.map((entry) => ({
    kind: 'text' as const,
    text: `${entry.date ? `${/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? longDate(entry.date) : entry.date}  ` : ''}${entry.label || '[item]'} ........ ${rand(entry.cents)}`,
  }));

const vatOn = (cents: number, rate: number) => Math.round((cents * rate) / 100);

// ------------------------------------------------------------ confidentiality agreement

export const nda: DraftTemplate = {
  id: 'nda',
  version: VERSION,
  name: 'Confidentiality agreement',
  category: 'commercial',
  purpose:
    'Protects confidential information one or both parties share for a stated purpose: use, disclosure, exclusions, return and remedies.',
  basis: [
    'Common law of contract and of unlawful competition',
    'Protection of Personal Information Act 4 of 2013 ss 19–21 (where personal information is shared)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { mutual: 'Mutual', years: '3' },
  sections: [
    { key: 'first', title: 'First party', fields: partyFields('first', 'First party', true) },
    { key: 'second', title: 'Second party', fields: partyFields('second', 'Second party') },
    {
      key: 'terms',
      title: 'Terms',
      fields: [
        {
          key: 'mutual',
          label: 'Who discloses',
          type: 'choice',
          required: true,
          choices: ['Mutual', 'First party only'],
        },
        {
          key: 'purpose',
          label: 'Purpose for which information is shared',
          type: 'longtext',
          required: true,
          help: 'e.g. evaluating a possible acquisition of the second party’s business',
        },
        {
          key: 'years',
          label: 'Confidentiality lasts (years after disclosure)',
          type: 'number',
          required: true,
        },
        {
          key: 'personalInfo',
          label: 'Will personal information be shared?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const mutual = v(values, 'mutual') === 'Mutual';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${describe(values, 'first', 'First party')} and ${describe(values, 'second', 'Second party')}.`,
      },
      { kind: 'heading', text: 'Purpose and confidential information' },
      {
        kind: 'para',
        text: `${mutual ? 'Each party' : 'The first party'} ("the discloser") will share information with ${mutual ? 'the other' : 'the second party'} ("the recipient") only for this purpose: ${or(v(values, 'purpose'), 'purpose')}`,
      },
      {
        kind: 'para',
        text: 'Confidential information is all information, in any form, that the discloser shares with the recipient for the purpose, or that the recipient learns about the discloser’s business, including know-how, finances, customers, prices, plans and the fact and content of the parties’ discussions.',
      },
      { kind: 'heading', text: 'Obligations' },
      {
        kind: 'para',
        text: 'The recipient will keep the confidential information secret, use it only for the purpose, protect it at least as carefully as its own confidential information, and disclose it only to its employees and advisers who need it for the purpose and are bound by confidentiality obligations at least as strict as these.',
      },
      {
        kind: 'para',
        text: 'These obligations do not apply to information that is or becomes public other than through the recipient’s breach, that the recipient already lawfully had, that it receives lawfully from a third party without restriction, or that it must disclose by law or court order (after notifying the discloser where lawful).',
      },
      {
        kind: 'para',
        text: `These obligations last for ${or(v(values, 'years'), 'number')} years after the last disclosure, and for trade secrets for as long as they remain secret.`,
      },
      ...(v(values, 'personalInfo') === 'Yes'
        ? [
            {
              kind: 'para' as const,
              text: 'Where confidential information includes personal information, the recipient processes it only on the discloser’s instructions and for the purpose, keeps it secure with appropriate technical and organisational measures, and notifies the discloser at once of any security compromise, as sections 19 to 21 of the Protection of Personal Information Act 4 of 2013 require.',
            },
          ]
        : []),
      { kind: 'heading', text: 'Return and remedies' },
      {
        kind: 'para',
        text: 'On request, or when the purpose ends, the recipient will return or destroy the confidential information and confirm this in writing. No licence or other right in the information is granted.',
      },
      {
        kind: 'para',
        text: 'Damages may not be an adequate remedy for a breach, and the discloser may apply for an interdict, without affecting any other remedy.',
      },
      {
        kind: 'para',
        text: 'This agreement is the whole agreement on its subject, may be changed only in writing signed by both parties, and is governed by South African law.',
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`For ${or(v(values, 'firstName'), 'the first party')}`] },
      { kind: 'signature', lines: [`For ${or(v(values, 'secondName'), 'the second party')}`] },
    ];
    return { title: 'Confidentiality agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'purpose') && v(values, 'purpose').length < 20) {
      issues.push({
        severity: 'should',
        field: 'purpose',
        message:
          'Describe the purpose precisely: the recipient may use the information only for it.',
      });
    }
    if (v(values, 'personalInfo') === 'Yes') {
      issues.push({
        severity: 'note',
        field: 'personalInfo',
        message:
          'Sharing personal information needs a lawful basis, and cross-border transfers have their own conditions.',
        basis: 'POPIA ss 11, 19–21, 72',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ service agreement

export const serviceAgreement: DraftTemplate = {
  id: 'service-agreement',
  version: VERSION,
  name: 'Service agreement',
  category: 'commercial',
  purpose:
    'Records the services, fees and payment, service levels, term and termination, liability, intellectual property and data protection.',
  basis: [
    'Common law of contract (locatio conductio operis)',
    'Consumer Protection Act 68 of 2008 ss 14, 48–52 (where the client is a consumer)',
    'Protection of Personal Information Act 4 of 2013',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { consumer: 'No', paymentDays: '30', noticeDays: '30' },
  sections: [
    {
      key: 'provider',
      title: 'Service provider',
      fields: partyFields('provider', 'Service provider', true),
    },
    { key: 'customer', title: 'Customer', fields: partyFields('customer', 'Customer') },
    {
      key: 'services',
      title: 'Services and fees',
      fields: [
        { key: 'services', label: 'Services, one per line', type: 'longtext', required: true },
        { key: 'levels', label: 'Service levels or deliverables, one per line', type: 'longtext' },
        {
          key: 'fee',
          label: 'Fees',
          type: 'longtext',
          required: true,
          help: 'e.g. R15 000 per month plus VAT, or R850 per hour',
        },
        {
          key: 'paymentDays',
          label: 'Invoices paid within (days)',
          type: 'number',
          required: true,
        },
        { key: 'startDate', label: 'Start date', type: 'date', required: true },
        {
          key: 'endDate',
          label: 'End date (leave empty to continue until terminated)',
          type: 'date',
        },
        { key: 'noticeDays', label: 'Notice to terminate (days)', type: 'number', required: true },
        {
          key: 'liabilityCap',
          label: 'Liability cap',
          type: 'text',
          help: 'e.g. the fees paid in the 12 months before the claim',
        },
        {
          key: 'consumer',
          label: 'Is the customer a consumer under the CPA?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const consumer = v(values, 'consumer') === 'Yes';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${describe(values, 'provider', 'Service provider')} ("the provider") and ${describe(values, 'customer', 'Customer')} ("the customer").`,
      },
      { kind: 'heading', text: 'Services' },
      {
        kind: 'para',
        text: 'The provider will provide the following services with due skill, care and diligence, in line with good industry practice:',
      },
      ...lines(values, 'services').map((text) => ({ kind: 'text' as const, text: `• ${text}` })),
      ...(lines(values, 'levels').length
        ? [
            {
              kind: 'para' as const,
              text: `Service levels and deliverables: ${lines(values, 'levels').join('; ')}.`,
            },
          ]
        : []),
      { kind: 'heading', text: 'Fees and payment' },
      {
        kind: 'para',
        text: `The customer pays ${or(v(values, 'fee'), 'fees')}. The provider invoices monthly in arrears, and the customer pays each invoice within ${or(v(values, 'paymentDays'), '30')} days. Late amounts bear interest at the prescribed rate.`,
      },
      { kind: 'heading', text: 'Term and termination' },
      {
        kind: 'para',
        text: `This agreement starts on ${longDate(v(values, 'startDate')) || '[date]'} and ${v(values, 'endDate') ? `ends on ${longDate(v(values, 'endDate'))}` : 'continues until terminated'}. Either party may terminate it on ${or(v(values, 'noticeDays'), '30')} days’ written notice, or at once if the other party commits a material breach and does not remedy it within 14 days of written notice.`,
      },
      ...(consumer
        ? [
            {
              kind: 'para' as const,
              text: 'Because the customer is a consumer, the customer may also cancel a fixed-term agreement on 20 business days’ notice, subject to a reasonable cancellation charge, as section 14 of the Consumer Protection Act 68 of 2008 allows.',
            },
          ]
        : []),
      { kind: 'heading', text: 'Liability' },
      {
        kind: 'para',
        text: `${consumer ? 'To the extent the Consumer Protection Act allows, ' : ''}neither party is liable for indirect or consequential loss, and each party’s total liability under this agreement is limited to ${v(values, 'liabilityCap') || 'the fees paid in the 12 months before the claim'}. This does not limit liability for gross negligence, wilful misconduct or breach of confidentiality.`,
      },
      { kind: 'heading', text: 'Intellectual property, confidentiality and data' },
      {
        kind: 'para',
        text: 'Each party keeps its existing intellectual property. Deliverables created specifically for the customer belong to the customer once paid for. Each party keeps the other’s confidential information secret. Where the provider processes personal information for the customer, it does so only on the customer’s instructions and with appropriate security measures, as the Protection of Personal Information Act 4 of 2013 requires.',
      },
      { kind: 'heading', text: 'General' },
      {
        kind: 'para',
        text: 'This agreement is the whole agreement, may be changed only in writing signed by both parties, may not be ceded without consent, and is governed by South African law.',
      },
      { kind: 'text', text: signed(values) },
      {
        kind: 'signature',
        lines: [`For the provider: ${or(v(values, 'providerName'), 'provider')}`],
      },
      {
        kind: 'signature',
        lines: [`For the customer: ${or(v(values, 'customerName'), 'customer')}`],
      },
    ];
    return { title: 'Service agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'consumer') === 'Yes') {
      issues.push({
        severity: 'should',
        field: 'liabilityCap',
        message:
          'For a consumer, limitation and indemnity clauses must be drawn to the consumer’s attention in plain language and must not be unfair; some are prohibited outright.',
        basis: 'Consumer Protection Act ss 22, 48, 49, 51',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ shareholders' agreement

export function shareholders(values: Values): { name: string; shares: number }[] {
  return lines(values, 'shareholders').map((line) => {
    const [name = '', shares = ''] = line.split('|').map((part) => part.trim());
    return { name, shares: Number(shares.replace(/\s/g, '')) };
  });
}

export const shareholdersAgreement: DraftTemplate = {
  id: 'shareholders-agreement',
  version: VERSION,
  name: 'Shareholders’ agreement',
  category: 'commercial',
  purpose:
    'Regulates the shareholders’ relationship: shareholding, board, reserved matters, transfers, deadlock and exit, consistent with the company’s MOI.',
  basis: [
    'Companies Act 71 of 2008 s 15(7) (consistent with the Act and the MOI; inconsistent terms are void)',
    'Companies Act s 15(2), (6) (the MOI binds the company and shareholders)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'company',
      title: 'Company and shareholders',
      fields: [
        { key: 'company', label: 'Company', type: 'text', required: true },
        { key: 'companyReg', label: 'Registration number', type: 'text', required: true },
        {
          key: 'shareholders',
          label: 'Shareholders, one per line: name | number of shares',
          type: 'longtext',
          required: true,
        },
        {
          key: 'directors',
          label: 'Board: who may appoint directors',
          type: 'longtext',
          required: true,
          help: 'e.g. each shareholder holding at least 25% may appoint one director.',
        },
      ],
    },
    {
      key: 'terms',
      title: 'Terms',
      fields: [
        {
          key: 'reserved',
          label: 'Reserved matters needing shareholder approval, one per line',
          type: 'longtext',
          required: true,
          help: 'e.g. issuing shares; borrowing over R500 000; changing the business.',
        },
        {
          key: 'reservedMajority',
          label: 'Approval needed for reserved matters',
          type: 'text',
          required: true,
          help: 'e.g. 75% of the shares',
        },
        {
          key: 'transfers',
          label: 'Transfer restrictions',
          type: 'choice',
          required: true,
          choices: ['Pre-emption with tag and drag', 'Pre-emption only', 'Board consent'],
        },
        { key: 'dividends', label: 'Dividend policy', type: 'text' },
        {
          key: 'deadlock',
          label: 'Deadlock resolution',
          type: 'text',
          help: 'e.g. mediation, then a shotgun (buy-sell) offer',
        },
        { key: 'restraint', label: 'Restraint on shareholders', type: 'text' },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const holders = shareholders(values);
    const issued = holders.reduce(
      (total, holder) => total + (Number.isFinite(holder.shares) ? holder.shares : 0),
      0,
    );
    const transfer: Record<string, string> = {
      'Pre-emption with tag and drag':
        'A shareholder who wants to sell shares must first offer them to the other shareholders pro rata, at the same price and terms. If shareholders holding more than 75% of the shares accept a bona fide offer for all the shares, they may require the others to sell on the same terms (drag-along), and any shareholder may require a buyer of a controlling stake to buy its shares on the same terms (tag-along).',
      'Pre-emption only':
        'A shareholder who wants to sell shares must first offer them to the other shareholders pro rata, at the same price and terms, before selling to anyone else.',
      'Board consent': 'No shares may be transferred without the board’s prior written consent.',
    };
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between the shareholders listed below and ${or(v(values, 'company'), 'Company')} (registration number ${or(v(values, 'companyReg'), 'number')}) ("the company").`,
      },
      { kind: 'heading', text: 'Shareholding' },
      ...holders.map((holder) => ({
        kind: 'text' as const,
        text: `${holder.name || '[shareholder]'}: ${Number.isFinite(holder.shares) ? holder.shares : '[number]'} shares${issued > 0 && Number.isFinite(holder.shares) ? ` (${((holder.shares / issued) * 100).toFixed(2)}%)` : ''}`,
      })),
      { kind: 'heading', text: 'Board' },
      { kind: 'para', text: or(v(values, 'directors'), 'board appointments') },
      { kind: 'heading', text: 'Reserved matters' },
      {
        kind: 'para',
        text: `The company will not do any of the following without the approval of ${or(v(values, 'reservedMajority'), 'the agreed majority')}: ${lines(values, 'reserved').join('; ') || '[reserved matters]'}.`,
      },
      { kind: 'heading', text: 'Transfer of shares' },
      { kind: 'para', text: transfer[v(values, 'transfers')] ?? '[transfer terms]' },
      ...(v(values, 'dividends')
        ? [
            { kind: 'heading' as const, text: 'Dividends' },
            { kind: 'para' as const, text: v(values, 'dividends') },
          ]
        : []),
      { kind: 'heading', text: 'Deadlock' },
      {
        kind: 'para',
        text:
          v(values, 'deadlock') ||
          'If the shareholders or the board cannot agree on a matter twice in a row, they will refer it to mediation, and if that fails within 30 days, to arbitration.',
      },
      ...(v(values, 'restraint')
        ? [
            { kind: 'heading' as const, text: 'Restraint' },
            { kind: 'para' as const, text: v(values, 'restraint') },
          ]
        : []),
      { kind: 'heading', text: 'Relationship with the MOI' },
      {
        kind: 'para',
        text: 'This agreement must be read with the company’s Memorandum of Incorporation. To the extent any term is inconsistent with the Companies Act 71 of 2008 or the Memorandum of Incorporation, it is void to that extent, and the shareholders will vote to amend the Memorandum of Incorporation where needed to give effect to this agreement.',
      },
      {
        kind: 'para',
        text: 'This agreement is the whole agreement among the parties on its subject, and may be changed only in writing signed by all of them. A new shareholder must sign a deed of adherence before shares are registered in its name.',
      },
      { kind: 'text', text: signed(values) },
      ...holders.map((holder) => ({
        kind: 'signature' as const,
        lines: [holder.name || 'Shareholder'],
      })),
      { kind: 'signature', lines: [`For the company: ${or(v(values, 'company'), 'Company')}`] },
    ];
    return { title: 'Shareholders’ agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (
      shareholders(values).some(
        (holder) => !holder.name || !Number.isFinite(holder.shares) || holder.shares <= 0,
      )
    ) {
      issues.push({
        severity: 'must',
        field: 'shareholders',
        message: 'Give each shareholder as "name | number of shares".',
      });
    }
    if (shareholders(values).length < 2) {
      issues.push({
        severity: 'should',
        field: 'shareholders',
        message: 'A shareholders’ agreement needs at least two shareholders.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Check every term against the MOI: a term inconsistent with the Act or the MOI is void, so amend the MOI first where needed (by special resolution, filed with CIPC).',
      basis: 'Companies Act 71 of 2008 ss 15(7), 16',
    });
    return issues;
  },
};

// ------------------------------------------------------------ company resolution

export const companyResolution: DraftTemplate = {
  id: 'company-resolution',
  version: VERSION,
  name: 'Board or shareholders’ resolution',
  category: 'commercial',
  purpose:
    'Records a decision of the board or of the shareholders, taken at a meeting or in writing.',
  basis: [
    'Companies Act 71 of 2008 s 73 (board meetings), s 74 (written board resolutions)',
    's 60 (written shareholder resolutions: within 20 business days), s 65 (ordinary resolutions: more than 50%; special resolutions: at least 75%)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: {
    body: 'Board of directors',
    method: 'Written resolution',
    kind: 'Ordinary resolution',
  },
  sections: [
    {
      key: 'company',
      title: 'Company',
      fields: [
        { key: 'company', label: 'Company', type: 'text', required: true, prefill: 'client.name' },
        { key: 'companyReg', label: 'Registration number', type: 'text', required: true },
        {
          key: 'body',
          label: 'Resolution of the',
          type: 'choice',
          required: true,
          choices: ['Board of directors', 'Shareholders'],
        },
        {
          key: 'method',
          label: 'Taken',
          type: 'choice',
          required: true,
          choices: ['Written resolution', 'At a meeting'],
        },
        { key: 'meetingDate', label: 'Meeting date (if at a meeting)', type: 'date' },
        {
          key: 'kind',
          label: 'Kind (shareholders)',
          type: 'choice',
          choices: ['Ordinary resolution', 'Special resolution'],
        },
      ],
    },
    {
      key: 'resolution',
      title: 'Resolution',
      fields: [
        { key: 'background', label: 'Background (optional)', type: 'longtext' },
        {
          key: 'resolved',
          label: 'Resolved, one point per line',
          type: 'longtext',
          required: true,
        },
        { key: 'authorised', label: 'Person authorised to sign documents', type: 'text' },
        {
          key: 'signatories',
          label: 'Directors or shareholders signing, one per line',
          type: 'longtext',
          required: true,
        },
      ],
    },
  ],
  build(values) {
    const board = v(values, 'body') !== 'Shareholders';
    const written = v(values, 'method') !== 'At a meeting';
    const kind = board ? '' : `${(v(values, 'kind') || 'Ordinary resolution').toUpperCase()}: `;
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `${kind}${written ? 'Written resolution' : 'Resolution'} of the ${board ? 'board of directors' : 'shareholders'} of ${or(v(values, 'company'), 'Company')} (registration number ${or(v(values, 'companyReg'), 'number')}) ("the company")${written ? `, adopted in terms of section ${board ? '74' : '60'} of the Companies Act 71 of 2008` : `, passed at a meeting held on ${longDate(v(values, 'meetingDate')) || '[date]'} at which a quorum was present`}.`,
      },
      ...(v(values, 'background')
        ? [
            { kind: 'heading' as const, text: 'Background' },
            { kind: 'para' as const, text: v(values, 'background') },
          ]
        : []),
      { kind: 'heading', text: 'It is resolved that' },
      ...paraLines(values, 'resolved'),
      ...(v(values, 'authorised')
        ? [
            {
              kind: 'para' as const,
              text: `${v(values, 'authorised')} is authorised to sign all documents and do everything necessary to give effect to this resolution.`,
            },
          ]
        : []),
      ...lines(values, 'signatories').map((name) => ({
        kind: 'signature' as const,
        lines: [name, 'Date:'],
      })),
    ];
    return {
      title: board ? 'Resolution of the board of directors' : 'Resolution of the shareholders',
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const board = v(values, 'body') !== 'Shareholders';
    const written = v(values, 'method') !== 'At a meeting';
    if (!written && !v(values, 'meetingDate')) {
      issues.push({
        severity: 'must',
        field: 'meetingDate',
        message: 'Enter the date of the meeting.',
      });
    }
    if (written) {
      issues.push({
        severity: 'note',
        field: 'signatories',
        message: board
          ? 'A written board resolution needs every director to have been given notice, and the support of a majority of the directors entitled to vote.'
          : 'A written shareholders’ resolution must be submitted to every shareholder entitled to vote and is adopted if supported by the required percentage within 20 business days.',
        basis: board ? 'Companies Act s 74(1)' : 'Companies Act s 60(1)',
      });
    }
    if (
      !board &&
      /\b(MOI|memorandum|financial assistance|section 4[45]|greater part|dispose|amalgamat|merge|winding|name change|change the name)\b/i.test(
        v(values, 'resolved'),
      ) &&
      v(values, 'kind') !== 'Special resolution'
    ) {
      issues.push({
        severity: 'should',
        field: 'kind',
        message:
          'This looks like a matter that needs a special resolution (at least 75% of the voting rights exercised, unless the MOI sets a different percentage).',
        basis: 'Companies Act ss 16, 44, 45, 65(11), 112, 115',
      });
    }
    if (!board && v(values, 'kind') === 'Special resolution') {
      issues.push({
        severity: 'note',
        field: 'kind',
        message:
          'Some special resolutions (e.g. amending the MOI or changing the name) must be filed with CIPC before they take effect.',
        basis: 'Companies Act s 16',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ cession

export const cession: DraftTemplate = {
  id: 'cession',
  version: VERSION,
  name: 'Deed of cession',
  category: 'commercial',
  purpose:
    'Transfers a right (for example book debts or an insurance policy) from the cedent to the cessionary, outright or as security for a debt.',
  basis: [
    'Common law of cession',
    'Grobler v Oosthuizen 2009 (5) SA 500 (SCA) (cession in securitatem debiti)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { kind: 'As security (in securitatem debiti)' },
  sections: [
    { key: 'cedent', title: 'Cedent', fields: partyFields('cedent', 'Cedent', true) },
    { key: 'cessionary', title: 'Cessionary', fields: partyFields('cessionary', 'Cessionary') },
    {
      key: 'right',
      title: 'Right ceded',
      fields: [
        {
          key: 'kind',
          label: 'Kind of cession',
          type: 'choice',
          required: true,
          choices: ['Outright', 'As security (in securitatem debiti)'],
        },
        {
          key: 'rights',
          label: 'Rights ceded',
          type: 'longtext',
          required: true,
          help: 'e.g. all the cedent’s present and future book debts; or policy no … with … Life Ltd',
        },
        { key: 'securedDebt', label: 'Debt secured (if as security)', type: 'longtext' },
        { key: 'consideration', label: 'Consideration (if outright) (R)', type: 'money' },
        {
          key: 'notifyDebtors',
          label: 'Notify the debtors now?',
          type: 'choice',
          choices: ['No', 'Yes'],
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const security = v(values, 'kind') !== 'Outright';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${describe(values, 'cedent', 'Cedent')} ("the cedent") and ${describe(values, 'cessionary', 'Cessionary')} ("the cessionary").`,
      },
      {
        kind: 'para',
        text: `The cedent cedes to the cessionary ${security ? 'as security for the debt described below' : 'outright'} all its right, title and interest in and to ${or(v(values, 'rights'), 'the rights ceded')}`,
      },
      ...(security
        ? [
            {
              kind: 'para' as const,
              text: `This cession secures ${or(v(values, 'securedDebt'), 'the debt secured')}`,
            },
            {
              kind: 'para' as const,
              text: 'When the secured debt has been paid in full, the ceded rights revert to the cedent automatically, and the cessionary will on request confirm this in writing and notify any debtor it has notified.',
            },
          ]
        : [
            {
              kind: 'para' as const,
              text: `The consideration for the cession is ${rand(parseRand(v(values, 'consideration')), 'consideration')}.`,
            },
          ]),
      {
        kind: 'para',
        text: 'The cedent warrants that the rights exist, that it is entitled to cede them, that they have not been ceded or pledged to anyone else, and that it will not deal with them in conflict with this cession.',
      },
      {
        kind: 'para',
        text: `${v(values, 'notifyDebtors') === 'Yes' ? 'The cessionary may notify the debtors of the cession now.' : 'The cessionary may notify the debtors of the cession at any time; until then, the cedent may collect in the ordinary course of business'}${security && v(values, 'notifyDebtors') !== 'Yes' ? ' and will hold what it collects for the cessionary once the cedent is in default' : ''}. The cedent will give the cessionary the documents and information it reasonably needs to enforce the rights.`,
      },
      { kind: 'para', text: 'This deed may be changed only in writing signed by both parties.' },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Cedent: ${or(v(values, 'cedentName'), 'cedent')}`] },
      {
        kind: 'signature',
        lines: [`Cessionary: ${or(v(values, 'cessionaryName'), 'cessionary')}`],
      },
      ...witnesses,
    ];
    return {
      title: security ? 'Deed of cession in securitatem debiti' : 'Deed of cession',
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'kind') !== 'Outright' && !v(values, 'securedDebt')) {
      issues.push({
        severity: 'must',
        field: 'securedDebt',
        message: 'Identify the debt the cession secures.',
      });
    }
    if (/\bpolicy\b/i.test(v(values, 'rights'))) {
      issues.push({
        severity: 'note',
        field: 'rights',
        message:
          'Notify the insurer of a policy cession and have it recorded; check whether the policy limits cession.',
        basis: 'Long-term Insurance Act 52 of 1998 / Insurance Act 18 of 2017; the policy terms',
      });
    }
    issues.push({
      severity: 'note',
      message: 'Check the underlying contracts for a ban on cession (pactum de non cedendo).',
      basis: 'Common law of cession',
    });
    return issues;
  },
};

// ------------------------------------------------------------ file note

export const fileNote: DraftTemplate = {
  id: 'file-note',
  version: VERSION,
  name: 'File and attendance note',
  category: 'practice',
  purpose:
    'Records an attendance, call, meeting or instruction on the file, with who was there, what was said and done, the time spent and what follows.',
  basis: [
    'LPC Code of Conduct (keeping proper records)',
    'Legal Practice Act 28 of 2014 s 35 (fees supported by records)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { kind: 'Telephone call' },
  sections: [
    {
      key: 'note',
      title: 'Attendance',
      fields: [
        {
          key: 'matter',
          label: 'Matter',
          type: 'text',
          required: true,
          prefill: 'matter.caseNumber',
        },
        { key: 'noteDate', label: 'Date', type: 'date', required: true, prefill: 'today' },
        {
          key: 'kind',
          label: 'Kind',
          type: 'choice',
          required: true,
          choices: [
            'Telephone call',
            'Meeting',
            'Consultation',
            'Court attendance',
            'Perusal',
            'Other',
          ],
        },
        { key: 'present', label: 'Present or spoke to', type: 'text', required: true },
        { key: 'minutes', label: 'Time spent (minutes)', type: 'number', required: true },
        {
          key: 'notes',
          label: 'What was discussed, advised and instructed, one point per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'actions',
          label: 'Follow-up actions, one per line (who and by when)',
          type: 'longtext',
        },
        { key: 'author', label: 'Recorded by', type: 'text', required: true },
      ],
    },
  ],
  build(values) {
    const minutes = Number(v(values, 'minutes'));
    const units = Number.isFinite(minutes) && minutes > 0 ? Math.ceil(minutes / 6) : null;
    const blocks: Block[] = [
      { kind: 'text', text: `Matter: ${or(v(values, 'matter'), 'matter')}` },
      { kind: 'text', text: `Date: ${longDate(v(values, 'noteDate')) || '[date]'}` },
      {
        kind: 'text',
        text: `Attendance: ${or(v(values, 'kind'), 'kind')} with ${or(v(values, 'present'), 'who')}`,
      },
      {
        kind: 'text',
        text: `Time: ${Number.isFinite(minutes) && minutes > 0 ? `${minutes} minutes (${units} unit${units === 1 ? '' : 's'} of 6 minutes)` : '[time]'}`,
      },
      { kind: 'heading', text: 'Notes' },
      ...paraLines(values, 'notes'),
      ...(lines(values, 'actions').length
        ? [
            { kind: 'heading' as const, text: 'Follow-up' },
            ...lines(values, 'actions').map((text) => ({
              kind: 'text' as const,
              text: `• ${text}`,
            })),
          ]
        : []),
      { kind: 'signature', lines: [`Recorded by: ${or(v(values, 'author'), 'author')}`] },
    ];
    return { title: 'Attendance note', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (/\badvis/i.test(v(values, 'notes')) === false && v(values, 'kind') === 'Consultation') {
      issues.push({
        severity: 'should',
        field: 'notes',
        message: 'Record the advice given and the client’s instructions in a consultation note.',
      });
    }
    issues.push({
      severity: 'note',
      field: 'minutes',
      message: 'Record the time in Time as well, so it can be billed (whole 6-minute units).',
    });
    return issues;
  },
};

// ------------------------------------------------------------ statement of account

export const statementOfAccount: DraftTemplate = {
  id: 'statement-of-account',
  version: VERSION,
  name: 'Statement of account',
  category: 'practice',
  purpose:
    'Shows the client the fees and disbursements charged, VAT, payments received, trust money held and the balance.',
  basis: [
    'Legal Practice Act 28 of 2014 ss 35, 86 (fees; trust money)',
    'LPC Rules (accounting); Value-Added Tax Act 89 of 1991 (15%)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { vatRate: '15' },
  sections: [
    {
      key: 'account',
      title: 'Account',
      fields: [
        {
          key: 'clientName',
          label: 'Client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'matter',
          label: 'Matter',
          type: 'text',
          required: true,
          prefill: 'matter.caseNumber',
        },
        {
          key: 'statementDate',
          label: 'Statement date',
          type: 'date',
          required: true,
          prefill: 'today',
        },
        {
          key: 'fees',
          label: 'Fees, one per line: date | description | amount (excl. VAT)',
          type: 'longtext',
          required: true,
        },
        {
          key: 'disbursements',
          label: 'Disbursements, one per line: date | description | amount',
          type: 'longtext',
        },
        {
          key: 'payments',
          label: 'Payments received, one per line: date | description | amount',
          type: 'longtext',
        },
        { key: 'trust', label: 'Trust money held for the client (R)', type: 'money' },
        { key: 'vatRate', label: 'VAT rate (%)', type: 'number', required: true },
        { key: 'bank', label: 'Payment details', type: 'longtext' },
      ],
    },
  ],
  build(values, ctx) {
    const fees = ledger(values, 'fees');
    const disbursements = ledger(values, 'disbursements');
    const payments = ledger(values, 'payments');
    const rate = Number(v(values, 'vatRate')) || 0;
    const feeTotal = sum(fees);
    const vat = vatOn(feeTotal, rate);
    const charged = feeTotal + vat + sum(disbursements);
    const balance = charged - sum(payments);
    const trust = parseRand(v(values, 'trust'));
    const blocks: Block[] = [
      { kind: 'text', text: `${ctx.firm.legalName}` },
      { kind: 'text', text: `Client: ${or(v(values, 'clientName'), 'client')}` },
      { kind: 'text', text: `Matter: ${or(v(values, 'matter'), 'matter')}` },
      { kind: 'text', text: `Date: ${longDate(v(values, 'statementDate') || ctx.today)}` },
      { kind: 'heading', text: 'Fees' },
      ...ledgerRows(fees),
      { kind: 'text', text: `Fees ........ ${randWithWords(feeTotal)}`, bold: true },
      { kind: 'text', text: `VAT at ${rate}% ........ ${randWithWords(vat)}` },
      { kind: 'heading', text: 'Disbursements' },
      ...(disbursements.length
        ? ledgerRows(disbursements)
        : [{ kind: 'text' as const, text: 'None.' }]),
      { kind: 'heading', text: 'Payments received' },
      ...(payments.length ? ledgerRows(payments) : [{ kind: 'text' as const, text: 'None.' }]),
      { kind: 'text', text: `Total charged ........ ${randWithWords(charged)}`, bold: true },
      {
        kind: 'text',
        text: `${balance >= 0 ? 'Balance due by the client' : 'Balance in the client’s favour'} ........ ${randWithWords(Math.abs(balance))}`,
        bold: true,
      },
      ...(trust !== null
        ? [
            {
              kind: 'para' as const,
              text: `We hold ${randWithWords(trust)} in trust for you. Trust money is applied to our account only with your authority or as the rules allow.`,
            },
          ]
        : []),
      ...(v(values, 'bank')
        ? [
            {
              kind: 'para' as const,
              text: `Payment details: ${v(values, 'bank').split('\n').join(', ')}`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'Please contact us within 14 days if you have any query about this statement. You may ask for the fees to be assessed by the Legal Practice Council or taxed.',
      },
    ];
    return { title: 'Statement of account', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    for (const key of ['fees', 'disbursements', 'payments']) {
      if (ledger(values, key).some((entry) => entry.cents === null)) {
        issues.push({
          severity: 'must',
          field: key,
          message: 'Give an amount on each line, as "date | description | amount".',
        });
      }
    }
    if (Number(v(values, 'vatRate')) !== 15) {
      issues.push({
        severity: 'should',
        field: 'vatRate',
        message: 'The standard VAT rate is 15%; use 0 only if the firm is not a VAT vendor.',
        basis: 'Value-Added Tax Act 89 of 1991 s 7',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ reporting letter

export const reportingLetter: DraftTemplate = {
  id: 'reporting-letter',
  version: VERSION,
  name: 'Reporting letter to client',
  category: 'correspondence',
  purpose:
    'Reports to the client on progress, advice and next steps, the costs so far against the estimate, and what the client must do.',
  basis: [
    'LPC Code of Conduct (keeping the client informed)',
    'Legal Practice Act 28 of 2014 s 35(7) (cost estimates)',
  ],
  review: UNREVIEWED,
  format: LETTER_FORMAT,
  sections: [
    { key: 'letter', title: 'Letter', fields: letterFields },
    {
      key: 'client',
      title: 'Client',
      fields: [
        {
          key: 'clientName',
          label: 'Client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'clientAddress',
          label: 'Address or email',
          type: 'longtext',
          prefill: 'client.email',
        },
        {
          key: 'matterName',
          label: 'Matter',
          type: 'text',
          required: true,
          prefill: 'matter.title',
        },
      ],
    },
    {
      key: 'report',
      title: 'Report',
      fields: [
        {
          key: 'progress',
          label: 'What has happened, one point per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'advice',
          label: 'Our advice, one point per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'nextSteps',
          label: 'Next steps and dates, one per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'clientAction',
          label: 'What we need from the client, one per line',
          type: 'longtext',
        },
        { key: 'costsToDate', label: 'Costs to date (R)', type: 'money' },
        { key: 'estimate', label: 'Current estimate of total costs (R)', type: 'money' },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const toDate = parseRand(v(values, 'costsToDate'));
    const estimate = parseRand(v(values, 'estimate'));
    const bullets = (key: string): Block[] =>
      lines(values, key).map((text) => ({ kind: 'text' as const, text: `• ${text}` }));
    const blocks: Block[] = [
      { kind: 'text', text: `Dear ${or(v(values, 'clientName'), 'client')}` },
      { kind: 'heading', text: `Report: ${or(v(values, 'matterName'), 'matter')}` },
      { kind: 'para', text: 'We report on the progress of your matter.' },
      { kind: 'heading', text: 'Progress' },
      ...bullets('progress'),
      { kind: 'heading', text: 'Our advice' },
      ...bullets('advice'),
      { kind: 'heading', text: 'Next steps' },
      ...bullets('nextSteps'),
      ...(lines(values, 'clientAction').length
        ? [{ kind: 'heading' as const, text: 'What we need from you' }, ...bullets('clientAction')]
        : []),
      ...(toDate !== null || estimate !== null
        ? [
            { kind: 'heading' as const, text: 'Costs' },
            {
              kind: 'para' as const,
              text: `${toDate !== null ? `Our fees and disbursements to date amount to ${randWithWords(toDate)}. ` : ''}${estimate !== null ? `Our current estimate of the total cost is ${randWithWords(estimate)}. It is an estimate, and we will tell you if it changes.` : ''}`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'Please contact us if you have any questions or if your instructions change.',
      },
      ...signOff(values, ctx.firm.legalName),
    ];
    return {
      title: 'Report to client',
      letterhead: letterhead(ctx, values, [
        or(v(values, 'clientName'), 'Client'),
        ...v(values, 'clientAddress').split('\n').filter(Boolean),
      ]),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const toDate = parseRand(v(values, 'costsToDate'));
    const estimate = parseRand(v(values, 'estimate'));
    if (toDate !== null && estimate !== null && toDate > estimate) {
      issues.push({
        severity: 'should',
        field: 'estimate',
        message:
          'Costs to date exceed the estimate: give the client a revised estimate and the reasons.',
        basis: 'Legal Practice Act 28 of 2014 s 35(7)',
      });
    }
    if (!v(values, 'estimate')) {
      issues.push({
        severity: 'note',
        field: 'estimate',
        message: 'Consider updating the client on the estimated costs.',
        basis: 'Legal Practice Act s 35(7)',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ bill of costs

export const billOfCosts: DraftTemplate = {
  id: 'bill-of-costs',
  version: VERSION,
  name: 'Bill of costs',
  category: 'engagement',
  purpose:
    'Sets out the costs awarded item by item, with the tariff item, fee and disbursement, for taxation by the taxing master.',
  basis: [
    'Uniform Rule 70 and the tariff (First Schedule)',
    'Uniform Rule 67A (scales A, B and C for counsel)',
    'Magistrates’ Courts Rules, rule 33 and tariff (lower courts)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { scale: 'Party and party', vatRate: '15' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        { ...courtFields[1]!, required: true },
        { key: 'firstParty', label: 'Plaintiff / applicant', type: 'text', required: true },
        { key: 'secondParty', label: 'Defendant / respondent', type: 'text', required: true },
        { key: 'orderDate', label: 'Date of the costs order', type: 'date', required: true },
        {
          key: 'scale',
          label: 'Scale',
          type: 'choice',
          required: true,
          choices: ['Party and party', 'Attorney and client'],
        },
        {
          key: 'counselScale',
          label: 'Counsel’s scale (Rule 67A)',
          type: 'choice',
          choices: ['Not applicable', 'Scale A', 'Scale B', 'Scale C'],
        },
      ],
    },
    {
      key: 'items',
      title: 'Items',
      fields: [
        {
          key: 'items',
          label: 'Items, one per line: date | description (tariff item) | fee | disbursement',
          type: 'longtext',
          required: true,
          help: 'e.g. 2026-03-01 | Drawing combined summons (item A2) | 1200 | 0',
        },
        { key: 'vatRate', label: 'VAT rate on fees (%)', type: 'number', required: true },
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const items = lines(values, 'items').map((line) => {
      const [date = '', label = '', fee = '', disbursement = ''] = line
        .split('|')
        .map((part) => part.trim());
      return { date, label, fee: parseRand(fee) ?? 0, disbursement: parseRand(disbursement) ?? 0 };
    });
    const fees = items.reduce((total, item) => total + item.fee, 0);
    const disbursements = items.reduce((total, item) => total + item.disbursement, 0);
    const rate = Number(v(values, 'vatRate')) || 0;
    const vat = vatOn(fees, rate);
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `Bill of costs on the ${(v(values, 'scale') || 'party and party').toLowerCase()} scale, in terms of the order of ${longDate(v(values, 'orderDate')) || '[date]'}${v(values, 'counselScale') && v(values, 'counselScale') !== 'Not applicable' ? `, counsel’s fees on ${v(values, 'counselScale')}` : ''}.`,
      },
      ...items.map((item, index) => ({
        kind: 'text' as const,
        text: `${index + 1}. ${/^\d{4}-\d{2}-\d{2}$/.test(item.date) ? longDate(item.date) : item.date}  ${item.label || '[item]'} ........ fee ${randWithWords(item.fee)}${item.disbursement ? `; disbursement ${randWithWords(item.disbursement)}` : ''}`,
      })),
      { kind: 'text', text: `Total fees ........ ${randWithWords(fees)}`, bold: true },
      { kind: 'text', text: `VAT at ${rate}% on fees ........ ${randWithWords(vat)}` },
      { kind: 'text', text: `Total disbursements ........ ${randWithWords(disbursements)}` },
      {
        kind: 'text',
        text: `TOTAL ........ ${randWithWords(fees + vat + disbursements)}`,
        bold: true,
      },
      { kind: 'text', text: 'Taxed off: ________   Allowed: ________' },
      { kind: 'signature', lines: ['TAXING MASTER'] },
      ...attorneysBlock(values, 'party'),
    ];
    return {
      title: 'Bill of costs',
      heading: courtHeading(values, ctx, ['Plaintiff', 'Defendant']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const bad = lines(values, 'items').filter((line) => line.split('|').length < 3);
    if (bad.length) {
      issues.push({
        severity: 'must',
        field: 'items',
        message: 'Give each item as "date | description | fee | disbursement".',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Serve a notice of intention to tax with the bill and keep vouchers for every disbursement; charge only items the order and the tariff allow.',
      basis: 'Uniform Rule 70; Magistrates’ Courts Rules, rule 33',
    });
    return issues;
  },
};
