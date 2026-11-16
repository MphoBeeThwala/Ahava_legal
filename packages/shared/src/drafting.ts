// Document drafting (roadmap 15a): the catalogue of document kinds used in
// South African legal practice, and the shapes the API and web app share.
//
// Every kind is listed, so staff can see what exists and what it is for.
// Kinds with a standard template can be drafted now; the others are
// "planned" until a template is written and reviewed. See
// docs/drafting/catalogue.md for the research behind each entry.

export type DraftingCategory =
  | 'correspondence'
  | 'engagement'
  | 'high_court'
  | 'magistrates_court'
  | 'affidavits'
  | 'labour'
  | 'criminal'
  | 'family'
  | 'property'
  | 'estates'
  | 'commercial'
  | 'practice';

export const DRAFTING_CATEGORIES: Record<DraftingCategory, string> = {
  correspondence: 'Letters and statutory notices',
  engagement: 'Mandates, fees and powers of attorney',
  high_court: 'High Court (Uniform Rules)',
  magistrates_court: "Magistrates' Courts",
  affidavits: 'Affidavits and oaths',
  labour: 'Labour (CCMA, bargaining councils, Labour Court)',
  criminal: 'Criminal',
  family: 'Family and children',
  property: 'Property and conveyancing',
  estates: 'Wills and deceased estates',
  commercial: 'Commercial and corporate',
  practice: 'Practice and file management',
};

export interface DraftingKind {
  /** Stable id; also the template id when a template exists. */
  id: string;
  category: DraftingCategory;
  name: string;
  /** What the document is for, in one sentence. */
  purpose: string;
  /** Where it is used: court, forum or office. */
  forum: string;
  /** The rule, Act or practice it must meet. */
  basis: string[];
  /** 'template': can be drafted now; 'planned': listed, template not written yet. */
  availability: 'template' | 'planned';
}

const k = (
  id: string,
  category: DraftingCategory,
  name: string,
  purpose: string,
  forum: string,
  basis: string[],
  availability: DraftingKind['availability'] = 'planned',
): DraftingKind => ({ id, category, name, purpose, forum, basis, availability });

export const DRAFTING_CATALOGUE: readonly DraftingKind[] = [
  // ------------------------------------------------------------ correspondence
  k(
    'letter-of-demand',
    'correspondence',
    'Letter of demand',
    'Demands payment or performance by a date before proceedings are issued; interrupts nothing by itself but sets up costs and mora.',
    'Correspondence',
    ['Common law (mora, demand)', 'Prescription Act 68 of 1969 (time limits to watch)'],
    'template',
  ),
  k(
    'nca-s129-notice',
    'correspondence',
    'Section 129(1)(a) default notice (NCA)',
    'Draws a consumer’s default to their attention and proposes debt counselling, ADR or a plan, before a credit agreement is enforced.',
    'Credit provider to consumer',
    [
      'National Credit Act 34 of 2005 ss 129(1)(a), 130(1)',
      'Sebola v Standard Bank [2012] ZACC 11; Kubyana v Standard Bank [2014] ZACC 1 (delivery)',
    ],
    'template',
  ),
  k(
    'organ-of-state-s3-notice',
    'correspondence',
    'Notice of intended legal proceedings to an organ of state',
    'Gives an organ of state the notice required before a debt (damages) claim may be instituted against it.',
    'Claimant to organ of state',
    ['Institution of Legal Proceedings against certain Organs of State Act 40 of 2002 ss 3, 4'],
    'template',
  ),
  k(
    'without-prejudice-offer',
    'correspondence',
    'Without-prejudice settlement offer',
    'Proposes settlement without the offer being used as an admission.',
    'Correspondence',
    [
      'Common law privilege for settlement negotiations',
      'Uniform Rule 34 (offers to settle in court)',
    ],
  ),
  k(
    'notice-of-breach',
    'correspondence',
    'Notice of breach and cancellation',
    'Places a party on terms to remedy a breach, and cancels the agreement if it is not remedied.',
    'Correspondence',
    [
      'The agreement’s breach clause',
      'Common law (lex commissoria, mora)',
      'Consumer Protection Act 68 of 2008 s 14 (fixed-term consumer agreements)',
    ],
  ),
  k(
    'reporting-letter',
    'correspondence',
    'Reporting letter to client',
    'Reports progress, advice and next steps to the client.',
    'Attorney to client',
    ['LPC Code of Conduct (duty to keep the client informed)'],
  ),

  // ------------------------------------------------------------ engagement
  k(
    'mandate-fee-agreement',
    'engagement',
    'Mandate and fee agreement',
    'Records the client’s instructions, the scope of the mandate and how fees and disbursements are charged, with the fee estimate.',
    'Attorney and client',
    [
      'Legal Practice Act 28 of 2014 s 35(7) (cost estimate on first instruction)',
      'LPC Code of Conduct',
    ],
    'template',
  ),
  k(
    'contingency-fees-agreement',
    'engagement',
    'Contingency fees agreement',
    'A no-win-no-fee agreement in the prescribed form.',
    'Attorney and client',
    [
      'Contingency Fees Act 66 of 1997 ss 2, 3 (writing, prescribed form, signed by client)',
      'LPC rules under s 6 of that Act',
    ],
  ),
  k(
    'special-power-of-attorney',
    'engagement',
    'Special power of attorney',
    'Authorises an agent to perform a specific act on the principal’s behalf.',
    'Principal to agent',
    ['Common law of agency', 'Uniform Rule 7 (authority to act in litigation)'],
    'template',
  ),
  k(
    'general-power-of-attorney',
    'engagement',
    'General power of attorney',
    'Authorises an agent to act generally for the principal; ends on the principal’s mental incapacity or death.',
    'Principal to agent',
    ['Common law of agency'],
  ),
  k(
    'bill-of-costs',
    'engagement',
    'Bill of costs',
    'Sets out costs item by item for taxation by the taxing master.',
    'Taxing master',
    ['Uniform Rule 70 and tariff', "Magistrates' Courts Rules tariff"],
  ),

  // ------------------------------------------------------------ High Court
  k(
    'notice-of-motion',
    'high_court',
    'Notice of motion (ordinary application)',
    'Starts an opposed or unopposed application on affidavit, telling the respondent how and when to oppose.',
    'High Court',
    [
      'Uniform Rule 6(5); Form 2(a)',
      'Uniform Rule 62 (form of documents)',
      'Divisional practice directives (e.g. Gauteng Consolidated Practice Directive 1 of 2024)',
    ],
    'template',
  ),
  k(
    'ex-parte-notice-of-motion',
    'high_court',
    'Ex parte notice of motion',
    'Starts an application where no other party is cited or notice is not required.',
    'High Court',
    ['Uniform Rule 6(4); Form 2'],
  ),
  k(
    'urgent-application',
    'high_court',
    'Urgent application',
    'Brings an application on truncated time limits, with the grounds of urgency set out explicitly.',
    'High Court',
    ['Uniform Rule 6(12)', 'Divisional urgent court directives'],
  ),
  k(
    'founding-affidavit',
    'high_court',
    'Founding affidavit',
    'Sets out the facts and evidence on which an application stands.',
    'High Court',
    [
      'Uniform Rule 6(1)',
      'Regulations under the Justices of the Peace and Commissioners of Oaths Act (GN R1258 of 1972)',
    ],
  ),
  k(
    'answering-affidavit',
    'high_court',
    'Answering affidavit',
    'The respondent’s answer to the founding affidavit, paragraph by paragraph.',
    'High Court',
    ['Uniform Rule 6(5)(d)(ii)'],
  ),
  k(
    'replying-affidavit',
    'high_court',
    'Replying affidavit',
    'The applicant’s reply, confined to answering new matter.',
    'High Court',
    ['Uniform Rule 6(5)(e)'],
  ),
  k(
    'combined-summons',
    'high_court',
    'Combined summons with particulars of claim',
    'Starts an action for an unliquidated claim, with the particulars of claim attached.',
    'High Court',
    ['Uniform Rules 17, 18; Form 10'],
  ),
  k(
    'simple-summons',
    'high_court',
    'Simple summons',
    'Starts an action for a debt or liquidated demand.',
    'High Court',
    ['Uniform Rule 17(2)(b); Form 9'],
  ),
  k(
    'notice-of-intention-to-defend',
    'high_court',
    'Notice of intention to defend',
    'Records that the defendant will defend the action.',
    'High Court',
    ['Uniform Rule 19'],
  ),
  k(
    'plea',
    'high_court',
    'Plea',
    'Admits, denies or confesses and avoids each allegation in the particulars of claim.',
    'High Court',
    ['Uniform Rules 18, 22'],
  ),
  k(
    'exception',
    'high_court',
    'Exception',
    'Objects that a pleading is vague and embarrassing or discloses no cause of action or defence.',
    'High Court',
    ['Uniform Rule 23'],
  ),
  k(
    'rule-30-notice',
    'high_court',
    'Notice of irregular step',
    'Gives notice to remove the cause of complaint about an irregular step.',
    'High Court',
    ['Uniform Rule 30'],
  ),
  k(
    'notice-of-bar',
    'high_court',
    'Notice of bar',
    'Calls on a party to deliver a pleading within five days or be barred.',
    'High Court',
    ['Uniform Rule 26'],
  ),
  k(
    'discovery-affidavit',
    'high_court',
    'Discovery affidavit and notices',
    'Lists the documents a party has, with notices to discover, inspect and produce.',
    'High Court',
    ['Uniform Rule 35'],
  ),
  k(
    'rule-41a-notice',
    'high_court',
    'Rule 41A mediation notice',
    'States whether the party agrees to refer the dispute to mediation.',
    'High Court',
    ['Uniform Rule 41A'],
  ),
  k(
    'pre-trial-minute',
    'high_court',
    'Pre-trial conference minute',
    'Records what was agreed and what remains in dispute before trial.',
    'High Court',
    ['Uniform Rule 37', 'Divisional practice directives'],
  ),
  k(
    'heads-of-argument',
    'high_court',
    'Heads of argument',
    'Sets out the party’s argument concisely, with authorities.',
    'High Court',
    ['Divisional practice directives (format, filing times, CaseLines)'],
  ),
  k(
    'practice-note',
    'high_court',
    'Practice note',
    'Summarises the parties, the issues, the duration and urgency for the judge.',
    'High Court',
    ['Divisional practice directives'],
  ),
  k(
    'draft-order',
    'high_court',
    'Draft order',
    'The order the party asks the court to make, ready to sign.',
    'High Court',
    ['Divisional practice directives'],
  ),
  k(
    'index-and-pagination',
    'high_court',
    'Index and paginated bundle',
    'Indexes and paginates the court file for the hearing (CaseLines).',
    'High Court',
    [
      'Gauteng directive on indexing and pagination of bundles (2025)',
      'Consolidated Practice Directive 1 of 2024 para 7',
    ],
  ),
  k(
    'notice-of-set-down',
    'high_court',
    'Notice of set down',
    'Gives notice of the date a matter is enrolled for hearing.',
    'High Court',
    ['Uniform Rules 6(5)(f), 39'],
  ),
  k(
    'leave-to-appeal',
    'high_court',
    'Application for leave to appeal',
    'Asks for leave to appeal, stating the grounds.',
    'High Court / SCA',
    ['Superior Courts Act 10 of 2013 s 17', 'Uniform Rule 49'],
  ),
  k(
    'settlement-agreement-order',
    'high_court',
    'Settlement agreement (made an order of court)',
    'Records a settlement and asks for it to be made an order of court.',
    'High Court',
    ['Common law; Eke v Parsons [2015] ZACC 30'],
  ),

  // ------------------------------------------------------------ Magistrates' Courts
  k(
    'mc-summons',
    'magistrates_court',
    "Summons (Magistrates' Court)",
    "Starts an action in the Magistrates' Court.",
    "Magistrates' Court",
    ["Magistrates' Courts Rules rule 5 and Annexure 1 forms", 'Rule 63 (filing, A4, one side)'],
  ),
  k(
    'mc-application',
    'magistrates_court',
    "Application (Magistrates' Court)",
    'Starts an application on affidavit.',
    "Magistrates' Court",
    ["Magistrates' Courts Rules rule 55"],
  ),
  k(
    'mc-plea',
    'magistrates_court',
    "Plea (Magistrates' Court)",
    'Answers the summons and particulars of claim.',
    "Magistrates' Court",
    ["Magistrates' Courts Rules rule 17"],
  ),
  k(
    'section-65-documents',
    'magistrates_court',
    'Section 65A financial enquiry documents',
    'Calls a judgment debtor to an enquiry into their financial position.',
    "Magistrates' Court",
    ["Magistrates' Courts Act 32 of 1944 s 65A"],
  ),

  // ------------------------------------------------------------ affidavits
  k(
    'affidavit',
    'affidavits',
    'Affidavit',
    'A sworn or affirmed written statement of facts within the deponent’s knowledge.',
    'Any court, forum or office',
    [
      'Justices of the Peace and Commissioners of Oaths Act 16 of 1963',
      'Regulations GN R1258 of 21 July 1972 (regs 1–4: oath or affirmation, signing in the commissioner’s presence, certificate)',
    ],
    'template',
  ),
  k(
    'confirmatory-affidavit',
    'affidavits',
    'Confirmatory affidavit',
    'Confirms the contents of another deponent’s affidavit insofar as they relate to the confirming deponent.',
    'Any court',
    ['GN R1258 of 1972'],
  ),
  k(
    'certification-of-copies',
    'affidavits',
    'Certification of copies',
    'Certifies a copy as a true copy of the original.',
    'Commissioner of oaths',
    ['Justices of the Peace and Commissioners of Oaths Act 16 of 1963'],
  ),

  // ------------------------------------------------------------ labour
  k(
    'lra-7-11-referral',
    'labour',
    'Referral to the CCMA for conciliation (LRA Form 7.11)',
    'Refers a dispute to conciliation; dismissals within 30 days, unfair labour practices within 90 days.',
    'CCMA / bargaining council',
    ['Labour Relations Act 66 of 1995 s 191', 'CCMA Rules (referral, service, signature)'],
  ),
  k(
    'lra-7-13-arbitration',
    'labour',
    'Request for arbitration (LRA Form 7.13)',
    'Asks for arbitration after conciliation fails.',
    'CCMA / bargaining council',
    ['Labour Relations Act s 191(5)', 'CCMA Rules'],
  ),
  k(
    'condonation-application',
    'labour',
    'Condonation application',
    'Explains a late referral: degree of lateness, reasons, prospects of success and prejudice.',
    'CCMA / Labour Court',
    ['CCMA Rules', 'Labour Court Rules 2024'],
  ),
  k(
    'labour-court-statement-of-claim',
    'labour',
    'Statement of claim (Labour Court)',
    'Starts a referral for adjudication in the Labour Court.',
    'Labour Court',
    ['Labour Court Rules 2024, Form 1'],
  ),
  k(
    'disciplinary-notice',
    'labour',
    'Notice of disciplinary hearing and outcome',
    'Notifies an employee of allegations and a hearing, and records the outcome.',
    'Employer',
    ['Labour Relations Act Schedule 8 (Code of Good Practice: Dismissal)'],
  ),
  k(
    's189-notice',
    'labour',
    'Section 189(3) notice (retrenchment)',
    'Invites consultation on possible dismissals for operational requirements, with the prescribed disclosures.',
    'Employer',
    ['Labour Relations Act s 189(3)'],
  ),
  k(
    'employment-contract',
    'labour',
    'Employment contract',
    'Records the terms of employment, including the particulars the BCEA requires.',
    'Employer and employee',
    ['Basic Conditions of Employment Act 75 of 1997 s 29'],
  ),

  // ------------------------------------------------------------ criminal
  k(
    'bail-affidavit',
    'criminal',
    'Bail application affidavit',
    'Sets out the accused’s circumstances for bail, addressing the statutory factors.',
    'Criminal court',
    ['Criminal Procedure Act 51 of 1977 s 60'],
  ),
  k(
    's112-statement',
    'criminal',
    'Section 112(2) plea statement',
    'A written statement setting out the facts the accused admits on a guilty plea.',
    'Criminal court',
    ['Criminal Procedure Act s 112(2)'],
  ),
  k(
    'representations-to-npa',
    'criminal',
    'Representations to the prosecuting authority',
    'Asks the prosecution to withdraw or reduce charges, giving reasons.',
    'NPA',
    ['National Prosecuting Authority Act 32 of 1998', 'NPA prosecution policy'],
  ),
  k(
    'criminal-appeal-notice',
    'criminal',
    'Notice of appeal (criminal)',
    'Appeals a conviction or sentence, stating the grounds.',
    'High Court',
    ['Criminal Procedure Act ss 309, 316'],
  ),

  // ------------------------------------------------------------ family
  k(
    'divorce-summons',
    'family',
    'Divorce summons and particulars of claim',
    'Starts divorce proceedings, with the relief claimed.',
    'High Court / Regional Court',
    ['Divorce Act 70 of 1979', 'Uniform Rule 17; Magistrates’ Courts Rules'],
  ),
  k(
    'divorce-settlement',
    'family',
    'Divorce settlement agreement',
    'Records the division of assets, maintenance and care arrangements, to be made an order of court.',
    'High Court / Regional Court',
    ['Divorce Act s 7', 'Children’s Act 38 of 2005 s 6 (best interests)'],
  ),
  k(
    'parenting-plan',
    'family',
    'Parenting plan',
    'Sets out how co-holders of parental responsibilities will exercise them.',
    'Family Advocate / court',
    ['Children’s Act 38 of 2005 ss 33, 34'],
  ),
  k(
    'antenuptial-contract',
    'family',
    'Antenuptial contract',
    'Sets the matrimonial property regime before marriage; executed before a notary and registered.',
    'Notary / Deeds Office',
    [
      'Matrimonial Property Act 88 of 1984',
      'Deeds Registries Act 47 of 1937 s 87 (registration within three months)',
    ],
  ),
  k(
    'maintenance-complaint',
    'family',
    'Maintenance complaint',
    'Asks the maintenance court for a maintenance order.',
    'Maintenance court',
    ['Maintenance Act 99 of 1998 and its prescribed forms'],
  ),

  // ------------------------------------------------------------ property
  k(
    'deed-of-sale',
    'property',
    'Deed of sale (immovable property)',
    'Sells land; must be in writing and signed by the parties or their agents on written authority.',
    'Seller and purchaser',
    ['Alienation of Land Act 68 of 1981 s 2(1)'],
  ),
  k(
    'residential-lease',
    'property',
    'Residential lease',
    'Records the terms of a residential lease, including the deposit, inspections and the standard provisions.',
    'Landlord and tenant',
    ['Rental Housing Act 50 of 1999 s 5', 'Consumer Protection Act 68 of 2008 s 14'],
  ),
  k(
    'commercial-lease',
    'property',
    'Commercial lease',
    'Records the terms of a commercial lease.',
    'Landlord and tenant',
    [
      'Common law of lease',
      'Formalities in respect of Leases of Land Act 18 of 1969 (long leases)',
    ],
  ),
  k(
    'poa-to-pass-transfer',
    'property',
    'Power of attorney to pass transfer',
    'Authorises the conveyancer to appear before the Registrar of Deeds and pass transfer.',
    'Deeds Office',
    [
      'Deeds Registries Act 47 of 1937 s 20',
      'Deeds Registries Regulations 44, 44A (preparation certificate)',
    ],
  ),
  k(
    'deed-of-transfer',
    'property',
    'Deed of transfer',
    'Transfers ownership of land, in the prescribed form, prepared and certified by a conveyancer.',
    'Deeds Office',
    [
      'Deeds Registries Act ss 15, 15A',
      'Regulations 26, 29 (extent in words and figures), 43 (preparation certificate with LPC number); prescribed Form E',
    ],
  ),
  k(
    'mortgage-bond',
    'property',
    'Mortgage bond',
    'Registers a bond over land as security for a debt.',
    'Deeds Office',
    ['Deeds Registries Act s 50', 'Regulation 43'],
  ),
  k(
    'notarial-deed-servitude',
    'property',
    'Notarial deed of servitude',
    'Creates a servitude over land, executed before a notary and registered.',
    'Notary / Deeds Office',
    ['Deeds Registries Act s 65'],
  ),

  // ------------------------------------------------------------ estates
  k(
    'last-will',
    'estates',
    'Last will and testament',
    'Sets out how a person’s estate is to be distributed and who administers it.',
    'Testator',
    [
      'Wills Act 7 of 1953 s 2(1)(a) (signing and witnessing), s 4A (witness or spouse as beneficiary)',
    ],
    'template',
  ),
  k(
    'codicil',
    'estates',
    'Codicil',
    'Amends an existing will, executed with the same formalities.',
    'Testator',
    ['Wills Act 7 of 1953 s 2(1)(a)'],
  ),
  k(
    'estate-reporting',
    'estates',
    'Reporting a deceased estate (Master’s forms)',
    'Reports the estate to the Master: death notice, inventory, acceptance of trust as executor.',
    'Master of the High Court',
    ['Administration of Estates Act 66 of 1965 ss 7, 9', "Master's prescribed forms"],
  ),
  k(
    'liquidation-account',
    'estates',
    'Liquidation and distribution account',
    'Accounts for the administration of the estate, for the Master and inspection.',
    'Master of the High Court',
    ['Administration of Estates Act s 35'],
  ),

  // ------------------------------------------------------------ commercial
  k(
    'acknowledgment-of-debt',
    'commercial',
    'Acknowledgment of debt',
    'Records a debtor’s admission of a debt and the terms of repayment.',
    'Creditor and debtor',
    [
      'Common law',
      'Prescription Act s 14 (acknowledgment interrupts prescription)',
      'National Credit Act where it applies',
    ],
  ),
  k(
    'suretyship',
    'commercial',
    'Deed of suretyship',
    'A surety binds themselves for another’s debt; must be in writing and signed by the surety.',
    'Creditor and surety',
    ['General Law Amendment Act 50 of 1956 s 6'],
  ),
  k(
    'nda',
    'commercial',
    'Confidentiality agreement',
    'Protects confidential information shared between parties.',
    'Contracting parties',
    ['Common law of contract', 'POPIA where personal information is shared'],
  ),
  k(
    'service-agreement',
    'commercial',
    'Service agreement',
    'Records the terms on which services are supplied.',
    'Contracting parties',
    ['Common law of contract', 'Consumer Protection Act 68 of 2008 where it applies'],
  ),
  k(
    'shareholders-agreement',
    'commercial',
    "Shareholders' agreement",
    "Regulates the shareholders' relationship, consistent with the company's MOI.",
    'Shareholders',
    ['Companies Act 71 of 2008 s 15(7) (consistency with the MOI)'],
  ),
  k(
    'company-resolution',
    'commercial',
    'Board or shareholders’ resolution',
    'Records a decision of the board or the shareholders.',
    'Company',
    ['Companies Act 71 of 2008 ss 60, 65, 73, 74'],
  ),
  k(
    'cession',
    'commercial',
    'Deed of cession',
    'Transfers a right (e.g. book debts) from cedent to cessionary, outright or as security.',
    'Cedent and cessionary',
    ['Common law of cession'],
  ),

  // ------------------------------------------------------------ practice
  k(
    'file-note',
    'practice',
    'File and attendance note',
    'Records an attendance, call or instruction on the file, with the time spent.',
    'Internal',
    ['LPC Code of Conduct (record keeping)'],
  ),
  k(
    'statement-of-account',
    'practice',
    'Statement of account',
    'Shows the client fees, disbursements, payments and the balance.',
    'Attorney to client',
    ['Legal Practice Act s 35', 'LPC rules on accounting'],
  ),
];

export type DraftStatus = 'draft' | 'review' | 'final';

export type DraftFieldType =
  'text' | 'longtext' | 'date' | 'money' | 'id_number' | 'number' | 'choice';

export interface DraftField {
  key: string;
  label: string;
  type: DraftFieldType;
  required?: boolean;
  help?: string;
  choices?: string[];
  /** Filled from the matter when the draft is created. */
  prefill?:
    | 'client.name'
    | 'client.idNumber'
    | 'client.email'
    | 'client.phone'
    | 'client.address'
    | 'matter.caseNumber'
    | 'matter.title'
    | 'firm.legalName'
    | 'firm.address'
    | 'firm.email'
    | 'firm.phone'
    | 'today';
}

export interface DraftSection {
  key: string;
  title: string;
  fields: DraftField[];
}

/** Format rules the generated document follows. */
export interface DraftFormat {
  paper: 'A4';
  fontSizePt: number;
  lineSpacing: number;
  /** Millimetres: top, right, bottom, left. */
  marginsMm: [number, number, number, number];
  numberedParagraphs: boolean;
  pageNumbers: boolean;
  /** Court heading with case number and parties. */
  courtHeading: boolean;
}

export interface DraftTemplateSummary {
  id: string;
  version: string;
  name: string;
  category: DraftingCategory;
  purpose: string;
  basis: string[];
  /** 'unreviewed' until an admitted attorney signs off the standard wording. */
  review: { status: 'unreviewed' | 'reviewed'; by?: string; on?: string };
  format: DraftFormat;
  sections: DraftSection[];
}

export type IssueSeverity = 'must' | 'should' | 'note';

export interface DraftIssue {
  severity: IssueSeverity;
  /** The field it concerns, if any (the editor jumps to it). */
  field?: string;
  message: string;
  /** The rule, Act or practice it comes from. */
  basis?: string;
}

export interface Draft {
  id: string;
  caseNumber: string;
  templateId: string;
  templateVersion: string;
  title: string;
  status: DraftStatus;
  values: Record<string, string>;
  issues: DraftIssue[];
  /** The document as plain text (the preview). */
  preview: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  submittedAt: string | null;
  finalisedAt: string | null;
  finalisedBy: string | null;
  /** The matter document saved when the draft was finalised. */
  documentId: string | null;
}

export interface DraftingCatalogue {
  categories: Record<DraftingCategory, string>;
  kinds: DraftingKind[];
  templates: DraftTemplateSummary[];
}
