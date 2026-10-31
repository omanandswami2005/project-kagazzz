// @vitest-environment node
/**
 * LIVE tests against real Google Vertex AI, through the running dev server's
 * proxy (so the proxy, the credentials flow, the engine and the registry are
 * all exercised). Skipped unless CLOUD_LIVE=1:
 *
 *   # terminal 1: VITE_CLOUD_AI=1 pnpm --filter kagaz exec vite --port 5173
 *   CLOUD_LIVE=1 pnpm --filter kagaz exec vitest run src/infrastructure/cloud-ai
 *
 * Costs a few cents of Vertex usage per run. Scenarios are shared with the
 * Ollama suite (src/test/live-harness.ts). The fixture image is synthetic.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CloudChatEngine } from '@/modules/ai-assistant/services/cloud-chat-engine';
import { createCloudVisionRecognizer } from '@/modules/image-engine/services/vision-ocr.service';
import { CloudEmbeddingProvider, InMemoryVectorStore, SemanticIndexService } from '@/modules/semantic-index';
import { livePrompt, toolScenarios, TURN_TIMEOUT } from '@/test/live-harness';

const ORIGIN = process.env.CLOUD_PROXY_ORIGIN ?? 'http://localhost:5173';
const live = process.env.CLOUD_LIVE === '1';

/** The app calls the proxy by relative URL; in Node there is no page origin, so add it. */
const viaProxy: typeof fetch = (input, init) =>
  fetch(typeof input === 'string' && input.startsWith('/') ? `${ORIGIN}${input}` : input, init);

describe.skipIf(!live)('LIVE: Vertex AI proxy health', () => {
  it('is reachable with working credentials', async () => {
    const engine = new CloudChatEngine({ systemPrompt: '', fetchImpl: viaProxy });
    const health = await engine.checkReady();
    expect(health.ok).toBe(true);
    expect(health.project).toBeTruthy();
  }, TURN_TIMEOUT);
});

describe.skipIf(!live)('LIVE: Gemini 2.5 Flash via Vertex — tool selection against the real registry', () => {
  toolScenarios(() => new CloudChatEngine({ systemPrompt: livePrompt(), fetchImpl: viaProxy }));
});

describe.skipIf(!live)('LIVE: Vertex vision OCR and embeddings', () => {
  it('Gemini transcribes the fake PAN image (English + Hindi)', async () => {
    const recognize = createCloudVisionRecognizer(viaProxy);
    const bytes = readFileSync(resolve(__dirname, 'fixtures/fake-pan.png'));
    const text = await recognize(new Blob([bytes], { type: 'image/png' }));
    expect(text).toContain('ABCDE1234F');
    expect(text).toContain('RAJESH KUMAR');
    expect(text).toContain('राजेश');
  }, TURN_TIMEOUT);

  it('text-embedding-005 ranks the right document first', async () => {
    const service = new SemanticIndexService(new CloudEmbeddingProvider(viaProxy), new InMemoryVectorStore());
    await service.indexDocument('pan', 'Permanent Account Number card issued by the Income Tax Department');
    await service.indexDocument('rent', 'Rent agreement between landlord and tenant for a flat in Pune, 11 months');
    await service.indexDocument('bill', 'Electricity bill for October, units consumed 214, amount due 1830 rupees');
    const [pan] = await service.search('my tax identity card', 1);
    const [rent] = await service.search('lease for the apartment', 1);
    const [bill] = await service.search('how much do I owe for power', 1);
    expect([pan.chunk.documentId, rent.chunk.documentId, bill.chunk.documentId]).toEqual(['pan', 'rent', 'bill']);
  }, TURN_TIMEOUT);

  it('embeds Hindi text close to its English meaning (multilingual)', async () => {
    const provider = new CloudEmbeddingProvider(viaProxy);
    const [hi, en, other] = await provider.embed(['मेरा बिजली का बिल', 'my electricity bill', 'banana bread recipe']);
    const cos = (a: number[], b: number[]): number =>
      a.reduce((s, x, i) => s + x * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b));
    expect(cos(hi, en)).toBeGreaterThan(cos(hi, other));
  }, TURN_TIMEOUT);
});
