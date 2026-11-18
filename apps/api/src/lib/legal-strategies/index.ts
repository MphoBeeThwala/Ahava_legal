// The strategy cartridges and the practice-area router.
import type { PracticeAreaId } from '@ahava88/shared';
import { commercial } from './commercial';
import { conveyancing } from './conveyancing';
import { criminal } from './criminal';
import { estates } from './estates';
import { family } from './family';
import { labour } from './labour';
import type { StrategyCartridge } from './types';

export type { StrategyCartridge, DeadlineRule, GuardrailCheck } from './types';

export const CARTRIDGES: Record<PracticeAreaId, StrategyCartridge> = {
  criminal,
  labour,
  family,
  commercial,
  conveyancing,
  estates,
};

export interface PracticeAreaSignals {
  /** The practice area chosen on the intake form. */
  practiceArea?: string;
  /** The matter type the triage model gave. */
  triageMatterType?: string;
  matterSummary?: string;
  requestedOutcome?: string;
  documentsMentioned?: string;
  chargeSheet?: string;
}

export interface PracticeAreaDetection {
  primary: PracticeAreaId | null;
  secondary: PracticeAreaId[];
  scores: Record<PracticeAreaId, number>;
}

/**
 * Classifies the matter from the intake form's practice area, the triage
 * matter type, and the words in the notes, documents and charge sheet.
 * Scores: the form's practice area 5, the triage type 3, each distinct
 * keyword group found 1. The primary area needs 2 or more; a secondary area
 * (an overlap such as criminal and labour misconduct, or family and a
 * property transfer) needs 3 or more and at least 2 keyword groups.
 */
export function detectPracticeArea(signals: PracticeAreaSignals): PracticeAreaDetection {
  const text = [
    signals.matterSummary,
    signals.requestedOutcome,
    signals.documentsMentioned,
    signals.chargeSheet,
  ]
    .filter(Boolean)
    .join('\n');
  const scores = {} as Record<PracticeAreaId, number>;
  const keywordHits = {} as Record<PracticeAreaId, number>;
  for (const cartridge of Object.values(CARTRIDGES)) {
    const hits = cartridge.detect.keywords.filter((pattern) => pattern.test(text)).length;
    keywordHits[cartridge.id] = hits;
    scores[cartridge.id] =
      hits +
      (cartridge.detect.practiceArea.test(signals.practiceArea ?? '') ? 5 : 0) +
      (cartridge.detect.practiceArea.test(signals.triageMatterType ?? '') ? 3 : 0) +
      (cartridge.id === 'criminal' && signals.chargeSheet?.trim() ? 5 : 0);
  }
  const ranked = (Object.keys(scores) as PracticeAreaId[]).sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0]!;
  const primary = scores[top] >= 2 ? top : null;
  const secondary = primary
    ? ranked.filter((id) => id !== primary && scores[id] >= 3 && keywordHits[id] >= 2).slice(0, 2)
    : [];
  return { primary, secondary, scores };
}
