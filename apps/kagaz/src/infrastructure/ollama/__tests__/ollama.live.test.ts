// @vitest-environment node
/**
 * LIVE tests against a real local Ollama server (gemma4:e2b + embeddinggemma).
 * Skipped unless OLLAMA_LIVE=1, so CI and normal `pnpm test` never need it:
 *
 *   OLLAMA_LIVE=1 pnpm --filter kagaz exec vitest run src/infrastructure/ollama
 *
 * These measure the real model, so they can legitimately fail when a 2B model
 * picks the wrong tool — that is signal, not flakiness to paper over.
 * The fixture image is synthetic (fake name/PAN), not a real document.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OllamaChatEngine } from '@/modules/ai-assistant/services/ollama-chat-engine';
import { AI_TOOL_DESCRIPTORS, aiToolRegistry } from '@/modules/ai-assistant/services/ai-tool-registry';
import type { AiToolContext, DocumentSummary } from '@/modules/ai-assistant/ai-tools.actions';
import { SYSTEM_PROMPT } from '@/modules/ai-assistant/prompts/system-prompt';
import { SkillController } from '@/modules/ai-assistant/skills/skill-controller';
import { skillCatalog } from '@/modules/ai-assistant/skills/skill-registry';
import { SkillSession } from '@/modules/ai-assistant/skills/skill-session';
import { createOllamaVisionRecognizer } from '@/modules/image-engine/services/vision-ocr.service';
import { InMemoryVectorStore, OllamaEmbeddingProvider, SemanticIndexService } from '@/modules/semantic-index';

const BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const live = process.env.OLLAMA_LIVE === '1';
const TURN_TIMEOUT = 600_000;

const DOCS: DocumentSummary[] = [
  { id: 'doc-a', name: 'Rent agreement.pdf', fileType: 'pdf', fileSizeBytes: 120_000, isFavorite: false, isLocked: false, createdAt: '2026-10-01T00:00:00.000Z' },
  { id: 'doc-b', name: 'Electricity bill.pdf', fileType: 'pdf', fileSizeBytes: 80_000, isFavorite: false, isLocked: false, createdAt: '2026-10-02T00:00:00.000Z' },
  { id: 'doc-c', name: 'My photo.jpg', fileType: 'jpg', fileSizeBytes: 900_000, isFavorite: false, isLocked: false, createdAt: '2026-10-03T00:00:00.000Z' },
  { id: 'doc-d', name: 'PAN card.jpg', fileType: 'jpg', fileSizeBytes: 300_000, isFavorite: false, isLocked: false, createdAt: '2026-10-04T00:00:00.000Z' },
];

interface Call { name: string; args: unknown; ok: boolean }

/** Runs one user message through the real engine + real registry (real zod validation), recording tool calls. */
async function runTurn(message: string): Promise<{ calls: Call[]; reply: string; error: string | null }> {
  const engine = new OllamaChatEngine({
    baseUrl: BASE,
    model: 'gemma4:e2b',
    systemPrompt: `${SYSTEM_PROMPT}\n\n${skillCatalog()}`,
  });
  engine.setTools(AI_TOOL_DESCRIPTORS);
  // Same skill wiring as useChat: start with core tools, router pre-loads, guard refuses unloaded tools.
  const skills = new SkillController(new SkillSession(AI_TOOL_DESCRIPTORS.map((d) => d.name)), engine);
  skills.sync();
  const calls: Call[] = [];
  const made = (): Promise<{ created: number; documents: DocumentSummary[] }> =>
    Promise.resolve({ created: 1, documents: [{ ...DOCS[0], id: `new-${calls.length}`, name: 'Result.pdf' }] });
  const ctx = {
    listDocuments: () => Promise.resolve(DOCS),
    searchDocuments: (q: string) => Promise.resolve(DOCS.filter((d) => d.name.toLowerCase().includes(q.toLowerCase().split(' ')[0]))),
    mergeDocuments: made,
    splitDocument: made,
    compressDocument: made,
    watermarkDocument: made,
    convertImagesToPdf: made,
    convertPdfToImages: made,
    exportPdfText: made,
    resizeImage: () => made().then((r) => ({ ...r, resultSizeBytes: 40_000, hitQualityFloor: false })),
    enhanceImage: made,
    runOcr: () => Promise.resolve(100),
    loadSkill: (name: string) => skills.load(name),
    setTheme: () => undefined,
    setLanguage: () => undefined,
    setSwipeAction: () => undefined,
    openQuickReference: () => undefined,
    openQuickNotes: () => undefined,
    startQuickNote: () => undefined,
    openSettings: () => undefined,
    openPdfTools: () => undefined,
  } as unknown as AiToolContext;

  let reply = '';
  let error: string | null = null;
  await engine.addListener('textFromAi', (e) => (reply += e.text));
  await engine.addListener('generationError', (e) => (error = e.error));
  await engine.addListener('toolCallRequested', (e) => {
    void (async () => {
      const args = JSON.parse(e.argumentsJson) as unknown;
      const refusal = skills.refusal(e.name);
      const result = refusal ? (JSON.parse(refusal) as { ok: false }) : await aiToolRegistry.invoke(e.name, args, ctx);
      calls.push({ name: e.name, args, ok: result.ok });
      await engine.resolveToolCall({ requestId: e.requestId, resultJson: JSON.stringify(result) });
    })();
  });
  const { id } = await engine.createChat();
  skills.onUserMessage(message);
  await engine.sendMessage({ chatId: id, message });
  return { calls, reply, error };
}

const names = (calls: Call[]): string[] => calls.map((c) => c.name);
/** Shown in assertion failures so a wrong tool choice is diagnosable from the log. */
const trace = (r: { calls: Call[]; reply: string; error: string | null }): string =>
  `calls=${JSON.stringify(r.calls)} reply=${JSON.stringify(r.reply.slice(0, 300))} error=${String(r.error)}`;

describe.skipIf(!live)('LIVE: Gemma 4 E2B via Ollama — tool selection against the real registry', () => {
  it('"switch to dark mode" → settings.setTheme {theme: dark}', async () => {
    const r = await runTurn('Switch the app to dark mode please.');
    expect(r.error).toBeNull();
    const call = r.calls.find((c) => c.name === 'settings.setTheme');
    expect(call?.args).toEqual({ theme: 'dark' });
    expect(call?.ok).toBe(true);
  }, TURN_TIMEOUT);

  it('Hindi: "ऐप को हिंदी में बदलो" → settings.setLanguage {language: hi}', async () => {
    const r = await runTurn('ऐप की भाषा हिंदी में बदल दो।');
    expect(r.error).toBeNull();
    const call = r.calls.find((c) => c.name === 'settings.setLanguage');
    expect(call?.args).toEqual({ language: 'hi' });
  }, TURN_TIMEOUT);

  it('"find my PAN card" → ai.searchDocuments (or list) and a reply that mentions it', async () => {
    const r = await runTurn('Find my PAN card.');
    expect(r.error).toBeNull();
    expect(names(r.calls).some((n) => n === 'ai.searchDocuments' || n === 'ai.listDocuments')).toBe(true);
    expect(r.reply.toLowerCase()).toContain('pan');
  }, TURN_TIMEOUT);

  it('"merge the rent agreement and the electricity bill" → ai.mergeDocuments with both real ids', async () => {
    const r = await runTurn('Merge my rent agreement and my electricity bill into one PDF.');
    expect(r.error).toBeNull();
    const merge = r.calls.find((c) => c.name === 'ai.mergeDocuments');
    expect(merge?.ok, trace(r)).toBe(true);
    expect((merge?.args as { documentIds: string[] }).documentIds.sort()).toEqual(['doc-a', 'doc-b']);
  }, TURN_TIMEOUT);

  it('"resize my photo to 200x230 under 50 KB" → ai.resizeImage with the right numbers', async () => {
    const r = await runTurn('Resize my photo to 200 by 230 pixels and under 50 KB for a form.');
    expect(r.error).toBeNull();
    const resize = r.calls.find((c) => c.name === 'ai.resizeImage');
    expect(resize?.ok, trace(r)).toBe(true);
    expect(resize?.args).toMatchObject({ documentId: 'doc-c', width: 200, height: 230, maxSizeKb: 50 });
  }, TURN_TIMEOUT);

  it('cross-skill: merge two PDFs AND resize a photo in one request → both tools run', async () => {
    const r = await runTurn(
      'Merge my rent agreement and my electricity bill, and also resize my photo to 200 by 230 pixels under 50 KB.'
    );
    expect(r.error).toBeNull();
    expect(r.calls.find((c) => c.name === 'ai.mergeDocuments')?.ok, trace(r)).toBe(true);
    expect(r.calls.find((c) => c.name === 'ai.resizeImage')?.ok, trace(r)).toBe(true);
  }, TURN_TIMEOUT);

  it('model-driven load: no trigger word, so the model must call ai.loadSkill itself', async () => {
    // "smaller"/"agreement" are not triggers for pdf-tools — the router misses it.
    const r = await runTurn('Make my rent agreement smaller in file size.');
    expect(r.error).toBeNull();
    const order = names(r.calls);
    expect(order, trace(r)).toContain('ai.loadSkill');
    expect(r.calls.find((c) => c.name === 'ai.compressDocument')?.ok, trace(r)).toBe(true);
    expect(order.indexOf('ai.loadSkill')).toBeLessThan(order.indexOf('ai.compressDocument'));
  }, TURN_TIMEOUT);

  it('an unrelated request does not load unrelated skills', async () => {
    const r = await runTurn('Switch the app to dark mode please.');
    expect(r.error).toBeNull();
    expect(names(r.calls).filter((n) => n === 'ai.loadSkill' || n.startsWith('ai.') && n !== 'ai.loadSkill'), trace(r)).toEqual([]);
  }, TURN_TIMEOUT);

  it('plain chat → answers in text and calls no tool', async () => {
    const r = await runTurn('Namaste! In one sentence, what can you help me with?');
    expect(r.error).toBeNull();
    expect(r.calls).toEqual([]);
    expect(r.reply.trim().length).toBeGreaterThan(10);
  }, TURN_TIMEOUT);
});

describe.skipIf(!live)('LIVE: vision OCR and embeddings', () => {
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
