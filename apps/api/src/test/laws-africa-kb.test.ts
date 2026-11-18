// Laws.Africa Knowledge Base retrieval: results become citable passages,
// only de-identified queries are sent, failures are reported as gaps, and
// nothing is searched unless the token, the codes and an approved source exist.
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { setAiClient } from '../lib/ai-client';
import { upsertSource } from '../services/corpus.service';
import {
  KB_SOURCE_CODE,
  authorityOf,
  kbEnabled,
  retrieveFromKnowledgeBases,
  toHit,
} from '../services/laws-africa-kb';
import { answerBrief } from '../services/research-run';
import { inDefaultFirm } from './helpers';

const ENV = {
  LAWS_AFRICA_TOKEN: 'test-token',
  LAWS_AFRICA_KB_CODES: 'legislation-za, judgments-za',
};

const RESULT = {
  content: { text: 'No one may be evicted from their home without an order of court.' },
  metadata: {
    title: 'Constitution of the Republic of South Africa, 1996',
    work_frbr_uri: '/akn/za/act/1996/constitution',
    public_url: 'https://lawlibrary.org.za/akn/za/act/1996/constitution',
    portion_title: 'Section 26 - Housing',
    portion_public_url: 'https://lawlibrary.org.za/akn/za/act/1996/constitution#sec_26',
  },
  score: 0.42,
};

const JUDGMENT = {
  content: { text: 'An eviction order must be just and equitable.' },
  metadata: {
    title: 'Port Elizabeth Municipality v Various Occupiers [2004] ZACC 7',
    work_frbr_uri: '/akn/za/judgment/zacc/2004/7',
    public_url: 'https://lawlibrary.org.za/akn/za/judgment/zacc/2004/7',
  },
  score: 0.3,
};

function fakeFetch(respond: (code: string) => Response) {
  const calls: Array<{ url: string; body: Record<string, unknown>; auth: string }> = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    calls.push({ url, body: JSON.parse(String(init?.body)), auth: headers.Authorization ?? '' });
    return respond(url.split('/').at(-2) ?? '');
  };
  return { fetcher, calls };
}

const ok = (results: unknown[]) =>
  new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('a result becomes a citable passage with its public link and authority', () => {
  expect(toHit('legislation-za', RESULT)).toMatchObject({
    kind: 'legislation',
    sourceName: 'Laws.Africa',
    title: 'Constitution of the Republic of South Africa, 1996',
    pinpoint: 'Section 26 - Housing',
    url: 'https://lawlibrary.org.za/akn/za/act/1996/constitution#sec_26',
    authorityLevel: 4,
  });
  expect(toHit('judgments-za', JUDGMENT)).toMatchObject({ kind: 'case_law', authorityLevel: 1 });
  expect(authorityOf('case_law', '[2019] ZASCA 12')).toBe(2);
  expect(authorityOf('case_law', '[2020] ZAGPPHC 5')).toBe(3);
  expect(toHit('legislation-za', { content: { text: 'x' }, metadata: {} })).toBeNull();
});

test('sends only the queries, with the token, to each Knowledge Base', async () => {
  const { fetcher, calls } = fakeFetch((code) =>
    ok(code === 'judgments-za' ? [JUDGMENT] : [RESULT]),
  );
  const out = await retrieveFromKnowledgeBases(
    ['eviction without court order', 'second', 'third'],
    {
      env: ENV,
      fetcher,
    },
  );
  // Two Knowledge Bases × the first two queries.
  expect(calls).toHaveLength(4);
  expect(calls[0]).toMatchObject({
    url: 'https://api.laws.africa/ai/v1/knowledge-bases/legislation-za/retrieve',
    auth: 'Bearer test-token',
    body: { text: 'eviction without court order', top_k: 5, filters: { repealed: false } },
  });
  expect(calls[2]?.body).not.toHaveProperty('filters');
  // Duplicates (the same portion twice) are kept once, best first.
  expect(out.hits.map((hit) => hit.title)).toEqual([
    'Constitution of the Republic of South Africa, 1996',
    'Port Elizabeth Municipality v Various Occupiers [2004] ZACC 7',
  ]);
  expect(out.failures).toEqual([]);
});

test('a failing Knowledge Base is reported, not hidden', async () => {
  const { fetcher } = fakeFetch((code) =>
    code === 'judgments-za' ? new Response('limit', { status: 429 }) : ok([RESULT]),
  );
  const out = await retrieveFromKnowledgeBases(['eviction'], { env: ENV, fetcher });
  expect(out.hits).toHaveLength(1);
  expect(out.failures).toEqual(['judgments-za: HTTP 429']);
});

beforeAll(() => {
  setAiClient({
    provider: 'fake',
    complete: async (req) => ({
      text: req.system.startsWith('You plan')
        ? JSON.stringify({ queries: ['eviction without a court order'] })
        : JSON.stringify({
            claims: [{ text: 'Eviction from a home needs a court order.', citations: ['S1'] }],
            gaps: [],
          }),
      provider: 'fake',
      model: 'fake-research',
      inputTokens: 10,
      outputTokens: 10,
      stopReason: 'end_turn',
    }),
  });
});

test('research uses Knowledge Base passages once the source is approved', async () => {
  vi.stubEnv('LAWS_AFRICA_TOKEN', ENV.LAWS_AFRICA_TOKEN);
  vi.stubEnv('LAWS_AFRICA_KB_CODES', 'legislation-za');
  const { fetcher, calls } = fakeFetch(() => ok([RESULT]));
  vi.stubGlobal('fetch', fetcher);

  // Not registered yet: nothing is sent to Laws.Africa.
  expect(await inDefaultFirm(() => kbEnabled())).toBe(false);
  await upsertSource({
    code: KB_SOURCE_CODE,
    name: 'Laws.Africa Knowledge Bases',
    kind: 'legislation',
    licence: 'Laws.Africa Legal Knowledge Platform terms (test)',
    approvedBy: 'ops@platform.test',
  });
  expect(await inDefaultFirm(() => kbEnabled())).toBe(true);

  const answer = await inDefaultFirm(() =>
    answerBrief('Can an occupier be evicted without a court order?', {
      subjectId: '00000000-0000-0000-0000-000000000001',
      actor: {},
    }),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]?.body.text).toBe('eviction without a court order');
  expect(answer.sources[0]).toMatchObject({ ref: 'S1', sourceName: 'Laws.Africa' });
  expect(answer.claims[0]?.citations).toEqual(['S1']);
});
