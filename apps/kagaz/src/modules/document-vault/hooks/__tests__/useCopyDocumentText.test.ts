import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { documentHasCopyableText, useCopyDocumentText } from '../useCopyDocumentText';

const copyToClipboard = vi.hoisted(() => vi.fn());
vi.mock('@/core/clipboard', () => ({ copyToClipboard }));

function doc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return { id: 'd1', name: 'scan.jpg', ...overrides } as DocumentEntity;
}

describe('useCopyDocumentText (F-68)', () => {
  beforeEach(() => {
    copyToClipboard.mockReset();
  });

  describe('documentHasCopyableText', () => {
    it('is true only when ocrText has non-whitespace content', () => {
      expect(documentHasCopyableText(doc({ ocrText: 'hello' }))).toBe(true);
      expect(documentHasCopyableText(doc({ ocrText: '   ' }))).toBe(false);
      expect(documentHasCopyableText(doc({ ocrText: '' }))).toBe(false);
      expect(documentHasCopyableText(doc())).toBe(false);
    });
  });

  it('copies the trimmed ocrText and reports success', async () => {
    copyToClipboard.mockResolvedValue(true);
    const { result } = renderHook(() => useCopyDocumentText());
    expect(await result.current.copy(doc({ ocrText: '  invoice total 500  ' }))).toBe(true);
    expect(copyToClipboard).toHaveBeenCalledWith('invoice total 500');
  });

  it('returns false without copying when there is no text', async () => {
    const { result } = renderHook(() => useCopyDocumentText());
    expect(await result.current.copy(doc({ ocrText: '   ' }))).toBe(false);
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it('propagates a clipboard failure as false', async () => {
    copyToClipboard.mockResolvedValue(false);
    const { result } = renderHook(() => useCopyDocumentText());
    expect(await result.current.copy(doc({ ocrText: 'text' }))).toBe(false);
  });
});
