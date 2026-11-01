/**
 * Haptic feedback (UX pass, 2026-07-21). `@capacitor/haptics` was an
 * installed, never-imported dependency — every tap/success/error in the app
 * was silent. Native-only (no-op on web, matching every other
 * `Capacitor.getPlatform() !== 'web'`-gated feature in this codebase, e.g.
 * `document-intent.service.isIntentSupported`); every call also swallows
 * plugin errors, since haptics is pure enhancement and must never be the
 * reason an action fails.
 *
 * Semantic wrappers, not raw `ImpactStyle`/`NotificationType` calls at each
 * site, so a call site reads as *why* ("this succeeded") not *how*
 * ("medium impact") — and the physical feedback for a whole category can
 * change in one place later.
 *
 * Also gated on `usePreferencesStore().hapticsEnabled` (2026-07-24 UX pass,
 * Settings toggle) — read imperatively via `getState()` since these are
 * plain functions called from arbitrary non-component code, not hooks.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { usePreferencesStore } from '@/core/preferences';

const shouldFire = (): boolean =>
  Capacitor.getPlatform() !== 'web' && usePreferencesStore.getState().hapticsEnabled;

/** Light tap — toggles, selecting an item, minor UI state changes. */
export function hapticTap(): void {
  if (!shouldFire()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
}

/** Medium impact — a deliberate action landed (save, copy, lock/unlock). */
export function hapticAction(): void {
  if (!shouldFire()) return;
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
}

/** Success notification — an operation finished (upload, compress, export). */
export function hapticSuccess(): void {
  if (!shouldFire()) return;
  void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined);
}

/** Warning notification — a soft failure the user can recover from. */
export function hapticWarning(): void {
  if (!shouldFire()) return;
  void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined);
}

/** Error notification — an operation failed. */
export function hapticError(): void {
  if (!shouldFire()) return;
  void Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
}

/** Heavy impact — irreversible/destructive confirmation (delete). */
export function hapticDestructive(): void {
  if (!shouldFire()) return;
  void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
}
