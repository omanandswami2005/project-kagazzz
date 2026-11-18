import { render, screen, waitFor } from '@testing-library/react';
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

const q = (id: string): Element | null => document.querySelector(`[data-agent-id="${id}"]`);
const find = (id: string): Promise<Element> =>
  waitFor(() => {
    const el = q(id);
    expect(el).not.toBeNull();
    return el as Element;
  });

describe('AiAssistantPage (F-13)', () => {
  it('shows the download button when no model is present', async () => {
    renderPage();
    await find('ai.settings.download-button');
    expect(q('ai.settings.content')).toHaveAttribute('data-agent-state', 'not-downloaded');
    expect(q('ai.settings.delete-button')).toBeNull();
  });

  it('shows an unsupported message when the platform cannot run the model', () => {
    engine.isAiSupported.mockReturnValue(false);
    renderPage();
    expect(q('ai.settings.unsupported')).toBeInTheDocument();
  });

  it('remembers a downloaded model after a restart: Load + Delete, never Download again', async () => {
    engine.hasDownloadedModel.mockResolvedValue(true);
    renderPage();
    await find('ai.settings.downloaded');
    expect(q('ai.settings.content')).toHaveAttribute('data-agent-state', 'downloaded');
    expect(q('ai.settings.download-button')).toBeNull();
    expect(q('ai.settings.load-button')).toBeInTheDocument();
    expect(q('ai.settings.delete-button')).toBeInTheDocument();
  });

  it('tapping download downloads and verifies, but does not load the model', async () => {
    renderPage();
    await userEvent.click(await find('ai.settings.download-button'));

    await find('ai.settings.downloaded');
    expect(engine.downloadAndVerify).toHaveBeenCalledOnce();
    expect(engine.loadModel).not.toHaveBeenCalled();
  });

  it('Load now loads a downloaded model through to ready', async () => {
    engine.hasDownloadedModel.mockResolvedValue(true);
    renderPage();
    await userEvent.click(await find('ai.settings.load-button'));

    expect(await screen.findByText(/ready/i)).toBeInTheDocument();
    expect(q('ai.settings.content')).toHaveAttribute('data-agent-state', 'ready');
    expect(q('ai.settings.delete-button')).toBeInTheDocument();
  });

  it('shows an error state with a retry button when the download fails', async () => {
    engine.downloadAndVerify.mockRejectedValue(new AiError('MODEL_DOWNLOAD_FAILED', 'No internet connection'));
    renderPage();
    await userEvent.click(await find('ai.settings.download-button'));

    expect(await screen.findByText('No internet connection')).toBeInTheDocument();
    expect(q('ai.settings.retry-button')).toBeInTheDocument();
  });

  it('keeps Delete reachable when a downloaded model fails to load', async () => {
    engine.hasDownloadedModel.mockResolvedValue(true);
    engine.loadModel.mockRejectedValue(new AiError('MODEL_LOAD_FAILED', 'Out of memory'));
    renderPage();
    await userEvent.click(await find('ai.settings.load-button'));

    expect(await screen.findByText('Out of memory')).toBeInTheDocument();
    expect(q('ai.settings.delete-button')).toBeInTheDocument();
  });

  it('deleting asks for confirmation first, then returns to not-downloaded', async () => {
    engine.hasDownloadedModel.mockResolvedValue(true);
    renderPage();
    await userEvent.click(await find('ai.settings.delete-button'));
    expect(engine.deleteDownloadedModel).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(engine.deleteDownloadedModel).toHaveBeenCalledOnce());
    await find('ai.settings.download-button');
  });

  it('shows the GPU toggle off by default and forwards preferGpu=false on load', async () => {
    engine.hasDownloadedModel.mockResolvedValue(true);
    renderPage();
    expect(q('ai.settings.gpu-toggle-switch')).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(await find('ai.settings.load-button'));
    await screen.findByText(/ready/i);
    expect(engine.loadModel).toHaveBeenCalledWith('/data/model.litertlm', expect.anything(), false);
  });

  it('enabling the GPU toggle persists it and forwards preferGpu=true on the next load', async () => {
    engine.hasDownloadedModel.mockResolvedValue(true);
    renderPage();
    await userEvent.click(q('ai.settings.gpu-toggle-switch') as Element);
    expect(q('ai.settings.gpu-toggle-switch')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('kagaz:ai-gpu-experimental')).toBe('true');

    await userEvent.click(await find('ai.settings.load-button'));
    await screen.findByText(/ready/i);
    expect(engine.loadModel).toHaveBeenCalledWith('/data/model.litertlm', expect.anything(), true);
  });

  it('hides the GPU toggle when the platform is unsupported', () => {
    engine.isAiSupported.mockReturnValue(false);
    renderPage();
    expect(q('ai.settings.gpu-toggle')).not.toBeInTheDocument();
  });
});
