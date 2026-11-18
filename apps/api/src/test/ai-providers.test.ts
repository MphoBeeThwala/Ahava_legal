import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { CHAT_COMPLETIONS_URL, clientFromEnv } from '../lib/ai-client';
import { configWarnings, validateConfig } from '../config/env';

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

function stubFetch(answer: (url: string) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      headers: init.headers as Record<string, string>,
    });
    return answer(url);
  });
  return calls;
}

const chat = (text: string, model: string) =>
  new Response(
    JSON.stringify({
      model,
      choices: [{ message: { content: text }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    }),
    { status: 200 },
  );

const request = {
  system: 'Answer briefly.',
  messages: [{ role: 'user' as const, content: 'Hello' }],
  maxTokens: 100,
};

const geminiFirst = {
  AI_PROVIDER: 'gemini',
  AI_API_KEY: 'gemini-key',
  AI_MODEL: 'gemini-flash',
  AI_RESEARCH_MODEL: 'gemini-pro',
  AI_FALLBACK_PROVIDER: 'deepseek',
  AI_FALLBACK_API_KEY: 'deepseek-key',
  AI_FALLBACK_MODEL: 'deepseek-chat',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('Gemini answers through its OpenAI-compatible endpoint', async () => {
  const calls = stubFetch(() => chat('Hi there', 'gemini-flash'));
  const result = await clientFromEnv(geminiFirst)!.complete({ ...request, model: 'research' });
  assert.equal(result.text, 'Hi there');
  assert.equal(result.provider, 'gemini');
  assert.equal(result.inputTokens, 11);
  assert.equal(result.outputTokens, 7);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, CHAT_COMPLETIONS_URL.gemini);
  assert.equal(calls[0]!.headers.authorization, 'Bearer gemini-key');
  assert.equal(calls[0]!.body.model, 'gemini-pro');
  assert.deepEqual(calls[0]!.body.messages, [
    { role: 'system', content: 'Answer briefly.' },
    { role: 'user', content: 'Hello' },
  ]);
});

test('DeepSeek answers when Gemini fails', async () => {
  const calls = stubFetch((url) =>
    url === CHAT_COMPLETIONS_URL.gemini
      ? new Response('busy', { status: 429 })
      : chat('From DeepSeek', 'deepseek-chat'),
  );
  const result = await clientFromEnv(geminiFirst)!.complete({ ...request, model: 'research' });
  assert.equal(result.text, 'From DeepSeek');
  assert.equal(result.provider, 'deepseek');
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.url, CHAT_COMPLETIONS_URL.deepseek);
  assert.equal(calls[1]!.headers.authorization, 'Bearer deepseek-key');
  // No fallback research model is set: the fallback's own model is used.
  assert.equal(calls[1]!.body.model, 'deepseek-chat');
});

test('when both fail the user sees an error, not a made-up answer', async () => {
  stubFetch(() => new Response('down', { status: 500 }));
  await assert.rejects(
    () => clientFromEnv(geminiFirst)!.complete(request),
    /Both AI services failed/,
  );
});

test('an empty answer counts as a failure', async () => {
  stubFetch((url) => (url === CHAT_COMPLETIONS_URL.gemini ? chat('', 'x') : chat('ok', 'y')));
  const result = await clientFromEnv(geminiFirst)!.complete(request);
  assert.equal(result.provider, 'deepseek');
});

test('Claude still works on its own', async () => {
  const calls = stubFetch(
    () =>
      new Response(
        JSON.stringify({
          model: 'claude-x',
          content: [{ type: 'text', text: 'Claude here' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 3, output_tokens: 2 },
        }),
        { status: 200 },
      ),
  );
  const result = await clientFromEnv({
    AI_PROVIDER: 'anthropic',
    AI_API_KEY: 'k',
    AI_MODEL: 'claude-x',
  })!.complete(request);
  assert.equal(result.text, 'Claude here');
  assert.equal(calls[0]!.url, 'https://api.anthropic.com/v1/messages');
});

test('config checks the fallback and warns about test-only providers', () => {
  const production = {
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(48),
    INTAKE_ENCRYPTION_KEY: 'a'.repeat(64),
    AUDIT_CHAIN_SECRET: 'y'.repeat(48),
    DATABASE_URL: 'postgres://app:secret@db.example.com:5432/practice',
  };
  assert.deepEqual(validateConfig({ ...production, ...geminiFirst }), []);
  assert.ok(
    validateConfig({ ...production, ...geminiFirst, AI_FALLBACK_API_KEY: '' }).some((p) =>
      /AI_FALLBACK_PROVIDER=deepseek needs AI_FALLBACK_API_KEY/.test(p),
    ),
  );
  assert.ok(
    validateConfig({ ...production, AI_FALLBACK_PROVIDER: 'deepseek' }).some((p) =>
      /AI_PROVIDER is not/.test(p),
    ),
  );
  const warnings = configWarnings({ ...production, ...geminiFirst });
  assert.ok(warnings.some((w) => /AI_PROVIDER=gemini is for testing/.test(w)));
  assert.ok(warnings.some((w) => /AI_FALLBACK_PROVIDER=deepseek is for testing/.test(w)));
  assert.ok(!warnings.some((w) => /AI is not configured/.test(w)));
});
