// Commercial instruments: the acknowledgment of debt, the deed of suretyship
// and the contingency fees agreement. Standard wording: to be reviewed by an
// admitted attorney (review status "unreviewed" until then).
import type { DraftIssue } from '@ahava88/shared';
import { longDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import { AGREEMENT_FORMAT, UNREVIEWED, or, v, type DraftTemplate } from '../template';

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

const id = (values: Values, key: string) =>
  v(values, key) ? ` (identity/registration number ${v(values, key)})` : '';

// ------------------------------------------------------------ acknowledgment of debt

/** Months to pay off the debt at the instalment, or null. */
export function instalmentMonths(values: Values): number | null {
  const amount = parseRand(v(values, 'amount'));
  const instalment = parseRand(v(values, 'instalment'));
  if (amount === null || instalment === null || instalment <= 0) return null;
  return Math.ceil(amount / instalment);
}

export const acknowledgmentOfDebt: DraftTemplate = {
  id: 'acknowledgment-of-debt',
  version: VERSION,
  name: 'Acknowledgment of debt',
  category: 'commercial',
  purpose:
    'Records the debtor’s admission of what is owed and why, and how it will be repaid, with what happens on default.',
  basis: [
    'Common law (acknowledgment of liability; acceleration)',
    'Prescription Act 68 of 1969 s 14 (an acknowledgment interrupts prescription)',
    'Magistrates’ Courts Act 32 of 1944 s 58 (consent to judgment), as amended by Act 7 of 2017',
    'National Credit Act 34 of 2005 (where repayment is deferred against interest or fees)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { repayment: 'Monthly instalments', debtorType: 'Natural person', consent: 'No' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        {
          key: 'creditorName',
          label: 'Creditor',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'creditorId',
          label: 'Creditor’s ID or registration number',
          type: 'id_number',
          prefill: 'client.idNumber',
        },
        { key: 'debtorName', label: 'Debtor', type: 'text', required: true },
        { key: 'debtorId', label: 'Debtor’s ID or registration number', type: 'id_number' },
        {
          key: 'debtorType',
          label: 'The debtor is',
          type: 'choice',
          required: true,
          choices: ['Natural person', 'Company, close corporation or trust'],
        },
        {
          key: 'debtorAddress',
          label: 'Debtor’s address (chosen for notices and service)',
          type: 'longtext',
          required: true,
        },
      ],
    },
    {
      key: 'debt',
      title: 'The debt',
      fields: [
        { key: 'amount', label: 'Amount owed (R)', type: 'money', required: true },
        {
          key: 'cause',
          label: 'What the debt is for',
          type: 'longtext',
          required: true,
          help: 'e.g. goods sold and delivered between March and June 2026, invoices 101 to 109.',
        },
        { key: 'interestRate', label: 'Interest (% a year, leave empty for none)', type: 'text' },
      ],
    },
    {
      key: 'repayment',
      title: 'Repayment',
      fields: [
        {
          key: 'repayment',
          label: 'How it is repaid',
          type: 'choice',
          required: true,
          choices: ['Monthly instalments', 'One payment'],
        },
        { key: 'instalment', label: 'Monthly instalment (R)', type: 'money' },
        { key: 'firstPayment', label: 'First (or only) payment on', type: 'date', required: true },
        { key: 'bank', label: 'Account for payments', type: 'longtext' },
        {
          key: 'consent',
          label: 'Debtor consents to judgment (magistrates’ court s 58)?',
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
    const months = instalmentMonths(values);
    const instalments = v(values, 'repayment') === 'Monthly instalments';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, the undersigned, ${or(v(values, 'debtorName'), 'Debtor')}${id(values, 'debtorId')} ("the debtor"), acknowledge that I am truly and lawfully indebted to ${or(v(values, 'creditorName'), 'Creditor')}${id(values, 'creditorId')} ("the creditor") as follows:`,
      },
      {
        kind: 'para',
        text: `I owe the creditor ${rand(values, 'amount')} ("the debt") for ${or(v(values, 'cause'), 'cause of the debt')}`,
      },
      {
        kind: 'para',
        text: v(values, 'interestRate')
          ? `Interest runs on the outstanding balance at ${v(values, 'interestRate')}% a year, calculated daily and compounded monthly, from the date of signature until payment in full.`
          : 'No interest is charged on the debt while I pay as agreed below.',
      },
      {
        kind: 'para',
        text: instalments
          ? `I will repay the debt in monthly instalments of ${rand(values, 'instalment')}, the first on ${longDate(v(values, 'firstPayment')) || '[date]'} and thereafter on the same day of each following month${months ? ` (about ${months} instalments)` : ''}, until the debt${v(values, 'interestRate') ? ' and interest are' : ' is'} paid in full.`
          : `I will pay the debt in full on or before ${longDate(v(values, 'firstPayment')) || '[date]'}.`,
      },
      ...(v(values, 'bank')
        ? [
            {
              kind: 'para' as const,
              text: `Payments are made into: ${v(values, 'bank').split('\n').join(', ')}.`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'If I fail to pay any amount on its due date and do not remedy that within seven days of written notice, the whole balance then outstanding becomes due and payable at once, and the creditor may take legal action to recover it.',
      },
      {
        kind: 'para',
        text: 'A certificate signed by the creditor showing the amount I owe is sufficient proof of that amount until I prove otherwise.',
      },
      {
        kind: 'para',
        text: 'I agree to pay the legal costs the creditor incurs in recovering any amount I fail to pay, on the scale as between attorney and client, including collection commission where the law allows it.',
      },
      ...(v(values, 'consent') === 'Yes'
        ? [
            {
              kind: 'para' as const,
              text: 'If I fail to pay as agreed, I consent to judgment against me in the magistrates’ court in terms of section 58 of the Magistrates’ Courts Act 32 of 1944 for the balance then outstanding, with interest and costs. I understand that the court will consider my financial position before granting judgment or any order for payment.',
            },
          ]
        : []),
      {
        kind: 'para',
        text: `I choose ${or(v(values, 'debtorAddress').split('\n').join(', '), 'address')} as my address for notices and the service of legal process. I acknowledge that this acknowledgment interrupts the running of prescription of the debt.`,
      },
      {
        kind: 'para',
        text: 'No indulgence the creditor gives me changes the creditor’s rights. This document may be changed only in writing signed by both parties.',
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Debtor: ${or(v(values, 'debtorName'), 'Debtor')}`] },
      ...witnesses,
      {
        kind: 'signature',
        lines: [`Accepted by the creditor: ${or(v(values, 'creditorName'), 'Creditor')}`],
      },
    ];
    return { title: 'Acknowledgment of debt', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'repayment') === 'Monthly instalments' && !v(values, 'instalment')) {
      issues.push({
        severity: 'must',
        field: 'instalment',
        message: 'Enter the monthly instalment.',
      });
    }
    const amount = parseRand(v(values, 'amount'));
    const instalment = parseRand(v(values, 'instalment'));
    if (amount !== null && instalment !== null && instalment > amount) {
      issues.push({
        severity: 'should',
        field: 'instalment',
        message: 'The instalment is more than the debt.',
      });
    }
    if (v(values, 'interestRate') && !/^\d+([.,]\d+)?$/.test(v(values, 'interestRate'))) {
      issues.push({
        severity: 'must',
        field: 'interestRate',
        message: 'Enter the interest rate as a number, e.g. 10.5.',
      });
    }
    if (v(values, 'debtorType') === 'Natural person' && v(values, 'interestRate')) {
      issues.push({
        severity: 'should',
        field: 'interestRate',
        message:
          'Deferring payment against interest for a natural person may make this a credit agreement under the National Credit Act: then the creditor may need to be registered, the rate is capped and the Act’s disclosures and pre-agreement checks apply. Check before signing.',
        basis: 'National Credit Act 34 of 2005 ss 8, 40, 101, 105',
      });
    }
    if (v(values, 'consent') === 'Yes' && v(values, 'debtorType') !== 'Natural person') {
      issues.push({
        severity: 'note',
        field: 'consent',
        message:
          'Check that section 58 consent is available against this kind of debtor in the court you will use.',
        basis: 'Magistrates’ Courts Act 32 of 1944 s 58',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Have the debtor sign every page; an acknowledgment obtained by pressure or undue influence may be set aside.',
      basis: 'Common law; practice',
    });
    return issues;
  },
};

// ------------------------------------------------------------ deed of suretyship

const IN_COMMUNITY = 'Married in community of property';

export const suretyship: DraftTemplate = {
  id: 'suretyship',
  version: VERSION,
  name: 'Deed of suretyship',
  category: 'commercial',
  purpose:
    'The surety binds themselves to the creditor for the principal debtor’s debts, with the benefits a surety would otherwise have renounced.',
  basis: [
    'General Law Amendment Act 50 of 1956 s 6 (terms in writing, signed by or for the surety)',
    'Matrimonial Property Act 88 of 1984 s 15(2)(h), (5) (spouse’s written consent for each suretyship)',
    'National Credit Act 34 of 2005 ss 4(2)(c), 8(5) (credit guarantees)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { scope: 'All debts, present and future', coPrincipal: 'Yes' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        {
          key: 'creditorName',
          label: 'Creditor',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'debtorName', label: 'Principal debtor', type: 'text', required: true },
        {
          key: 'debtorId',
          label: 'Principal debtor’s ID or registration number',
          type: 'id_number',
        },
      ],
    },
    {
      key: 'surety',
      title: 'Surety',
      fields: [
        { key: 'suretyName', label: 'Surety', type: 'text', required: true },
        { key: 'suretyId', label: 'Surety’s ID number', type: 'id_number' },
        {
          key: 'suretyAddress',
          label: 'Address (chosen for notices and service)',
          type: 'longtext',
          required: true,
        },
        {
          key: 'suretyMarital',
          label: 'Marital status',
          type: 'choice',
          required: true,
          choices: [
            'Unmarried',
            'Married out of community of property',
            IN_COMMUNITY,
            'Company, trust or other entity',
          ],
        },
        {
          key: 'suretySpouse',
          label: 'Spouse (if married in community of property)',
          type: 'text',
        },
      ],
    },
    {
      key: 'debt',
      title: 'What is secured',
      fields: [
        {
          key: 'scope',
          label: 'Debts secured',
          type: 'choice',
          required: true,
          choices: ['All debts, present and future', 'A specific debt'],
        },
        {
          key: 'specificDebt',
          label: 'The specific debt',
          type: 'longtext',
          help: 'e.g. the loan of R250 000 under the agreement dated 1 March 2026.',
        },
        {
          key: 'limit',
          label: 'Limit of the surety’s liability (R, leave empty for unlimited)',
          type: 'money',
        },
        {
          key: 'coPrincipal',
          label: 'Surety also bound as co-principal debtor?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const all = v(values, 'scope') !== 'A specific debt';
    const limit = parseRand(v(values, 'limit'));
    const married = v(values, 'suretyMarital') === IN_COMMUNITY;
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, the undersigned, ${or(v(values, 'suretyName'), 'Surety')}${id(values, 'suretyId')} ("the surety"), bind myself as surety${v(values, 'coPrincipal') === 'Yes' ? ' and co-principal debtor, jointly and severally,' : ''} with ${or(v(values, 'debtorName'), 'Principal debtor')}${id(values, 'debtorId')} ("the debtor") in favour of ${or(v(values, 'creditorName'), 'Creditor')} ("the creditor"), on the following terms:`,
      },
      {
        kind: 'para',
        text: all
          ? 'This suretyship secures the payment of every amount the debtor now owes or may in future owe the creditor, from whatever cause, and the performance of every obligation of the debtor to the creditor.'
          : `This suretyship secures ${or(v(values, 'specificDebt'), 'the specific debt')}`,
      },
      {
        kind: 'para',
        text:
          limit !== null
            ? `My liability under this suretyship is limited to ${randWithWords(limit)}, plus interest on that amount and the costs of recovering it.`
            : 'My liability under this suretyship is not limited in amount.',
      },
      {
        kind: 'para',
        text: 'I renounce the benefits of excussion (that the creditor must first claim from the debtor), division (that liability be divided among sureties) and cession of actions, and I confirm that I know what these benefits mean.',
      },
      {
        kind: 'para',
        text: 'The creditor may give the debtor time, release or compromise with the debtor or other sureties, or deal with any other security, without releasing me. This suretyship is a continuing covering security and stays in force until the creditor releases me in writing.',
      },
      {
        kind: 'para',
        text: 'A certificate signed by the creditor showing the amount the debtor owes is sufficient proof of that amount until I prove otherwise. I agree to pay the creditor’s legal costs of enforcing this suretyship on the scale as between attorney and client.',
      },
      {
        kind: 'para',
        text: `I choose ${or(v(values, 'suretyAddress').split('\n').join(', '), 'address')} as my address for notices and the service of legal process. This deed may be changed only in writing signed by the creditor and me.`,
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Surety: ${or(v(values, 'suretyName'), 'Surety')}`] },
      ...witnesses,
      ...(married
        ? [
            { kind: 'heading' as const, text: 'Spouse’s consent' },
            {
              kind: 'text' as const,
              text: `I, ${or(v(values, 'suretySpouse'), 'spouse')}, married in community of property to the surety, consent in writing to the surety entering into this suretyship, as section 15(2)(h) of the Matrimonial Property Act 88 of 1984 requires.`,
            },
            { kind: 'signature' as const, lines: ['Spouse'] },
            ...witnesses,
          ]
        : []),
    ];
    return { title: 'Deed of suretyship', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'scope') === 'A specific debt' && !v(values, 'specificDebt')) {
      issues.push({
        severity: 'must',
        field: 'specificDebt',
        message:
          'Identify the debt secured: the creditor, the debtor and the debt must be ascertainable from the deed itself.',
        basis: 'General Law Amendment Act 50 of 1956 s 6',
      });
    }
    if (v(values, 'suretyMarital') === IN_COMMUNITY && !v(values, 'suretySpouse')) {
      issues.push({
        severity: 'must',
        field: 'suretySpouse',
        message:
          'A surety married in community of property needs the spouse’s written consent for this suretyship: enter the spouse’s name so the consent is included.',
        basis: 'Matrimonial Property Act 88 of 1984 s 15(2)(h), (5)',
      });
    }
    if (!v(values, 'limit') && v(values, 'suretyMarital') !== 'Company, trust or other entity') {
      issues.push({
        severity: 'note',
        field: 'limit',
        message:
          'The suretyship is unlimited. Make sure the surety understands this before signing.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The surety must sign the deed. If the principal debt is a credit agreement under the National Credit Act, the suretyship is a credit guarantee and the Act applies to it too.',
      basis: 'General Law Amendment Act 50 of 1956 s 6; National Credit Act ss 4(2)(c), 8(5)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ contingency fees agreement

export const contingencyFeesAgreement: DraftTemplate = {
  id: 'contingency-fees-agreement',
  version: VERSION,
  name: 'Contingency fees agreement',
  category: 'engagement',
  purpose:
    'A no-win-no-fee agreement under the Contingency Fees Act: when fees are earned, the normal fees, the success fee within the statutory caps, the client’s rights and the cooling-off period.',
  basis: [
    'Contingency Fees Act 66 of 1997 s 2(2) (success fee at most 100% above normal fees, and at most 25% of a money award)',
    'Contingency Fees Act ss 3 (writing, prescribed form, signed; 14-day cooling-off), 4 (settlement with the client’s consent, affidavit), 5 (review)',
    'Legal Practice Act 28 of 2014 s 35',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { money: 'Yes', upliftPercent: '100', capPercent: '25' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        {
          key: 'clientName',
          label: 'Client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'clientId', label: 'ID number', type: 'id_number', prefill: 'client.idNumber' },
        { key: 'clientAddress', label: 'Address', type: 'longtext', prefill: 'client.address' },
        { key: 'firmName', label: 'Firm', type: 'text', required: true, prefill: 'firm.legalName' },
        { key: 'attorneyName', label: 'Attorney responsible', type: 'text', required: true },
      ],
    },
    {
      key: 'claim',
      title: 'The claim',
      fields: [
        {
          key: 'claim',
          label: 'The proceedings this agreement covers',
          type: 'longtext',
          required: true,
          help: 'e.g. a claim against the Road Accident Fund for injuries suffered on 3 May 2026.',
        },
        {
          key: 'prospects',
          label: 'Why the attorney believes there are reasonable prospects of success',
          type: 'longtext',
          required: true,
        },
        {
          key: 'success',
          label: 'What counts as success',
          type: 'longtext',
          required: true,
          help: 'e.g. any award or settlement in the client’s favour, including a partial one.',
        },
        {
          key: 'money',
          label: 'Does the claim sound in money?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
      ],
    },
    {
      key: 'fees',
      title: 'Fees',
      fields: [
        {
          key: 'hourlyRate',
          label: 'Normal fee: hourly rate (R, excl. VAT)',
          type: 'money',
          required: true,
        },
        {
          key: 'upliftPercent',
          label: 'Success fee: % above normal fees',
          type: 'number',
          required: true,
        },
        {
          key: 'capPercent',
          label: 'Cap: % of the total amount awarded',
          type: 'number',
          help: 'For claims sounding in money; at most 25%.',
        },
        {
          key: 'disbursements',
          label: 'Who pays disbursements, and when',
          type: 'longtext',
          required: true,
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date', prefill: 'today' },
      ],
    },
  ],
  build(values) {
    const firm = or(v(values, 'firmName'), 'Firm');
    const money = v(values, 'money') === 'Yes';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${firm}, represented by ${or(v(values, 'attorneyName'), 'attorney')} ("the attorney"), and ${or(v(values, 'clientName'), 'Client')}${id(values, 'clientId')} ("the client"), in terms of the Contingency Fees Act 66 of 1997 ("the Act").`,
      },
      { kind: 'heading', text: 'The proceedings' },
      { kind: 'para', text: `This agreement covers ${or(v(values, 'claim'), 'the proceedings')}` },
      {
        kind: 'para',
        text: `The attorney is of the opinion that the client has reasonable prospects of success, because ${or(v(values, 'prospects'), 'reasons')}`,
      },
      { kind: 'heading', text: 'When fees are payable' },
      {
        kind: 'para',
        text: `The client pays the attorney no fees unless the client is successful. Success means: ${or(v(values, 'success'), 'definition of success')}`,
      },
      {
        kind: 'para',
        text: `The attorney's normal fees are calculated at ${v(values, 'hourlyRate') ? randWithWords(parseRand(v(values, 'hourlyRate')) ?? 0) : '[rate]'} per hour (excluding VAT), recorded in units of six minutes.`,
      },
      {
        kind: 'para',
        text: `If the client is successful, the client pays the attorney a success fee of the normal fees plus ${or(v(values, 'upliftPercent'), '[%]')}% of the normal fees${money ? `, but the success fee will in no case exceed ${or(v(values, 'capPercent'), '25')}% of the total amount awarded or obtained by the client in the proceedings, excluding costs` : ''}.`,
      },
      {
        kind: 'para',
        text: 'Costs recovered from the other party are taken into account in calculating what the client owes and are accounted for to the client.',
      },
      {
        kind: 'para',
        text: `Disbursements: ${or(v(values, 'disbursements'), 'who pays disbursements')}`,
      },
      { kind: 'heading', text: 'The client’s rights' },
      {
        kind: 'para',
        text: 'The attorney has explained to the client other ways of financing the proceedings and their implications, and the client has chosen this agreement.',
      },
      {
        kind: 'para',
        text: 'The client may cancel this agreement by written notice within 14 days of signing it (the cooling-off period). If the client ends the mandate after that, the attorney may claim fees for work done only to the extent the Act and the prescribed form allow.',
      },
      {
        kind: 'para',
        text: 'Any offer of settlement will be referred to the client, and the matter may be settled only with the client’s consent. On settlement, the attorney will lodge the affidavit the Act requires and give the client a statement of the amount, the fees and how they were calculated.',
      },
      {
        kind: 'para',
        text: 'The client may ask the professional controlling body (the Legal Practice Council) to review this agreement or the fees charged under it.',
      },
      {
        kind: 'para',
        text: 'The attorney processes the client’s personal information to carry out this mandate, in line with the Protection of Personal Information Act 4 of 2013.',
      },
      { kind: 'text', text: signed(values) },
      {
        kind: 'signature',
        lines: [`For the attorney: ${or(v(values, 'attorneyName'), 'attorney')}`],
      },
      { kind: 'signature', lines: [`The client: ${or(v(values, 'clientName'), 'client')}`] },
      ...witnesses,
    ];
    return { title: 'Contingency fees agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const uplift = Number(v(values, 'upliftPercent'));
    if (Number.isFinite(uplift) && uplift > 100) {
      issues.push({
        severity: 'must',
        field: 'upliftPercent',
        message: 'The success fee may not exceed the normal fees by more than 100%.',
        basis: 'Contingency Fees Act 66 of 1997 s 2(2)',
      });
    }
    if (v(values, 'money') === 'Yes') {
      const cap = Number(v(values, 'capPercent'));
      if (!v(values, 'capPercent')) {
        issues.push({
          severity: 'must',
          field: 'capPercent',
          message: 'A claim sounding in money needs the 25% cap.',
        });
      } else if (Number.isFinite(cap) && cap > 25) {
        issues.push({
          severity: 'must',
          field: 'capPercent',
          message:
            'In a claim sounding in money, the success fee may not exceed 25% of the total amount awarded or obtained.',
          basis: 'Contingency Fees Act 66 of 1997 s 2(2)',
        });
      }
    }
    issues.push({
      severity: 'note',
      message:
        'The Act requires the agreement to be in the prescribed form and signed by the client: compare this wording with the form published under the Act before it is used, and keep a signed copy for the client.',
      basis: 'Contingency Fees Act 66 of 1997 s 3',
    });
    return issues;
  },
};
