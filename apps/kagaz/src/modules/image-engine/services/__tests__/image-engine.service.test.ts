import { describe, expect, it, vi } from 'vitest';
import { ImageEngineError } from '../../types/image.types';
import {
  applyImageFilter,
  convertFormat,
  getImageInfo,
} from '../image-engine.service';
import { grayscale } from '../image-filters';

const jpegBlob = (): Blob => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])]);

describe('convertFormat (F-8)', () => {
  it('encodes to a canvas-native target via the injected converter', async () => {
    const png = new Blob(['png-bytes'], { type: 'image/png' });
    const convert = vi.fn().mockResolvedValue(png);
    const out = await convertFormat(jpegBlob(), 'png', { convert }, 0.8);
    expect(out).toBe(png);
    expect(convert).toHaveBeenCalledWith(expect.any(Blob), 'image/png', 0.8);
  });

  it('rejects non-canvas targets with UNSUPPORTED_FORMAT', async () => {
    await expect(convertFormat(jpegBlob(), 'tiff')).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
  });

  it('maps a null encoder result to CONVERSION_FAILED', async () => {
    const convert = vi.fn().mockResolvedValue(null);
    await expect(
      convertFormat(jpegBlob(), 'webp', { convert })
    ).rejects.toBeInstanceOf(ImageEngineError);
  });

  it('wraps a thrown encoder error as CONVERSION_FAILED', async () => {
    const convert = vi.fn().mockRejectedValue(new Error('canvas gone'));
    await expect(
      convertFormat(jpegBlob(), 'jpeg', { convert })
    ).rejects.toMatchObject({ code: 'CONVERSION_FAILED' });
  });
});

describe('getImageInfo (F-8)', () => {
  it('combines detected format, dimensions, size, and MIME', async () => {
    const decode = vi.fn().mockResolvedValue({ width: 800, height: 600 });
    const info = await getImageInfo(jpegBlob(), { decode });
    expect(info).toMatchObject({
      width: 800,
      height: 600,
      format: 'jpeg',
      mimeType: 'image/jpeg',
    });
    expect(info.fileSize).toBeGreaterThan(0);
  });
});

describe('applyImageFilter (F-29)', () => {
  it('runs the blob through the injected processor with the filter', async () => {
    const filtered = new Blob(['filtered'], { type: 'image/jpeg' });
    const process = vi.fn().mockResolvedValue(filtered);
    const out = await applyImageFilter(jpegBlob(), grayscale, { process }, 0.7);
    expect(out).toBe(filtered);
    expect(process).toHaveBeenCalledWith(expect.any(Blob), grayscale, 'image/jpeg', 0.7);
  });

  it('honours a custom output mime', async () => {
    const process = vi.fn().mockResolvedValue(new Blob(['x']));
    await applyImageFilter(jpegBlob(), grayscale, { process, mime: 'image/png' });
    expect(process).toHaveBeenCalledWith(expect.any(Blob), grayscale, 'image/png', expect.any(Number));
  });

  it('throws CANVAS_ERROR when the processor yields nothing', async () => {
    const process = vi.fn().mockResolvedValue(null);
    await expect(applyImageFilter(jpegBlob(), grayscale, { process })).rejects.toMatchObject({
      code: 'CANVAS_ERROR',
    });
  });
});
