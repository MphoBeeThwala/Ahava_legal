// The standard template library: versioned in the code, so every change to
// the standard wording is reviewed like any other change.
import type { DraftTemplateSummary } from '@ahava88/shared';
import type { DraftTemplate } from './template';
import { letterOfDemand, ncaS129Notice, organOfStateNotice } from './templates/correspondence';
import { affidavit, noticeOfMotion } from './templates/court';
import { lastWill, mandateFeeAgreement, specialPowerOfAttorney } from './templates/instruments';

export const TEMPLATES: readonly DraftTemplate[] = [
  letterOfDemand,
  ncaS129Notice,
  organOfStateNotice,
  affidavit,
  noticeOfMotion,
  specialPowerOfAttorney,
  mandateFeeAgreement,
  lastWill,
];

export function findTemplate(id: string): DraftTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function summary(template: DraftTemplate): DraftTemplateSummary {
  const { id, version, name, category, purpose, basis, review, format, sections } = template;
  return { id, version, name, category, purpose, basis, review, format, sections };
}
