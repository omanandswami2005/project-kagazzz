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

/** `common:lock.*` keys this component's *Key props accept. */
type LockCopyKey =
  | 'lock.title'
  | 'lock.subtitle'
  | 'lock.reason'
  | 'lock.quick_reference_title'
  | 'lock.quick_reference_subtitle'
  | 'lock.quick_reference_reason';

/** Props for {@link LockScreen}. */
export interface LockScreenProps {
  /** Runs the biometric prompt; resolves the outcome. */
  onUnlock: (reason: string) => Promise<UnlockResult>;
  /** i18n key for the title (default: the app-level lock's own copy). */
  titleKey?: LockCopyKey;
  /** i18n key for the subtitle. */
  subtitleKey?: LockCopyKey;
  /** i18n key passed to the biometric prompt as its `reason` string. */
  reasonKey?: LockCopyKey;
  /** Prefix for this instance's `data-agent-id`s (default: `app.lock`). */
  agentIdPrefix?: string;
}

/** A biometric gate: prompts on mount, offers a retry. Reused by F-16's
 * app-level lock (default copy) and F-84's Quick Reference screen gate
 * (its own copy, via the *Key props) — same component, same [SEC] posture:
 * the unlock button carries no `agentAction`, so it can never be bypassed
 * by voice/AI. */
export function LockScreen({
  onUnlock,
  titleKey = 'lock.title',
  subtitleKey = 'lock.subtitle',
  reasonKey = 'lock.reason',
  agentIdPrefix = 'app.lock',
}: LockScreenProps): ReactNode {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'failed'>(
    'idle'
  );

  const unlock = useCallback((): void => {
    setStatus('authenticating');
    void onUnlock(t(reasonKey)).then((result) => {
      setStatus(result === 'success' ? 'idle' : 'failed');
    });
  }, [onUnlock, reasonKey, t]);

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
      aria-labelledby={`${agentIdPrefix}-title`}
      data-agent-id={`${agentIdPrefix}-screen`}
      data-agent-state={status}
    >
      <Icon name="Lock" size={48} aria-hidden />
      <h1 id={`${agentIdPrefix}-title`} className="kg-lock__title">
        {t(titleKey)}
      </h1>
      <p className="kg-lock__subtitle">{t(subtitleKey)}</p>
      {status === 'failed' && (
        <p
          className="kg-lock__error"
          role="alert"
          data-agent-id={`${agentIdPrefix}.error`}
        >
          {t('lock.failed')}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={unlock}
        disabled={status === 'authenticating'}
        agentId={`${agentIdPrefix}.unlock`}
      >
        {t('lock.unlock')}
      </Button>
    </div>
  );
}
