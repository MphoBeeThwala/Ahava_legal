import { addBusinessDays, addCourtDays, addMonths } from '../../drafting/days';
import { unlessNegated, type StrategyCartridge } from './types';

export const commercial: StrategyCartridge = {
  id: 'commercial',
  label: 'Commercial and civil litigation',
  forums:
    "Magistrates' Courts (district and regional civil), High Court, Small Claims Court, arbitration",
  burdenOfProof:
    "The party who asserts must prove, on a balance of probabilities; in motion proceedings, disputes of fact are decided on the respondent's version unless it is far-fetched (Plascon-Evans).",
  detect: {
    practiceArea: /commercial|civil|litigation|contract|debt/i,
    keywords: [
      /\bcontract\b|\bagreement\b|\bbreach\b|\brepudiat/i,
      /\bdebt\b|\binvoice\b|\bpayment\b|\bowe[sd]?\b|\backnowledgment of debt\b/i,
      /\bsummons\b|\bdefault judgment\b|\bsummary judgment\b|\bletter of demand\b/i,
      /\bdamages\b|\bdelict\b|\bnegligen(ce|t)\b/i,
      /\binterdict\b|\bspoliation\b|\burgent application\b/i,
      /\bsurety(ship)?\b|\bcession\b|\bliquidation\b|\bbusiness rescue\b/i,
    ],
  },
  analysis:
    'Merit items for each cause of action and defence (kind "claim" or "defence"): contract (existence and terms, breach, causation and damages, or specific performance; interpretation per Endumeni: text, context, purpose), delict (conduct, wrongfulness, fault, causation, harm), enrichment, debt recovery (NCA ss 129-130 notices for credit agreements), interdicts (clear right, injury, no alternative remedy), spoliation. Consider prescription, jurisdiction and the forum (monetary limits), and costs. Settlement or ADR path: letter of demand, without-prejudice offers, Rule 41A mediation, arbitration clauses. Litigation or execution blueprint: summons or motion, summary judgment (Rule 32), discovery, trial, warrant of execution, garnishee orders.',
  governingStatutesAndRules: [
    {
      name: 'Prescription Act 68 of 1969',
      provisions:
        's 10-11 (3 years for most debts), s 12 (when prescription begins; knowledge), s 13 (delay), s 14-15 (interruption)',
    },
    {
      name: 'Institution of Legal Proceedings against Certain Organs of State Act 40 of 2002',
      provisions: 's 3 (written notice within six months), s 3(4) (condonation)',
    },
    {
      name: 'National Credit Act 34 of 2005',
      provisions: 's 129-130 (notice before enforcement), s 86 (debt review)',
    },
    {
      name: 'Consumer Protection Act 68 of 2008',
      provisions: 'ss 48-51 (unfair terms), s 14 (fixed-term agreements)',
    },
    {
      name: 'Conventional Penalties Act 15 of 1962',
      provisions: 's 3 (reducing excessive penalties)',
    },
    {
      name: 'Uniform Rules of Court',
      provisions:
        'Rule 6 (applications), Rule 17-22 (summons, defend, plea), Rule 32 (summary judgment), Rule 35 (discovery), Rule 41A (mediation), Rule 49 (leave to appeal)',
    },
    {
      name: "Magistrates' Courts Act 32 of 1944 and Rules",
      provisions: 's 29 (jurisdiction), s 57-58 (consent to judgment), s 65A (financial enquiry)',
    },
  ],
  verifiedPrecedents: [
    {
      authority: 'Plascon-Evans Paints v Van Riebeeck Paints',
      principle:
        "Final relief on motion: disputes of fact are decided on the respondent's version unless it is untenable.",
    },
    {
      authority: 'Natal Joint Municipal Pension Fund v Endumeni Municipality',
      principle: 'Interpretation of documents: text, context and purpose read together.',
    },
    {
      authority: 'Barkhuizen v Napier',
      principle:
        'Contract terms against public policy; time-bar clauses and fairness of enforcement.',
    },
    {
      authority: 'Beadica 231 CC v Trustees, Oregon Trust',
      principle:
        'Good faith and fairness do not on their own let a court refuse to enforce a valid term; pacta sunt servanda.',
    },
    {
      authority: 'Truter v Deysel',
      principle: 'Prescription runs from knowledge of the facts, not of their legal consequences.',
    },
    {
      authority: 'Sebola v Standard Bank',
      principle:
        'A credit provider must show that the s 129 notice reached the consumer before enforcing.',
    },
  ],
  prescriptionAndDeadlineChecks: [
    {
      id: 'commercial.prescription',
      label: 'Prescription of an ordinary debt',
      trigger: 'Date the debt became due (and the creditor knew the debtor and the facts)',
      authority:
        'Prescription Act s 11(d) and s 12: three years (check delay under s 13 and interruption)',
      compute: (date) => addMonths(date, 36),
    },
    {
      id: 'commercial.organ-of-state-notice',
      label: 'Notice to an organ of state before suing',
      trigger: 'Date the debt became due',
      authority: 'Act 40 of 2002 s 3(2)(a): within six months',
      compute: (date) => addMonths(date, 6),
    },
    {
      id: 'commercial.notice-to-defend',
      label: 'Notice of intention to defend',
      trigger: 'Date the summons was served',
      authority: 'Uniform Rule 19(1): 10 court days (16 December to 15 January not counted)',
      compute: (date) => addCourtDays(date, 10, { skipDiesNon: true }),
    },
    {
      id: 'commercial.summary-judgment',
      label: 'Application for summary judgment',
      trigger: 'Date the plea was delivered',
      authority: 'Uniform Rule 32(2)(a): within 15 days after delivery of the plea',
      compute: (date) => addCourtDays(date, 15, { skipDiesNon: true }),
    },
    {
      id: 'commercial.nca-section-129',
      label: 'Wait after a s 129 notice before issuing summons',
      trigger: 'Date the s 129 notice was delivered',
      authority: 'National Credit Act s 130(1)(a): at least 10 business days',
      compute: (date) => addBusinessDays(date, 10),
    },
  ],
  tacticalGuardrails: [
    'Check prescription and any contractual time-bar clause before advising on the merits; a demand alone does not interrupt prescription (service of process does, s 15).',
    'Do not issue summons on a credit agreement before a compliant s 129 notice and the s 130 waiting period.',
    'Choose motion proceedings only where no real dispute of fact is foreseeable; otherwise the application may be dismissed with costs.',
    'Serve the Rule 41A mediation notice with the summons or application, and with the notice of intention to defend or oppose.',
  ],
  guardrailChecks: [
    {
      reason: 'said a letter of demand interrupts prescription',
      flags: unlessNegated(
        /\b(letter of )?demand\b[^.;]{0,40}\binterrupt\w*\b[^.;]{0,20}\bprescription\b/i,
      ),
    },
  ],
  standingWarnings: [
    'Confirm prescription dates (Prescription Act s 11-12) and any contractual time-bar before relying on the merits.',
  ],
  seedQueries: [
    'prescription knowledge of facts section 12',
    'breach of contract damages',
    'summary judgment bona fide defence',
    'disputes of fact motion proceedings',
    'interpretation of contracts text context purpose',
  ],
};
