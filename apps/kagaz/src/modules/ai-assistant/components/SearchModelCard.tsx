import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ProgressBar, Spinner } from '@kagaz/ui';
import { useSearchModel } from '../hooks/useSearchModel';

/** Settings row for the optional on-device search model (EmbeddingGemma). Hidden where unsupported. */
export function SearchModelCard(): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const model = useSearchModel();
  if (model.status === 'unsupported') {
    return null;
  }
  const size = `${Math.round(model.sizeBytes / (1024 * 1024))} MB`;

  return (
    <section
      className="kg-ai-settings__search"
      data-agent-id="ai.settings.search-model"
      data-agent-state={model.status}
    >
      <h2>{t('search_model.title')}</h2>
      <p className="kg-ai-settings__hint">{t('search_model.hint')}</p>
      {model.status === 'checking' && <Spinner size="sm" />}
      {(model.status === 'missing' || model.status === 'error') && (
        <>
          {model.status === 'error' && <p role="alert">{t('search_model.failed')}</p>}
          <Button
            variant="primary"
            onClick={() => void model.download()}
            agentId="ai.settings.search-model-download"
          >
            {t('search_model.download', { size })}
          </Button>
        </>
      )}
      {model.status === 'downloading' && (
        <div data-agent-id="ai.settings.search-model-progress" data-agent-state={model.progress}>
          <ProgressBar
            value={model.progress}
            showLabel
            aria-label={t('search_model.downloading')}
          />
        </div>
      )}
      {model.status === 'ready' && (
        <>
          <p>{t('search_model.ready')}</p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => void model.remove()}
            agentId="ai.settings.search-model-delete"
          >
            {t('search_model.delete')}
          </Button>
        </>
      )}
    </section>
  );
}
