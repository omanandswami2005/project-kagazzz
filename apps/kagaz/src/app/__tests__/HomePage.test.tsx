import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { HomePage } from '../pages/HomePage';
import { HomePageAgent } from '../pages/HomePage.agent';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('HomePage', () => {
  it('renders the localized empty state with agent ids', async () => {
    render(<HomePage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'My Documents' })
      ).toBeInTheDocument()
    );
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(document.querySelector('[data-agent-id="app.home"]')).not.toBeNull();
  });

  it('renders in Hindi after a language switch', async () => {
    await i18n.changeLanguage('hi');
    render(<HomePage />);
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'मेरे दस्तावेज़' })
      ).toBeInTheDocument()
    );
    await i18n.changeLanguage('en');
  });
});

describe('HomePage.agent manifest', () => {
  it('declares the page contract (id, route, intent)', () => {
    expect(HomePageAgent.id).toBe('app.home');
    expect(HomePageAgent.route).toBe('/');
    expect(HomePageAgent.intent).toContain('Landing screen');
    expect(HomePageAgent.availableActions).toEqual([]);
  });
});
