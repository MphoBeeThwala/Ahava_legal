// A practice area's "strategy cartridge": what the strategy engine tells the
// model about that area, and what code checks in the answer afterwards.
//
// Authorities here are names and principles only, never law report
// citations: a curated list to point the model at well-established law. They
// are shown as "curated" (read before relying), and as "verified" only when a
// passage retrieved from the approved sources names them. The lists should be
// reviewed by an admitted attorney like the drafting templates.
import type { PracticeAreaId } from '@ahava88/shared';

export interface StatuteOrRule {
  /** E.g. "Labour Relations Act 66 of 1995". */
  name: string;
  /** The provisions that matter most. */
  provisions: string;
}

export interface CuratedPrecedent {
  /** Case name only (no report citation), e.g. "Sidumo v Rustenburg Platinum Mines". */
  authority: string;
  principle: string;
}

export interface DeadlineRule {
  /** Stable id the model returns, e.g. "labour.dismissal-referral". */
  id: string;
  label: string;
  /** The event the period runs from. */
  trigger: string;
  authority: string;
  /** The last day from the trigger date (YYYY-MM-DD); omitted when it cannot be computed safely. */
  compute?: (triggerDate: string) => string | null;
}

export interface GuardrailCheck {
  /** Why an item is removed, e.g. "recommended a statement to SAPS before docket disclosure". */
  reason: string;
  /**
   * What it is checked against: "advice" (the roadmap, warnings, fallbacks,
   * fact-audit actions; the default) or "analysis" (whole merit items).
   */
  scope?: 'advice' | 'analysis';
  /** true when the item breaks the rule. */
  flags: (text: string) => boolean;
}

export interface StrategyCartridge {
  id: PracticeAreaId;
  label: string;
  /** Forums and the usual burden and standard of proof. */
  forums: string;
  burdenOfProof: string;
  /** How the router recognises the area. */
  detect: { practiceArea: RegExp; keywords: RegExp[] };
  /** How to break the matter into elements (charges, claims, transaction steps). */
  analysis: string;
  governingStatutesAndRules: StatuteOrRule[];
  verifiedPrecedents: CuratedPrecedent[];
  prescriptionAndDeadlineChecks: DeadlineRule[];
  /** Traps to warn against; also given to the model as hard rules. */
  tacticalGuardrails: string[];
  /** Code checks applied to every item of the answer. */
  guardrailChecks: GuardrailCheck[];
  /** Always shown in the tactical warnings. */
  standingWarnings: string[];
  /** Always searched for, alongside the model's own queries. */
  seedQueries: string[];
}

/** Advice that says "do not" is not advice to do it. */
export const NEGATED =
  /\b(do not|does not|don't|doesn't|never|not to|must not|should not|cannot|will not|avoid|refrain from)\b/i;

/** A check that flags text matching `pattern` unless it is negated. */
export function unlessNegated(pattern: RegExp): (text: string) => boolean {
  return (text) => pattern.test(text) && !NEGATED.test(text);
}
