// The settings screen when a local Ollama server (demo build) is the engine:
// no model download, no GPU switch, and honest copy — messages go to a server.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { AIProvider } from '@/app/providers/AIProvider';
import { AiAssistantPage } from '../AiAssistantPage';

const ollama = vi.hoisted(() => ({ setTools: vi.fn(), checkReady: vi.fn() }));

vi.mock('@/modules/ai-assistant/services/chat-engine.registry', () => ({
  getOllamaEngine: () => ollama,
  getChatEngine: () => ollama,
}));
vi.mock('@/infrastructure/ollama', () => ({
  getOllamaConfig: () => ({
    baseUrl: 'http://localhost:11434',
    chatModel: 'gemma4:e2b',
    visionModel: 'gemma4:e2b',
    embeddingModel: 'embeddinggemma',
  }),
}));

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  ollama.checkReady.mockResolvedValue(undefined);
});

const q = (id: string): Element | null => document.querySelector(`[data-agent-id="${id}"]`);

function renderPage(): void {
  render(
    <AIProvider>
      <AiAssistantPage />
    </AIProvider>
  );
}

describe('AiAssistantPage with the Ollama engine', () => {
  it('offers Connect (not Download), hides the GPU switch, and says data goes to the server', () => {
    renderPage();
    expect(q('ai.settings.connect-button')).toBeInTheDocument();
    expect(q('ai.settings.download-button')).toBeNull();
    expect(q('ai.settings.gpu-toggle')).toBeNull();
    expect(screen.getByText(/http:\/\/localhost:11434/)).toBeInTheDocument();
    expect(screen.queryByText(/nothing you type or ask ever leaves/i)).toBeNull();
  });

  it('connecting registers the tools, checks the server, and reaches ready with a Disconnect button', async () => {
    renderPage();
    await userEvent.click(q('ai.settings.connect-button') as Element);

    expect(await screen.findByText(/ready/i)).toBeInTheDocument();
    expect(ollama.setTools).toHaveBeenCalledOnce();
    expect(ollama.checkReady).toHaveBeenCalledOnce();
    expect(q('ai.settings.capabilities')?.textContent).toContain('OLLAMA');
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('shows the real reason when the server or model is missing, with a retry', async () => {
    ollama.checkReady.mockRejectedValue(new Error('Ollama has no model "gemma4:e2b" — run: ollama pull gemma4:e2b'));
    renderPage();
    await userEvent.click(q('ai.settings.connect-button') as Element);

    expect(await screen.findByRole('alert')).toHaveTextContent('ollama pull gemma4:e2b');
    expect(q('ai.settings.retry-button')).toBeInTheDocument();
  });
});
