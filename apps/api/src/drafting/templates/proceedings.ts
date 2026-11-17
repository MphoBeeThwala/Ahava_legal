// More litigation documents: answering and replying affidavits, the simple
// summons, the notice of bar and the Rule 41A mediation notice. Standard
// wording: to be reviewed by an admitted attorney.
import type { DraftIssue } from '@ahava88/shared';
import { addCourtDays, longDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import {
  COURT_FORMAT,
  APPROVED,
  lines,
  or,
  v,
  type DraftContext,
  type DraftTemplate,
} from '../template';
import { courtFields, courtHeading } from './court';
import {
  attorneysBlock,
  attorneysFields,
  commissioner,
  commissionerNote,
  oathField,
  opening,
  paras,
  pleaLines,
  registrar,
} from './litigation';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const partiesSection = (first: string, second: string, client: 'first' | 'second') => ({
  key: 'court',
  title: 'Court and parties',
  fields: [
    { ...courtFields[0]!, required: true },
    { ...courtFields[1]!, required: true },
    {
      key: 'firstParty',
      label: first,
      type: 'text' as const,
      required: true,
      ...(client === 'first' ? { prefill: 'client.name' as const } : {}),
    },
    {
      key: 'secondParty',
      label: second,
      type: 'text' as const,
      required: true,
      ...(client === 'second' ? { prefill: 'client.name' as const } : {}),
    },
  ],
});

const deponentFields = [
  { key: 'deponentName', label: 'Deponent’s full names', type: 'text' as const, required: true },
  { key: 'deponentId', label: 'ID or passport number', type: 'id_number' as const },
  {
    key: 'deponentDescription',
    label: 'Who the deponent is',
    type: 'longtext' as const,
    required: true,
    help: 'e.g. an adult female, the respondent in this application, residing at …',
  },
  oathField,
  { key: 'place', label: 'Place of signing', type: 'text' as const, required: true },
];

/** Answers that only say "denied": not enough to raise a genuine dispute of fact. */
const bareDenial = /^(it is )?(denied|each and every allegation (herein )?is denied)\.?$/i;

function deadline(
  values: Values,
  ctx: DraftContext,
  key: string,
  days: number,
  what: string,
  basis: string,
): DraftIssue[] {
  const from = v(values, key);
  const last = from ? addCourtDays(from, days) : null;
  if (!last) return [];
  const late = ctx.today > last;
  return [
    {
      severity: late ? 'should' : 'note',
      field: key,
      message: late
        ? `The ${what} was due by ${longDate(last)}. A late affidavit needs the other side’s agreement or condonation by the court, explaining the delay.`
        : `Last day to deliver the ${what}: ${longDate(last)}.`,
      basis,
    },
  ];
}

function answers(values: Values): Block[] {
  const { answered, unnumbered } = pleaLines(values);
  return [
    ...answered.map((line) => ({
      kind: 'para' as const,
      text: `Ad paragraph${line.covers.length > 1 ? 's' : ''} ${line.paragraphs}: ${line.text}`,
    })),
    ...unnumbered.map((text) => ({ kind: 'para' as const, text })),
  ];
}

// ------------------------------------------------------------ answering affidavit

export const answeringAffidavit: DraftTemplate = {
  id: 'answering-affidavit',
  version: VERSION,
  name: 'Answering affidavit',
  category: 'high_court',
  purpose:
    'The respondent’s answer: any points in limine, the respondent’s version, and an answer to each paragraph of the founding affidavit.',
  basis: [
    'Uniform Rule 6(5)(d)(ii) (within 15 days after the notice of intention to oppose)',
    'Plascon-Evans Paints Ltd v Van Riebeeck Paints (Pty) Ltd 1984 (3) SA 623 (A) (disputes of fact on paper)',
    'Wightman t/a JW Construction v Headfour (Pty) Ltd 2008 (3) SA 371 (SCA) (a real, genuine and bona fide dispute)',
    'Regulations under the Justices of the Peace and Commissioners of Oaths Act 16 of 1963 (GN R1258 of 1972)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath' },
  sections: [
    partiesSection('Applicant', 'Respondent', 'second'),
    { key: 'deponent', title: 'Deponent', fields: deponentFields },
    {
      key: 'answer',
      title: 'The answer',
      fields: [
        {
          key: 'inLimine',
          label: 'Points in limine, one paragraph per line',
          type: 'longtext',
          help: 'e.g. lack of urgency, non-joinder, jurisdiction. Leave empty if none.',
        },
        {
          key: 'version',
          label: 'The respondent’s version, one paragraph per line',
          type: 'longtext',
          help: 'The facts in the respondent’s own words, before the paragraph-by-paragraph answer.',
        },
        {
          key: 'paragraphCount',
          label: 'Number of paragraphs in the founding affidavit',
          type: 'number',
          help: 'Used to check that every paragraph is answered.',
        },
        {
          key: 'responses',
          label: 'Answer to each paragraph, one per line',
          type: 'longtext',
          required: true,
          help: 'Start with the paragraph number: "1 to 3: Admitted." "7: Denied. The meeting was on 4 May, not 2 May, as appears from annexure AA1."',
        },
        {
          key: 'opposeDate',
          label: 'Date the notice of intention to oppose was delivered',
          type: 'date',
        },
      ],
    },
  ],
  build(values, ctx) {
    const limine = lines(values, 'inLimine');
    const version = lines(values, 'version');
    const blocks: Block[] = [
      opening(values),
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}.`,
      },
      {
        kind: 'para',
        text: 'The facts in this affidavit are within my personal knowledge, unless the context indicates otherwise, and are to the best of my knowledge and belief both true and correct. Where I make submissions of law, I do so on the advice of the respondent’s legal representatives.',
      },
      {
        kind: 'para',
        text: 'I have read the founding affidavit and its annexures. Any allegation in the founding affidavit that is inconsistent with what I say in this affidavit is denied.',
      },
      ...(limine.length
        ? [
            { kind: 'heading' as const, text: 'Points in limine' },
            ...limine.map((text) => ({ kind: 'para' as const, text })),
          ]
        : []),
      ...(version.length
        ? [
            { kind: 'heading' as const, text: 'The respondent’s version' },
            ...version.map((text) => ({ kind: 'para' as const, text })),
          ]
        : []),
      { kind: 'heading', text: 'Answer to the founding affidavit' },
      ...answers(values),
      { kind: 'heading', text: 'Conclusion' },
      {
        kind: 'para',
        text: 'WHEREFORE I ask that the application be dismissed with costs.',
      },
      ...commissioner(values),
    ];
    return {
      title: 'Answering affidavit',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const { answered } = pleaLines(values);
    const count = Number(v(values, 'paragraphCount'));
    if (Number.isInteger(count) && count > 0) {
      const covered = new Set(answered.flatMap((line) => line.covers));
      const missing = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !covered.has(n));
      if (missing.length) {
        issues.push({
          severity: 'should',
          field: 'responses',
          message: `Paragraph${missing.length > 1 ? 's' : ''} ${missing.join(', ')} of the founding affidavit ${missing.length > 1 ? 'are' : 'is'} not answered. Facts not disputed may be accepted as correct.`,
          basis: 'Plascon-Evans 1984 (3) SA 623 (A)',
        });
      }
    }
    const bare = answered.filter((line) => bareDenial.test(line.text));
    if (bare.length) {
      issues.push({
        severity: 'should',
        field: 'responses',
        message: `Paragraph ${bare.map((line) => line.paragraphs).join(', ')}: a bare denial does not raise a genuine dispute of fact where the facts are within the respondent’s knowledge. Say what the true position is.`,
        basis: 'Wightman v Headfour 2008 (3) SA 371 (SCA) para 13',
      });
    }
    issues.push(
      ...deadline(values, ctx, 'opposeDate', 15, 'answering affidavit', 'Uniform Rule 6(5)(d)(ii)'),
    );
    issues.push(commissionerNote);
    return issues;
  },
};

// ------------------------------------------------------------ replying affidavit

export const replyingAffidavit: DraftTemplate = {
  id: 'replying-affidavit',
  version: VERSION,
  name: 'Replying affidavit',
  category: 'high_court',
  purpose:
    'The applicant’s reply to the answering affidavit, dealing with the points raised and new matter, without making out a new case.',
  basis: [
    'Uniform Rule 6(5)(e) (within 10 days after service of the answering affidavit)',
    'The applicant must make out its case in the founding affidavit (e.g. Director of Hospital Services v Mistry 1979 (1) SA 626 (A))',
    'Regulations under the Justices of the Peace and Commissioners of Oaths Act 16 of 1963 (GN R1258 of 1972)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath' },
  sections: [
    partiesSection('Applicant', 'Respondent', 'first'),
    { key: 'deponent', title: 'Deponent', fields: deponentFields },
    {
      key: 'reply',
      title: 'The reply',
      fields: [
        {
          key: 'points',
          label: 'Reply to the points in limine, one paragraph per line',
          type: 'longtext',
        },
        {
          key: 'responses',
          label: 'Reply to the answering affidavit, one per line',
          type: 'longtext',
          required: true,
          help: 'Start with the paragraph of the answering affidavit: "12: The respondent’s version is denied. …"',
        },
        {
          key: 'answerServed',
          label: 'Date the answering affidavit was served',
          type: 'date',
        },
      ],
    },
  ],
  build(values, ctx) {
    const points = lines(values, 'points');
    const blocks: Block[] = [
      opening(values),
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}. I deposed to the founding affidavit in this application.`,
      },
      {
        kind: 'para',
        text: 'The facts in this affidavit are within my personal knowledge, unless the context indicates otherwise, and are to the best of my knowledge and belief both true and correct.',
      },
      {
        kind: 'para',
        text: 'I have read the respondent’s answering affidavit. I reply only to the allegations that call for a reply. My failure to deal with any allegation is not an admission of it; where it is inconsistent with the founding affidavit or this affidavit, it is denied.',
      },
      ...(points.length
        ? [
            { kind: 'heading' as const, text: 'The points in limine' },
            ...points.map((text) => ({ kind: 'para' as const, text })),
          ]
        : []),
      { kind: 'heading', text: 'Reply to the answering affidavit' },
      ...answers(values),
      { kind: 'heading', text: 'Conclusion' },
      {
        kind: 'para',
        text: 'WHEREFORE I persist in asking for an order in terms of the notice of motion.',
      },
      ...commissioner(values),
    ];
    return {
      title: 'Replying affidavit',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [
      ...deadline(values, ctx, 'answerServed', 10, 'replying affidavit', 'Uniform Rule 6(5)(e)'),
      {
        severity: 'note',
        field: 'responses',
        message:
          'Reply to the answer; do not add new grounds or evidence the case needed from the start. New matter in reply may be struck out or give the respondent a further affidavit.',
        basis: 'Uniform Rule 6(15); practice',
      },
      commissionerNote,
    ];
    return issues;
  },
};

// ------------------------------------------------------------ simple summons

export const simpleSummons: DraftTemplate = {
  id: 'simple-summons',
  version: VERSION,
  name: 'Simple summons',
  category: 'high_court',
  purpose:
    'Starts an action for a debt or liquidated demand (Form 9), with a concise statement of the cause of action; the declaration follows if the defendant defends.',
  basis: [
    'Uniform Rule 17(2)(b) and Form 9 of the First Schedule',
    'Uniform Rule 19(1) (notice of intention to defend)',
    'Uniform Rule 20(1) (declaration within 15 days of the notice to defend)',
    'Uniform Rule 41A (mediation notice)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { defendDays: '10' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        courtFields[1]!,
        {
          key: 'firstParty',
          label: 'Plaintiff',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'secondParty', label: 'Defendant', type: 'text', required: true },
        {
          key: 'plaintiffAddress',
          label: 'Plaintiff’s address',
          type: 'longtext',
          required: true,
          prefill: 'client.address',
        },
        {
          key: 'defendantAddress',
          label: 'Defendant’s address for service by the sheriff',
          type: 'longtext',
          required: true,
        },
        {
          key: 'registrarAddress',
          label: 'Registrar’s address',
          type: 'longtext',
          required: true,
        },
        {
          key: 'defendDays',
          label: 'Court days to give notice of intention to defend',
          type: 'number',
          required: true,
        },
      ],
    },
    {
      key: 'claim',
      title: 'The claim',
      fields: [
        {
          key: 'cause',
          label: 'Nature, extent and grounds of the claim',
          type: 'longtext',
          required: true,
          help: 'Concise, e.g. money lent and advanced by the plaintiff to the defendant on 1 March 2026 at Pretoria, repayable on 1 June 2026, which the defendant has failed to repay.',
        },
        { key: 'amount', label: 'Amount claimed (R)', type: 'money', required: true },
        {
          key: 'interest',
          label: 'Interest',
          type: 'text',
          help: 'e.g. at the prescribed rate from 1 June 2026 to date of payment',
        },
      ],
    },
    { key: 'attorneys', title: 'Plaintiff’s attorneys', fields: attorneysFields('plaintiff') },
  ],
  build(values, ctx) {
    const oneLine = (key: string, placeholder: string) =>
      or(v(values, key).split('\n').filter(Boolean).join(', '), placeholder);
    const amount = parseRand(v(values, 'amount'));
    const claims = [
      `Payment of the sum of ${amount !== null ? randWithWords(amount) : '[amount]'}.`,
      ...(v(values, 'interest') ? [`Interest ${v(values, 'interest')}.`] : []),
      'Costs of suit.',
    ];
    const blocks: Block[] = [
      { kind: 'text', text: 'TO THE SHERIFF OR HIS OR HER DEPUTY:' },
      {
        kind: 'text',
        text: `INFORM ${or(v(values, 'secondParty'), 'Defendant')} of ${oneLine('defendantAddress', 'address')} (hereinafter called the defendant) that ${or(v(values, 'firstParty'), 'Plaintiff')} of ${oneLine('plaintiffAddress', 'address')} (hereinafter called the plaintiff) hereby institutes action against the defendant in which the plaintiff claims:`,
      },
      ...claims.map((text, index) => ({
        kind: 'text' as const,
        text: `${String.fromCharCode(97 + index)}) ${text}`,
      })),
      {
        kind: 'text',
        text: `on the grounds that: ${or(v(values, 'cause'), 'nature, extent and grounds of the claim')}`,
      },
      {
        kind: 'text',
        text: `INFORM the defendant further that if the defendant disputes the claim and wishes to defend the action, the defendant shall within ${or(v(values, 'defendDays'), '10')} days of the service upon the defendant of this summons file with the registrar of this court at ${oneLine('registrarAddress', 'registrar’s address')} notice of the defendant's intention to defend and serve a copy of it on the plaintiff's attorneys at the address set out below, giving an address referred to in rule 19(3) for the service of all documents in this action, and an email address.`,
      },
      {
        kind: 'text',
        text: 'INFORM the defendant further that if the defendant fails to file and serve that notice, judgment as claimed may be given against the defendant without further notice.',
      },
      {
        kind: 'text',
        text: 'AND immediately thereafter serve on the defendant a copy of this summons and return to this court what you have done thereupon.',
      },
      ...attorneysBlock(values, 'plaintiff'),
      { kind: 'signature', lines: ['REGISTRAR'] },
    ];
    return {
      title: 'Simple summons',
      heading: courtHeading(values, ctx, ['Plaintiff', 'Defendant']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const days = Number(v(values, 'defendDays'));
    if (Number.isFinite(days) && days > 0 && days < 10) {
      issues.push({
        severity: 'must',
        field: 'defendDays',
        message: 'The defendant has at least 10 court days to give notice of intention to defend.',
        basis: 'Uniform Rule 19(1)',
      });
    }
    if (v(values, 'cause') && v(values, 'cause').length < 40) {
      issues.push({
        severity: 'should',
        field: 'cause',
        message:
          'State the nature, extent and grounds of the cause of action: what the debt is, when and where it arose, and why it is due.',
        basis: 'Uniform Rule 17(2)(b)',
      });
    }
    issues.push({
      severity: 'note',
      field: 'amount',
      message:
        'A simple summons is only for a debt or liquidated demand (an amount fixed or easily ascertained). For damages or other relief, use a combined summons. If the defendant defends, deliver a declaration within 15 days; summary judgment may follow the plea.',
      basis: 'Uniform Rules 17(2), 20(1), 32',
    });
    issues.push({
      severity: 'note',
      message: 'Serve a Rule 41A notice with the summons.',
      basis: 'Uniform Rule 41A(2)(a)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ notice of bar

const BARRABLE = ['plea', 'declaration', 'plea to the counterclaim'];

export const noticeOfBar: DraftTemplate = {
  id: 'notice-of-bar',
  version: VERSION,
  name: 'Notice of bar',
  category: 'high_court',
  purpose:
    'Calls on a party who is out of time to deliver its pleading within five days, failing which it is barred.',
  basis: ['Uniform Rule 26'],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { pleading: 'plea', ourRole: 'Plaintiff' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        { ...courtFields[1]!, required: true },
        { key: 'firstParty', label: 'Plaintiff', type: 'text', required: true },
        { key: 'secondParty', label: 'Defendant', type: 'text', required: true },
        {
          key: 'ourRole',
          label: 'We act for the',
          type: 'choice',
          required: true,
          choices: ['Plaintiff', 'Defendant'],
        },
      ],
    },
    {
      key: 'bar',
      title: 'The pleading',
      fields: [
        {
          key: 'pleading',
          label: 'Pleading that is outstanding',
          type: 'choice',
          required: true,
          choices: BARRABLE,
        },
        {
          key: 'dueDate',
          label: 'Last day the rules allowed for it',
          type: 'date',
          required: true,
        },
        {
          key: 'otherAttorneys',
          label: 'The other party’s attorneys (name and address)',
          type: 'longtext',
          required: true,
        },
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const ours = v(values, 'ourRole') || 'Plaintiff';
    const theirs = ours === 'Plaintiff' ? 'defendant' : 'plaintiff';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the ${theirs} is hereby required to deliver its ${or(v(values, 'pleading'), 'pleading')} within five (5) days of the service of this notice, failing which the ${theirs} will be ipso facto barred from doing so.`,
      },
      ...attorneysBlock(values, ours),
      { kind: 'text', text: registrar(values) },
      {
        kind: 'text',
        text: `AND TO: ${or(v(values, 'otherAttorneys').split('\n').filter(Boolean).join(', '), 'other party’s attorneys')} (attorneys for the ${theirs})`,
      },
    ];
    return {
      title: 'Notice of bar',
      heading: courtHeading(values, ctx, ['Plaintiff', 'Defendant']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const due = v(values, 'dueDate');
    if (due && ctx.today <= due) {
      issues.push({
        severity: 'must',
        field: 'dueDate',
        message: `A notice of bar may be delivered only once the time for the pleading has expired (after ${longDate(due)}).`,
        basis: 'Uniform Rule 26',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The five days are court days from service. A replication or later pleading needs no notice of bar: a party who does not deliver it in time is barred automatically.',
      basis: 'Uniform Rules 1, 26',
    });
    return issues;
  },
};

// ------------------------------------------------------------ Rule 41A notice

export const rule41aNotice: DraftTemplate = {
  id: 'rule-41a-notice',
  version: VERSION,
  name: 'Rule 41A mediation notice',
  category: 'high_court',
  purpose:
    'States whether the party agrees to refer the dispute to mediation, with reasons, as every new action or application requires.',
  basis: [
    'Uniform Rule 41A(2)(a) (plaintiff or applicant: with the summons or notice of motion)',
    'Uniform Rule 41A(2)(b) (defendant or respondent: with the notice of intention to defend or oppose)',
    'Uniform Rule 41A(2)(c) (reasons why the dispute is or is not capable of mediation)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { ourRole: 'Plaintiff', agrees: 'Agrees' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        courtFields[1]!,
        { key: 'firstParty', label: 'Plaintiff / applicant', type: 'text', required: true },
        { key: 'secondParty', label: 'Defendant / respondent', type: 'text', required: true },
        {
          key: 'ourRole',
          label: 'We act for the',
          type: 'choice',
          required: true,
          choices: ['Plaintiff', 'Applicant', 'Defendant', 'Respondent'],
        },
      ],
    },
    {
      key: 'mediation',
      title: 'Mediation',
      fields: [
        {
          key: 'agrees',
          label: 'Our client',
          type: 'choice',
          required: true,
          choices: ['Agrees', 'Opposes'],
        },
        {
          key: 'reasons',
          label: 'Why the dispute is or is not capable of mediation',
          type: 'longtext',
          required: true,
        },
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const role = (v(values, 'ourRole') || 'Plaintiff').toLowerCase();
    const agrees = v(values, 'agrees') !== 'Opposes';
    const action = role === 'plaintiff' || role === 'defendant';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE, in terms of rule 41A(2) of the Uniform Rules of Court, that the ${role} ${agrees ? 'agrees to' : 'opposes'} the referral of this ${action ? 'action' : 'application'} to mediation.`,
      },
      {
        kind: 'text',
        text: `The ${role} believes that the dispute ${agrees ? 'is' : 'is not'} capable of being mediated, for the following reasons:`,
      },
      ...paras(values, 'reasons'),
      ...attorneysBlock(values, role),
      { kind: 'text', text: registrar(values) },
      {
        kind: 'text',
        text: `AND TO: THE ${role === 'plaintiff' || role === 'applicant' ? (action ? 'DEFENDANT' : 'RESPONDENT') : action ? 'PLAINTIFF' : 'APPLICANT'}`,
      },
    ];
    const roles: [string, string] = action
      ? ['Plaintiff', 'Defendant']
      : ['Applicant', 'Respondent'];
    return {
      title: 'Notice in terms of rule 41A',
      heading: courtHeading(values, ctx, roles),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'reasons') && v(values, 'reasons').length < 30) {
      issues.push({
        severity: 'should',
        field: 'reasons',
        message: 'Give real reasons: the court may consider them when it decides on costs.',
        basis: 'Uniform Rule 41A(2)(c)',
      });
    }
    issues.push({
      severity: 'note',
      field: 'ourRole',
      message:
        'The plaintiff or applicant serves this with the summons or notice of motion; the defendant or respondent with its notice of intention to defend or oppose.',
      basis: 'Uniform Rule 41A(2)(a), (b)',
    });
    return issues;
  },
};
