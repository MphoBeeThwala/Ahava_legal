// High Court documents: ex parte and urgent notices of motion, exception,
// Rule 30 notice, discovery affidavit, pre-trial minute, heads of argument,
// practice note, draft order, index, notice of set down, application for
// leave to appeal and settlement agreement. Standard wording: to be reviewed
// by an admitted attorney.
import type { DraftField, DraftIssue, DraftSection } from '@ahava88/shared';
import { addCourtDays, isBusinessDay, longDate } from '../days';
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
  registrar,
} from './litigation';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

// ------------------------------------------------------------ shared pieces

const ROLES = ['Plaintiff', 'Defendant', 'Applicant', 'Respondent'];

function partiesSection(
  options: { secondRequired?: boolean; withRole?: boolean } = {},
): DraftSection {
  const fields: DraftField[] = [
    { ...courtFields[0]!, required: true },
    { ...courtFields[1]!, required: true },
    { key: 'firstParty', label: 'Plaintiff / applicant', type: 'text', required: true },
    {
      key: 'secondParty',
      label: 'Defendant / respondent',
      type: 'text',
      required: options.secondRequired ?? true,
    },
    {
      key: 'proceedings',
      label: 'Kind of proceedings',
      type: 'choice',
      required: true,
      choices: ['Action', 'Application'],
    },
  ];
  if (options.withRole ?? true) {
    fields.push({
      key: 'ourRole',
      label: 'We act for the',
      type: 'choice',
      required: true,
      choices: ROLES,
    });
  }
  return { key: 'court', title: 'Court and parties', fields };
}

const roles = (values: Values): [string, string] =>
  v(values, 'proceedings') === 'Action' ? ['Plaintiff', 'Defendant'] : ['Applicant', 'Respondent'];

/** Our party and the other side, from "We act for the …". */
function sides(values: Values): { ours: string; theirs: string } {
  const [first, second] = roles(values);
  const role = v(values, 'ourRole');
  const ours = [first, second].includes(role)
    ? role
    : role === 'Defendant' || role === 'Respondent'
      ? second
      : first;
  return { ours: ours.toLowerCase(), theirs: (ours === first ? second : first).toLowerCase() };
}

const otherAttorneys: DraftField = {
  key: 'otherAttorneys',
  label: 'The other side’s attorneys (name and address)',
  type: 'longtext',
};

function served(values: Values, ours: string, theirs: string): Block[] {
  return [
    ...attorneysBlock(values, ours),
    { kind: 'text', text: registrar(values) },
    {
      kind: 'text',
      text: `AND TO: ${or(v(values, 'otherAttorneys').split('\n').filter(Boolean).join(', '), `the ${theirs}’s attorneys`)} (attorneys for the ${theirs})`,
    },
  ];
}

const deponentFields: DraftField[] = [
  { key: 'deponentName', label: 'Deponent’s full names', type: 'text', required: true },
  { key: 'deponentId', label: 'ID or passport number', type: 'id_number' },
  { key: 'deponentDescription', label: 'Who the deponent is', type: 'longtext', required: true },
  oathField,
];

const numbered = (items: string[]): Block[] =>
  items.map((text, index) => ({ kind: 'text' as const, text: `${index + 1}. ${text}` }));

function courtDayIssue(values: Values, key: string, basis: string): DraftIssue[] {
  const date = v(values, key);
  if (date && !isBusinessDay(date)) {
    return [
      {
        severity: 'must',
        field: key,
        message: `${longDate(date)} is not a court day.`,
        basis,
      },
    ];
  }
  return [];
}

function lateIssue(
  values: Values,
  ctx: DraftContext,
  key: string,
  days: number,
  what: string,
  basis: string,
  severity: 'must' | 'should' = 'should',
): DraftIssue[] {
  const from = v(values, key);
  const last = from ? addCourtDays(from, days) : null;
  if (!last) return [];
  return [
    ctx.today > last
      ? {
          severity,
          field: key,
          message: `The ${what} was due by ${longDate(last)}; it now needs the other side’s agreement or condonation.`,
          basis,
        }
      : {
          severity: 'note',
          field: key,
          message: `Last day for the ${what}: ${longDate(last)}.`,
          basis,
        },
  ];
}

// ------------------------------------------------------------ ex parte notice of motion

const prayersField: DraftField = {
  key: 'prayers',
  label: 'Order sought, one prayer per line',
  type: 'longtext',
  required: true,
};

export const exParteNoticeOfMotion: DraftTemplate = {
  id: 'ex-parte-notice-of-motion',
  version: VERSION,
  name: 'Ex parte notice of motion',
  category: 'high_court',
  purpose:
    'Starts an application brought without notice to anyone, because no relief is sought against another person or because notice would defeat the purpose.',
  basis: [
    'Uniform Rule 6(4) and Form 2 of the First Schedule',
    'Duty of utmost good faith on ex parte applications (Schlesinger v Schlesinger 1979 (4) SA 342 (W))',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { hearingTime: '10:00' },
  sections: [
    {
      key: 'court',
      title: 'Court and applicant',
      fields: [
        { ...courtFields[0]!, required: true },
        courtFields[1]!,
        {
          key: 'firstParty',
          label: 'Applicant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
      ],
    },
    {
      key: 'relief',
      title: 'Hearing and relief',
      fields: [
        { key: 'hearingDate', label: 'Hearing date', type: 'date', required: true },
        { key: 'hearingTime', label: 'Time', type: 'text', required: true },
        prayersField,
        {
          key: 'deponent',
          label: 'Deponent to the founding affidavit',
          type: 'text',
          required: true,
        },
        {
          key: 'whyExParte',
          label: 'Why no notice is given',
          type: 'choice',
          required: true,
          choices: [
            'No relief is sought against anyone',
            'Notice would defeat the purpose',
            'Other',
          ],
        },
      ],
    },
    { key: 'attorneys', title: 'Applicant’s attorneys', fields: attorneysFields('applicant') },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that application will be made on behalf of the above-named applicant on ${longDate(v(values, 'hearingDate')) || '[date]'} at ${or(v(values, 'hearingTime'), '10:00')} or so soon thereafter as counsel may be heard, for an order in the following terms:`,
      },
      ...numbered(lines(values, 'prayers')),
      {
        kind: 'text',
        text: `${lines(values, 'prayers').length + 1}. Further and/or alternative relief.`,
      },
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the affidavit of ${or(v(values, 'deponent'), 'deponent')}, annexed hereto, will be used in support of this application.`,
      },
      ...attorneysBlock(values, 'applicant'),
      { kind: 'text', text: registrar(values) },
    ];
    return {
      title: 'Notice of motion (ex parte)',
      heading: courtHeading({ ...values, secondParty: '' }, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [...courtDayIssue(values, 'hearingDate', 'Uniform Rule 6(4)')];
    if (v(values, 'whyExParte') !== 'No relief is sought against anyone') {
      issues.push({
        severity: 'should',
        field: 'whyExParte',
        message:
          'Where relief affects another person, the founding affidavit must explain why notice is not given, and the order is usually provisional (a rule nisi with a return date).',
        basis: 'Uniform Rule 6(4)(a)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'An ex parte applicant must disclose every material fact, including facts against it; non-disclosure can lead to the order being set aside.',
      basis: 'Schlesinger v Schlesinger 1979 (4) SA 342 (W)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ urgent application

export const urgentApplication: DraftTemplate = {
  id: 'urgent-application',
  version: VERSION,
  name: 'Urgent application (notice of motion)',
  category: 'high_court',
  purpose:
    'Brings an application on shortened times, asking the court to dispense with the ordinary forms and service and hear it as urgent.',
  basis: [
    'Uniform Rule 6(12)(a), (b)',
    'Divisional practice directives on the urgent court (set-down days, times and papers)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { hearingTime: '10:00' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        courtFields[1]!,
        {
          key: 'firstParty',
          label: 'Applicant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'secondParty', label: 'Respondent', type: 'text', required: true },
        { key: 'respondentAddress', label: 'Respondent’s address for service', type: 'longtext' },
      ],
    },
    {
      key: 'times',
      title: 'Shortened times',
      fields: [
        {
          key: 'opposeBy',
          label: 'Notice of opposition by (date and time)',
          type: 'text',
          required: true,
          help: 'e.g. 12:00 on Friday 20 November 2026',
        },
        {
          key: 'answerBy',
          label: 'Answering affidavit by (date and time)',
          type: 'text',
          required: true,
        },
        { key: 'hearingDate', label: 'Hearing date', type: 'date', required: true },
        { key: 'hearingTime', label: 'Time', type: 'text', required: true },
      ],
    },
    {
      key: 'relief',
      title: 'Relief',
      fields: [
        prayersField,
        {
          key: 'interim',
          label: 'Interim relief pending a return date?',
          type: 'choice',
          choices: ['No', 'Yes'],
        },
        { key: 'returnDate', label: 'Return date (if interim relief)', type: 'date' },
        {
          key: 'deponent',
          label: 'Deponent to the founding affidavit',
          type: 'text',
          required: true,
        },
      ],
    },
    { key: 'attorneys', title: 'Applicant’s attorneys', fields: attorneysFields('applicant') },
  ],
  build(values, ctx) {
    const interim = v(values, 'interim') === 'Yes';
    const prayers = [
      'Dispensing with the forms and service provided for in the Uniform Rules of Court and directing that this application be heard as one of urgency in terms of rule 6(12).',
      ...(interim
        ? [
            `That a rule nisi be issued calling on the respondent to show cause, if any, on ${longDate(v(values, 'returnDate')) || '[return date]'} why the following order should not be made final:`,
          ]
        : []),
      ...lines(values, 'prayers'),
      ...(interim
        ? [
            'That the order above operate as an interim order with immediate effect pending the return date.',
          ]
        : []),
      'Costs of the application.',
      'Further and/or alternative relief.',
    ];
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the applicant intends to apply to this court on ${longDate(v(values, 'hearingDate')) || '[date]'} at ${or(v(values, 'hearingTime'), '10:00')} or so soon thereafter as counsel may be heard, for an order in the following terms:`,
      },
      ...numbered(prayers),
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the affidavit of ${or(v(values, 'deponent'), 'deponent')}, annexed hereto, will be used in support of this application.`,
      },
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that if the respondent intends to oppose this application, it is required to notify the applicant’s attorneys in writing by ${or(v(values, 'opposeBy'), 'date and time')}, appointing an address for service and an email address, and to deliver its answering affidavit, if any, by ${or(v(values, 'answerBy'), 'date and time')}.`,
      },
      ...attorneysBlock(values, 'applicant'),
      { kind: 'text', text: registrar(values) },
      {
        kind: 'text',
        text: `AND TO: ${or(v(values, 'secondParty'), 'the respondent')}${v(values, 'respondentAddress') ? `, ${v(values, 'respondentAddress').split('\n').join(', ')}` : ''}`,
      },
    ];
    return {
      title: 'Notice of motion (urgent)',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [...courtDayIssue(values, 'hearingDate', 'Uniform Rule 6(12)')];
    if (v(values, 'interim') === 'Yes' && !v(values, 'returnDate')) {
      issues.push({
        severity: 'must',
        field: 'returnDate',
        message: 'Interim relief needs a return date.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The founding affidavit must set out explicitly why the matter is urgent and why the applicant cannot get substantial redress in due course; the degree of urgency must match the times chosen. Follow the division’s urgent court directive (set-down day, time and papers).',
      basis: 'Uniform Rule 6(12)(b); divisional practice directives',
    });
    return issues;
  },
};

// ------------------------------------------------------------ exception

const GROUNDS = [
  'lacks averments necessary to sustain a cause of action',
  'lacks averments necessary to sustain a defence',
  'is vague and embarrassing',
];

export const exception: DraftTemplate = {
  id: 'exception',
  version: VERSION,
  name: 'Exception',
  category: 'high_court',
  purpose:
    'Objects that a pleading is vague and embarrassing, or lacks the averments needed to sustain a claim or defence.',
  basis: ['Uniform Rule 23(1)', 'Uniform Rule 23(1)(a) (notice to remove the cause of complaint)'],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { proceedings: 'Action', ourRole: 'Defendant', pleading: 'particulars of claim' },
  sections: [
    partiesSection(),
    {
      key: 'exception',
      title: 'The exception',
      fields: [
        {
          key: 'pleading',
          label: 'Pleading excepted to',
          type: 'text',
          required: true,
          help: 'e.g. particulars of claim, plea',
        },
        { key: 'ground', label: 'Ground', type: 'choice', required: true, choices: GROUNDS },
        { key: 'grounds', label: 'Why, one paragraph per line', type: 'longtext', required: true },
        {
          key: 'noticeDate',
          label: 'Date the notice to remove the cause of complaint was delivered',
          type: 'date',
        },
        otherAttorneys,
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const { ours, theirs } = sides(values);
    const pleading = or(v(values, 'pleading'), 'pleading');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the ${ours} excepts to the ${theirs}’s ${pleading} on the ground that it ${or(v(values, 'ground'), 'ground')}, as follows:`,
      },
      ...paras(values, 'grounds'),
      {
        kind: 'text',
        text: `WHEREFORE the ${ours} prays that the exception be upheld with costs, that the ${pleading} be set aside, and that the ${theirs} be given leave to amend within 15 days.`,
      },
      ...served(values, ours, theirs),
    ];
    return { title: 'Exception', heading: courtHeading(values, ctx, roles(values)), blocks };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const vague = v(values, 'ground') === 'is vague and embarrassing';
    if (!v(values, 'noticeDate')) {
      issues.push({
        severity: vague ? 'must' : 'should',
        field: 'noticeDate',
        message: vague
          ? 'Before excepting that a pleading is vague and embarrassing, deliver a notice giving 15 days to remove the cause of complaint.'
          : 'Check whether a prior notice to remove the cause of complaint is required for this ground under the current rule and the division’s practice; it is good practice in any event.',
        basis: 'Uniform Rule 23(1)(a)',
      });
    } else {
      const removeBy = addCourtDays(v(values, 'noticeDate'), 15);
      if (removeBy && ctx.today <= removeBy) {
        issues.push({
          severity: 'must',
          field: 'noticeDate',
          message: `The other side has until ${longDate(removeBy)} to remove the cause of complaint; the exception may be delivered only after that, within 10 days.`,
          basis: 'Uniform Rule 23(1)(a), (b)',
        });
      }
    }
    issues.push({
      severity: 'note',
      message:
        'An exception is decided on the pleading as it stands, accepting its allegations as true: rely on what it says or leaves out, not on facts outside it.',
      basis: 'Uniform Rule 23; practice',
    });
    return issues;
  },
};

// ------------------------------------------------------------ Rule 30 notice

export const rule30Notice: DraftTemplate = {
  id: 'rule-30-notice',
  version: VERSION,
  name: 'Notice of irregular step (Rule 30)',
  category: 'high_court',
  purpose:
    'Gives the other side 10 days to remove the cause of complaint about an irregular step, before an application to set it aside.',
  basis: ['Uniform Rule 30(1), (2)'],
  review: APPROVED,
  format: COURT_FORMAT,
  sections: [
    partiesSection(),
    {
      key: 'step',
      title: 'The irregular step',
      fields: [
        {
          key: 'step',
          label: 'The step complained of',
          type: 'text',
          required: true,
          help: 'e.g. the plaintiff’s notice of amendment dated 3 November 2026',
        },
        {
          key: 'complaints',
          label: 'Why it is irregular, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'awareOn', label: 'Date we became aware of the step', type: 'date', required: true },
        otherAttorneys,
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const { ours, theirs } = sides(values);
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the ${ours} considers ${or(v(values, 'step'), 'the step')} to be an irregular step, for the following reasons:`,
      },
      ...paras(values, 'complaints'),
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the ${theirs} is afforded ten (10) days from service of this notice to remove the cause of complaint, failing which the ${ours} will apply to court to have the step set aside, with costs.`,
      },
      ...served(values, ours, theirs),
    ];
    return {
      title: 'Notice in terms of rule 30(2)(b)',
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks(values, ctx) {
    return [
      ...lateIssue(values, ctx, 'awareOn', 10, 'Rule 30 notice', 'Uniform Rule 30(2)(b)'),
      {
        severity: 'note',
        message:
          'Do not take a further step in the case after becoming aware of the irregularity; if the cause is not removed in 10 days, apply within the next 15 days.',
        basis: 'Uniform Rule 30(2)(a), (c)',
      },
    ];
  },
};

// ------------------------------------------------------------ discovery affidavit

export const discoveryAffidavit: DraftTemplate = {
  id: 'discovery-affidavit',
  version: VERSION,
  name: 'Discovery affidavit',
  category: 'high_court',
  purpose:
    'Lists, on oath, the documents relevant to the action that the party has, privileged documents and why, and documents it no longer has.',
  basis: ['Uniform Rule 35(1), (2) and Form 11 of the First Schedule', 'GN R1258 of 1972'],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { proceedings: 'Action', oath: 'Oath' },
  sections: [
    partiesSection(),
    {
      key: 'deponent',
      title: 'Deponent',
      fields: [
        ...deponentFields,
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
    {
      key: 'schedules',
      title: 'Documents',
      fields: [
        {
          key: 'partOne',
          label: 'Part 1: documents we have and will produce, one per line',
          type: 'longtext',
          required: true,
          help: 'e.g. Loan agreement, 1 March 2026',
        },
        {
          key: 'partTwo',
          label: 'Part 2: privileged documents, one per line with the ground',
          type: 'longtext',
          help: 'e.g. Correspondence with our attorneys, 2026 | legal professional privilege',
        },
        {
          key: 'partThree',
          label: 'Part 3: documents we had but no longer have, one per line',
          type: 'longtext',
          help: 'With when they were last held and where they are now.',
        },
        { key: 'noticeDate', label: 'Date the notice to discover was served', type: 'date' },
      ],
    },
  ],
  build(values, ctx) {
    const { ours } = sides(values);
    const schedule = (key: string, empty: string): Block[] =>
      lines(values, key).length ? numbered(lines(values, key)) : [{ kind: 'text', text: empty }];
    const blocks: Block[] = [
      opening(values),
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}, and I am duly authorised to make this affidavit on behalf of the ${ours}.`,
      },
      {
        kind: 'para',
        text: `The ${ours} has in its possession or under its control the documents relating to the matters in question in this action set out in the first part of the schedule, which it is willing to produce.`,
      },
      {
        kind: 'para',
        text: `The ${ours} has in its possession or under its control the documents set out in the second part of the schedule, which it objects to producing on the grounds stated there.`,
      },
      {
        kind: 'para',
        text: `The ${ours} has had, but no longer has, in its possession or under its control the documents set out in the third part of the schedule, as stated there.`,
      },
      {
        kind: 'para',
        text: `Neither the ${ours} nor any other person on its behalf has now, or ever had, in its possession or under its control any other document relating to any matter in question in this action, other than the documents in the schedule.`,
      },
      ...commissioner(values),
      { kind: 'heading', text: 'Schedule: part 1' },
      ...schedule('partOne', 'None.'),
      { kind: 'heading', text: 'Schedule: part 2 (privileged)' },
      ...schedule('partTwo', 'None.'),
      { kind: 'heading', text: 'Schedule: part 3 (no longer held)' },
      ...schedule('partThree', 'None.'),
    ];
    return {
      title: 'Discovery affidavit',
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [
      ...lateIssue(values, ctx, 'noticeDate', 20, 'discovery affidavit', 'Uniform Rule 35(1)'),
    ];
    const missingGround = lines(values, 'partTwo').filter((line) => !line.includes('|'));
    if (missingGround.length) {
      issues.push({
        severity: 'should',
        field: 'partTwo',
        message:
          'State the ground of privilege for each document in part 2 (e.g. "| legal professional privilege").',
        basis: 'Uniform Rule 35(2)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Include documents that harm the client’s case: discovery covers every relevant document, and a document not discovered may not be used without leave. Audio and video recordings are discovered too.',
      basis: 'Uniform Rule 35',
    });
    issues.push(commissionerNote);
    return issues;
  },
};

// ------------------------------------------------------------ pre-trial minute

export const preTrialMinute: DraftTemplate = {
  id: 'pre-trial-minute',
  version: VERSION,
  name: 'Pre-trial conference minute',
  category: 'high_court',
  purpose:
    'Records the pre-trial conference: who attended, what is admitted or agreed, what remains in dispute, and the trial’s length and readiness.',
  basis: [
    'Uniform Rule 37(6)',
    'Divisional practice directives (judicial case management, trial certification)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { proceedings: 'Action' },
  sections: [
    partiesSection({ withRole: false }),
    {
      key: 'conference',
      title: 'The conference',
      fields: [
        { key: 'heldOn', label: 'Date held', type: 'date', required: true },
        { key: 'heldAt', label: 'Where or how', type: 'text', help: 'e.g. by video link' },
        {
          key: 'attendees',
          label: 'Who attended for each party, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'admissions', label: 'Admissions made, one per line', type: 'longtext' },
        {
          key: 'agreed',
          label: 'Other matters agreed, one per line',
          type: 'longtext',
          help: 'e.g. documents may be used as what they purport to be, without formal proof.',
        },
        {
          key: 'disputes',
          label: 'Issues still in dispute, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'separation', label: 'Issues to be separated (Rule 33(4)), if any', type: 'text' },
        {
          key: 'experts',
          label: 'Experts and whether their summaries are filed',
          type: 'longtext',
        },
        { key: 'witnesses', label: 'Number of witnesses for each party', type: 'text' },
        {
          key: 'duration',
          label: 'Estimated duration of the trial (days)',
          type: 'number',
          required: true,
        },
        { key: 'settlement', label: 'Settlement or mediation discussed', type: 'text' },
        {
          key: 'ready',
          label: 'Is the matter ready for trial?',
          type: 'choice',
          required: true,
          choices: ['Yes', 'No'],
        },
      ],
    },
  ],
  build(values, ctx) {
    const section = (title: string, key: string, empty: string): Block[] => [
      { kind: 'heading', text: title },
      ...(lines(values, key).length
        ? lines(values, key).map((text) => ({ kind: 'para' as const, text }))
        : [{ kind: 'para' as const, text: empty }]),
    ];
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `Minute of a pre-trial conference held in terms of rule 37 on ${longDate(v(values, 'heldOn')) || '[date]'}${v(values, 'heldAt') ? `, ${v(values, 'heldAt')}` : ''}.`,
      },
      ...section('Present', 'attendees', '[attendees]'),
      ...section('Admissions', 'admissions', 'No admissions were made.'),
      ...section('Matters agreed', 'agreed', 'None.'),
      ...section('Issues in dispute', 'disputes', '[issues]'),
      { kind: 'heading', text: 'Conduct of the trial' },
      {
        kind: 'para',
        text: `Separation of issues: ${v(values, 'separation') || 'none is sought'}.`,
      },
      { kind: 'para', text: `Experts: ${v(values, 'experts') || 'none'}.` },
      ...(v(values, 'witnesses')
        ? [{ kind: 'para' as const, text: `Witnesses: ${v(values, 'witnesses')}.` }]
        : []),
      {
        kind: 'para',
        text: `The trial is estimated to last ${or(v(values, 'duration'), 'number')} day(s).`,
      },
      {
        kind: 'para',
        text: `Settlement: ${v(values, 'settlement') || 'the parties discussed settlement without success'}.`,
      },
      {
        kind: 'para',
        text:
          v(values, 'ready') === 'Yes'
            ? 'The parties confirm that the matter is ready for trial.'
            : 'The matter is not yet ready for trial.',
      },
      { kind: 'signature', lines: [`For the ${roles(values)[0].toLowerCase()}`] },
      { kind: 'signature', lines: [`For the ${roles(values)[1].toLowerCase()}`] },
    ];
    return {
      title: 'Pre-trial conference minute',
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'ready') === 'No') {
      issues.push({
        severity: 'note',
        field: 'ready',
        message:
          'Record what remains to be done before the matter can be certified trial-ready, and by when.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Both parties sign the minute. Check the division’s directive for what the minute must cover before trial certification.',
      basis: 'Uniform Rule 37(6); divisional practice directives',
    });
    return issues;
  },
};

// ------------------------------------------------------------ heads of argument

/** Looks like a case citation: a law report, a neutral citation or a court abbreviation. */
export const CITATION =
  /(\(\d{4}\)|\[\d{4}\]|\d{4} \(\d+\) SA|\bZA[A-Z]{2,5}\b|\((SCA|CC|A|W|T|C|N|D|E|GP|GJ|WCC|KZP|KZD|ECG|LC|LAC)\))/;

export const headsOfArgument: DraftTemplate = {
  id: 'heads-of-argument',
  version: VERSION,
  name: 'Heads of argument',
  category: 'high_court',
  purpose:
    'Sets out the party’s argument concisely: the issues, the facts, the law and the order sought, with a list of authorities.',
  basis: [
    'Divisional practice directives (form, length, filing times, CaseLines)',
    'SCA Rules (where the appeal is to the SCA)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  sections: [
    partiesSection(),
    {
      key: 'heads',
      title: 'The argument',
      fields: [
        { key: 'introduction', label: 'Introduction', type: 'longtext', required: true },
        {
          key: 'issues',
          label: 'Issues for decision, one per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'facts',
          label: 'Material facts, one paragraph per line (with record references)',
          type: 'longtext',
          required: true,
        },
        {
          key: 'argument',
          label: 'Law and argument, one paragraph per line',
          type: 'longtext',
          required: true,
        },
        { key: 'order', label: 'Order sought', type: 'longtext', required: true },
        {
          key: 'authorities',
          label: 'Authorities relied on, one per line',
          type: 'longtext',
          required: true,
          help: 'Full citations, e.g. Plascon-Evans Paints Ltd v Van Riebeeck Paints (Pty) Ltd 1984 (3) SA 623 (A)',
        },
        { key: 'counsel', label: 'Counsel (name, chambers)', type: 'text', required: true },
        { key: 'signDate', label: 'Date', type: 'date', prefill: 'today' },
      ],
    },
  ],
  build(values, ctx) {
    const { ours } = sides(values);
    const blocks: Block[] = [
      { kind: 'heading', text: 'Introduction' },
      ...paras(values, 'introduction'),
      { kind: 'heading', text: 'Issues' },
      ...paras(values, 'issues'),
      { kind: 'heading', text: 'The facts' },
      ...paras(values, 'facts'),
      { kind: 'heading', text: 'The law and argument' },
      ...paras(values, 'argument'),
      { kind: 'heading', text: 'Order sought' },
      ...paras(values, 'order'),
      {
        kind: 'signature',
        lines: [
          or(v(values, 'counsel'), 'Counsel'),
          `Counsel for the ${ours}`,
          longDate(v(values, 'signDate') || ctx.today),
        ],
      },
      { kind: 'heading', text: 'List of authorities' },
      ...numbered(lines(values, 'authorities')),
    ];
    return {
      title: `${ours.charAt(0).toUpperCase()}${ours.slice(1)}’s heads of argument`,
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const uncited = lines(values, 'authorities').filter(
      (line) => !CITATION.test(line) && !/\bAct\b|\bRule/i.test(line),
    );
    if (uncited.length) {
      issues.push({
        severity: 'should',
        field: 'authorities',
        message: `Give a full citation (law report or neutral citation) for: ${uncited.slice(0, 3).join('; ')}${uncited.length > 3 ? ' …' : ''}. Check every authority against the report itself.`,
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Check the division’s directive for page limits, the practice note, chronology and filing times, and upload to CaseLines where it applies.',
      basis: 'Divisional practice directives',
    });
    return issues;
  },
};

// ------------------------------------------------------------ practice note

export const practiceNote: DraftTemplate = {
  id: 'practice-note',
  version: VERSION,
  name: 'Practice note',
  category: 'high_court',
  purpose:
    'Summarises the matter for the judge: parties, nature, issues, relief, duration and urgency, with references to the papers.',
  basis: ['Divisional practice directives'],
  review: APPROVED,
  format: COURT_FORMAT,
  sections: [
    partiesSection(),
    {
      key: 'note',
      title: 'Practice note',
      fields: [
        {
          key: 'roll',
          label: 'Roll and date',
          type: 'text',
          required: true,
          help: 'e.g. Opposed motion roll, 3 February 2027',
        },
        { key: 'nature', label: 'Nature of the matter', type: 'longtext', required: true },
        {
          key: 'issues',
          label: 'Issues to be decided, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'relief', label: 'Relief sought', type: 'longtext', required: true },
        {
          key: 'duration',
          label: 'Estimated duration',
          type: 'text',
          required: true,
          help: 'e.g. half a day',
        },
        { key: 'urgency', label: 'Urgency', type: 'text', help: 'Leave empty if not urgent.' },
        {
          key: 'papers',
          label: 'Parts of the papers to be read (CaseLines sections or pages)',
          type: 'longtext',
        },
        { key: 'counsel', label: 'Counsel for each party', type: 'longtext', required: true },
      ],
    },
  ],
  build(values, ctx) {
    const row = (label: string, value: string): Block => ({
      kind: 'para',
      text: `${label}: ${value}`,
    });
    const blocks: Block[] = [
      row('Roll', or(v(values, 'roll'), 'roll and date')),
      row(
        'Parties',
        `${or(v(values, 'firstParty'), 'first party')} (${roles(values)[0].toLowerCase()}) and ${or(v(values, 'secondParty'), 'second party')} (${roles(values)[1].toLowerCase()})`,
      ),
      row('Nature of the matter', or(v(values, 'nature'), 'nature')),
      row('Issues', lines(values, 'issues').join('; ') || '[issues]'),
      row('Relief sought', or(v(values, 'relief'), 'relief')),
      row('Estimated duration', or(v(values, 'duration'), 'duration')),
      row('Urgency', v(values, 'urgency') || 'The matter is not urgent.'),
      ...(v(values, 'papers') ? [row('Papers to be read', v(values, 'papers'))] : []),
      row('Counsel', lines(values, 'counsel').join('; ') || '[counsel]'),
    ];
    return { title: 'Practice note', heading: courtHeading(values, ctx, roles(values)), blocks };
  },
  checks() {
    return [
      {
        severity: 'note',
        message:
          'Check the division’s directive for what the practice note must contain and when it is filed.',
        basis: 'Divisional practice directives',
      },
    ];
  },
};

// ------------------------------------------------------------ draft order

export const draftOrder: DraftTemplate = {
  id: 'draft-order',
  version: VERSION,
  name: 'Draft order',
  category: 'high_court',
  purpose: 'The order the party asks the court to make, ready for the judge to sign.',
  basis: [
    'Divisional practice directives',
    'Uniform Rule 67A (costs; counsel’s fees on scale A, B or C)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  sections: [
    partiesSection({ withRole: false }),
    {
      key: 'order',
      title: 'The order',
      fields: [
        {
          key: 'judge',
          label: 'Before the Honourable',
          type: 'text',
          help: 'e.g. Justice Mokoena (leave empty to complete in court)',
        },
        { key: 'orderDate', label: 'Date', type: 'date' },
        {
          key: 'heard',
          label: 'Order made after',
          type: 'choice',
          required: true,
          choices: [
            'Hearing counsel',
            'Reading the papers (unopposed)',
            'By agreement between the parties',
          ],
        },
        {
          key: 'terms',
          label: 'Terms of the order, one per line',
          type: 'longtext',
          required: true,
        },
      ],
    },
  ],
  build(values, ctx) {
    const recital: Record<string, string> = {
      'Hearing counsel':
        'HAVING read the documents filed of record and having heard counsel for the parties,',
      'Reading the papers (unopposed)': 'HAVING read the documents filed of record,',
      'By agreement between the parties':
        'BY AGREEMENT between the parties, and having read the documents filed of record,',
    };
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `BEFORE THE HONOURABLE ${or(v(values, 'judge'), '____________________').toUpperCase()}`,
      },
      {
        kind: 'text',
        text: `ON ${v(values, 'orderDate') ? longDate(v(values, 'orderDate')).toUpperCase() : '____ __________________ 20____'}`,
      },
      { kind: 'text', text: recital[v(values, 'heard')] ?? recital['Hearing counsel']! },
      { kind: 'text', text: 'IT IS ORDERED THAT:' },
      ...numbered(lines(values, 'terms')),
      { kind: 'signature', lines: ['BY ORDER OF THE COURT', 'REGISTRAR'] },
    ];
    return { title: 'Draft order', heading: courtHeading(values, ctx, roles(values)), blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const costs = lines(values, 'terms').filter((line) => /\bcosts\b/i.test(line));
    if (
      costs.length &&
      !costs.some((line) => /scale\s*[ABC]\b|attorney and client|own costs|no order/i.test(line))
    ) {
      issues.push({
        severity: 'should',
        field: 'terms',
        message:
          'State the scale for counsel’s fees in the costs order (scale A, B or C), or that costs are on the attorney and client scale.',
        basis: 'Uniform Rule 67A(3)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Each paragraph must be clear and capable of enforcement on its own words: name the parties, amounts, dates and property precisely.',
    });
    return issues;
  },
};

// ------------------------------------------------------------ index and pagination

interface IndexEntry {
  title: string;
  date: string;
  pages: number;
}

export function indexEntries(values: Values): IndexEntry[] {
  return lines(values, 'documents').map((line) => {
    const [title = '', date = '', pages = '1'] = line.split('|').map((part) => part.trim());
    return { title, date, pages: Math.max(1, Math.floor(Number(pages)) || 1) };
  });
}

export const indexAndPagination: DraftTemplate = {
  id: 'index-and-pagination',
  version: VERSION,
  name: 'Index to the papers',
  category: 'high_court',
  purpose:
    'Indexes the court file in order, with each document’s date and its page range in the paginated bundle.',
  basis: [
    'Gauteng directive on indexing and pagination of bundles (2025)',
    'Gauteng Consolidated Practice Directive 1 of 2024 para 7 (CaseLines)',
    'Uniform Rule 62',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { firstPage: '1' },
  sections: [
    partiesSection({ withRole: false }),
    {
      key: 'bundle',
      title: 'The bundle',
      fields: [
        {
          key: 'bundleName',
          label: 'Bundle',
          type: 'text',
          help: 'e.g. Pleadings bundle, Volume 1',
        },
        { key: 'firstPage', label: 'First page number', type: 'number', required: true },
        {
          key: 'documents',
          label: 'Documents in order, one per line: title | date | number of pages',
          type: 'longtext',
          required: true,
          help: 'e.g. Notice of motion | 2026-03-01 | 3',
        },
      ],
    },
  ],
  build(values, ctx) {
    let page = Math.max(1, Math.floor(Number(v(values, 'firstPage'))) || 1);
    const rows = indexEntries(values).map((entry, index) => {
      const from = page;
      page += entry.pages;
      const range = entry.pages > 1 ? `${from}–${page - 1}` : `${from}`;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? longDate(entry.date) : entry.date;
      return {
        kind: 'text' as const,
        text: `${index + 1}. ${entry.title || '[document]'}${date ? ` (${date})` : ''} ........ pages ${range}`,
      };
    });
    const blocks: Block[] = [
      ...(v(values, 'bundleName')
        ? [{ kind: 'centred' as const, text: v(values, 'bundleName'), bold: true }]
        : []),
      {
        kind: 'text' as const,
        text: 'Index to the papers in this matter. Page numbers refer to the paginated bundle.',
      },
      ...(rows.length
        ? rows
        : [{ kind: 'text' as const, text: '1. [document] ........ pages [from–to]' }]),
    ];
    return { title: 'Index', heading: courtHeading(values, ctx, roles(values)), blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (indexEntries(values).some((entry) => !entry.title)) {
      issues.push({
        severity: 'must',
        field: 'documents',
        message: 'Each line needs a document title.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Number the pages of the bundle itself to match this index, in the order the documents were filed, and follow the division’s directive (CaseLines sections, volumes, page limits).',
      basis: 'Gauteng indexing and pagination directive (2025); CPD 1 of 2024 para 7',
    });
    return issues;
  },
};

// ------------------------------------------------------------ notice of set down

export const noticeOfSetDown: DraftTemplate = {
  id: 'notice-of-set-down',
  version: VERSION,
  name: 'Notice of set down',
  category: 'high_court',
  purpose: 'Gives notice of the date and roll on which the matter is enrolled for hearing.',
  basis: [
    'Uniform Rule 6(5)(f) (applications)',
    'Uniform Rule 39 (trials)',
    'Divisional practice directives',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { time: '10:00' },
  sections: [
    partiesSection(),
    {
      key: 'setDown',
      title: 'Hearing',
      fields: [
        {
          key: 'roll',
          label: 'Roll',
          type: 'choice',
          required: true,
          choices: [
            'unopposed motion roll',
            'opposed motion roll',
            'trial roll',
            'urgent court roll',
            'default judgment roll',
          ],
        },
        { key: 'hearingDate', label: 'Date', type: 'date', required: true },
        { key: 'time', label: 'Time', type: 'text', required: true },
        otherAttorneys,
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const { ours, theirs } = sides(values);
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the above matter has been set down for hearing on the ${or(v(values, 'roll'), 'roll')} on ${longDate(v(values, 'hearingDate')) || '[date]'} at ${or(v(values, 'time'), '10:00')} or so soon thereafter as the matter may be heard.`,
      },
      ...served(values, ours, theirs),
    ];
    return {
      title: 'Notice of set down',
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks(values) {
    return [
      ...courtDayIssue(values, 'hearingDate', 'Uniform Rules 6(5)(f), 39'),
      {
        severity: 'note',
        message:
          'Obtain the date from the registrar first, serve the notice on every party (including one in default where the rules require), and file it within the division’s cut-off for the roll.',
        basis: 'Uniform Rules 6(5)(f), 39; divisional practice directives',
      },
    ];
  },
};

// ------------------------------------------------------------ application for leave to appeal

export const leaveToAppeal: DraftTemplate = {
  id: 'leave-to-appeal',
  version: VERSION,
  name: 'Application for leave to appeal',
  category: 'high_court',
  purpose:
    'Asks the court that gave the judgment for leave to appeal, stating the grounds clearly and succinctly.',
  basis: [
    'Superior Courts Act 10 of 2013 s 17(1) (reasonable prospect of success, or another compelling reason)',
    'Uniform Rule 49(1) (within 15 days of the order or reasons)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  sections: [
    partiesSection(),
    {
      key: 'appeal',
      title: 'The appeal',
      fields: [
        { key: 'judge', label: 'Judge who gave the judgment', type: 'text', required: true },
        {
          key: 'judgmentDate',
          label: 'Date of the order (or of the reasons, if given later)',
          type: 'date',
          required: true,
        },
        {
          key: 'against',
          label: 'The order or part appealed against',
          type: 'longtext',
          required: true,
        },
        {
          key: 'grounds',
          label: 'Grounds of appeal, one per line',
          type: 'longtext',
          required: true,
          help: 'Each a clear error of fact or law, e.g. "The court erred in finding that …"',
        },
        {
          key: 'to',
          label: 'Leave sought to appeal to',
          type: 'choice',
          required: true,
          choices: ['the Supreme Court of Appeal', 'the Full Court of this Division'],
        },
        { key: 'compelling', label: 'Other compelling reason (if relied on)', type: 'longtext' },
        otherAttorneys,
      ],
    },
    { key: 'attorneys', title: 'Our details', fields: attorneysFields('party') },
  ],
  build(values, ctx) {
    const { ours, theirs } = sides(values);
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the ${ours} applies for leave to appeal to ${or(v(values, 'to'), 'the Supreme Court of Appeal')} against ${or(v(values, 'against'), 'the order')}, handed down by the Honourable ${or(v(values, 'judge'), 'Judge')} on ${longDate(v(values, 'judgmentDate')) || '[date]'}.`,
      },
      {
        kind: 'text',
        text: 'TAKE NOTICE FURTHER that the grounds of the application are the following:',
      },
      ...paras(values, 'grounds'),
      {
        kind: 'para',
        text: `The ${ours} submits that the appeal would have a reasonable prospect of success${v(values, 'compelling') ? `, and that there is a further compelling reason why it should be heard, namely: ${v(values, 'compelling')}` : ''}.`,
      },
      ...served(values, ours, theirs),
    ];
    return {
      title: 'Application for leave to appeal',
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [
      ...lateIssue(
        values,
        ctx,
        'judgmentDate',
        15,
        'application for leave to appeal',
        'Uniform Rule 49(1)(b)',
        'must',
      ),
    ];
    if (lines(values, 'grounds').some((line) => line.length < 25)) {
      issues.push({
        severity: 'should',
        field: 'grounds',
        message:
          'State each ground fully: which finding was wrong, and why. Bare grounds may be disregarded.',
        basis: 'Uniform Rule 49(1)(b)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Leave is granted only if the appeal would (not might) have a reasonable prospect of success, or there is another compelling reason. If refused, a petition to the SCA must be lodged within one month.',
      basis: 'Superior Courts Act 10 of 2013 ss 17(1)(a), 17(2)(b)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ settlement agreement made an order of court

export const settlementAgreementOrder: DraftTemplate = {
  id: 'settlement-agreement-order',
  version: VERSION,
  name: 'Settlement agreement (to be made an order of court)',
  category: 'high_court',
  purpose:
    'Records the settlement of the dispute and the parties’ agreement that it be made an order of court.',
  basis: [
    'Common law of compromise (transactio)',
    'Eke v Parsons 2016 (3) SA 37 (CC) (when a settlement may be made an order of court)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { costs: 'Each party pays its own costs' },
  sections: [
    partiesSection({ withRole: false }),
    {
      key: 'terms',
      title: 'The settlement',
      fields: [
        { key: 'dispute', label: 'The dispute settled', type: 'longtext', required: true },
        { key: 'terms', label: 'Terms, one per line', type: 'longtext', required: true },
        { key: 'costs', label: 'Costs', type: 'text', required: true },
        {
          key: 'breach',
          label: 'If a party fails to perform',
          type: 'longtext',
          help: 'e.g. the other party may enforce this order as it stands.',
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
  ],
  build(values, ctx) {
    const [first, second] = roles(values).map((role) => role.toLowerCase()) as [string, string];
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `between ${or(v(values, 'firstParty'), 'first party')} ("the ${first}") and ${or(v(values, 'secondParty'), 'second party')} ("the ${second}").`,
      },
      { kind: 'heading', text: 'Background' },
      {
        kind: 'para',
        text: `The parties are engaged in this litigation about ${or(v(values, 'dispute'), 'the dispute')} They have agreed to settle it on the terms below.`,
      },
      { kind: 'heading', text: 'Terms of settlement' },
      ...paras(values, 'terms'),
      { kind: 'para', text: `Costs: ${or(v(values, 'costs'), 'costs')}.` },
      ...(v(values, 'breach') ? [{ kind: 'para' as const, text: v(values, 'breach') }] : []),
      {
        kind: 'para',
        text: 'This agreement is in full and final settlement of all claims between the parties arising from the matters in dispute in this litigation.',
      },
      {
        kind: 'para',
        text: 'The parties agree that this agreement be made an order of court, and either party may apply for that without notice to the other.',
      },
      {
        kind: 'text',
        text: `SIGNED at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____.`,
      },
      { kind: 'signature', lines: [`For the ${first}`] },
      { kind: 'signature', lines: [`For the ${second}`] },
    ];
    return {
      title: 'Settlement agreement',
      heading: courtHeading(values, ctx, roles(values)),
      blocks,
    };
  },
  checks() {
    return [
      {
        severity: 'note',
        message:
          'The court makes a settlement an order only if it relates to the issues in the case, is competent and not objectionable (no illegality, nothing against public policy), and is a sensible order to enforce. Terms must be clear enough to be enforced as an order.',
        basis: 'Eke v Parsons 2016 (3) SA 37 (CC)',
      },
    ];
  },
};
