import { CapacitorLlmLiteRT } from '@kagaz/capacitor-llm-litert';
import { withEmbeddingGemmaPrefix } from '../embedding-gemma-prefixes';
import type { EmbeddingProvider } from '../types';

/** Texts per native call: bounds peak memory and keeps one call short. */
const BATCH = 8;
/**
 * The model's largest input is 512 tokens. Documents are chunked at 800
 * characters (about 200 English / 350 Hindi tokens), so this clamp is only a
 * guard against a stray oversized string producing a native "too long" error.
 */
const MAX_CHARS = 1200;

/**
 * Embeds text with EmbeddingGemma-300M on the phone (LiteRT-LM EmbeddingEngine
 * through the native plugin). Nothing leaves the device. `modelPath` is the
 * verified model file from search-model.service.
 */
export class LiteRtEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly modelPath: string) {}

  async embed(texts: string[], kind: 'query' | 'document' = 'document'): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts
        .slice(i, i + BATCH)
        .map((t) => withEmbeddingGemmaPrefix(t.slice(0, MAX_CHARS), kind));
      const { embeddings } = await CapacitorLlmLiteRT.embedTexts({
        path: this.modelPath,
        texts: batch,
      });
      if (embeddings.length !== batch.length) {
        throw new Error('On-device embeddings returned an unexpected number of vectors');
      }
      out.push(...embeddings);
    }
    return out;
  }
}
