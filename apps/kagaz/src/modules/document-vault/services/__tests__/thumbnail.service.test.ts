import { describe, expect, it, vi } from 'vitest';
import {
  fitWithin,
  generateThumbnail,
  supportsThumbnail,
  THUMBNAIL_MAX,
} from '../thumbnail.service';
import { jpgBytes, pdfBytes } from '../../__tests__/fixtures/vault-fixtures';

function blobOf(bytes: Uint8Array): Blob {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Blob([buf]);
}

describe('fitWithin', () => {
  it('scales down preserving aspect ratio, never upscales', () => {
    expect(fitWithin(600, 300, THUMBNAIL_MAX)).toEqual({ width: 300, height: 150 });
    expect(fitWithin(100, 50, THUMBNAIL_MAX)).toEqual({ width: 100, height: 50 });
  });

  it('clamps degenerate sizes to at least 1px', () => {
    expect(fitWithin(0, 0, THUMBNAIL_MAX)).toEqual({ width: 1, height: 1 });
  });
});

describe('supportsThumbnail', () => {
  it('accepts images and PDF, rejects others', () => {
    expect(supportsThumbnail('pdf')).toBe(true);
    expect(supportsThumbnail('png')).toBe(true);
    expect(supportsThumbnail('jpg')).toBe(true);
    expect(supportsThumbnail('docx')).toBe(false);
    expect(supportsThumbnail('txt')).toBe(false);
  });
});

describe('generateThumbnail', () => {
  it('returns null for unsupported types without calling renderers', async () => {
    const renderImage = vi.fn();
    const renderPdf = vi.fn();
    const out = await generateThumbnail(blobOf(jpgBytes()), 'docx', {
      renderImage,
      renderPdf,
    });
    expect(out).toBeNull();
    expect(renderImage).not.toHaveBeenCalled();
  });

  it('uses the image renderer for images', async () => {
    const renderImage = vi.fn(() => Promise.resolve(blobOf(jpgBytes(8))));
    const renderPdf = vi.fn();
    const out = await generateThumbnail(blobOf(jpgBytes()), 'jpg', {
      renderImage,
      renderPdf,
    });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(renderImage).toHaveBeenCalledOnce();
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it('uses the pdf renderer for PDFs', async () => {
    const renderImage = vi.fn();
    const renderPdf = vi.fn(() => Promise.resolve(blobOf(jpgBytes(8))));
    const out = await generateThumbnail(blobOf(pdfBytes()), 'pdf', {
      renderImage,
      renderPdf,
    });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(renderPdf).toHaveBeenCalledOnce();
  });

  it('returns null (non-fatal) when the renderer throws or yields nothing', async () => {
    await expect(
      generateThumbnail(blobOf(jpgBytes()), 'jpg', {
        renderImage: () => Promise.reject(new Error('decode failed')),
      })
    ).resolves.toBeNull();
    await expect(
      generateThumbnail(blobOf(jpgBytes()), 'jpg', {
        renderImage: () => Promise.resolve(null),
      })
    ).resolves.toBeNull();
  });
});
