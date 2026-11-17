// The standard template library: versioned in the code, so every change to
// the standard wording is reviewed like any other change.
import type { DraftTemplateSummary } from '@ahava88/shared';
import type { DraftTemplate } from './template';
import { letterOfDemand, ncaS129Notice, organOfStateNotice } from './templates/correspondence';
import { affidavit, noticeOfMotion } from './templates/court';
import { acknowledgmentOfDebt, contingencyFeesAgreement, suretyship } from './templates/commercial';
import { arbitrationRequest, ccmaReferral, employmentContract } from './templates/labour';
import { noticeOfBreach, withoutPrejudiceOffer } from './templates/letters';
import {
  answeringAffidavit,
  noticeOfBar,
  replyingAffidavit,
  rule41aNotice,
  simpleSummons,
} from './templates/proceedings';
import {
  combinedSummons,
  confirmatoryAffidavit,
  foundingAffidavit,
  noticeOfIntentionToDefend,
  plea,
} from './templates/litigation';
import { deedOfSale, poaToPassTransfer, residentialLease } from './templates/property';
import {
  generalPowerOfAttorney,
  lastWill,
  mandateFeeAgreement,
  specialPowerOfAttorney,
} from './templates/instruments';

export const TEMPLATES: readonly DraftTemplate[] = [
  letterOfDemand,
  ncaS129Notice,
  organOfStateNotice,
  affidavit,
  noticeOfMotion,
  specialPowerOfAttorney,
  mandateFeeAgreement,
  lastWill,
  foundingAffidavit,
  confirmatoryAffidavit,
  combinedSummons,
  noticeOfIntentionToDefend,
  plea,
  ccmaReferral,
  residentialLease,
  deedOfSale,
  poaToPassTransfer,
  acknowledgmentOfDebt,
  suretyship,
  contingencyFeesAgreement,
  answeringAffidavit,
  replyingAffidavit,
  simpleSummons,
  noticeOfBar,
  rule41aNotice,
  withoutPrejudiceOffer,
  noticeOfBreach,
  arbitrationRequest,
  employmentContract,
  generalPowerOfAttorney,
];

export function findTemplate(id: string): DraftTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function summary(template: DraftTemplate): DraftTemplateSummary {
  const { id, version, name, category, purpose, basis, review, format, sections } = template;
  return { id, version, name, category, purpose, basis, review, format, sections };
}
