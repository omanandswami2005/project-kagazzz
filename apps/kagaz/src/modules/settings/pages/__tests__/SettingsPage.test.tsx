import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { SettingsPage } from '../SettingsPage';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function renderPage(): void {
  render(
    <ThemeProvider>
      <SettingsPage />
    </ThemeProvider>
  );
}

describe('SettingsPage', () => {
  it('renders the three theme options', () => {
    renderPage();
    for (const label of ['System', 'Light', 'Dark']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('reflects the active theme and applies a change', async () => {
    renderPage();
    const group = document.querySelector('[data-agent-id="settings.theme"]');
    expect(group?.getAttribute('data-agent-state')).toBe('system');

    await userEvent.click(screen.getByText('Dark'));

    expect(group?.getAttribute('data-agent-state')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
