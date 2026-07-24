/**
 * Chat conversation hook (F-13, 05-ai-assistant-module.md §5/§8). One
 * ongoing conversation — reuses the most recently updated one if any
 * exists, otherwise creates one on first use (mirrors useQuickReference's
 * shape, backed by the pre-scaffolded AiConversationDao). Wires the
 * native plugin's streaming events (textFromAi/aiFinished/generationError)
 * to a single in-progress `streamingText`, persisted as a real message
 * only once the model finishes — a mid-stream crash never leaves a
 * half-written assistant turn in history.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CapacitorLlmLiteRT, type ToolCallRequestedEvent } from '@kagaz/capacitor-llm-litert';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { useAi } from '@/app/providers/AIProvider';
import { log } from '@/core/logging';
import { AiConversationDao } from '@/infrastructure/database/dao';
import type { AiMessageEntity } from '@/infrastructure/database/types';

const logger = log('ai-assistant');

/** What {@link useChat} exposes. */
export interface UseChatResult {
  /** Persisted turns, oldest first. */
  messages: AiMessageEntity[];
  /** The in-progress assistant response, or '' when not streaming. */
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  /** True until the conversation + its history have loaded. */
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
}

/** True once the model is ready and a native chat session + conversation are set up. */
export function useChat(): UseChatResult {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new AiConversationDao(db) : null), [db]);
  const ai = useAi();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageEntity[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const chatSessionId = useRef<string | null>(null);
  const streamingBuffer = useRef('');

  // Load-or-create the conversation once the model is ready.
  useEffect(() => {
    if (!dao || ai.status !== 'ready') {
      return;
    }
    let cancelled = false;
    void (async (): Promise<void> => {
      setIsLoading(true);
      const existing = await dao.findAll();
      const conversation = existing[0] ?? (await dao.create());
      if (cancelled) {
        return;
      }
      setConversationId(conversation.id);
      const history = await dao.findMessages(conversation.id);
      if (!cancelled) {
        setMessages(history);
        setIsLoading(false);
      }
    })().catch((loadError: unknown) => {
      if (!cancelled) {
        logger.warn({ event: 'ai.chat.load_failed', err: { message: String(loadError) } });
        setIsLoading(false);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [dao, ai.status]);

  // One native chat session per ready model load.
  useEffect(() => {
    if (ai.status !== 'ready') {
      chatSessionId.current = null;
      return;
    }
    let cancelled = false;
    void CapacitorLlmLiteRT.createChat().then(({ id }) => {
      if (!cancelled) {
        chatSessionId.current = id;
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [ai.status]);

  // Persist the accumulated streamingBuffer once as an assistant turn.
  const finishStreaming = useCallback((): void => {
    const text = streamingBuffer.current.trim();
    streamingBuffer.current = '';
    setStreamingText('');
    setIsStreaming(false);
    if (!text || !dao || !conversationId) {
      return;
    }
    void dao
      .appendMessage({ conversationId, role: 'assistant', content: text })
      .then((message) => setMessages((prev) => [...prev, message]))
      .catch((persistError: unknown) => {
        logger.warn({ event: 'ai.chat.persist_failed', err: { message: String(persistError) } });
      });
  }, [dao, conversationId]);

  useEffect(() => {
    if (ai.status !== 'ready') {
      return;
    }
    const subscriptions = [
      CapacitorLlmLiteRT.addListener('textFromAi', (event) => {
        if (event.chatId !== chatSessionId.current) {
          return;
        }
        streamingBuffer.current += event.text;
        setStreamingText(streamingBuffer.current);
      }),
      CapacitorLlmLiteRT.addListener('aiFinished', (event) => {
        if (event.chatId !== chatSessionId.current) {
          return;
        }
        finishStreaming();
      }),
      CapacitorLlmLiteRT.addListener('generationError', (event) => {
        if (event.chatId && event.chatId !== chatSessionId.current) {
          return;
        }
        logger.warn({ event: 'ai.chat.generation_failed', err: { message: event.error } });
        streamingBuffer.current = '';
        setStreamingText('');
        setIsStreaming(false);
        setError(event.error);
      }),
      // Placeholder listener until F-14 wires a real ToolCallingEngine —
      // without this, an untended tool call blocks the native side for the
      // full 30s bridge timeout on every turn that happens to trigger one.
      CapacitorLlmLiteRT.addListener('toolCallRequested', (event: ToolCallRequestedEvent) => {
        void CapacitorLlmLiteRT.resolveToolCall({
          requestId: event.requestId,
          resultJson: '{"error":"No tools are registered yet"}',
        });
      }),
    ];
    return (): void => {
      subscriptions.forEach((subscription) => void subscription.then((s) => s.remove()));
    };
  }, [ai.status, finishStreaming]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || !dao || !conversationId || !chatSessionId.current) {
        return;
      }
      setError(null);
      const userMessage = await dao.appendMessage({ conversationId, role: 'user', content: trimmed });
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      streamingBuffer.current = '';
      setStreamingText('');
      try {
        await CapacitorLlmLiteRT.sendMessage({ chatId: chatSessionId.current, message: trimmed });
      } catch (sendError) {
        logger.warn({ event: 'ai.chat.send_failed', err: { message: String(sendError) } });
        setIsStreaming(false);
        setError('Failed to reach the AI Assistant');
      }
    },
    [dao, conversationId]
  );

  return { messages, streamingText, isStreaming, error, isLoading, sendMessage };
}
