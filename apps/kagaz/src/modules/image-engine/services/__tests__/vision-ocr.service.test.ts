import { describe, expect, it, vi } from 'vitest';
import { createOllamaVisionRecognizer } from '../vision-ocr.service';

function fetchReturning(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });
}

describe('createOllamaVisionRecognizer', () => {
  it('posts the image as base64 to /api/chat and returns the trimmed transcription', async () => {
    const fetchImpl = fetchReturning({ message: { content: '  PAN ABCDE1234F \n' } });
    const recognize = createOllamaVisionRecognizer({ baseUrl: 'http://x', model: 'gemma4:e2b', fetchImpl });

    const text = await recognize(new Blob([new Uint8Array([1, 2, 3])]));

    expect(text).toBe('PAN ABCDE1234F');
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe('http://x/api/chat');
    const sent = JSON.parse(init?.body as string) as {
      model: string;
      stream: boolean;
      messages: { images: string[] }[];
    };
    expect(sent.model).toBe('gemma4:e2b');
    expect(sent.stream).toBe(false);
    expect(sent.messages[0].images).toEqual([btoa(String.fromCharCode(1, 2, 3))]);
  });

  it('returns an empty string when the model says nothing', async () => {
    const recognize = createOllamaVisionRecognizer({
      baseUrl: 'http://x',
      model: 'm',
      fetchImpl: fetchReturning({}),
    });
    expect(await recognize(new Blob(['x']))).toBe('');
  });

  it('throws on an HTTP error', async () => {
    const recognize = createOllamaVisionRecognizer({
      baseUrl: 'http://x',
      model: 'm',
      fetchImpl: fetchReturning({}, false, 503),
    });
    await expect(recognize(new Blob(['x']))).rejects.toThrow('HTTP 503');
  });
});
