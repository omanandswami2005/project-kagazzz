/**
 * Vision-model OCR fallback for platforms without native ML Kit (the web
 * build, i.e. the desktop demo). Sends an image to a local Ollama server
 * running a vision-capable model (Gemma 4) and returns the transcription.
 *
 * Opt-in: off unless `VITE_OLLAMA_URL` is set, so the shipped app never
 * makes this call. To use a hosted vision API instead, write another
 * {@link ImageTextRecognizer} and return it from {@link getConfiguredVisionRecognizer}.
 *
 * [SEC] The image leaves the WebView for the configured server. Only point
 * it at localhost / a machine you control; callers must already have passed
 * the per-document lock gate. Recognized text is never logged.
 */
import { log } from '@/core/logging';

const logger = log('image-engine');

/** Transcribes the text in an image; resolves '' when none is found. */
export type ImageTextRecognizer = (image: Blob) => Promise<string>;

export interface OllamaVisionConfig {
  /** e.g. `http://localhost:11434` */
  baseUrl: string;
  /** A vision-capable model, e.g. `gemma4:e2b` */
  model: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const PROMPT =
  'Transcribe all text in this image exactly as written, line by line, in its original language and script. Output only the text, nothing else.';

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function createOllamaVisionRecognizer(config: OllamaVisionConfig): ImageTextRecognizer {
  return async (image) => {
    const doFetch = config.fetchImpl ?? fetch;
    const response = await doFetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: PROMPT, images: [await toBase64(image)] }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Vision OCR failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as { message?: { content?: string } };
    const text = (body.message?.content ?? '').trim();
    logger.info({ event: 'ocr.vision.success', chars: text.length });
    return text;
  };
}

/** The env-configured recognizer, or null when the fallback is not enabled. */
export function getConfiguredVisionRecognizer(): ImageTextRecognizer | null {
  const baseUrl = import.meta.env.VITE_OLLAMA_URL as string | undefined;
  if (!baseUrl) {
    return null;
  }
  const model = (import.meta.env.VITE_OLLAMA_VISION_MODEL as string | undefined) ?? 'gemma4:e2b';
  return createOllamaVisionRecognizer({ baseUrl, model });
}
