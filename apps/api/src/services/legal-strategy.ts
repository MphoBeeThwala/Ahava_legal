// The South African legal strategy engine: one assessment pipeline, with a
// strategy cartridge per practice area (lib/legal-strategies).
//
// 1. Routing: detectPracticeArea() picks the primary practice area and any
//    overlap from the intake form, the triage type and the notes, documents
//    and charge sheet.
// 2. Planning: the model lists the charges, claims or transaction steps and
//    short search queries (from the de-identified brief only).
// 3. Retrieval: the firm's approved corpus, then Laws.Africa where enabled,
//    for those queries and the cartridges' seed queries.
// 4. Assessment: the model reasons with the cartridges' statutes, curated
//    authorities, deadline rules and guardrails, and the retrieved passages.
// 5. Checks in code (roadmap §7):
//    - authorities: "verified" only when a retrieved passage names them;
//      "curated" when on the cartridge's list; otherwise "unverified";
//    - deadlines: recomputed from the cartridge's date rules when the rule
//      and the trigger date are known, and graded overdue / urgent / upcoming;
//    - guardrails: each cartridge's checks remove dangerous advice; generic
//      POPIA text and questions the intake already answers are dropped;
//    - standing warnings are always shown.
//
// A failed or malformed answer is an error the user sees; there is no rules
// fallback.
import { z } from 'zod';
import {
  PRACTICE_AREA_LABELS,
  type AuthorityReference,
  type CitedSource,
  type DeadlineAlert,
  type MeritItem,
  type PracticeAreaId,
  type StrategyAssessment,
} from '@ahava88/shared';
import {
  CARTRIDGES,
  detectPracticeArea,
  type PracticeAreaDetection,
  type PracticeAreaSignals,
  type StrategyCartridge,
} from '../lib/legal-strategies';
import { parseDate } from '../drafting/days';
import { callModelForJson, type CallContext } from './ai.service';
import { alreadyAnswered } from './answered-facts';
import { retrieveSources, sourceText } from './research-run';

export { detectPracticeArea };
export type { PracticeAreaDetection, PracticeAreaSignals };

// ------------------------------------------------------------------ prompts

const PLAN_SYSTEM = [
  'You prepare a legal strategy assessment for a South African attorney.',
  'The intake is de-identified: people appear as tokens such as [Client]; never put tokens or guesses about people into queries.',
  'Return one JSON object: {"items": string[] (each charge, claim, defence or transaction step to assess, e.g. "Count 1: Assault GBH", "Claim: unfair dismissal for misconduct", "Transfer: bond approval condition"),',
  '"queries": string[] (3 to 6 short keyword queries, 2-8 words, naming statutes, rules, doctrines and remedies likely to matter)}.',
].join(' ');

const BASE_SYSTEM = `You are a senior South African litigation and transactional strategist advising an attorney. The attorney decides; you give the analysis a senior advocate or senior partner would give at a first consultation.

INPUT
- A de-identified intake: people appear as tokens such as [Client]. Keep tokens exactly as they are; never guess who anyone is.
- The practice areas below, with their statutes, curated authorities, deadline rules and guardrails.
- Numbered source passages [S1], [S2]... retrieved from the firm's approved legal sources.

REASON FIRST, THEN ANSWER
1. Forum and jurisdiction: the right forum, the court's or tribunal's jurisdiction, who bears the burden of proof and to what standard.
2. Fact audit: confirmed facts (given in the intake, charge sheet or documents; take as given), facts requiring objective corroboration, and critical gaps (genuinely unknown and material).
3. Merit and element matrix: for every charge, claim, defence or transaction step, each element against our client's version, a viability rating (high, moderate or high-risk) with reasons, where the other side will attack, and fallback or alternative positions (competent verdicts, alternative claims, renegotiation).
4. Deadlines: every time bar or prescription period that may apply. Use the rule ids given below where one fits, with the trigger date as YYYY-MM-DD if the intake gives it.
5. Strategy roadmap: immediate actions in the first 72 hours; the settlement or ADR path; the litigation or execution blueprint.

AUTHORITY
- Prefer the numbered passages. When an authority appears in a passage, list it with that passage's reference in "sources".
- You may rely on the curated authorities listed for the practice area, and on statutes you are certain of; leave "sources" empty for those.
- Never invent a case name, a citation, a page or a quotation. Give no law report citation unless it appears in a passage. If unsure, state the principle without naming a case.

HARD RULES
- NEVER ask for, or list as a gap, a fact the intake already gives (dates, amounts, previous convictions, the court, the charges, the parties' roles).
- No generic POPIA, privacy or administrative boilerplate unless it bears directly on privilege or evidence.
- Do not pad. Every item must be specific to these facts.

OUTPUT
Return one JSON object and nothing else:
{
  "forumAndJurisdiction": {"forum": string, "jurisdiction": string, "burdenOfProof": string},
  "caseTheory": string (at most 150 words),
  "factAudit": {"confirmedFacts": string[], "corroborationRequired": string[], "criticalGaps": string[]},
  "meritAndElementMatrix": [{
    "item": string,
    "kind": "charge" | "claim" | "defence" | "transaction" | "issue",
    "elements": [{"element": string, "burden": string, "ourVersion": string, "assessment": string}],
    "viability": "high" | "moderate" | "high-risk",
    "viabilityReasoning": string,
    "opposingAttackVectors": string[],
    "fallbackAlternatives": string[]
  }],
  "deadlinesAndPrescriptionAlerts": [{"ruleId": string | null, "rule": string, "trigger": string, "triggerDate": string | null, "deadline": string | null, "authority": string, "note": string}],
  "precedentAndStatutoryAuthorities": [{"authority": string, "principle": string, "appliesTo": string, "sources": string[]}],
  "winningStrategyRoadmap": {"immediateActions_0_to_72h": string[], "settlementOrADRPath": string[], "litigationOrExecutionBlueprint": string[]},
  "tacticalWarnings": string[]
}`;

function cartridgeSection(cartridge: StrategyCartridge, role: 'primary' | 'secondary'): string {
  return [
    `PRACTICE AREA (${role}): ${cartridge.label}`,
    `Forums: ${cartridge.forums}`,
    `Burden of proof: ${cartridge.burdenOfProof}`,
    `How to analyse: ${cartridge.analysis}`,
    'Governing statutes and rules:',
    ...cartridge.governingStatutesAndRules.map((s) => `- ${s.name}: ${s.provisions}`),
    'Curated authorities (names only; give no report citation unless a passage has it):',
    ...cartridge.verifiedPrecedents.map((p) => `- ${p.authority}: ${p.principle}`),
    'Deadline rules (use these ids):',
    ...cartridge.prescriptionAndDeadlineChecks.map(
      (d) => `- ${d.id}: ${d.label}. Runs from: ${d.trigger}. ${d.authority}`,
    ),
    'Guardrails (never break these):',
    ...cartridge.tacticalGuardrails.map((g) => `- ${g}`),
  ].join('\n');
}

export function strategySystemPrompt(primary: PracticeAreaId, secondary: PracticeAreaId[]): string {
  return [
    BASE_SYSTEM,
    cartridgeSection(CARTRIDGES[primary], 'primary'),
    ...secondary.map((id) => cartridgeSection(CARTRIDGES[id], 'secondary')),
  ].join('\n\n');
}

// ------------------------------------------------------------------ schema

const text = z.preprocess((value) => (value == null ? '' : String(value).trim()), z.string());
const nullableText = z.preprocess(
  (value) => (value == null || String(value).trim() === '' ? null : String(value).trim()),
  z.string().nullable(),
);
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
const viability = z.preprocess(
  (value) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[\s_]+/g, '-'),
  z.enum(['high', 'moderate', 'high-risk']).catch('moderate'),
);
const kind = z.preprocess(
  (value) => String(value ?? '').toLowerCase(),
  z.enum(['charge', 'claim', 'defence', 'transaction', 'issue']).catch('issue'),
);

/** The model's answer, leniently parsed (missing parts become empty). */
export const strategyAnswerSchema = z.object({
  forumAndJurisdiction: z
    .object({ forum: text, jurisdiction: text, burdenOfProof: text })
    .catch({ forum: '', jurisdiction: '', burdenOfProof: '' }),
  caseTheory: text,
  factAudit: z
    .object({ confirmedFacts: list, corroborationRequired: list, criticalGaps: list })
    .catch({ confirmedFacts: [], corroborationRequired: [], criticalGaps: [] }),
  meritAndElementMatrix: objects(
    z.object({
      item: text,
      kind,
      elements: objects(
        z.object({ element: text, burden: text, ourVersion: text, assessment: text }),
      ),
      viability,
      viabilityReasoning: text,
      opposingAttackVectors: list,
      fallbackAlternatives: list,
    }),
  ),
  deadlinesAndPrescriptionAlerts: objects(
    z.object({
      ruleId: nullableText,
      rule: text,
      trigger: text,
      triggerDate: nullableText,
      deadline: nullableText,
      authority: text,
      note: text,
    }),
  ),
  precedentAndStatutoryAuthorities: objects(
    z.object({ authority: text, principle: text, appliesTo: text, sources: list }),
  ),
  winningStrategyRoadmap: z
    .object({
      immediateActions_0_to_72h: list,
      settlementOrADRPath: list,
      litigationOrExecutionBlueprint: list,
    })
    .catch({
      immediateActions_0_to_72h: [],
      settlementOrADRPath: [],
      litigationOrExecutionBlueprint: [],
    }),
  tacticalWarnings: list,
});

export type StrategyAnswer = z.infer<typeof strategyAnswerSchema>;

// ------------------------------------------------------------------ checks

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9()]+/g, ' ')
    .trim();

/** The distinctive part of an authority's name ("S v Trainor" → "trainor"). */
export function authorityKey(name: string): string {
  const cleaned = normalise(name)
    .replace(/\b(s|the state|state) v\b/g, ' ')
    .replace(/\b(ex parte|in re|minister van justisie|die|of|the|act|no|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.split(' ').filter((word) => word.length > 2)[0] ?? cleaned;
}

/** Grades each authority: verified (in a retrieved passage), curated, or unverified. */
export function checkAuthorities(
  items: Array<{ authority: string; principle: string; appliesTo?: string; sources: string[] }>,
  sources: CitedSource[],
  cartridges: StrategyCartridge[],
): AuthorityReference[] {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const curated = new Set(
    cartridges.flatMap((c) => c.verifiedPrecedents.map((p) => authorityKey(p.authority))),
  );
  return items
    .filter((item) => item.authority)
    .map((item) => {
      const key = authorityKey(item.authority);
      const named = [
        ...new Set(item.sources.map((ref) => ref.replace(/[[\]\s]/g, '').toUpperCase())),
      ].filter((ref) => {
        const source = byRef.get(ref);
        return (
          source && normalise(`${source.citation} ${source.title} ${source.text}`).includes(key)
        );
      });
      return {
        authority: item.authority,
        principle: item.principle,
        appliesTo: item.appliesTo ?? '',
        sources: named,
        status: named.length ? 'verified' : curated.has(key) ? 'curated' : 'unverified',
      } satisfies AuthorityReference;
    });
}

/** Today in South Africa (YYYY-MM-DD). */
export function todayInSouthAfrica(now = new Date()): string {
  return new Date(now.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
}

const STATUS_ORDER: Record<DeadlineAlert['status'], number> = {
  overdue: 0,
  urgent: 1,
  upcoming: 2,
  unknown: 3,
};

/** Recomputes deadlines from the cartridges' rules and grades them against today. */
export function checkDeadlines(
  alerts: StrategyAnswer['deadlinesAndPrescriptionAlerts'],
  cartridges: StrategyCartridge[],
  today: string,
): DeadlineAlert[] {
  const rules = new Map(
    cartridges.flatMap((c) => c.prescriptionAndDeadlineChecks).map((rule) => [rule.id, rule]),
  );
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 7);
  const urgentBy = soon.toISOString().slice(0, 10);
  return alerts
    .filter((alert) => alert.rule || alert.ruleId)
    .map((alert) => {
      const rule = alert.ruleId ? rules.get(alert.ruleId) : undefined;
      const triggerDate =
        alert.triggerDate && parseDate(alert.triggerDate) ? alert.triggerDate : null;
      const computed = rule?.compute && triggerDate ? rule.compute(triggerDate) : null;
      const given = alert.deadline && parseDate(alert.deadline) ? alert.deadline : null;
      const deadline = computed ?? given;
      const status: DeadlineAlert['status'] = !deadline
        ? 'unknown'
        : deadline < today
          ? 'overdue'
          : deadline <= urgentBy
            ? 'urgent'
            : 'upcoming';
      return {
        ruleId: rule ? rule.id : null,
        rule: alert.rule || rule?.label || '',
        trigger: alert.trigger || rule?.trigger || '',
        triggerDate,
        deadline,
        computed: computed !== null,
        status,
        authority: rule?.authority || alert.authority,
        note: alert.note,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        String(a.deadline).localeCompare(String(b.deadline)),
    );
}

const POPIA_BOILERPLATE = (item: string) =>
  /\bPOPIA\b|Protection of Personal Information/i.test(item) && !/privilege/i.test(item);

/** Applies every guardrail to a parsed answer; see the file header. */
export function guardStrategy(
  answer: StrategyAnswer,
  detection: { primary: PracticeAreaId; secondary: PracticeAreaId[] },
  sources: CitedSource[],
  brief: string,
  today = todayInSouthAfrica(),
): Omit<StrategyAssessment, 'sources' | 'gaps' | 'queries' | 'model' | 'generatedAt'> {
  const cartridges = [detection.primary, ...detection.secondary].map((id) => CARTRIDGES[id]);
  const adviceChecks = cartridges.flatMap((c) =>
    c.guardrailChecks.filter((check) => (check.scope ?? 'advice') === 'advice'),
  );
  const analysisChecks = cartridges.flatMap((c) =>
    c.guardrailChecks.filter((check) => check.scope === 'analysis'),
  );
  const removed: StrategyAssessment['removed'] = [];
  const keep = (items: string[], where: string): string[] =>
    items.filter((item) => {
      const broken = adviceChecks.find((check) => check.flags(item));
      if (broken) {
        removed.push({ text: item, reason: `${where}: ${broken.reason}` });
        return false;
      }
      if (POPIA_BOILERPLATE(item)) {
        removed.push({ text: item, reason: `${where}: generic POPIA text` });
        return false;
      }
      return true;
    });

  const criticalGaps = keep(answer.factAudit.criticalGaps, 'Critical gaps').filter((item) => {
    if (alreadyAnswered(item, brief)) {
      removed.push({ text: item, reason: 'Critical gaps: the intake already gives this' });
      return false;
    }
    return true;
  });

  const matrix: MeritItem[] = [];
  for (const item of answer.meritAndElementMatrix) {
    if (!item.item) continue;
    const whole = [
      item.item,
      item.viabilityReasoning,
      ...item.elements.map((e) => `${e.element} ${e.assessment}`),
    ].join(' ');
    const broken = analysisChecks.find((check) => check.flags(whole));
    if (broken) {
      removed.push({ text: item.item, reason: `Merit matrix: ${broken.reason}` });
      continue;
    }
    matrix.push({
      item: item.item,
      kind: item.kind,
      elements: item.elements.filter((e) => e.element),
      viability: item.viability,
      viabilityReasoning: item.viabilityReasoning,
      opposingAttackVectors: item.opposingAttackVectors.filter((v) => !POPIA_BOILERPLATE(v)),
      fallbackAlternatives: keep(item.fallbackAlternatives, item.item),
    });
  }

  const roadmap = answer.winningStrategyRoadmap;
  const primary = CARTRIDGES[detection.primary];
  return {
    practiceArea: { primary: detection.primary, secondary: detection.secondary },
    forumAndJurisdiction: {
      forum: answer.forumAndJurisdiction.forum || primary.forums,
      jurisdiction: answer.forumAndJurisdiction.jurisdiction,
      burdenOfProof: answer.forumAndJurisdiction.burdenOfProof || primary.burdenOfProof,
    },
    caseTheory: answer.caseTheory,
    factAudit: {
      confirmedFacts: answer.factAudit.confirmedFacts,
      corroborationRequired: keep(answer.factAudit.corroborationRequired, 'Corroboration'),
      criticalGaps,
    },
    meritAndElementMatrix: matrix,
    deadlinesAndPrescriptionAlerts: checkDeadlines(
      answer.deadlinesAndPrescriptionAlerts,
      cartridges,
      today,
    ),
    precedentAndStatutoryAuthorities: checkAuthorities(
      answer.precedentAndStatutoryAuthorities,
      sources,
      cartridges,
    ),
    winningStrategyRoadmap: {
      immediateActions_0_to_72h: keep(roadmap.immediateActions_0_to_72h, 'Immediate actions'),
      settlementOrADRPath: keep(roadmap.settlementOrADRPath, 'Settlement or ADR'),
      litigationOrExecutionBlueprint: keep(
        roadmap.litigationOrExecutionBlueprint,
        'Litigation or execution',
      ),
    },
    tacticalWarnings: [
      ...new Set([
        ...cartridges.flatMap((c) => c.standingWarnings),
        ...keep(answer.tacticalWarnings, 'Tactical warnings'),
      ]),
    ],
    removed,
  };
}

// ------------------------------------------------------------------ run

const cleanQuery = (query: unknown) =>
  String(query)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Runs planning, retrieval, assessment and the checks over a de-identified brief. */
export async function assessStrategy(
  brief: string,
  detection: { primary: PracticeAreaId; secondary: PracticeAreaId[] },
  context: Omit<CallContext, 'purpose'>,
): Promise<StrategyAssessment> {
  const call = { ...context, purpose: 'triage' as const };
  const cartridges = [detection.primary, ...detection.secondary].map((id) => CARTRIDGES[id]);
  const areas = `Practice areas: ${cartridges.map((c) => c.label).join('; ')}`;
  const { value: planned } = await callModelForJson<{ items?: unknown; queries?: unknown }>(
    {
      model: 'research',
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: `${areas}\n\n${brief}` }],
      maxTokens: 600,
      temperature: 0,
    },
    call,
  );
  const items = (Array.isArray(planned.items) ? planned.items : []).map(String).slice(0, 12);
  const queries = [
    ...new Set(
      [
        ...(Array.isArray(planned.queries) ? planned.queries : []).slice(0, 6),
        ...cartridges.flatMap((c) => c.seedQueries.slice(0, c.id === detection.primary ? 5 : 2)),
      ]
        .map(cleanQuery)
        .filter(Boolean),
    ),
  ].slice(0, 12);

  const { sources, gaps } = await retrieveSources(queries, 14);
  const passages = sources.length
    ? `Source passages:\n\n${sources.map(sourceText).join('\n\n')}`
    : 'Source passages: none were found in the approved sources.';
  const { result, value } = await callModelForJson<unknown>(
    {
      model: 'research',
      system: strategySystemPrompt(detection.primary, detection.secondary),
      messages: [
        {
          role: 'user',
          content: [
            areas,
            brief,
            items.length ? `Items to assess:\n${items.map((i) => `- ${i}`).join('\n')}` : '',
            `Today is ${todayInSouthAfrica()}.`,
            passages,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      // Long enough for a full matrix; providers with a lower limit are capped.
      maxTokens: 12000,
      temperature: 0,
    },
    call,
  );
  const answer = strategyAnswerSchema.parse(value);
  return {
    ...guardStrategy(answer, detection, sources, brief),
    gaps: sources.length
      ? gaps
      : [...gaps, 'No passage in the approved sources matched: no authority is verified.'],
    sources,
    queries,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}

export { PRACTICE_AREA_LABELS };
