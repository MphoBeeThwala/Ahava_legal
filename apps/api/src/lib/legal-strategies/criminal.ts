import { addCalendarDays } from '../../drafting/days';
import { unlessNegated, type StrategyCartridge } from './types';

export const criminal: StrategyCartridge = {
  id: 'criminal',
  label: 'Criminal law',
  forums:
    "Magistrates' Courts (district and regional), High Court; bail court; Senior Public Prosecutor (representations)",
  burdenOfProof:
    'The State must prove every element beyond reasonable doubt; the accused is acquitted if his version is reasonably possibly true.',
  detect: {
    practiceArea: /criminal/i,
    keywords: [
      /\bcharged?\b|\bcharge sheet\b|\bJ15\b/i,
      /\bbail\b/i,
      /\barrest(ed)?\b/i,
      /\bSAPS\b|\bpolice\b|\binvestigating officer\b|\bdocket\b/i,
      /\baccused\b|\bcomplainant\b|\bprosecutor\b|\bNPA\b/i,
      /\bassault\b|\btheft\b|\brobbery\b|\bfraud\b|\bmurder\b|\brape\b|\bhousebreaking\b/i,
      /\bJ88\b|\bwarning statement\b|\bremand(ed)?\b/i,
    ],
  },
  analysis:
    'Treat every count on the charge sheet as a merit item (kind "charge"). Elements: conduct (actus reus), unlawfulness (grounds of justification such as private defence), criminal capacity, and fault (dolus or culpa); identify defences, competent verdicts under CPA ss 256-270 (for example common assault on assault GBH) and sentencing exposure (Criminal Law Amendment Act 105 of 1997 minimum sentences; the trial court\'s jurisdiction). Procedural issues are merit items of kind "issue": search and seizure (CPA s 20, s 22(a) and (b)), exclusion of evidence (Constitution s 35(5)), the right to silence (s 35(1)), confessions and admissions (CPA s 217, s 219A; an unsigned warning statement is not an alleged spontaneous oral admission), the single witness cautionary rule (CPA s 208), intoxicated witnesses, and bail conditions (CPA s 60, s 68). Settlement or ADR path: written representations to the Senior Public Prosecutor after docket disclosure (withdrawal, lesser charge, diversion, mediation) and s 105A plea and sentence agreements. Litigation blueprint: cross-examination and the foundation for a s 174 discharge.',
  governingStatutesAndRules: [
    {
      name: 'Criminal Procedure Act 51 of 1977',
      provisions:
        's 20, s 22 (search without warrant), s 50 (first appearance), s 60 (bail), s 68 (cancelling bail), s 105A (plea and sentence agreements), s 174 (discharge), s 208 (single witness), s 217 (confessions), s 219A (admissions), ss 256-270 (competent verdicts), s 309B and s 316 (leave to appeal)',
    },
    {
      name: 'Constitution of the Republic of South Africa, 1996',
      provisions:
        's 35(1) (arrested persons, right to silence), s 35(3) (fair trial), s 35(5) (exclusion of evidence)',
    },
    {
      name: 'Criminal Law Amendment Act 105 of 1997',
      provisions: 's 51 and Schedule 2 (minimum sentences)',
    },
    { name: "Magistrates' Courts Act 32 of 1944", provisions: 's 92 (penal jurisdiction)' },
  ],
  verifiedPrecedents: [
    {
      authority: 'S v Trainor',
      principle: 'Private defence: the objective test and proportionality of the force used.',
    },
    {
      authority: 'Ex parte Minister van Justisie: In re S v Van Wyk',
      principle:
        'Private defence may justify killing in defence of property; the limits of proportionality.',
    },
    {
      authority: 'S v De Blom',
      principle: 'Ignorance or mistake of law, and genuine mistake, may exclude intention.',
    },
    {
      authority: 'S v Chretien',
      principle: 'Voluntary intoxication may exclude capacity or intention.',
    },
    {
      authority: 'S v Tandwa',
      principle: 'Exclusion of unconstitutionally obtained evidence under s 35(5).',
    },
    {
      authority: 'S v Pillay',
      principle:
        'Admitting evidence obtained in breach of rights: fairness and the administration of justice under s 35(5).',
    },
  ],
  prescriptionAndDeadlineChecks: [
    {
      id: 'criminal.leave-to-appeal',
      label: 'Application for leave to appeal',
      trigger: 'Date of sentence (or conviction, if sentence followed on the same day)',
      authority: 'CPA s 309B (lower courts) and s 316 (High Court): 14 days',
      compute: (date) => addCalendarDays(date, 14),
    },
    {
      id: 'criminal.first-appearance',
      label: 'First court appearance after arrest',
      trigger: 'Time of arrest',
      authority: 'Constitution s 35(1)(d); CPA s 50: not later than 48 hours',
    },
  ],
  tacticalGuardrails: [
    'Never recommend that a charged or bailed client give a police warning statement, affidavit or any statement to SAPS before full docket disclosure; written representations to the prosecutor after disclosure are a separate, strategic step.',
    'Never call a warrantless search at the scene of a violent crime unlawful merely for want of consent without first analysing reasonable grounds under CPA s 22(b).',
    'The client must not contact State witnesses; before anyone approaches an eyewitness, check whether the witness has deposed to a SAPS statement and what the bail conditions say.',
  ],
  guardrailChecks: [
    {
      reason: 'recommended a statement to SAPS before docket disclosure',
      flags: unlessNegated(
        /\b(make|give|provide|submit|depose|offer|hand in|furnish|record)\w*\b[^.;]{0,60}\b(warning statement|statement|affidavit|version)\b[^.;]{0,50}\b(police|SAPS|investigating officer|the IO|detective)\b|\bwarning statement\b[^.;]{0,40}\b(should|must|recommend|advisable)\b/i,
      ),
    },
    {
      reason: 'called a search unlawful for want of consent without considering CPA s 22(b)',
      scope: 'analysis',
      flags: (text) =>
        /\bsearch/i.test(text) &&
        /\bunlawful|\billegal|\binvalid/i.test(text) &&
        /\bconsent/i.test(text) &&
        !/22\s*\(?b\)?|reasonable grounds/i.test(text),
    },
  ],
  standingWarnings: [
    'Do not let the client make a warning statement, affidavit or any statement to SAPS or the investigating officer before full docket disclosure; the right to silence (Constitution s 35(1)) is the default.',
    'Before anyone speaks to an eyewitness, check whether the witness has given SAPS a statement and what the bail conditions say about contact with State witnesses (CPA s 60, s 68).',
  ],
  seedQueries: [
    'private defence proportionality',
    'section 174 discharge close of State case',
    'single witness cautionary rule section 208',
    'section 35(5) exclusion unconstitutionally obtained evidence',
    'competent verdicts Criminal Procedure Act',
  ],
};
