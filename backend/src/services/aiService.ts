// ============================================================================
// AI Service — Multi-Provider Generation Engine
// Ported from CravenDesignHQ/services/geminiService.ts and adapted for
// server-side use with environment-variable API keys.
// ============================================================================

// ---------------------------------------------------------------------------
// Retry helper with exponential back-off (rate-limit aware)
// ---------------------------------------------------------------------------
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    const status =
      (error as Record<string, number | undefined>)?.status ??
      (error as Record<string, Record<string, number | undefined>>)?.response?.status;
    const message = (error as Error)?.message ?? '';

    if (
      retries > 0 &&
      (status === 429 ||
        status === 503 ||
        message.includes('429') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('UNAVAILABLE'))
    ) {
      const nextDelay = Math.min(delay * 2, 8000);
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retry(fn, retries - 1, nextDelay);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Robust JSON parser (handles markdown fences, brace-counting, etc.)
// ---------------------------------------------------------------------------
export function cleanAndParseJSON(text: string): unknown {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(text);
  } catch (_e) {
    // continue
  }

  // Strategy 2: Markdown block extraction
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (_e2) {
      console.error('Failed to parse inner JSON from markdown block');
    }
  }

  // Strategy 3: Robust brace / bracket counting
  const firstOpen = text.indexOf('{');
  const firstArray = text.indexOf('[');

  let startIdx = -1;
  if (firstOpen !== -1 && (firstArray === -1 || firstOpen < firstArray)) {
    startIdx = firstOpen;
  } else if (firstArray !== -1) {
    startIdx = firstArray;
  }

  if (startIdx !== -1) {
    let balance = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') balance++;
        else if (char === '}' || char === ']') balance--;

        if (balance === 0) {
          try {
            return JSON.parse(text.substring(startIdx, i + 1));
          } catch (_e) {
            // fall through
          }
          break;
        }
      }
    }
  }

  throw new Error('Could not parse JSON response from AI. The model output was likely malformed.');
}

// ---------------------------------------------------------------------------
// Provider-specific generation helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45000);

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate content via Google Gemini (REST).
 * Uses the `generativelanguage.googleapis.com` v1beta endpoint.
 */
async function generateWithGemini(
  prompt: string,
  systemInstruction: string,
  modelId: string,
  expectJson = false,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: expectJson
      ? {
          responseMimeType: 'application/json',
        }
      : undefined,
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Gemini response');
  return text;
}

/**
 * Generate content via OpenAI-compatible API.
 */
async function generateWithOpenAI(
  prompt: string,
  systemInstruction: string,
  modelId: string,
  expectJson = false,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text in OpenAI response');
  return text;
}

/**
 * Generate content via Anthropic Messages API.
 */
async function generateWithAnthropic(
  prompt: string,
  systemInstruction: string,
  modelId: string,
  _expectJson = false,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  };

  if (systemInstruction) {
    body.system = systemInstruction;
  }

  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text in Anthropic response');
  return textBlock.text;
}

/**
 * Generate content via OpenRouter (OpenAI-compatible).
 */
async function generateWithOpenRouter(
  prompt: string,
  systemInstruction: string,
  modelId: string,
  expectJson = false,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No text in OpenRouter response');
  return text;
}

// ---------------------------------------------------------------------------
// Multi-provider router
// ---------------------------------------------------------------------------

/**
 * Route a generation request to the correct AI provider based on the model ID.
 *
 * Model ID conventions:
 *   - No prefix              → Gemini   (e.g. "gemini-2.0-flash")
 *   - `openai:` prefix       → OpenAI   (e.g. "openai:gpt-4o")
 *   - `anthropic:` prefix    → Anthropic (e.g. "anthropic:claude-3-5-sonnet-20241022")
 *   - Contains `/`           → OpenRouter (e.g. "meta-llama/llama-3-70b-instruct")
 */
export async function generateWithModel(
  prompt: string,
  systemInstruction: string,
  modelId: string,
  options?: { expectJson?: boolean },
): Promise<string> {
  const expectJson = options?.expectJson ?? false;

  return retry(async () => {
    if (modelId.startsWith('openai:')) {
      const realModel = modelId.replace('openai:', '');
      return generateWithOpenAI(prompt, systemInstruction, realModel, expectJson);
    }

    if (modelId.startsWith('anthropic:')) {
      const realModel = modelId.replace('anthropic:', '');
      return generateWithAnthropic(prompt, systemInstruction, realModel, expectJson);
    }

    if (modelId.includes('/')) {
      return generateWithOpenRouter(prompt, systemInstruction, modelId, expectJson);
    }

    // Default: Gemini
    return generateWithGemini(prompt, systemInstruction, modelId, expectJson);
  });
}
