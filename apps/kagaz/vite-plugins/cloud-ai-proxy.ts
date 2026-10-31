import { execFile } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Demo-only cloud AI proxy (ADR-023): `/api/ai/*` on the Vite dev server,
 * forwarding to Google Vertex AI with the developer's gcloud
 * application-default credentials. The browser never sees a credential — it
 * only ever talks to its own origin — and nothing here exists in a build
 * (`apply: 'serve'`), so a release can never contain it. A real product needs
 * a real backend in this spot.
 *
 *  - GET  /api/ai/health  → {ok, project, chatModel, embeddingModel}
 *  - POST /api/ai/chat    → Vertex OpenAI-compatible chat completions (streams)
 *  - POST /api/ai/embed   → {texts, kind} → {embeddings} (text-embedding-005)
 *
 * [SEC] Same-origin + JSON only (blocks other web pages from spending the
 * developer's credentials through localhost); the model is pinned server-side;
 * bodies are never logged; upstream errors never echo the token.
 */

export interface CloudProxyDeps {
  getToken: () => Promise<string>;
  project: string;
  chatModel: string;
  embeddingModel: string;
  fetchImpl?: typeof fetch;
}

const MAX_BODY_BYTES = 30 * 1024 * 1024; // a few page images as base64
const MAX_EMBED_TEXTS = 256;
const EMBED_BATCH = 20; // Vertex predict limit per request
const MAX_EMBED_CHARS = 6000;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('body too large');
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Rejects requests that did not come from this page itself. */
function sameOriginOnly(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) {
    return 'cross-origin request refused';
  }
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') {
    return 'cross-site request refused';
  }
  return null;
}

export function createCloudProxyHandler(deps: CloudProxyDeps) {
  const doFetch = deps.fetchImpl ?? fetch;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = (req.url ?? '').split('?')[0];
    const refusal = sameOriginOnly(req);
    if (refusal) {
      return send(res, 403, { error: refusal });
    }

    try {
      if (req.method === 'GET' && path === '/health') {
        await deps.getToken(); // proves the credentials work, without exposing them
        return send(res, 200, {
          ok: true,
          project: deps.project,
          chatModel: deps.chatModel,
          embeddingModel: deps.embeddingModel,
        });
      }
      if (req.method !== 'POST' || (path !== '/chat' && path !== '/embed')) {
        return send(res, 404, { error: 'not found' });
      }
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
        return send(res, 415, { error: 'application/json required' });
      }
      const parsed = JSON.parse(await readBody(req)) as Record<string, unknown>;
      const token = await deps.getToken();
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      if (path === '/chat') {
        const upstream = await doFetch(
          `https://aiplatform.googleapis.com/v1/projects/${deps.project}/locations/global/endpoints/openapi/chat/completions`,
          { method: 'POST', headers, body: JSON.stringify({ ...parsed, model: deps.chatModel }) }
        );
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
        if (!upstream.body) {
          return void res.end();
        }
        for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
          res.write(chunk);
        }
        return void res.end();
      }

      // /embed
      const texts = parsed.texts;
      if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_EMBED_TEXTS || !texts.every((t) => typeof t === 'string')) {
        return send(res, 400, { error: `texts must be 1-${MAX_EMBED_TEXTS} strings` });
      }
      const taskType = parsed.kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
      const embeddings: number[][] = [];
      for (let i = 0; i < texts.length; i += EMBED_BATCH) {
        const batch = (texts).slice(i, i + EMBED_BATCH);
        const upstream = await doFetch(
          `https://us-central1-aiplatform.googleapis.com/v1/projects/${deps.project}/locations/us-central1/publishers/google/models/${deps.embeddingModel}:predict`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              instances: batch.map((content) => ({ content: content.slice(0, MAX_EMBED_CHARS), task_type: taskType })),
            }),
          }
        );
        if (!upstream.ok) {
          return send(res, 502, { error: `Vertex embeddings failed: HTTP ${upstream.status}` });
        }
        const json = (await upstream.json()) as { predictions?: { embeddings: { values: number[] } }[] };
        for (const p of json.predictions ?? []) {
          embeddings.push(p.embeddings.values);
        }
      }
      if (embeddings.length !== texts.length) {
        return send(res, 502, { error: 'Vertex returned an unexpected number of embeddings' });
      }
      return send(res, 200, { embeddings });
    } catch (error) {
      return send(res, 502, { error: error instanceof Error ? error.message : 'proxy error' });
    }
  };
}

function gcloud(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gcloud', args, (error, stdout) => (error ? reject(new Error('gcloud failed — run: gcloud auth application-default login')) : resolve(stdout.trim())));
  });
}

/** gcloud application-default token, cached ~45 min (they last 60). */
export function gcloudTokenProvider(run: (args: string[]) => Promise<string> = gcloud): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (!cached || Date.now() > cached.expiresAt) {
      cached = { token: await run(['auth', 'application-default', 'print-access-token']), expiresAt: Date.now() + 45 * 60_000 };
    }
    return cached.token;
  };
}

export function cloudAiProxy(enabled: boolean): Plugin {
  return {
    name: 'kagaz-cloud-ai-proxy',
    apply: 'serve',
    async configureServer(server) {
      if (!enabled) {
        return;
      }
      const project = process.env.GCP_PROJECT ?? (await gcloud(['config', 'get-value', 'project']).catch(() => ''));
      if (!project) {
        server.config.logger.warn('[cloud-ai] no GCP project: set GCP_PROJECT or `gcloud config set project`');
      }
      const handler = createCloudProxyHandler({
        getToken: gcloudTokenProvider(),
        project,
        chatModel: process.env.CLOUD_CHAT_MODEL ?? 'google/gemini-2.5-flash',
        embeddingModel: process.env.CLOUD_EMBEDDING_MODEL ?? 'text-embedding-005',
      });
      server.middlewares.use('/api/ai', (req, res) => void handler(req, res));
      server.config.logger.info(`[cloud-ai] Vertex AI proxy on /api/ai (project ${project || '?'})`);
    },
  };
}
