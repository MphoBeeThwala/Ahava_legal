// Court documents: the affidavit and the notice of motion. Standard wording:
// to be reviewed by an admitted attorney (review status "unreviewed").
import type { DraftIssue } from '@ahava88/shared';
import { isBusinessDay, longDate } from '../days';
import type { Block, CourtHeading } from '../model';
import {
  COURT_FORMAT,
  APPROVED,
  lines,
  or,
  v,
  type DraftContext,
  type DraftTemplate,
} from '../template';

export function courtHeading(
  values: Record<string, string>,
  ctx: DraftContext,
  roles: [string, string],
): CourtHeading | undefined {
  const court = v(values, 'court');
  if (!court) return undefined;
  const [first, ...rest] = court.split(',').map((part) => part.trim());
  return {
    court: [`In the ${first}`, ...(rest.length ? [`(${rest.join(', ')})`] : [])],
    caseNumber: v(values, 'caseNumber') || ctx.caseNumber,
    parties: [
      { name: or(v(values, 'firstParty'), roles[0]), role: roles[0] },
      ...(v(values, 'secondParty') ? [{ name: v(values, 'secondParty'), role: roles[1] }] : []),
    ],
  };
}

export const courtFields = [
  {
    key: 'court',
    label: 'Court',
    type: 'text' as const,
    help: 'e.g. High Court of South Africa, Gauteng Division, Pretoria',
  },
  {
    key: 'caseNumber',
    label: 'Case number',
    type: 'text' as const,
    prefill: 'matter.caseNumber' as const,
  },
];

// ------------------------------------------------------------ affidavit

export const affidavit: DraftTemplate = {
  id: 'affidavit',
  version: '2026.11-1',
  name: 'Affidavit',
  category: 'affidavits',
  purpose:
    'A sworn or affirmed statement of facts within the deponent’s knowledge, with the commissioner of oaths’ certificate.',
  basis: [
    'Justices of the Peace and Commissioners of Oaths Act 16 of 1963',
    'Regulations Governing the Administering of an Oath or Affirmation, GN R1258 of 21 July 1972 (regs 1–4, 7)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath', firstPartyRole: 'Applicant', secondPartyRole: 'Respondent' },
  sections: [
    {
      key: 'court',
      title: 'Court (leave empty for an affidavit not filed in court)',
      fields: [
        ...courtFields,
        { key: 'firstParty', label: 'Applicant / plaintiff', type: 'text', prefill: 'client.name' },
        { key: 'secondParty', label: 'Respondent / defendant', type: 'text' },
      ],
    },
    {
      key: 'deponent',
      title: 'Deponent',
      fields: [
        { key: 'deponentName', label: 'Full names', type: 'text', required: true },
        { key: 'deponentId', label: 'ID or passport number', type: 'id_number' },
        {
          key: 'deponentDescription',
          label: 'Who the deponent is',
          type: 'longtext',
          required: true,
          help: 'e.g. an adult female businesswoman residing at …, the applicant in this matter',
        },
        {
          key: 'oath',
          label: 'Oath or affirmation',
          type: 'choice',
          required: true,
          choices: ['Oath', 'Affirmation'],
        },
      ],
    },
    {
      key: 'facts',
      title: 'Facts',
      fields: [
        {
          key: 'facts',
          label: 'Facts, one paragraph per line',
          type: 'longtext',
          required: true,
          help: 'Each line becomes a numbered paragraph. Only facts within the deponent’s knowledge, or say where they come from.',
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
  ],
  build(values, ctx) {
    const affirm = v(values, 'oath') === 'Affirmation';
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, the undersigned, ${or(v(values, 'deponentName'), 'full names')}${v(values, 'deponentId') ? ` (identity number ${v(values, 'deponentId')})` : ''}, do hereby ${affirm ? 'solemnly affirm' : 'make oath'} and state that:`,
      },
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}.`,
      },
      {
        kind: 'para',
        text: 'The facts in this affidavit are within my personal knowledge, unless the context indicates otherwise, and are to the best of my knowledge and belief both true and correct.',
      },
      ...lines(values, 'facts').map((text) => ({ kind: 'para' as const, text })),
      { kind: 'signature', lines: ['DEPONENT'] },
      {
        kind: 'text',
        text: `I certify that the deponent has acknowledged that the deponent knows and understands the contents of this affidavit, which was signed and ${affirm ? 'affirmed' : 'sworn to'} before me at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____, the regulations contained in Government Notice No. R1258 of 21 July 1972, as amended, having been complied with.`,
      },
      {
        kind: 'signature',
        lines: [
          'COMMISSIONER OF OATHS',
          'Full names:',
          'Designation and area:',
          'Business address:',
        ],
      },
    ];
    return {
      title: affirm ? 'Affidavit (affirmation)' : 'Affidavit',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (lines(values, 'facts').length === 1 && v(values, 'facts').length > 600) {
      issues.push({
        severity: 'should',
        field: 'facts',
        message: 'Split the facts into short numbered paragraphs, one point each.',
        basis: 'Uniform Rule 18(3); practice',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The deponent must sign in the commissioner’s presence, and a commissioner may not administer the oath in a matter in which they have an interest (e.g. an attorney at the firm acting in the matter).',
      basis: 'GN R1258 of 1972 regs 3(1), 7(1)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ notice of motion

export const noticeOfMotion: DraftTemplate = {
  id: 'notice-of-motion',
  version: '2026.11-1',
  name: 'Notice of motion (Form 2(a))',
  category: 'high_court',
  purpose:
    'Starts an application on notice to the respondent: the order sought, the supporting affidavit, the address for service, and how and when to oppose.',
  basis: [
    'Uniform Rules of Court rule 6(5); Form 2(a) of the First Schedule',
    'Uniform Rule 62 (form of documents)',
    'Divisional practice directives (e.g. Gauteng Consolidated Practice Directive 1 of 2024)',
  ],
  review: APPROVED,
  format: COURT_FORMAT,
  defaults: { opposeDays: '5', answerDays: '15' },
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
        {
          key: 'respondentAddress',
          label: 'Respondent’s address for service',
          type: 'longtext',
          required: true,
        },
      ],
    },
    {
      key: 'relief',
      title: 'Relief',
      fields: [
        {
          key: 'relief',
          label: 'Order sought, one prayer per line',
          type: 'longtext',
          required: true,
          help: 'Each line becomes a numbered prayer. End with costs, and further or alternative relief.',
        },
        {
          key: 'deponent',
          label: 'Deponent to the founding affidavit',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      key: 'times',
      title: 'Time periods and hearing',
      fields: [
        {
          key: 'opposeDays',
          label: 'Days to give notice of intention to oppose',
          type: 'number',
          required: true,
        },
        {
          key: 'answerDays',
          label: 'Days to file answering affidavits',
          type: 'number',
          required: true,
        },
        { key: 'hearingDate', label: 'Hearing date if unopposed', type: 'date' },
      ],
    },
    {
      key: 'attorneys',
      title: 'Applicant’s attorneys',
      fields: [
        { key: 'firmName', label: 'Firm', type: 'text', required: true, prefill: 'firm.legalName' },
        {
          key: 'firmAddress',
          label: 'Address for service',
          type: 'longtext',
          required: true,
          prefill: 'firm.address',
        },
        {
          key: 'firmEmail',
          label: 'Email for service',
          type: 'text',
          required: true,
          prefill: 'firm.email',
        },
        { key: 'firmPhone', label: 'Telephone', type: 'text', prefill: 'firm.phone' },
        { key: 'attorneyRef', label: 'Reference', type: 'text', prefill: 'matter.caseNumber' },
        { key: 'place', label: 'Place (dated at)', type: 'text', required: true },
      ],
    },
  ],
  build(values, ctx) {
    const applicant = or(v(values, 'firstParty'), 'Applicant');
    const hearing = v(values, 'hearingDate');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `TAKE NOTICE that ${applicant} (hereinafter called the applicant) intends to make application to this court for an order in the following terms:`,
      },
      ...lines(values, 'relief').map((text) => ({ kind: 'para' as const, text })),
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the affidavit of ${or(v(values, 'deponent'), 'deponent')} annexed hereto will be used in support of this application.`,
      },
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the applicant has appointed the address of its attorneys set out below as the address at which it will accept notice and service of all process in these proceedings, and that it will also accept service by email at ${or(v(values, 'firmEmail'), 'email')}.`,
      },
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that if you intend opposing this application you are required (a) to notify the applicant's attorneys in writing within ${or(v(values, 'opposeDays'), '5')} days after service of this notice of motion on you, and (b) within ${or(v(values, 'answerDays'), '15')} days after you have so given notice of your intention to oppose the application, to file your answering affidavits, if any; and further that you are required to appoint in such notification an address referred to in rule 6(5)(b) at which you will accept notice and service of all documents in these proceedings, and an email address.`,
      },
      {
        kind: 'text',
        text: `If no such notice of intention to oppose is given, the application will be made on ${hearing ? longDate(hearing) : '[date]'} at 10h00 or as soon thereafter as counsel may be heard.`,
      },
      {
        kind: 'text',
        text: `DATED at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____.`,
      },
      {
        kind: 'signature',
        lines: [
          'ATTORNEYS FOR THE APPLICANT',
          or(v(values, 'firmName'), 'Firm'),
          ...v(values, 'firmAddress').split('\n').filter(Boolean),
          [
            v(values, 'firmPhone') && `Tel: ${v(values, 'firmPhone')}`,
            v(values, 'firmEmail') && `Email: ${v(values, 'firmEmail')}`,
          ]
            .filter(Boolean)
            .join(' | '),
          ...(v(values, 'attorneyRef') ? [`Ref: ${v(values, 'attorneyRef')}`] : []),
        ],
      },
      {
        kind: 'text',
        text: `TO: THE REGISTRAR OF THE ${(v(values, 'court').split(',')[0] ?? 'HIGH COURT').toUpperCase()}`,
      },
      {
        kind: 'text',
        text: `AND TO: ${or(v(values, 'secondParty'), 'Respondent')}${v(values, 'respondentAddress') ? `, ${v(values, 'respondentAddress').split('\n').join(', ')}` : ''}`,
      },
    ];
    return {
      title: 'Notice of motion',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const oppose = Number(v(values, 'opposeDays'));
    if (Number.isFinite(oppose) && oppose > 0 && oppose < 5) {
      issues.push({
        severity: 'must',
        field: 'opposeDays',
        message:
          'The time to give notice of intention to oppose may not be less than five days after service.',
        basis: 'Uniform Rule 6(5)(b)(iii)',
      });
    }
    const answer = Number(v(values, 'answerDays'));
    if (Number.isFinite(answer) && answer > 0 && answer < 15) {
      issues.push({
        severity: 'should',
        field: 'answerDays',
        message:
          'The rule gives the respondent 15 days after the notice to oppose to file answering affidavits.',
        basis: 'Uniform Rule 6(5)(d)(ii)',
      });
    }
    const hearing = v(values, 'hearingDate');
    if (hearing && !isBusinessDay(hearing)) {
      issues.push({
        severity: 'must',
        field: 'hearingDate',
        message: `${longDate(hearing)} is a weekend or public holiday: choose a court day.`,
        basis: 'Uniform Rule 6(5)(f); court calendar',
      });
    }
    const relief = lines(values, 'relief');
    if (relief.length && !relief.some((line) => /costs/i.test(line))) {
      issues.push({
        severity: 'should',
        field: 'relief',
        message: 'Add a prayer for costs (and for further or alternative relief).',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Check the division’s practice directive for set-down, practice notes, heads of argument and CaseLines indexing before filing.',
      basis:
        'e.g. Gauteng Consolidated Practice Directive 1 of 2024; indexing and pagination directive (2025)',
    });
    return issues;
  },
};
