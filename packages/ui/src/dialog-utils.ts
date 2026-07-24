/**
 * Shared helpers for native `<dialog>`-based overlays (ActionSheet, Alert —
 * part of the G1-4 Ionic-overlay refactor). Exported from the package root
 * so app-level modals (e.g. ai-assistant's VoiceListeningModal) can reuse
 * the same open/close/hardware-back logic instead of reinventing it.
 *
 * jsdom (unit-test env) doesn't implement HTMLDialogElement.showModal/close
 * (as of jsdom 29) — fall back to plain attribute + a manually dispatched
 * 'close' event so onDidDismiss still fires under test. Real WebViews
 * (Chromium-based, Android System WebView 37+) always have both natively.
 */
import { useEffect, type RefObject } from 'react';

export function openDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

export function closeDialog(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  }
}

/**
 * Registers a high-priority `ionBackButton` handler (Ionic's global
 * hardware-back event) that closes `dialogRef.current` while `isOpen` —
 * the same priority every overlay in this app uses to win over
 * screen-level nav handlers (e.g. VaultHomePage's folder-nav handler
 * registers at 10).
 */
export function useDialogBackButton(
  isOpen: boolean,
  dialogRef: RefObject<HTMLDialogElement | null>
): void {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onIonBackButton = (event: Event): void => {
      (
        event as CustomEvent<{
          register: (priority: number, handler: () => void) => void;
        }>
      ).detail.register(100, () => {
        if (dialogRef.current) closeDialog(dialogRef.current);
      });
    };
    document.addEventListener('ionBackButton', onIonBackButton);
    return (): void =>
      document.removeEventListener('ionBackButton', onIonBackButton);
  }, [isOpen, dialogRef]);
}
