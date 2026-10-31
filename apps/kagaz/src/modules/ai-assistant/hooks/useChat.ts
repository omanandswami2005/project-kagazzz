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
import { useIonRouter } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { CapacitorLlmLiteRT, type ToolCallRequestedEvent } from '@kagaz/capacitor-llm-litert';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { useAi } from '@/app/providers/AIProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { log } from '@/core/logging';
import { usePreferencesStore } from '@/core/preferences';
import { AiConversationDao, DocumentDao } from '@/infrastructure/database/dao';
import type { AiMessageEntity, DocumentEntity } from '@/infrastructure/database/types';
import { buildFtsMatchQuery } from '@/infrastructure/database/fts-query';
import { useDocumentOcr } from '@/modules/document-vault/hooks/useDocumentOcr';
import { useImageEnhancement } from '@/modules/document-vault/hooks/useImageEnhancement';
import { useResizeCompress } from '@/modules/document-vault/hooks/useResizeCompress';
import { usePdfEngine } from '@/modules/pdf-engine/hooks/usePdfEngine';
import type { AiToolContext, DocumentSummary } from '../ai-tools.actions';
import { toDocumentSummary } from '../ai-tools.actions';
import { aiToolRegistry } from '../services/ai-tool-registry';

const logger = log('ai-assistant');

/** Resolves a model-supplied document id, throwing a clear message if it doesn't exist. */
async function requireDocument(documentDao: DocumentDao, id: string): Promise<DocumentEntity> {
  const doc = await documentDao.findById(id);
  if (!doc) {
    throw new Error(`No document found with id "${id}"`);
  }
  return doc;
}

/**
 * Image tools reuse vault hooks that don't gate on the per-document lock
 * (only OCR does), so refuse locked documents here — the model must never
 * process a locked file without the biometric prompt (10-security §3.1).
 */
async function requireUnlockedDocument(documentDao: DocumentDao, id: string): Promise<DocumentEntity> {
  const doc = await requireDocument(documentDao, id);
  if (doc.isLocked) {
    throw new Error('This document is locked; open it yourself to use it');
  }
  return doc;
}

async function requireDocuments(documentDao: DocumentDao, ids: string[]): Promise<DocumentEntity[]> {
  return Promise.all(ids.map((id) => requireDocument(documentDao, id)));
}

/**
 * `usePdfEngine`'s ops swallow their own errors (they set React state and
 * resolve 0 rather than rejecting — see the hook's own `run()`), so a
 * count of 0 is the only failure signal available here. Converting it to
 * a thrown Error lets `ActionRegistry.invoke()`'s existing exception-to-
 * ActionResult mapping produce a real failure instead of a silent
 * `{ created: 0 }` success.
 */
function requireSaved(count: number, opName: string): number {
  if (count === 0) {
    throw new Error(`${opName} did not produce a document`);
  }
  return count;
}

/**
 * The native bridge itself times out a pending tool call after 30s
 * (JsBridgeTool.java) with no way for JS to extend or observe that timer.
 * Expiring the card client-side a little earlier means the user is never
 * shown a card that can silently no-op — see the `expired` branch in
 * {@link useChat}.
 */
const CONFIRMATION_TIMEOUT_MS = 25_000;

/**
 * The native bridge's own hard timeout (JsBridgeTool.java) — used only as a
 * real-wall-clock safety check in `resolvePendingToolCall`, not as the
 * primary expiry mechanism (that's `CONFIRMATION_TIMEOUT_MS`'s `setTimeout`
 * above). Bug-audit fix: a backgrounded WebView can throttle `setTimeout`,
 * so the 25s client timer isn't a reliable guarantee that a still-"active"
 * card hasn't actually outlived the native call already — checking real
 * elapsed time here prevents running a real side effect (Confirm tapped)
 * against a request the native side has already given up on.
 */
const NATIVE_TIMEOUT_MS = 30_000;

/** A destructive tool call awaiting the user's yes/no in the chat UI. */
export interface PendingToolConfirmation {
  requestId: string;
  /** The tool's own dotted action id (e.g. `vault.bulkDelete`). */
  actionId: string;
  /** The action's `summary`, shown as the card's question. */
  summary: string;
  /** True once the native 30s bridge timeout has very likely already fired. */
  expired: boolean;
}

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
  /** A destructive tool call waiting on the confirmation card, if any. */
  pendingConfirmation: PendingToolConfirmation | null;
  /** Runs the pending tool call and resolves it back to the model. */
  confirmPendingToolCall: () => void;
  /** Declines the pending tool call; the model is told the user said no. */
  rejectPendingToolCall: () => void;
  /** Clears an expired card without touching the (already-timed-out) native call. */
  dismissExpiredConfirmation: () => void;
}

/** True once the model is ready and a native chat session + conversation are set up. */
export function useChat(): UseChatResult {
  const { db } = useDatabase();
  const dao = useMemo(() => (db ? new AiConversationDao(db) : null), [db]);
  const documentDao = useMemo(() => (db ? new DocumentDao(db) : null), [db]);
  const ai = useAi();
  const router = useIonRouter();
  const { setTheme: applyTheme } = useTheme();
  const { i18n } = useTranslation();
  const setSwipeAction = usePreferencesStore((s) => s.setSwipeAction);
  const pdfEngine = usePdfEngine();
  const { run: resizeCompressRun } = useResizeCompress();
  const { applyFilter } = useImageEnhancement();
  const { extractText } = useDocumentOcr();
  const { mergePdfs, splitPdf, compressPdf, watermarkPdf, imagesToPdf, pdfToImages, exportPdfText } =
    pdfEngine;

  // F-14/F-23: the context ai-tools.actions.ts's + ai-navigation.actions.ts's
  // + ai-document-ops.actions.ts's handlers run against — built fresh
  // whenever documentDao/router/pdfEngine ops change, never persisted past
  // a re-render. The nav methods need nothing but the router (no
  // page-local UI state), unlike vault.actions.ts's other actions — see
  // ai-navigation.actions.ts's doc comment. The document-op methods reuse
  // the exact same pdf-engine ops PDF Tools runs (usePdfEngine) — real
  // file operations, resolved from a model-supplied id via DocumentDao.
  const toolContext = useMemo<AiToolContext | null>(() => {
    if (!documentDao) {
      return null;
    }
    return {
      // [SEC] Bug-audit fix: locked documents must never appear in AI
      // list/search results, same invariant useSearch.ts already enforces
      // for the human search UI over this same DAO — the AI tools were
      // missing the filter entirely, leaking a locked doc's name/type/size
      // into the chat transcript with no biometric gate.
      listDocuments: async (limit): Promise<DocumentSummary[]> =>
        (await documentDao.findAll())
          .filter((doc) => !doc.isLocked)
          .slice(0, limit)
          .map(toDocumentSummary),
      searchDocuments: async (query, limit): Promise<DocumentSummary[]> => {
        const match = buildFtsMatchQuery(query);
        if (!match) {
          return [];
        }
        return (await documentDao.search(match, limit))
          .filter((doc) => !doc.isLocked)
          .map(toDocumentSummary);
      },
      openQuickReference: (): void => router.push('/quick-reference', 'forward', 'push'),
      openQuickNotes: (): void => router.push('/quick-notes', 'forward', 'push'),
      startQuickNote: (): void => router.push('/quick-notes?new=1', 'forward', 'push'),
      openSettings: (): void => router.push('/settings', 'forward', 'push'),
      openPdfTools: (): void => router.push('/pdf-tools', 'forward', 'push'),
      mergeDocuments: async (documentIds): Promise<number> => {
        const docs = await requireDocuments(documentDao, documentIds);
        return requireSaved(await mergePdfs(docs), 'Merge');
      },
      splitDocument: async (documentId, ranges): Promise<number> => {
        const doc = await requireDocument(documentDao, documentId);
        // Model-facing ranges are 1-indexed inclusive; PageRange is 0-indexed.
        const zeroIndexed = ranges.map(({ start, end }) => ({ start: start - 1, end: end - 1 }));
        return requireSaved(await splitPdf(doc, zeroIndexed), 'Split');
      },
      compressDocument: async (documentId, quality): Promise<number> => {
        const doc = await requireDocument(documentDao, documentId);
        return requireSaved(await compressPdf(doc, quality), 'Compress');
      },
      watermarkDocument: async (documentId, text): Promise<number> => {
        const doc = await requireDocument(documentDao, documentId);
        return requireSaved(await watermarkPdf(doc, text), 'Watermark');
      },
      convertImagesToPdf: async (documentIds): Promise<number> => {
        const docs = await requireDocuments(documentDao, documentIds);
        return requireSaved(await imagesToPdf(docs), 'Images-to-PDF');
      },
      convertPdfToImages: async (documentId, format): Promise<number> => {
        const doc = await requireDocument(documentDao, documentId);
        return requireSaved(await pdfToImages(doc, { format }), 'PDF-to-images');
      },
      exportPdfText: async (documentId, format): Promise<number> => {
        const doc = await requireDocument(documentDao, documentId);
        return requireSaved(await exportPdfText(doc, format), 'Text export');
      },
      resizeImage: async (documentId, width, height, maxSizeBytes): ReturnType<AiToolContext['resizeImage']> => {
        const doc = await requireUnlockedDocument(documentDao, documentId);
        const outcome = await resizeCompressRun(doc, { width, height, maxSizeBytes });
        if (!outcome.saved) {
          throw new Error('Resize did not produce a document');
        }
        return {
          created: 1,
          resultSizeBytes: outcome.resultSizeBytes,
          hitQualityFloor: outcome.hitQualityFloor,
        };
      },
      enhanceImage: async (documentId, preset): Promise<number> => {
        const doc = await requireUnlockedDocument(documentDao, documentId);
        if (!(await applyFilter(doc, preset))) {
          throw new Error('Enhance did not produce a document');
        }
        return 1;
      },
      runOcr: async (documentId): Promise<number> => {
        const doc = await requireUnlockedDocument(documentDao, documentId);
        const text = await extractText(doc);
        if (text === null) {
          throw new Error('No text could be read from this document');
        }
        return text.length;
      },
      // Bug-audit fix: settings.actions.ts's setTheme/setLanguage/
      // setSwipeAction were never registered into aiToolRegistry at all —
      // saying "dark mode" or "switch to hindi" to the assistant silently
      // failed despite SettingsPage.skill.md documenting both as working.
      // See ai-settings.actions.ts's doc comment for the full story.
      setTheme: (theme): void => applyTheme(theme),
      setLanguage: (language): void => void i18n.changeLanguage(language),
      setSwipeAction: (side, action): void => setSwipeAction(side, action),
    };
  }, [
    documentDao,
    router,
    mergePdfs,
    splitPdf,
    compressPdf,
    watermarkPdf,
    imagesToPdf,
    pdfToImages,
    exportPdfText,
    resizeCompressRun,
    applyFilter,
    extractText,
    applyTheme,
    i18n,
    setSwipeAction,
  ]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessageEntity[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingToolConfirmation | null>(
    null
  );

  const chatSessionId = useRef<string | null>(null);
  const streamingBuffer = useRef('');
  /**
   * The full call the card resolves on confirm/reject — not in state since
   * it's never rendered. `requestedAt` is a real wall-clock timestamp (not
   * just "the 25s JS timer fired") — bug-audit fix: a backgrounded WebView
   * can throttle `setTimeout`, so a stale card could still show live
   * Confirm/Reject after the native bridge's own 30s timeout already fired;
   * resolvePendingToolCall checks elapsed real time before running a real
   * side effect, not just whether the client timer happened to fire.
   */
  const pendingToolCallRef = useRef<
    { requestId: string; name: string; args: unknown; requestedAt: number } | null
  >(null);

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
      // F-14: dispatches through the same real ActionRegistry the rest of
      // the agent-interface contract uses — args validation, confirmation
      // gating, and exception-to-ActionResult mapping all happen in
      // aiToolRegistry.invoke(), not here. A `requiresConfirmation` action
      // returns null (not a JSON string) to signal "don't resolve yet" —
      // the card resolves it later via confirmPendingToolCall/
      // rejectPendingToolCall (05-ai-assistant-module.md §4.3's
      // `needsConfirmation` contract).
      CapacitorLlmLiteRT.addListener('toolCallRequested', (event: ToolCallRequestedEvent) => {
        void (async (): Promise<string | null> => {
          if (!toolContext) {
            return JSON.stringify({ ok: false, error: 'AI tools are not available yet' });
          }
          let args: unknown;
          try {
            args = JSON.parse(event.argumentsJson) as unknown;
          } catch {
            return JSON.stringify({ ok: false, error: 'Malformed tool arguments' });
          }
          const action = aiToolRegistry.get(event.name);
          if (action?.requiresConfirmation) {
            // Bug-audit fix: a second requiresConfirmation call arriving
            // before the first is resolved used to silently overwrite
            // pendingToolCallRef/pendingConfirmation — the first call's
            // requestId was then never confirmed, rejected, or expired by
            // the client at all, only eventually hitting the native 30s
            // timeout with the user never having been asked. Refuse the
            // second call outright instead; the model can retry once the
            // first is answered.
            if (pendingToolCallRef.current) {
              return JSON.stringify({
                ok: false,
                error: 'Another confirmation is already pending — wait for the user to respond to it first.',
              });
            }
            pendingToolCallRef.current = {
              requestId: event.requestId,
              name: event.name,
              args,
              requestedAt: Date.now(),
            };
            setPendingConfirmation({
              requestId: event.requestId,
              actionId: event.name,
              summary: action.summary,
              expired: false,
            });
            return null;
          }
          const result = await aiToolRegistry.invoke(event.name, args, toolContext);
          return JSON.stringify(result);
        })()
          .then((resultJson) => {
            if (resultJson === null) {
              return;
            }
            return CapacitorLlmLiteRT.resolveToolCall({ requestId: event.requestId, resultJson });
          })
          .catch((toolError: unknown) => {
            logger.warn({ event: 'ai.chat.tool_call_failed', err: { message: String(toolError) } });
            // Bug-audit fix: the most likely reason to land here is the
            // FIRST resolveToolCall (above) rejecting because the native
            // 30s timeout already fired for this requestId — the same
            // benign case resolvePendingToolCall's own catch already
            // documents. This retry can reject for the identical reason;
            // without its own catch it was an unhandled promise rejection.
            CapacitorLlmLiteRT.resolveToolCall({
              requestId: event.requestId,
              resultJson: JSON.stringify({ ok: false, error: 'Tool call failed' }),
            }).catch((resolveError: unknown) => {
              logger.warn({
                event: 'ai.chat.tool_call_resolve_after_timeout',
                err: { message: String(resolveError) },
              });
            });
          });
      }),
    ];
    return (): void => {
      subscriptions.forEach((subscription) => void subscription.then((s) => s.remove()));
    };
  }, [ai.status, finishStreaming, toolContext]);

  // Expires a pending confirmation client-side shortly before the native
  // bridge's own 30s timeout (see CONFIRMATION_TIMEOUT_MS) so the card never
  // keeps offering a Yes/No that would silently no-op against an
  // already-timed-out native call.
  useEffect(() => {
    if (!pendingConfirmation || pendingConfirmation.expired) {
      return;
    }
    const requestId = pendingConfirmation.requestId;
    const timer = setTimeout(() => {
      if (pendingToolCallRef.current?.requestId === requestId) {
        pendingToolCallRef.current = null;
        setPendingConfirmation((prev) =>
          prev && prev.requestId === requestId ? { ...prev, expired: true } : prev
        );
      }
    }, CONFIRMATION_TIMEOUT_MS);
    return (): void => clearTimeout(timer);
  }, [pendingConfirmation]);

  const resolvePendingToolCall = useCallback(
    async (accepted: boolean): Promise<void> => {
      const pending = pendingToolCallRef.current;
      if (!pending || !toolContext) {
        return;
      }
      pendingToolCallRef.current = null;
      setPendingConfirmation(null);
      const nativeLikelyTimedOut = Date.now() - pending.requestedAt >= NATIVE_TIMEOUT_MS;
      const result =
        accepted && !nativeLikelyTimedOut
          ? await aiToolRegistry.invoke(pending.name, pending.args, toolContext)
          : accepted
            ? {
                ok: false as const,
                code: 'AGENT_E_TIMEOUT',
                message: 'Confirmation arrived after the native bridge already timed out',
                retryable: true,
                userMessage: 'That took too long to confirm — please ask again.',
              }
            : {
                ok: false as const,
                code: 'AGENT_E_USER_DECLINED',
                message: 'User declined the confirmation card',
                retryable: false,
                userMessage: 'Okay, I will not do that.',
              };
      try {
        await CapacitorLlmLiteRT.resolveToolCall({
          requestId: pending.requestId,
          resultJson: JSON.stringify(result),
        });
      } catch (resolveError) {
        // Per the plugin's own contract, resolving a requestId the native
        // side already timed out is a benign no-op, not a real failure —
        // there's nothing to recover, the model has already moved on.
        logger.warn({
          event: 'ai.chat.tool_call_resolve_after_timeout',
          err: { message: String(resolveError) },
        });
      }
    },
    [toolContext]
  );

  const confirmPendingToolCall = useCallback((): void => {
    void resolvePendingToolCall(true);
  }, [resolvePendingToolCall]);

  const rejectPendingToolCall = useCallback((): void => {
    void resolvePendingToolCall(false);
  }, [resolvePendingToolCall]);

  const dismissExpiredConfirmation = useCallback((): void => {
    setPendingConfirmation(null);
  }, []);

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

  return {
    messages,
    streamingText,
    isStreaming,
    error,
    isLoading,
    sendMessage,
    pendingConfirmation,
    confirmPendingToolCall,
    rejectPendingToolCall,
    dismissExpiredConfirmation,
  };
}
