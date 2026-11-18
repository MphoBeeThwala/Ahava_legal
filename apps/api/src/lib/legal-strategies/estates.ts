import { addCalendarDays, addMonths } from '../../drafting/days';
import { unlessNegated, type StrategyCartridge } from './types';

export const estates: StrategyCartridge = {
  id: 'estates',
  label: 'Deceased estates and trusts',
  forums:
    "Master of the High Court, High Court (validity of wills, removal of executors or trustees), Magistrates' Courts (small estates)",
  burdenOfProof:
    'The party challenging a will must prove invalidity (formalities, capacity, undue influence) on a balance of probabilities; condonation under Wills Act s 2(3) needs proof that the deceased intended the document as the will.',
  detect: {
    practiceArea: /estate|wills?|trusts?|deceased|succession/i,
    keywords: [
      /\bdeceased\b|\bdeath\b|\bdied\b|\bpassed away\b|\bdeath notice\b/i,
      /\bwill\b[^.]{0,20}\b(testament|valid|signed|witness)|\blast will\b|\bcodicil\b/i,
      /\bexecutor\b|\bletters of (executorship|authority)\b|\bMaster of the High Court\b/i,
      /\bheirs?\b|\bbeneficiar(y|ies)\b|\binheritance\b|\bintestate\b/i,
      /\btrust(ee)?s?\b[^.]{0,20}\b(deed|fund|property)\b|\bTrust Property Control\b/i,
      /\bliquidation and distribution account\b|\bL&D account\b|\bestate duty\b/i,
    ],
  },
  analysis:
    'Merit items for each issue (kind "issue" or "claim"): validity of the will (Wills Act s 2(1)(a) formalities; s 2(3) condonation; capacity; undue influence), intestate succession (Intestate Succession Act; spouses and permanent life partners), the executor\'s appointment and duties (Administration of Estates Act: reporting, letters, inventory, creditors\' notices, the liquidation and distribution account, objections), maintenance claims (Maintenance of Surviving Spouses Act; children\'s maintenance claims), collation, trusts (Trust Property Control Act: letters of authority before acting, trustees acting jointly, duty of care, removal; sham or alter-ego trusts). Settlement or ADR path: agreement between heirs (redistribution agreements), objections to the account resolved with the Master. Litigation or execution blueprint: application to the High Court (condonation, removal, declaring a will invalid), review of the Master\'s decision (s 35(10)).',
  governingStatutesAndRules: [
    {
      name: 'Administration of Estates Act 66 of 1965',
      provisions:
        "s 7 (reporting the estate), s 13 (letters of executorship), s 18 (small estates), s 27 (inventory), s 29 (creditors' notice), s 35 (L&D account, inspection, objections), s 54 (removal)",
    },
    {
      name: 'Wills Act 7 of 1953',
      provisions:
        's 2(1)(a) (formalities), s 2(3) (condonation), s 2B (revocation by divorce), s 4A (witnesses as heirs)',
    },
    { name: 'Intestate Succession Act 81 of 1987', provisions: 's 1 (who inherits)' },
    {
      name: 'Maintenance of Surviving Spouses Act 27 of 1990',
      provisions: 's 2 (claim against the estate)',
    },
    {
      name: 'Trust Property Control Act 57 of 1988',
      provisions: 's 6 (letters of authority), s 9 (care and diligence), s 19-20 (removal)',
    },
    { name: 'Estate Duty Act 45 of 1955', provisions: 'Estate duty and abatement' },
  ],
  verifiedPrecedents: [
    {
      authority: 'Bwanya v Master of the High Court',
      principle: 'Permanent life partners and intestate succession and maintenance claims.',
    },
    {
      authority: 'Land and Agricultural Bank of South Africa v Parker',
      principle: 'Trustees must act jointly; the trust form may not be abused to escape liability.',
    },
    {
      authority: 'Van Wetten v Bosch',
      principle:
        'Wills Act s 2(3): condonation requires proof that the deceased intended the document to be the will.',
    },
  ],
  prescriptionAndDeadlineChecks: [
    {
      id: 'estates.report-death',
      label: 'Report the estate to the Master',
      trigger: 'Date of death',
      authority: 'Administration of Estates Act s 7(1): within 14 days',
      compute: (date) => addCalendarDays(date, 14),
    },
    {
      id: 'estates.creditors-claims',
      label: 'Creditors lodge claims after the s 29 notice',
      trigger: "Date the creditors' notice was published",
      authority: 'Administration of Estates Act s 29(1): not less than 30 days',
      compute: (date) => addCalendarDays(date, 30),
    },
    {
      id: 'estates.lodge-account',
      label: 'Lodge the liquidation and distribution account with the Master',
      trigger: 'Date letters of executorship were granted',
      authority:
        'Administration of Estates Act s 35(1): within six months (or longer if the Master allows)',
      compute: (date) => addMonths(date, 6),
    },
    {
      id: 'estates.account-inspection',
      label: 'Account lies open for inspection and objections',
      trigger: 'Date the advertisement of inspection was published',
      authority: 'Administration of Estates Act s 35(4)-(5): 21 days',
      compute: (date) => addCalendarDays(date, 21),
    },
  ],
  tacticalGuardrails: [
    'Never advise distributing to heirs or beneficiaries before the liquidation and distribution account has lain for inspection and any objections are resolved (s 35).',
    'An executor or trustee may not act before receiving letters of executorship or authority (AEA s 13; TPCA s 6).',
    'Check every Wills Act s 2(1)(a) formality (signature on each page, two competent witnesses present together) before advising that a will is valid; a defective will needs a s 2(3) application.',
    'Trustees must act jointly unless the trust deed says otherwise; a decision by fewer than all trustees may not bind the trust.',
  ],
  guardrailChecks: [
    {
      reason: 'advised distributing to heirs before the account procedure is complete',
      flags: (text) =>
        unlessNegated(/\b(distribut|pay out|transfer)\w*\b[^.;]{0,60}\b(heirs?|beneficiar\w*)\b/i)(
          text,
        ) &&
        !/\b(after|once|when|following)\b[^.;]{0,60}\b(account|L&D|inspection|objection|confirmed)\b/i.test(
          text,
        ),
    },
    {
      reason: 'advised an executor or trustee to act before receiving letters',
      flags: unlessNegated(
        /\b(executor|trustee)s?\b[^.;]{0,40}\b(may|can|should)\b[^.;]{0,40}\bbefore\b[^.;]{0,30}\bletters\b/i,
      ),
    },
  ],
  standingWarnings: [
    'Report the estate within 14 days of death (AEA s 7) and do not let anyone deal with estate assets before letters of executorship are issued.',
  ],
  seedQueries: [
    'Wills Act section 2(3) condonation',
    'liquidation and distribution account objection',
    'executor removal section 54',
    'trustees act jointly',
    'intestate succession spouse',
  ],
};
