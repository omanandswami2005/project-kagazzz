/**
 * App-lock screen (F-16): full-screen gate shown when the app is locked. Auto-
 * prompts for biometrics on mount and offers a retry. Unlocking is a strictly
 * user-only action — [SEC] the unlock button carries NO `agentAction`, so the
 * AI/voice layer can never bypass the biometric gate.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import type { UnlockResult } from '../services/biometric.service';
import './lock.css';

/** Props for {@link LockScreen}. */
export interface LockScreenProps {
  /** Runs the biometric prompt; resolves the outcome. */
  onUnlock: (reason: string) => Promise<UnlockResult>;
}

/** The locked-app gate. */
export function LockScreen({ onUnlock }: LockScreenProps): ReactNode {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'failed'>(
    'idle'
  );

  const unlock = useCallback((): void => {
    setStatus('authenticating');
    void onUnlock(t('lock.reason')).then((result) => {
      setStatus(result === 'success' ? 'idle' : 'failed');
    });
  }, [onUnlock, t]);

  // Prompt automatically when the lock screen appears. Setting the
  // 'authenticating' status synchronously here is intentional (the prompt
  // fires on mount); re-running on `unlock` identity changes would re-prompt.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    unlock();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  return (
    <div
      className="kg-lock"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
      data-agent-id="app.lock-screen"
      data-agent-state={status}
    >
      <Icon name="Lock" size={48} aria-hidden />
      <h1 id="lock-title" className="kg-lock__title">
        {t('lock.title')}
      </h1>
      <p className="kg-lock__subtitle">{t('lock.subtitle')}</p>
      {status === 'failed' && (
        <p className="kg-lock__error" role="alert" data-agent-id="app.lock.error">
          {t('lock.failed')}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={unlock}
        disabled={status === 'authenticating'}
        agentId="app.lock.unlock"
      >
        {t('lock.unlock')}
      </Button>
    </div>
  );
}
