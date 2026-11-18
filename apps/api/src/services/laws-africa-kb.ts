// Laws.Africa Knowledge Bases (https://developers.laws.africa/knowledge-bases):
// hosted retrieval over maintained South African legislation and judgments.
// Laws.Africa runs text and semantic search and returns the matching
// portions with their public source links, which research then treats like
// passages from our own corpus: the model may only cite what was retrieved.
//
// Enabled only when all three hold:
// - LAWS_AFRICA_TOKEN is set (the platform account's API token);
// - LAWS_AFRICA_KB_CODES lists the Knowledge Base codes to search;
// - the source is registered and approved, with the terms of that account:
//   `ops sources add --code laws-africa-kb ...`.
//
// Only the de-identified search queries are sent; nothing about the client.
import { and, eq } from 'drizzle-orm';
import type { SourceKind } from '@ahava88/shared';
import { db } from '../db/client';
import { legalSources } from '../db/schema';
import type { SearchHit } from './corpus.service';

export const KB_SOURCE_CODE = 'laws-africa-kb';
const API = 'https://api.laws.africa/ai/v1/knowledge-bases';
const TIMEOUT_MS = 20_000;
const MAX_TEXT = 2500;

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface KbResult {
  content?: { text?: string };
  metadata?: {
    title?: string;
    work_frbr_uri?: string;
    expression_frbr_uri?: string;
    public_url?: string;
    portion_title?: string;
    portion_public_url?: string;
    expression_date?: string;
    date?: string;
    court?: string;
    citation?: string;
  };
  score?: number;
}

export function kbCodes(env: NodeJS.ProcessEnv = process.env): string[] {
  return String(env.LAWS_AFRICA_KB_CODES ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
}

/** Authority from a South African court in the citation or link (ZACC, ZASCA, …). */
export function authorityOf(kind: SourceKind, text: string): number {
  if (kind !== 'case_law') return 4;
  if (/\bZACC\b|\/zacc\//i.test(text)) return 1;
  if (/\bZASCA\b|\/zasca\//i.test(text)) return 2;
  return 3;
}

/** A Knowledge Base result as a passage research can cite. */
export function toHit(code: string, result: KbResult): SearchHit | null {
  const meta = result.metadata ?? {};
  const text = (result.content?.text ?? '').replace(/\s+/g, ' ').trim();
  const url = meta.portion_public_url || meta.public_url || '';
  if (!text || !url) return null;
  const kind: SourceKind =
    /judg/i.test(code) || /\/judgment\//.test(meta.work_frbr_uri ?? '')
      ? 'case_law'
      : 'legislation';
  const title = meta.title || meta.work_frbr_uri || 'Untitled';
  const citation = meta.citation || title;
  const date = meta.expression_date || meta.date || null;
  return {
    key: `${KB_SOURCE_CODE}:${url}`,
    rank: typeof result.score === 'number' ? result.score : 0,
    kind,
    sourceName: 'Laws.Africa',
    title,
    citation,
    pinpoint: meta.portion_title ?? '',
    url,
    versionDate: date,
    authorityLevel: authorityOf(kind, `${citation} ${meta.work_frbr_uri ?? ''}`),
    court: meta.court ?? '',
    validity: 'in_force',
    effectiveDate: date,
    text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)} …` : text,
  };
}

/** Whether Knowledge Base retrieval is configured and the source approved. */
export async function kbEnabled(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!env.LAWS_AFRICA_TOKEN || !kbCodes(env).length) return false;
  const [source] = await db()
    .select({ id: legalSources.id })
    .from(legalSources)
    .where(and(eq(legalSources.code, KB_SOURCE_CODE), eq(legalSources.status, 'approved')))
    .limit(1);
  return Boolean(source);
}

export interface KbRetrieval {
  hits: SearchHit[];
  /** Knowledge Bases that could not be searched, with why. */
  failures: string[];
}

/**
 * Searches each configured Knowledge Base with the first queries. Calls are
 * counted against the account's daily limit, so only a few queries are sent.
 */
export async function retrieveFromKnowledgeBases(
  queries: string[],
  options: { env?: NodeJS.ProcessEnv; fetcher?: Fetcher; topK?: number; maxQueries?: number } = {},
): Promise<KbRetrieval> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const token = env.LAWS_AFRICA_TOKEN ?? '';
  const maxQueries = options.maxQueries ?? (Number(env.LAWS_AFRICA_KB_QUERIES) || 2);
  const hits = new Map<string, SearchHit>();
  const failures: string[] = [];
  for (const code of kbCodes(env)) {
    for (const text of queries.slice(0, maxQueries)) {
      try {
        const res = await fetcher(`${API}/${encodeURIComponent(code)}/retrieve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            top_k: options.topK ?? 5,
            ...(/judg/i.test(code) ? {} : { filters: { repealed: false } }),
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          failures.push(`${code}: HTTP ${res.status}`);
          break;
        }
        const body = (await res.json()) as { results?: KbResult[] };
        for (const result of body.results ?? []) {
          const hit = toHit(code, result);
          if (hit && !hits.has(hit.key)) hits.set(hit.key, hit);
        }
      } catch (error) {
        failures.push(`${code}: ${error instanceof Error ? error.message : 'request failed'}`);
        break;
      }
    }
  }
  return { hits: [...hits.values()].sort((a, b) => b.rank - a.rank), failures };
}
