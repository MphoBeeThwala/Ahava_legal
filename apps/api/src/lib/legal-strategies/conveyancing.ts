import { addBusinessDays, addMonths } from '../../drafting/days';
import { unlessNegated, type StrategyCartridge } from './types';

export const conveyancing: StrategyCartridge = {
  id: 'conveyancing',
  label: 'Conveyancing and property',
  forums:
    "Deeds Registry (registration), High Court and Magistrates' Courts (disputes), community schemes ombud (sectional title disputes)",
  burdenOfProof:
    'The party relying on a sale must prove a written agreement signed by the parties or their agents acting on written authority (Alienation of Land Act s 2(1)); otherwise on a balance of probabilities.',
  detect: {
    practiceArea: /conveyanc|property|transfer|deeds/i,
    keywords: [
      /\boffer to purchase\b|\bOTP\b|\bdeed of sale\b|\bagreement of sale\b/i,
      /\btransfer\b[^.]{0,30}\b(property|erf|unit|house)\b|\bregistration of transfer\b/i,
      /\bbond\b|\bmortgage\b|\bguarantees?\b/i,
      /\btitle deed\b|\bdeeds (office|registry)\b|\berf\b|\bsectional title\b/i,
      /\brates clearance\b|\blevy clearance\b|\btransfer duty\b/i,
      /\bestate agent\b|\bproperty practitioner\b|\bcommission\b|\boccupational rent\b/i,
    ],
  },
  analysis:
    'Merit items for each transaction step or dispute (kind "transaction" or "claim"): validity of the sale (s 2(1) formalities; all material terms in writing; variations also in writing), suspensive conditions (bond approval, sale of another property; lapse if not fulfilled or waived by the date), spousal consent (Matrimonial Property Act s 15(2)(b) for spouses in community), cooling-off (s 29A), guarantees, clearances (rates under Municipal Systems Act s 118, levies), transfer duty or VAT, defects (voetstoots and latent defects; Consumer Protection Act where it applies), occupation and occupational rent, agent commission (effective cause; Fidelity Fund certificate). Settlement or ADR path: notices of breach and cure periods in the agreement, negotiated cancellation. Litigation or execution blueprint: specific performance or cancellation and damages; lodgement and registration steps in the Deeds Registry.',
  governingStatutesAndRules: [
    {
      name: 'Alienation of Land Act 68 of 1981',
      provisions:
        's 2(1) (formalities), s 2(2A), s 29A (cooling-off), Chapter II (instalment sales)',
    },
    {
      name: 'Deeds Registries Act 47 of 1937',
      provisions: 'Registration of transfer and bonds; regulations on lodgement',
    },
    {
      name: 'Transfer Duty Act 40 of 1949',
      provisions: 's 2 (duty), s 3 (payment within six months), s 9 (exemptions)',
    },
    {
      name: 'Matrimonial Property Act 88 of 1984',
      provisions: 's 15(2)(b) (spousal consent to alienate immovable property in community)',
    },
    {
      name: 'Local Government: Municipal Systems Act 32 of 2000',
      provisions: 's 118 (rates clearance certificate)',
    },
    {
      name: 'Sectional Titles Act 95 of 1986 and Sectional Titles Schemes Management Act 8 of 2011',
      provisions: 'Levy clearance; scheme rules',
    },
    {
      name: 'Property Practitioners Act 22 of 2019',
      provisions: 'Fidelity Fund certificates; mandatory disclosure form',
    },
  ],
  verifiedPrecedents: [
    {
      authority: 'Johnston v Leal',
      principle:
        'Alienation of Land Act s 2(1): every material term of the sale must be in the signed written agreement.',
    },
    {
      authority: 'Legator McKenna v Shea',
      principle:
        'The abstract theory of transfer: ownership passes on registration with the real agreement, even if the underlying sale is invalid.',
    },
    {
      authority: 'Jordaan v City of Tshwane',
      principle:
        'Municipal Systems Act s 118(3): historical municipal debts do not bind a new owner after transfer.',
    },
  ],
  prescriptionAndDeadlineChecks: [
    {
      id: 'conveyancing.cooling-off',
      label: 'Purchaser may revoke the offer or terminate the sale (s 29A)',
      trigger: 'Date the purchaser signed (natural person, price R250 000 or less)',
      authority:
        'Alienation of Land Act s 29A: five days, excluding Saturdays, Sundays and public holidays',
      compute: (date) => addBusinessDays(date, 5),
    },
    {
      id: 'conveyancing.suspensive-condition',
      label: 'Suspensive condition must be fulfilled or waived',
      trigger: 'The date set in the agreement',
      authority: 'The agreement; the sale lapses if the condition is not met by then',
    },
    {
      id: 'conveyancing.transfer-duty',
      label: 'Pay transfer duty without interest',
      trigger: 'Date of acquisition (date the sale became unconditional)',
      authority: 'Transfer Duty Act s 3(1): within six months',
      compute: (date) => addMonths(date, 6),
    },
  ],
  tacticalGuardrails: [
    'Never treat an oral sale, or an oral variation of a written sale, of land as binding: Alienation of Land Act s 2(1) requires writing signed by both parties (or agents with written authority).',
    'Check that a suspensive condition (bond approval) has been fulfilled or waived in writing by its date; otherwise the sale has lapsed and lodgement must stop.',
    "Obtain the spouse's written consent where the seller is married in community of property (MPA s 15(2)(b)).",
    'Do not lodge for transfer without the rates clearance (s 118) and, in sectional title, the levy clearance.',
  ],
  guardrailChecks: [
    {
      reason: 'treated an oral sale or oral variation of land as binding',
      flags: unlessNegated(
        /\b(oral|verbal|unwritten)\b[^.;]{0,40}\b(sale|agreement|offer|variation|amendment)\b[^.;]{0,40}\b(valid|binding|enforceable|effective)\b/i,
      ),
    },
  ],
  standingWarnings: [
    'Check the signed agreement for every material term and the suspensive condition dates before advising: an unmet condition means the sale has lapsed.',
  ],
  seedQueries: [
    'Alienation of Land Act section 2(1) formalities',
    'suspensive condition bond approval lapse',
    'latent defects voetstoots clause',
    'estate agent commission effective cause',
    'section 118 rates clearance new owner',
  ],
};
