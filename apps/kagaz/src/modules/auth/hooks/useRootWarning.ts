/**
 * Root-warning state (SEC-V1 §8 #10): checks once on mount and exposes whether
 * to show the (dismissible) warning banner. A warning only — never blocks use.
 */
import { useEffect, useState } from 'react';
import { RootCheck } from '../services/root-check';

/** What {@link useRootWarning} exposes. */
export interface RootWarning {
  /** True when the device looks rooted and the warning hasn't been dismissed. */
  show: boolean;
  /** Hides the warning for this session. */
  dismiss: () => void;
}

/** Runs the native root check and tracks dismissal. */
export function useRootWarning(): RootWarning {
  const [rooted, setRooted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void RootCheck.isRooted()
      .then((result) => {
        if (!cancelled) {
          setRooted(result.rooted);
        }
      })
      .catch(() => undefined);
    return (): void => {
      cancelled = true;
    };
  }, []);

  return { show: rooted && !dismissed, dismiss: () => setDismissed(true) };
}
