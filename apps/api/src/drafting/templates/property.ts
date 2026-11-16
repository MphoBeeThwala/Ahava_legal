// Property: the residential lease, the deed of sale of immovable property and
// the power of attorney to pass transfer. Standard wording: to be reviewed by
// an admitted attorney (and, for transfers, the conveyancer).
import type { DraftField, DraftIssue } from '@ahava88/shared';
import { longDate, parseDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import { AGREEMENT_FORMAT, UNREVIEWED, lines, or, v, type DraftTemplate } from '../template';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const MARITAL = [
  'Unmarried',
  'Married out of community of property',
  'Married in community of property',
  'Company, trust or other entity',
];

const IN_COMMUNITY = 'Married in community of property';

const rand = (values: Values, key: string, placeholder = 'amount') => {
  const cents = parseRand(v(values, key));
  return cents !== null ? randWithWords(cents) : `[${placeholder}]`;
};

const signed = (values: Values) =>
  `SIGNED at ${or(v(values, 'place'), 'place')} on ${v(values, 'signDate') ? longDate(v(values, 'signDate')) : 'this ____ day of __________________ 20____'}.`;

const witnesses: Block[] = [
  { kind: 'text', text: 'AS WITNESSES:' },
  { kind: 'signature', lines: ['1. Full names:'] },
  { kind: 'signature', lines: ['2. Full names:'] },
];

function partyFields(prefix: string, label: string, client = false): DraftField[] {
  return [
    {
      key: `${prefix}Name`,
      label,
      type: 'text',
      required: true,
      ...(client ? { prefill: 'client.name' as const } : {}),
    },
    {
      key: `${prefix}Id`,
      label: 'ID or registration number',
      type: 'id_number',
      ...(client ? { prefill: 'client.idNumber' as const } : {}),
    },
    {
      key: `${prefix}Address`,
      label: 'Address (chosen for notices)',
      type: 'longtext',
      ...(client ? { prefill: 'client.address' as const } : {}),
    },
    {
      key: `${prefix}Marital`,
      label: 'Marital status',
      type: 'choice',
      required: true,
      choices: MARITAL,
    },
    {
      key: `${prefix}Spouse`,
      label: 'Spouse (if married in community of property)',
      type: 'text',
    },
  ];
}

function describe(values: Values, prefix: string, placeholder: string): string {
  const name = or(v(values, `${prefix}Name`), placeholder);
  const id = v(values, `${prefix}Id`);
  const marital = v(values, `${prefix}Marital`);
  const status =
    marital && marital !== 'Company, trust or other entity'
      ? `, ${marital.toLowerCase()}${marital === IN_COMMUNITY && v(values, `${prefix}Spouse`) ? ` with ${v(values, `${prefix}Spouse`)}` : ''}`
      : '';
  return `${name}${id ? ` (identity/registration number ${id})` : ''}${status}`;
}

const property: DraftField[] = [
  {
    key: 'erf',
    label: 'Property description',
    type: 'longtext',
    required: true,
    help: 'As in the title deed, e.g. Erf 123 Sunnyside Township, Registration Division J.R., Province of Gauteng (or Unit 4 in the scheme known as …).',
  },
  {
    key: 'extent',
    label: 'Extent',
    type: 'text',
    help: 'e.g. 495 (four hundred and ninety-five) square metres',
  },
  {
    key: 'titleDeed',
    label: 'Title deed number',
    type: 'text',
    help: 'e.g. T12345/2015 (ST for sectional title)',
  },
  { key: 'streetAddress', label: 'Street address', type: 'text' },
];

function spouseIssues(values: Values, prefix: string, who: string, act: string): DraftIssue[] {
  if (v(values, `${prefix}Marital`) !== IN_COMMUNITY) return [];
  return [
    {
      severity: 'must',
      field: `${prefix}Spouse`,
      message: `The ${who} is married in community of property: the spouse${v(values, `${prefix}Spouse`) ? ` (${v(values, `${prefix}Spouse`)})` : ''} must consent in writing to ${act}, attested by two competent witnesses, or sign as well.`,
      basis: 'Matrimonial Property Act 88 of 1984 s 15(2)(a), (5)',
    },
  ];
}

// ------------------------------------------------------------ residential lease

export const residentialLease: DraftTemplate = {
  id: 'residential-lease',
  version: VERSION,
  name: 'Residential lease',
  category: 'property',
  purpose:
    'Records a residential lease with what the Rental Housing Act requires: the parties, the dwelling, rent and escalation, the deposit in an interest-bearing account, joint inspections and the refund periods.',
  basis: [
    'Rental Housing Act 50 of 1999 s 5 (lease terms, deposit, inspections, refund within 7, 14 or 21 days)',
    'Consumer Protection Act 68 of 2008 s 14 and reg 5 (fixed-term agreements, where the landlord lets in the ordinary course of business)',
    'Property Practitioners Act 22 of 2019 s 70 (mandatory disclosure form, where an agent is involved)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { cpa: 'Yes', dueDay: '1', escalation: '8', noticeMonths: '1' },
  sections: [
    {
      key: 'landlord',
      title: 'Landlord',
      fields: [
        { key: 'landlordName', label: 'Landlord', type: 'text', required: true },
        { key: 'landlordId', label: 'ID or registration number', type: 'id_number' },
        { key: 'landlordAddress', label: 'Address for notices', type: 'longtext', required: true },
      ],
    },
    {
      key: 'tenant',
      title: 'Tenant',
      fields: [
        { key: 'tenantName', label: 'Tenant', type: 'text', required: true },
        { key: 'tenantId', label: 'ID or passport number', type: 'id_number' },
        {
          key: 'tenantAddress',
          label: 'Address for notices (other than the dwelling)',
          type: 'longtext',
        },
        { key: 'occupants', label: 'Other occupants', type: 'text' },
      ],
    },
    {
      key: 'dwelling',
      title: 'Dwelling and period',
      fields: [
        {
          key: 'dwelling',
          label: 'The dwelling',
          type: 'longtext',
          required: true,
          help: 'Address and description, e.g. Flat 12, Oak Court, 5 Main Road, Hatfield, with one parking bay.',
        },
        { key: 'startDate', label: 'Lease begins', type: 'date', required: true },
        { key: 'endDate', label: 'Lease ends (leave empty for month to month)', type: 'date' },
        {
          key: 'noticeMonths',
          label: 'Notice to end a month-to-month lease (months)',
          type: 'number',
        },
        {
          key: 'cpa',
          label: 'Does the landlord let property in the ordinary course of business?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
          help: 'If yes, the Consumer Protection Act applies to a fixed-term lease.',
        },
      ],
    },
    {
      key: 'money',
      title: 'Rent and deposit',
      fields: [
        { key: 'rent', label: 'Monthly rent (R)', type: 'money', required: true },
        { key: 'dueDay', label: 'Rent due on day of the month', type: 'number', required: true },
        { key: 'escalation', label: 'Yearly escalation (%)', type: 'number' },
        { key: 'deposit', label: 'Deposit (R)', type: 'money', required: true },
        { key: 'bank', label: 'Account for rent payments', type: 'longtext' },
        {
          key: 'utilities',
          label: 'Water, electricity and other charges',
          type: 'longtext',
          help: 'Who pays what, and how it is measured.',
        },
      ],
    },
    {
      key: 'terms',
      title: 'House rules and signing',
      fields: [
        {
          key: 'rules',
          label: 'Further terms, one per line',
          type: 'longtext',
          help: 'e.g. pets, parking, subletting.',
        },
        { key: 'agent', label: 'Letting agent (if any)', type: 'text' },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const fixed = Boolean(v(values, 'endDate'));
    const cpa = v(values, 'cpa') === 'Yes';
    const term: Block[] = fixed
      ? [
          {
            kind: 'para',
            text: `The lease begins on ${longDate(v(values, 'startDate')) || '[date]'} and ends on ${longDate(v(values, 'endDate'))}.`,
          },
          ...(cpa
            ? [
                {
                  kind: 'para' as const,
                  text: 'The tenant may cancel this lease at any time on 20 business days’ written notice. The landlord may then charge a reasonable cancellation penalty, as allowed by section 14 of the Consumer Protection Act 68 of 2008 and its regulations. Between 40 and 80 business days before the lease ends, the landlord will notify the tenant in writing of the end of the lease and of any changes on renewal; if the parties do not renew, the lease continues month to month unless either party ends it.',
                },
              ]
            : []),
        ]
      : [
          {
            kind: 'para',
            text: `The lease begins on ${longDate(v(values, 'startDate')) || '[date]'} and continues month to month until either party ends it by ${or(v(values, 'noticeMonths'), '1')} calendar month’s written notice.`,
          },
        ];
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${or(v(values, 'landlordName'), 'Landlord')}${v(values, 'landlordId') ? ` (identity/registration number ${v(values, 'landlordId')})` : ''} ("the landlord") and ${or(v(values, 'tenantName'), 'Tenant')}${v(values, 'tenantId') ? ` (identity number ${v(values, 'tenantId')})` : ''} ("the tenant").`,
      },
      { kind: 'heading', text: 'The dwelling' },
      {
        kind: 'para',
        text: `The landlord lets to the tenant, who hires, the dwelling at ${or(v(values, 'dwelling').split('\n').join(', '), 'dwelling')} ("the dwelling"), to be used only as a home${v(values, 'occupants') ? ` for the tenant and ${v(values, 'occupants')}` : ''}.`,
      },
      { kind: 'heading', text: 'Period' },
      ...term,
      { kind: 'heading', text: 'Rent' },
      {
        kind: 'para',
        text: `The rent is ${rand(values, 'rent')} per month, payable in advance on or before day ${or(v(values, 'dueDay'), '1')} of each month${v(values, 'bank') ? ` into the following account: ${v(values, 'bank').split('\n').join(', ')}` : ''}. The landlord will give the tenant a written receipt for every payment, with the date, the amount and what it is for.`,
      },
      ...(v(values, 'escalation')
        ? [
            {
              kind: 'para' as const,
              text: `The rent increases by ${v(values, 'escalation')}% on each anniversary of the start of the lease.`,
            },
          ]
        : []),
      ...(v(values, 'utilities')
        ? [
            {
              kind: 'para' as const,
              text: `Charges: ${v(values, 'utilities').split('\n').join('; ')}`,
            },
          ]
        : []),
      { kind: 'heading', text: 'Deposit' },
      {
        kind: 'para',
        text: `The tenant pays a deposit of ${rand(values, 'deposit')} before taking occupation. The landlord will invest it in an interest-bearing account with a financial institution, at a rate not less than that institution’s savings rate, and the interest accrues to the tenant. The tenant may ask at any time for written proof of the interest earned.`,
      },
      { kind: 'heading', text: 'Inspections' },
      {
        kind: 'para',
        text: 'The landlord and the tenant will together inspect the dwelling before the tenant moves in, to record any defects or damage in a list attached to this lease, and again within three days before the lease ends.',
      },
      {
        kind: 'para',
        text: 'When the lease ends, the landlord may use the deposit and interest to pay what the tenant owes under this lease, including the reasonable cost of repairing damage (other than fair wear and tear) and of replacing lost keys, and will give the tenant the receipts for those costs. The balance will be refunded within 14 days of the restoration of the dwelling. If nothing is owed, the full deposit and interest will be refunded within seven days after the lease ends. If the tenant does not attend the final inspection after being asked to, the landlord may inspect without the tenant within seven days after the lease ends, and will refund any balance within 21 days after the lease ends.',
      },
      { kind: 'heading', text: 'Use, repairs and access' },
      {
        kind: 'para',
        text: 'The tenant will keep the dwelling clean and in good order, will not make alterations without the landlord’s written consent, and will not sublet or cede this lease without that consent. The landlord will keep the dwelling in a condition fit to live in and do the repairs that are not the tenant’s responsibility.',
      },
      {
        kind: 'para',
        text: 'The landlord may enter the dwelling to inspect it or do repairs at a reasonable time, after giving the tenant reasonable notice.',
      },
      ...lines(values, 'rules').map((text) => ({ kind: 'para' as const, text })),
      { kind: 'heading', text: 'Breach and general' },
      {
        kind: 'para',
        text: 'If a party breaches this lease and does not remedy the breach within 20 business days (or, for unpaid rent, within seven days) of written notice, the other party may cancel it, without affecting any other claim. The landlord may evict the tenant only by order of court.',
      },
      {
        kind: 'para',
        text: 'This lease is the whole agreement between the parties and may be changed only in writing signed by both. The parties choose the addresses above for notices. Each party processes the other’s personal information only for this lease, in line with the Protection of Personal Information Act 4 of 2013.',
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Landlord: ${or(v(values, 'landlordName'), 'Landlord')}`] },
      { kind: 'signature', lines: [`Tenant: ${or(v(values, 'tenantName'), 'Tenant')}`] },
      ...witnesses,
      { kind: 'heading', text: 'Annexure A: Incoming inspection' },
      {
        kind: 'text',
        text: 'Defects and damage found at the joint inspection on ____ __________________ 20____:',
      },
      { kind: 'signature', lines: ['Landlord'] },
      { kind: 'signature', lines: ['Tenant'] },
    ];
    return { title: 'Residential lease agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const start = parseDate(v(values, 'startDate'));
    const end = parseDate(v(values, 'endDate'));
    if (start && end) {
      if (end <= start) {
        issues.push({
          severity: 'must',
          field: 'endDate',
          message: 'The lease must end after it begins.',
        });
      } else if (v(values, 'cpa') === 'Yes') {
        const months =
          (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
          end.getUTCMonth() -
          start.getUTCMonth();
        if (months > 24) {
          issues.push({
            severity: 'should',
            field: 'endDate',
            message:
              'A fixed-term consumer lease may not be longer than 24 months unless the tenant expressly agrees and gets a demonstrable financial benefit; record that benefit or shorten the term.',
            basis: 'Consumer Protection Act s 14(2)(a); reg 5(2)',
          });
        }
      }
    }
    const day = Number(v(values, 'dueDay'));
    if (v(values, 'dueDay') && (!Number.isInteger(day) || day < 1 || day > 28)) {
      issues.push({
        severity: 'should',
        field: 'dueDay',
        message: 'Choose a day from 1 to 28, so that it exists in every month.',
      });
    }
    if (v(values, 'agent')) {
      issues.push({
        severity: 'should',
        field: 'agent',
        message:
          'Where a property practitioner is involved, attach the landlord’s completed mandatory disclosure form to the lease.',
        basis: 'Property Practitioners Act 22 of 2019 ss 67, 70',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Do the incoming inspection with the tenant and complete Annexure A before the tenant moves in; without joint inspections the landlord may lose the right to deduct from the deposit.',
      basis: 'Rental Housing Act 50 of 1999 s 5(3)(e), (f)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ deed of sale

/** Alienation of Land Act s 29A: a natural person buying for R250 000 or less may revoke within five days. */
const COOLING_OFF_LIMIT = 25_000_000;

const naturalPerson = (values: Values, prefix: string) =>
  v(values, `${prefix}Marital`) !== 'Company, trust or other entity';

export const deedOfSale: DraftTemplate = {
  id: 'deed-of-sale',
  version: VERSION,
  name: 'Deed of sale (immovable property)',
  category: 'property',
  purpose:
    'Sells land in writing, signed by both parties: the property, the price and how it is paid or secured, any bond condition, transfer, occupation and the statutory notices.',
  basis: [
    'Alienation of Land Act 68 of 1981 s 2(1) (writing, signed by the parties or their agents on written authority); s 29A (five-day cooling-off); Chapter II (instalment sales)',
    'Matrimonial Property Act 88 of 1984 s 15(2)(a) (spouse’s consent)',
    'Electrical Installation Regulations, 2009 reg 7 (electrical certificate of compliance)',
    'Property Practitioners Act 22 of 2019 ss 67, 70 (mandatory disclosure form)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: {
    bond: 'No',
    payment: 'Cash and guarantees on transfer',
    depositDays: '7',
    guaranteeDays: '30',
    voetstoots: 'Yes',
  },
  sections: [
    { key: 'seller', title: 'Seller', fields: partyFields('seller', 'Seller', true) },
    { key: 'purchaser', title: 'Purchaser', fields: partyFields('purchaser', 'Purchaser') },
    { key: 'property', title: 'The property', fields: property },
    {
      key: 'price',
      title: 'Price and payment',
      fields: [
        { key: 'price', label: 'Purchase price (R)', type: 'money', required: true },
        {
          key: 'payment',
          label: 'How the price is paid',
          type: 'choice',
          required: true,
          choices: ['Cash and guarantees on transfer', 'Instalments'],
        },
        { key: 'deposit', label: 'Deposit (R)', type: 'money' },
        { key: 'depositDays', label: 'Deposit paid within (days of signature)', type: 'number' },
        { key: 'guaranteeDays', label: 'Guarantees for the balance within (days)', type: 'number' },
        {
          key: 'bond',
          label: 'Subject to a bond being granted?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        { key: 'bondAmount', label: 'Bond amount (R)', type: 'money' },
        { key: 'bondDate', label: 'Bond to be approved by', type: 'date' },
      ],
    },
    {
      key: 'transfer',
      title: 'Transfer and occupation',
      fields: [
        {
          key: 'conveyancer',
          label: 'Transferring conveyancer',
          type: 'text',
          required: true,
          prefill: 'firm.legalName',
        },
        { key: 'occupationDate', label: 'Occupation date', type: 'date' },
        {
          key: 'occupationalRent',
          label: 'Occupational rent per month until transfer (R)',
          type: 'money',
        },
        {
          key: 'voetstoots',
          label: 'Sold voetstoots (as it stands)?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
        { key: 'defects', label: 'Defects the seller discloses', type: 'longtext' },
        { key: 'agent', label: 'Estate agent (if any)', type: 'text' },
        { key: 'commission', label: 'Agent’s commission (R, including VAT)', type: 'money' },
        { key: 'terms', label: 'Further terms, one per line', type: 'longtext' },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const price = parseRand(v(values, 'price'));
    const coolingOff =
      naturalPerson(values, 'purchaser') && price !== null && price <= COOLING_OFF_LIMIT;
    const bond = v(values, 'bond') === 'Yes';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${describe(values, 'seller', 'Seller')} ("the seller") and ${describe(values, 'purchaser', 'Purchaser')} ("the purchaser").`,
      },
      { kind: 'heading', text: 'Sale' },
      {
        kind: 'para',
        text: `The seller sells to the purchaser, who buys, ${or(v(values, 'erf').split('\n').join(' '), 'property description')}${v(values, 'extent') ? `, in extent ${v(values, 'extent')}` : ''}${v(values, 'titleDeed') ? `, held under Deed of Transfer ${v(values, 'titleDeed')}` : ''}${v(values, 'streetAddress') ? `, known as ${v(values, 'streetAddress')}` : ''} ("the property"), with its improvements.`,
      },
      { kind: 'heading', text: 'Price' },
      {
        kind: 'para',
        text: `The purchase price is ${rand(values, 'price')}.`,
      },
      ...(v(values, 'deposit')
        ? [
            {
              kind: 'para' as const,
              text: `The purchaser will pay a deposit of ${rand(values, 'deposit')} within ${or(v(values, 'depositDays'), '7')} days of signature into the conveyancer’s trust account, to be invested for the purchaser’s benefit in terms of section 86(4) of the Legal Practice Act 28 of 2014 until transfer.`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: `The purchaser will deliver guarantees from a registered bank or other financial institution acceptable to the seller, for the balance of the price, payable on registration of transfer, within ${or(v(values, 'guaranteeDays'), '30')} days of the request of the conveyancer${bond ? ' or of the bond being granted, whichever is later' : ''}.`,
      },
      ...(bond
        ? [
            { kind: 'heading' as const, text: 'Bond (suspensive condition)' },
            {
              kind: 'para' as const,
              text: `This sale is subject to the purchaser obtaining approval of a loan secured by a mortgage bond over the property for at least ${rand(values, 'bondAmount')} by ${longDate(v(values, 'bondDate')) || '[date]'}. If it is not approved by that date (or a later date the seller agrees to in writing before it), this sale lapses and the deposit and interest are refunded to the purchaser. The purchaser will do everything reasonably required to obtain the loan.`,
            },
          ]
        : []),
      { kind: 'heading', text: 'Transfer and costs' },
      {
        kind: 'para',
        text: `Transfer will be passed by ${or(v(values, 'conveyancer'), 'conveyancer')} as soon as reasonably possible. The purchaser pays the transfer costs, transfer duty (if any) and bond registration costs; the seller pays the cost of cancelling any existing bond and the rates, levies and charges up to the date of registration.`,
      },
      {
        kind: 'para',
        text: 'The seller will, before registration and at the seller’s cost, give the purchaser an electrical certificate of compliance for the property issued within the period the regulations allow, and any other certificates the law or the local authority requires.',
      },
      { kind: 'heading', text: 'Occupation, risk and condition' },
      {
        kind: 'para',
        text: `The purchaser takes occupation on ${longDate(v(values, 'occupationDate')) || 'registration of transfer'}${v(values, 'occupationalRent') ? `, and pays occupational rent of ${rand(values, 'occupationalRent')} per month, in advance, from occupation until registration` : ''}. Risk and benefit in the property pass to the purchaser on registration of transfer.`,
      },
      ...(v(values, 'voetstoots') === 'Yes'
        ? [
            {
              kind: 'para' as const,
              text: 'The property is sold as it stands (voetstoots), and the seller is not liable for defects, except defects the seller knew of and did not disclose.',
            },
          ]
        : []),
      ...(v(values, 'defects')
        ? [
            {
              kind: 'para' as const,
              text: `The seller discloses the following defects: ${v(values, 'defects')}`,
            },
          ]
        : []),
      ...(v(values, 'agent')
        ? [
            {
              kind: 'para' as const,
              text: `The seller pays ${or(v(values, 'agent'), 'agent')} commission of ${rand(values, 'commission')} on registration of transfer. The seller’s mandatory disclosure form is attached and forms part of this agreement.`,
            },
          ]
        : []),
      ...lines(values, 'terms').map((text) => ({ kind: 'para' as const, text })),
      ...(coolingOff
        ? [
            { kind: 'heading' as const, text: 'Cooling-off right' },
            {
              kind: 'para' as const,
              text: 'In terms of section 29A of the Alienation of Land Act 68 of 1981, the purchaser may revoke this offer or terminate this agreement by written notice delivered to the seller or the seller’s agent within five days, excluding Saturdays, Sundays and public holidays, after the purchaser signed it.',
            },
          ]
        : []),
      { kind: 'heading', text: 'Breach and general' },
      {
        kind: 'para',
        text: 'If a party breaches this agreement and does not remedy the breach within seven days of written notice, the other party may claim specific performance or cancel the agreement and claim damages.',
      },
      {
        kind: 'para',
        text: 'This agreement is the whole agreement between the parties and may be changed only in writing signed by both. The parties choose the addresses above for notices and the service of legal process.',
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Seller: ${or(v(values, 'sellerName'), 'Seller')}`] },
      ...(v(values, 'sellerMarital') === IN_COMMUNITY
        ? [
            {
              kind: 'signature' as const,
              lines: [`Seller’s spouse, consenting: ${or(v(values, 'sellerSpouse'), 'spouse')}`],
            },
          ]
        : []),
      ...witnesses,
      { kind: 'signature', lines: [`Purchaser: ${or(v(values, 'purchaserName'), 'Purchaser')}`] },
      ...witnesses,
    ];
    return { title: 'Deed of sale', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    issues.push(...spouseIssues(values, 'seller', 'seller', 'the sale of the property'));
    if (v(values, 'bond') === 'Yes') {
      if (!v(values, 'bondDate')) {
        issues.push({
          severity: 'must',
          field: 'bondDate',
          message: 'A bond condition needs a fixed date by which the bond must be approved.',
        });
      }
      if (!v(values, 'bondAmount')) {
        issues.push({ severity: 'must', field: 'bondAmount', message: 'Enter the bond amount.' });
      }
    }
    const price = parseRand(v(values, 'price'));
    const deposit = parseRand(v(values, 'deposit'));
    if (price !== null && deposit !== null && deposit > price) {
      issues.push({
        severity: 'must',
        field: 'deposit',
        message: 'The deposit is more than the price.',
      });
    }
    if (v(values, 'payment') === 'Instalments') {
      issues.push({
        severity: 'must',
        field: 'payment',
        message:
          'A sale paid in more than two instalments over more than a year is an instalment sale: it must contain what Chapter II of the Act requires, and be recorded against the title deed. This template does not cover that yet; adapt it with the conveyancer.',
        basis: 'Alienation of Land Act 68 of 1981 ss 1, 6, 20',
      });
    }
    if (naturalPerson(values, 'purchaser') && price !== null && price <= COOLING_OFF_LIMIT) {
      issues.push({
        severity: 'note',
        message: 'The price is R250 000 or less: the cooling-off clause has been included.',
        basis: 'Alienation of Land Act 68 of 1981 s 29A',
      });
    }
    if (v(values, 'agent')) {
      issues.push({
        severity: 'should',
        field: 'agent',
        message:
          'Attach the seller’s completed mandatory disclosure form, and check that the agent holds a valid Fidelity Fund certificate before commission is paid.',
        basis: 'Property Practitioners Act 22 of 2019 ss 47, 67, 70',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Both parties (or their agents with written authority) must sign. Check the title deed and any restrictive conditions, servitudes or body corporate rules before the sale is signed.',
      basis: 'Alienation of Land Act 68 of 1981 s 2(1)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ power of attorney to pass transfer

export const poaToPassTransfer: DraftTemplate = {
  id: 'poa-to-pass-transfer',
  version: VERSION,
  name: 'Power of attorney to pass transfer',
  category: 'property',
  purpose:
    'The seller authorises the conveyancer to appear before the Registrar of Deeds and transfer the property to the purchaser.',
  basis: [
    'Deeds Registries Act 47 of 1937 s 20 (transfer by the owner or a conveyancer authorised by power of attorney)',
    'Deeds Registries Regulations (form of the power of attorney; reg 44A preparation)',
    'Matrimonial Property Act 88 of 1984 s 15(2)(a) (spouse’s consent)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    { key: 'seller', title: 'Seller (transferor)', fields: partyFields('seller', 'Seller', true) },
    {
      key: 'purchaser',
      title: 'Purchaser (transferee)',
      fields: partyFields('purchaser', 'Purchaser'),
    },
    { key: 'property', title: 'The property', fields: property },
    {
      key: 'transfer',
      title: 'Conveyancer and sale',
      fields: [
        {
          key: 'conveyancers',
          label: 'Conveyancers appointed',
          type: 'longtext',
          required: true,
          help: 'One name per line; each may act alone, with power of substitution.',
        },
        {
          key: 'registry',
          label: 'Deeds registry',
          type: 'text',
          required: true,
          help: 'e.g. Pretoria, Johannesburg, Cape Town',
        },
        { key: 'saleDate', label: 'Date of the deed of sale', type: 'date', required: true },
        { key: 'price', label: 'Purchase price (R)', type: 'money', required: true },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const conveyancers = lines(values, 'conveyancers');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, the undersigned, ${describe(values, 'seller', 'Seller')}, do hereby nominate, constitute and appoint ${conveyancers.length ? conveyancers.join(' and/or ') : '[conveyancer]'}, each with power of substitution, to be my lawful agent in my name, place and stead, to appear before the Registrar of Deeds at ${or(v(values, 'registry'), 'deeds registry')} and there to declare that I truly and legally sold on ${longDate(v(values, 'saleDate')) || '[date of sale]'}, and that I do hereby cede and transfer, to and on behalf of:`,
      },
      { kind: 'centred', text: describe(values, 'purchaser', 'Purchaser'), bold: true },
      {
        kind: 'text',
        text: 'its or their heirs, executors, administrators or assigns, in full and free property:',
      },
      {
        kind: 'centred',
        text: or(v(values, 'erf').split('\n').join(' '), 'property description'),
        bold: true,
      },
      ...(v(values, 'extent')
        ? [{ kind: 'text' as const, text: `MEASURING: ${v(values, 'extent')}` }]
        : []),
      {
        kind: 'text',
        text: `HELD BY: Deed of Transfer ${or(v(values, 'titleDeed'), 'T_____/____')}`,
      },
      {
        kind: 'text',
        text: `for the sum of ${rand(values, 'price')}; to renounce all the right, title and interest which I had in the property; and in particular to acknowledge that I am no longer entitled to it, the purchaser now being entitled to it; and generally to do whatever may be necessary to effect this transfer, granting all such power as I could exercise if personally present, and ratifying whatever my agent lawfully does under this power of attorney.`,
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Seller: ${or(v(values, 'sellerName'), 'Seller')}`] },
      ...(v(values, 'sellerMarital') === IN_COMMUNITY
        ? [
            {
              kind: 'signature' as const,
              lines: [`Duly assisted by spouse: ${or(v(values, 'sellerSpouse'), 'spouse')}`],
            },
          ]
        : []),
      ...witnesses,
    ];
    return { title: 'Power of attorney to pass transfer', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    issues.push(...spouseIssues(values, 'seller', 'seller', 'the transfer'));
    const deed = v(values, 'titleDeed');
    if (deed && !/^S?T\s?\d+\/\d{4}$/i.test(deed)) {
      issues.push({
        severity: 'should',
        field: 'titleDeed',
        message:
          'A title deed number looks like T12345/2015 (or ST… for sectional title); check it against the deed.',
      });
    }
    if (!deed) {
      issues.push({
        severity: 'must',
        field: 'titleDeed',
        message: 'Enter the title deed number the seller holds the property under.',
      });
    }
    const sale = v(values, 'saleDate');
    const sign = v(values, 'signDate');
    if (sale && sign && sign < sale) {
      issues.push({
        severity: 'must',
        field: 'signDate',
        message: 'The power of attorney is signed after the sale it refers to.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The property description, extent and title deed number must match the title deed and the deed of transfer exactly; the conveyancer confirms the wording against the registry’s current practice before lodgement.',
      basis: 'Deeds Registries Act 47 of 1937; regulation 44A',
    });
    return issues;
  },
};
