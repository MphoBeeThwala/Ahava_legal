import { addCourtDays } from '../../drafting/days';
import { unlessNegated, type StrategyCartridge } from './types';

export const family: StrategyCartridge = {
  id: 'family',
  label: 'Family law',
  forums:
    "High Court (divorce, Rule 43), Regional Courts (divorce), Magistrates' Courts (Rule 58), maintenance courts, children's courts, Office of the Family Advocate",
  burdenOfProof:
    "On a balance of probabilities; in matters about children the court acts as upper guardian and the child's best interests are paramount (Constitution s 28(2); Children's Act s 7 and s 9).",
  detect: {
    practiceArea: /family|divorce|matrimonial/i,
    keywords: [
      /\bdivorce\b|\bdecree\b|\bmarriage\b|\bmarried\b|\bspouse\b|\bhusband\b|\bwife\b/i,
      /\bmaintenance\b|\bRule 43\b|\bRule 58\b/i,
      /\bcustody\b|\bcare and contact\b|\bparenting plan\b|\bparental (rights|responsibilities)\b|\bguardianship\b/i,
      /\bchildren'?s act\b|\bfamily advocate\b|\bminor child(ren)?\b/i,
      /\baccrual\b|\bcommunity of property\b|\bantenuptial\b|\bforfeiture\b/i,
      /\bdomestic violence\b|\bprotection order\b/i,
    ],
  },
  analysis:
    'Merit items (kind "claim" or "issue") for each live issue: the divorce itself (irretrievable breakdown, Divorce Act s 4), the proprietary regime (community of property, accrual under the Matrimonial Property Act ss 3-4, out of community; redistribution under Divorce Act s 7(3) for pre-1984 marriages; forfeiture under s 9), spousal maintenance (s 7(2)), child maintenance (Maintenance Act; duty of both parents), care and contact, guardianship and relocation (Children\'s Act ss 18, 28, 30-31, 33), interim relief (Uniform Rule 43, Magistrates\' Courts Rule 58), domestic violence protection orders. Settlement or ADR path: Rule 41A mediation notice, Family Advocate involvement, parenting plans, a settlement agreement made an order of court. Litigation blueprint: pleadings, financial disclosure (financial disclosure forms where the division requires them), expert reports, trial.',
  governingStatutesAndRules: [
    {
      name: 'Divorce Act 70 of 1979',
      provisions:
        's 4 (breakdown), s 6 (children), s 7 (maintenance, redistribution, pension interests), s 9 (forfeiture)',
    },
    {
      name: 'Matrimonial Property Act 88 of 1984',
      provisions: 'ss 2-4 (accrual), s 15 (spousal consent in community of property)',
    },
    {
      name: "Children's Act 38 of 2005",
      provisions:
        's 6-7, s 9 (best interests), s 18 (parental responsibilities), s 21 (unmarried fathers), s 28, s 30-31, s 33-34 (parenting plans)',
    },
    {
      name: 'Maintenance Act 99 of 1998',
      provisions: 's 15 (duty to maintain), s 16 (orders), s 26 (enforcement)',
    },
    {
      name: 'Domestic Violence Act 116 of 1998',
      provisions: 'Protection orders and interim orders',
    },
    {
      name: 'Uniform Rules of Court',
      provisions:
        'Rule 19 (notice of intention to defend), Rule 41A (mediation notice), Rule 43 (interim relief)',
    },
    { name: "Magistrates' Courts Rules", provisions: 'Rule 58 (interim relief in divorce)' },
  ],
  verifiedPrecedents: [
    {
      authority: 'S v M (Centre for Child Law as Amicus Curiae)',
      principle:
        "The paramountcy of the child's best interests (Constitution s 28(2)) and how it shapes decisions affecting children.",
    },
    {
      authority: 'Wijker v Wijker',
      principle:
        'Forfeiture of patrimonial benefits under Divorce Act s 9: the benefit must be established before asking whether it would be undue.',
    },
    {
      authority: 'Taute v Taute',
      principle:
        'Rule 43 interim maintenance: reasonable needs of the applicant against the means of the respondent; full and frank disclosure.',
    },
  ],
  prescriptionAndDeadlineChecks: [
    {
      id: 'family.notice-to-defend',
      label: 'Notice of intention to defend the divorce summons',
      trigger: 'Date the summons was served',
      authority: 'Uniform Rule 19(1): 10 court days (16 December to 15 January not counted)',
      compute: (date) => addCourtDays(date, 10, { skipDiesNon: true }),
    },
    {
      id: 'family.rule-41a',
      label: 'Rule 41A notice on whether the party agrees to mediation',
      trigger:
        'Service of the summons (plaintiff) or the notice of intention to defend or plea (defendant)',
      authority: 'Uniform Rule 41A(2)',
    },
  ],
  tacticalGuardrails: [
    'Serve the Rule 41A mediation notice with the summons (plaintiff) and with the notice of intention to defend or plea (defendant); leaving it out invites a costs order and delay.',
    'Do not advise a parent to withhold contact or remove a child to enforce maintenance or a dispute: contact and maintenance are separate duties, and self-help harms the client in a best-interests enquiry.',
    'Rule 43 applications depend on full and frank financial disclosure; concealment destroys credibility for the trial.',
    'Check the matrimonial property regime from the marriage certificate and any antenuptial contract before advising on division of assets.',
  ],
  guardrailChecks: [
    {
      reason: 'suggested withholding contact or removing a child as leverage',
      flags: unlessNegated(
        /\b(withhold|refuse|deny|stop)\w*\b[^.;]{0,40}\bcontact\b|\bremov\w+\b[^.;]{0,30}\bchild(ren)?\b[^.;]{0,40}\b(without consent|from the province|abroad)\b/i,
      ),
    },
  ],
  standingWarnings: [
    "Children's interests are decided as the court's best-interests enquiry, not as a contest between the parents; advice should keep the client's conduct defensible in front of the Family Advocate.",
  ],
  seedQueries: [
    'Rule 43 interim maintenance',
    'forfeiture of patrimonial benefits section 9 Divorce Act',
    'best interests of the child care and contact',
    'accrual system Matrimonial Property Act',
    'Rule 41A mediation',
  ],
};
