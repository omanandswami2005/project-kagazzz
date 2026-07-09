/**
 * App-level biometric gate (10-security-architecture.md §3.1). Wraps the
 * platform biometric prompt behind a protocol so the lock store and tests
 * never touch the plugin directly.
 *
 * [SEC] This is an *access* gate on top of the always-on SQLCipher database
 * encryption (§3.2) — it stops casual access to an unlocked phone; it does not
 * itself hold keys. Never log biometric payloads; only the coarse outcome.
 */
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { log } from '@/core/logging';

const logger = log('auth');

/** Outcome of an unlock attempt. */
export type UnlockResult = 'success' | 'failed' | 'cancelled' | 'unavailable';

/** The biometric capability the app-lock depends on. */
export interface BiometricAuthenticator {
  /** Whether biometric (fingerprint/face) is enrolled and usable. */
  isAvailable(): Promise<boolean>;
  /** Prompts the user; resolves the coarse outcome (never throws). */
  authenticate(reason: string): Promise<UnlockResult>;
}

const CANCEL_CODES = new Set(['userCancel', 'systemCancel', 'appCancel']);

/** Real authenticator backed by @aparajita/capacitor-biometric-auth. */
export class CapacitorBiometricAuthenticator implements BiometricAuthenticator {
  async isAvailable(): Promise<boolean> {
    try {
      const { isAvailable, deviceIsSecure } = await BiometricAuth.checkBiometry();
      // Enrolled biometry OR a secure device lock (PIN/pattern/password): with
      // allowDeviceCredential the OS credential is a valid fallback (§3.1).
      return isAvailable || deviceIsSecure;
    } catch {
      return false;
    }
  }

  async authenticate(reason: string): Promise<UnlockResult> {
    try {
      await BiometricAuth.authenticate({
        reason,
        androidTitle: reason,
        // OS PIN/pattern/password fallback (§3.1 "Fallback: device PIN/pattern").
        allowDeviceCredential: true,
      });
      logger.info({ event: 'auth.biometric.success' });
      return 'success';
    } catch (error) {
      // [SEC] log only the coarse error code — never any biometric data.
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : 'unknown';
      logger.warn({ event: 'auth.biometric.denied', code });
      return CANCEL_CODES.has(code) ? 'cancelled' : 'failed';
    }
  }
}

/** Shared authenticator instance used by the app-lock hook and settings. */
export const biometricAuthenticator: BiometricAuthenticator =
  new CapacitorBiometricAuthenticator();
