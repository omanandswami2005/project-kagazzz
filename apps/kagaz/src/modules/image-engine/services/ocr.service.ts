/**
 * OCR text extraction (F-20, ADR-019). Wraps the custom native `Ocr` plugin —
 * Google ML Kit text recognition with the Latin + Devanagari models bundled in
 * the APK (offline on install, no download, no WASM/CSP). Recognizes text in a
 * stored image; Android/iOS only (the web build has no ML Kit → degrades).
 *
 * [SEC] OCR text is sensitive: callers store it only in the encrypted DB
 * (`documents.ocr_text`) and it is never logged — only the character count is.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { log } from '@/core/logging';
import type { SupportedLanguage } from '@/core/i18n';

const logger = log('image-engine');

/** ML Kit script model to use. */
export type OcrScript = 'latin' | 'devanagari';

/** Native plugin surface (implemented by `OcrPlugin.java`). */
export interface OcrPlugin {
  recognizeText(options: { path: string; script: OcrScript }): Promise<{ text: string }>;
}

const Ocr = registerPlugin<OcrPlugin>('Ocr', {
  web: () => ({
    recognizeText: (): Promise<{ text: string }> =>
      Promise.reject(new Error('OCR is not available on web')),
  }),
});

/** Latin covers English/roman scripts; Devanagari covers Hindi. */
const SCRIPT_FOR_LOCALE = {
  en: 'latin',
  hi: 'devanagari',
} as const satisfies Record<SupportedLanguage, OcrScript>;

/** True when on-device OCR is available (native platforms only). */
export function isOcrSupported(): boolean {
  return Capacitor.getPlatform() !== 'web';
}

/**
 * Recognizes text in a stored image (app-relative path, e.g.
 * `documents/{uuid}.jpg`), choosing the script from the app language. Returns
 * the extracted text (possibly empty); resolves to `''` on unsupported
 * platforms. Throws only when the native recognizer errors.
 */
export async function recognizeDocumentText(
  storagePath: string,
  language: SupportedLanguage = 'en'
): Promise<string> {
  if (!isOcrSupported()) {
    return '';
  }
  // Resolve the app-relative path to a file:// URI the native side can read.
  const { uri } = await Filesystem.getUri({ directory: Directory.Data, path: storagePath });
  try {
    const { text } = await Ocr.recognizeText({
      path: uri,
      script: SCRIPT_FOR_LOCALE[language],
    });
    // [SEC] log the length only — never the recognized (sensitive) text.
    logger.info({ event: 'ocr.recognize.success', chars: text.length, script: SCRIPT_FOR_LOCALE[language] });
    return text;
  } catch (error) {
    logger.warn({ event: 'ocr.recognize.error', err: { message: String(error) } });
    throw error;
  }
}
