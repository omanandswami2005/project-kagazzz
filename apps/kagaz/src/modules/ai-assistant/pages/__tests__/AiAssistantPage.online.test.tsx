// The single online/offline switch on the AI settings screen: a data-sharing
// warning before going online, Vertex AI connect, and back offline.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { AIProvider } from '@/app/providers/AIProvider';
import { AiAssistantPage } from '../AiAssistantPage';

const h = vi.hoisted(() => ({
  mode: { value: 'offline' },
  cloud: { kind: 'cloud', setTools: vi.fn(), checkReady: vi.fn() },
}));

vi.mock('@/infrastructure/cloud-ai', () => ({
  getAiMode: () => h.mode.value,
  setAiMode: (m: 'offline' | 'online') => {
    h.mode.value = m;
  },
  isCloudAiConfigured: () => true,
  isOnline: () => h.mode.value === 'online',
  onAiModeChange: () => () => undefined,
}));
vi.mock('@/modules/ai-assistant/services/chat-engine.registry', () => ({
  getOllamaEngine: () => null,
  getServerEngine: () => (h.mode.value === 'online' ? h.cloud : null),
  getChatEngine: () => h.cloud,
}));
vi.mock('../../services/ai-engine.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/ai-engine.service')>();
  return { ...actual, isAiSupported: () => false, hasDownloadedModel: () => Promise.resolve(false) };
});

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.mode.value = 'offline';
  h.cloud.checkReady.mockResolvedValue({ ok: true, project: 'proj-1' });
});

const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);

function renderPage(): void {
  render(
    <AIProvider>
      <AiAssistantPage />
    </AIProvider>
  );
}

describe('AiAssistantPage online/offline switch', () => {
  it('shows one switch, off by default, with an offline hint', () => {
    renderPage();
    expect(q('ai.settings.mode-switch')).toBeInTheDocument();
    expect(screen.getByText(/nothing is sent to Google/i)).toBeInTheDocument();
    expect(h.cloud.checkReady).not.toHaveBeenCalled();
  });

  it('turning it on shows the data-sharing warning first; Cancel keeps everything offline', async () => {
    renderPage();
    await userEvent.click(q('ai.settings.mode-switch') as Element);

    expect(await screen.findByText('Send your data to Google Cloud?')).toBeInTheDocument();
    expect(screen.getByText(/can include personal information such as ID numbers/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(h.mode.value).toBe('offline');
    expect(h.cloud.setTools).not.toHaveBeenCalled();
  });

  it('confirming goes online, connects to Vertex immediately, and shows ready on CLOUD (no download or GPU UI)', async () => {
    renderPage();
    await userEvent.click(q('ai.settings.mode-switch') as Element);
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on online mode' }));

    expect(await screen.findByText(/ready/i)).toBeInTheDocument();
    expect(h.mode.value).toBe('online');
    expect(h.cloud.setTools).toHaveBeenCalledOnce();
    expect(h.cloud.checkReady).toHaveBeenCalledOnce();
    expect(q('ai.settings.capabilities')?.textContent).toContain('CLOUD');
    expect(q('ai.settings.download-button')).toBeNull();
    expect(q('ai.settings.gpu-toggle')).toBeNull();
    expect(screen.getByText(/sent to Google Cloud \(Vertex AI\)/i)).toBeInTheDocument();
  });

  it('switching back off returns to offline without a warning', async () => {
    h.mode.value = 'online';
    renderPage();
    await userEvent.click(q('ai.settings.mode-switch') as Element);

    expect(h.mode.value).toBe('offline');
    expect(document.querySelector('dialog[open]')).toBeNull(); // the warning dialog stayed closed
  });

  it('shows the real reason when Google credentials are missing, with a retry', async () => {
    h.cloud.checkReady.mockRejectedValue(new Error('Cloud AI is not available: run: gcloud auth application-default login'));
    renderPage();
    await userEvent.click(q('ai.settings.mode-switch') as Element);
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on online mode' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('application-default login');
    expect(q('ai.settings.retry-button')).toBeInTheDocument();
  });
});
