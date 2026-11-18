import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { share } = vi.hoisted(() => ({ share: vi.fn() }));
vi.mock('@/modules/document-vault/hooks/useDocumentIntents', () => ({
  useDocumentIntents: () => ({ supported: true, share, shareMany: vi.fn(), openWith: vi.fn() }),
}));
vi.mock('@/core/hooks/useThumbnail', () => ({ useThumbnail: () => null }));

import { ToolResultSheet } from '../ToolResultSheet';

const out = { id: 'o1', name: 'Bill_compressed', fileType: 'pdf', isLocked: false } as DocumentEntity;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('ToolResultSheet', () => {
  it('offers Open and Share for each created document', async () => {
    const onOpen = vi.fn();
    render(<ToolResultSheet documents={[out]} onOpen={onOpen} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText('Open'));
    expect(onOpen).toHaveBeenCalledWith(out);
    fireEvent.click(screen.getByText('Share'));
    expect(share).toHaveBeenCalledWith(out);
  });
});
