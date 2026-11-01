/** Minimal JSON + NDJSON-streaming client for the Ollama REST API (no SDK dependency). */

export type FetchLike = typeof fetch;

function ensureOk(response: Response, what: string): Response {
  if (!response.ok) {
    throw new Error(`Ollama ${what} failed: HTTP ${response.status}`);
  }
  return response;
}

export async function ollamaGet<T>(baseUrl: string, path: string, fetchImpl: FetchLike = fetch): Promise<T> {
  const response = ensureOk(await fetchImpl(`${baseUrl}${path}`), `GET ${path}`);
  return (await response.json()) as T;
}

export async function ollamaPost<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  fetchImpl: FetchLike = fetch
): Promise<T> {
  const response = ensureOk(
    await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    `POST ${path}`
  );
  return (await response.json()) as T;
}

/** POSTs and yields each newline-delimited JSON object of a streaming response. */
export async function* ollamaStream<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  fetchImpl: FetchLike = fetch
): AsyncGenerator<T> {
  const response = ensureOk(
    await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    `POST ${path}`
  );
  if (!response.body) {
    throw new Error('Ollama stream had no body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        yield JSON.parse(line) as T;
      }
      newline = buffer.indexOf('\n');
    }
    if (done) {
      break;
    }
  }
  if (buffer.trim()) {
    yield JSON.parse(buffer) as T;
  }
}
