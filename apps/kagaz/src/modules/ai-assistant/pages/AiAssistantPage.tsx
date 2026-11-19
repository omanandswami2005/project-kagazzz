/**
 * AI Assistant settings screen (F-13, 05-ai-assistant-module.md §3.4).
 * The model-lifecycle UI the design note calls for: download (explicit
 * user tap, size + Wi-Fi hint) → progress → checksum verify → ready
 * (model info) → delete (confirmed). Reached from Settings → AI Assistant,
 * Storage, and the chat's gate. This page owns model management; the chat
 * never downloads or deletes — it only loads an already-downloaded model.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, Icon, ProgressBar, Spinner, Toggle } from '@kagaz/ui';
import { useAi } from '@/app/providers/AIProvider';
import { AI_TOOL_DESCRIPTORS } from '../services/ai-tool-registry';
import './ai-assistant.css';

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** The AI Assistant model-management screen. */
export function AiAssistantPage(): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const ai = useAi();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const size = formatMb(ai.modelSizeBytes);

  return (
    <IonPage data-agent-id="ai.settings">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" data-agent-id="ai.settings.back" />
          </IonButtons>
          <IonTitle>{t('title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-ai-settings" data-agent-id="ai.settings.content" data-agent-state={ai.status}>
          {ai.status !== 'unsupported' && (
            <div className="kg-ai-settings__gpu-toggle" data-agent-id="ai.settings.gpu-toggle">
              <Toggle
                enabled={ai.preferGpu}
                onChange={ai.setPreferGpu}
                label={t('lifecycle.gpu_toggle_label')}
                agentId="ai.settings.gpu-toggle-switch"
              />
              <p className="kg-ai-settings__hint">{t('lifecycle.gpu_toggle_warning')}</p>
            </div>
          )}

          {ai.status === 'unsupported' && (
            <EmptyState
              icon="Cpu"
              title={t('lifecycle.unsupported_title')}
              hint={t('lifecycle.unsupported')}
              agentId="ai.settings.unsupported"
            />
          )}

          {ai.status === 'checking' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.checking">
              <Spinner size="lg" label={t('lifecycle.checking')} />
            </div>
          )}

          {ai.status === 'not-downloaded' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.download">
              <Icon name="Sparkles" size={32} aria-hidden />
              <p>{t('lifecycle.intro')}</p>
              <Button variant="primary" onClick={() => void ai.download()} agentId="ai.settings.download-button">
                {t('lifecycle.download_button', { size })}
              </Button>
              <p className="kg-ai-settings__hint">{t('lifecycle.wifi_hint')}</p>
            </div>
          )}

          {ai.status === 'downloading' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.downloading">
              <Spinner size="lg" label={t('lifecycle.downloading')} />
              <p>{t('lifecycle.downloading')}</p>
              <div data-agent-id="ai.settings.progress" data-agent-state={ai.downloadProgress}>
                <ProgressBar value={ai.downloadProgress} showLabel aria-label={t('lifecycle.downloading')} />
              </div>
            </div>
          )}

          {ai.status === 'downloaded' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.downloaded">
              <Icon name="Check" size={32} aria-hidden />
              <p>{t('lifecycle.downloaded', { size })}</p>
              <Button
                variant="secondary"
                onClick={() => void ai.activate(AI_TOOL_DESCRIPTORS)}
                agentId="ai.settings.load-button"
              >
                {t('lifecycle.load_button')}
              </Button>
            </div>
          )}

          {ai.status === 'loading' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.loading">
              <Spinner size="lg" />
              <p>{t('model_loading')}</p>
            </div>
          )}

          {ai.status === 'ready' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.ready">
              <Icon name="Check" size={32} aria-hidden />
              <p>{t('lifecycle.ready')}</p>
              {ai.capabilities && (
                <p className="kg-ai-settings__hint" data-agent-id="ai.settings.capabilities">
                  {t('lifecycle.capabilities', {
                    backend: ai.capabilities.backend.toUpperCase(),
                    seconds: (ai.capabilities.loadTimeMs / 1000).toFixed(1),
                  })}
                </p>
              )}
            </div>
          )}

          {ai.status === 'error' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.error">
              <Icon name="AlertCircle" size={32} aria-hidden />
              <p role="alert">{ai.errorMessage ?? t('errors.model_failed')}</p>
              <Button
                variant="primary"
                onClick={() => void (ai.modelOnDisk ? ai.activate(AI_TOOL_DESCRIPTORS) : ai.download())}
                agentId="ai.settings.retry-button"
              >
                {t('lifecycle.retry_button')}
              </Button>
            </div>
          )}

          {/* Delete is available whenever a model file is on disk — loaded or not, even after an error. */}
          {ai.modelOnDisk && ai.status !== 'downloading' && ai.status !== 'loading' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.manage">
              <p className="kg-ai-settings__hint">{t('lifecycle.storage_hint')}</p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                agentId="ai.settings.delete-button"
              >
                {t('lifecycle.delete_button')}
              </Button>
            </div>
          )}
          <Alert
            isOpen={confirmDelete}
            header={t('lifecycle.delete_confirm_title')}
            message={t('lifecycle.delete_confirm_body', { size })}
            buttons={[
              { text: t('lifecycle.delete_confirm_cancel'), role: 'cancel' },
              {
                text: t('lifecycle.delete_confirm_ok'),
                role: 'destructive',
                handler: () => void ai.remove(),
              },
            ]}
            onDidDismiss={() => setConfirmDelete(false)}
            agentId="ai.settings.delete-confirm"
          />
        </main>
      </IonContent>
    </IonPage>
  );
}

export default AiAssistantPage;
