// Litigation documents: founding and confirmatory affidavits, the combined
// summons with particulars of claim, the notice of intention to defend and
// the plea. Standard wording: to be reviewed by an admitted attorney (review
// status "unreviewed" until then).
import type { DraftField, DraftIssue } from '@ahava88/shared';
import { addCourtDays, longDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import {
  COURT_FORMAT,
  UNREVIEWED,
  lines,
  or,
  v,
  type DraftContext,
  type DraftTemplate,
} from '../template';
import { courtHeading, courtFields } from './court';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

// ------------------------------------------------------------ shared pieces

function attorneysFields(party: string): DraftField[] {
  return [
    { key: 'firmName', label: 'Firm', type: 'text', required: true, prefill: 'firm.legalName' },
    {
      key: 'firmAddress',
      label: 'Address for service',
      type: 'longtext',
      required: true,
      prefill: 'firm.address',
      help: `The ${party}'s attorneys' address within the distance from the court the rules require.`,
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
  ];
}

function attorneysBlock(values: Values, party: string): Block[] {
  return [
    {
      kind: 'text',
      text: `DATED at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____.`,
    },
    {
      kind: 'signature',
      lines: [
        `ATTORNEYS FOR THE ${party.toUpperCase()}`,
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
  ];
}

const registrar = (values: Values) =>
  `TO: THE REGISTRAR OF THE ${(v(values, 'court').split(',')[0] || 'HIGH COURT').toUpperCase()}`;

const oathField: DraftField = {
  key: 'oath',
  label: 'Oath or affirmation',
  type: 'choice',
  required: true,
  choices: ['Oath', 'Affirmation'],
};

function opening(values: Values): Block {
  const affirm = v(values, 'oath') === 'Affirmation';
  return {
    kind: 'text',
    text: `I, the undersigned, ${or(v(values, 'deponentName'), 'full names')}${v(values, 'deponentId') ? ` (identity number ${v(values, 'deponentId')})` : ''}, do hereby ${affirm ? 'solemnly affirm' : 'make oath'} and state that:`,
  };
}

function commissioner(values: Values): Block[] {
  const affirm = v(values, 'oath') === 'Affirmation';
  return [
    { kind: 'signature', lines: ['DEPONENT'] },
    {
      kind: 'text',
      text: `I certify that the deponent has acknowledged that the deponent knows and understands the contents of this affidavit, which was signed and ${affirm ? 'affirmed' : 'sworn to'} before me at ${or(v(values, 'place'), 'place')} on this ____ day of __________________ 20____, the regulations contained in Government Notice No. R1258 of 21 July 1972, as amended, having been complied with.`,
    },
    {
      kind: 'signature',
      lines: ['COMMISSIONER OF OATHS', 'Full names:', 'Designation and area:', 'Business address:'],
    },
  ];
}

const commissionerNote: DraftIssue = {
  severity: 'note',
  message:
    'The deponent must sign in the commissioner’s presence, and a commissioner may not administer the oath in a matter in which they have an interest (e.g. an attorney at the firm acting in the matter).',
  basis: 'GN R1258 of 1972 regs 3(1), 7(1)',
};

const paras = (values: Values, key: string): Block[] =>
  lines(values, key).map((text) => ({ kind: 'para' as const, text }));

/** Annexure marks used in the text (FA1, "POC2", A3 …) that are not in the annexure list. */
function missingAnnexures(text: string, list: string, prefix: string): string[] {
  const used = new Set(text.match(new RegExp(`\\b${prefix}\\d+\\b`, 'g')) ?? []);
  const listed = new Set(list.match(new RegExp(`\\b${prefix}\\d+\\b`, 'g')) ?? []);
  return [...used].filter((mark) => !listed.has(mark)).sort();
}

// ------------------------------------------------------------ founding affidavit

export const foundingAffidavit: DraftTemplate = {
  id: 'founding-affidavit',
  version: VERSION,
  name: 'Founding affidavit',
  category: 'high_court',
  purpose:
    'Sets out the facts and evidence on which an application stands, in the order the court reads them: deponent, parties, jurisdiction, facts, relief and (if urgent) urgency.',
  basis: [
    'Uniform Rule 6(1) (application supported by affidavit of the facts)',
    'Uniform Rule 6(12)(b) (urgency: circumstances and why redress in due course is not substantial)',
    'Regulations under the Justices of the Peace and Commissioners of Oaths Act 16 of 1963 (GN R1258 of 1972)',
    'Ganes v Telecom Namibia Ltd 2004 (3) SA 615 (SCA) (authority is for the proceedings, not the deponent)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath', capacity: 'The applicant personally', urgent: 'No' },
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
          help: 'e.g. an adult male director of the applicant, residing at …',
        },
        {
          key: 'capacity',
          label: 'Deposes as',
          type: 'choice',
          required: true,
          choices: ['The applicant personally', 'On behalf of the applicant'],
        },
        oathField,
      ],
    },
    {
      key: 'parties',
      title: 'The parties and jurisdiction',
      fields: [
        {
          key: 'applicantDescription',
          label: 'The applicant',
          type: 'longtext',
          required: true,
          help: 'Full names or registered name, registration or ID number, address.',
        },
        {
          key: 'respondentDescription',
          label: 'The respondent',
          type: 'longtext',
          required: true,
        },
        {
          key: 'jurisdiction',
          label: 'Why this court has jurisdiction',
          type: 'longtext',
          required: true,
          help: 'e.g. the respondent resides within its area, or the cause of action arose there.',
        },
      ],
    },
    {
      key: 'facts',
      title: 'Relief and facts',
      fields: [
        {
          key: 'relief',
          label: 'What the applicant asks for, in summary',
          type: 'longtext',
          required: true,
          help: 'The order in the notice of motion, in a sentence or two.',
        },
        {
          key: 'facts',
          label: 'Facts, one paragraph per line',
          type: 'longtext',
          required: true,
          help: 'Each line becomes a numbered paragraph. Refer to annexures as FA1, FA2 ….',
        },
        {
          key: 'annexures',
          label: 'Annexures, one per line',
          type: 'longtext',
          help: 'e.g. FA1 – Copy of the lease agreement dated 1 March 2026',
        },
      ],
    },
    {
      key: 'urgency',
      title: 'Urgency',
      fields: [
        {
          key: 'urgent',
          label: 'Is the application urgent?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        {
          key: 'urgency',
          label: 'Why it is urgent, one paragraph per line',
          type: 'longtext',
          help: 'The circumstances that make it urgent, and why the applicant cannot get substantial redress at a hearing in due course.',
        },
      ],
    },
    {
      key: 'signing',
      title: 'Signing',
      fields: [{ key: 'place', label: 'Place of signing', type: 'text', required: true }],
    },
  ],
  build(values, ctx) {
    const onBehalf = v(values, 'capacity') === 'On behalf of the applicant';
    const blocks: Block[] = [
      opening(values),
      { kind: 'heading', text: 'The deponent' },
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}.`,
      },
      ...(onBehalf
        ? [
            {
              kind: 'para' as const,
              text: 'I am duly authorised to depose to this affidavit on behalf of the applicant, which has resolved to bring this application.',
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'The facts in this affidavit are within my personal knowledge, unless the context indicates otherwise, and are to the best of my knowledge and belief both true and correct. Where I make submissions of law, I do so on the advice of the applicant’s legal representatives, which I accept.',
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
      {
        kind: 'para',
        text: `This court has jurisdiction because ${or(v(values, 'jurisdiction'), 'grounds of jurisdiction')}`,
      },
      { kind: 'heading', text: 'The relief sought' },
      {
        kind: 'para',
        text: `The applicant seeks an order in terms of the notice of motion to which this affidavit is attached, in summary: ${or(v(values, 'relief'), 'relief')}`,
      },
      { kind: 'heading', text: 'The facts' },
      ...paras(values, 'facts'),
      ...(v(values, 'urgent') === 'Yes'
        ? [{ kind: 'heading' as const, text: 'Urgency' }, ...paras(values, 'urgency')]
        : []),
      { kind: 'heading', text: 'Conclusion' },
      {
        kind: 'para',
        text: 'WHEREFORE I pray for an order in terms of the notice of motion to which this affidavit is attached.',
      },
      ...commissioner(values),
      ...(v(values, 'annexures')
        ? [
            { kind: 'heading' as const, text: 'Annexures' },
            ...lines(values, 'annexures').map((text) => ({ kind: 'text' as const, text })),
          ]
        : []),
    ];
    return {
      title: 'Founding affidavit',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'urgent') === 'Yes' && !v(values, 'urgency')) {
      issues.push({
        severity: 'must',
        field: 'urgency',
        message:
          'An urgent application must set out explicitly why it is urgent and why the applicant cannot be afforded substantial redress at a hearing in due course.',
        basis: 'Uniform Rule 6(12)(b)',
      });
    }
    const missing = missingAnnexures(v(values, 'facts'), v(values, 'annexures'), 'FA');
    if (missing.length) {
      issues.push({
        severity: 'should',
        field: 'annexures',
        message: `The facts refer to ${missing.join(', ')}, which is not in the list of annexures.`,
      });
    }
    if (v(values, 'capacity') === 'On behalf of the applicant') {
      issues.push({
        severity: 'note',
        field: 'capacity',
        message:
          'Keep the resolution (or other proof) that the applicant decided to bring the application: if authority is challenged under Rule 7(1), it is the proceedings that must be authorised.',
        basis: 'Uniform Rule 7(1); Ganes v Telecom Namibia Ltd 2004 (3) SA 615 (SCA)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'An applicant stands or falls by its founding papers: every fact the relief depends on must be here, with its supporting documents, not left for reply.',
      basis: 'Uniform Rule 6(1); practice',
    });
    issues.push(commissionerNote);
    return issues;
  },
};

// ------------------------------------------------------------ confirmatory affidavit

export const confirmatoryAffidavit: DraftTemplate = {
  id: 'confirmatory-affidavit',
  version: VERSION,
  name: 'Confirmatory affidavit',
  category: 'affidavits',
  purpose:
    'Confirms, under oath, what another deponent says about the confirming deponent, so the main affidavit is not hearsay on those points.',
  basis: [
    'Regulations under the Justices of the Peace and Commissioners of Oaths Act 16 of 1963 (GN R1258 of 1972)',
    'Law of Evidence Amendment Act 45 of 1988 s 3 (hearsay)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath', mainAffidavit: 'founding affidavit' },
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
      title: 'Confirming deponent',
      fields: [
        { key: 'deponentName', label: 'Full names', type: 'text', required: true },
        { key: 'deponentId', label: 'ID or passport number', type: 'id_number' },
        {
          key: 'deponentDescription',
          label: 'Who the deponent is',
          type: 'longtext',
          required: true,
        },
        oathField,
      ],
    },
    {
      key: 'confirms',
      title: 'What is confirmed',
      fields: [
        {
          key: 'mainDeponent',
          label: 'Deponent to the main affidavit',
          type: 'text',
          required: true,
        },
        {
          key: 'mainAffidavit',
          label: 'Which affidavit',
          type: 'choice',
          required: true,
          choices: [
            'founding affidavit',
            'answering affidavit',
            'replying affidavit',
            'supplementary affidavit',
            'affidavit',
          ],
        },
        {
          key: 'paragraphs',
          label: 'Paragraphs that concern the deponent',
          type: 'text',
          help: 'e.g. 12 to 15 and 22. Leave empty to confirm everything that relates to the deponent.',
        },
        {
          key: 'facts',
          label: 'Anything the deponent adds, one paragraph per line',
          type: 'longtext',
        },
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
  ],
  build(values, ctx) {
    const which = v(values, 'mainAffidavit') || 'affidavit';
    const paragraphs = v(values, 'paragraphs');
    const blocks: Block[] = [
      opening(values),
      {
        kind: 'para',
        text: `I am ${or(v(values, 'deponentDescription'), 'description of the deponent')}.`,
      },
      {
        kind: 'para',
        text: 'The facts in this affidavit are within my personal knowledge and are to the best of my knowledge and belief both true and correct.',
      },
      {
        kind: 'para',
        text: `I have read the ${which} of ${or(v(values, 'mainDeponent'), 'main deponent')} in this matter. I confirm that its contents, insofar as they relate to me${paragraphs ? `, and in particular paragraphs ${paragraphs}` : ''}, are true and correct.`,
      },
      ...paras(values, 'facts'),
      ...commissioner(values),
    ];
    return {
      title: 'Confirmatory affidavit',
      heading: courtHeading(values, ctx, ['Applicant', 'Respondent']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const name = v(values, 'deponentName').toLowerCase();
    if (name && name === v(values, 'mainDeponent').toLowerCase()) {
      issues.push({
        severity: 'must',
        field: 'mainDeponent',
        message: 'A confirmatory affidavit is made by someone other than the main deponent.',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'A bare confirmation helps only for facts within the confirming deponent’s own knowledge; where they matter, set out those facts in this affidavit.',
      basis: 'Practice',
    });
    issues.push(commissionerNote);
    return issues;
  },
};

// ------------------------------------------------------------ combined summons

export const combinedSummons: DraftTemplate = {
  id: 'combined-summons',
  version: VERSION,
  name: 'Combined summons with particulars of claim',
  category: 'high_court',
  purpose:
    'Starts an action (Form 10): tells the sheriff to serve it, tells the defendant how and when to defend, and attaches the particulars of claim.',
  basis: [
    'Uniform Rule 17 and Form 10 of the First Schedule',
    'Uniform Rule 18 (particulars: material facts, contracts (18(6)), damages (18(10)))',
    'Uniform Rule 19 (notice of intention to defend)',
    'Uniform Rule 41A (mediation notice served with the summons)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { defendDays: '10', contract: 'No contract', claimType: 'Liquidated amount' },
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
          key: 'plaintiffDescription',
          label: 'The plaintiff',
          type: 'longtext',
          required: true,
          help: 'Full names or registered name, ID or registration number, occupation, address.',
        },
        {
          key: 'defendantDescription',
          label: 'The defendant',
          type: 'longtext',
          required: true,
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
          help: '10 court days, or longer where the rules allow for distance.',
        },
      ],
    },
    {
      key: 'claim',
      title: 'Particulars of claim',
      fields: [
        {
          key: 'jurisdiction',
          label: 'Why this court has jurisdiction',
          type: 'longtext',
          required: true,
        },
        {
          key: 'contract',
          label: 'Does the claim rest on a contract?',
          type: 'choice',
          required: true,
          choices: ['No contract', 'Written contract', 'Oral contract'],
        },
        {
          key: 'contractDetails',
          label: 'When, where and by whom the contract was concluded',
          type: 'longtext',
          help: 'e.g. on 1 March 2026 at Pretoria, the plaintiff represented by its director J Mokoena and the defendant in person.',
        },
        {
          key: 'facts',
          label: 'Material facts, one paragraph per line',
          type: 'longtext',
          required: true,
          help: 'Facts, not evidence or argument. Refer to annexures as POC1, POC2 ….',
        },
        {
          key: 'claimType',
          label: 'What is claimed',
          type: 'choice',
          required: true,
          choices: ['Liquidated amount', 'Damages', 'Other relief'],
        },
        { key: 'amount', label: 'Amount claimed (R)', type: 'money' },
        {
          key: 'damages',
          label: 'How the damages are made up, one item per line',
          type: 'longtext',
          help: 'e.g. Medical expenses: R45 000',
        },
        {
          key: 'interest',
          label: 'Interest',
          type: 'text',
          help: 'e.g. at the prescribed rate from 1 April 2026 to date of payment',
        },
        {
          key: 'prayers',
          label: 'Other relief, one prayer per line',
          type: 'longtext',
          help: 'Costs and further or alternative relief are added for you.',
        },
        {
          key: 'annexures',
          label: 'Annexures, one per line',
          type: 'longtext',
          help: 'e.g. POC1 – Copy of the loan agreement',
        },
      ],
    },
    { key: 'attorneys', title: 'Plaintiff’s attorneys', fields: attorneysFields('plaintiff') },
  ],
  build(values, ctx) {
    const plaintiff = or(v(values, 'firstParty'), 'Plaintiff');
    const defendant = or(v(values, 'secondParty'), 'Defendant');
    const oneLine = (key: string, placeholder: string) =>
      or(v(values, key).split('\n').filter(Boolean).join(', '), placeholder);
    const amount = parseRand(v(values, 'amount'));
    const prayers = [
      ...(amount !== null ? [`Payment of the sum of ${randWithWords(amount)}.`] : []),
      ...(v(values, 'interest') ? [`Interest ${v(values, 'interest')}.`] : []),
      ...lines(values, 'prayers'),
      'Costs of suit.',
      'Further and/or alternative relief.',
    ];
    const contract = v(values, 'contract');
    const blocks: Block[] = [
      { kind: 'text', text: 'TO THE SHERIFF OR HIS OR HER DEPUTY:' },
      {
        kind: 'text',
        text: `INFORM ${defendant} of ${oneLine('defendantAddress', 'address')} (hereinafter called the defendant) that ${plaintiff} (hereinafter called the plaintiff) hereby institutes action against the defendant, in which action the plaintiff claims the relief and on the grounds set out in the particulars of claim annexed hereto.`,
      },
      {
        kind: 'text',
        text: `INFORM the defendant further that if the defendant disputes the claim and wishes to defend the action, the defendant shall (i) within ${or(v(values, 'defendDays'), '10')} days of the service upon the defendant of this summons, file with the registrar of this court at ${oneLine('registrarAddress', 'registrar’s address')} notice of the defendant's intention to defend, and serve a copy of it on the plaintiff's attorneys at the address set out below, giving an address referred to in rule 19(3) for the service of all documents in this action, and an email address; and (ii) thereafter, within twenty days after filing and serving notice of intention to defend, file with the registrar and serve upon the plaintiff a plea, exception, notice to strike out, with or without a counterclaim.`,
      },
      {
        kind: 'text',
        text: 'INFORM the defendant further that if the defendant fails to file and serve notice as aforesaid, judgment as claimed may be given against the defendant without further notice, or if, having filed and served such notice, the defendant fails to plead, except, make application to strike out or counterclaim, the defendant may be barred and judgment given against the defendant.',
      },
      {
        kind: 'text',
        text: 'AND immediately thereafter serve on the defendant a copy of this summons and return to this court what you have done thereupon.',
      },
      ...attorneysBlock(values, 'plaintiff'),
      { kind: 'signature', lines: ['REGISTRAR'] },
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
      {
        kind: 'para',
        text: `This court has jurisdiction because ${or(v(values, 'jurisdiction'), 'grounds of jurisdiction')}`,
      },
      { kind: 'heading', text: 'The claim' },
      ...(contract === 'Written contract' || contract === 'Oral contract'
        ? [
            {
              kind: 'para' as const,
              text: `The plaintiff and the defendant concluded ${contract === 'Written contract' ? 'a written' : 'an oral'} agreement ${or(v(values, 'contractDetails'), 'when, where and by whom')}.${contract === 'Written contract' ? ' A true copy of the agreement is annexed marked "POC1".' : ''}`,
            },
          ]
        : []),
      ...paras(values, 'facts'),
      ...(v(values, 'claimType') === 'Damages' && lines(values, 'damages').length
        ? [
            {
              kind: 'para' as const,
              text: `As a result, the plaintiff has suffered damages${amount !== null ? ` in the amount of ${randWithWords(amount)}` : ''}, made up as follows: ${lines(values, 'damages').join('; ')}.`,
            },
          ]
        : []),
      {
        kind: 'para',
        text: 'Despite demand, the defendant has failed to pay or perform and remains liable to the plaintiff.',
      },
      { kind: 'text', text: 'WHEREFORE the plaintiff claims against the defendant:' },
      ...prayers.map((text, index) => ({
        kind: 'text' as const,
        text: `${String.fromCharCode(97 + index)}) ${text}`,
      })),
      ...attorneysBlock(values, 'plaintiff'),
      ...(v(values, 'annexures')
        ? [
            { kind: 'heading' as const, text: 'Annexures' },
            ...lines(values, 'annexures').map((text) => ({ kind: 'text' as const, text })),
          ]
        : []),
    ];
    return {
      title: 'Combined summons',
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
    const contract = v(values, 'contract');
    if (contract !== 'No contract' && contract && !v(values, 'contractDetails')) {
      issues.push({
        severity: 'must',
        field: 'contractDetails',
        message:
          'A pleading that relies on a contract must say whether it is written or oral, and when, where and by whom it was concluded.',
        basis: 'Uniform Rule 18(6)',
      });
    }
    if (contract === 'Written contract' && !/POC1\b/.test(v(values, 'annexures'))) {
      issues.push({
        severity: 'must',
        field: 'annexures',
        message:
          'Annex a true copy of the written contract (or the part relied on) as POC1, and list it.',
        basis: 'Uniform Rule 18(6)',
      });
    }
    if (v(values, 'claimType') === 'Damages' && !lines(values, 'damages').length) {
      issues.push({
        severity: 'must',
        field: 'damages',
        message:
          'Set out the damages so that the defendant can reasonably assess the amount, with each head of damage computed separately.',
        basis: 'Uniform Rule 18(10)',
      });
    }
    if (v(values, 'claimType') !== 'Other relief' && !v(values, 'amount')) {
      issues.push({ severity: 'must', field: 'amount', message: 'Enter the amount claimed.' });
    }
    const missing = missingAnnexures(v(values, 'facts'), v(values, 'annexures'), 'POC');
    if (missing.length) {
      issues.push({
        severity: 'should',
        field: 'annexures',
        message: `The facts refer to ${missing.join(', ')}, which is not in the list of annexures.`,
      });
    }
    if (v(values, 'claimType') === 'Liquidated amount') {
      issues.push({
        severity: 'note',
        field: 'claimType',
        message:
          'For a debt or liquidated demand a simple summons may be enough; and check whether the amount falls within the magistrates’ courts’ jurisdiction before issuing in the High Court.',
        basis: 'Uniform Rule 17(2)(b); Magistrates’ Courts Act 32 of 1944 s 29',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'Serve a Rule 41A notice (whether the plaintiff agrees to mediation) with the summons, and check the time limits in the Prescription Act before issuing.',
      basis: 'Uniform Rule 41A(2)(a); Prescription Act 68 of 1969',
    });
    return issues;
  },
};

// ------------------------------------------------------------ notice of intention to defend

/** The last day for a notice of intention to defend: court days, not counting 16 December–15 January. */
export function defendDeadline(served: string, days: number): string | null {
  return addCourtDays(served, days, { skipDiesNon: true });
}

export const noticeOfIntentionToDefend: DraftTemplate = {
  id: 'notice-of-intention-to-defend',
  version: VERSION,
  name: 'Notice of intention to defend',
  category: 'high_court',
  purpose:
    'Records that the defendant will defend the action and gives the address and email at which it accepts service.',
  basis: [
    'Uniform Rule 19(1) (10 court days; 16 December–15 January not counted)',
    'Uniform Rule 19(3) (address for service, email)',
    'Uniform Rule 19(5) (late notice before default judgment)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { defendDays: '10' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        { ...courtFields[1]!, required: true },
        { key: 'firstParty', label: 'Plaintiff', type: 'text', required: true },
        {
          key: 'secondParty',
          label: 'Defendant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
      ],
    },
    {
      key: 'service',
      title: 'Service of the summons',
      fields: [
        { key: 'servedOn', label: 'Date the summons was served', type: 'date' },
        {
          key: 'defendDays',
          label: 'Days allowed in the summons',
          type: 'number',
          required: true,
        },
        {
          key: 'plaintiffAttorneys',
          label: 'Plaintiff’s attorneys (name and address)',
          type: 'longtext',
          required: true,
        },
      ],
    },
    { key: 'attorneys', title: 'Defendant’s attorneys', fields: attorneysFields('defendant') },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the defendant, ${or(v(values, 'secondParty'), 'Defendant')}, intends to defend the action instituted against it by the plaintiff.`,
      },
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the defendant appoints the address of its attorneys set out below as the address at which it will accept notice and service of all process in this action, and that it will also accept service by email at ${or(v(values, 'firmEmail'), 'email')}.`,
      },
      ...attorneysBlock(values, 'defendant'),
      { kind: 'text', text: registrar(values) },
      {
        kind: 'text',
        text: `AND TO: ${or(v(values, 'plaintiffAttorneys').split('\n').filter(Boolean).join(', '), 'plaintiff’s attorneys')} (attorneys for the plaintiff)`,
      },
    ];
    return {
      title: 'Notice of intention to defend',
      heading: courtHeading(values, ctx, ['Plaintiff', 'Defendant']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const served = v(values, 'servedOn');
    const days = Number(v(values, 'defendDays')) || 10;
    const last = served ? defendDeadline(served, days) : null;
    if (last) {
      if (ctx.today > last) {
        issues.push({
          severity: 'should',
          field: 'servedOn',
          message: `The notice was due by ${longDate(last)}. Deliver it at once: it is still valid if delivered before default judgment is granted, but the defendant may have to pay the costs of a default judgment application already lodged.`,
          basis: 'Uniform Rule 19(5)',
        });
      } else {
        issues.push({
          severity: 'note',
          field: 'servedOn',
          message: `Last day to deliver: ${longDate(last)} (court days, leaving out 16 December to 15 January).`,
          basis: 'Uniform Rule 19(1)',
        });
      }
    }
    issues.push({
      severity: 'note',
      message:
        'The plea, exception or notice to strike out is due 20 court days after this notice is delivered.',
      basis: 'Uniform Rule 22(1)',
    });
    return issues;
  },
};

// ------------------------------------------------------------ plea

interface PleaLine {
  paragraphs: string;
  covers: number[];
  text: string;
}

/** "3: Admitted." / "4 to 6 | Denied …" → the paragraphs answered and the answer. */
export function pleaLines(values: Values): { answered: PleaLine[]; unnumbered: string[] } {
  const answered: PleaLine[] = [];
  const unnumbered: string[] = [];
  for (const raw of v(values, 'responses').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match =
      /^(?:ad\s+)?(?:paragraphs?\s+)?(\d+(?:\.\d+)*(?:\s*(?:to|-|–|and)\s*\d+(?:\.\d+)*)?)\s*[:|]\s*(.+)$/i.exec(
        line,
      );
    if (!match) {
      unnumbered.push(line);
      continue;
    }
    const paragraphs = match[1]!.replace(/\s*(?:-|–)\s*/, ' to ');
    const [from, to] = paragraphs.split(/\s*(?:to|and)\s*/i).map((n) => Math.floor(Number(n)));
    const covers: number[] = [];
    if (from !== undefined && Number.isFinite(from)) {
      const end = to !== undefined && Number.isFinite(to) ? to : from;
      if (/and/i.test(paragraphs)) covers.push(from, end);
      else for (let n = from; n <= end && n - from < 500; n += 1) covers.push(n);
    }
    answered.push({ paragraphs, covers, text: match[2]!.trim() });
  }
  return { answered, unnumbered };
}

export const plea: DraftTemplate = {
  id: 'plea',
  version: VERSION,
  name: 'Plea',
  category: 'high_court',
  purpose:
    'Answers every allegation in the particulars of claim (admit, deny, or confess and avoid), with any special plea first.',
  basis: [
    'Uniform Rule 22(1) (20 court days after notice of intention to defend)',
    'Uniform Rule 22(2) (admit, deny or confess and avoid; material facts relied on)',
    'Uniform Rule 22(3) (allegations not dealt with are deemed admitted)',
    'Uniform Rule 18 (rules for all pleadings)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        { ...courtFields[0]!, required: true },
        { ...courtFields[1]!, required: true },
        { key: 'firstParty', label: 'Plaintiff', type: 'text', required: true },
        {
          key: 'secondParty',
          label: 'Defendant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
      ],
    },
    {
      key: 'pleading',
      title: 'The plea',
      fields: [
        {
          key: 'paragraphCount',
          label: 'Number of paragraphs in the particulars of claim',
          type: 'number',
          help: 'Used to check that every paragraph is answered.',
        },
        {
          key: 'specialPleas',
          label: 'Special pleas, one paragraph per line',
          type: 'longtext',
          help: 'e.g. prescription, jurisdiction, lis pendens. Leave empty if none.',
        },
        {
          key: 'responses',
          label: 'Answer to each paragraph, one per line',
          type: 'longtext',
          required: true,
          help: 'Start with the paragraph number: "1: Admitted." "4 to 6: Denied. The defendant pleads that …"',
        },
        {
          key: 'noticeDelivered',
          label: 'Date the notice of intention to defend was delivered',
          type: 'date',
        },
      ],
    },
    { key: 'attorneys', title: 'Defendant’s attorneys', fields: attorneysFields('defendant') },
  ],
  build(values, ctx) {
    const { answered, unnumbered } = pleaLines(values);
    const special = lines(values, 'specialPleas');
    const blocks: Block[] = [
      ...(special.length
        ? [
            { kind: 'heading' as const, text: 'Special plea' },
            ...special.map((text) => ({ kind: 'para' as const, text })),
            {
              kind: 'text' as const,
              text: 'WHEREFORE the defendant prays that the special plea be upheld and the plaintiff’s claim be dismissed with costs.',
            },
            { kind: 'heading' as const, text: 'Plea over on the merits' },
          ]
        : []),
      {
        kind: 'text',
        text: 'The defendant pleads to the plaintiff’s particulars of claim as follows:',
      },
      ...answered.map((line) => ({
        kind: 'para' as const,
        text: `Ad paragraph${line.covers.length > 1 ? 's' : ''} ${line.paragraphs}: ${line.text}`,
      })),
      ...unnumbered.map((text) => ({ kind: 'para' as const, text })),
      {
        kind: 'text',
        text: 'WHEREFORE the defendant prays that the plaintiff’s claim be dismissed with costs.',
      },
      ...attorneysBlock(values, 'defendant'),
      { kind: 'text', text: registrar(values) },
      { kind: 'text', text: 'AND TO: THE PLAINTIFF’S ATTORNEYS' },
    ];
    return {
      title: special.length ? 'Special plea and plea' : 'Plea',
      heading: courtHeading(values, ctx, ['Plaintiff', 'Defendant']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const { answered, unnumbered } = pleaLines(values);
    const count = Number(v(values, 'paragraphCount'));
    if (Number.isInteger(count) && count > 0) {
      const covered = new Set(answered.flatMap((line) => line.covers));
      const missing = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !covered.has(n));
      if (missing.length) {
        issues.push({
          severity: 'must',
          field: 'responses',
          message: `Paragraph${missing.length > 1 ? 's' : ''} ${missing.join(', ')} of the particulars ${missing.length > 1 ? 'are' : 'is'} not answered: an allegation not admitted or denied is deemed admitted.`,
          basis: 'Uniform Rule 22(3)',
        });
      }
    }
    const noted = answered.filter((line) =>
      /^(the contents (hereof|of this paragraph) are )?noted\.?$/i.test(line.text),
    );
    if (noted.length) {
      issues.push({
        severity: 'should',
        field: 'responses',
        message: `"Noted" (paragraph ${noted.map((line) => line.paragraphs).join(', ')}) neither admits nor denies; say whether the allegation is admitted, denied, or not known (and so denied).`,
        basis: 'Uniform Rule 22(2), (3)',
      });
    }
    if (unnumbered.length) {
      issues.push({
        severity: 'should',
        field: 'responses',
        message:
          'Start each answer with the paragraph it answers, e.g. "5: Denied.", so that the plea follows the particulars.',
      });
    }
    const delivered = v(values, 'noticeDelivered');
    const last = delivered ? addCourtDays(delivered, 20) : null;
    if (last) {
      issues.push({
        severity: ctx.today > last ? 'should' : 'note',
        field: 'noticeDelivered',
        message:
          ctx.today > last
            ? `The plea was due by ${longDate(last)}. Check whether a notice of bar has been served (5 court days to plead once it is).`
            : `Last day to plead: ${longDate(last)}.`,
        basis: 'Uniform Rules 22(1), 26',
      });
    }
    return issues;
  },
};
