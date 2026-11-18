import { addCalendarDays, addMonths } from '../../drafting/days';
import { unlessNegated, type StrategyCartridge } from './types';

export const labour: StrategyCartridge = {
  id: 'labour',
  label: 'Labour law',
  forums: 'CCMA, bargaining councils, Labour Court, Labour Appeal Court',
  burdenOfProof:
    'The employee must prove the dismissal (LRA s 192(1)); the employer must then prove it was fair (s 192(2)), on a balance of probabilities. Discrimination: EEA s 11.',
  detect: {
    practiceArea: /labou?r|employment|CCMA/i,
    keywords: [
      /\bdismiss(al|ed)?\b|\bretrench(ment|ed)?\b/i,
      /\bCCMA\b|\bbargaining council\b|\bLabour Court\b/i,
      /\bdisciplinary (hearing|enquiry)\b|\bmisconduct\b|\bincapacity\b/i,
      /\bemployer\b|\bemployee\b|\bemployment contract\b/i,
      /\bsection 189\b|\bs ?189A?\b|\boperational requirements\b/i,
      /\bunfair labour practice\b|\bconstructive dismissal\b|\bLRA\b|\bBCEA\b/i,
    ],
  },
  analysis:
    'Each dispute is a merit item (kind "claim"): unfair dismissal for misconduct (Schedule 8 item 7: a rule existed, was contravened, was reasonable and known, consistently applied, and dismissal was an appropriate sanction; procedural fairness item 4), incapacity (poor performance or ill health, items 8-11), operational requirements (ss 189 and 189A consultation and selection criteria), constructive dismissal (s 186(1)(e): intolerability, employer-made, no reasonable alternative), automatically unfair dismissal (s 187), unfair labour practice (s 186(2)), discrimination (EEA s 6). Forum and jurisdiction: CCMA or bargaining council arbitration versus Labour Court referral (s 191(5)). Remedies: reinstatement, re-employment, compensation caps (s 194). Settlement or ADR path: conciliation (s 135), settlement agreements made arbitration awards (s 142A), con-arb (s 191(5A)). Litigation blueprint: arbitration, review (s 145, Sidumo test), enforcement.',
  governingStatutesAndRules: [
    {
      name: 'Labour Relations Act 66 of 1995',
      provisions:
        's 186 (dismissal, unfair labour practice), s 187, s 188, s 189 and s 189A (operational requirements), s 191 (referral time limits), s 192 (onus), s 193-194 (remedies), s 145 (review), Schedule 8 (Code of Good Practice: Dismissal)',
    },
    {
      name: 'Basic Conditions of Employment Act 75 of 1997',
      provisions: 's 37 (notice), s 41 (severance pay), s 77 (jurisdiction)',
    },
    {
      name: 'Employment Equity Act 55 of 1998',
      provisions: 's 6 (unfair discrimination), s 10 (referral), s 11 (burden of proof)',
    },
    {
      name: 'CCMA Rules',
      provisions: 'Referral, condonation of late referral, set-down and rescission',
    },
    {
      name: 'Labour Court Rules',
      provisions: 'Statements of claim, review applications (rule 7A)',
    },
  ],
  verifiedPrecedents: [
    {
      authority: 'Sidumo v Rustenburg Platinum Mines',
      principle:
        'Arbitration awards are reviewable if a reasonable decision-maker could not reach them; the commissioner decides fairness, not deference to the employer.',
    },
    {
      authority: 'Gold Fields Mining SA v CCMA',
      principle:
        'Applying the Sidumo reasonableness test on review: the result must be unreasonable, not merely the reasoning.',
    },
    {
      authority: 'Steenkamp v Edcon',
      principle:
        'Non-compliance with s 189A procedures does not make a retrenchment invalid; the remedy lies in the LRA.',
    },
  ],
  prescriptionAndDeadlineChecks: [
    {
      id: 'labour.dismissal-referral',
      label: 'Refer an unfair dismissal dispute to the CCMA or bargaining council',
      trigger: "Date of dismissal (or of the employer's final decision to dismiss)",
      authority: 'LRA s 191(1)(b)(i): 30 days',
      compute: (date) => addCalendarDays(date, 30),
    },
    {
      id: 'labour.ulp-referral',
      label: 'Refer an unfair labour practice dispute',
      trigger: 'Date of the act or omission (or when the employee became aware of it)',
      authority: 'LRA s 191(1)(b)(ii): 90 days',
      compute: (date) => addCalendarDays(date, 90),
    },
    {
      id: 'labour.labour-court-referral',
      label: 'Refer the dispute to the Labour Court after conciliation fails',
      trigger: 'Date the certificate of non-resolution was issued',
      authority: 'LRA s 191(11)(a): 90 days',
      compute: (date) => addCalendarDays(date, 90),
    },
    {
      id: 'labour.review',
      label: 'Review an arbitration award',
      trigger: 'Date the award was served on the applicant',
      authority: 'LRA s 145(1)(a): six weeks',
      compute: (date) => addCalendarDays(date, 42),
    },
    {
      id: 'labour.eea-referral',
      label: 'Refer an unfair discrimination dispute to the CCMA',
      trigger: 'Date of the act or omission',
      authority: 'EEA s 10(2): six months',
      compute: (date) => addMonths(date, 6),
    },
  ],
  tacticalGuardrails: [
    'Never advise dismissal without a fair procedure (notice of the allegations, time to prepare, a hearing and a decision); for retrenchments, never skip s 189 joint consensus-seeking consultation or a s 189(3) notice.',
    'Check the 30-day and 90-day referral limits first; a late referral needs a condonation application with reasons for every day of the delay.',
    'Distinguish CCMA arbitration from Labour Court jurisdiction (s 191(5)) before referring; automatically unfair dismissals and large-scale retrenchments go to the Labour Court.',
    'Settlement agreements must be in writing and, to be enforceable as awards, made under s 142A.',
  ],
  guardrailChecks: [
    {
      reason: 'advised dismissal or retrenchment without a hearing or consultation',
      flags: unlessNegated(
        /\b(dismiss|retrench|terminate)\w*\b[^.;]{0,60}\bwithout\b[^.;]{0,30}\b(hearing|consultation|notice|procedure)\b/i,
      ),
    },
  ],
  standingWarnings: [
    'Check the referral limits (30 days for dismissal, 90 days for unfair labour practices) before anything else; a late referral needs condonation.',
  ],
  seedQueries: [
    'unfair dismissal misconduct Schedule 8',
    'section 189 consultation operational requirements',
    'review arbitration award reasonable decision-maker',
    'condonation late referral CCMA',
    'constructive dismissal intolerable',
  ],
};
