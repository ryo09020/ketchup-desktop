import { invoke } from '@tauri-apps/api/core';

// -------------------------------------------------------------
// AI Provider settings (BYOK: Bring Your Own Key)
// APIキーは1つだけ登録可能。プロバイダーを切り替えると上書きされる。
// -------------------------------------------------------------
export type AIProvider = 'gemini' | 'claude' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface AIModel {
  id: string;
  label: string;
}

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
};

export const AI_KEY_PLACEHOLDERS: Record<AIProvider, string> = {
  gemini: 'AIza...',
  claude: 'sk-ant-...',
  openai: 'sk-...',
};

export const AI_KEY_URLS: Record<AIProvider, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  claude: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
};

const STORAGE_KEY = 'ketchup_ai_config';
const ANTHROPIC_VERSION = '2023-06-01';

export function getAIConfig(): AIConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw) as AIConfig;
    if (!cfg.apiKey || !cfg.model) return null;
    return cfg;
  } catch {
    return null;
  }
}

export function saveAIConfig(cfg: AIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearAIConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAIConfigured(): boolean {
  return getAIConfig() !== null;
}

// -------------------------------------------------------------
// Native HTTP (Rust 経由。WebView の CORS 制約を回避)
// -------------------------------------------------------------
interface HttpResponse {
  status: number;
  body: string;
}

async function httpJson<T = any>(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<T> {
  const res = await invoke<HttpResponse>('ai_http_request', {
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : null,
  });
  return parseResponse<T>(res);
}

function parseResponse<T>(res: HttpResponse): T {
  let data: any = null;
  try {
    data = JSON.parse(res.body);
  } catch {
    data = null;
  }
  if (res.status < 200 || res.status >= 300) {
    const msg =
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : '') ||
      res.body.slice(0, 300) ||
      `HTTP ${res.status}`;
    throw new Error(`[${res.status}] ${msg}`);
  }
  return data as T;
}

// -------------------------------------------------------------
// Model listing (各社の Models API から利用可能なモデルを取得)
// -------------------------------------------------------------
export async function listModels(provider: AIProvider, apiKey: string): Promise<AIModel[]> {
  const key = apiKey.trim();
  if (!key) throw new Error('APIキーを入力してください');

  if (provider === 'openai') {
    const data = await httpJson<{ data: { id: string; created: number }[] }>(
      'GET',
      'https://api.openai.com/v1/models',
      { authorization: `Bearer ${key}` }
    );
    const exclude = /(audio|realtime|tts|transcribe|whisper|image|dall-e|embedding|moderation|search|instruct|codex|computer-use|davinci|babbage)/i;
    return data.data
      .filter((m) => /^(gpt-|o\d|chatgpt-)/i.test(m.id) && !exclude.test(m.id))
      .sort((a, b) => b.created - a.created)
      .map((m) => ({ id: m.id, label: m.id }));
  }

  if (provider === 'claude') {
    const data = await httpJson<{ data: { id: string; display_name?: string }[] }>(
      'GET',
      'https://api.anthropic.com/v1/models?limit=100',
      {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      }
    );
    return data.data.map((m) => ({ id: m.id, label: m.display_name ? `${m.display_name} (${m.id})` : m.id }));
  }

  // gemini
  const data = await httpJson<{
    models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  }>('GET', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
    'x-goog-api-key': key,
  });
  const exclude = /(embedding|aqa|imagen|veo|tts|image-generation|live|native-audio)/i;
  return (data.models || [])
    .filter(
      (m) =>
        m.name.includes('gemini') &&
        (m.supportedGenerationMethods || []).includes('generateContent') &&
        !exclude.test(m.name)
    )
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return { id, label: m.displayName ? `${m.displayName} (${id})` : id };
    })
    .reverse();
}

// -------------------------------------------------------------
// Text generation (統一インターフェース)
// -------------------------------------------------------------
export interface GenerateOptions {
  system?: string;
  maxTokens?: number;
}

export async function generateText(
  prompt: string,
  opts: GenerateOptions = {},
  config: AIConfig | null = getAIConfig()
): Promise<string> {
  if (!config) throw new Error('AIのAPIキーが設定されていません（設定 > AI 連携設定）');
  const { provider, apiKey, model } = config;
  const maxTokens = opts.maxTokens ?? 2048;

  if (provider === 'openai') {
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });
    const data = await httpJson<any>(
      'POST',
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${apiKey}` },
      // o系/新しめのモデルは max_tokens 非対応のため max_completion_tokens を使用
      { model, messages, max_completion_tokens: maxTokens }
    );
    return (data.choices?.[0]?.message?.content || '').trim();
  }

  if (provider === 'claude') {
    const data = await httpJson<any>(
      'POST',
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
      {
        model,
        max_tokens: maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }
    );
    return ((data.content || []) as { type: string; text?: string }[])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();
  }

  // gemini
  const data = await httpJson<any>(
    'POST',
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': apiKey },
    {
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }
  );
  return extractGeminiText(data);
}

function extractGeminiText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p: { text?: string }) => p.text || '')
    .join('')
    .trim();
}

// LLM の応答から JSON を取り出す（```json ... ``` 囲みにも対応）
export function extractJson<T = any>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
