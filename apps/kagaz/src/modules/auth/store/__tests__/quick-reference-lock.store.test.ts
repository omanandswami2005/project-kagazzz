import { beforeEach, describe, expect, it } from 'vitest';
import {
  readQuickReferenceLockEnabled,
  useQuickReferenceLockStore,
} from '../quick-reference-lock.store';

describe('quick reference lock store (F-84 follow-up)', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuickReferenceLockStore.setState({ enabled: true });
  });

  it('defaults to enabled (secure by default)', () => {
    expect(readQuickReferenceLockEnabled()).toBe(true);
    expect(useQuickReferenceLockStore.getState().enabled).toBe(true);
  });

  it('persists disabling the gate', () => {
    useQuickReferenceLockStore.getState().setEnabled(false);
    expect(useQuickReferenceLockStore.getState().enabled).toBe(false);
    expect(readQuickReferenceLockEnabled()).toBe(false);

    const persisted = JSON.parse(
      localStorage.getItem('kagaz:lock:quick-reference') ?? '{}'
    ) as { enabled?: boolean };
    expect(persisted.enabled).toBe(false);
  });

  it('persists re-enabling the gate', () => {
    useQuickReferenceLockStore.getState().setEnabled(false);
    useQuickReferenceLockStore.getState().setEnabled(true);
    expect(readQuickReferenceLockEnabled()).toBe(true);
  });

  it('falls back to the secure default on corrupt data', () => {
    localStorage.setItem('kagaz:lock:quick-reference', 'not json');
    expect(readQuickReferenceLockEnabled()).toBe(true);
  });
});
