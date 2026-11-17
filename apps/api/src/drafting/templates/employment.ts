// Labour: the condonation application, the Labour Court statement of claim,
// the disciplinary notice and outcome, and the section 189(3) notice.
// Standard wording: to be reviewed by an admitted attorney.
import type { DraftIssue } from '@ahava88/shared';
import { addBusinessDays, addCalendarDays, longDate, parseDate } from '../days';
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
import {
  attorneysBlock,
  attorneysFields,
  commissioner,
  commissionerNote,
  oathField,
  opening,
  paras,
} from './litigation';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const daysBetween = (from: string, to: string): number | null => {
  const a = parseDate(from);
  const b = parseDate(to);
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) : null;
};

// ------------------------------------------------------------ condonation application

export const condonationApplication: DraftTemplate = {
  id: 'condonation-application',
  version: VERSION,
  name: 'Condonation application (affidavit)',
  category: 'labour',
  purpose:
    'Explains, on affidavit, a late referral or filing: how late it is, why, the prospects of success and any prejudice, and asks for condonation.',
  basis: [
    'CCMA Rules (rule 9: condonation) and Labour Court Rules (2024)',
    'Melane v Santam Insurance Co Ltd 1962 (4) SA 531 (A) (degree of lateness, explanation, prospects, importance, prejudice)',
    'GN R1258 of 1972',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath', forum: 'CCMA' },
  sections: [
    {
      key: 'matter',
      title: 'Forum and parties',
      fields: [
        {
          key: 'court',
          label: 'Forum',
          type: 'text',
          required: true,
          help: 'e.g. Commission for Conciliation, Mediation and Arbitration, Gauteng, or Labour Court of South Africa, Johannesburg',
        },
        { key: 'caseNumber', label: 'Case number', type: 'text', prefill: 'matter.caseNumber' },
        {
          key: 'firstParty',
          label: 'Applicant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'secondParty', label: 'Respondent', type: 'text', required: true },
      ],
    },
    {
      key: 'deponent',
      title: 'Deponent',
      fields: [
        {
          key: 'deponentName',
          label: 'Full names',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'deponentId', label: 'ID number', type: 'id_number' },
        {
          key: 'deponentDescription',
          label: 'Who the deponent is',
          type: 'longtext',
          required: true,
        },
        oathField,
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
    {
      key: 'lateness',
      title: 'The lateness',
      fields: [
        {
          key: 'what',
          label: 'What was filed late',
          type: 'text',
          required: true,
          help: 'e.g. the referral of an unfair dismissal dispute',
        },
        { key: 'dueDate', label: 'When it was due', type: 'date', required: true },
        {
          key: 'filedDate',
          label: 'When it was (or will be) filed',
          type: 'date',
          prefill: 'today',
        },
        {
          key: 'reasons',
          label: 'The reasons, covering the whole period, one per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'prospects',
          label: 'Prospects of success, one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'prejudice', label: 'Prejudice and importance of the case', type: 'longtext' },
      ],
    },
  ],
  build(values, ctx) {
    const late = daysBetween(v(values, 'dueDate'), v(values, 'filedDate') || ctx.today);
    const blocks: Block[] = [
      opening(values),
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}. The facts in this affidavit are within my personal knowledge and are true and correct.`,
      },
      {
        kind: 'para',
        text: `I ask that the late filing of ${or(v(values, 'what'), 'the document')} be condoned.`,
      },
      { kind: 'heading', text: 'Degree of lateness' },
      {
        kind: 'para',
        text: `It was due by ${longDate(v(values, 'dueDate')) || '[date]'} and was filed on ${longDate(v(values, 'filedDate') || ctx.today)}${late !== null && late > 0 ? `, ${late} day${late === 1 ? '' : 's'} late` : ''}.`,
      },
      { kind: 'heading', text: 'Explanation for the delay' },
      ...paras(values, 'reasons'),
      { kind: 'heading', text: 'Prospects of success' },
      ...paras(values, 'prospects'),
      { kind: 'heading', text: 'Prejudice' },
      {
        kind: 'para',
        text:
          v(values, 'prejudice') ||
          `The respondent will suffer no prejudice that cannot be remedied if condonation is granted, whereas I will be left without a remedy if it is refused.`,
      },
      {
        kind: 'para',
        text: 'WHEREFORE I ask that the late filing be condoned, and that the matter proceed.',
      },
      ...commissioner(values),
    ];
    return {
      title: 'Affidavit in support of condonation',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const late = daysBetween(v(values, 'dueDate'), v(values, 'filedDate') || ctx.today);
    if (late !== null && late <= 0) {
      issues.push({
        severity: 'should',
        field: 'dueDate',
        message: 'On these dates the filing is not late, so condonation is not needed.',
      });
    }
    if (lines(values, 'reasons').length < 2) {
      issues.push({
        severity: 'should',
        field: 'reasons',
        message:
          'Explain the whole period of the delay, step by step; a gap in the explanation weighs against condonation, and the longer the delay the fuller it must be.',
        basis: 'Melane v Santam 1962 (4) SA 531 (A)',
      });
    }
    issues.push(commissionerNote);
    return issues;
  },
};

// ------------------------------------------------------------ Labour Court statement of claim

export const labourCourtStatementOfClaim: DraftTemplate = {
  id: 'labour-court-statement-of-claim',
  version: VERSION,
  name: 'Statement of claim (Labour Court)',
  category: 'labour',
  purpose:
    'Refers a dispute to the Labour Court for adjudication: the parties, the facts, the legal issues and the relief.',
  basis: [
    'Labour Court Rules (2024): referral by statement of claim',
    'Labour Relations Act 66 of 1995 s 191(5)(b) and (11) (within 90 days of the certificate)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { responseDays: '10' },
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
          help: 'e.g. Labour Court of South Africa, Johannesburg',
        },
        { key: 'caseNumber', label: 'Case number', type: 'text', prefill: 'matter.caseNumber' },
        {
          key: 'firstParty',
          label: 'Applicant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'applicantDescription', label: 'The applicant', type: 'longtext', required: true },
        { key: 'secondParty', label: 'Respondent', type: 'text', required: true },
        { key: 'respondentDescription', label: 'The respondent', type: 'longtext', required: true },
      ],
    },
    {
      key: 'claim',
      title: 'The claim',
      fields: [
        { key: 'certificateDate', label: 'Date of the certificate of outcome', type: 'date' },
        {
          key: 'jurisdiction',
          label: 'Why the Labour Court has jurisdiction',
          type: 'longtext',
          required: true,
          help: 'e.g. an automatically unfair dismissal (s 187) referred under s 191(5)(b)(i).',
        },
        { key: 'facts', label: 'Facts, one paragraph per line', type: 'longtext', required: true },
        { key: 'issues', label: 'Legal issues, one per line', type: 'longtext', required: true },
        { key: 'relief', label: 'Relief sought, one per line', type: 'longtext', required: true },
        {
          key: 'responseDays',
          label: 'Days for the response',
          type: 'number',
          required: true,
          help: 'As the Labour Court Rules allow.',
        },
      ],
    },
    { key: 'attorneys', title: 'Applicant’s attorneys', fields: attorneysFields('applicant') },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the applicant refers the dispute set out below to the Labour Court. If the respondent intends to oppose, it must deliver a response within ${or(v(values, 'responseDays'), '10')} days after service of this statement, failing which the matter may be heard in its absence.`,
      },
      { kind: 'heading', text: 'The parties' },
      {
        kind: 'para',
        text: `The applicant is ${or(v(values, 'applicantDescription'), 'description of the applicant')}.`,
      },
      {
        kind: 'para',
        text: `The respondent is ${or(v(values, 'respondentDescription'), 'description of the respondent')}.`,
      },
      { kind: 'heading', text: 'Jurisdiction' },
      { kind: 'para', text: or(v(values, 'jurisdiction'), 'jurisdiction') },
      ...(v(values, 'certificateDate')
        ? [
            {
              kind: 'para' as const,
              text: `The dispute was conciliated without success, and a certificate of outcome was issued on ${longDate(v(values, 'certificateDate'))}.`,
            },
          ]
        : []),
      { kind: 'heading', text: 'The facts' },
      ...paras(values, 'facts'),
      { kind: 'heading', text: 'Legal issues' },
      ...paras(values, 'issues'),
      { kind: 'heading', text: 'Relief sought' },
      { kind: 'text', text: 'WHEREFORE the applicant claims:' },
      ...lines(values, 'relief').map((text, index) => ({
        kind: 'text' as const,
        text: `${String.fromCharCode(97 + index)}) ${text}`,
      })),
      ...attorneysBlock(values, 'applicant'),
      { kind: 'text', text: 'TO: THE REGISTRAR OF THE LABOUR COURT' },
      { kind: 'text', text: `AND TO: ${or(v(values, 'secondParty'), 'the respondent')}` },
    ];
    return {
      title: 'Statement of claim',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const cert = v(values, 'certificateDate');
    const last = cert ? addCalendarDays(cert, 90) : null;
    if (last && ctx.today > last) {
      issues.push({
        severity: 'must',
        field: 'certificateDate',
        message: `The referral is more than 90 days after the certificate (due by ${longDate(last)}): file a condonation application with it.`,
        basis: 'LRA s 191(11)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Check the statement against the current Labour Court Rules (2024) and Form, and serve it on every party with an interest.',
      basis: 'Labour Court Rules (2024)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ disciplinary notice and outcome

const SANCTIONS = ['No sanction', 'Written warning', 'Final written warning', 'Dismissal'];

export const disciplinaryNotice: DraftTemplate = {
  id: 'disciplinary-notice',
  version: VERSION,
  name: 'Notice of disciplinary hearing and outcome',
  category: 'labour',
  purpose:
    'Tells the employee of the allegations, the hearing and their rights; and, after the hearing, records the finding, the sanction and the right to refer a dispute.',
  basis: [
    'Labour Relations Act 66 of 1995 s 188 (fair reason and fair procedure)',
    'Code of Good Practice: Dismissal (2023, replacing Schedule 8 to the LRA)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  defaults: { stage: 'Notice of hearing' },
  sections: [
    {
      key: 'parties',
      title: 'Employer and employee',
      fields: [
        {
          key: 'employerName',
          label: 'Employer',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'employeeName', label: 'Employee', type: 'text', required: true },
        { key: 'employeeJob', label: 'Employee’s position', type: 'text' },
        {
          key: 'stage',
          label: 'Document',
          type: 'choice',
          required: true,
          choices: ['Notice of hearing', 'Outcome of hearing'],
        },
        { key: 'noticeDate', label: 'Date of this document', type: 'date', prefill: 'today' },
      ],
    },
    {
      key: 'hearing',
      title: 'Allegations and hearing',
      fields: [
        {
          key: 'allegations',
          label: 'Allegations, one per line',
          type: 'longtext',
          required: true,
          help: 'What the employee is alleged to have done, when and where, and the rule breached.',
        },
        { key: 'hearingDate', label: 'Hearing date', type: 'date', required: true },
        { key: 'hearingTime', label: 'Time', type: 'text', required: true },
        { key: 'venue', label: 'Venue', type: 'text', required: true },
        { key: 'chair', label: 'Chairperson', type: 'text' },
        {
          key: 'suspended',
          label: 'Is the employee suspended on full pay pending the hearing?',
          type: 'choice',
          choices: ['No', 'Yes'],
        },
      ],
    },
    {
      key: 'outcome',
      title: 'Outcome (after the hearing)',
      fields: [
        { key: 'findings', label: 'Findings on each allegation, one per line', type: 'longtext' },
        { key: 'reasons', label: 'Reasons for the sanction', type: 'longtext' },
        { key: 'sanction', label: 'Sanction', type: 'choice', choices: SANCTIONS },
        {
          key: 'appeal',
          label: 'Internal appeal (if the code allows)',
          type: 'text',
          help: 'e.g. in writing to the HR manager within 5 working days',
        },
      ],
    },
  ],
  build(values, ctx) {
    const date = longDate(v(values, 'noticeDate') || ctx.today);
    const employee = or(v(values, 'employeeName'), 'Employee');
    const head: Block[] = [
      {
        kind: 'text',
        text: `To: ${employee}${v(values, 'employeeJob') ? `, ${v(values, 'employeeJob')}` : ''}`,
      },
      { kind: 'text', text: `From: ${or(v(values, 'employerName'), 'Employer')}` },
      { kind: 'text', text: `Date: ${date}` },
    ];
    if (v(values, 'stage') === 'Outcome of hearing') {
      const sanction = v(values, 'sanction') || '[sanction]';
      const blocks: Block[] = [
        ...head,
        {
          kind: 'para',
          text: `The disciplinary hearing on ${longDate(v(values, 'hearingDate')) || '[date]'} considered the following allegations: ${lines(values, 'allegations').join('; ') || '[allegations]'}.`,
        },
        { kind: 'heading', text: 'Findings' },
        ...paras(values, 'findings'),
        { kind: 'heading', text: 'Sanction' },
        {
          kind: 'para',
          text: `The sanction is: ${sanction.toLowerCase()}. ${v(values, 'reasons')}`,
        },
        ...(sanction === 'Dismissal'
          ? [
              {
                kind: 'para' as const,
                text: 'Your employment ends on the date of this notice. You will be paid what is due to you, including notice pay (unless the misconduct justifies summary dismissal), accrued leave and any other amounts owing, and you will receive a certificate of service.',
              },
              {
                kind: 'para' as const,
                text: 'If you dispute the fairness of your dismissal, you may refer a dispute to the CCMA or the bargaining council with jurisdiction within 30 days of this notice.',
              },
            ]
          : []),
        ...(v(values, 'appeal')
          ? [{ kind: 'para' as const, text: `You may appeal internally: ${v(values, 'appeal')}.` }]
          : []),
        {
          kind: 'signature',
          lines: [`For the employer: ${or(v(values, 'employerName'), 'Employer')}`],
        },
        {
          kind: 'signature',
          lines: [`Received by the employee: ${employee} (signature acknowledges receipt only)`],
        },
      ];
      return { title: 'Outcome of disciplinary hearing', blocks };
    }
    const blocks: Block[] = [
      ...head,
      {
        kind: 'para',
        text: 'You are required to attend a disciplinary hearing to answer the following allegations:',
      },
      ...lines(values, 'allegations').map((text, index) => ({
        kind: 'text' as const,
        text: `${index + 1}. ${text}`,
      })),
      {
        kind: 'para',
        text: `The hearing will be held on ${longDate(v(values, 'hearingDate')) || '[date]'} at ${or(v(values, 'hearingTime'), 'time')} at ${or(v(values, 'venue'), 'venue')}${v(values, 'chair') ? `, chaired by ${v(values, 'chair')}` : ''}.`,
      },
      {
        kind: 'para',
        text: 'At the hearing you may: be represented by a fellow employee or a shop steward of a recognised union; present evidence and call witnesses; question the employer’s witnesses; and have an interpreter if you need one. You are entitled to copies of the documents the employer will rely on. If you need more time to prepare, ask before the hearing.',
      },
      ...(v(values, 'suspended') === 'Yes'
        ? [
            {
              kind: 'para' as const,
              text: 'You remain suspended on full pay until the hearing. You must remain available and may not come to the workplace or contact witnesses without permission.',
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'If you do not attend without a good reason, the hearing may proceed in your absence. If found guilty, a sanction up to and including dismissal may be imposed.',
      },
      {
        kind: 'signature',
        lines: [`For the employer: ${or(v(values, 'employerName'), 'Employer')}`],
      },
      {
        kind: 'signature',
        lines: [`Received by the employee: ${employee}`, 'Date and time received:'],
      },
    ];
    return { title: 'Notice of disciplinary hearing', blocks };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const notice = v(values, 'noticeDate') || ctx.today;
    const hearing = v(values, 'hearingDate');
    if (v(values, 'stage') !== 'Outcome of hearing' && hearing) {
      const earliest = addBusinessDays(notice, 2);
      if (earliest && hearing < earliest) {
        issues.push({
          severity: 'should',
          field: 'hearingDate',
          message: `Give the employee a reasonable time to prepare: the hearing is less than two working days after the notice (the usual minimum is ${longDate(earliest)} or later).`,
          basis: 'Code of Good Practice: Dismissal (2023)',
        });
      }
    }
    if (v(values, 'stage') === 'Outcome of hearing') {
      if (!v(values, 'sanction'))
        issues.push({ severity: 'must', field: 'sanction', message: 'Record the sanction.' });
      if (!lines(values, 'findings').length)
        issues.push({
          severity: 'must',
          field: 'findings',
          message: 'Record the finding on each allegation.',
        });
    }
    issues.push({
      severity: 'note',
      message:
        'Allegations must be specific enough for the employee to answer, in a language they understand. Dismissal must be a fair sanction for the misconduct, considering the employee’s record and circumstances.',
      basis: 'LRA s 188; Code of Good Practice: Dismissal (2023)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ section 189(3) notice

/** Section 189A applies to an employer with more than 50 employees dismissing at least this many. */
export function largeScaleThreshold(employees: number): number | null {
  if (employees <= 50) return null;
  if (employees <= 200) return 10;
  if (employees <= 300) return 20;
  if (employees <= 400) return 30;
  if (employees <= 500) return 40;
  return 50;
}

export const s189Notice: DraftTemplate = {
  id: 's189-notice',
  version: VERSION,
  name: 'Section 189(3) notice (retrenchment)',
  category: 'labour',
  purpose:
    'Invites the consulting parties to consult on possible dismissals for operational requirements, with every disclosure section 189(3) requires.',
  basis: [
    'Labour Relations Act 66 of 1995 s 189(1)–(3), s 189A (large-scale dismissals)',
    'Basic Conditions of Employment Act 75 of 1997 s 41 (severance: at least one week’s pay per completed year of service)',
    'Code of Good Practice on Dismissal Based on Operational Requirements',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'parties',
      title: 'Employer and consulting parties',
      fields: [
        {
          key: 'employerName',
          label: 'Employer',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'consulting',
          label: 'Consulting parties (union, workplace forum or employees), one per line',
          type: 'longtext',
          required: true,
        },
        { key: 'noticeDate', label: 'Date', type: 'date', prefill: 'today' },
        {
          key: 'firstMeeting',
          label: 'First consultation meeting (date, time, place)',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      key: 'disclosure',
      title: 'Disclosure',
      fields: [
        {
          key: 'reasons',
          label: 'Reasons for the proposed dismissals',
          type: 'longtext',
          required: true,
        },
        {
          key: 'alternatives',
          label: 'Alternatives considered and why they were rejected, one per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'affected',
          label: 'Number of employees likely to be affected',
          type: 'number',
          required: true,
        },
        { key: 'categories', label: 'Job categories affected', type: 'longtext', required: true },
        {
          key: 'selection',
          label: 'Proposed selection method',
          type: 'longtext',
          required: true,
          help: 'e.g. last in, first out within each job category, subject to retaining key skills.',
        },
        {
          key: 'timing',
          label: 'When the dismissals are likely to take effect',
          type: 'text',
          required: true,
        },
        {
          key: 'severanceWeeks',
          label: 'Proposed severance (weeks’ pay per completed year)',
          type: 'number',
          required: true,
        },
        {
          key: 'assistance',
          label: 'Assistance proposed for affected employees',
          type: 'longtext',
        },
        { key: 'reemployment', label: 'Possibility of future re-employment', type: 'text' },
        { key: 'employees', label: 'Total number of employees', type: 'number', required: true },
        {
          key: 'previous',
          label: 'Employees dismissed for operational reasons in the last 12 months',
          type: 'number',
          required: true,
        },
      ],
    },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `To: ${lines(values, 'consulting').join('; ') || '[consulting parties]'}`,
      },
      { kind: 'text', text: `From: ${or(v(values, 'employerName'), 'Employer')}` },
      { kind: 'text', text: `Date: ${longDate(v(values, 'noticeDate') || ctx.today)}` },
      {
        kind: 'para',
        text: 'The employer is contemplating dismissing employees for reasons based on its operational requirements. In terms of section 189 of the Labour Relations Act 66 of 1995, it invites you to consult with it, in a meaningful joint consensus-seeking process, on ways to avoid or minimise the dismissals, change their timing, mitigate their effects, the selection method and severance pay.',
      },
      {
        kind: 'para',
        text: `The first consultation meeting will be held on ${or(v(values, 'firstMeeting'), 'date, time and place')}.`,
      },
      { kind: 'heading', text: 'Information disclosed (section 189(3))' },
      {
        kind: 'para',
        text: `(a) Reasons for the proposed dismissals: ${or(v(values, 'reasons'), 'reasons')}`,
      },
      {
        kind: 'para',
        text: `(b) Alternatives considered, and the reasons for rejecting each: ${lines(values, 'alternatives').join('; ') || '[alternatives]'}.`,
      },
      {
        kind: 'para',
        text: `(c) Number of employees likely to be affected and their job categories: ${or(v(values, 'affected'), 'number')}; ${or(v(values, 'categories'), 'categories')}.`,
      },
      {
        kind: 'para',
        text: `(d) Proposed method for selecting employees: ${or(v(values, 'selection'), 'selection method')}`,
      },
      {
        kind: 'para',
        text: `(e) When the dismissals are likely to take effect: ${or(v(values, 'timing'), 'timing')}.`,
      },
      {
        kind: 'para',
        text: `(f) Proposed severance pay: ${or(v(values, 'severanceWeeks'), 'number')} week(s)’ remuneration for each completed year of continuous service.`,
      },
      {
        kind: 'para',
        text: `(g) Assistance proposed for affected employees: ${v(values, 'assistance') || 'to be discussed in consultation'}.`,
      },
      {
        kind: 'para',
        text: `(h) Possibility of future re-employment: ${v(values, 'reemployment') || 'to be discussed in consultation'}.`,
      },
      {
        kind: 'para',
        text: `(i) Number of employees employed: ${or(v(values, 'employees'), 'number')}.`,
      },
      {
        kind: 'para',
        text: `(j) Employees dismissed for operational reasons in the preceding 12 months: ${or(v(values, 'previous'), 'number')}.`,
      },
      {
        kind: 'para',
        text: 'The employer will consider and respond to any representations you make, in writing if they are made in writing, and will disclose any further relevant information you reasonably need to consult effectively.',
      },
      {
        kind: 'signature',
        lines: [`For the employer: ${or(v(values, 'employerName'), 'Employer')}`],
      },
    ];
    return { title: 'Notice in terms of section 189(3) of the Labour Relations Act', blocks };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const weeks = Number(v(values, 'severanceWeeks'));
    if (v(values, 'severanceWeeks') && Number.isFinite(weeks) && weeks < 1) {
      issues.push({
        severity: 'must',
        field: 'severanceWeeks',
        message:
          'Severance is at least one week’s remuneration for each completed year of continuous service.',
        basis: 'BCEA s 41(2)',
      });
    }
    const employees = Number(v(values, 'employees'));
    const affected = Number(v(values, 'affected'));
    const threshold = Number.isFinite(employees) ? largeScaleThreshold(employees) : null;
    const previous = Number(v(values, 'previous')) || 0;
    if (threshold !== null && Number.isFinite(affected) && affected + previous >= threshold) {
      issues.push({
        severity: 'should',
        field: 'affected',
        message: `This is a large-scale retrenchment (section 189A): the employer has more than 50 employees and contemplates dismissing ${affected}${previous ? ` (with ${previous} in the last 12 months)` : ''}. A facilitator may be requested, and strikes or Labour Court referrals follow special time limits.`,
        basis: 'LRA s 189A(1), (3)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Consult before the decision is taken, with the right parties in the order s 189(1) sets, and keep minutes of every meeting.',
      basis: 'LRA s 189(1), (2)',
    });
    return issues;
  },
};
