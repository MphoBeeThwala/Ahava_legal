// Questions the intake already answers: dropped so the attorney is not asked
// for facts they already have (triage and the criminal assessment).

/** Topics the intake commonly already answers, and how to spot each. */
const ANSWERED_TOPICS: Array<{ asks: RegExp; given: RegExp }> = [
  { asks: /\bbail\b/i, given: /\bbail\b[^.]{0,60}(R\s?\d|granted|refused|amount|conditions?)/i },
  {
    asks: /\b(remand|postpone|next (court )?(date|appearance)|court date)/i,
    given: /\b(remanded|postponed|next appearance|next court date|remand date)\b/i,
  },
  {
    asks: /\b(previous|prior) convictions?|criminal record\b/i,
    given:
      /\b(previous|prior) convictions?|no (criminal )?record|first offender|criminal record\b/i,
  },
  {
    asks: /\b(what|which) (charges?|counts?)\b|\bcharged with\b/i,
    given: /\b(count \d|charged with|J15|charge sheet)\b/i,
  },
  {
    asks: /\b(date|time) of (the )?arrest\b|\bwhen was [^?]{0,30}arrested\b/i,
    given: /\barrested on\b|\bdate of arrest\b/i,
  },
];

/** Questions the intake already answers (they waste the attorney's time). */
export function alreadyAnswered(question: string, brief: string): boolean {
  return ANSWERED_TOPICS.some(({ asks, given }) => asks.test(question) && given.test(brief));
}
