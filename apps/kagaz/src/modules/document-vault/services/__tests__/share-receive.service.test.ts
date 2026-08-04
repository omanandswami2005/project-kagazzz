import { beforeEach, describe, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  getPendingShare: vi.fn(),
  addListener: vi.fn(),
}));
const platform = vi.hoisted((): { value: string } => ({ value: 'android' }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => platform.value,
    convertFileSrc: (uri: string) => `converted:${uri}`,
  },
  registerPlugin: () => plugin,
}));

import {
  getPendingShare,
  isShareReceiveSupported,
  onShareReceived,
  pendingShareToIncomingFiles,
  sharedItemToIncomingFile,
  type PendingShare,
  type SharedItem,
} from '../share-receive.service';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  platform.value = 'android';
  vi.stubGlobal('fetch', fetchMock);
});

function item(over: Partial<SharedItem> = {}): SharedItem {
  return { uri: 'content://com.other.app/file123', mimeType: 'application/pdf', name: null, ...over };
}

describe('isShareReceiveSupported', () => {
  it('true on android, false elsewhere', () => {
    expect(isShareReceiveSupported()).toBe(true);
    platform.value = 'ios';
    expect(isShareReceiveSupported()).toBe(false);
    platform.value = 'web';
    expect(isShareReceiveSupported()).toBe(false);
  });
});

describe('getPendingShare / onShareReceived', () => {
  it('getPendingShare delegates to the native plugin', async () => {
    const share: PendingShare = { items: [], text: null };
    plugin.getPendingShare.mockResolvedValue(share);
    await expect(getPendingShare()).resolves.toBe(share);
  });

  it('onShareReceived subscribes to the shareReceived event', async () => {
    const remove = vi.fn();
    plugin.addListener.mockResolvedValue({ remove });
    const cb = vi.fn();
    const handle = await onShareReceived(cb);
    expect(plugin.addListener).toHaveBeenCalledWith('shareReceived', cb);
    expect(handle.remove).toBe(remove);
  });
});

describe('sharedItemToIncomingFile', () => {
  it('reads the shared item into a Blob and tags it as file_picker', async () => {
    const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
    fetchMock.mockResolvedValue({ blob: () => Promise.resolve(blob) });

    const file = await sharedItemToIncomingFile(
      item({ name: 'PAN_Card.pdf', mimeType: 'application/pdf' })
    );

    expect(fetchMock).toHaveBeenCalledWith('converted:content://com.other.app/file123');
    expect(file).toEqual({ name: 'PAN_Card.pdf', blob, source: 'file_picker' });
  });

  it('appends an extension from the MIME type when the provider name has none', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])]);
    fetchMock.mockResolvedValue({ blob: () => Promise.resolve(blob) });

    const file = await sharedItemToIncomingFile(
      item({ name: 'IMG_2026', mimeType: 'image/jpeg' })
    );

    expect(file?.name).toBe('IMG_2026.jpeg');
  });

  it('falls back to a timestamped name when the provider gave none', async () => {
    const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
    fetchMock.mockResolvedValue({ blob: () => Promise.resolve(blob) });

    const file = await sharedItemToIncomingFile(item({ name: null, mimeType: 'application/pdf' }));

    expect(file?.name).toMatch(/^Shared_.*\.pdf$/);
  });

  it('resolves null (not a throw) when the read fails, so one bad item does not abort the batch', async () => {
    fetchMock.mockRejectedValue(new Error('permission revoked'));
    const file = await sharedItemToIncomingFile(item());
    expect(file).toBeNull();
  });
});

describe('pendingShareToIncomingFiles', () => {
  it('converts every item and drops read failures', async () => {
    const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
    fetchMock
      .mockResolvedValueOnce({ blob: () => Promise.resolve(blob) })
      .mockRejectedValueOnce(new Error('boom'));

    const files = await pendingShareToIncomingFiles({
      items: [item({ name: 'a.pdf' }), item({ name: 'b.pdf' })],
      text: null,
    });

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('a.pdf');
  });

  it('a text-only share (no items) yields an empty array', async () => {
    const files = await pendingShareToIncomingFiles({ items: [], text: 'just a link' });
    expect(files).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
