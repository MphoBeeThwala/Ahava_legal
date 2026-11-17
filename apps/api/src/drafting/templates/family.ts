// Family law: divorce summons, settlement agreement, parenting plan,
// antenuptial contract and maintenance complaint. Standard wording: to be
// reviewed by an admitted attorney (and, for the antenuptial contract, a notary).
import type { DraftField, DraftIssue } from '@ahava88/shared';
import { longDate } from '../days';
import { parseRand, randWithWords, validSaIdNumber } from '../fields';
import type { Block } from '../model';
import {
  AGREEMENT_FORMAT,
  COURT_FORMAT,
  UNREVIEWED,
  lines,
  or,
  v,
  type DraftTemplate,
} from '../template';
import { courtHeading } from './court';
import { attorneysBlock, attorneysFields, paras } from './litigation';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const REGIMES = [
  'In community of property',
  'Out of community of property, with accrual',
  'Out of community of property, without accrual',
  'Customary marriage',
];

const childrenField: DraftField = {
  key: 'children',
  label: 'Minor children, one per line: name | date of birth',
  type: 'longtext',
  help: 'e.g. Lerato Dlamini | 2015-06-02',
};

interface Child {
  name: string;
  born: string;
}

export function children(values: Values): Child[] {
  return lines(values, 'children').map((line) => {
    const [name = '', born = ''] = line.split('|').map((part) => part.trim());
    return { name, born };
  });
}

const describeChildren = (values: Values) =>
  children(values)
    .map(
      (child) =>
        `${child.name || '[name]'}${child.born ? `, born on ${longDate(child.born) || child.born}` : ''}`,
    )
    .join('; ');

const signed = (values: Values) =>
  `SIGNED at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____.`;

const witnesses: Block[] = [
  { kind: 'text', text: 'AS WITNESSES:' },
  { kind: 'signature', lines: ['1. Full names:'] },
  { kind: 'signature', lines: ['2. Full names:'] },
];

const childNotes = (values: Values): DraftIssue[] =>
  children(values).length
    ? [
        {
          severity: 'note',
          field: 'children',
          message:
            'Minor children are involved: the court must be satisfied that the arrangements are in their best interests, and the Family Advocate may enquire and report. Children old enough must have their views heard.',
          basis:
            'Divorce Act 70 of 1979 s 6; Mediation in Certain Divorce Matters Act 24 of 1987; Children’s Act 38 of 2005 ss 6, 7, 10',
        },
      ]
    : [];

// ------------------------------------------------------------ divorce summons

export const divorceSummons: DraftTemplate = {
  id: 'divorce-summons',
  version: VERSION,
  name: 'Divorce summons and particulars of claim',
  category: 'family',
  purpose:
    'Starts divorce proceedings: the marriage, jurisdiction, the irretrievable breakdown, the children and the relief claimed.',
  basis: [
    'Divorce Act 70 of 1979 ss 3, 4 (irretrievable breakdown), 6 (children), 7 (division and maintenance), 9 (forfeiture)',
    'Divorce Act s 2(1) (jurisdiction: domicile, or ordinary residence for one year)',
    'Uniform Rule 17; Magistrates’ Courts Rules (Regional Court)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { defendDays: '10', regime: 'In community of property' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        {
          key: 'court',
          label: 'Court',
          type: 'text',
          required: true,
          help: 'e.g. High Court of South Africa, Gauteng Division, Pretoria, or Regional Court for the Regional Division of Gauteng, held at Johannesburg',
        },
        { key: 'caseNumber', label: 'Case number', type: 'text', prefill: 'matter.caseNumber' },
        {
          key: 'firstParty',
          label: 'Plaintiff',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'plaintiffDescription',
          label: 'The plaintiff (ID, occupation, address)',
          type: 'longtext',
          required: true,
        },
        { key: 'secondParty', label: 'Defendant', type: 'text', required: true },
        {
          key: 'defendantDescription',
          label: 'The defendant (ID, occupation, address)',
          type: 'longtext',
          required: true,
        },
        {
          key: 'defendantAddress',
          label: 'Defendant’s address for service',
          type: 'longtext',
          required: true,
        },
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          type: 'longtext',
          required: true,
          help: 'e.g. the plaintiff is domiciled in the area of this court.',
        },
        { key: 'defendDays', label: 'Days to defend', type: 'number', required: true },
      ],
    },
    {
      key: 'marriage',
      title: 'The marriage',
      fields: [
        { key: 'marriageDate', label: 'Date of marriage', type: 'date', required: true },
        { key: 'marriagePlace', label: 'Place of marriage', type: 'text', required: true },
        {
          key: 'regime',
          label: 'Matrimonial property system',
          type: 'choice',
          required: true,
          choices: REGIMES,
        },
        {
          key: 'breakdown',
          label: 'Why the marriage has broken down irretrievably, one per line',
          type: 'longtext',
          required: true,
        },
        childrenField,
        {
          key: 'childArrangements',
          label: 'Care, contact and maintenance asked for the children',
          type: 'longtext',
        },
        {
          key: 'relief',
          label: 'Further relief, one per line',
          type: 'longtext',
          help: 'e.g. Forfeiture of the benefits of the marriage in community of property; spousal maintenance of R5 000 a month.',
        },
      ],
    },
    { key: 'attorneys', title: 'Plaintiff’s attorneys', fields: attorneysFields('plaintiff') },
  ],
  build(values, ctx) {
    const regime = v(values, 'regime');
    const kids = children(values);
    const relief = [
      'A decree of divorce.',
      ...(regime === 'In community of property' ? ['Division of the joint estate.'] : []),
      ...(regime === 'Out of community of property, with accrual'
        ? [
            'Payment of the accrual in terms of section 3 of the Matrimonial Property Act 88 of 1984.',
          ]
        : []),
      ...(kids.length && v(values, 'childArrangements')
        ? [`An order regarding the minor children: ${v(values, 'childArrangements')}`]
        : []),
      ...lines(values, 'relief'),
      'Costs of suit, only if the action is defended.',
      'Further and/or alternative relief.',
    ];
    const blocks: Block[] = [
      { kind: 'text', text: 'TO THE SHERIFF OR HIS OR HER DEPUTY:' },
      {
        kind: 'text',
        text: `INFORM ${or(v(values, 'secondParty'), 'Defendant')}, of ${or(v(values, 'defendantAddress').split('\n').filter(Boolean).join(', '), 'address')} (the defendant), that ${or(v(values, 'firstParty'), 'Plaintiff')} (the plaintiff) institutes action against the defendant for a decree of divorce and the further relief set out in the particulars of claim annexed. If the defendant wishes to defend, the defendant must deliver a notice of intention to defend within ${or(v(values, 'defendDays'), '10')} days of service, and thereafter a plea, as the rules require, failing which judgment may be given without further notice.`,
      },
      {
        kind: 'text',
        text: 'AND immediately thereafter serve this summons on the defendant and return to this court what you have done.',
      },
      ...attorneysBlock(values, 'plaintiff'),
      { kind: 'signature', lines: ['REGISTRAR / CLERK OF THE COURT'] },
      { kind: 'spacer' },
      { kind: 'centred', text: 'PARTICULARS OF CLAIM', bold: true },
      { kind: 'heading', text: 'The parties' },
      {
        kind: 'para',
        text: `The plaintiff is ${or(v(values, 'plaintiffDescription'), 'description of the plaintiff')}.`,
      },
      {
        kind: 'para',
        text: `The defendant is ${or(v(values, 'defendantDescription'), 'description of the defendant')}.`,
      },
      { kind: 'heading', text: 'Jurisdiction' },
      { kind: 'para', text: or(v(values, 'jurisdiction'), 'jurisdiction') },
      { kind: 'heading', text: 'The marriage' },
      {
        kind: 'para',
        text: `The parties were married to each other on ${longDate(v(values, 'marriageDate')) || '[date]'} at ${or(v(values, 'marriagePlace'), 'place')}, ${regime ? regime.toLowerCase() : '[matrimonial property system]'}, and the marriage still subsists.`,
      },
      {
        kind: 'para',
        text: kids.length
          ? `The following minor children were born of the marriage: ${describeChildren(values)}.`
          : 'No children were born of the marriage, and none are expected.',
      },
      { kind: 'heading', text: 'Irretrievable breakdown' },
      {
        kind: 'para',
        text: 'The marriage relationship between the parties has reached such a state of disintegration that there is no reasonable prospect of the restoration of a normal marriage relationship between them, for the following reasons:',
      },
      ...paras(values, 'breakdown'),
      { kind: 'text', text: 'WHEREFORE the plaintiff claims:' },
      ...relief.map((text, index) => ({
        kind: 'text' as const,
        text: `${String.fromCharCode(97 + index)}) ${text}`,
      })),
      ...attorneysBlock(values, 'plaintiff'),
    ];
    return {
      title: 'Combined summons: divorce',
      heading: courtHeading(values, ctx, ['Plaintiff', 'Defendant']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [...childNotes(values)];
    if (children(values).length && !v(values, 'childArrangements')) {
      issues.push({
        severity: 'should',
        field: 'childArrangements',
        message: 'Set out the care, contact and maintenance asked for each child.',
        basis: 'Divorce Act s 6',
      });
    }
    if (lines(values, 'relief').some((line) => /forfeit/i.test(line))) {
      issues.push({
        severity: 'note',
        field: 'relief',
        message:
          'Forfeiture needs facts on the duration of the marriage, the circumstances of its breakdown and substantial misconduct, showing undue benefit.',
        basis: 'Divorce Act s 9(1)',
      });
    }
    issues.push({
      severity: 'note',
      field: 'jurisdiction',
      message:
        'Either party must be domiciled in the court’s area when the action starts, or ordinarily resident there and for at least one year before.',
      basis: 'Divorce Act 70 of 1979 s 2(1)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ divorce settlement agreement

export const divorceSettlement: DraftTemplate = {
  id: 'divorce-settlement',
  version: VERSION,
  name: 'Divorce settlement agreement',
  category: 'family',
  purpose:
    'Records how the parties divide their assets, maintenance and the children’s care and contact, to be made an order of court with the decree.',
  basis: [
    'Divorce Act 70 of 1979 ss 6, 7(1) (written agreement made an order), 7(7)–(8) (pension interests)',
    'Pension Funds Act 24 of 1956 s 37D(4) (payment of the non-member spouse’s share)',
    'Children’s Act 38 of 2005 ss 6, 7, 33, 34 (best interests; parenting plans)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { pension: 'No' },
  sections: [
    {
      key: 'parties',
      title: 'Parties and marriage',
      fields: [
        {
          key: 'firstParty',
          label: 'Plaintiff',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'secondParty', label: 'Defendant', type: 'text', required: true },
        {
          key: 'regime',
          label: 'Matrimonial property system',
          type: 'choice',
          required: true,
          choices: REGIMES,
        },
        childrenField,
      ],
    },
    {
      key: 'assets',
      title: 'Assets',
      fields: [
        { key: 'plaintiffKeeps', label: 'The plaintiff keeps, one per line', type: 'longtext' },
        { key: 'defendantKeeps', label: 'The defendant keeps, one per line', type: 'longtext' },
        {
          key: 'immovable',
          label: 'Immovable property: who takes it and on what terms',
          type: 'longtext',
        },
        { key: 'payment', label: 'Payment between the parties (R)', type: 'money' },
        { key: 'paymentBy', label: 'Paid by, and by when', type: 'text' },
        {
          key: 'pension',
          label: 'Is a pension interest to be shared?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        { key: 'pensionFund', label: 'Fund name and member’s membership number', type: 'text' },
        { key: 'pensionShare', label: 'Share of the pension interest (% or R)', type: 'text' },
      ],
    },
    {
      key: 'maintenance',
      title: 'Maintenance and children',
      fields: [
        {
          key: 'childMaintenance',
          label: 'Child maintenance per child per month (R)',
          type: 'money',
        },
        {
          key: 'escalation',
          label: 'Yearly increase',
          type: 'text',
          help: 'e.g. by CPI on 1 March each year',
        },
        { key: 'medical', label: 'Medical aid and school fees', type: 'longtext' },
        {
          key: 'spousal',
          label: 'Spousal maintenance (R per month, and until when)',
          type: 'text',
          help: 'Leave empty if none: the parties waive it.',
        },
        {
          key: 'parentingPlan',
          label: 'Is a parenting plan annexed?',
          type: 'choice',
          choices: ['Yes', 'No'],
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
  ],
  build(values) {
    const kids = children(values);
    const childMaintenance = parseRand(v(values, 'childMaintenance'));
    const payment = parseRand(v(values, 'payment'));
    const regime = v(values, 'regime');
    const list = (key: string) => lines(values, key).join('; ');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${or(v(values, 'firstParty'), 'Plaintiff')} ("the plaintiff") and ${or(v(values, 'secondParty'), 'Defendant')} ("the defendant").`,
      },
      {
        kind: 'para',
        text: 'The parties are married to each other, and divorce proceedings are pending between them. They agree that, if a decree of divorce is granted, this agreement will be made an order of court.',
      },
      { kind: 'heading', text: 'Division of assets' },
      ...(regime === 'In community of property'
        ? [
            {
              kind: 'para' as const,
              text: 'The joint estate is divided as set out below, which the parties accept as a fair division.',
            },
          ]
        : []),
      ...(regime === 'Out of community of property, with accrual'
        ? [
            {
              kind: 'para' as const,
              text: 'The parties’ claims for the accrual are settled in full by what is set out below.',
            },
          ]
        : []),
      ...(list('plaintiffKeeps')
        ? [
            {
              kind: 'para' as const,
              text: `The plaintiff keeps as his or her sole property: ${list('plaintiffKeeps')}.`,
            },
          ]
        : []),
      ...(list('defendantKeeps')
        ? [
            {
              kind: 'para' as const,
              text: `The defendant keeps as his or her sole property: ${list('defendantKeeps')}.`,
            },
          ]
        : []),
      ...(v(values, 'immovable') ? [{ kind: 'para' as const, text: v(values, 'immovable') }] : []),
      ...(payment !== null
        ? [
            {
              kind: 'para' as const,
              text: `${or(v(values, 'paymentBy'), 'The paying party, by the agreed date,')} will pay ${randWithWords(payment)}.`,
            },
          ]
        : []),
      ...(v(values, 'pension') === 'Yes'
        ? [
            {
              kind: 'para' as const,
              text: `The non-member spouse is awarded ${or(v(values, 'pensionShare'), 'share')} of the member’s pension interest in ${or(v(values, 'pensionFund'), 'fund and membership number')}, as defined in section 1 of the Divorce Act 70 of 1979, calculated at the date of the decree of divorce. The fund is ordered to endorse its records and to pay that amount to the non-member spouse in terms of section 37D(4) of the Pension Funds Act 24 of 1956.`,
            },
          ]
        : []),
      ...(kids.length
        ? [
            { kind: 'heading' as const, text: 'The children' },
            { kind: 'para' as const, text: `The minor children are: ${describeChildren(values)}.` },
            {
              kind: 'para' as const,
              text:
                v(values, 'parentingPlan') === 'No'
                  ? 'The parties remain co-holders of full parental responsibilities and rights in respect of the children, as the order provides.'
                  : 'The parties remain co-holders of full parental responsibilities and rights. The children’s care and contact are governed by the parenting plan annexed as "A", which forms part of this agreement.',
            },
            ...(childMaintenance !== null
              ? [
                  {
                    kind: 'para' as const,
                    text: `Maintenance of ${randWithWords(childMaintenance)} per child per month is paid on or before the first day of each month${v(values, 'escalation') ? `, increasing ${v(values, 'escalation')}` : ''}, until each child becomes self-supporting.`,
                  },
                ]
              : []),
            ...(v(values, 'medical')
              ? [{ kind: 'para' as const, text: v(values, 'medical') }]
              : []),
          ]
        : []),
      { kind: 'heading', text: 'Spousal maintenance' },
      {
        kind: 'para',
        text: v(values, 'spousal')
          ? `Spousal maintenance: ${v(values, 'spousal')}.`
          : 'Each party waives any claim for maintenance against the other.',
      },
      { kind: 'heading', text: 'General' },
      {
        kind: 'para',
        text: 'This agreement is in full and final settlement of all claims between the parties arising from the marriage. Each party pays his or her own legal costs. Neither party is bound by any term not recorded here.',
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [`Plaintiff: ${or(v(values, 'firstParty'), 'Plaintiff')}`] },
      { kind: 'signature', lines: [`Defendant: ${or(v(values, 'secondParty'), 'Defendant')}`] },
      ...witnesses,
    ];
    return { title: 'Settlement agreement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [...childNotes(values)];
    if (
      v(values, 'pension') === 'Yes' &&
      (!v(values, 'pensionFund') || !v(values, 'pensionShare'))
    ) {
      issues.push({
        severity: 'must',
        field: 'pensionFund',
        message:
          'A pension order must name the fund (and membership number) and state the share as a percentage or amount, or the fund cannot implement it.',
        basis: 'Divorce Act s 7(8); Pension Funds Act s 37D(4)',
      });
    }
    if (children(values).length && v(values, 'childMaintenance') === '') {
      issues.push({
        severity: 'should',
        field: 'childMaintenance',
        message:
          'Record the child maintenance: the court must be satisfied about the children’s maintenance before granting the decree.',
        basis: 'Divorce Act s 6(1)',
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ parenting plan

export const parentingPlan: DraftTemplate = {
  id: 'parenting-plan',
  version: VERSION,
  name: 'Parenting plan',
  category: 'family',
  purpose:
    'Sets out how co-holders of parental responsibilities will exercise them: where the children live, contact, maintenance, schooling and decisions.',
  basis: [
    'Children’s Act 38 of 2005 s 33 (contents; assistance in preparing it), s 34 (formalities, registration with the Family Advocate or court order)',
    'Children’s Act ss 6, 7 (best interests), 10 and 31 (the child’s views), 30 (co-holders)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'parties',
      title: 'Parents and children',
      fields: [
        { key: 'parentA', label: 'Parent', type: 'text', required: true, prefill: 'client.name' },
        { key: 'parentB', label: 'Other parent', type: 'text', required: true },
        { ...childrenField, required: true },
        {
          key: 'preparedWith',
          label: 'Prepared with the help of',
          type: 'text',
          help: 'e.g. a family advocate, social worker, psychologist or mediator',
        },
      ],
    },
    {
      key: 'care',
      title: 'Care and contact',
      fields: [
        {
          key: 'residence',
          label: 'Where and with whom the children live',
          type: 'longtext',
          required: true,
        },
        {
          key: 'contact',
          label: 'Contact with the other parent (regular)',
          type: 'longtext',
          required: true,
          help: 'e.g. every second weekend from Friday 17:00 to Sunday 17:00, and every Wednesday afternoon.',
        },
        {
          key: 'holidays',
          label: 'School holidays and special days',
          type: 'longtext',
          required: true,
        },
        { key: 'communication', label: 'Phone and video contact', type: 'text' },
      ],
    },
    {
      key: 'decisions',
      title: 'Maintenance, schooling and decisions',
      fields: [
        { key: 'maintenance', label: 'Maintenance', type: 'longtext', required: true },
        { key: 'schooling', label: 'Schooling', type: 'longtext' },
        { key: 'religion', label: 'Religious and cultural upbringing', type: 'text' },
        { key: 'medical', label: 'Medical care and emergencies', type: 'text' },
        {
          key: 'relocation',
          label: 'Moving away or travelling abroad',
          type: 'longtext',
          help: 'e.g. written consent of both parents; notice of at least 3 months.',
        },
        {
          key: 'disputes',
          label: 'Resolving disagreements',
          type: 'text',
          help: 'e.g. mediation before any court application',
        },
        {
          key: 'childViews',
          label: 'How the children’s views were taken into account',
          type: 'longtext',
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
  ],
  build(values) {
    const section = (title: string, key: string): Block[] =>
      v(values, key)
        ? [
            { kind: 'heading', text: title },
            { kind: 'para', text: v(values, key) },
          ]
        : [];
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${or(v(values, 'parentA'), 'Parent')} and ${or(v(values, 'parentB'), 'Other parent')} ("the parents"), concerning ${describeChildren(values) || '[children]'} ("the children").`,
      },
      {
        kind: 'para',
        text: `The parents are co-holders of parental responsibilities and rights in respect of the children. They make this plan, in terms of sections 33 and 34 of the Children’s Act 38 of 2005, in the children’s best interests${v(values, 'preparedWith') ? `, with the assistance of ${v(values, 'preparedWith')}` : ''}.`,
      },
      ...section('Residence', 'residence'),
      ...section('Contact', 'contact'),
      ...section('Holidays and special days', 'holidays'),
      ...section('Communication', 'communication'),
      ...section('Maintenance', 'maintenance'),
      ...section('Schooling', 'schooling'),
      ...section('Religious and cultural upbringing', 'religion'),
      ...section('Medical care', 'medical'),
      ...section('Relocation and travel', 'relocation'),
      ...section('The children’s views', 'childViews'),
      { kind: 'heading', text: 'Disagreements and review' },
      {
        kind: 'para',
        text: `${v(values, 'disputes') || 'The parents will try to resolve any disagreement through mediation before approaching a court.'} The parents will review this plan as the children grow older, and any change must be in writing.`,
      },
      {
        kind: 'para',
        text: 'Neither parent will speak badly of the other in the children’s presence, and each will support the children’s relationship with the other.',
      },
      { kind: 'text', text: signed(values) },
      { kind: 'signature', lines: [or(v(values, 'parentA'), 'Parent')] },
      { kind: 'signature', lines: [or(v(values, 'parentB'), 'Other parent')] },
      ...witnesses,
    ];
    return { title: 'Parenting plan', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (!v(values, 'childViews')) {
      issues.push({
        severity: 'should',
        field: 'childViews',
        message:
          'Record how each child’s views were considered, given the child’s age and maturity.',
        basis: 'Children’s Act 38 of 2005 ss 10, 31(1)',
      });
    }
    if (!v(values, 'preparedWith')) {
      issues.push({
        severity: 'note',
        field: 'preparedWith',
        message:
          'Where the parents are not agreed, the plan must be prepared after mediation or with the help of a family advocate, social worker or psychologist.',
        basis: 'Children’s Act s 33(5)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The plan must be in writing and signed by both parents, and may be registered with the Family Advocate or made an order of court.',
      basis: 'Children’s Act s 34(1), (2)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ antenuptial contract

export const antenuptialContract: DraftTemplate = {
  id: 'antenuptial-contract',
  version: VERSION,
  name: 'Antenuptial contract',
  category: 'family',
  purpose:
    'Sets the intended spouses’ property regime before the marriage; executed before a notary and registered in the deeds office.',
  basis: [
    'Matrimonial Property Act 88 of 1984 ss 2–6 (accrual; declaration of commencement values), s 21 (changes after marriage need a court order)',
    'Deeds Registries Act 47 of 1937 s 87 (registration within three months of execution)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { accrual: 'With accrual' },
  sections: [
    {
      key: 'parties',
      title: 'The intended spouses',
      fields: [
        {
          key: 'spouseA',
          label: 'Intended spouse',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'spouseAId', label: 'ID number', type: 'id_number', required: true },
        { key: 'spouseB', label: 'Other intended spouse', type: 'text', required: true },
        { key: 'spouseBId', label: 'ID number', type: 'id_number', required: true },
        { key: 'marriageDate', label: 'Intended date of marriage', type: 'date' },
      ],
    },
    {
      key: 'regime',
      title: 'Property regime',
      fields: [
        {
          key: 'accrual',
          label: 'Accrual system',
          type: 'choice',
          required: true,
          choices: ['With accrual', 'Without accrual'],
        },
        {
          key: 'startA',
          label: 'Net value of the first spouse’s estate at the start (R)',
          type: 'money',
        },
        {
          key: 'startB',
          label: 'Net value of the other spouse’s estate at the start (R)',
          type: 'money',
        },
        {
          key: 'excluded',
          label: 'Assets excluded from the accrual, one per line',
          type: 'longtext',
        },
        { key: 'other', label: 'Other terms, one per line', type: 'longtext' },
      ],
    },
    {
      key: 'notary',
      title: 'Notary',
      fields: [
        { key: 'notary', label: 'Notary', type: 'text', required: true },
        { key: 'place', label: 'Place of execution', type: 'text', required: true },
      ],
    },
  ],
  build(values) {
    const accrual = v(values, 'accrual') !== 'Without accrual';
    const start = (key: string) => {
      const cents = parseRand(v(values, key));
      return cents !== null ? randWithWords(cents) : '[amount]';
    };
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `BE IT HEREBY MADE KNOWN that on this ____ day of __________________ 20____, before me, ${or(v(values, 'notary'), 'Notary')}, Notary Public, duly admitted and sworn, at ${or(v(values, 'place'), 'place')}, and in the presence of the subscribing witnesses, personally came and appeared:`,
      },
      {
        kind: 'centred',
        text: `${or(v(values, 'spouseA'), 'Intended spouse')} (identity number ${or(v(values, 'spouseAId'), 'ID number')})`,
        bold: true,
      },
      { kind: 'text', text: 'and' },
      {
        kind: 'centred',
        text: `${or(v(values, 'spouseB'), 'Other intended spouse')} (identity number ${or(v(values, 'spouseBId'), 'ID number')})`,
        bold: true,
      },
      {
        kind: 'text',
        text: `(the intended spouses), who declared that, as a marriage is intended to be solemnised between them${v(values, 'marriageDate') ? ` on or about ${longDate(v(values, 'marriageDate'))}` : ''}, they have agreed on the following terms:`,
      },
      {
        kind: 'para',
        text: 'There will be no community of property between the intended spouses, and no community of profit and loss.',
      },
      ...(accrual
        ? [
            {
              kind: 'para' as const,
              text: 'The accrual system in Chapter 1 of the Matrimonial Property Act 88 of 1984 applies to the marriage.',
            },
            {
              kind: 'para' as const,
              text: `For section 6 of that Act, the first intended spouse declares the net value of his or her estate at the commencement of the marriage to be ${start('startA')}, and the other intended spouse declares the net value of his or her estate to be ${start('startB')}.`,
            },
            ...(lines(values, 'excluded').length
              ? [
                  {
                    kind: 'para' as const,
                    text: `The following assets are excluded from the accrual: ${lines(values, 'excluded').join('; ')}.`,
                  },
                ]
              : []),
          ]
        : [
            {
              kind: 'para' as const,
              text: 'The accrual system in Chapter 1 of the Matrimonial Property Act 88 of 1984 is expressly excluded.',
            },
          ]),
      {
        kind: 'para',
        text: 'The marital power, to the extent it may apply, is excluded. Each intended spouse retains his or her property, and is liable for his or her own debts.',
      },
      ...lines(values, 'other').map((text) => ({ kind: 'para' as const, text })),
      {
        kind: 'text',
        text: 'THUS DONE AND EXECUTED at the place and on the date above, in the presence of the undersigned witnesses.',
      },
      { kind: 'signature', lines: [or(v(values, 'spouseA'), 'Intended spouse')] },
      { kind: 'signature', lines: [or(v(values, 'spouseB'), 'Other intended spouse')] },
      ...witnesses,
      { kind: 'signature', lines: ['NOTARY PUBLIC'] },
    ];
    return { title: 'Antenuptial contract', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (
      v(values, 'accrual') !== 'Without accrual' &&
      (!v(values, 'startA') || !v(values, 'startB'))
    ) {
      issues.push({
        severity: 'should',
        field: 'startA',
        message:
          'Declare each spouse’s net starting value (it may be nil); without it, a spouse must otherwise prove it later.',
        basis: 'Matrimonial Property Act 88 of 1984 s 6',
      });
    }
    for (const key of ['spouseAId', 'spouseBId']) {
      if (v(values, key) && !validSaIdNumber(v(values, key)))
        issues.push({ severity: 'must', field: key, message: 'Check the ID number.' });
    }
    issues.push({
      severity: 'note',
      message:
        'Sign before the marriage, before a notary, and register in the deeds office within three months of execution; changing it after the marriage needs a court order.',
      basis: 'Deeds Registries Act s 87; Matrimonial Property Act s 21',
    });
    return issues;
  },
};

// ------------------------------------------------------------ maintenance complaint

export function monthlyNeeds(values: Values): number {
  return lines(values, 'needs').reduce((total, line) => {
    const amount = parseRand(line.split('|')[1]?.trim() ?? '');
    return total + (amount ?? 0);
  }, 0);
}

export const maintenanceComplaint: DraftTemplate = {
  id: 'maintenance-complaint',
  version: VERSION,
  name: 'Maintenance complaint (supporting statement)',
  category: 'family',
  purpose:
    'Prepares the complaint for the maintenance officer: the parties, the children, the monthly needs and what the respondent can pay, to go with the prescribed form.',
  basis: [
    'Maintenance Act 99 of 1998 s 6 (complaint), s 15 (duty of support)',
    'Maintenance Act regulations (prescribed complaint form)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'parties',
      title: 'Parties and children',
      fields: [
        {
          key: 'complainant',
          label: 'Complainant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'complainantAddress',
          label: 'Complainant’s address',
          type: 'longtext',
          required: true,
          prefill: 'client.address',
        },
        { key: 'respondent', label: 'Respondent', type: 'text', required: true },
        {
          key: 'respondentDetails',
          label: 'Respondent’s address, work and contact details',
          type: 'longtext',
          required: true,
        },
        { key: 'relationship', label: 'Relationship to the children', type: 'text' },
        { ...childrenField, required: true },
        {
          key: 'court',
          label: 'Maintenance court',
          type: 'text',
          required: true,
          help: 'Where the complainant or the children live.',
        },
      ],
    },
    {
      key: 'needs',
      title: 'Needs and means',
      fields: [
        {
          key: 'needs',
          label: 'Monthly needs, one per line: item | amount',
          type: 'longtext',
          required: true,
          help: 'e.g. Food | 2500',
        },
        { key: 'complainantIncome', label: 'Complainant’s monthly income (R)', type: 'money' },
        { key: 'respondentIncome', label: 'Respondent’s income, as far as known', type: 'text' },
        { key: 'claimed', label: 'Amount claimed per month (R)', type: 'money', required: true },
        { key: 'history', label: 'What the respondent has paid so far', type: 'longtext' },
      ],
    },
  ],
  build(values, ctx) {
    const total = monthlyNeeds(values);
    const claimed = parseRand(v(values, 'claimed'));
    const income = parseRand(v(values, 'complainantIncome'));
    const blocks: Block[] = [
      { kind: 'text', text: `Maintenance court: ${or(v(values, 'court'), 'court')}` },
      { kind: 'heading', text: 'The parties' },
      {
        kind: 'para',
        text: `Complainant: ${or(v(values, 'complainant'), 'complainant')}, of ${or(v(values, 'complainantAddress').split('\n').join(', '), 'address')}.`,
      },
      {
        kind: 'para',
        text: `Respondent: ${or(v(values, 'respondent'), 'respondent')}${v(values, 'relationship') ? ` (${v(values, 'relationship')})` : ''}. Details: ${or(v(values, 'respondentDetails').split('\n').join(', '), 'details')}.`,
      },
      { kind: 'heading', text: 'The children' },
      { kind: 'para', text: `${describeChildren(values) || '[children]'}.` },
      { kind: 'heading', text: 'Monthly needs' },
      ...lines(values, 'needs').map((line) => {
        const [item = '', amount = ''] = line.split('|').map((part) => part.trim());
        const cents = parseRand(amount);
        return {
          kind: 'text' as const,
          text: `${item || '[item]'}: ${cents !== null ? randWithWords(cents) : '[amount]'}`,
        };
      }),
      { kind: 'text', text: `Total monthly needs: ${randWithWords(total)}`, bold: true },
      { kind: 'heading', text: 'Means' },
      ...(income !== null
        ? [
            {
              kind: 'para' as const,
              text: `The complainant earns ${randWithWords(income)} per month.`,
            },
          ]
        : []),
      ...(v(values, 'respondentIncome')
        ? [
            {
              kind: 'para' as const,
              text: `The respondent’s income, as far as known: ${v(values, 'respondentIncome')}.`,
            },
          ]
        : []),
      ...(v(values, 'history')
        ? [{ kind: 'para' as const, text: `Payments so far: ${v(values, 'history')}` }]
        : []),
      { kind: 'heading', text: 'Request' },
      {
        kind: 'para',
        text: `The complainant asks that the respondent be ordered to pay maintenance of ${claimed !== null ? randWithWords(claimed) : '[amount]'} per month for the children, and to contribute to their medical and school costs.`,
      },
      { kind: 'text', text: `Signed on ${longDate(ctx.today)}.` },
      { kind: 'signature', lines: [`Complainant: ${or(v(values, 'complainant'), 'complainant')}`] },
    ];
    return { title: 'Maintenance complaint: supporting statement', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const total = monthlyNeeds(values);
    const claimed = parseRand(v(values, 'claimed'));
    if (claimed !== null && total > 0 && claimed > total) {
      issues.push({
        severity: 'should',
        field: 'claimed',
        message: 'The amount claimed is more than the total monthly needs listed.',
      });
    }
    if (
      lines(values, 'needs').some((line) => parseRand(line.split('|')[1]?.trim() ?? '') === null)
    ) {
      issues.push({
        severity: 'should',
        field: 'needs',
        message: 'Give an amount for each item, as "item | amount".',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The complaint itself is lodged on the prescribed form with the maintenance officer at the court where the complainant or the children live; attach proof of expenses and income. Both parents share the duty of support according to their means.',
      basis: 'Maintenance Act 99 of 1998 ss 6, 15',
    });
    return issues;
  },
};
