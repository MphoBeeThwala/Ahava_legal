// Powers of attorney, mandates and wills. Standard wording: to be reviewed by
// an admitted attorney (review status "unreviewed" until then).
import type { DraftIssue } from '@ahava88/shared';
import { longDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import { AGREEMENT_FORMAT, UNREVIEWED, lines, or, v, type DraftTemplate } from '../template';

const signedAt = (values: Record<string, string>, who: string) =>
  `SIGNED at ${or(v(values, 'place'), 'place')} on ${v(values, 'signDate') ? longDate(v(values, 'signDate')) : 'this ____ day of __________________ 20____'}${who}.`;

const witnesses: Block[] = [
  { kind: 'text', text: 'AS WITNESSES:' },
  { kind: 'signature', lines: ['1. Full names:'] },
  { kind: 'signature', lines: ['2. Full names:'] },
];

// ------------------------------------------------------------ special power of attorney

export const specialPowerOfAttorney: DraftTemplate = {
  id: 'special-power-of-attorney',
  version: '2026.11-1',
  name: 'Special power of attorney',
  category: 'engagement',
  purpose: 'Authorises an agent to perform a specific act for the principal, and nothing more.',
  basis: [
    'Common law of agency (mandate)',
    'Uniform Rule 7 (authority in litigation, when challenged)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'principal',
      title: 'Principal',
      fields: [
        {
          key: 'principalName',
          label: 'Principal',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'principalId',
          label: 'ID or registration number',
          type: 'id_number',
          prefill: 'client.idNumber',
        },
        { key: 'principalAddress', label: 'Address', type: 'longtext', prefill: 'client.address' },
      ],
    },
    {
      key: 'agent',
      title: 'Agent and authority',
      fields: [
        { key: 'agentName', label: 'Agent', type: 'text', required: true },
        { key: 'agentId', label: 'Agent’s ID number', type: 'id_number' },
        {
          key: 'act',
          label: 'What the agent may do',
          type: 'longtext',
          required: true,
          help: 'The specific act, e.g. sign the sale agreement for Erf 123 Sunnyside at a price of at least R…',
        },
        { key: 'limits', label: 'Limits or conditions', type: 'longtext' },
        { key: 'validUntil', label: 'Valid until', type: 'date' },
      ],
    },
    {
      key: 'signing',
      title: 'Signing',
      fields: [
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date' },
      ],
    },
  ],
  build(values) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, the undersigned, ${or(v(values, 'principalName'), 'principal')}${v(values, 'principalId') ? ` (identity/registration number ${v(values, 'principalId')})` : ''}${v(values, 'principalAddress') ? ` of ${v(values, 'principalAddress').split('\n').join(', ')}` : ''}, hereby nominate, constitute and appoint ${or(v(values, 'agentName'), 'agent')}${v(values, 'agentId') ? ` (identity number ${v(values, 'agentId')})` : ''} to be my lawful agent in my name, place and stead, for the following purpose only:`,
      },
      { kind: 'para', text: or(v(values, 'act'), 'the specific act authorised') },
      ...(v(values, 'limits')
        ? [
            {
              kind: 'para' as const,
              text: `This authority is subject to the following: ${v(values, 'limits')}`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'And generally to do whatever is necessary for that purpose, as fully as I could do if personally present, and I ratify and confirm whatever my agent lawfully does under this power of attorney.',
      },
      {
        kind: 'para',
        text: v(values, 'validUntil')
          ? `This power of attorney is valid until ${longDate(v(values, 'validUntil'))}, unless I revoke it earlier in writing.`
          : 'This power of attorney is valid until I revoke it in writing.',
      },
      { kind: 'text', text: signedAt(values, ' in the presence of the undersigned witnesses') },
      { kind: 'signature', lines: [`PRINCIPAL: ${or(v(values, 'principalName'), 'principal')}`] },
      ...witnesses,
    ];
    return { title: 'Special power of attorney', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'act') && v(values, 'act').length < 30) {
      issues.push({
        severity: 'should',
        field: 'act',
        message:
          'Describe the act precisely: a special power of attorney authorises only what it states.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'A power of attorney ends when the principal dies or loses mental capacity. To pass transfer of land, use the power of attorney to pass transfer instead.',
      basis: 'Common law of agency; Deeds Registries Act 47 of 1937 s 20',
    });
    return issues;
  },
};

// ------------------------------------------------------------ mandate and fee agreement

export const mandateFeeAgreement: DraftTemplate = {
  id: 'mandate-fee-agreement',
  version: '2026.11-1',
  name: 'Mandate and fee agreement',
  category: 'engagement',
  purpose:
    'Records the client’s instructions, the scope of the mandate, how fees and disbursements are charged, and the cost estimate.',
  basis: [
    'Legal Practice Act 28 of 2014 s 35(7) (cost estimate on receiving instructions)',
    'LPC Code of Conduct',
    'Contingency Fees Act 66 of 1997 (not for no-win-no-fee arrangements: use its prescribed agreement)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { feeBasis: 'Hourly rate', billing: 'monthly' },
  sections: [
    {
      key: 'parties',
      title: 'Parties',
      fields: [
        { key: 'firmName', label: 'Firm', type: 'text', required: true, prefill: 'firm.legalName' },
        {
          key: 'clientName',
          label: 'Client',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'clientId',
          label: 'Client ID or registration number',
          type: 'id_number',
          prefill: 'client.idNumber',
        },
        {
          key: 'clientAddress',
          label: 'Client address',
          type: 'longtext',
          prefill: 'client.address',
        },
        { key: 'clientEmail', label: 'Client email', type: 'text', prefill: 'client.email' },
      ],
    },
    {
      key: 'mandate',
      title: 'Mandate',
      fields: [
        { key: 'matter', label: 'Matter', type: 'text', required: true, prefill: 'matter.title' },
        { key: 'scope', label: 'What the firm will do', type: 'longtext', required: true },
        { key: 'exclusions', label: 'What is not included', type: 'longtext' },
      ],
    },
    {
      key: 'fees',
      title: 'Fees and estimate',
      fields: [
        {
          key: 'feeBasis',
          label: 'Fees charged by',
          type: 'choice',
          required: true,
          choices: ['Hourly rate', 'Fixed fee'],
        },
        { key: 'hourlyRate', label: 'Hourly rate excl. VAT (R)', type: 'money' },
        { key: 'fixedFee', label: 'Fixed fee excl. VAT (R)', type: 'money' },
        {
          key: 'estimate',
          label: 'Estimated total fees and disbursements (R)',
          type: 'money',
          required: true,
        },
        { key: 'estimateNotes', label: 'What the estimate assumes', type: 'longtext' },
        { key: 'deposit', label: 'Deposit (R)', type: 'money' },
        {
          key: 'billing',
          label: 'Accounts rendered',
          type: 'choice',
          required: true,
          choices: ['monthly', 'on completion of each stage', 'on completion'],
        },
      ],
    },
    {
      key: 'signing',
      title: 'Signing',
      fields: [
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'signDate', label: 'Date of signing', type: 'date', prefill: 'today' },
        { key: 'attorneyName', label: 'Signed for the firm by', type: 'text', required: true },
      ],
    },
  ],
  build(values) {
    const firm = or(v(values, 'firmName'), 'Firm');
    const hourly = parseRand(v(values, 'hourlyRate'));
    const fixed = parseRand(v(values, 'fixedFee'));
    const estimate = parseRand(v(values, 'estimate'));
    const deposit = parseRand(v(values, 'deposit'));
    const fee =
      v(values, 'feeBasis') === 'Fixed fee'
        ? `The firm will charge a fixed fee of ${fixed !== null ? randWithWords(fixed) : '[amount]'} (excluding VAT) for the work described above.`
        : `The firm's fees are calculated at ${hourly !== null ? randWithWords(hourly) : '[rate]'} per hour (excluding VAT), recorded in units of six minutes.`;
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${firm} ("the firm") and ${or(v(values, 'clientName'), 'Client')}${v(values, 'clientId') ? ` (identity/registration number ${v(values, 'clientId')})` : ''} ("the client").`,
      },
      { kind: 'heading', text: 'Mandate' },
      {
        kind: 'para',
        text: `The client instructs the firm to act in the following matter: ${or(v(values, 'matter'), 'matter')}. The mandate covers: ${or(v(values, 'scope'), 'scope')}`,
      },
      ...(v(values, 'exclusions')
        ? [
            {
              kind: 'para' as const,
              text: `The mandate does not include: ${v(values, 'exclusions')} Further work requires further instructions.`,
            },
          ]
        : []),
      { kind: 'heading', text: 'Fees and disbursements' },
      { kind: 'para', text: fee },
      {
        kind: 'para',
        text: `In terms of section 35(7) of the Legal Practice Act 28 of 2014, the firm estimates the total fees and disbursements for this matter at ${estimate !== null ? randWithWords(estimate) : '[amount]'}${v(values, 'estimateNotes') ? `, on the following assumptions: ${v(values, 'estimateNotes')}` : ''}. This is an estimate, not a quotation; the firm will tell the client promptly if it expects the estimate to be exceeded.`,
      },
      {
        kind: 'para',
        text: "Disbursements (such as sheriff's fees, counsel's fees, court and filing fees, experts' fees and travel) are payable in addition to the firm's fees.",
      },
      ...(deposit !== null
        ? [
            {
              kind: 'para' as const,
              text: `The client will pay a deposit of ${randWithWords(deposit)} into the firm's trust account before work begins. The deposit is applied to fees and disbursements as they are billed.`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: `The firm will render accounts ${v(values, 'billing') || 'monthly'}, payable within 30 days of the date of the account.`,
      },
      {
        kind: 'para',
        text: 'Costs recovered from another party are usually less than the fees charged under this agreement; the client remains liable to the firm for the difference.',
      },
      {
        kind: 'para',
        text: "The client may ask for the firm's account to be assessed by the Legal Practice Council or taxed by the taxing master.",
      },
      { kind: 'heading', text: 'General' },
      {
        kind: 'para',
        text: 'Either party may end the mandate by notice in writing. Fees and disbursements up to the date it ends remain payable.',
      },
      {
        kind: 'para',
        text: "The firm processes the client's personal information to carry out this mandate and to meet its legal obligations, in accordance with the Protection of Personal Information Act 4 of 2013.",
      },
      { kind: 'text', text: signedAt(values, '') },
      { kind: 'signature', lines: [`For the firm: ${or(v(values, 'attorneyName'), 'name')}`] },
      { kind: 'signature', lines: [`The client: ${or(v(values, 'clientName'), 'client')}`] },
    ];
    return { title: 'Mandate and fee agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'feeBasis') === 'Hourly rate' && !v(values, 'hourlyRate')) {
      issues.push({ severity: 'must', field: 'hourlyRate', message: 'Enter the hourly rate.' });
    }
    if (v(values, 'feeBasis') === 'Fixed fee' && !v(values, 'fixedFee')) {
      issues.push({ severity: 'must', field: 'fixedFee', message: 'Enter the fixed fee.' });
    }
    issues.push({
      severity: 'note',
      message:
        'The cost estimate must be given when instructions are received; compare this wording with the LPC’s prescribed cost estimate notice. A no-win-no-fee arrangement must use the Contingency Fees Act agreement instead.',
      basis: 'Legal Practice Act 28 of 2014 s 35(7); Contingency Fees Act 66 of 1997 ss 2, 3',
    });
    return issues;
  },
};

// ------------------------------------------------------------ last will and testament

export const lastWill: DraftTemplate = {
  id: 'last-will',
  version: '2026.11-1',
  name: 'Last will and testament',
  category: 'estates',
  purpose:
    'Sets out how the testator’s estate is to be distributed and who administers it, executed with the Wills Act formalities.',
  basis: [
    'Wills Act 7 of 1953 s 2(1)(a) (signing and witnessing), s 4A (witness or spouse as beneficiary)',
    "Children's Act 38 of 2005 s 27 (appointing a guardian by will)",
    'Administration of Estates Act 66 of 1965 s 23 (security by executors)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { revoke: 'Yes', securityWaived: 'Yes', maritalStatus: 'Unmarried' },
  sections: [
    {
      key: 'testator',
      title: 'Testator',
      fields: [
        {
          key: 'testatorName',
          label: 'Full names',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'testatorId',
          label: 'ID number',
          type: 'id_number',
          required: true,
          prefill: 'client.idNumber',
        },
        { key: 'testatorAddress', label: 'Address', type: 'longtext', prefill: 'client.address' },
        {
          key: 'maritalStatus',
          label: 'Marital status',
          type: 'choice',
          required: true,
          choices: [
            'Unmarried',
            'Married in community of property',
            'Married out of community of property',
          ],
        },
        { key: 'spouseName', label: 'Spouse', type: 'text' },
        {
          key: 'revoke',
          label: 'Revoke earlier wills',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
      ],
    },
    {
      key: 'estate',
      title: 'Bequests',
      fields: [
        {
          key: 'bequests',
          label: 'Specific bequests, one per line',
          type: 'longtext',
          help: 'e.g. I bequeath my motor vehicle to my son, Thabo Mokoena (ID …).',
        },
        {
          key: 'residue',
          label: 'Who inherits the rest (the residue)',
          type: 'longtext',
          required: true,
        },
        { key: 'guardian', label: 'Guardian of minor children', type: 'text' },
        { key: 'trust', label: 'Testamentary trust provisions', type: 'longtext' },
      ],
    },
    {
      key: 'executor',
      title: 'Executor',
      fields: [
        { key: 'executor', label: 'Executor', type: 'text', required: true },
        {
          key: 'securityWaived',
          label: 'Exempt the executor from security',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
      ],
    },
    {
      key: 'execution',
      title: 'Signing',
      fields: [
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
        { key: 'witness1', label: 'Witness 1', type: 'text' },
        { key: 'witness2', label: 'Witness 2', type: 'text' },
      ],
    },
  ],
  build(values) {
    const name = or(v(values, 'testatorName'), 'testator');
    const status = v(values, 'maritalStatus');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, the undersigned, ${name}${v(values, 'testatorId') ? ` (identity number ${v(values, 'testatorId')})` : ''}${v(values, 'testatorAddress') ? ` of ${v(values, 'testatorAddress').split('\n').join(', ')}` : ''}, declare this to be my last will and testament.`,
      },
      ...(v(values, 'revoke') !== 'No'
        ? [
            {
              kind: 'para' as const,
              text: 'I revoke all previous wills, codicils and other testamentary writings made by me.',
            },
          ]
        : []),
      ...(status === 'Married in community of property'
        ? [
            {
              kind: 'para' as const,
              text: `I am married in community of property to ${or(v(values, 'spouseName'), 'spouse')}. This will disposes only of my half share of our joint estate.`,
            },
          ]
        : status === 'Married out of community of property'
          ? [
              {
                kind: 'para' as const,
                text: `I am married out of community of property to ${or(v(values, 'spouseName'), 'spouse')}.`,
              },
            ]
          : []),
      ...lines(values, 'bequests').map((text) => ({ kind: 'para' as const, text })),
      {
        kind: 'para',
        text: `I bequeath the residue of my estate to ${or(v(values, 'residue'), 'heir(s)')}.`,
      },
      ...(v(values, 'trust') ? [{ kind: 'para' as const, text: v(values, 'trust') }] : []),
      ...(v(values, 'guardian')
        ? [
            {
              kind: 'para' as const,
              text: `I nominate ${v(values, 'guardian')} as guardian of my minor children.`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: `I nominate ${or(v(values, 'executor'), 'executor')} as executor of my estate${v(values, 'securityWaived') !== 'No' ? ', and direct that my executor be exempt from furnishing security to the Master of the High Court' : ''}.`,
      },
      {
        kind: 'text',
        text: `SIGNED at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____, by the testator in the presence of the undersigned witnesses, all being present at the same time.`,
      },
      { kind: 'signature', lines: [`TESTATOR: ${name}`] },
      {
        kind: 'text',
        text: 'AS WITNESSES (both present at the same time, signing in the presence of the testator and of each other):',
      },
      { kind: 'signature', lines: [`1. Full names: ${v(values, 'witness1')}`] },
      { kind: 'signature', lines: [`2. Full names: ${v(values, 'witness2')}`] },
    ];
    return { title: 'Last will and testament', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const benefits = [
      v(values, 'bequests'),
      v(values, 'residue'),
      v(values, 'executor'),
      v(values, 'guardian'),
    ]
      .join(' ')
      .toLowerCase();
    for (const key of ['witness1', 'witness2']) {
      const witness = v(values, key).toLowerCase();
      if (witness.length > 3 && benefits.includes(witness)) {
        issues.push({
          severity: 'must',
          field: key,
          message:
            'This witness is named as a beneficiary, executor or guardian. A witness (or their spouse) who benefits may be disqualified from the benefit: choose another witness.',
          basis: 'Wills Act 7 of 1953 s 4A',
        });
      }
    }
    if (v(values, 'maritalStatus') !== 'Unmarried' && !v(values, 'spouseName')) {
      issues.push({ severity: 'should', field: 'spouseName', message: 'Name the spouse.' });
    }
    if (v(values, 'guardian')) {
      issues.push({
        severity: 'note',
        field: 'guardian',
        message:
          'Only a parent who is the sole guardian of a child may appoint a guardian by will.',
        basis: "Children's Act 38 of 2005 s 27",
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Signing: the testator signs at the end and on every other page; two competent witnesses (14 or older), present at the same time, sign in the testator’s presence and each other’s. A will signed by mark or by someone on the testator’s behalf needs a commissioner of oaths’ certificate.',
      basis: 'Wills Act 7 of 1953 ss 1, 2(1)(a)',
    });
    return issues;
  },
};
