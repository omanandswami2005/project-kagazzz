import { beforeEach, describe, expect, it, vi } from 'vitest';

const ocr = vi.hoisted(() => ({ recognizeText: vi.fn() }));
const platform = vi.hoisted((): { value: string } => ({ value: 'android' }));
const getUri = vi.hoisted(() => vi.fn(async () => ({ uri: 'file:///data/files/documents/a.jpg' })));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value },
  registerPlugin: () => ocr,
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: { getUri },
}));

import { isOcrSupported, recognizeDocumentText } from '../ocr.service';

beforeEach(() => {
  vi.clearAllMocks();
  platform.value = 'android';
  ocr.recognizeText.mockResolvedValue({ text: 'PAN CARD 1234' });
});

describe('isOcrSupported', () => {
  it('is true on native, false on web', () => {
    expect(isOcrSupported()).toBe(true);
    platform.value = 'web';
    expect(isOcrSupported()).toBe(false);
  });
});

describe('recognizeDocumentText (F-20 / ADR-019)', () => {
  it('resolves the storage path to a file URI and returns recognized text', async () => {
    const text = await recognizeDocumentText('documents/a.jpg', 'en');
    expect(text).toBe('PAN CARD 1234');
    expect(getUri).toHaveBeenCalledWith({ directory: 'DATA', path: 'documents/a.jpg' });
    expect(ocr.recognizeText).toHaveBeenCalledWith({
      path: 'file:///data/files/documents/a.jpg',
      script: 'latin',
    });
  });

  it('uses the Devanagari model for Hindi', async () => {
    await recognizeDocumentText('documents/a.jpg', 'hi');
    expect(ocr.recognizeText).toHaveBeenCalledWith(
      expect.objectContaining({ script: 'devanagari' })
    );
  });

  it('returns empty string on web without calling the plugin', async () => {
    platform.value = 'web';
    expect(await recognizeDocumentText('documents/a.jpg', 'en')).toBe('');
    expect(ocr.recognizeText).not.toHaveBeenCalled();
  });

  it('rethrows when the native recognizer fails', async () => {
    ocr.recognizeText.mockRejectedValue(new Error('mlkit boom'));
    await expect(recognizeDocumentText('documents/a.jpg')).rejects.toThrow('mlkit boom');
  });
});
