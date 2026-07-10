/**
 * Root/jailbreak warning banner (SEC-V1 §8 #10). Dismissible, non-blocking:
 * tells the user their device looks rooted so their on-device data is at higher
 * risk. Rendered app-wide from App.tsx.
 */
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import { useRootWarning } from '../hooks/useRootWarning';
import './root-warning.css';

/** The rooted-device warning strip. */
export function RootWarningBanner(): ReactNode {
  const { t } = useTranslation('common');
  const { show, dismiss } = useRootWarning();

  if (!show) {
    return null;
  }

  return (
    <div
      className="kg-root-warning"
      role="alert"
      data-agent-id="app.root-warning"
      data-agent-state="warning"
    >
      <Icon name="AlertCircle" size={20} aria-hidden />
      <p className="kg-root-warning__text">{t('root_warning.message')}</p>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={<Icon name="X" size={20} />}
        aria-label={t('root_warning.dismiss')}
        onClick={dismiss}
        agentId="app.root-warning.dismiss"
      />
    </div>
  );
}
