/**
 * AI chat screen (F-13, 05-ai-assistant-module.md §5). First-run gate:
 * anything short of `ai.status === 'ready'` sends the user to the AI
 * Assistant settings screen instead of rendering the conversation —
 * there is no chat to have with a model that isn't loaded yet.
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
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Spinner } from '@kagaz/ui';
import { AskUserForm } from '../components/AskUserForm';
import { ChatTextarea } from '../components/ChatTextarea';
import { Markdown } from '../components/Markdown';
import { AttachSheet } from '../components/AttachSheet';
import { AttachmentChips, ResultCard } from '../components/MessageParts';
import { MicButton } from '../components/MicButton';
import { UploadOptionsSheet } from '@/modules/document-vault/components/UploadOptionsSheet';
import { useUpload } from '@/modules/document-vault/hooks/useUpload';
import { pickFiles, type UploadSource } from '@/modules/document-vault/services/upload-sources';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useAttachableDocuments } from '../hooks/useAttachableDocuments';
import { answeredFormIds, parseParts, type DocRef } from '../types/message-parts';
import { useAi } from '@/app/providers/AIProvider';
import { useChat } from '../hooks/useChat';
import './chat.css';

/** The AI Assistant chat screen. */
export function ChatPage(): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const router = useIonRouter();
  const ai = useAi();
  const chat = useChat();
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<DocRef[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Forms the model asked for that the user has not answered yet (a reloaded, answered form must not reappear).
  const answered = useMemo(() => answeredFormIds(chat.messages), [chat.messages]);
  const hasOpenForm = useMemo(
    () => chat.messages.some((m) => parseParts(m.partsJson).some((p) => p.type === 'form' && !answered.has(p.formId))),
    [chat.messages, answered]
  );
  const attachable = useAttachableDocuments(attachOpen || hasOpenForm);
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

  const toRef = (d: DocumentEntity): DocRef => ({ id: d.id, name: d.name, fileType: d.fileType });
  const addAttachments = (docs: DocumentEntity[]): void =>
    setAttachments((prev) => [...prev, ...docs.filter((d) => !prev.some((p) => p.id === d.id)).map(toRef)]);

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
          {ai.onlineAvailable && (
            <IonButtons slot="end">
              <span className="kg-chat__mode" data-agent-id="ai.chat.mode-badge" data-agent-state={ai.mode}>
                {ai.mode === 'online' ? t('mode.badge_online') : t('mode.badge_offline')}
              </span>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {gated ? (
          <div className="kg-chat__gate" data-agent-id="ai.chat.gate">
            <Icon name="Sparkles" size={32} aria-hidden />
            <p>
              {ai.engine === 'cloud'
                ? t('lifecycle.intro_cloud')
                : ai.engine === 'ollama'
                  ? t('lifecycle.intro_server', { url: ai.serverUrl })
                  : t('lifecycle.intro')}
            </p>
            <Button
              variant="primary"
              onClick={() => router.push('/ai-assistant')}
              agentId="ai.chat.gate-button"
            >
              {t('ai.manage', { ns: 'settings' })}
            </Button>
          </div>
        ) : chat.isLoading ? (
          <div className="kg-chat__gate" data-agent-state="loading">
            <Spinner size="lg" />
          </div>
        ) : (
          <main className="kg-chat" data-agent-id="ai.chat.content">
            <ul className="kg-chat__list" data-agent-id="ai.chat.messages">
              {chat.messages.map((message) => {
                const parts = parseParts(message.partsJson);
                const attached = parts.flatMap((p) => (p.type === 'attachments' ? p.documents : []));
                const created = parts.flatMap((p) => (p.type === 'documents' ? p.documents : []));
                const form = parts.find((p) => p.type === 'form');
                if (message.role === 'tool') {
                  return created.length > 0 ? (
                    <li key={message.id} data-agent-id={`ai.chat.message-${message.id}`}>
                      <ResultCard
                        documents={created}
                        onOpen={(id) => router.push(`/doc/${id}`, 'forward', 'push')}
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
                    {attached.length > 0 && <AttachmentChips documents={attached} idPrefix={`ai.chat.sent-${message.id}`} />}
                    <Markdown text={message.content ?? ''} />
                    {form && !answered.has(form.formId) && (
                      <AskUserForm
                        spec={form.spec}
                        documents={attachable.documents}
                        disabled={chat.isStreaming}
                        onSubmit={(summary) =>
                          void chat.sendMessage(summary, { parts: [{ type: 'answer', formId: form.formId }] })
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
                  {chat.streamingText ? <Markdown text={chat.streamingText} /> : <Spinner size="sm" label={t('thinking')} />}
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
              disabled={chat.isStreaming}
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
              disabled={chat.isStreaming}
            />
            <MicButton onResult={(text) => setDraft(text)} onPartial={(text) => setDraft(text)} />
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
    </IonPage>
  );
}

export default ChatPage;
