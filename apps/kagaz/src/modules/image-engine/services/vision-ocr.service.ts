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
import { cloudPost, isOnline } from '@/infrastructure/cloud-ai';
import { getOllamaConfig, ollamaPost, type FetchLike } from '@/infrastructure/ollama';

const logger = log('image-engine');

/** Transcribes the text in an image; resolves '' when none is found. */
export type ImageTextRecognizer = (image: Blob) => Promise<string>;

export interface OllamaVisionConfig {
  /** e.g. `http://localhost:11434` */
  baseUrl: string;
  /** A vision-capable model, e.g. `gemma4:e2b` */
  model: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
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
    const body = await ollamaPost<{ message?: { content?: string } }>(
      config.baseUrl,
      '/api/chat',
      {
        model: config.model,
        stream: false,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: PROMPT, images: [await toBase64(image)] }],
      },
      config.fetchImpl
    );
    const text = (body.message?.content ?? '').trim();
    logger.info({ event: 'ocr.vision.success', chars: text.length });
    return text;
  };
}

/** Gemini on Vertex AI through the demo proxy (online mode) — an image leaves the device for Google Cloud. */
export function createCloudVisionRecognizer(fetchImpl?: FetchLike): ImageTextRecognizer {
  return async (image) => {
    const url = `data:${image.type || 'image/png'};base64,${await toBase64(image)}`;
    const body = await cloudPost<{ choices?: { message?: { content?: string } }[] }>(
      '/chat',
      {
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
      },
      fetchImpl
    );
    const text = (body.choices?.[0]?.message?.content ?? '').trim();
    logger.info({ event: 'ocr.vision.success', engine: 'cloud', chars: text.length });
    return text;
  };
}

/**
 * The recognizer for the current mode: Gemini when online, else the local
 * Ollama model when configured, else null (no fallback in this build).
 * Resolved per call so flipping the online/offline switch takes effect at once.
 */
export function getConfiguredVisionRecognizer(): ImageTextRecognizer | null {
  if (!__KAGAZ_DEMO__) {
    return null; // release builds have no vision fallback (and the code below is removed)
  }
  if (isOnline()) {
    return createCloudVisionRecognizer();
  }
  const config = getOllamaConfig();
  return config ? createOllamaVisionRecognizer({ baseUrl: config.baseUrl, model: config.visionModel }) : null;
}
