// Magistrates' Courts, certification of copies and criminal documents.
// Standard wording: to be reviewed by an admitted attorney.
import type { DraftField, DraftIssue } from '@ahava88/shared';
import { addCourtDays, isBusinessDay, longDate } from '../days';
import { parseRand, randWithWords } from '../fields';
import type { Block } from '../model';
import {
  AGREEMENT_FORMAT,
  COURT_FORMAT,
  LETTER_FORMAT,
  UNREVIEWED,
  letterhead,
  lines,
  or,
  v,
  type DraftContext,
  type DraftTemplate,
} from '../template';
import { courtHeading } from './court';
import { letterFields, sender, signOff } from './correspondence';
import {
  attorneysBlock,
  attorneysFields,
  commissioner,
  commissionerNote,
  oathField,
  opening,
  paras,
  pleaLines,
} from './litigation';

type Values = Record<string, string>;

const VERSION = '2026.11-1';

const mcCourt: DraftField = {
  key: 'court',
  label: 'Court',
  type: 'text',
  required: true,
  help: 'e.g. Magistrate’s Court for the District of Tshwane Central, held at Pretoria (or Regional Court for the Regional Division of Gauteng, held at …)',
};
const caseNumber: DraftField = {
  key: 'caseNumber',
  label: 'Case number',
  type: 'text',
  prefill: 'matter.caseNumber',
};

const clerk = (values: Values) =>
  `TO: THE CLERK OF THE COURT, ${(v(values, 'court').split(',')[0] || 'MAGISTRATE’S COURT').toUpperCase()}`;

const numbered = (items: string[]): Block[] =>
  items.map((text, index) => ({ kind: 'text' as const, text: `${index + 1}. ${text}` }));

const oneLine = (values: Values, key: string, placeholder: string) =>
  or(v(values, key).split('\n').filter(Boolean).join(', '), placeholder);

function due(
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
        ? `The ${what} was due by ${longDate(last)}; it now needs the other side’s consent or condonation.`
        : `Last day for the ${what}: ${longDate(last)}.`,
      basis,
    },
  ];
}

// ------------------------------------------------------------ Magistrates' Court summons

export const mcSummons: DraftTemplate = {
  id: 'mc-summons',
  version: VERSION,
  name: 'Summons (Magistrates’ Court)',
  category: 'magistrates_court',
  purpose:
    'Starts an action in the Magistrates’ Court: calls on the defendant to defend within the time stated, with the particulars of claim attached.',
  basis: [
    'Magistrates’ Courts Rules, rule 5 and the summons form in Annexure 1',
    'Magistrates’ Courts Act 32 of 1944 ss 28 (jurisdiction over persons), 29 (causes of action and monetary limits)',
    'Magistrates’ Courts Rules, rule 13 (notice of intention to defend)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { defendDays: '10' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        mcCourt,
        caseNumber,
        {
          key: 'firstParty',
          label: 'Plaintiff',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'plaintiffAddress',
          label: 'Plaintiff’s address',
          type: 'longtext',
          required: true,
          prefill: 'client.address',
        },
        { key: 'secondParty', label: 'Defendant', type: 'text', required: true },
        {
          key: 'defendantDescription',
          label: 'Defendant’s occupation and ID number, if known',
          type: 'text',
        },
        {
          key: 'defendantAddress',
          label: 'Defendant’s address for service',
          type: 'longtext',
          required: true,
        },
        {
          key: 'jurisdiction',
          label: 'Why this court has jurisdiction',
          type: 'text',
          required: true,
          help: 'e.g. the defendant resides in the district.',
        },
        { key: 'defendDays', label: 'Days to defend', type: 'number', required: true },
      ],
    },
    {
      key: 'claim',
      title: 'Particulars of claim',
      fields: [
        {
          key: 'facts',
          label: 'Material facts, one paragraph per line',
          type: 'longtext',
          required: true,
        },
        { key: 'amount', label: 'Amount claimed (R)', type: 'money' },
        { key: 'interest', label: 'Interest', type: 'text' },
        { key: 'prayers', label: 'Other relief, one per line', type: 'longtext' },
        {
          key: 'credit',
          label: 'Is the claim on a credit agreement (NCA)?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        { key: 's129Date', label: 'Date the section 129 notice was delivered', type: 'date' },
      ],
    },
    { key: 'attorneys', title: 'Plaintiff’s attorneys', fields: attorneysFields('plaintiff') },
  ],
  build(values, ctx) {
    const amount = parseRand(v(values, 'amount'));
    const prayers = [
      ...(amount !== null ? [`Payment of the sum of ${randWithWords(amount)}.`] : []),
      ...(v(values, 'interest') ? [`Interest ${v(values, 'interest')}.`] : []),
      ...lines(values, 'prayers'),
      'Costs of suit.',
    ];
    const credit = v(values, 'credit') === 'Yes';
    const blocks: Block[] = [
      { kind: 'text', text: 'TO THE SHERIFF OR HIS OR HER DEPUTY:' },
      {
        kind: 'text',
        text: `INFORM ${or(v(values, 'secondParty'), 'Defendant')}${v(values, 'defendantDescription') ? ` (${v(values, 'defendantDescription')})` : ''}, of ${oneLine(values, 'defendantAddress', 'address')} (the defendant), that ${or(v(values, 'firstParty'), 'Plaintiff')} of ${oneLine(values, 'plaintiffAddress', 'address')} (the plaintiff) institutes action against the defendant for the relief set out in the particulars of claim annexed.`,
      },
      {
        kind: 'text',
        text: `INFORM the defendant further that if the defendant intends to defend the action, the defendant must, within ${or(v(values, 'defendDays'), '10')} days after service of this summons, deliver to the clerk of the court and to the plaintiff’s attorneys at the address below a notice of intention to defend, giving an address for service of all documents in this action and an email address, failing which judgment may be given against the defendant without further notice.`,
      },
      {
        kind: 'text',
        text: 'INFORM the defendant further that the defendant may, instead, admit liability and offer to pay the claim in instalments, or consent to judgment, as sections 57 and 58 of the Magistrates’ Courts Act 32 of 1944 provide, and that the defendant may seek legal advice or help from the clerk of the court.',
      },
      {
        kind: 'text',
        text: 'AND immediately thereafter serve this summons on the defendant and return to this court what you have done thereupon.',
      },
      ...attorneysBlock(values, 'plaintiff'),
      { kind: 'signature', lines: ['CLERK OF THE COURT'] },
      { kind: 'spacer' },
      { kind: 'centred', text: 'PARTICULARS OF CLAIM', bold: true },
      {
        kind: 'para',
        text: `The plaintiff is ${or(v(values, 'firstParty'), 'Plaintiff')}, of ${oneLine(values, 'plaintiffAddress', 'address')}.`,
      },
      {
        kind: 'para',
        text: `The defendant is ${or(v(values, 'secondParty'), 'Defendant')}, of ${oneLine(values, 'defendantAddress', 'address')}.`,
      },
      {
        kind: 'para',
        text: `This court has jurisdiction because ${or(v(values, 'jurisdiction'), 'grounds of jurisdiction')}`,
      },
      ...paras(values, 'facts'),
      ...(credit
        ? [
            {
              kind: 'para' as const,
              text: `The plaintiff has complied with sections 129 and 130 of the National Credit Act 34 of 2005: the notice in terms of section 129(1)(a) was delivered to the defendant on ${longDate(v(values, 's129Date')) || '[date]'}, and the periods in section 130(1) have expired.`,
            },
          ]
        : []),
      { kind: 'text', text: 'WHEREFORE the plaintiff claims:' },
      ...prayers.map((text, index) => ({
        kind: 'text' as const,
        text: `${String.fromCharCode(97 + index)}) ${text}`,
      })),
      ...attorneysBlock(values, 'plaintiff'),
    ];
    return {
      title: 'Summons',
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
        message: 'The defendant has at least 10 days to defend.',
        basis: 'Magistrates’ Courts Rules, rule 13',
      });
    }
    if (v(values, 'credit') === 'Yes' && !v(values, 's129Date')) {
      issues.push({
        severity: 'must',
        field: 's129Date',
        message:
          'A claim on a credit agreement must allege that the section 129 notice was delivered and the section 130 periods have passed.',
        basis: 'National Credit Act 34 of 2005 ss 129, 130; Sebola v Standard Bank [2012] ZACC 11',
      });
    }
    issues.push({
      severity: 'note',
      field: 'amount',
      message:
        'Check the claim is within the court’s monetary jurisdiction (district or regional court) as currently set by notice under section 29, and that the defendant is within the court’s area.',
      basis: 'Magistrates’ Courts Act 32 of 1944 ss 28, 29',
    });
    return issues;
  },
};

// ------------------------------------------------------------ Magistrates' Court application

export const mcApplication: DraftTemplate = {
  id: 'mc-application',
  version: VERSION,
  name: 'Application (Magistrates’ Court)',
  category: 'magistrates_court',
  purpose:
    'Starts an application on notice of motion supported by affidavit in the Magistrates’ Court (Form 1A).',
  basis: [
    'Magistrates’ Courts Rules, rule 55(1) (at least 10 days to oppose; answering affidavit 10 days after notice of opposition)',
    'Annexure 1, Form 1A (notice of motion, long form)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { opposeDays: '10', answerDays: '10' },
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        mcCourt,
        caseNumber,
        {
          key: 'firstParty',
          label: 'Applicant',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'secondParty', label: 'Respondent', type: 'text', required: true },
        { key: 'respondentAddress', label: 'Respondent’s address', type: 'longtext' },
      ],
    },
    {
      key: 'relief',
      title: 'Relief and times',
      fields: [
        {
          key: 'prayers',
          label: 'Order sought, one prayer per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'deponent',
          label: 'Deponent to the founding affidavit',
          type: 'text',
          required: true,
        },
        { key: 'opposeDays', label: 'Days to oppose', type: 'number', required: true },
        {
          key: 'answerDays',
          label: 'Days for the answering affidavit',
          type: 'number',
          required: true,
        },
        { key: 'hearingDate', label: 'Hearing date if unopposed', type: 'date' },
      ],
    },
    { key: 'attorneys', title: 'Applicant’s attorneys', fields: attorneysFields('applicant') },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: 'KINDLY TAKE NOTICE that the applicant intends to apply to this court for an order:',
      },
      ...numbered([
        ...lines(values, 'prayers'),
        'Costs of the application.',
        'Further and/or alternative relief.',
      ]),
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that the affidavit of ${or(v(values, 'deponent'), 'deponent')}, annexed, will be used in support of the application, and that the applicant appoints the address of its attorneys below for service of all process.`,
      },
      {
        kind: 'text',
        text: `TAKE NOTICE FURTHER that if the respondent intends to oppose the application, it must notify the applicant’s attorneys in writing within ${or(v(values, 'opposeDays'), '10')} days after service of this notice, appointing an address for service and an email address, and must deliver its answering affidavit, if any, within ${or(v(values, 'answerDays'), '10')} days after giving that notice.`,
      },
      {
        kind: 'text',
        text: `If no notice of intention to oppose is given, the application will be made on ${longDate(v(values, 'hearingDate')) || '____ __________________ 20____'} at 09:00.`,
      },
      ...attorneysBlock(values, 'applicant'),
      { kind: 'text', text: clerk(values) },
      {
        kind: 'text',
        text: `AND TO: ${or(v(values, 'secondParty'), 'the respondent')}${v(values, 'respondentAddress') ? `, ${oneLine(values, 'respondentAddress', '')}` : ''}`,
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
    if (Number(v(values, 'opposeDays')) < 10) {
      issues.push({
        severity: 'must',
        field: 'opposeDays',
        message: 'The respondent has at least 10 days after service to give notice of opposition.',
        basis: 'Magistrates’ Courts Rules, rule 55(1)',
      });
    }
    const hearing = v(values, 'hearingDate');
    if (hearing && !isBusinessDay(hearing)) {
      issues.push({
        severity: 'must',
        field: 'hearingDate',
        message: `${longDate(hearing)} is not a court day.`,
      });
    }
    return issues;
  },
};

// ------------------------------------------------------------ Magistrates' Court plea

export const mcPlea: DraftTemplate = {
  id: 'mc-plea',
  version: VERSION,
  name: 'Plea (Magistrates’ Court)',
  category: 'magistrates_court',
  purpose: 'Answers each paragraph of the particulars of claim in the Magistrates’ Court.',
  basis: [
    'Magistrates’ Courts Rules, rule 17 (plea within 20 days after notice of intention to defend; admit, deny or confess and avoid)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        mcCourt,
        { ...caseNumber, required: true },
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
      key: 'plea',
      title: 'The plea',
      fields: [
        {
          key: 'paragraphCount',
          label: 'Number of paragraphs in the particulars of claim',
          type: 'number',
        },
        { key: 'specialPleas', label: 'Special pleas, one per line', type: 'longtext' },
        {
          key: 'responses',
          label: 'Answer to each paragraph, one per line ("3: Denied. …")',
          type: 'longtext',
          required: true,
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
            { kind: 'heading' as const, text: 'Plea on the merits' },
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
      { kind: 'text', text: clerk(values) },
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
    const count = Number(v(values, 'paragraphCount'));
    if (Number.isInteger(count) && count > 0) {
      const covered = new Set(pleaLines(values).answered.flatMap((line) => line.covers));
      const missing = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !covered.has(n));
      if (missing.length) {
        issues.push({
          severity: 'must',
          field: 'responses',
          message: `Paragraph${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not answered: an allegation not dealt with is taken as admitted.`,
          basis: 'Magistrates’ Courts Rules, rule 17',
        });
      }
    }
    issues.push(
      ...due(values, ctx, 'noticeDelivered', 20, 'plea', 'Magistrates’ Courts Rules, rule 17(1)'),
    );
    return issues;
  },
};

// ------------------------------------------------------------ section 65A notice

export const section65Documents: DraftTemplate = {
  id: 'section-65-documents',
  version: VERSION,
  name: 'Section 65A notice (financial enquiry)',
  category: 'magistrates_court',
  purpose:
    'Calls an unpaying judgment debtor to court for an enquiry into their financial position, with the documents they must bring.',
  basis: [
    'Magistrates’ Courts Act 32 of 1944 ss 65A, 65D, 65E, as amended by the Courts of Law Amendment Act 7 of 2017',
    'Magistrates’ Courts Rules, Annexure 1 (notice to appear in terms of s 65A(1))',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  sections: [
    {
      key: 'court',
      title: 'Court and parties',
      fields: [
        mcCourt,
        { ...caseNumber, required: true },
        {
          key: 'firstParty',
          label: 'Judgment creditor',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'secondParty', label: 'Judgment debtor', type: 'text', required: true },
        {
          key: 'debtorAddress',
          label: 'Debtor’s address for personal service',
          type: 'longtext',
          required: true,
        },
      ],
    },
    {
      key: 'judgment',
      title: 'Judgment and enquiry',
      fields: [
        { key: 'judgmentDate', label: 'Date of judgment', type: 'date', required: true },
        { key: 'balance', label: 'Balance owing (R)', type: 'money', required: true },
        {
          key: 'presence',
          label: 'Was judgment given in the debtor’s presence?',
          type: 'choice',
          required: true,
          choices: ['No', 'Yes'],
        },
        {
          key: 'letterDate',
          label: 'Date the registered letter of the judgment was sent',
          type: 'date',
        },
        { key: 'enquiryDate', label: 'Enquiry date', type: 'date', required: true },
        { key: 'enquiryTime', label: 'Time', type: 'text', required: true },
      ],
    },
    {
      key: 'attorneys',
      title: 'Creditor’s attorneys',
      fields: attorneysFields('judgment creditor'),
    },
  ],
  build(values, ctx) {
    const balance = parseRand(v(values, 'balance'));
    const blocks: Block[] = [
      { kind: 'text', text: 'TO THE SHERIFF OR HIS OR HER DEPUTY:' },
      {
        kind: 'text',
        text: `INFORM ${or(v(values, 'secondParty'), 'judgment debtor')}, of ${oneLine(values, 'debtorAddress', 'address')} (the judgment debtor), that judgment was given against the judgment debtor in this court on ${longDate(v(values, 'judgmentDate')) || '[date]'} in favour of ${or(v(values, 'firstParty'), 'judgment creditor')} (the judgment creditor), and that ${balance !== null ? randWithWords(balance) : '[balance]'} remains unpaid.`,
      },
      {
        kind: 'text',
        text: `The judgment debtor is called upon to appear before the court in chambers on ${longDate(v(values, 'enquiryDate')) || '[date]'} at ${or(v(values, 'enquiryTime'), 'time')}, so that the court may inquire into the judgment debtor’s financial position and make an order it considers just, in terms of section 65D of the Act.`,
      },
      {
        kind: 'text',
        text: 'The judgment debtor must bring documentary proof of income and expenses (payslips, bank statements for the last three months, and proof of monthly commitments and dependants), and any other documents that show the judgment debtor’s financial position.',
      },
      {
        kind: 'text',
        text: 'A judgment debtor who fails to appear, without good cause, may be dealt with as the Act provides. The judgment debtor may seek legal advice, or may before the date make a written offer to pay the debt in instalments.',
      },
      {
        kind: 'text',
        text: 'AND serve this notice on the judgment debtor personally, and return to this court what you have done.',
      },
      ...attorneysBlock(values, 'judgment creditor'),
      { kind: 'signature', lines: ['CLERK OF THE COURT'] },
    ];
    return {
      title: 'Notice in terms of section 65A(1)',
      heading: courtHeading(values, ctx, ['Judgment creditor', 'Judgment debtor']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    if (v(values, 'presence') === 'No' && !v(values, 'letterDate')) {
      issues.push({
        severity: 'must',
        field: 'letterDate',
        message:
          'Where judgment was not given in the debtor’s presence, the debtor must first be told of the judgment by registered letter; the clerk will want proof of that before issuing the notice.',
        basis: 'Magistrates’ Courts Act 32 of 1944 s 65A(2)',
      });
    }
    const enquiry = v(values, 'enquiryDate');
    if (enquiry && !isBusinessDay(enquiry)) {
      issues.push({
        severity: 'must',
        field: 'enquiryDate',
        message: `${longDate(enquiry)} is not a court day.`,
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The notice must be served personally. At the enquiry the court considers what the debtor can afford after reasonable living expenses; an emoluments attachment order is subject to the court’s scrutiny since the 2017 amendments.',
      basis: 'Magistrates’ Courts Act ss 65A, 65D, 65J; Courts of Law Amendment Act 7 of 2017',
    });
    return issues;
  },
};

// ------------------------------------------------------------ certification of copies

export const certificationOfCopies: DraftTemplate = {
  id: 'certification-of-copies',
  version: VERSION,
  name: 'Certificate: true copy of the original',
  category: 'affidavits',
  purpose:
    'The commissioner of oaths’ certificate, placed on each copy, that it is a true copy of the original document seen.',
  basis: [
    'Justices of the Peace and Commissioners of Oaths Act 16 of 1963',
    'Practice of the receiving institution (banks, government departments)',
  ],
  review: UNREVIEWED,
  format: AGREEMENT_FORMAT,
  sections: [
    {
      key: 'copy',
      title: 'The copy',
      fields: [
        {
          key: 'document',
          label: 'Document copied',
          type: 'text',
          required: true,
          help: 'e.g. identity document of Thandi Nkosi',
        },
        { key: 'pages', label: 'Number of pages', type: 'number', required: true },
        { key: 'place', label: 'Place', type: 'text', required: true },
        { key: 'certDate', label: 'Date', type: 'date', prefill: 'today' },
      ],
    },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I certify that this copy of ${or(v(values, 'document'), 'the document')}, consisting of ${or(v(values, 'pages'), '[number]')} page(s), is a true copy of the original document, which I have seen and compared with this copy, and that the original does not appear to have been altered.`,
      },
      {
        kind: 'text',
        text: `Signed at ${or(v(values, 'place'), 'place')} on ${longDate(v(values, 'certDate') || ctx.today)}.`,
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
    return { title: 'Certified true copy', blocks };
  },
  checks() {
    return [
      {
        severity: 'note',
        message:
          'Certify only against the original itself, never a copy, and sign and stamp each page. Many institutions accept certified copies only if certified recently (often within three months).',
        basis:
          'Justices of the Peace and Commissioners of Oaths Act 16 of 1963; institutional practice',
      },
    ];
  },
};

// ------------------------------------------------------------ bail affidavit

export const bailAffidavit: DraftTemplate = {
  id: 'bail-affidavit',
  version: VERSION,
  name: 'Bail application affidavit',
  category: 'criminal',
  purpose:
    'The accused’s affidavit for bail: personal circumstances, the answer to each ground for refusal, and the conditions offered.',
  basis: [
    'Criminal Procedure Act 51 of 1977 s 60(4)–(9) (grounds and factors)',
    's 60(11) (Schedule 5 and 6 offences: the accused bears the onus)',
    's 60(11B) (the accused must disclose previous convictions and pending charges)',
    'GN R1258 of 1972',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { oath: 'Oath', schedule: 'Neither' },
  sections: [
    {
      key: 'court',
      title: 'Court',
      fields: [
        mcCourt,
        caseNumber,
        { key: 'firstParty', label: 'The State', type: 'text', required: true },
        {
          key: 'secondParty',
          label: 'Accused',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'charges', label: 'Charges', type: 'text', required: true },
        {
          key: 'schedule',
          label: 'Is the offence in Schedule 5 or 6?',
          type: 'choice',
          required: true,
          choices: ['Neither', 'Schedule 5', 'Schedule 6'],
        },
      ],
    },
    {
      key: 'deponent',
      title: 'The accused',
      fields: [
        {
          key: 'deponentName',
          label: 'Full names',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'deponentId', label: 'ID number', type: 'id_number', prefill: 'client.idNumber' },
        { key: 'age', label: 'Age', type: 'number' },
        {
          key: 'address',
          label: 'Fixed address and how long there',
          type: 'longtext',
          required: true,
        },
        { key: 'family', label: 'Family and dependants', type: 'longtext', required: true },
        { key: 'work', label: 'Work and income', type: 'longtext', required: true },
        { key: 'assets', label: 'Assets', type: 'longtext' },
        {
          key: 'passport',
          label: 'Travel documents',
          type: 'text',
          required: true,
          help: 'e.g. holds no passport, or will surrender passport no …',
        },
        {
          key: 'previous',
          label: 'Previous convictions, one per line ("none" if none)',
          type: 'longtext',
          required: true,
        },
        {
          key: 'pending',
          label: 'Pending charges and whether out on bail ("none" if none)',
          type: 'longtext',
          required: true,
        },
        { key: 'health', label: 'Health or other personal circumstances', type: 'longtext' },
        oathField,
        { key: 'place', label: 'Place of signing', type: 'text', required: true },
      ],
    },
    {
      key: 'case',
      title: 'Answer to the grounds and bail offered',
      fields: [
        {
          key: 'version',
          label: 'The accused’s version and the strength of the case (optional), one per line',
          type: 'longtext',
          help: 'Anything said here may be used at trial. Consider carefully.',
        },
        {
          key: 'grounds',
          label: 'Why none of the section 60(4) grounds applies, one per line',
          type: 'longtext',
          required: true,
        },
        {
          key: 'exceptional',
          label: 'Exceptional circumstances (Schedule 6), one per line',
          type: 'longtext',
        },
        { key: 'amount', label: 'Bail the accused can afford (R)', type: 'money', required: true },
        {
          key: 'conditions',
          label: 'Conditions the accused will accept, one per line',
          type: 'longtext',
        },
      ],
    },
  ],
  build(values, ctx) {
    const amount = parseRand(v(values, 'amount'));
    const blocks: Block[] = [
      opening(values),
      {
        kind: 'para',
        text: `I am the accused in this matter, charged with ${or(v(values, 'charges'), 'charges')}. I make this affidavit in support of my application to be released on bail. The facts are within my personal knowledge and are true and correct.`,
      },
      { kind: 'heading', text: 'Personal circumstances' },
      ...(v(values, 'age')
        ? [{ kind: 'para' as const, text: `I am ${v(values, 'age')} years old.` }]
        : []),
      { kind: 'para', text: `Address: ${oneLine(values, 'address', 'address')}.` },
      { kind: 'para', text: `Family and dependants: ${or(v(values, 'family'), 'family')}` },
      { kind: 'para', text: `Employment and income: ${or(v(values, 'work'), 'work')}` },
      ...(v(values, 'assets')
        ? [{ kind: 'para' as const, text: `Assets: ${v(values, 'assets')}` }]
        : []),
      { kind: 'para', text: `Travel documents: ${or(v(values, 'passport'), 'travel documents')}.` },
      ...(v(values, 'health') ? [{ kind: 'para' as const, text: v(values, 'health') }] : []),
      { kind: 'heading', text: 'Previous convictions and pending charges' },
      {
        kind: 'para',
        text: `As section 60(11B)(a) of the Criminal Procedure Act requires, I disclose my previous convictions: ${lines(values, 'previous').join('; ') || '[previous convictions or none]'}.`,
      },
      {
        kind: 'para',
        text: `Pending charges: ${lines(values, 'pending').join('; ') || '[pending charges or none]'}.`,
      },
      ...(lines(values, 'version').length
        ? [
            { kind: 'heading' as const, text: 'The charges' },
            ...lines(values, 'version').map((text) => ({ kind: 'para' as const, text })),
          ]
        : []),
      { kind: 'heading', text: 'The interests of justice' },
      ...lines(values, 'grounds').map((text) => ({ kind: 'para' as const, text })),
      ...(v(values, 'schedule') === 'Schedule 6'
        ? [
            { kind: 'heading' as const, text: 'Exceptional circumstances' },
            ...lines(values, 'exceptional').map((text) => ({ kind: 'para' as const, text })),
          ]
        : []),
      { kind: 'heading', text: 'Bail' },
      {
        kind: 'para',
        text: `I can afford bail of ${amount !== null ? randWithWords(amount) : '[amount]'}${lines(values, 'conditions').length ? `, and I will abide by the following conditions: ${lines(values, 'conditions').join('; ')}` : ''}. I undertake to attend court on every date until the case is finished.`,
      },
      { kind: 'para', text: 'I therefore ask to be released on bail.' },
      ...commissioner(values),
    ];
    return {
      title: 'Affidavit in support of bail',
      heading: courtHeading(values, ctx, ['State', 'Accused']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const schedule = v(values, 'schedule');
    if (schedule === 'Schedule 6' && !lines(values, 'exceptional').length) {
      issues.push({
        severity: 'must',
        field: 'exceptional',
        message:
          'For a Schedule 6 offence, the accused must prove exceptional circumstances that permit release in the interests of justice.',
        basis: 'Criminal Procedure Act s 60(11)(a)',
      });
    }
    if (schedule === 'Schedule 5') {
      issues.push({
        severity: 'note',
        field: 'schedule',
        message:
          'For a Schedule 5 offence, the accused must show that the interests of justice permit release.',
        basis: 'Criminal Procedure Act s 60(11)(b)',
      });
    }
    issues.push({
      severity: 'note',
      field: 'previous',
      message:
        'Failing to disclose previous convictions or pending charges is an offence, and the bail record may be used at trial: only include a version of the facts after careful consideration.',
      basis: 'Criminal Procedure Act s 60(11B)(a), (c), (d)',
    });
    issues.push(commissionerNote);
    return issues;
  },
};

// ------------------------------------------------------------ section 112(2) statement

export const s112Statement: DraftTemplate = {
  id: 's112-statement',
  version: VERSION,
  name: 'Section 112(2) plea statement',
  category: 'criminal',
  purpose:
    'The accused’s written statement on a plea of guilty, admitting the facts and every element of the offence.',
  basis: [
    'Criminal Procedure Act 51 of 1977 s 112(2)',
    'Criminal Law Amendment Act 105 of 1997 (minimum sentences, where they apply)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  sections: [
    {
      key: 'court',
      title: 'Court',
      fields: [
        mcCourt,
        caseNumber,
        { key: 'firstParty', label: 'The State', type: 'text', required: true },
        {
          key: 'secondParty',
          label: 'Accused',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
      ],
    },
    {
      key: 'statement',
      title: 'Statement',
      fields: [
        { key: 'charge', label: 'Charge pleaded to', type: 'longtext', required: true },
        {
          key: 'facts',
          label: 'Facts admitted, one paragraph per line',
          type: 'longtext',
          required: true,
          help: 'Date, place, what the accused did.',
        },
        {
          key: 'unlawful',
          label: 'Why the conduct was unlawful (no defence applies)',
          type: 'text',
          required: true,
        },
        {
          key: 'fault',
          label: 'Fault: intention or negligence, in the accused’s words',
          type: 'text',
          required: true,
          help: 'e.g. I knew that I was not entitled to take the goods and intended to keep them.',
        },
        {
          key: 'mitigation',
          label: 'Personal circumstances for sentence (optional), one per line',
          type: 'longtext',
        },
      ],
    },
  ],
  build(values, ctx) {
    const accused = or(v(values, 'secondParty'), 'the accused');
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `I, ${accused}, state as follows in terms of section 112(2) of the Criminal Procedure Act 51 of 1977:`,
      },
      {
        kind: 'para',
        text: `I plead guilty to the charge of ${or(v(values, 'charge'), 'charge')}`,
      },
      {
        kind: 'para',
        text: 'I understand the charge and the elements of the offence. I make this statement freely and voluntarily, while in my sound and sober senses, without having been unduly influenced or promised anything. My legal representative has explained the possible sentences to me.',
      },
      { kind: 'heading', text: 'The facts I admit' },
      ...paras(values, 'facts'),
      {
        kind: 'para',
        text: `I admit that my conduct was unlawful: ${or(v(values, 'unlawful'), 'why unlawful')}`,
      },
      { kind: 'para', text: `${or(v(values, 'fault'), 'fault')}` },
      {
        kind: 'para',
        text: 'I admit all the elements of the offence, and I have no defence to the charge.',
      },
      ...(lines(values, 'mitigation').length
        ? [
            { kind: 'heading' as const, text: 'Personal circumstances' },
            ...paras(values, 'mitigation'),
          ]
        : []),
      { kind: 'signature', lines: [`ACCUSED: ${accused}`] },
      { kind: 'signature', lines: ['LEGAL REPRESENTATIVE OF THE ACCUSED'] },
    ];
    return {
      title: 'Statement in terms of section 112(2)',
      heading: courtHeading(values, ctx, ['State', 'Accused']),
      blocks,
    };
  },
  checks(values) {
    const issues: DraftIssue[] = [];
    const fault = v(values, 'fault');
    if (
      fault &&
      !/\b(intend|intention|intended|knew|know|aware|negligen|foresaw|reconcil)/i.test(fault)
    ) {
      issues.push({
        severity: 'should',
        field: 'fault',
        message:
          'State the fault element in terms (what the accused knew and intended, or why the conduct was negligent); a statement that omits an element will not support a conviction.',
        basis: 'Criminal Procedure Act s 112(2)',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'The court must be satisfied from the statement that the accused is guilty; it may question the accused to clarify. Check whether a prescribed minimum sentence applies and that the accused understands it.',
      basis: 'Criminal Procedure Act s 112(2); Criminal Law Amendment Act 105 of 1997 s 51',
    });
    return issues;
  },
};

// ------------------------------------------------------------ representations to the prosecuting authority

export const representationsToNpa: DraftTemplate = {
  id: 'representations-to-npa',
  version: VERSION,
  name: 'Representations to the prosecuting authority',
  category: 'criminal',
  purpose:
    'Asks the prosecutor to withdraw or reduce charges, or to divert the matter, giving reasons.',
  basis: [
    'Constitution s 179 and the National Prosecuting Authority Act 32 of 1998',
    'NPA Prosecution Policy and Policy Directives',
    'Child Justice Act 75 of 2008 (diversion of children)',
  ],
  review: UNREVIEWED,
  format: LETTER_FORMAT,
  defaults: { request: 'Withdrawal of the charges' },
  sections: [
    { key: 'letter', title: 'Letter', fields: letterFields },
    {
      key: 'recipient',
      title: 'Recipient',
      fields: [
        {
          key: 'toName',
          label: 'Addressed to',
          type: 'text',
          required: true,
          help: 'e.g. The Senior Public Prosecutor, Pretoria Magistrate’s Court',
        },
        { key: 'toAddress', label: 'Address or email', type: 'longtext', required: true },
      ],
    },
    {
      key: 'matter',
      title: 'The matter',
      fields: [
        {
          key: 'clientName',
          label: 'Our client (the accused)',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        { key: 'caseRef', label: 'Court case and CAS numbers', type: 'text', required: true },
        { key: 'charges', label: 'Charges', type: 'text', required: true },
        {
          key: 'request',
          label: 'We ask for',
          type: 'choice',
          required: true,
          choices: [
            'Withdrawal of the charges',
            'Diversion',
            'Reduced or alternative charges',
            'Admission of guilt fine',
          ],
        },
        { key: 'grounds', label: 'Grounds, one per line', type: 'longtext', required: true },
        { key: 'annexures', label: 'Supporting documents, one per line', type: 'longtext' },
      ],
    },
    { key: 'sender', title: 'Signature', fields: sender },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      { kind: 'heading', text: `Representations: ${or(v(values, 'caseRef'), 'case number')}` },
      {
        kind: 'para',
        text: `We act for ${or(v(values, 'clientName'), 'our client')}, who is charged with ${or(v(values, 'charges'), 'charges')}.`,
      },
      {
        kind: 'para',
        text: `We respectfully ask for ${(v(values, 'request') || 'withdrawal of the charges').toLowerCase()}, for the following reasons:`,
      },
      ...lines(values, 'grounds').map((text) => ({ kind: 'text' as const, text: `• ${text}` })),
      ...(lines(values, 'annexures').length
        ? [{ kind: 'para' as const, text: `We attach: ${lines(values, 'annexures').join('; ')}.` }]
        : []),
      {
        kind: 'para',
        text: 'These representations are made to assist the prosecution in exercising its discretion and do not amount to an admission by our client of any fact or of guilt. Our client’s rights, including the right to remain silent, are reserved.',
      },
      {
        kind: 'para',
        text: 'We would be grateful for your decision before the next court date, and are available to discuss the matter.',
      },
      ...signOff(values, ctx.firm.legalName),
    ];
    return {
      title: 'Representations',
      letterhead: letterhead(ctx, values, [
        or(v(values, 'toName'), 'Prosecutor'),
        ...v(values, 'toAddress').split('\n').filter(Boolean),
      ]),
      blocks,
    };
  },
  checks() {
    return [
      {
        severity: 'note',
        message:
          'Do not disclose facts that could harm the defence if the representations fail; the decision is the prosecutor’s discretion under the Prosecution Policy. For a child, consider diversion under the Child Justice Act.',
        basis: 'NPA Prosecution Policy; Child Justice Act 75 of 2008',
      },
    ];
  },
};

// ------------------------------------------------------------ criminal appeal

export const criminalAppealNotice: DraftTemplate = {
  id: 'criminal-appeal-notice',
  version: VERSION,
  name: 'Application for leave to appeal and notice of appeal (criminal)',
  category: 'criminal',
  purpose:
    'Applies to the trial court for leave to appeal against conviction or sentence, stating the grounds clearly and specifically.',
  basis: [
    'Criminal Procedure Act 51 of 1977 s 309B (lower courts: within 14 days after sentence), s 309C (petition within 21 days of refusal)',
    's 316 (High Court: within 14 days after sentence)',
    'Magistrates’ Courts Rules, rule 67 (criminal appeals)',
  ],
  review: UNREVIEWED,
  format: COURT_FORMAT,
  defaults: { against: 'Conviction and sentence', trialCourt: 'Lower court' },
  sections: [
    {
      key: 'court',
      title: 'Court',
      fields: [
        { key: 'court', label: 'Trial court', type: 'text', required: true },
        caseNumber,
        { key: 'firstParty', label: 'The State', type: 'text', required: true },
        {
          key: 'secondParty',
          label: 'Accused (appellant)',
          type: 'text',
          required: true,
          prefill: 'client.name',
        },
        {
          key: 'trialCourt',
          label: 'Trial court is a',
          type: 'choice',
          required: true,
          choices: ['Lower court', 'High Court'],
        },
      ],
    },
    {
      key: 'appeal',
      title: 'The appeal',
      fields: [
        { key: 'sentenceDate', label: 'Date of sentence', type: 'date', required: true },
        { key: 'presidingOfficer', label: 'Presiding officer', type: 'text', required: true },
        { key: 'convictions', label: 'Convictions and sentence', type: 'longtext', required: true },
        {
          key: 'against',
          label: 'Appeal against',
          type: 'choice',
          required: true,
          choices: ['Conviction and sentence', 'Conviction only', 'Sentence only'],
        },
        {
          key: 'grounds',
          label: 'Grounds, one per line',
          type: 'longtext',
          required: true,
          help: 'Specific errors, e.g. "The court erred in accepting the evidence of the single witness without the caution required …"',
        },
      ],
    },
    { key: 'attorneys', title: 'Accused’s attorneys', fields: attorneysFields('accused') },
  ],
  build(values, ctx) {
    const blocks: Block[] = [
      {
        kind: 'text',
        text: `KINDLY TAKE NOTICE that the accused applies for leave to appeal against the ${(v(values, 'against') || 'conviction and sentence').toLowerCase()} imposed by ${or(v(values, 'presidingOfficer'), 'the presiding officer')} on ${longDate(v(values, 'sentenceDate')) || '[date]'}, namely ${or(v(values, 'convictions'), 'convictions and sentence')}, and, if leave is granted, notes an appeal on the following grounds:`,
      },
      ...paras(values, 'grounds'),
      {
        kind: 'text',
        text: 'The accused submits that there are reasonable prospects that another court would come to a different conclusion.',
      },
      ...attorneysBlock(values, 'accused'),
      {
        kind: 'text',
        text: `TO: THE ${v(values, 'trialCourt') === 'High Court' ? 'REGISTRAR' : 'CLERK OF THE COURT'}`,
      },
      { kind: 'text', text: 'AND TO: THE DIRECTOR OF PUBLIC PROSECUTIONS / THE PROSECUTOR' },
    ];
    return {
      title: 'Application for leave to appeal',
      heading: courtHeading(values, ctx, ['State', 'Accused']),
      blocks,
    };
  },
  checks(values, ctx) {
    const issues: DraftIssue[] = [];
    const sentence = v(values, 'sentenceDate');
    if (sentence) {
      const last = new Date(Date.parse(`${sentence}T00:00:00Z`) + 14 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (ctx.today > last) {
        issues.push({
          severity: 'must',
          field: 'sentenceDate',
          message: `The 14 days ran out on ${longDate(last)}: apply for condonation with the application, explaining the delay and the prospects of success.`,
          basis:
            v(values, 'trialCourt') === 'High Court'
              ? 'Criminal Procedure Act s 316(1)'
              : 'Criminal Procedure Act s 309B(1)(b)',
        });
      }
    }
    if (lines(values, 'grounds').some((line) => line.length < 30)) {
      issues.push({
        severity: 'should',
        field: 'grounds',
        message:
          'State each ground clearly and specifically; general grounds such as "the court erred in convicting" are not enough.',
        basis: 'Magistrates’ Courts Rules, rule 67',
      });
    }
    issues.push({
      severity: 'note',
      message:
        'If a lower court refuses leave, petition the High Court within 21 days of the refusal; if the High Court refuses, petition the SCA within the period its rules allow.',
      basis: 'Criminal Procedure Act ss 309C(2), 316',
    });
    return issues;
  },
};
