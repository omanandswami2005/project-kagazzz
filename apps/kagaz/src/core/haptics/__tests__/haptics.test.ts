import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted((): { value: string } => ({ value: 'android' }));
const { impact, notification } = vi.hoisted(() => ({
  impact: vi.fn(async () => undefined),
  notification: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value },
}));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

import {
  hapticAction,
  hapticDestructive,
  hapticError,
  hapticSuccess,
  hapticTap,
  hapticWarning,
} from '../index';

beforeEach(() => {
  vi.clearAllMocks();
  platform.value = 'android';
});

describe('haptics (native-only, silent on web and on plugin failure)', () => {
  it('hapticTap fires a light impact', () => {
    hapticTap();
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('hapticAction fires a medium impact', () => {
    hapticAction();
    expect(impact).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });

  it('hapticDestructive fires a heavy impact', () => {
    hapticDestructive();
    expect(impact).toHaveBeenCalledWith({ style: 'HEAVY' });
  });

  it('hapticSuccess/Warning/Error fire the matching notification type', () => {
    hapticSuccess();
    expect(notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
    hapticWarning();
    expect(notification).toHaveBeenCalledWith({ type: 'WARNING' });
    hapticError();
    expect(notification).toHaveBeenCalledWith({ type: 'ERROR' });
  });

  it('is a no-op on web', () => {
    platform.value = 'web';
    hapticTap();
    hapticSuccess();
    expect(impact).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it('never throws when the plugin rejects', () => {
    impact.mockRejectedValueOnce(new Error('no vibrator'));
    expect(() => hapticTap()).not.toThrow();
  });
});
