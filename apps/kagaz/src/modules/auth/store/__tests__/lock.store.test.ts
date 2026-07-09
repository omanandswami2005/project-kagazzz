import { beforeEach, describe, expect, it } from 'vitest';
import { readLockConfig, useLockStore, type LockState } from '../lock.store';

function reset(partial: Partial<LockState> = {}): void {
  useLockStore.setState({
    enabled: false,
    timeout: 'immediate',
    locked: false,
    backgroundedAt: null,
    ...partial,
  });
}

describe('lock store (F-16)', () => {
  beforeEach(() => reset());

  it('persists the enabled flag and disabling unlocks', () => {
    useLockStore.getState().setEnabled(true);
    expect(useLockStore.getState().enabled).toBe(true);
    const persisted = JSON.parse(localStorage.getItem('kagaz:lock') ?? '{}') as {
      enabled?: boolean;
    };
    expect(persisted.enabled).toBe(true);

    reset({ enabled: true, locked: true });
    useLockStore.getState().setEnabled(false);
    expect(useLockStore.getState().locked).toBe(false);
  });

  it('lock() only engages when the feature is enabled', () => {
    reset({ enabled: false });
    useLockStore.getState().lock();
    expect(useLockStore.getState().locked).toBe(false);

    reset({ enabled: true });
    useLockStore.getState().lock();
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('auto-locks immediately after backgrounding when timeout=immediate', () => {
    reset({ enabled: true, timeout: 'immediate' });
    useLockStore.getState().markBackgrounded(1000);
    useLockStore.getState().evaluateOnForeground(1001);
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('does not lock before the timeout elapses', () => {
    reset({ enabled: true, timeout: '5min' });
    useLockStore.getState().markBackgrounded(1000);
    useLockStore.getState().evaluateOnForeground(1000 + 60_000); // 1 min < 5 min
    expect(useLockStore.getState().locked).toBe(false);
  });

  it('locks once the timeout elapses', () => {
    reset({ enabled: true, timeout: '30s' });
    useLockStore.getState().markBackgrounded(1000);
    useLockStore.getState().evaluateOnForeground(1000 + 31_000);
    expect(useLockStore.getState().locked).toBe(true);
  });

  it('ignores backgrounding while already locked', () => {
    reset({ enabled: true, locked: true });
    useLockStore.getState().markBackgrounded(5000);
    expect(useLockStore.getState().backgroundedAt).toBeNull();
  });

  it('readLockConfig falls back to defaults on corrupt data', () => {
    localStorage.setItem('kagaz:lock', 'not json');
    expect(readLockConfig()).toEqual({ enabled: false, timeout: 'immediate' });
  });
});
