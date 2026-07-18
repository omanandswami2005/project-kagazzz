import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { i18n } from '@/core/i18n';
import { AIProvider, useAi } from '../AIProvider';
import { I18nProvider } from '../I18nProvider';

function AiProbe(): React.ReactNode {
  const { status } = useAi();
  return <span>{status}</span>;
}

describe('I18nProvider', () => {
  it('initializes i18n, renders children, and syncs <html lang>/<dir>', async () => {
    render(
      <I18nProvider>
        <p>ready-child</p>
      </I18nProvider>
    );
    await waitFor(() =>
      expect(screen.getByText('ready-child')).toBeInTheDocument()
    );
    expect(i18n.isInitialized).toBe(true);
    // <html lang>/<dir> are set by an effect that runs a tick after
    // children mount, so wait for it rather than asserting synchronously.
    await waitFor(() => {
      expect(document.documentElement.lang).toBeTruthy();
      expect(document.documentElement.dir).toBe('ltr');
    });
  });
});

describe('AIProvider', () => {
  it('exposes the not-loaded status until F-13 lands', () => {
    render(
      <AIProvider>
        <AiProbe />
      </AIProvider>
    );
    expect(screen.getByText('not-loaded')).toBeInTheDocument();
  });

  it('useAi throws outside the provider', () => {
    expect(() => render(<AiProbe />)).toThrow('inside <AIProvider>');
  });
});
