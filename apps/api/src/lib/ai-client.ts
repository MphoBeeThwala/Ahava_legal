// The one AI client interface (roadmap §7). Everything that calls a model
// goes through aiClient(), never through fetch to a provider directly.
//
// Providers (AI_PROVIDER):
// - foundry: Claude in Microsoft Foundry, at AI_ENDPOINT
//   (https://<resource>.services.ai.azure.com/anthropic). Authenticates with
//   AI_API_KEY, or with the app's managed identity (Entra ID) when no key is
//   set. The production target.
// - anthropic: the Anthropic API (development).
// - gemini: Google's Gemini API (OpenAI-compatible endpoint). Testing only.
// - deepseek: DeepSeek's API (OpenAI-compatible; data is stored in China).
//   Testing only, with made-up matters.
// - unset / none: no AI. Callers get a 503 and say so; nothing pretends to be
//   an AI answer.
//
// AI_FALLBACK_PROVIDER (with AI_FALLBACK_API_KEY and AI_FALLBACK_MODEL) names a
// second model tried when the first one fails. That is another model, not a
// rules fallback: if both fail, the user sees the error.
//
// Model IDs come from config (AI_MODEL, AI_RESEARCH_MODEL), never code.
// Failures throw: a timeout, an HTTP error or an empty answer is an error the
// user sees, not a quiet fallback.
import { DefaultAzureCredential, type TokenCredential } from '@azure/identity';
import { httpError } from './http';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  /** Which configured model: 'default' (AI_MODEL) or 'research' (AI_RESEARCH_MODEL). */
  model?: 'default' | 'research';
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface AiResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

export interface AiClient {
  readonly provider: string;
  complete(request: AiRequest): Promise<AiResult>;
}

export const AI_PROVIDERS = ['foundry', 'anthropic', 'gemini', 'deepseek'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number] | 'none';

/** Which settings a client reads: the main model (AI_*) or the fallback (AI_FALLBACK_*). */
export type AiSlot = 'primary' | 'fallback';

const PREFIX: Record<AiSlot, string> = { primary: 'AI_', fallback: 'AI_FALLBACK_' };

function setting(env: NodeJS.ProcessEnv, slot: AiSlot, name: string): string {
  return String(env[`${PREFIX[slot]}${name}`] || '').trim();
}

function parseProvider(value: string): AiProvider {
  const lower = value.toLowerCase();
  return (AI_PROVIDERS as readonly string[]).includes(lower) ? (lower as AiProvider) : 'none';
}

export function aiProvider(
  env: NodeJS.ProcessEnv = process.env,
  slot: AiSlot = 'primary',
): AiProvider {
  return parseProvider(setting(env, slot, 'PROVIDER'));
}

export function modelFor(
  kind: AiRequest['model'] = 'default',
  env = process.env,
  slot: AiSlot = 'primary',
): string {
  const model =
    (kind === 'research' ? setting(env, slot, 'RESEARCH_MODEL') : '') ||
    setting(env, slot, 'MODEL');
  if (!model) {
    throw httpError(`No AI model is configured (${PREFIX[slot]}MODEL).`, 503);
  }
  return model;
}

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 90_000;

async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw httpError(
      timedOut
        ? 'The AI service did not answer in time. Please try again.'
        : 'The AI service could not be reached. Please try again.',
      502,
    );
  }
  if (!response.ok) {
    // The body may echo the prompt; it is not logged or returned.
    throw httpError(
      response.status === 429
        ? 'The AI service is busy. Please try again in a minute.'
        : `The AI service failed (${response.status}). Please try again.`,
      502,
    );
  }
  return response;
}

function emptyAnswer(): never {
  throw httpError('The AI service returned an empty answer. Please try again.', 502);
}

interface MessagesResponse {
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Claude (Anthropic API and Foundry) speaks the Messages API; they differ in URL and credentials. */
class MessagesApiClient implements AiClient {
  constructor(
    readonly provider: 'foundry' | 'anthropic',
    private readonly url: string,
    private readonly headers: () => Promise<Record<string, string>>,
    private readonly model: (kind: AiRequest['model']) => string,
  ) {}

  async complete(request: AiRequest): Promise<AiResult> {
    const model = this.model(request.model);
    const response = await post(
      this.url,
      { 'anthropic-version': '2023-06-01', ...(await this.headers()) },
      {
        model,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0,
        system: request.system,
        messages: request.messages,
      },
    );
    const payload = (await response.json()) as MessagesResponse;
    const text = (payload.content ?? [])
      .filter((block) => block.type === undefined || block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();
    if (!text) {
      emptyAnswer();
    }
    return {
      text,
      provider: this.provider,
      model: payload.model || model,
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
      stopReason: payload.stop_reason ?? null,
    };
  }
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export const CHAT_COMPLETIONS_URL: Record<'gemini' | 'deepseek', string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
};

/** Gemini and DeepSeek speak the OpenAI Chat Completions format. */
class ChatCompletionsClient implements AiClient {
  constructor(
    readonly provider: 'gemini' | 'deepseek',
    private readonly key: string,
    private readonly model: (kind: AiRequest['model']) => string,
    private readonly reasoningEffort: string,
  ) {}

  async complete(request: AiRequest): Promise<AiResult> {
    const model = this.model(request.model);
    const response = await post(
      CHAT_COMPLETIONS_URL[this.provider],
      { authorization: `Bearer ${this.key}` },
      {
        model,
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0,
        messages: [{ role: 'system', content: request.system }, ...request.messages],
        // Gemini's thinking counts against max_tokens; keep it short so the answer fits.
        ...(this.provider === 'gemini' && this.reasoningEffort
          ? { reasoning_effort: this.reasoningEffort }
          : {}),
      },
    );
    const payload = (await response.json()) as ChatCompletionResponse;
    const choice = payload.choices?.[0];
    const text = String(choice?.message?.content ?? '').trim();
    if (!text) {
      emptyAnswer();
    }
    return {
      text,
      provider: this.provider,
      model: payload.model || model,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      stopReason: choice?.finish_reason ?? null,
    };
  }
}

/** Tries the main model, then the fallback model; the error is the user's only when both fail. */
class FallbackClient implements AiClient {
  constructor(
    private readonly primary: AiClient,
    private readonly fallback: AiClient,
  ) {}

  get provider(): string {
    return this.primary.provider;
  }

  async complete(request: AiRequest): Promise<AiResult> {
    try {
      return await this.primary.complete(request);
    } catch {
      try {
        return await this.fallback.complete(request);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Please try again.';
        throw httpError(`Both AI services failed. ${detail}`, 502);
      }
    }
  }
}

let credential: TokenCredential | null = null;

function buildOne(env: NodeJS.ProcessEnv, slot: AiSlot): AiClient | null {
  const provider = aiProvider(env, slot);
  const model = (kind: AiRequest['model']): string => modelFor(kind, env, slot);
  const key = setting(env, slot, 'API_KEY');
  if (provider === 'foundry') {
    const endpoint = setting(env, slot, 'ENDPOINT').replace(/\/+$/, '');
    if (!endpoint) {
      throw httpError('AI_ENDPOINT is not set for Microsoft Foundry.', 503);
    }
    const url = endpoint.endsWith('/v1/messages') ? endpoint : `${endpoint}/v1/messages`;
    return new MessagesApiClient(
      'foundry',
      url,
      async (): Promise<Record<string, string>> => {
        if (key) {
          return { 'api-key': key };
        }
        credential ??= new DefaultAzureCredential({
          managedIdentityClientId: env.AZURE_CLIENT_ID || undefined,
        });
        const token = await credential.getToken('https://ai.azure.com/.default');
        if (!token) {
          throw httpError('Could not get a Microsoft Entra token for the AI service.', 502);
        }
        return { authorization: `Bearer ${token.token}` };
      },
      model,
    );
  }
  if (provider === 'anthropic') {
    const anthropicKey = key || (slot === 'primary' ? String(env.ANTHROPIC_API_KEY || '') : '');
    if (!anthropicKey) {
      throw httpError(`${PREFIX[slot]}API_KEY is not set for the Anthropic API.`, 503);
    }
    return new MessagesApiClient(
      'anthropic',
      'https://api.anthropic.com/v1/messages',
      async () => ({ 'x-api-key': anthropicKey }),
      model,
    );
  }
  if (provider === 'gemini' || provider === 'deepseek') {
    if (!key) {
      throw httpError(`${PREFIX[slot]}API_KEY is not set for ${provider}.`, 503);
    }
    const effort = String(env.AI_GEMINI_REASONING_EFFORT ?? 'low').trim();
    return new ChatCompletionsClient(provider, key, model, effort);
  }
  return null;
}

function buildClient(env: NodeJS.ProcessEnv = process.env): AiClient | null {
  const primary = buildOne(env, 'primary');
  if (!primary) {
    return null;
  }
  const fallback = buildOne(env, 'fallback');
  return fallback ? new FallbackClient(primary, fallback) : primary;
}

/** Exposed for tests: the client the given settings produce. */
export function clientFromEnv(env: NodeJS.ProcessEnv): AiClient | null {
  return buildClient(env);
}

let override: AiClient | null | undefined;

/** Tests install a fake model here; production always builds from config. */
export function setAiClient(client: AiClient | null | undefined): void {
  override = client;
}

export function aiConfigured(): boolean {
  return override !== undefined ? override !== null : aiProvider() !== 'none';
}

/** The configured client; throws a 503 when AI is not set up. */
export function aiClient(): AiClient {
  if (override !== undefined) {
    if (!override) {
      throw httpError('AI is not configured for this platform.', 503);
    }
    return override;
  }
  const client = buildClient();
  if (!client) {
    throw httpError('AI is not configured for this platform.', 503);
  }
  return client;
}

/** The first JSON object in a model answer (models sometimes wrap it in prose or fences). */
export function parseJsonAnswer<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw httpError('The AI answer was not in the expected format. Please try again.', 502);
  }
}
