import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { biometricAuthenticator } from '@/modules/auth/services/biometric.service';
import { useQuickReferenceLockStore } from '@/modules/auth/store/quick-reference-lock.store';
import { useQuickReference } from '../../hooks/useQuickReference';
import { QuickReferencePage } from '../QuickReferencePage';

vi.mock('../../hooks/useQuickReference', () => ({ useQuickReference: vi.fn() }));
vi.mock('@/modules/auth/services/biometric.service', () => ({
  biometricAuthenticator: { authenticate: vi.fn(), isAvailable: vi.fn() },
}));

// Bug-audit fix under test: QuickReferencePage now gates via
// useIonViewWillEnter (fires on every visit, cached-instance reuse
// included) instead of a mount-only useEffect. Outside a real
// IonRouterOutlet this hook has no page-manager context to fire from, so
// it's captured here and invoked manually to simulate "the view was
// entered" — the same reasoning useChat.test.ts uses for mocking native
// plugin event listeners it needs to fire by hand.
let willEnterCallback: (() => void) | null = null;
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...actual,
    useIonViewWillEnter: (cb: () => void) => {
      willEnterCallback = cb;
    },
  };
});

const useQuickReferenceMock = vi.mocked(useQuickReference);
const isAvailableMock = vi.mocked(biometricAuthenticator.isAvailable);
const authenticateMock = vi.mocked(biometricAuthenticator.authenticate);

const entry: QuickReferenceEntry = {
  id: 'qr-1',
  label: 'PAN',
  value: 'ABCDE1234F',
  isSecure: true,
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
};

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

beforeEach(() => {
  willEnterCallback = null;
  useQuickReferenceLockStore.setState({ enabled: true });
  isAvailableMock.mockResolvedValue(true);
  authenticateMock.mockResolvedValue('success');
  useQuickReferenceMock.mockReturnValue({
    entries: [entry],
    tagsByEntry: new Map(),
    isLoading: false,
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    assignTag: vi.fn(),
    removeTag: vi.fn(),
  });
});

/** Fires the captured useIonViewWillEnter callback, same as a real page-enter. */
async function enterView(): Promise<void> {
  await act(async () => {
    willEnterCallback?.();
    await Promise.resolve();
  });
}

// The page also renders closed <dialog> elements from ActionSheet/Alert,
// which jsdom (unlike real browsers) doesn't hide from role queries when
// they lack the `open` attribute — so getByRole('dialog') is ambiguous
// here. Target the LockScreen by its exact agent id instead.
function lockScreenEl(): Element | null {
  return document.querySelector('[data-agent-id="vault.quick-reference.lock-screen"]');
}

/** Waits for the LockScreen's auto-prompt-on-mount to resolve and unlock. */
async function waitUnlocked(): Promise<void> {
  await waitFor(() => expect(lockScreenEl()).toBeNull());
}

describe('QuickReferencePage — screen-level biometric gate (bug-audit fix)', () => {
  it('gates behind LockScreen on first entry when the lock is enabled', async () => {
    render(<QuickReferencePage />);
    await enterView();
    // The mocked auth resolves near-instantly, so the LockScreen's own
    // presence is too transient to assert on reliably — what proves the
    // gate ran is that it called through to authenticate at all.
    await waitFor(() => expect(authenticateMock).toHaveBeenCalledOnce());
    await waitUnlocked();
  });

  it('bug-audit fix: re-gates on every re-entry, not just the first — a cached instance re-shown does not skip the prompt', async () => {
    render(<QuickReferencePage />);
    await enterView();
    await waitFor(() => expect(authenticateMock).toHaveBeenCalledOnce());
    await waitUnlocked();

    // Simulate leaving and coming back to a CACHED instance — Ionic reuses
    // the same component, so this is the same mounted page re-entering,
    // exactly the scenario the old mount-only useEffect missed entirely.
    // (The re-authentication is mocked to resolve near-instantly, so the
    // LockScreen's re-appearance is too transient to assert on directly —
    // what matters, and what the old mount-only useEffect got wrong, is
    // that the gate re-ran and re-authenticated at all.)
    await enterView();

    await waitFor(() => expect(authenticateMock).toHaveBeenCalledTimes(2));
    await waitUnlocked();
  });

  it('bug-audit fix: clears revealed values on re-entry so a previously-revealed value is masked again', async () => {
    render(<QuickReferencePage />);
    await enterView();
    await waitUnlocked();

    // Reveal the entry's value.
    act(() => {
      screen.getByText('PAN').closest('button')?.click();
    });
    expect(screen.getByText('ABCDE1234F')).toBeInTheDocument();

    // Re-enter (cached instance) — re-authenticates.
    await enterView();
    await waitFor(() => expect(authenticateMock).toHaveBeenCalledTimes(2));
    await waitUnlocked();

    // The value must be masked again, not still revealed from before.
    expect(screen.queryByText('ABCDE1234F')).toBeNull();
    expect(screen.getByText('•••• 234F')).toBeInTheDocument();
  });

  it('skips the gate entirely when the user turned it off in Settings', async () => {
    useQuickReferenceLockStore.setState({ enabled: false });
    render(<QuickReferencePage />);
    await enterView();
    await waitFor(() => expect(lockScreenEl()).toBeNull());
    expect(isAvailableMock).not.toHaveBeenCalled();
    expect(authenticateMock).not.toHaveBeenCalled();
  });
});
