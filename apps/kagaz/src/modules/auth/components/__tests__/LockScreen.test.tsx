import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { LockScreen } from '../LockScreen';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('LockScreen (F-16)', () => {
  it('auto-prompts for biometrics on mount', async () => {
    const onUnlock = vi.fn().mockResolvedValue('success');
    render(<LockScreen onUnlock={onUnlock} />);
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('shows a retry error when authentication fails, and re-prompts', async () => {
    const onUnlock = vi.fn().mockResolvedValue('failed');
    render(<LockScreen onUnlock={onUnlock} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);

    await userEvent.click(screen.getByText('Unlock'));
    expect(onUnlock).toHaveBeenCalledTimes(2);
  });
});
