import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { useAi } from '@/app/providers/AIProvider';
import { FakeDb } from '@/test/fake-db';
import { useChat } from '../useChat';

vi.mock('@/app/providers/DatabaseProvider', () => ({ useDatabase: vi.fn() }));
vi.mock('@/app/providers/AIProvider', () => ({ useAi: vi.fn() }));

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
    modelSizeBytes: 497_664_000,
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
});
