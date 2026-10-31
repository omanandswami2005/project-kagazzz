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
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Input, Spinner } from '@kagaz/ui';
import { MicButton } from '../components/MicButton';
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
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // jsdom has no scrollIntoView implementation — guard rather than crash
    // the test render tree (real browsers/WebViews always have it).
    if (typeof listEndRef.current?.scrollIntoView === 'function') {
      listEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [chat.messages, chat.streamingText, chat.pendingConfirmation]);

  const gated = ai.status !== 'ready';

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!draft.trim() || chat.isStreaming) {
      return;
    }
    const text = draft;
    setDraft('');
    void chat.sendMessage(text);
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
              {chat.messages.map((message) => (
                <li
                  key={message.id}
                  className={`kg-chat__bubble kg-chat__bubble--${message.role}`}
                  data-agent-id={`ai.chat.message-${message.id}`}
                >
                  {message.content}
                </li>
              ))}
              {chat.isStreaming && (
                <li
                  className="kg-chat__bubble kg-chat__bubble--assistant"
                  data-agent-id="ai.chat.streaming"
                  aria-live="polite"
                >
                  {chat.streamingText || <Spinner size="sm" label={t('thinking')} />}
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
          <form className="kg-chat__composer" onSubmit={handleSubmit}>
            <Input
              type="text"
              label={t('input_placeholder')}
              placeholder={t('input_placeholder')}
              value={draft}
              onChange={setDraft}
              disabled={chat.isStreaming}
              agentId="ai.chat.input"
            />
            <MicButton onResult={(text) => setDraft(text)} onPartial={(text) => setDraft(text)} />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!draft.trim() || chat.isStreaming}
              agentId="ai.chat.send"
            >
              <Icon name="Send" size={20} aria-label={t('input_placeholder')} />
            </Button>
          </form>
        </IonFooter>
      )}
    </IonPage>
  );
}

export default ChatPage;
