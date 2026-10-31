/** Client for the same-origin demo proxy (`/api/ai/*`, see vite-plugins/cloud-ai-proxy.ts). */

export type FetchLike = typeof fetch;

export const CLOUD_AI_BASE = '/api/ai';

export interface CloudHealth {
  ok: boolean;
  project: string;
  chatModel: string;
  embeddingModel: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string | { message?: string } };
    const error = typeof body.error === 'string' ? body.error : body.error?.message;
    return error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function cloudHealth(fetchImpl: FetchLike = fetch): Promise<CloudHealth> {
  const response = await fetchImpl(`${CLOUD_AI_BASE}/health`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as CloudHealth;
}

export async function cloudPost<T>(path: string, body: unknown, fetchImpl: FetchLike = fetch): Promise<T> {
  const response = await fetchImpl(`${CLOUD_AI_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Cloud AI ${path} failed: ${await readError(response)}`);
  }
  return (await response.json()) as T;
}

/** POSTs a streaming chat request and yields each parsed OpenAI-format `data:` chunk until `[DONE]`. */
export async function* cloudChatStream<T>(body: unknown, fetchImpl: FetchLike = fetch): AsyncGenerator<T> {
  const response = await fetchImpl(`${CLOUD_AI_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(body as object), stream: true }),
  });
  if (!response.ok) {
    throw new Error(`Cloud AI /chat failed: ${await readError(response)}`);
  }
  if (!response.body) {
    throw new Error('Cloud AI stream had no body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of event.split('\n')) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            return;
          }
          if (data) {
            yield JSON.parse(data) as T;
          }
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
    if (done) {
      return;
    }
  }
}
