/**
 * AI chat screen (F-13, 05-ai-assistant-module.md §5). Gate: until the model
 * is `ready` the conversation is not rendered. A model already on disk
 * (`downloaded`) is loaded automatically; otherwise the gate links to the
 * model management page (`/ai-assistant`) — the chat itself never offers
 * Download or Delete.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { ASK_PARAM, ATTACH_PARAM } from '@/core/constants/routes';
import { Button, Icon, Spinner } from '@kagaz/ui';
import { AskUserForm } from '../components/AskUserForm';
import { ChatTextarea } from '../components/ChatTextarea';
import { DocLinkProvider } from '../components/DocumentLinks';
import { Markdown } from '../components/Markdown';
import { AttachSheet } from '../components/AttachSheet';
import { ConversationsSheet } from '../components/ConversationsSheet';
import { AttachmentChips, ResultCard, ToolChip } from '../components/MessageParts';
import { MicButton } from '../components/MicButton';
import { DocumentPreviewModal } from '@/modules/document-vault/components/DocumentPreviewModal';
import { UploadOptionsSheet } from '@/modules/document-vault/components/UploadOptionsSheet';
import { useUpload } from '@/modules/document-vault/hooks/useUpload';
import { pickFiles, type UploadSource } from '@/modules/document-vault/services/upload-sources';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useAttachableDocuments } from '../hooks/useAttachableDocuments';
import { answeredFormIds, parseParts, type DocRef } from '../types/message-parts';
import { useAi } from '@/app/providers/AIProvider';
import { useChat } from '../hooks/useChat';
import { AI_TOOL_DESCRIPTORS } from '../services/ai-tool-registry';
import './chat.css';

/** The stored shape of an attached document. */
const toRef = (d: DocumentEntity): DocRef => ({ id: d.id, name: d.name, fileType: d.fileType });

/** The AI Assistant chat screen. */
export function ChatPage(): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const router = useIonRouter();
  const ai = useAi();
  const chat = useChat();
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<DocRef[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Forms the model asked for that the user has not answered yet (a reloaded, answered form must not reappear).
  const answered = useMemo(() => answeredFormIds(chat.messages), [chat.messages]);
  const hasOpenForm = useMemo(
    () =>
      chat.messages.some((m) =>
        parseParts(m.partsJson).some((p) => p.type === 'form' && !answered.has(p.formId))
      ),
    [chat.messages, answered]
  );
  const attachable = useAttachableDocuments(
    `${attachOpen}|${hasOpenForm}|${chat.messages.length}`
  );
  // In-chat preview (smart UI plan §5): links and result cards open it here.
  const [preview, setPreview] = useState<DocumentEntity | null>(null);
  const openFull = useCallback(
    (doc: DocumentEntity): void => {
      setPreview(null);
      router.push(`/doc/${doc.id}`, 'forward', 'push');
    },
    [router]
  );
  // A result card only knows the id; locked or deleted ones aren't in the
  // list, so they go to the viewer (which handles the lock / missing case).
  const previewById = (id: string): void => {
    const doc = attachable.documents.find((d) => d.id === id);
    if (doc) {
      setPreview(doc);
    } else {
      router.push(`/doc/${id}`, 'forward', 'push');
    }
  };
  const { ingestFiles } = useUpload();
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // jsdom has no scrollIntoView implementation — guard rather than crash
    // the test render tree (real browsers/WebViews always have it).
    if (typeof listEndRef.current?.scrollIntoView === 'function') {
      listEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [chat.messages, chat.streamingText, chat.pendingConfirmation]);

  const gated = ai.status !== 'ready';

  // A model that is already on disk loads as soon as the chat opens — the user never has to visit
  // the management page again after the first download. Once per mount: a failed load shows Retry
  // instead of looping.
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (ai.status === 'downloaded' && !autoLoaded.current) {
      autoLoaded.current = true;
      void ai.activate(AI_TOOL_DESCRIPTORS);
    }
  }, [ai]);

  const addAttachments = (docs: DocumentEntity[]): void =>
    setAttachments((prev) => [
      ...prev,
      ...docs.filter((d) => !prev.some((p) => p.id === d.id)).map(toRef),
    ]);

  // "Ask AI about this" (viewer, upload toast): `?attach=<id>` pre-attaches
  // that document once it is in the (unlocked) list, then clears the param so
  // a back/forward doesn't attach it again.
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const handoffId = params.get(ATTACH_PARAM);
  // "Ask AI to find …" (vault search, VH-13): the text waits in the
  // composer — the user still decides to send it.
  const askText = params.get(ASK_PARAM);
  const [handledAsk, setHandledAsk] = useState<string | null>(null);
  if (askText && handledAsk !== askText) {
    setHandledAsk(askText);
    setDraft(askText);
  }
  const handoffDoc = handoffId ? attachable.documents.find((d) => d.id === handoffId) : undefined;
  const [handledHandoff, setHandledHandoff] = useState<string | null>(null);
  if (handoffDoc && handledHandoff !== handoffDoc.id) {
    // Adjusting state while rendering (React's documented pattern) — not an effect.
    setHandledHandoff(handoffDoc.id);
    setAttachments((prev) => (prev.some((p) => p.id === handoffDoc.id) ? prev : [...prev, toRef(handoffDoc)]));
  }
  useEffect(() => {
    if (
      (handledHandoff && handoffId === handledHandoff) ||
      (handledAsk && askText === handledAsk)
    ) {
      history.replace(location.pathname);
    }
  }, [handledHandoff, handoffId, handledAsk, askText, history, location.pathname]);

  const submit = (): void => {
    if ((!draft.trim() && attachments.length === 0) || chat.isStreaming) {
      return;
    }
    const text = draft;
    setDraft('');
    setAttachments([]);
    void chat.sendMessage(text, { attachments });
  };
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    submit();
  };

  // Upload new: reuse the vault's source picker, then attach whatever landed in the vault.
  const handleUploadSource = async (source: UploadSource): Promise<void> => {
    setUploadOpen(false);
    const files = await pickFiles(source);
    if (files.length === 0) {
      return;
    }
    const outcome = await ingestFiles(files);
    addAttachments(outcome.documents);
    setAttachOpen(false);
  };

  return (
    <IonPage data-agent-id="ai.chat">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" data-agent-id="ai.chat.back" />
          </IonButtons>
          <IonTitle>{t('title')}</IonTitle>
          <IonButtons slot="end">
            {!gated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void chat.loadConversations();
                  setHistoryOpen(true);
                }}
                agentId="ai.chat.history"
              >
                <Icon name="List" size={20} aria-label={t('history.title')} />
              </Button>
            )}
            {!gated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void chat.newChat()}
                disabled={chat.isStreaming || chat.messages.length === 0}
                agentId="ai.chat.new"
              >
                <Icon name="Plus" size={20} aria-label={t('new_chat')} />
              </Button>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {gated ? (
          <div className="kg-chat__gate" data-agent-id="ai.chat.gate" data-agent-state={ai.status}>
            {ai.status === 'checking' || ai.status === 'downloaded' || ai.status === 'loading' ? (
              <>
                <Spinner size="lg" label={t('gate.loading')} />
                <p>{t('gate.loading')}</p>
              </>
            ) : (
              <>
                <Icon name={ai.status === 'error' ? 'AlertCircle' : 'Sparkles'} size={32} aria-hidden />
                <p role={ai.status === 'error' ? 'alert' : undefined}>
                  {ai.status === 'unsupported'
                    ? t('lifecycle.unsupported')
                    : ai.status === 'downloading'
                      ? t('gate.downloading', { percent: ai.downloadProgress })
                      : ai.status === 'error'
                        ? (ai.errorMessage ?? t('gate.error'))
                        : t('gate.not_downloaded')}
                </p>
                {ai.status === 'error' && ai.modelOnDisk && (
                  <Button
                    variant="primary"
                    onClick={() => void ai.activate(AI_TOOL_DESCRIPTORS)}
                    agentId="ai.chat.gate-retry"
                  >
                    {t('lifecycle.retry_button')}
                  </Button>
                )}
                {ai.status !== 'unsupported' && (
                  <Button
                    variant={ai.status === 'error' && ai.modelOnDisk ? 'secondary' : 'primary'}
                    onClick={() => router.push('/ai-assistant')}
                    agentId="ai.chat.gate-button"
                  >
                    {t('gate.manage_button')}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : chat.isLoading ? (
          <div className="kg-chat__gate" data-agent-state="loading">
            <Spinner size="lg" />
          </div>
        ) : (
          <main className="kg-chat" data-agent-id="ai.chat.content">
            <DocLinkProvider documents={attachable.documents} onOpen={setPreview}>
            <ul className="kg-chat__list" data-agent-id="ai.chat.messages">
              {chat.messages.map((message) => {
                const parts = parseParts(message.partsJson);
                const attached = parts.flatMap((p) =>
                  p.type === 'attachments' ? p.documents : []
                );
                const created = parts.flatMap((p) => (p.type === 'documents' ? p.documents : []));
                const form = parts.find((p) => p.type === 'form');
                const toolPart = parts.find((p) => p.type === 'tool');
                if (message.role === 'tool' && toolPart) {
                  return (
                    <li key={message.id} data-agent-id={`ai.chat.message-${message.id}`}>
                      <ToolChip
                        name={toolPart.name}
                        ok={toolPart.ok}
                        error={toolPart.error}
                      />
                    </li>
                  );
                }
                if (message.role === 'tool') {
                  return created.length > 0 ? (
                    <li key={message.id} data-agent-id={`ai.chat.message-${message.id}`}>
                      <ResultCard
                        documents={created}
                        lookup={(id) => attachable.documents.find((d) => d.id === id)}
                        onOpen={previewById}
                      />
                    </li>
                  ) : null;
                }
                return (
                  <li
                    key={message.id}
                    className={`kg-chat__bubble kg-chat__bubble--${message.role}${form ? ' kg-chat__bubble--form' : ''}`}
                    data-agent-id={`ai.chat.message-${message.id}`}
                  >
                    {attached.length > 0 && (
                      <AttachmentChips
                        documents={attached}
                        idPrefix={`ai.chat.sent-${message.id}`}
                      />
                    )}
                    <Markdown text={message.content ?? ''} />
                    {form && !answered.has(form.formId) && (
                      <AskUserForm
                        spec={form.spec}
                        documents={attachable.documents}
                        disabled={chat.isStreaming}
                        onSubmit={(summary) =>
                          void chat.sendMessage(summary, {
                            parts: [{ type: 'answer', formId: form.formId }],
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}
              {chat.isStreaming && (
                <li
                  className="kg-chat__bubble kg-chat__bubble--assistant"
                  data-agent-id="ai.chat.streaming"
                  aria-live="polite"
                >
                  {chat.streamingText ? (
                    <Markdown text={chat.streamingText} />
                  ) : (
                    <Spinner size="sm" label={t('thinking')} />
                  )}
                </li>
              )}
              {chat.error && (
                <li className="kg-chat__error" role="alert" data-agent-id="ai.chat.error">
                  {chat.error}
                </li>
              )}
              {chat.pendingConfirmation && (
                <li
                  className="kg-chat__confirm"
                  role="group"
                  aria-label={t('confirm_action.title')}
                  data-agent-id="ai.chat.confirm"
                  data-agent-state={chat.pendingConfirmation.expired ? 'error' : 'pending'}
                >
                  {chat.pendingConfirmation.expired ? (
                    <>
                      <span>{t('confirm_action.expired')}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={chat.dismissExpiredConfirmation}
                        agentId="ai.chat.confirm-dismiss"
                      >
                        {t('confirm_action.dismiss')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span>{chat.pendingConfirmation.summary}</span>
                      <div className="kg-chat__confirm-actions">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={chat.confirmPendingToolCall}
                          agentId="ai.chat.confirm-approve"
                        >
                          {t('confirm_action.approve')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={chat.rejectPendingToolCall}
                          agentId="ai.chat.confirm-reject"
                        >
                          {t('confirm_action.reject')}
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              )}
              <div ref={listEndRef} />
            </ul>
            </DocLinkProvider>
          </main>
        )}
      </IonContent>

      {!gated && !chat.isLoading && (
        <IonFooter>
          {attachments.length > 0 && (
            <AttachmentChips
              documents={attachments}
              onRemove={(id) => setAttachments((prev) => prev.filter((d) => d.id !== id))}
            />
          )}
          <form className="kg-chat__composer" onSubmit={handleSubmit}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAttachOpen(true)}
              agentId="ai.chat.attach"
            >
              <Icon name="Plus" size={20} aria-label={t('attach.button')} />
            </Button>
            <ChatTextarea
              value={draft}
              onChange={setDraft}
              onSubmit={submit}
              label={t('input_placeholder')}
              placeholder={t('input_placeholder')}
            />
            <MicButton onResult={(text) => setDraft(text)} onPartial={(text) => setDraft(text)} />
            {/* Typing and attaching stay open while the model answers (prepare
                the next message); only Send waits — submit() also guards. */}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={(!draft.trim() && attachments.length === 0) || chat.isStreaming}
              agentId="ai.chat.send"
            >
              <Icon name="Send" size={20} aria-label={t('input_placeholder')} />
            </Button>
          </form>
          <ConversationsSheet
            isOpen={historyOpen}
            conversations={chat.conversations}
            activeId={chat.activeConversationId}
            onOpen={(id) => {
              void chat.openConversation(id).then(() => setHistoryOpen(false));
            }}
            onDelete={(id) => void chat.deleteConversation(id)}
            onDismiss={() => setHistoryOpen(false)}
          />
          <AttachSheet
            isOpen={attachOpen}
            documents={attachable.documents}
            lockedCount={attachable.lockedCount}
            onDismiss={() => setAttachOpen(false)}
            onAttach={(docs) => {
              addAttachments(docs);
              setAttachOpen(false);
            }}
            onUploadNew={() => setUploadOpen(true)}
          />
          <UploadOptionsSheet
            isOpen={uploadOpen}
            onDismiss={() => setUploadOpen(false)}
            onSelect={(source) => void handleUploadSource(source)}
          />
        </IonFooter>
      )}
      <DocumentPreviewModal document={preview} onOpen={openFull} onClose={() => setPreview(null)} />
    </IonPage>
  );
}

export default ChatPage;
