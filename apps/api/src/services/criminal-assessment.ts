// Criminal matters: a count-by-count merit assessment for the attorney.
//
// Two passes over the same de-identified intake brief:
// 1. Planning: the model reads the charge sheet and the client's version and
//    returns the counts and short search queries.
// 2. Assessment: with the passages retrieved for those queries (our approved
//    corpus, then Laws.Africa where enabled), the model reasons through the
//    fact audit, the elements of every count, defences, competent verdicts,
//    procedural issues and a phased strategy.
//
// Then code checks the answer (roadmap §7):
// - An authority counts as verified only when a passage it cites was retrieved
//   and names it. Anything else is kept, marked "not verified", for the
//   attorney to check: it is never presented as grounded.
// - Tactical guardrails remove dangerous advice (a charged client giving SAPS
//   a warning statement before docket disclosure; calling a scene search
//   unlawful for want of consent without CPA s 22(b); POPIA boilerplate) and
//   questions about facts the intake already gives.
// - Standing warnings are always added.
//
// A failed or malformed answer is an error the user sees; there is no rules
// fallback.
import { z } from 'zod';
import type {
  AuthorityReference,
  CitedSource,
  CountAssessment,
  CriminalAssessment,
  DefenceViability,
  ProceduralIssue,
} from '@ahava88/shared';
import { parseJsonAnswer } from '../lib/ai-client';
import { callModel, type CallContext } from './ai.service';
import { retrieveSources, sourceText } from './research-run';
import { alreadyAnswered } from './answered-facts';

/** Practice areas (or triage matter types) that get the criminal assessment. */
export function isCriminalMatter(...labels: Array<string | null | undefined>): boolean {
  return labels.some((label) =>
    /\bcriminal\b|\bbail\b|\bcharge sheet\b|\bJ15\b/i.test(label ?? ''),
  );
}

// ------------------------------------------------------------------ prompts

/** Always searched for, alongside the model's own queries. */
export const SEED_QUERIES = [
  'private defence proportionality',
  'doctrine of recent possession theft inference',
  'section 174 discharge close of State case',
  'single witness cautionary rule section 208',
  'section 35(5) exclusion unconstitutionally obtained evidence',
  'competent verdicts Criminal Procedure Act',
];

const PLAN_SYSTEM = [
  'You prepare a criminal defence assessment for a South African attorney.',
  'The intake is de-identified: people appear as tokens such as [Client]; never put tokens or guesses about people into queries.',
  'Read the charge sheet (J15) and the facts, then return one JSON object:',
  '{"counts": string[] (each count as charged, e.g. "Count 1: Assault with intent to do grievous bodily harm"),',
  '"queries": string[] (3 to 6 short keyword queries, 2-8 words, naming offences, defences, statutory sections and doctrines likely to matter)}.',
].join(' ');

const ASSESSMENT_SYSTEM = `You are a senior criminal litigation strategist advising a South African defence attorney. The attorney decides; you give the analysis a senior advocate would give at a first consultation.

INPUT
- A de-identified intake: people appear as tokens such as [Client] or [Complainant]. Keep tokens exactly as they are; never guess who anyone is.
- Numbered source passages [S1], [S2]... retrieved from the firm's approved legal sources.

REASON FIRST, THEN ANSWER
Work through these steps before you write the JSON:
1. Fact reconciliation. Sort every material fact into: confirmed (given in the intake or charge sheet; take as given), corroboration needed (true if the client is right, but must be proved objectively: SAPS 13 register, OB entries, CCTV, medical records, ownership of property), and critical unknowns (genuinely not in the intake and material to the defence).
2. Count by count. For each count: the elements the State must prove (conduct/actus reus, unlawfulness, capacity, fault: dolus or culpa) against the client's version; the primary defence and how viable it is (high, moderate or high-risk) with reasons; where the State will attack the client's version (for example proportionality in private defence, the coincidence of possessing the complainant's property under the doctrine of recent possession); competent verdicts under the Criminal Procedure Act 51 of 1977 (for example common assault on a charge of assault GBH) and fallback positions; sentencing exposure (Criminal Law Amendment Act 105 of 1997 minimum sentences if they apply, and the trial court's jurisdiction).
3. Constitutional and procedural issues: search and seizure (CPA s 20, s 22(a) and (b), Constitution s 35(5)); the right to silence (s 35(1)) and the admissibility of confessions and admissions (CPA s 217 and s 219A; distinguish an unsigned warning statement from an alleged spontaneous oral admission); the single witness cautionary rule (CPA s 208); intoxication affecting a witness's reliability; bail conditions and non-interference with State witnesses (CPA s 60 and s 68).
4. Strategy in phases: (a) immediate preservation in the first 72 hours (preservation letters for CCTV before it is overwritten, the SAPS 13 register, OB entries, medical and photo metadata); (b) a witness and bail protocol; (c) Path A, acquittal at trial or a s 174 discharge: how to cross-examine, which contradictions to build between the J88, SAPS statements and the witnesses' state at the time; (d) Path B, resolution without trial: when (after docket disclosure) and how to make written representations to the Senior Public Prosecutor for withdrawal, a lesser charge, diversion or mediation, or a s 105A plea and sentence agreement.

AUTHORITY
- Ground the analysis in South African criminal law, procedure and constitutional law.
- Prefer the numbered passages. When an authority you rely on appears in a passage, list it with that passage's reference in "sources".
- You may name well-established statutes and leading cases from your own knowledge only when you are certain they exist and stand for the principle (for example on private defence: S v Trainor, S v Steyn, S v Joshua, Ex parte Minister van Justisie: In re S v Van Wyk; mistake and intention: S v De Blom, S v Chretien; recent possession: S v Parrow, S v Skweyiya; exclusion of evidence: S v Tandwa, S v Pillay). For those, leave "sources" empty: they will be shown as not verified for the attorney to check.
- Never invent a case name, a citation, a page or a quotation. Give no law report citation unless it appears in a passage. If unsure, describe the principle without naming a case.

HARD RULES
- NEVER recommend that a client who has been charged or released on bail give a police warning statement, an affidavit or any statement to SAPS or the investigating officer before full docket disclosure. Protecting the right to silence is the default. Written representations to the prosecutor after docket disclosure are a different, strategic step: keep the two distinct.
- NEVER call a warrantless search at the scene of a violent crime unlawful merely because there was no consent: first analyse whether the police had reasonable grounds under CPA s 22(b).
- NEVER ask for, or list as unknown, a fact the intake or charge sheet already gives (dates of arrest or remand, bail amount and conditions, previous convictions, the court, the charges).
- No generic POPIA, privacy or administrative boilerplate unless it bears directly on privilege or evidence.
- Do not pad. Every item must be specific to these facts.

OUTPUT
Return one JSON object and nothing else:
{
  "case_theory_summary": string (at most 150 words: the defence theory in one paragraph),
  "fact_audit": {"confirmed": string[], "corroboration_needed": string[], "critical_unknowns": string[]},
  "count_assessments": [{
    "count": string,
    "elements_analysis": [{"element": string, "state_burden": string, "client_version": string, "assessment": string}],
    "primary_defence": string,
    "viability_score": "high" | "moderate" | "high-risk",
    "viability_reasoning": string,
    "prosecution_attack_vectors": string[],
    "competent_verdicts": string[],
    "sentencing": string,
    "applicable_precedent": [{"authority": string, "principle": string, "sources": string[]}]
  }],
  "constitutional_and_procedural_issues": [{"issue": string, "analysis": string, "authorities": [{"authority": string, "principle": string, "sources": string[]}]}],
  "winning_strategy": {"immediate_preservation": string[], "witness_protocol": string[], "trial_defence_blueprint": string[], "prosecutorial_representations_strategy": string[]},
  "tactical_warnings": string[]
}`;

// ------------------------------------------------------------------ schema

const text = z.preprocess((value) => (value == null ? '' : String(value).trim()), z.string());
const list = z.preprocess(
  (value) =>
    (Array.isArray(value) ? value : value == null || value === '' ? [] : [value])
      .filter((item) => item != null && String(item).trim() !== '')
      .map((item) => String(item).trim()),
  z.array(z.string()),
);
const objects = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : []),
    z.array(item),
  );
const authority = z.object({ authority: text, principle: text, sources: list });
const viability = z.preprocess(
  (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[\s_]+/g, '-'),
  z.enum(['high', 'moderate', 'high-risk']).catch('moderate'),
);

/** The model's answer, leniently parsed (missing parts become empty). */
export const criminalAnswerSchema = z.object({
  case_theory_summary: text,
  fact_audit: z
    .object({ confirmed: list, corroboration_needed: list, critical_unknowns: list })
    .catch({ confirmed: [], corroboration_needed: [], critical_unknowns: [] }),
  count_assessments: objects(
    z.object({
      count: text,
      elements_analysis: objects(
        z.object({ element: text, state_burden: text, client_version: text, assessment: text }),
      ),
      primary_defence: text,
      viability_score: viability,
      viability_reasoning: text,
      prosecution_attack_vectors: list,
      competent_verdicts: list,
      sentencing: text,
      applicable_precedent: objects(authority),
    }),
  ),
  constitutional_and_procedural_issues: objects(
    z.object({ issue: text, analysis: text, authorities: objects(authority) }),
  ),
  winning_strategy: z
    .object({
      immediate_preservation: list,
      witness_protocol: list,
      trial_defence_blueprint: list,
      prosecutorial_representations_strategy: list,
    })
    .catch({
      immediate_preservation: [],
      witness_protocol: [],
      trial_defence_blueprint: [],
      prosecutorial_representations_strategy: [],
    }),
  tactical_warnings: list,
});

export type CriminalAnswer = z.infer<typeof criminalAnswerSchema>;

// ------------------------------------------------------------------ guardrails

/** Always shown: the traps a charged client most often falls into. */
export const STANDING_WARNINGS = [
  'Do not let the client make a warning statement, affidavit or any statement to SAPS or the investigating officer before full docket disclosure; the right to silence (Constitution s 35(1)) is the default. Representations to the prosecutor come later and are a deliberate, written step.',
  'Before anyone speaks to an eyewitness, check whether the witness has given SAPS a statement and what the bail conditions say about contact with State witnesses (CPA s 60, s 68): the client must not contact them, and the attorney should approach them only through proper channels.',
];

const NEGATED = /\b(do not|don't|never|not to|must not|should not|avoid|refrain from)\b/i;
const STATEMENT_TO_POLICE =
  /\b(make|give|provide|submit|depose|offer|hand in|furnish|record)\w*\b[^.;]{0,60}\b(warning statement|statement|affidavit|version)\b[^.;]{0,50}\b(police|SAPS|investigating officer|the IO|detective)\b|\b(warning statement)\b[^.;]{0,40}\b(should|must|recommend|advisable)\b/i;

function recommendsPoliceStatement(item: string): boolean {
  return STATEMENT_TO_POLICE.test(item) && !NEGATED.test(item);
}

function popiaBoilerplate(item: string): boolean {
  return /\bPOPIA\b|Protection of Personal Information/i.test(item) && !/privilege/i.test(item);
}

function searchUnlawfulForConsentOnly(issue: string): boolean {
  return (
    /\bsearch/i.test(issue) &&
    /\bunlawful|\billegal|\binvalid/i.test(issue) &&
    /\bconsent/i.test(issue) &&
    !/22\s*\(?b\)?|reasonable grounds/i.test(issue)
  );
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9()]+/g, ' ')
    .trim();

/** The distinctive part of an authority's name ("S v Trainor" → "trainor"). */
function authorityKey(name: string): string {
  const cleaned = normalise(name)
    .replace(/\b(s|the state|state) v\b/g, ' ')
    .replace(/\b(ex parte|in re|minister van justisie|die|of|act|no)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter((word) => word.length > 2)[0] ?? cleaned;
}

/** An authority is verified when a retrieved passage it cites names it. */
export function checkAuthorities(
  items: Array<{ authority: string; principle: string; sources: string[] }>,
  sources: CitedSource[],
): AuthorityReference[] {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  return items
    .filter((item) => item.authority)
    .map((item) => {
      const refs = [
        ...new Set(item.sources.map((ref) => ref.replace(/[[\]\s]/g, '').toUpperCase())),
      ].filter((ref) => byRef.has(ref));
      const key = authorityKey(item.authority);
      const named = refs.filter((ref) => {
        const source = byRef.get(ref)!;
        return normalise(`${source.citation} ${source.title} ${source.text}`).includes(key);
      });
      return {
        authority: item.authority,
        principle: item.principle,
        sources: named,
        verified: named.length > 0,
      };
    });
}

/** Applies the guardrails to a parsed answer; see the file header. */
export function guardAssessment(
  answer: CriminalAnswer,
  sources: CitedSource[],
  brief: string,
): Omit<CriminalAssessment, 'sources' | 'gaps' | 'queries' | 'model' | 'generatedAt'> {
  const removed: CriminalAssessment['removed'] = [];
  const keep = (items: string[], where: string): string[] =>
    items.filter((item) => {
      if (recommendsPoliceStatement(item)) {
        removed.push({
          text: item,
          reason: `${where}: recommended a statement to SAPS before docket disclosure`,
        });
        return false;
      }
      if (popiaBoilerplate(item)) {
        removed.push({ text: item, reason: `${where}: generic POPIA text` });
        return false;
      }
      return true;
    });

  const criticalUnknowns = keep(answer.fact_audit.critical_unknowns, 'Critical unknowns').filter(
    (item) => {
      if (alreadyAnswered(item, brief)) {
        removed.push({ text: item, reason: 'Critical unknowns: the intake already gives this' });
        return false;
      }
      return true;
    },
  );

  const counts: CountAssessment[] = answer.count_assessments
    .filter((count) => count.count)
    .map((count) => ({
      count: count.count,
      elements: count.elements_analysis
        .filter((element) => element.element)
        .map((element) => ({
          element: element.element,
          stateBurden: element.state_burden,
          clientVersion: element.client_version,
          assessment: element.assessment,
        })),
      primaryDefence: count.primary_defence,
      viability: count.viability_score as DefenceViability,
      viabilityReasoning: count.viability_reasoning,
      prosecutionAttacks: keep(count.prosecution_attack_vectors, count.count),
      competentVerdicts: count.competent_verdicts,
      sentencing: count.sentencing,
      authorities: checkAuthorities(count.applicable_precedent, sources),
    }));

  const proceduralIssues: ProceduralIssue[] = [];
  for (const issue of answer.constitutional_and_procedural_issues) {
    const whole = `${issue.issue} ${issue.analysis}`;
    if (!issue.issue && !issue.analysis) continue;
    if (searchUnlawfulForConsentOnly(whole)) {
      removed.push({
        text: issue.issue || issue.analysis,
        reason:
          'Procedural issues: called a search unlawful for want of consent without considering CPA s 22(b)',
      });
      continue;
    }
    if (recommendsPoliceStatement(whole)) {
      removed.push({
        text: issue.issue || issue.analysis,
        reason: 'Procedural issues: recommended a statement to SAPS before docket disclosure',
      });
      continue;
    }
    proceduralIssues.push({
      issue: issue.issue,
      analysis: issue.analysis,
      authorities: checkAuthorities(issue.authorities, sources),
    });
  }

  const strategy = answer.winning_strategy;
  const warnings = keep(answer.tactical_warnings, 'Tactical warnings');
  return {
    caseTheory: answer.case_theory_summary,
    factAudit: {
      confirmed: answer.fact_audit.confirmed,
      corroborationNeeded: keep(answer.fact_audit.corroboration_needed, 'Corroboration'),
      criticalUnknowns,
    },
    counts,
    proceduralIssues,
    strategy: {
      immediatePreservation: keep(strategy.immediate_preservation, 'Immediate preservation'),
      witnessProtocol: keep(strategy.witness_protocol, 'Witness protocol'),
      trialBlueprint: keep(strategy.trial_defence_blueprint, 'Trial blueprint'),
      representationsStrategy: keep(
        strategy.prosecutorial_representations_strategy,
        'Representations',
      ),
    },
    tacticalWarnings: [...STANDING_WARNINGS, ...warnings],
    removed,
  };
}

// ------------------------------------------------------------------ run

const cleanQuery = (query: unknown) =>
  String(query)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Runs both passes over a de-identified brief. */
export async function assessCriminalMatter(
  brief: string,
  context: Omit<CallContext, 'purpose'>,
): Promise<CriminalAssessment> {
  const call = { ...context, purpose: 'triage' as const };
  const plan = await callModel(
    {
      model: 'research',
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: brief }],
      maxTokens: 600,
      temperature: 0,
    },
    call,
  );
  const planned = parseJsonAnswer<{ counts?: unknown; queries?: unknown }>(plan.text);
  const counts = (Array.isArray(planned.counts) ? planned.counts : []).map(String).slice(0, 12);
  const queries = [
    ...new Set(
      [...(Array.isArray(planned.queries) ? planned.queries : []).slice(0, 6), ...SEED_QUERIES]
        .map(cleanQuery)
        .filter(Boolean),
    ),
  ].slice(0, 10);

  const { sources, gaps } = await retrieveSources(queries, 14);
  const passages = sources.length
    ? `Source passages:\n\n${sources.map(sourceText).join('\n\n')}`
    : 'Source passages: none were found in the approved sources. Every authority you name will be shown as not verified.';
  const result = await callModel(
    {
      model: 'research',
      system: ASSESSMENT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            brief,
            counts.length ? `Counts identified:\n${counts.map((c) => `- ${c}`).join('\n')}` : '',
            passages,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      maxTokens: 8000,
      temperature: 0,
    },
    call,
  );
  const answer = criminalAnswerSchema.parse(parseJsonAnswer<unknown>(result.text));
  const guarded = guardAssessment(answer, sources, brief);
  return {
    ...guarded,
    gaps: sources.length
      ? gaps
      : [...gaps, 'No passage in the approved sources matched: every authority is unverified.'],
    sources,
    queries,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}
