/**
 * AI Assistant settings screen (F-13, 05-ai-assistant-module.md §3.4).
 * The model-lifecycle UI the design note calls for: download (explicit
 * user tap, size + Wi-Fi hint) → progress → checksum verify → ready
 * (model info) → delete. Reached from Settings → AI Assistant, and reused
 * as the chat's own first-run gate (§ same design note) — this page
 * doesn't render the chat itself, just the model that powers it.
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
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, ProgressBar, Spinner, Toggle } from '@kagaz/ui';
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
  const server = ai.engine === 'ollama';

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
          {ai.status !== 'unsupported' && !server && (
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
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.unsupported">
              <Icon name="AlertCircle" size={32} aria-hidden />
              <p>{t('lifecycle.unsupported')}</p>
            </div>
          )}

          {ai.status === 'not-downloaded' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.download">
              <Icon name="Sparkles" size={32} aria-hidden />
              <p>{server ? t('lifecycle.intro_server', { url: ai.serverUrl }) : t('lifecycle.intro')}</p>
              <Button
                variant="primary"
                onClick={() => void ai.activate(AI_TOOL_DESCRIPTORS)}
                agentId={server ? 'ai.settings.connect-button' : 'ai.settings.download-button'}
              >
                {server
                  ? t('lifecycle.connect_button')
                  : t('lifecycle.download_button', { size: formatMb(ai.modelSizeBytes) })}
              </Button>
              {!server && <p className="kg-ai-settings__hint">{t('lifecycle.wifi_hint')}</p>}
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
              <Button
                variant="danger"
                size="sm"
                onClick={() => void ai.remove()}
                agentId="ai.settings.delete-button"
              >
                {server ? t('lifecycle.disconnect_button') : t('lifecycle.delete_button')}
              </Button>
            </div>
          )}

          {ai.status === 'error' && (
            <div className="kg-ai-settings__center" data-agent-id="ai.settings.error">
              <Icon name="AlertCircle" size={32} aria-hidden />
              <p role="alert">{ai.errorMessage ?? t('errors.model_failed')}</p>
              <Button
                variant="primary"
                onClick={() => void ai.activate(AI_TOOL_DESCRIPTORS)}
                agentId="ai.settings.retry-button"
              >
                {t('lifecycle.retry_button')}
              </Button>
            </div>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default AiAssistantPage;
