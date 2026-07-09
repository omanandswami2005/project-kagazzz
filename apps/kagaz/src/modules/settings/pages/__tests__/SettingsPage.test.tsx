import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { SettingsPage } from '../SettingsPage';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  cleanup();
  document.body.innerHTML = '';
  // i18n is a singleton — reset so a language switch in one test can't leak.
  await i18n.changeLanguage('en');
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

  it('renders both language options in their own script', () => {
    renderPage();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
  });

  it('switches the UI language', async () => {
    renderPage();
    const group = document.querySelector('[data-agent-id="settings.language"]');
    expect(group?.getAttribute('data-agent-state')).toBe('en');

    await userEvent.click(screen.getByText('हिन्दी'));

    // changeLanguage is async (loads the hi namespaces), so wait for it.
    await waitFor(() => expect(i18n.language).toBe('hi'));
    expect(group?.getAttribute('data-agent-state')).toBe('hi');
    // The theme labels are now Hindi, proving the whole tree re-rendered.
    expect(screen.getByText('गहरी')).toBeInTheDocument();
  });
});
