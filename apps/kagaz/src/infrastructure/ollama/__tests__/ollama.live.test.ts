// @vitest-environment node
/**
 * LIVE tests against a real local Ollama server (gemma4:e2b + embeddinggemma).
 * Skipped unless OLLAMA_LIVE=1, so CI and normal `pnpm test` never need it:
 *
 *   OLLAMA_LIVE=1 pnpm --filter kagaz exec vitest run src/infrastructure/ollama
 *
 * These measure the real model, so they can legitimately fail when a 2B model
 * picks the wrong tool — that is signal, not flakiness to paper over. The
 * scenarios are shared with the cloud suite (src/test/live-harness.ts). The
 * fixture image is synthetic (fake name/PAN), not a real document.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OllamaChatEngine } from '@/modules/ai-assistant/services/ollama-chat-engine';
import { createOllamaVisionRecognizer } from '@/modules/image-engine/services/vision-ocr.service';
import { InMemoryVectorStore, OllamaEmbeddingProvider, SemanticIndexService } from '@/modules/semantic-index';
import { livePrompt, toolScenarios, TURN_TIMEOUT } from '@/test/live-harness';

const BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const live = process.env.OLLAMA_LIVE === '1';

describe.skipIf(!live)('LIVE: Gemma 4 E2B via Ollama — tool selection against the real registry', () => {
  toolScenarios(() => new OllamaChatEngine({ baseUrl: BASE, model: 'gemma4:e2b', systemPrompt: livePrompt() }));
});

describe.skipIf(!live)('LIVE: Ollama vision OCR and embeddings', () => {
  it('Gemma transcribes the fake PAN image (English + Hindi)', async () => {
    const recognize = createOllamaVisionRecognizer({ baseUrl: BASE, model: 'gemma4:e2b' });
    const bytes = readFileSync(resolve(__dirname, 'fixtures/fake-pan.png'));
    const text = await recognize(new Blob([bytes], { type: 'image/png' }));
    expect(text).toContain('ABCDE1234F');
    expect(text).toContain('RAJESH KUMAR');
    expect(text).toContain('राजेश');
  }, TURN_TIMEOUT);

  it('EmbeddingGemma ranks the right document first (with task prefixes)', async () => {
    const service = new SemanticIndexService(
      new OllamaEmbeddingProvider({ baseUrl: BASE, model: 'embeddinggemma' }),
      new InMemoryVectorStore()
    );
    await service.indexDocument('pan', 'Permanent Account Number card issued by the Income Tax Department');
    await service.indexDocument('rent', 'Rent agreement between landlord and tenant for a flat in Pune, 11 months');
    await service.indexDocument('bill', 'Electricity bill for October, units consumed 214, amount due 1830 rupees');
    const [pan] = await service.search('my tax identity card', 1);
    const [rent] = await service.search('lease for the apartment', 1);
    const [bill] = await service.search('how much do I owe for power', 1);
    expect([pan.chunk.documentId, rent.chunk.documentId, bill.chunk.documentId]).toEqual(['pan', 'rent', 'bill']);
  }, TURN_TIMEOUT);
});
