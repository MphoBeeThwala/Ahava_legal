// Property, conveyancing and estates: commercial lease, deed of transfer,
// mortgage bond, notarial deed of servitude, codicil, reporting an estate
// to the Master, and the liquidation and distribution account. Standard
// wording: to be reviewed by an admitted attorney (and the conveyancer or
// notary where the deeds office is involved).
import type { DraftIssue } from '@ahava88/shared';
import { longDate, parseDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import {
  AGREEMENT_FORMAT,
  LETTER_FORMAT,
  APPROVED,
  letterhead,
  lines,
  or,
  v,
  type DraftTemplate,
} from '../template';
import { letterFields, sender, signOff } from './correspondence';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

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

const oneLine = (values: Values, key: string, placeholder: string) =>
  or(v(values, key).split('\n').filter(Boolean).join(' '), placeholder);

/** "item | R amount" lines → entries with cents. */
function amounts(
  values: Values,
  key: string,
): { label: string; cents: number | null; rest: string[] }[] {
  return lines(values, key).map((line) => {
    const [label = '', amount = '', ...rest] = line.split('|').map((part) => part.trim());
    return { label, cents: parseRand(amount), rest };
  });
}

const total = (entries: { cents: number | null }[]) =>
  entries.reduce((sum, entry) => sum + (entry.cents ?? 0), 0);

/** The extent must appear in words and figures (deeds office practice, regulation 29). */
const extentInWordsAndFigures = (extent: string) =>
  /\d/.test(extent) && /\([a-z\s-]+\)/i.test(extent);

const titleDeedPattern = /^S?T\s?\d+\/\d{4}$/i;

const propertyFields = [
  {
    key: 'erf',
    label: 'Property description',
    type: 'longtext' as const,
    required: true,
    help: 'As in the title deed, e.g. ERF 123 SUNNYSIDE TOWNSHIP, REGISTRATION DIVISION J.R., PROVINCE OF GAUTENG',
  },
  {
    key: 'extent',
    label: 'Extent, in figures and words',
    type: 'text' as const,
    required: true,
    help: 'e.g. 495 (FOUR HUNDRED AND NINETY FIVE) square metres',
  },
  {
    key: 'titleDeed',
    label: 'Title deed number',
    type: 'text' as const,
    required: true,
    help: 'e.g. T12345/2015',
  },
];

function propertyChecks(values: Values): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const extent = v(values, 'extent');
  if (extent && !extentInWordsAndFigures(extent)) {
    issues.push({
      severity: 'must',
      field: 'extent',
      message:
        'Give the extent in figures and in words, e.g. 495 (FOUR HUNDRED AND NINETY FIVE) square metres.',
      basis: 'Deeds Registries Regulations, reg 29',
    });
  }
  const deed = v(values, 'titleDeed');
  if (deed && !titleDeedPattern.test(deed)) {
    issues.push({
      severity: 'should',
      field: 'titleDeed',
      message:
        'A title deed number looks like T12345/2015 (ST… for sectional title); check it against the deed.',
    });
  }
  return issues;
}

const conveyancerNote: DraftIssue = {
  severity: 'note',
  message:
    'Prepared by a conveyancer (or notary) who signs the preparation certificate with their LPC number; compare the wording with the deeds registry’s current practice and the prior title before lodgement.',
  basis: 'Deeds Registries Act 47 of 1937; Deeds Registries Regulations, regs 43, 44A',
};

// ------------------------------------------------------------ commercial lease

export const commercialLease: DraftTemplate = {
  id: 'commercial-lease',
  version: VERSION,
  name: 'Commercial lease',
  category: 'property',
  purpose:
    'Records the terms of a lease of business premises: premises, use, period, rent and escalation, operating costs, deposit or guarantee, and renewal.',
  basis: [
    'Common law of lease (huur gaat voor koop)',
    'Formalities in respect of Leases of Land Act 18 of 1969 s 1 (leases of ten years or more bind creditors and successors beyond ten years only if registered)',
    'Consumer Protection Act 68 of 2008 (where the tenant is a consumer, including small juristic persons below the threshold)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  defaults: { escalation: '8', vat: 'Yes' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        { key: 'landlordName', label: 'Landlord', type: 'text', required: true },
        { key: 'landlordReg', label: 'Landlord’s registration or ID number', type: 'id_number' },
        { key: 'tenantName', label: 'Tenant', type: 'text', required: true },
        { key: 'tenantReg', label: 'Tenant’s registration or ID number', type: 'id_number' },
        { key: 'surety', label: 'Surety for the tenant (if any)', type: 'text' },
      ],
    },
    {
      key: 'premises',
      title: 'Premises and period',
      fields: [
        {
          key: 'premises',
          label: 'Premises',
          type: 'longtext',
          required: true,
          help: 'e.g. Shop 4, Main Road Centre, 12 Main Road, Hatfield, Pretoria, about 120 m²',
        },
        { key: 'use', label: 'Permitted use', type: 'text', required: true },
        { key: 'startDate', label: 'Start date', type: 'date', required: true },
        { key: 'years', label: 'Period (years)', type: 'number', required: true },
        {
          key: 'renewal',
          label: 'Option to renew',
          type: 'text',
          help: 'e.g. one further period of 3 years on 6 months’ written notice, rent to be agreed or set by an expert',
        },
      ],
    },
    {
      key: 'money',
      title: 'Rent and costs',
      fields: [
        {
          key: 'rent',
          label: 'Monthly rent, first year (R, excluding VAT)',
          type: 'money',
          required: true,
        },
        {
          key: 'vat',
          label: 'Is the landlord a VAT vendor?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
        { key: 'escalation', label: 'Yearly escalation (%)', type: 'number', required: true },
        {
          key: 'costs',
          label: 'Operating costs, rates, utilities: who pays what',
          type: 'longtext',
          required: true,
        },
        { key: 'deposit', label: 'Deposit or bank guarantee (R)', type: 'money' },
        {
          key: 'terms',
          label: 'Further terms, one per line',
          type: 'longtext',
          help: 'e.g. fit-out, signage, trading hours, insurance.',
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const vat = v(values, 'vat') === 'Yes';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${or(v(values, 'landlordName'), 'Landlord')}${v(values, 'landlordReg') ? ` (${v(values, 'landlordReg')})` : ''} ("the landlord") and ${or(v(values, 'tenantName'), 'Tenant')}${v(values, 'tenantReg') ? ` (${v(values, 'tenantReg')})` : ''} ("the tenant").`,
      },
      { kind: 'heading', text: 'Premises and use' },
      {
        kind: 'para',
        text: `The landlord lets to the tenant, who hires, ${oneLine(values, 'premises', 'premises')} ("the premises"), to be used only for ${or(v(values, 'use'), 'permitted use')}. The tenant must obtain any licence its business needs.`,
      },
      { kind: 'heading', text: 'Period' },
      {
        kind: 'para',
        text: `The lease begins on ${longDate(v(values, 'startDate')) || '[date]'} and runs for ${or(v(values, 'years'), 'number')} year(s).${v(values, 'renewal') ? ` Renewal: ${v(values, 'renewal')}.` : ''}`,
      },
      { kind: 'heading', text: 'Rent' },
      {
        kind: 'para',
        text: `The rent is ${rand(values, 'rent')} per month${vat ? ', plus VAT' : ''}, payable in advance on or before the first day of each month without deduction or set-off, and increases by ${or(v(values, 'escalation'), '[%]')}% on each anniversary of the start date.`,
      },
      {
        kind: 'para',
        text: `Operating costs and charges: ${or(v(values, 'costs').split('\n').join('; '), 'who pays what')}.`,
      },
      ...(v(values, 'deposit')
        ? [
            {
              kind: 'para' as const,
              text: `Before taking occupation, the tenant provides a deposit or bank guarantee of ${rand(values, 'deposit')}, which the landlord may use for amounts the tenant owes, and returns the balance after the lease ends and the premises are handed back in good order.`,
            },
          ]
        : []),
      { kind: 'heading', text: 'Maintenance, alterations and insurance' },
      {
        kind: 'para',
        text: 'The tenant keeps the interior of the premises in good order and returns it in the same condition, fair wear and tear excepted. The landlord maintains the structure, roof and common areas. No alterations may be made without the landlord’s written consent. Each party insures its own property.',
      },
      ...lines(values, 'terms').map((text) => ({ kind: 'para' as const, text })),
      { kind: 'heading', text: 'Breach' },
      {
        kind: 'para',
        text: 'If the tenant fails to pay any amount on its due date, or breaches any other term and does not remedy it within seven days of written notice, the landlord may cancel the lease, take possession through due legal process, and claim arrears and damages, without affecting its landlord’s hypothec.',
      },
      { kind: 'heading', text: 'General' },
      {
        kind: 'para',
        text: 'This lease is the whole agreement and may be changed only in writing signed by both parties. The tenant may not sublet or cede without the landlord’s written consent. The parties choose their addresses for notices as recorded in the schedule.',
      },
      { kind: 'text', text: signed(values) },
      {
        kind: 'signature',
        lines: [`For the landlord: ${or(v(values, 'landlordName'), 'Landlord')}`],
      },
      { kind: 'signature', lines: [`For the tenant: ${or(v(values, 'tenantName'), 'Tenant')}`] },
      ...witnesses,
    ];
    return { title: 'Lease of business premises', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const years = Number(v(values, 'years'));
    if (Number.isFinite(years) && years >= 10) {
      issues.push({
        severity: 'should',
        field: 'years',
        message:
          'A lease of ten years or more (including renewals) must be notarially executed and registered against the title deed to bind the landlord’s creditors and successors beyond ten years.',
        basis: 'Formalities in respect of Leases of Land Act 18 of 1969 s 1',
      });
    }
    if (v(values, 'surety')) {
      issues.push({
        severity: 'note',
        field: 'surety',
        message:
          'Use the deed of suretyship template for the surety; it must be in writing and signed by the surety.',
        basis: 'General Law Amendment Act 50 of 1956 s 6',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'If the tenant is a consumer under the Consumer Protection Act (e.g. a small business below the threshold), its fixed-term and unfair-terms rules apply.',
      basis: 'Consumer Protection Act 68 of 2008 ss 5, 14, 48',
    });
    return issues;
  },
};

// ------------------------------------------------------------ deed of transfer

export const deedOfTransfer: DraftTemplate = {
  id: 'deed-of-transfer',
  version: VERSION,
  name: 'Deed of transfer',
  category: 'property',
  purpose:
    'Transfers ownership of land: the conveyancer appears before the Registrar under the seller’s power of attorney and transfers the property to the purchaser.',
  basis: [
    'Deeds Registries Act 47 of 1937 ss 15, 15A, 20',
    'Deeds Registries Regulations, regs 26, 29 (extent in words and figures), 43 (preparation certificate), and the prescribed form',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        { key: 'conveyancer', label: 'Appearing conveyancer', type: 'text', required: true },
        { key: 'registry', label: 'Deeds registry', type: 'text', required: true },
        { key: 'sellerName', label: 'Transferor (seller)', type: 'text', required: true },
        {
          key: 'sellerDetails',
          label: 'Transferor’s ID or registration number and marital status',
          type: 'text',
          required: true,
        },
        { key: 'poaDate', label: 'Date of the power of attorney', type: 'date', required: true },
        { key: 'purchaserName', label: 'Transferee (purchaser)', type: 'text', required: true },
        {
          key: 'purchaserDetails',
          label: 'Transferee’s ID or registration number and marital status',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      key: 'property',
      title: 'The property',
      fields: [
        ...propertyFields,
        { key: 'saleDate', label: 'Date of sale', type: 'date', required: true },
        { key: 'price', label: 'Purchase price (R)', type: 'money', required: true },
        {
          key: 'conditions',
          label: 'Conditions of title carried forward, one per line',
          type: 'longtext',
          help: 'As in the prior title deed.',
        },
      ],
    },
  ],
  build(values) {
    const conditions = lines(values, 'conditions');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `BE IT HEREBY MADE KNOWN THAT ${or(v(values, 'conveyancer'), 'conveyancer')} appeared before me, the REGISTRAR OF DEEDS at ${or(v(values, 'registry'), 'registry').toUpperCase()}, the said appearer being duly authorised thereto by a power of attorney granted by ${or(v(values, 'sellerName'), 'transferor')} (${or(v(values, 'sellerDetails'), 'details')}) and signed on ${longDate(v(values, 'poaDate')) || '[date]'};`,
      },
      {
        kind: 'text',
        text: `AND THE APPEARER DECLARED that the said principal truly and legally sold the property described below on ${longDate(v(values, 'saleDate')) || '[date]'}, and that the appearer, in that capacity, does hereby cede and transfer, in full and free property, to and on behalf of:`,
      },
      {
        kind: 'centred',
        text: `${or(v(values, 'purchaserName'), 'transferee')} (${or(v(values, 'purchaserDetails'), 'details')})`,
        bold: true,
      },
      { kind: 'text', text: 'its or their heirs, executors, administrators or assigns:' },
      {
        kind: 'centred',
        text: oneLine(values, 'erf', 'property description').toUpperCase(),
        bold: true,
      },
      { kind: 'text', text: `MEASURING ${or(v(values, 'extent'), 'extent in figures and words')}` },
      {
        kind: 'text',
        text: `HELD BY Deed of Transfer ${or(v(values, 'titleDeed'), 'T_____/____')}`,
      },
      ...(conditions.length
        ? [
            { kind: 'text' as const, text: 'SUBJECT to the following conditions:' },
            ...conditions.map((text, index) => ({
              kind: 'text' as const,
              text: `${String.fromCharCode(65 + index)}. ${text}`,
            })),
          ]
        : [
            {
              kind: 'text' as const,
              text: 'SUBJECT to the conditions referred to in the said prior deed, in so far as they still apply.',
            },
          ]),
      {
        kind: 'text',
        text: 'WHEREFORE the appearer, renouncing all the right, title and interest which the principal heretofore had in the property, acknowledges the principal to be entirely dispossessed of it and no longer entitled to it, and that the transferee is now entitled to it by virtue of these presents.',
      },
      {
        kind: 'text',
        text: `AND the appearer declared that the purchase price amounted to ${rand(values, 'price')}.`,
      },
      {
        kind: 'text',
        text: 'IN WITNESS WHEREOF I, the Registrar, together with the appearer q.q., have subscribed to these presents and have caused the seal of office to be affixed thereto.',
      },
      {
        kind: 'text',
        text: `THUS DONE AND EXECUTED at the office of the REGISTRAR OF DEEDS at ${or(v(values, 'registry'), 'registry').toUpperCase()} on ____ __________________ 20____.`,
      },
      { kind: 'signature', lines: ['q.q.', 'In my presence', 'REGISTRAR OF DEEDS'] },
      { kind: 'heading', text: 'Preparation certificate' },
      { kind: 'text', text: 'Prepared by me, CONVEYANCER, LPC number: ______________' },
      { kind: 'signature', lines: [or(v(values, 'conveyancer'), 'Conveyancer')] },
    ];
    return { title: 'Deed of transfer', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [...propertyChecks(values)];
    const sale = v(values, 'saleDate');
    const poa = v(values, 'poaDate');
    if (sale && poa && poa < sale) {
      issues.push({
        severity: 'must',
        field: 'poaDate',
        message: 'The power of attorney to pass transfer is signed on or after the date of sale.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Lodge with the transfer duty receipt or exemption from SARS, the rates clearance certificate and any other clearance the property needs.',
      basis:
        'Transfer Duty Act 40 of 1949 s 14; Local Government: Municipal Systems Act 32 of 2000 s 118',
    });
    issues.push(conveyancerNote);
    return issues;
  },
};

// ------------------------------------------------------------ mortgage bond

export const mortgageBond: DraftTemplate = {
  id: 'mortgage-bond',
  version: VERSION,
  name: 'Mortgage bond',
  category: 'property',
  purpose:
    'Registers a mortgage bond over land to secure a debt, for a capital amount and an additional amount for costs and charges.',
  basis: [
    'Deeds Registries Act 47 of 1937 ss 50, 51 (covering bonds)',
    'Deeds Registries Regulations, reg 43',
    'National Credit Act 34 of 2005 (mortgage agreements with natural persons)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        { key: 'conveyancer', label: 'Appearing conveyancer', type: 'text', required: true },
        { key: 'registry', label: 'Deeds registry', type: 'text', required: true },
        { key: 'mortgagor', label: 'Mortgagor (owner and debtor)', type: 'text', required: true },
        {
          key: 'mortgagorDetails',
          label: 'Mortgagor’s ID or registration number and marital status',
          type: 'text',
          required: true,
        },
        { key: 'mortgagee', label: 'Mortgagee (bondholder)', type: 'text', required: true },
        {
          key: 'poaDate',
          label: 'Date of the power of attorney to register the bond',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      key: 'bond',
      title: 'The bond',
      fields: [
        ...propertyFields,
        { key: 'capital', label: 'Capital amount (R)', type: 'money', required: true },
        { key: 'additional', label: 'Additional amount for costs and charges (R)', type: 'money' },
        {
          key: 'cause',
          label: 'Cause of the debt',
          type: 'longtext',
          required: true,
          help: 'e.g. a loan advanced and to be advanced by the mortgagee, and all other amounts the mortgagor may owe it from any cause.',
        },
        {
          key: 'natural',
          label: 'Is the mortgagor a natural person?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
      ],
    },
  ],
  build(values) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `BE IT HEREBY MADE KNOWN THAT ${or(v(values, 'conveyancer'), 'conveyancer')} appeared before me, the REGISTRAR OF DEEDS at ${or(v(values, 'registry'), 'registry').toUpperCase()}, being duly authorised by a power of attorney granted by ${or(v(values, 'mortgagor'), 'mortgagor')} (${or(v(values, 'mortgagorDetails'), 'details')}) ("the mortgagor") and signed on ${longDate(v(values, 'poaDate')) || '[date]'};`,
      },
      {
        kind: 'text',
        text: `AND THE APPEARER DECLARED that the mortgagor is truly and lawfully indebted, and may become indebted, to ${or(v(values, 'mortgagee'), 'mortgagee')} ("the mortgagee") in respect of ${or(v(values, 'cause'), 'cause of debt')}`,
      },
      {
        kind: 'text',
        text: `in the capital sum of ${rand(values, 'capital')}${v(values, 'additional') ? `, and in the additional sum of ${rand(values, 'additional')} for costs, charges and interest not covered by the capital,` : ''}`,
      },
      {
        kind: 'text',
        text: 'and, as security for those amounts, the appearer in that capacity hereby specially hypothecates as a first mortgage bond:',
      },
      {
        kind: 'centred',
        text: oneLine(values, 'erf', 'property description').toUpperCase(),
        bold: true,
      },
      { kind: 'text', text: `MEASURING ${or(v(values, 'extent'), 'extent in figures and words')}` },
      {
        kind: 'text',
        text: `HELD BY Deed of Transfer ${or(v(values, 'titleDeed'), 'T_____/____')}`,
      },
      {
        kind: 'text',
        text: 'The bond is subject to the terms and conditions set out in the annexure, and to the mortgagor’s obligations under the loan agreement between the parties.',
      },
      {
        kind: 'text',
        text: `THUS DONE AND EXECUTED at the office of the REGISTRAR OF DEEDS at ${or(v(values, 'registry'), 'registry').toUpperCase()} on ____ __________________ 20____.`,
      },
      { kind: 'signature', lines: ['q.q.', 'In my presence', 'REGISTRAR OF DEEDS'] },
      { kind: 'heading', text: 'Preparation certificate' },
      { kind: 'text', text: 'Prepared by me, CONVEYANCER, LPC number: ______________' },
      { kind: 'signature', lines: [or(v(values, 'conveyancer'), 'Conveyancer')] },
    ];
    return { title: 'Mortgage bond', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [...propertyChecks(values)];
    if (v(values, 'natural') === 'Yes') {
      issues.push({
        severity: 'note',
        field: 'natural',
        message:
          'For a natural person, the loan is a mortgage agreement under the National Credit Act: the lender’s affordability assessment, disclosures and section 129 notice before enforcement apply.',
        basis: 'National Credit Act 34 of 2005 ss 8(4)(d), 81, 129',
      });
    }
    issues.push(conveyancerNote);
    return issues;
  },
};

// ------------------------------------------------------------ notarial deed of servitude

export const notarialDeedServitude: DraftTemplate = {
  id: 'notarial-deed-servitude',
  version: VERSION,
  name: 'Notarial deed of servitude',
  category: 'property',
  purpose:
    'Creates a servitude over land (e.g. a right of way, or a personal servitude such as usufruct), executed before a notary for registration.',
  basis: [
    'Deeds Registries Act 47 of 1937 s 65 (registration of servitudes by notarial deed)',
    'Land Survey Act 8 of 1997 (diagram of the servitude area where it is defined)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  defaults: { kind: 'Praedial (in favour of another property)' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        { key: 'notary', label: 'Notary', type: 'text', required: true },
        { key: 'place', label: 'Place of execution', type: 'text', required: true },
        {
          key: 'grantor',
          label: 'Owner of the servient property (grantor)',
          type: 'text',
          required: true,
        },
        { key: 'grantee', label: 'Grantee', type: 'text', required: true },
      ],
    },
    {
      key: 'servitude',
      title: 'The servitude',
      fields: [
        {
          key: 'kind',
          label: 'Kind',
          type: 'choice',
          required: true,
          choices: ['Praedial (in favour of another property)', 'Personal (in favour of a person)'],
        },
        {
          key: 'servient',
          label: 'Servient property (burdened)',
          type: 'longtext',
          required: true,
        },
        { key: 'servientTitle', label: 'Held by title deed', type: 'text', required: true },
        { key: 'dominant', label: 'Dominant property (benefited), if praedial', type: 'longtext' },
        {
          key: 'right',
          label: 'The right granted',
          type: 'longtext',
          required: true,
          help: 'e.g. a right of way 5 metres wide over the route shown as ABCD on diagram SG No …',
        },
        { key: 'diagram', label: 'SG diagram number (if the area is defined)', type: 'text' },
        {
          key: 'duration',
          label: 'Duration',
          type: 'text',
          help: 'Leave empty for perpetual (praedial) or for the grantee’s lifetime (personal).',
        },
        { key: 'consideration', label: 'Consideration (R)', type: 'money' },
      ],
    },
  ],
  build(values) {
    const praedial = !v(values, 'kind').startsWith('Personal');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `BE IT HEREBY MADE KNOWN that on this ____ day of __________________ 20____, before me, ${or(v(values, 'notary'), 'Notary')}, Notary Public, at ${or(v(values, 'place'), 'place')}, in the presence of the subscribing witnesses, personally came and appeared ${or(v(values, 'grantor'), 'grantor')} ("the grantor") and ${or(v(values, 'grantee'), 'grantee')} ("the grantee").`,
      },
      {
        kind: 'para',
        text: `The grantor is the registered owner of ${oneLine(values, 'servient', 'servient property')}, held by Deed of Transfer ${or(v(values, 'servientTitle'), 'T_____/____')} ("the servient property").`,
      },
      ...(praedial
        ? [
            {
              kind: 'para' as const,
              text: `The grantee is the registered owner of ${oneLine(values, 'dominant', 'dominant property')} ("the dominant property").`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: `The grantor grants${praedial ? ' in favour of the dominant property and its owners from time to time' : ' to the grantee personally'} the following servitude over the servient property: ${or(v(values, 'right'), 'the right granted')}${v(values, 'diagram') ? `, as shown on diagram SG No ${v(values, 'diagram')} annexed` : ''}.`,
      },
      {
        kind: 'para',
        text: `The servitude is granted ${v(values, 'duration') ? `for ${v(values, 'duration')}` : praedial ? 'in perpetuity' : 'for the grantee’s lifetime'}${v(values, 'consideration') ? `, for a consideration of ${rand(values, 'consideration')}` : ', for no consideration'}.`,
      },
      {
        kind: 'para',
        text:
          'The grantee will exercise the servitude civiliter modo, causing the grantor as little inconvenience as possible. The parties consent to the registration of this servitude against the title deed of the servient property' +
          (praedial ? ' and its endorsement on the title deed of the dominant property.' : '.'),
      },
      {
        kind: 'text',
        text: 'THUS DONE AND EXECUTED at the place and on the date above, in the presence of the undersigned witnesses.',
      },
      { kind: 'signature', lines: ['Grantor'] },
      { kind: 'signature', lines: ['Grantee'] },
      ...witnesses,
      { kind: 'signature', lines: ['NOTARY PUBLIC'] },
    ];
    return { title: 'Notarial deed of servitude', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (!v(values, 'kind').startsWith('Personal') && !v(values, 'dominant')) {
      issues.push({
        severity: 'must',
        field: 'dominant',
        message: 'A praedial servitude must benefit a dominant property: describe it.',
      });
    }
    if (/route|area|portion|metres|meters/i.test(v(values, 'right')) && !v(values, 'diagram')) {
      issues.push({
        severity: 'should',
        field: 'diagram',
        message:
          'Where the servitude covers a defined route or area, a diagram approved by the Surveyor-General is usually needed for registration.',
        basis: 'Deeds Registries Act s 65; Land Survey Act 8 of 1997',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Mortgagees of the servient property must consent to the registration. A notary executes the deed and signs the preparation certificate.',
      basis: 'Deeds Registries Act s 65; regulations',
    });
    return issues;
  },
};

// ------------------------------------------------------------ codicil

export const codicil: DraftTemplate = {
  id: 'codicil',
  version: VERSION,
  name: 'Codicil',
  category: 'estates',
  purpose: 'Amends an existing will, signed with the same formalities as a will.',
  basis: [
    'Wills Act 7 of 1953 s 2(1)(a) (signature, two competent witnesses present together, each page signed)',
    'Wills Act s 4A (a witness who benefits is disqualified)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'testator',
      title: 'Testator and will',
      fields: [
        {
          key: 'testator',
          label: 'Testator',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'testatorId', label: 'ID number', type: 'id_number', prefill: 'client.idNumber' },
        { key: 'willDate', label: 'Date of the will being amended', type: 'date', required: true },
        { key: 'previousCodicils', label: 'Earlier codicils (dates), if any', type: 'text' },
      ],
    },
    {
      key: 'changes',
      title: 'Changes',
      fields: [
        {
          key: 'revoked',
          label: 'Clauses revoked, one per line',
          type: 'longtext',
          help: 'e.g. clause 4 (the bequest of my vehicle)',
        },
        {
          key: 'added',
          label: 'New or replacement clauses, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'witnesses', label: 'Witnesses, one per line', type: 'longtext', required: true },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
  ],
  build(values) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, ${or(v(values, 'testator'), 'testator')}${v(values, 'testatorId') ? ` (identity number ${v(values, 'testatorId')})` : ''}, declare this to be a codicil to my last will and testament dated ${longDate(v(values, 'willDate')) || '[date]'}${v(values, 'previousCodicils') ? `, as amended by my codicil(s) dated ${v(values, 'previousCodicils')}` : ''}.`,
      },
      ...(lines(values, 'revoked').length
        ? [
            {
              kind: 'para' as const,
              text: `I revoke the following provisions of my will: ${lines(values, 'revoked').join('; ')}.`,
            },
          ]
        : []),
      { kind: 'para', text: 'I add the following provisions to my will:' },
      ...lines(values, 'added').map((text) => ({ kind: 'para' as const, text })),
      { kind: 'para', text: 'In all other respects I confirm my will.' },
      {
        kind: 'text',
        text: `SIGNED at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____, in the presence of the undersigned witnesses, all being present at the same time.`,
      },
      { kind: 'signature', lines: [`TESTATOR: ${or(v(values, 'testator'), 'testator')}`] },
      ...witnesses,
    ];
    return { title: 'Codicil', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const text = `${v(values, 'added')} ${v(values, 'revoked')}`.toLowerCase();
    const benefiting = lines(values, 'witnesses').filter(
      (name) => name.length > 2 && text.includes(name.toLowerCase()),
    );
    if (benefiting.length) {
      issues.push({
        severity: 'must',
        field: 'witnesses',
        message: `${benefiting.join(', ')} is named in the codicil: a witness (or a witness’s spouse) who benefits is disqualified from that benefit.`,
        basis: 'Wills Act 7 of 1953 s 4A',
      });
    }
    if (lines(values, 'witnesses').length < 2) {
      issues.push({
        severity: 'must',
        field: 'witnesses',
        message:
          'Two competent witnesses (14 or older) must sign, both present with the testator at the same time.',
        basis: 'Wills Act s 2(1)(a)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The testator signs at the end and on every page; keep the codicil with the original will.',
      basis: 'Wills Act s 2(1)(a)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ reporting a deceased estate

/** Estates at or below this value may be dealt with under s 18(3) (letter of authority). */
const SMALL_ESTATE = 25_000_000;

export const estateReporting: DraftTemplate = {
  id: 'estate-reporting',
  version: VERSION,
  name: 'Reporting a deceased estate to the Master',
  category: 'estates',
  purpose:
    'Covering letter that reports a deceased estate to the Master, with the prescribed forms and documents, and asks for letters of executorship or authority.',
  basis: [
    'Administration of Estates Act 66 of 1965 s 7 (report within 14 days of death), s 9 (inventory), s 18(3) (smaller estates: letter of authority)',
    'Master’s prescribed forms: death notice (J294), inventory (J243), next-of-kin affidavit (J192), acceptance of trust (J190)',
  ],
  review: APPROVED,
  format: LETTER_FORMAT,
  sections: [
    { key: 'letter', title: 'Letter', fields: letterFields },
    {
      key: 'estate',
      title: 'The estate',
      fields: [
        {
          key: 'masterOffice',
          label: 'Master’s office',
          type: 'text',
          required: true,
          help: 'e.g. The Master of the High Court, Pretoria',
        },
        { key: 'deceased', label: 'Deceased', type: 'text', required: true },
        { key: 'deceasedId', label: 'Deceased’s ID number', type: 'id_number', required: true },
        { key: 'dateOfDeath', label: 'Date of death', type: 'date', required: true },
        {
          key: 'will',
          label: 'Did the deceased leave a will?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
        { key: 'executor', label: 'Nominated executor', type: 'text', required: true },
        {
          key: 'value',
          label: 'Estimated gross value of the estate (R)',
          type: 'money',
          required: true,
        },
        { key: 'enclosures', label: 'Other documents enclosed, one per line', type: 'longtext' },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const value = parseRand(v(values, 'value'));
    const small = value !== null && value <= SMALL_ESTATE;
    const enclosures = [
      'Certified copy of the death certificate',
      'Death notice (J294)',
      ...(v(values, 'will') === 'Yes'
        ? ['The original will and any codicils']
        : ['Next-of-kin affidavit (J192)']),
      'Inventory of assets (J243)',
      'Acceptance of trust as executor (J190) and certified copy of the executor’s identity document',
      'Certified copies of the identity documents of the deceased and the surviving spouse, and the marriage certificate or antenuptial contract',
      ...lines(values, 'enclosures'),
    ];
    const blocks: Block[] = [
      {
        kind: 'heading',
        text: `Estate late ${or(v(values, 'deceased'), 'deceased')} (identity number ${or(v(values, 'deceasedId'), 'ID number')})`,
      },
      {
        kind: 'para',
        text: `We report the estate of the late ${or(v(values, 'deceased'), 'deceased')}, who died on ${longDate(v(values, 'dateOfDeath')) || '[date]'}${v(values, 'will') === 'Yes' ? ', leaving a will' : ', without leaving a will'}.`,
      },
      {
        kind: 'para',
        text: `The estimated gross value of the estate is ${value !== null ? randWithWords(value) : '[amount]'}. We ask that ${small ? `a letter of authority in terms of section 18(3) of the Administration of Estates Act be issued to ${or(v(values, 'executor'), 'the nominee')}` : `letters of executorship be issued to ${or(v(values, 'executor'), 'the nominated executor')}`}.`,
      },
      { kind: 'para', text: 'We enclose:' },
      ...enclosures.map((text, index) => ({
        kind: 'text' as const,
        text: `${index + 1}. ${text}`,
      })),
      { kind: 'para', text: 'Please contact us if anything further is required.' },
      ...signOff(values, ctx.firm.legalName),
    ];
    return {
      title: 'Reporting a deceased estate',
      letterhead: letterhead(ctx, values, [
        or(v(values, 'masterOffice'), 'The Master of the High Court'),
      ]),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const death = parseDate(v(values, 'dateOfDeath'));
    if (death) {
      const due = new Date(death.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
      if (ctx.today > due) {
        issues.push({
          severity: 'should',
          field: 'dateOfDeath',
          message: `The estate should have been reported within 14 days of death (by ${longDate(due)}); report it now and explain the delay if asked.`,
          basis: 'Administration of Estates Act s 7(1)',
        });
      }
    }
    const value = parseRand(v(values, 'value'));
    if (value !== null && value <= SMALL_ESTATE) {
      issues.push({
        severity: 'note',
        field: 'value',
        message:
          'At R250 000 or less, the Master may dispense with letters of executorship and issue a letter of authority under s 18(3).',
        basis: 'Administration of Estates Act s 18(3)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Use the Master’s current prescribed forms; this letter only covers them. Original wills must be lodged with the Master.',
      basis: 'Administration of Estates Act ss 7, 8, 9',
    });
    return issues;
  },
};

// ------------------------------------------------------------ liquidation and distribution account

export const liquidationAccount: DraftTemplate = {
  id: 'liquidation-account',
  version: VERSION,
  name: 'Liquidation and distribution account',
  category: 'estates',
  purpose:
    'Accounts for the administration of a deceased estate: assets, liabilities, administration costs, and how the balance is distributed to the heirs.',
  basis: [
    'Administration of Estates Act 66 of 1965 s 35 (lodging within six months of letters of executorship; inspection after advertisement)',
    'Regulations under the Act, reg 8 (executor’s remuneration: at most 3.5% of gross assets and 6% of income)',
  ],
  review: APPROVED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'estate',
      title: 'The estate',
      fields: [
        { key: 'deceased', label: 'Deceased', type: 'text', required: true },
        { key: 'estateNumber', label: 'Master’s reference', type: 'text', required: true },
        { key: 'executor', label: 'Executor', type: 'text', required: true },
        {
          key: 'lettersDate',
          label: 'Date of letters of executorship',
          type: 'date',
          required: true,
        },
      ],
    },
    {
      key: 'account',
      title: 'The account',
      fields: [
        {
          key: 'assets',
          label: 'Assets, one per line: description | value',
          type: 'longtext',
          required: true,
        },
        {
          key: 'liabilities',
          label: 'Liabilities, one per line: creditor | amount',
          type: 'longtext',
        },
        {
          key: 'costs',
          label: 'Administration costs, one per line: item | amount',
          type: 'longtext',
          help: 'e.g. Master’s fees, advertising, valuation, bank charges. The executor’s fee is entered separately.',
        },
        { key: 'executorFee', label: 'Executor’s fee (R, excluding VAT)', type: 'money' },
        {
          key: 'heirs',
          label: 'Heirs, one per line: name | share %',
          type: 'longtext',
          required: true,
        },
      ],
    },
  ],
  build(values) {
    const assets = amounts(values, 'assets');
    const liabilities = amounts(values, 'liabilities');
    const costs = amounts(values, 'costs');
    const fee = parseRand(v(values, 'executorFee')) ?? 0;
    const gross = total(assets);
    const balance = gross - total(liabilities) - total(costs) - fee;
    const heirs = lines(values, 'heirs').map((line) => {
      const [name = '', share = ''] = line.split('|').map((part) => part.trim());
      return { name, share: Number(share.replace('%', '')) };
    });
    const rows = (entries: ReturnType<typeof amounts>): Block[] =>
      entries.map((entry) => ({
        kind: 'text' as const,
        text: `${entry.label || '[item]'} ........ ${entry.cents !== null ? randWithWords(entry.cents) : '[amount]'}`,
      }));
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `First and final liquidation and distribution account in the estate of the late ${or(v(values, 'deceased'), 'deceased')}, estate number ${or(v(values, 'estateNumber'), 'number')}, lodged by ${or(v(values, 'executor'), 'executor')}, executor, appointed by letters of executorship dated ${longDate(v(values, 'lettersDate')) || '[date]'}.`,
      },
      { kind: 'heading', text: 'Liquidation account' },
      { kind: 'text', text: 'Assets', bold: true },
      ...rows(assets),
      { kind: 'text', text: `Gross value of assets ........ ${randWithWords(gross)}`, bold: true },
      { kind: 'text', text: 'Liabilities', bold: true },
      ...(liabilities.length ? rows(liabilities) : [{ kind: 'text' as const, text: 'None.' }]),
      { kind: 'text', text: 'Administration costs', bold: true },
      ...rows(costs),
      { kind: 'text', text: `Executor’s remuneration ........ ${randWithWords(fee)}` },
      {
        kind: 'text',
        text: `Balance for distribution ........ ${randWithWords(balance)}`,
        bold: true,
      },
      { kind: 'heading', text: 'Distribution account' },
      ...heirs.map((heir) => ({
        kind: 'text' as const,
        text: `${heir.name || '[heir]'} (${Number.isFinite(heir.share) ? heir.share : '[share]'}%) ........ ${Number.isFinite(heir.share) ? randWithWords(Math.round((balance * heir.share) / 100)) : '[amount]'}`,
      })),
      {
        kind: 'para',
        text: 'The executor certifies that this account is correct and that the estate has been administered in accordance with the law.',
      },
      { kind: 'signature', lines: [`EXECUTOR: ${or(v(values, 'executor'), 'executor')}`] },
    ];
    return { title: 'Liquidation and distribution account', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const shares = lines(values, 'heirs').map((line) =>
      Number((line.split('|')[1] ?? '').replace('%', '').trim()),
    );
    const sum = shares.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    if (shares.length && Math.abs(sum - 100) > 0.01) {
      issues.push({
        severity: 'must',
        field: 'heirs',
        message: `The heirs’ shares add up to ${sum}%, not 100%.`,
      });
    }
    const gross = total(amounts(values, 'assets'));
    const fee = parseRand(v(values, 'executorFee'));
    if (fee !== null && gross > 0 && fee > Math.round(gross * 0.035)) {
      issues.push({
        severity: 'must',
        field: 'executorFee',
        message: `The executor’s fee exceeds 3.5% of the gross assets (${randWithWords(Math.round(gross * 0.035))}), unless the will provides otherwise or the Master allows more.`,
        basis: 'Administration of Estates Act s 51; regulation 8',
      });
    }
    if (amounts(values, 'assets').some((entry) => entry.cents === null)) {
      issues.push({
        severity: 'must',
        field: 'assets',
        message: 'Give a value for each asset, as "description | value".',
      });
    }
    const letters = parseDate(v(values, 'lettersDate'));
    if (letters) {
      issues.push({
        severity: 'note',
        field: 'lettersDate',
        message:
          'The account must be lodged within six months of the letters of executorship (or a longer period the Master allows), and then lies open for inspection for 21 days after advertisement.',
        basis: 'Administration of Estates Act s 35(1), (5)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Check estate duty, income tax to date of death and capital gains tax on death before distribution.',
      basis: 'Estate Duty Act 45 of 1955; Income Tax Act 58 of 1962',
    });
    return issues;
  },
};
