import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingFile } from '../../types/document.types';
import type { PendingShare } from '../../services/share-receive.service';
import { useShareIntent } from '../useShareIntent';
import { useVaultStore } from '../../store/vault.store';

const nativePlatform = vi.hoisted((): { value: boolean } => ({ value: true }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => nativePlatform.value },
}));

const upload = vi.hoisted(() => ({
  isReady: true,
  ingestFiles: vi.fn(),
}));
vi.mock('../useUpload', () => ({ useUpload: () => upload }));

const shareService = vi.hoisted(() => ({
  isShareReceiveSupported: vi.fn(() => true),
  getPendingShare: vi.fn(),
  onShareReceived: vi.fn(),
  pendingShareToIncomingFiles: vi.fn(),
}));
vi.mock('../../services/share-receive.service', () => shareService);

const routerPush = vi.hoisted(() => vi.fn());
const presentToast = vi.hoisted(() => vi.fn());
// useIonRouter/useIonToast both require Ionic overlay/router ancestors this
// hook-only render tree doesn't provide — mocked at the hook boundary, same
// reasoning as every other bare-renderHook Ionic test in this codebase
// (e.g. useChat.test.ts's useIonRouter mock).
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...actual,
    useIonRouter: () => ({ push: routerPush }),
    useIonToast: () => [presentToast],
  };
});

const file = (name: string): IncomingFile => ({
  name,
  blob: new Blob(['x']),
  source: 'file_picker',
});

beforeEach(() => {
  vi.clearAllMocks();
  nativePlatform.value = true;
  upload.isReady = true;
  shareService.isShareReceiveSupported.mockReturnValue(true);
  shareService.getPendingShare.mockResolvedValue({ items: [], text: null });
  shareService.pendingShareToIncomingFiles.mockResolvedValue([]);
  shareService.onShareReceived.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  useVaultStore.setState({ lastUploadErrors: [] });
});

describe('useShareIntent', () => {
  it('does nothing on web/non-native platforms', async () => {
    nativePlatform.value = false;
    renderHook(() => useShareIntent());
    await Promise.resolve();
    expect(shareService.getPendingShare).not.toHaveBeenCalled();
  });

  it('waits for the database to be ready before checking a pending share', async () => {
    upload.isReady = false;
    const { rerender } = renderHook(() => useShareIntent());
    await Promise.resolve();
    expect(shareService.getPendingShare).not.toHaveBeenCalled();

    upload.isReady = true;
    rerender();
    await waitFor(() => expect(shareService.getPendingShare).toHaveBeenCalledOnce());
  });

  it('imports a pending share on mount and navigates to the vault', async () => {
    const share: PendingShare = { items: [{ uri: 'content://x', mimeType: 'application/pdf', name: 'a.pdf' }], text: null };
    shareService.getPendingShare.mockResolvedValue(share);
    shareService.pendingShareToIncomingFiles.mockResolvedValue([file('a.pdf')]);
    upload.ingestFiles.mockResolvedValue({ uploaded: 1, documents: [] });

    renderHook(() => useShareIntent());

    await waitFor(() => expect(upload.ingestFiles).toHaveBeenCalledWith([file('a.pdf')]));
    expect(routerPush).toHaveBeenCalledWith('/vault');
    expect(presentToast).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 2500, position: 'bottom' })
    );
  });

  it('ignores a text-only share (no attached file)', async () => {
    shareService.getPendingShare.mockResolvedValue({ items: [], text: 'just a message' });
    shareService.pendingShareToIncomingFiles.mockResolvedValue([]);

    renderHook(() => useShareIntent());
    await waitFor(() => expect(shareService.getPendingShare).toHaveBeenCalledOnce());
    expect(upload.ingestFiles).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('bug-audit fix: shows an error toast when every shared file fails validation (uploaded: 0, no throw)', async () => {
    shareService.pendingShareToIncomingFiles.mockResolvedValue([file('huge.pdf')]);
    upload.ingestFiles.mockImplementation(async () => {
      useVaultStore.setState({ lastUploadErrors: ['upload.errors.file_too_large'] });
      return { uploaded: 0, documents: [] };
    });

    renderHook(() => useShareIntent());

    await waitFor(() => expect(presentToast).toHaveBeenCalled());
    expect(presentToast).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'danger' })
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('shows an error toast (no throw) when ingestion fails', async () => {
    shareService.pendingShareToIncomingFiles.mockResolvedValue([file('a.pdf')]);
    upload.ingestFiles.mockRejectedValue(new Error('disk full'));

    renderHook(() => useShareIntent());

    await waitFor(() => expect(presentToast).toHaveBeenCalled());
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('subscribes to live shares and unsubscribes on unmount', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    shareService.onShareReceived.mockResolvedValue({ remove });

    const { unmount } = renderHook(() => useShareIntent());
    await waitFor(() => expect(shareService.onShareReceived).toHaveBeenCalledOnce());

    const liveHandler = shareService.onShareReceived.mock.calls[0][0] as (
      share: PendingShare
    ) => void;
    shareService.pendingShareToIncomingFiles.mockResolvedValue([file('live.pdf')]);
    upload.ingestFiles.mockResolvedValue({ uploaded: 1, documents: [] });

    await act(async () => {
      liveHandler({ items: [{ uri: 'content://y', mimeType: 'application/pdf', name: 'live.pdf' }], text: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(upload.ingestFiles).toHaveBeenCalledWith([file('live.pdf')]));

    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('only sets up the listener once even across re-renders', async () => {
    const { rerender } = renderHook(() => useShareIntent());
    await waitFor(() => expect(shareService.onShareReceived).toHaveBeenCalledOnce());

    rerender();
    rerender();
    expect(shareService.onShareReceived).toHaveBeenCalledOnce();
  });
});
