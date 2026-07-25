import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { AIProvider } from '@/app/providers/AIProvider';
import { AiError } from '../../services/ai-engine.service';
import { AiAssistantPage } from '../AiAssistantPage';

const engine = vi.hoisted(() => ({
  isAiSupported: vi.fn(),
  hasDownloadedModel: vi.fn(),
  downloadAndVerify: vi.fn(),
  loadModel: vi.fn(),
  deleteDownloadedModel: vi.fn(),
}));

vi.mock('../../services/ai-engine.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/ai-engine.service')>();
  return {
    ...actual,
    isAiSupported: engine.isAiSupported,
    hasDownloadedModel: engine.hasDownloadedModel,
    downloadAndVerify: engine.downloadAndVerify,
    loadModel: engine.loadModel,
    deleteDownloadedModel: engine.deleteDownloadedModel,
  };
});

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  engine.isAiSupported.mockReturnValue(true);
  engine.hasDownloadedModel.mockResolvedValue(false);
  engine.downloadAndVerify.mockResolvedValue('/data/model.litertlm');
  engine.loadModel.mockResolvedValue({ backend: 'gpu', loadTimeMs: 1200 });
  engine.deleteDownloadedModel.mockResolvedValue(undefined);
});

function renderPage(): void {
  render(
    <AIProvider>
      <AiAssistantPage />
    </AIProvider>
  );
}

describe('AiAssistantPage (F-13)', () => {
  it('shows the download button when no model is present', () => {
    renderPage();
    expect(
      document.querySelector('[data-agent-id="ai.settings.content"]')
    ).toHaveAttribute('data-agent-state', 'not-downloaded');
    expect(document.querySelector('[data-agent-id="ai.settings.download-button"]')).toBeInTheDocument();
  });

  it('shows an unsupported message when the platform cannot run the model', () => {
    engine.isAiSupported.mockReturnValue(false);
    renderPage();
    expect(document.querySelector('[data-agent-id="ai.settings.unsupported"]')).toBeInTheDocument();
  });

  it('tapping download drives the lifecycle through to ready', async () => {
    renderPage();
    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.download-button"]') as Element
    );

    expect(await screen.findByText(/ready/i)).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="ai.settings.content"]')
    ).toHaveAttribute('data-agent-state', 'ready');
    expect(document.querySelector('[data-agent-id="ai.settings.delete-button"]')).toBeInTheDocument();
  });

  it('shows an error state with a retry button when activation fails', async () => {
    engine.downloadAndVerify.mockRejectedValue(new AiError('MODEL_DOWNLOAD_FAILED', 'No internet connection'));
    renderPage();
    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.download-button"]') as Element
    );

    expect(await screen.findByText('No internet connection')).toBeInTheDocument();
    expect(document.querySelector('[data-agent-id="ai.settings.retry-button"]')).toBeInTheDocument();
  });

  it('deleting the model returns to the not-downloaded state', async () => {
    renderPage();
    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.download-button"]') as Element
    );
    await screen.findByText(/ready/i);

    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.delete-button"]') as Element
    );

    expect(engine.deleteDownloadedModel).toHaveBeenCalledOnce();
    expect(await screen.findByText(/download ai assistant/i)).toBeInTheDocument();
  });

  it('shows the GPU toggle off by default and forwards preferGpu=false on activate', async () => {
    renderPage();
    const toggle = document.querySelector('[data-agent-id="ai.settings.gpu-toggle-switch"]');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.download-button"]') as Element
    );
    await screen.findByText(/ready/i);
    expect(engine.loadModel).toHaveBeenCalledWith('/data/model.litertlm', expect.anything(), false);
  });

  it('enabling the GPU toggle persists it and forwards preferGpu=true on the next activate', async () => {
    renderPage();
    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.gpu-toggle-switch"]') as Element
    );
    expect(
      document.querySelector('[data-agent-id="ai.settings.gpu-toggle-switch"]')
    ).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('kagaz:ai-gpu-experimental')).toBe('true');

    await userEvent.click(
      document.querySelector('[data-agent-id="ai.settings.download-button"]') as Element
    );
    await screen.findByText(/ready/i);
    expect(engine.loadModel).toHaveBeenCalledWith('/data/model.litertlm', expect.anything(), true);
  });

  it('hides the GPU toggle when the platform is unsupported', () => {
    engine.isAiSupported.mockReturnValue(false);
    renderPage();
    expect(document.querySelector('[data-agent-id="ai.settings.gpu-toggle"]')).not.toBeInTheDocument();
  });
});
