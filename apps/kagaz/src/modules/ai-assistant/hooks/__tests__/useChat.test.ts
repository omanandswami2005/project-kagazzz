import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAction } from '@kagaz/agent-kit';
import { z } from 'zod';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { useAi } from '@/app/providers/AIProvider';
import { FakeDb } from '@/test/fake-db';
import { aiToolRegistry } from '../../services/ai-tool-registry';
import { trackCreated, useChat } from '../useChat';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
vi.mock('@/app/providers/AIProvider', () => ({ useAi: vi.fn() }));
// useChat now also calls useTheme() for settings.setTheme (bug-audit fix) —
// mocked at the hook boundary for the same reason as useAi/useIonRouter
// above (throws outside its real provider, which this hook-only test
// doesn't mount).
const applyTheme = vi.hoisted(() => vi.fn());
vi.mock('@/app/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'system', setTheme: applyTheme }),
}));

const pdfEngine = vi.hoisted(() => ({
  mergePdfs: vi.fn(),
  splitPdf: vi.fn(),
  compressPdf: vi.fn(),
  watermarkPdf: vi.fn(),
  imagesToPdf: vi.fn(),
  pdfToImages: vi.fn(),
  exportPdfText: vi.fn(),
}));
// useChat now also calls usePdfEngine() for F-14's document-op tools —
// mocked at the hook boundary (same reasoning as useIonRouter above)
// rather than its whole native/Filesystem/upload dependency tree.
vi.mock('@/modules/pdf-engine/hooks/usePdfEngine', () => ({ usePdfEngine: () => pdfEngine }));

// The image tools reuse three document-vault hooks (resize, enhance, OCR);
// each needs providers this hook-only test doesn't render — mocked at the
// hook boundary, same as usePdfEngine above.
const imageOps = vi.hoisted(() => ({
  resizeRun: vi.fn(),
  applyFilter: vi.fn(),
  extractText: vi.fn(),
}));
vi.mock('@/modules/document-vault/hooks/useResizeCompress', () => ({
  useResizeCompress: () => ({ runningId: null, run: imageOps.resizeRun }),
}));
vi.mock('@/modules/document-vault/hooks/useImageEnhancement', () => ({
  useImageEnhancement: () => ({ runningId: null, applyFilter: imageOps.applyFilter }),
}));
vi.mock('@/modules/document-vault/hooks/useDocumentOcr', () => ({
  useDocumentOcr: () => ({ runningId: null, extractText: imageOps.extractText }),
}));

const routerPush = vi.hoisted(() => vi.fn());
// useChat now calls useIonRouter() for F-23's navigation tools —
// useIonRouter() throws "An Ionic Router is required" without a real
// IonReactRouter ancestor, which this hook-only test doesn't provide (same
// reasoning as every other Ionic hook mocked elsewhere in this codebase).
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return { ...actual, useIonRouter: () => ({ push: routerPush, goBack: vi.fn() }) };
});

// Registered once for the confirmation-card tests below — a real action
// with requiresConfirmation: true, since none of the currently-shipped AI
// tools need one. Exercises the pending-confirmation code path for real,
// against the actual singleton useChat.ts itself imports.
aiToolRegistry.register(
  defineAction({
    id: 'test.destructiveThing',
    summary: 'Do a destructive test thing.',
    args: z.object({}),
    requiresConfirmation: true,
    handler: (): Promise<{ done: true }> => Promise.resolve({ done: true }),
  })
);

type Listener = (event: unknown) => void;
const listeners: Record<string, Listener> = {};
const plugin = vi.hoisted(() => ({
  createChat: vi.fn(),
  sendMessage: vi.fn(),
  addListener: vi.fn(),
  resolveToolCall: vi.fn<(options: { requestId: string; resultJson: string }) => Promise<void>>(),
}));
vi.mock('@kagaz/capacitor-llm-litert', () => ({ CapacitorLlmLiteRT: plugin }));

const useDatabaseMock = vi.mocked(useDatabase);
const useAiMock = vi.mocked(useAi);

const conversationRow = {
  id: 'c-1',
  title: null,
  created_at: '2026-07-24T00:00:00.000Z',
  updated_at: '2026-07-24T00:00:00.000Z',
  is_pinned: 0,
};

function readyAiValue(): ReturnType<typeof useAi> {
  return {
    status: 'ready',
    downloadProgress: 100,
    errorMessage: null,
    capabilities: { backend: 'gpu', loadTimeMs: 900 },
    engine: 'litert' as const,
    serverUrl: null,
    mode: 'offline' as const,
    onlineAvailable: false,
    setMode: vi.fn(),
    modelSizeBytes: 497_664_000,
    preferGpu: false,
    setPreferGpu: vi.fn(),
    activate: vi.fn(),
    remove: vi.fn(),
  };
}

beforeEach(() => {
  for (const key of Object.keys(listeners)) delete listeners[key];
  vi.clearAllMocks();
  plugin.addListener.mockImplementation((event: string, cb: Listener) => {
    listeners[event] = cb;
    return Promise.resolve({ remove: vi.fn().mockResolvedValue(undefined) });
  });
  plugin.createChat.mockResolvedValue({ id: 'session-1' });
  plugin.sendMessage.mockResolvedValue(undefined);
  useAiMock.mockReturnValue(readyAiValue());
});

describe('useChat (F-13)', () => {
  it('reuses the most recent conversation and loads its history', async () => {
    const db = new FakeDb()
      .onQuery(/FROM ai_conversations/, [conversationRow])
      .onQuery(
        /FROM ai_messages/,
        [
          {
            id: 'm-1',
            conversation_id: 'c-1',
            role: 'user',
            content: 'Hi',
            tool_calls_json: null,
            tool_call_id: null,
            created_at: '2026-07-24T00:00:01.000Z',
          },
        ]
      );
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe('Hi');
  });

  it('creates a conversation when none exists yet', async () => {
    const db = new FakeDb().onQuery(/FROM ai_messages/, []);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    renderHook(() => useChat());
    await waitFor(() =>
      expect(db.calls.some((c) => c.kind === 'run' && /INSERT INTO ai_conversations/.test(c.sql))).toBe(
        true
      )
    );
  });

  it('creates a native chat session once the model is ready', async () => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());
  });

  it('sendMessage persists the user turn and streams the assistant reply', async () => {
    const db = new FakeDb()
      .onQuery(/FROM ai_conversations/, [conversationRow])
      .onQuery(/FROM ai_messages WHERE id/, [
        {
          id: 'echo',
          conversation_id: 'c-1',
          role: 'user',
          content: 'How many documents do I have?',
          tool_calls_json: null,
          tool_call_id: null,
          created_at: '2026-07-24T00:00:02.000Z',
        },
      ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    await act(async () => {
      await result.current.sendMessage('How many documents do I have?');
    });

    expect(result.current.messages.at(-1)?.content).toBe('How many documents do I have?');
    expect(plugin.sendMessage).toHaveBeenCalledWith({
      chatId: 'session-1',
      message: 'How many documents do I have?',
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      listeners.textFromAi?.({ chatId: 'session-1', text: 'You have ', isChunk: true });
      listeners.textFromAi?.({ chatId: 'session-1', text: '12 documents.', isChunk: true });
    });
    expect(result.current.streamingText).toBe('You have 12 documents.');

    await act(async () => {
      listeners.aiFinished?.({ chatId: 'session-1' });
      await Promise.resolve();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingText).toBe('');
    // FakeDb echoes a static row for every `SELECT ... WHERE id` regardless
    // of which INSERT it followed, so the persisted-content round-trip
    // can't be asserted here for the second (assistant) row — instead
    // assert directly on the INSERT this hook issued, which is the real
    // behavior under test.
    const assistantInsert = db.calls.find(
      (c) => c.kind === 'run' && /INSERT INTO ai_messages/.test(c.sql) && c.params[2] === 'assistant'
    );
    expect(assistantInsert?.params).toContain('You have 12 documents.');
  });

  it('ignores streaming events for a different (stale) chat session', async () => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    act(() => {
      listeners.textFromAi?.({ chatId: 'some-other-session', text: 'leaked', isChunk: true });
    });
    expect(result.current.streamingText).toBe('');
  });

  it('generationError surfaces the message and stops streaming', async () => {
    const db = new FakeDb()
      .onQuery(/FROM ai_conversations/, [conversationRow])
      .onQuery(/FROM ai_messages WHERE id/, [
        {
          id: 'echo',
          conversation_id: 'c-1',
          role: 'user',
          content: 'Hello',
          tool_calls_json: null,
          tool_call_id: null,
          created_at: '2026-07-24T00:00:02.000Z',
        },
      ]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    act(() => {
      listeners.generationError?.({ chatId: 'session-1', error: 'Inference timed out' });
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('Inference timed out');
  });

  it('does nothing when the AI model is not ready', () => {
    useAiMock.mockReturnValue({ ...readyAiValue(), status: 'not-downloaded' });
    useDatabaseMock.mockReturnValue({ status: 'ready', db: new FakeDb() });

    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
    expect(plugin.createChat).not.toHaveBeenCalled();
  });

  it('dispatches a toolCallRequested through the real ActionRegistry (F-14)', async () => {
    const documentRow = {
      id: 'd-1',
      name: 'Passport Copy',
      file_path: '/vault/doc.pdf',
      file_type: 'pdf',
      file_size: 1024,
      is_favorite: 0,
      is_locked: 0,
      is_archived: 0,
      language: 'en',
      source_type: 'file_picker',
      created_at: '2026-07-24T00:00:00.000Z',
      updated_at: '2026-07-24T00:00:00.000Z',
      synced: 0,
      version: 1,
    };
    const db = new FakeDb()
      .onQuery(/FROM ai_conversations/, [conversationRow])
      .onQuery(/FROM documents/, [documentRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    listeners.toolCallRequested?.({ requestId: 'req-1', name: 'ai.listDocuments', argumentsJson: '{}' });
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    expect(call?.[0]).toMatchObject({ requestId: 'req-1' });
    const result = JSON.parse(call?.[0]?.resultJson ?? '{}') as {
      ok: boolean;
      data: { documents: { id: string; name: string }[] };
    };
    expect(result.ok).toBe(true);
    expect(result.data.documents).toEqual([{
      id: 'd-1',
      name: 'Passport Copy',
      fileType: 'pdf',
      fileSizeBytes: 1024,
      isFavorite: false,
      isLocked: false,
      createdAt: '2026-07-24T00:00:00.000Z',
    }]);
  });

  it('rejects an unknown tool name with an ActionResult error, not a thrown exception', async () => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    listeners.toolCallRequested?.({ requestId: 'req-2', name: 'ai.doesNotExist', argumentsJson: '{}' });
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    const result = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean; code?: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AGENT_E_UNKNOWN_ACTION');
  });

  it.each([
    ['vault.openQuickReference', '/quick-reference'],
    ['vault.openQuickNotes', '/quick-notes'],
    ['vault.startQuickNote', '/quick-notes?new=1'],
    ['settings.open', '/settings'],
    ['tools.openPdfTools', '/pdf-tools'],
  ])('dispatches %s through the router (F-23)', async (name, path) => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    listeners.toolCallRequested?.({ requestId: 'req-nav', name, argumentsJson: '{}' });
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());

    expect(routerPush).toHaveBeenCalledWith(path, 'forward', 'push');
    const [call] = plugin.resolveToolCall.mock.calls;
    const result = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean; data?: { opened: boolean } };
    expect(result).toEqual({ ok: true, data: { opened: true } });
  });

  it('bug-audit fix: dispatches settings.setTheme through the real ThemeProvider, not silently AGENT_E_UNKNOWN_ACTION', async () => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    listeners.toolCallRequested?.({
      requestId: 'req-theme',
      name: 'settings.setTheme',
      argumentsJson: JSON.stringify({ theme: 'dark' }),
    });
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());

    expect(applyTheme).toHaveBeenCalledWith('dark');
    const [call] = plugin.resolveToolCall.mock.calls;
    const result = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean };
    expect(result.ok).toBe(true);
  });
});

describe('useChat document-op tools (F-14 document operations)', () => {
  const documentRow = {
    id: 'd-1',
    name: 'Report.pdf',
    file_path: '/vault/report.pdf',
    file_type: 'pdf',
    file_size: 2048,
    is_favorite: 0,
    is_locked: 0,
    is_archived: 0,
    language: 'en',
    source_type: 'file_picker',
    created_at: '2026-07-24T00:00:00.000Z',
    updated_at: '2026-07-24T00:00:00.000Z',
    synced: 0,
    version: 1,
  };

  function readyDbWithDocument(): FakeDb {
    return new FakeDb()
      .onQuery(/FROM ai_conversations/, [conversationRow])
      .onQuery(/FROM documents/, [documentRow]);
  }

  let dispatchCounter = 0;

  /** Renders once per describe-block test and waits for the chat session; call dispatch() per tool call. */
  async function renderReady(): Promise<void> {
    renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());
  }

  /** Dispatches one toolCallRequested against the already-rendered hook and returns its parsed result. */
  async function dispatch(name: string, args: unknown): Promise<{ ok: boolean; data?: unknown }> {
    const requestId = `req-op-${++dispatchCounter}`;
    plugin.resolveToolCall.mockClear();
    listeners.toolCallRequested?.({ requestId, name, argumentsJson: JSON.stringify(args) });
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    return JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean; data?: unknown };
  }

  it('mergeDocuments resolves each id via DocumentDao and forwards the entities to pdfEngine.mergePdfs', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: readyDbWithDocument() });
    pdfEngine.mergePdfs.mockResolvedValue(1);
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const result = await dispatch('ai.mergeDocuments', { documentIds: ['d-1', 'd-1'] });

    expect(pdfEngine.mergePdfs).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'd-1' }),
      expect.objectContaining({ id: 'd-1' }),
    ]);
    expect(result).toEqual({ ok: true, data: { created: 1, documents: [] } });
  });

  it('splitDocument converts 1-indexed inclusive ranges to 0-indexed before calling pdfEngine.splitPdf', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: readyDbWithDocument() });
    pdfEngine.splitPdf.mockResolvedValue(2);
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const result = await dispatch('ai.splitDocument', {
      documentId: 'd-1',
      ranges: [{ start: 1, end: 3 }],
    });

    expect(pdfEngine.splitPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd-1' }),
      [{ start: 0, end: 2 }]
    );
    expect(result).toEqual({ ok: true, data: { created: 2, documents: [] } });
  });

  it('compressDocument/watermarkDocument/convertImagesToPdf/convertPdfToImages/exportPdfText all forward correctly', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: readyDbWithDocument() });
    pdfEngine.compressPdf.mockResolvedValue(1);
    pdfEngine.watermarkPdf.mockResolvedValue(1);
    pdfEngine.imagesToPdf.mockResolvedValue(1);
    pdfEngine.pdfToImages.mockResolvedValue(4);
    pdfEngine.exportPdfText.mockResolvedValue(1);
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    expect(await dispatch('ai.compressDocument', { documentId: 'd-1', quality: 'low' })).toEqual({
      ok: true,
      data: { created: 1, documents: [] },
    });
    expect(pdfEngine.compressPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }), 'low');

    expect(await dispatch('ai.watermarkDocument', { documentId: 'd-1', text: 'DRAFT' })).toEqual({
      ok: true,
      data: { created: 1, documents: [] },
    });
    expect(pdfEngine.watermarkPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }), 'DRAFT');

    expect(await dispatch('ai.convertImagesToPdf', { documentIds: ['d-1'] })).toEqual({
      ok: true,
      data: { created: 1, documents: [] },
    });
    expect(pdfEngine.imagesToPdf).toHaveBeenCalledWith([expect.objectContaining({ id: 'd-1' })]);

    expect(await dispatch('ai.convertPdfToImages', { documentId: 'd-1', format: 'png' })).toEqual({
      ok: true,
      data: { created: 4, documents: [] },
    });
    expect(pdfEngine.pdfToImages).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }), {
      format: 'png',
    });

    expect(await dispatch('ai.exportPdfText', { documentId: 'd-1', format: 'md' })).toEqual({
      ok: true,
      data: { created: 1, documents: [] },
    });
    expect(pdfEngine.exportPdfText).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }), 'md');
  });

  it('fails cleanly (not a thrown exception) when the document id does not exist', async () => {
    useDatabaseMock.mockReturnValue({
      status: 'ready',
      db: new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]).onQuery(/FROM documents/, []),
    });
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const result = await dispatch('ai.compressDocument', { documentId: 'ghost', quality: 'medium' });

    expect(result.ok).toBe(false);
    expect(pdfEngine.compressPdf).not.toHaveBeenCalled();
  });

  it('fails cleanly when pdfEngine reports 0 documents created (its own error state, not a rejection)', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: readyDbWithDocument() });
    pdfEngine.watermarkPdf.mockResolvedValue(0);
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const result = await dispatch('ai.watermarkDocument', { documentId: 'd-1', text: 'DRAFT' });

    expect(result.ok).toBe(false);
  });

  it('ai.loadSkill returns the skill rules and tools through the real registry', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: readyDbWithDocument() });
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const result = await dispatch('ai.loadSkill', { name: 'pdf-tools' });
    expect(result.ok).toBe(true);
    const data = result.data as { loaded: string; tools: string[] };
    expect(data.loaded).toBe('pdf-tools');
    expect(data.tools).toContain('ai.mergeDocuments');

    const unknown = await dispatch('ai.loadSkill', { name: 'nope' });
    expect(unknown.ok).toBe(false);
  });

  it('image tools: resize forwards dimensions and budget, ocr returns only a character count', async () => {
    useDatabaseMock.mockReturnValue({ status: 'ready', db: readyDbWithDocument() });
    imageOps.resizeRun.mockResolvedValue({
      saved: true,
      hitQualityFloor: false,
      resultSizeBytes: 40_000,
      belowMinSize: false,
    });
    imageOps.extractText.mockResolvedValue('secret text 123');
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const resized = await dispatch('ai.resizeImage', {
      documentId: 'd-1',
      width: 200,
      height: 230,
      maxSizeKb: 50,
    });
    expect(imageOps.resizeRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }), {
      width: 200,
      height: 230,
      maxSizeBytes: 50 * 1024,
    });
    expect(resized.ok).toBe(true);

    const ocr = await dispatch('ai.runOcr', { documentId: 'd-1' });
    expect(ocr).toEqual({ ok: true, data: { characters: 15 } });
  });

  it('PDF tools refuse a locked document before running anything (lock gate covers every tool)', async () => {
    const lockedRow = { ...documentRow, is_locked: 1 };
    useDatabaseMock.mockReturnValue({
      status: 'ready',
      db: new FakeDb()
        .onQuery(/FROM ai_conversations/, [conversationRow])
        .onQuery(/FROM documents/, [lockedRow]),
    });
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const merged = await dispatch('ai.mergeDocuments', { documentIds: ['d-1', 'd-1'] });
    const split = await dispatch('ai.splitDocument', { documentId: 'd-1', ranges: [{ start: 1, end: 1 }] });

    expect(merged.ok).toBe(false);
    expect(split.ok).toBe(false);
    expect(pdfEngine.mergePdfs).not.toHaveBeenCalled();
    expect(pdfEngine.splitPdf).not.toHaveBeenCalled();
  });

  it('image tools refuse a locked document before running anything', async () => {
    const lockedRow = { ...documentRow, is_locked: 1 };
    useDatabaseMock.mockReturnValue({
      status: 'ready',
      db: new FakeDb()
        .onQuery(/FROM ai_conversations/, [conversationRow])
        .onQuery(/FROM documents/, [lockedRow]),
    });
    plugin.resolveToolCall.mockResolvedValue(undefined);
    await renderReady();

    const result = await dispatch('ai.enhanceImage', { documentId: 'd-1', preset: 'bw' });
    expect(result.ok).toBe(false);
    expect(imageOps.applyFilter).not.toHaveBeenCalled();
  });
});

describe('useChat confirmation-card flow (bug-audit hardening follow-up)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderReadyWithPending() {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    const hook = renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    act(() => {
      listeners.toolCallRequested?.({
        requestId: 'req-confirm',
        name: 'test.destructiveThing',
        argumentsJson: '{}',
      });
    });
    await waitFor(() => expect(hook.result.current.pendingConfirmation).not.toBeNull());
    return hook;
  }

  it('sets a pending confirmation instead of resolving immediately', async () => {
    const { result } = await renderReadyWithPending();
    expect(result.current.pendingConfirmation).toEqual({
      requestId: 'req-confirm',
      actionId: 'test.destructiveThing',
      summary: 'Do a destructive test thing.',
      expired: false,
    });
    expect(plugin.resolveToolCall).not.toHaveBeenCalled();
  });

  it('confirmPendingToolCall invokes the tool and resolves the native call', async () => {
    const { result } = await renderReadyWithPending();

    await act(async () => {
      result.current.confirmPendingToolCall();
      await Promise.resolve();
    });

    expect(result.current.pendingConfirmation).toBeNull();
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    expect(call?.[0]).toMatchObject({ requestId: 'req-confirm' });
    const parsed = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean; data?: { done: boolean } };
    expect(parsed).toEqual({ ok: true, data: { done: true } });
  });

  it('rejectPendingToolCall declines without invoking the tool', async () => {
    const { result } = await renderReadyWithPending();

    await act(async () => {
      result.current.rejectPendingToolCall();
      await Promise.resolve();
    });

    expect(result.current.pendingConfirmation).toBeNull();
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    const parsed = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean; code?: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('AGENT_E_USER_DECLINED');
  });

  it('expires the card client-side before the native 30s bridge timeout, without resolving it', async () => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    // Switch to fake timers only now — everything above is real async
    // DB/session setup that should settle under real timers first.
    vi.useFakeTimers();

    act(() => {
      listeners.toolCallRequested?.({
        requestId: 'req-expire',
        name: 'test.destructiveThing',
        argumentsJson: '{}',
      });
    });
    expect(result.current.pendingConfirmation?.expired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(result.current.pendingConfirmation?.expired).toBe(true);
    expect(plugin.resolveToolCall).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissExpiredConfirmation();
    });
    expect(result.current.pendingConfirmation).toBeNull();
  });

  it('bug-audit fix: a second requiresConfirmation call while one is pending is refused, not silently overwritten', async () => {
    const hook = await renderReadyWithPending();
    plugin.resolveToolCall.mockClear();

    act(() => {
      listeners.toolCallRequested?.({
        requestId: 'req-second',
        name: 'test.destructiveThing',
        argumentsJson: '{}',
      });
    });

    // The FIRST card is still the one showing — never silently replaced.
    expect(hook.result.current.pendingConfirmation?.requestId).toBe('req-confirm');
    // The second call gets an immediate "busy" resolve of its own requestId.
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    expect(call?.[0]).toMatchObject({ requestId: 'req-second' });
    const parsed = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean };
    expect(parsed.ok).toBe(false);

    // Confirming still resolves the FIRST (still-pending) requestId.
    await act(async () => {
      hook.result.current.confirmPendingToolCall();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledTimes(2));
    expect(plugin.resolveToolCall.mock.calls[1]?.[0]).toMatchObject({ requestId: 'req-confirm' });
  });

  it('bug-audit fix: confirming after real elapsed time exceeds the native 30s timeout does not run the tool for real', async () => {
    const db = new FakeDb().onQuery(/FROM ai_conversations/, [conversationRow]);
    useDatabaseMock.mockReturnValue({ status: 'ready', db });
    plugin.resolveToolCall.mockResolvedValue(undefined);

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(plugin.createChat).toHaveBeenCalledOnce());

    vi.useFakeTimers();
    act(() => {
      listeners.toolCallRequested?.({
        requestId: 'req-stale',
        name: 'test.destructiveThing',
        argumentsJson: '{}',
      });
    });
    expect(result.current.pendingConfirmation?.expired).toBe(false);

    // Simulate a throttled/backgrounded WebView: real time moves past the
    // native bridge's own 30s timeout, but the client's 25s setTimeout
    // never actually fires (no advanceTimersByTime) — the card still looks
    // "active" from the UI's own perspective.
    vi.setSystemTime(Date.now() + 31_000);
    expect(result.current.pendingConfirmation?.expired).toBe(false);

    await act(async () => {
      result.current.confirmPendingToolCall();
      await Promise.resolve();
    });

    await vi.waitFor(() => expect(plugin.resolveToolCall).toHaveBeenCalledOnce());
    const [call] = plugin.resolveToolCall.mock.calls;
    const parsed = JSON.parse(call?.[0]?.resultJson ?? '{}') as { ok: boolean; code?: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('AGENT_E_TIMEOUT');
  });
});

describe('trackCreated (document ids for tool results)', () => {
  const row = (id: string): never => ({ id, name: `${id}.pdf`, fileType: 'pdf', filePath: `documents/${id}.pdf`, fileSize: 10 }) as never;

  it('reports exactly the documents that appeared while the operation ran', async () => {
    const findAll = vi.fn().mockResolvedValueOnce([row('a')]).mockResolvedValueOnce([row('a'), row('b'), row('c')]);
    const out = await trackCreated({ findAll } as never, () => Promise.resolve(2));
    expect(out.created).toBe(2);
    expect(out.documents.map((d) => d.id)).toEqual(['b', 'c']);
    expect(out.documents[0]).toMatchObject({ id: 'b', name: 'b.pdf', fileType: 'pdf' });
  });

  it('reports no documents when nothing new appeared, and propagates a failing operation', async () => {
    const same = vi.fn().mockResolvedValue([row('a')]);
    expect((await trackCreated({ findAll: same } as never, () => Promise.resolve(0))).documents).toEqual([]);
    await expect(trackCreated({ findAll: same } as never, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });
});
