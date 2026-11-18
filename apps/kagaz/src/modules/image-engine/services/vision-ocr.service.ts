/**
 * Vision-model transcription seam ("Transcribe with Gemma").
 *
 * V1 ships no vision recognizer: on-device OCR is Google ML Kit, and the
 * on-device Gemma bridge (`@kagaz/capacitor-llm-litert`) is text-only today.
 * The document vault already calls through this seam (Extract text → "Transcribe
 * with Gemma", PDF page fallback), so the feature lights up by returning a
 * recognizer here — no vault changes.
 *
 * Future item AI-X3 (docs/roadmap/future-extensions.md): on-device Gemma 4
 * multimodal transcription via the LiteRT-LM image input. It must stay
 * on-device; any recognizer that sends an image off the phone needs explicit,
 * logged consent first (10-security-architecture.md §5).
 *
 * [SEC] Callers must already have passed the per-document lock gate.
 * Recognized text is never logged.
 */

/** Transcribes the text in an image; resolves '' when none is found. */
export type ImageTextRecognizer = (image: Blob) => Promise<string>;

/** The recognizer for this build, or null when none is available (always null in V1 — see AI-X3). */
export function getConfiguredVisionRecognizer(): ImageTextRecognizer | null {
  return null;
}
