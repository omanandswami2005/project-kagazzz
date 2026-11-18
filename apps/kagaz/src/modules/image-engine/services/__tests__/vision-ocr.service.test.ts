import { describe, expect, it } from 'vitest';
import { getConfiguredVisionRecognizer } from '../vision-ocr.service';

describe('vision OCR seam', () => {
  it('has no recognizer in V1 (on-device ML Kit OCR is used; Gemma vision is future item AI-X3)', () => {
    expect(getConfiguredVisionRecognizer()).toBeNull();
  });
});
