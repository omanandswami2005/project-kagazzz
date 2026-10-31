import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { useAi } from '@/app/providers/AIProvider';
import { useChat } from '../../hooks/useChat';
import { ChatPage } from '../ChatPage';

// The attach flow needs the vault database and upload pipeline; the page's own
// behavior is what's under test here, so both hooks are mocked at their boundary.
const attach = vi.hoisted(() => ({
  state: { documents: [] as unknown[], lockedCount: 0 },
  ingestFiles: vi.fn(),
}));
vi.mock('../../hooks/useAttachableDocuments', () => ({ useAttachableDocuments: () => attach.state }));
vi.mock('@/modules/document-vault/hooks/useUpload', () => ({ useUpload: () => ({ ingestFiles: attach.ingestFiles }) }));

const routerPush = vi.hoisted(() => vi.fn());
vi.mock('@ionic/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: routerPush }),
}));
vi.mock('@/app/providers/AIProvider', () => ({ useAi: vi.fn() }));
vi.mock('../../hooks/useChat', () => ({ useChat: vi.fn() }));
vi.mock('../../components/MicButton', () => ({ MicButton: () => null }));

const useAiMock = vi.mocked(useAi);
const useChatMock = vi.mocked(useChat);

function chatValue(overrides: Partial<ReturnType<typeof useChat>> = {}): ReturnType<typeof useChat> {
  return {
    messages: [],
    streamingText: '',
    isStreaming: false,
    error: null,
    isLoading: false,
    sendMessage: vi.fn(),
    newChat: vi.fn(),
    pendingConfirmation: null,
    confirmPendingToolCall: vi.fn(),
    rejectPendingToolCall: vi.fn(),
    dismissExpiredConfirmation: vi.fn(),
    ...overrides,
  };
}

function aiValue(overrides: Partial<ReturnType<typeof useAi>> = {}): ReturnType<typeof useAi> {
  return {
    status: 'ready',
    downloadProgress: 0,
    errorMessage: null,
    capabilities: null,
    engine: 'litert' as const,
    serverUrl: null,
    mode: 'offline' as const,
    onlineAvailable: false,
    setMode: vi.fn(),
    modelSizeBytes: 497_664_000,
    preferGpu: false,
    setPreferGpu: vi.fn(),
    activate: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  vi.clearAllMocks();
  useAiMock.mockReturnValue(aiValue());
  useChatMock.mockReturnValue(chatValue());
});

describe('ChatPage (F-13)', () => {
  it('gates to a setup prompt when the model is not ready', () => {
    useAiMock.mockReturnValue(aiValue({ status: 'not-downloaded' }));
    render(<ChatPage />);
    expect(document.querySelector('[data-agent-id="ai.chat.gate"]')).toBeInTheDocument();
    expect(document.querySelector('[data-agent-id="ai.chat.content"]')).not.toBeInTheDocument();
  });

  it('shows a loading state while the conversation history loads', () => {
    useChatMock.mockReturnValue(chatValue({ isLoading: true }));
    render(<ChatPage />);
    expect(document.querySelector('[data-agent-state="loading"]')).toBeInTheDocument();
  });

  it('renders persisted messages once ready', () => {
    useChatMock.mockReturnValue(
      chatValue({
        messages: [
          { id: 'm-1', conversationId: 'c-1', role: 'user', content: 'Hi', createdAt: '2026-07-24T00:00:00Z' },
          {
            id: 'm-2',
            conversationId: 'c-1',
            role: 'assistant',
            content: 'Hello! How can I help?',
            createdAt: '2026-07-24T00:00:01Z',
          },
        ],
      })
    );
    render(<ChatPage />);
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
  });

  it('shows the streaming bubble while a response is in progress', () => {
    useChatMock.mockReturnValue(chatValue({ isStreaming: true, streamingText: 'Thinking about it' }));
    render(<ChatPage />);
    expect(document.querySelector('[data-agent-id="ai.chat.streaming"]')).toHaveTextContent(
      'Thinking about it'
    );
  });

  it('submitting the composer calls sendMessage and clears the draft', async () => {
    const sendMessage = vi.fn();
    useChatMock.mockReturnValue(chatValue({ sendMessage }));
    render(<ChatPage />);

    const input = document.querySelector('[data-agent-id="ai.chat.input"]') as HTMLInputElement;
    await userEvent.type(input, 'How many documents do I have?');
    await userEvent.click(document.querySelector('[data-agent-id="ai.chat.send"]') as Element);

    expect(sendMessage).toHaveBeenCalledWith('How many documents do I have?', { attachments: [] });
    expect(input.value).toBe('');
  });

  it('disables sending while streaming', () => {
    useChatMock.mockReturnValue(chatValue({ isStreaming: true }));
    render(<ChatPage />);
    expect(document.querySelector('[data-agent-id="ai.chat.send"]')).toBeDisabled();
  });

  it('shows a chat-level error alert', () => {
    useChatMock.mockReturnValue(chatValue({ error: 'Failed to reach the AI Assistant' }));
    render(<ChatPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to reach the AI Assistant');
  });

  it('shows no confirmation card when nothing is pending', () => {
    render(<ChatPage />);
    expect(document.querySelector('[data-agent-id="ai.chat.confirm"]')).not.toBeInTheDocument();
  });

  it('renders a pending confirmation card with the action summary', () => {
    useChatMock.mockReturnValue(
      chatValue({
        pendingConfirmation: {
          requestId: 'req-1',
          actionId: 'vault.bulkDelete',
          summary: 'Delete the currently selected documents.',
          expired: false,
        },
      })
    );
    render(<ChatPage />);
    const card = document.querySelector('[data-agent-id="ai.chat.confirm"]');
    expect(card).toHaveTextContent('Delete the currently selected documents.');
    expect(card).toHaveAttribute('data-agent-state', 'pending');
  });

  it('approving the card calls confirmPendingToolCall', async () => {
    const confirmPendingToolCall = vi.fn();
    useChatMock.mockReturnValue(
      chatValue({
        pendingConfirmation: {
          requestId: 'req-1',
          actionId: 'vault.bulkDelete',
          summary: 'Delete the currently selected documents.',
          expired: false,
        },
        confirmPendingToolCall,
      })
    );
    render(<ChatPage />);
    await userEvent.click(document.querySelector('[data-agent-id="ai.chat.confirm-approve"]') as Element);
    expect(confirmPendingToolCall).toHaveBeenCalledOnce();
  });

  it('rejecting the card calls rejectPendingToolCall', async () => {
    const rejectPendingToolCall = vi.fn();
    useChatMock.mockReturnValue(
      chatValue({
        pendingConfirmation: {
          requestId: 'req-1',
          actionId: 'vault.bulkDelete',
          summary: 'Delete the currently selected documents.',
          expired: false,
        },
        rejectPendingToolCall,
      })
    );
    render(<ChatPage />);
    await userEvent.click(document.querySelector('[data-agent-id="ai.chat.confirm-reject"]') as Element);
    expect(rejectPendingToolCall).toHaveBeenCalledOnce();
  });

  it('shows the expired message and a dismiss button once the card times out', async () => {
    const dismissExpiredConfirmation = vi.fn();
    useChatMock.mockReturnValue(
      chatValue({
        pendingConfirmation: {
          requestId: 'req-1',
          actionId: 'vault.bulkDelete',
          summary: 'Delete the currently selected documents.',
          expired: true,
        },
        dismissExpiredConfirmation,
      })
    );
    render(<ChatPage />);
    const card = document.querySelector('[data-agent-id="ai.chat.confirm"]');
    expect(card).toHaveAttribute('data-agent-state', 'error');
    expect(document.querySelector('[data-agent-id="ai.chat.confirm-approve"]')).not.toBeInTheDocument();
    await userEvent.click(document.querySelector('[data-agent-id="ai.chat.confirm-dismiss"]') as Element);
    expect(dismissExpiredConfirmation).toHaveBeenCalledOnce();
  });
});

describe('ChatPage attachments and result cards (chat journey)', () => {
  const doc = (id: string, name: string, fileType = 'pdf'): Record<string, unknown> => ({ id, name, fileType, isLocked: false });
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);

  beforeEach(() => {
    useAiMock.mockReturnValue(aiValue());
    attach.state = { documents: [doc('doc-a', 'Rent agreement.pdf'), doc('doc-c', 'Photo.jpg', 'jpg')], lockedCount: 0 };
    routerPush.mockClear();
  });

  it('attaching documents shows chips, sends them with the message, then clears them', async () => {
    const sendMessage = vi.fn();
    useChatMock.mockReturnValue(chatValue({ sendMessage }));
    render(<ChatPage />);

    await userEvent.click(q('ai.chat.attach') as Element);
    await userEvent.click(await screen.findByRole('button', { name: /Rent agreement\.pdf/ }));
    await userEvent.click(q('ai.chat.attach-confirm') as Element);

    expect(q('ai.chat.attachment-doc-a')).toHaveTextContent('Rent agreement.pdf');
    await userEvent.type(q('ai.chat.input') as HTMLInputElement, 'compress this');
    await userEvent.click(q('ai.chat.send') as Element);

    expect(sendMessage).toHaveBeenCalledWith('compress this', {
      attachments: [{ id: 'doc-a', name: 'Rent agreement.pdf', fileType: 'pdf' }],
    });
    expect(q('ai.chat.attachment-doc-a')).toBeNull();
  });

  it('a chip can be removed, and attachments alone (no text) can be sent', async () => {
    const sendMessage = vi.fn();
    useChatMock.mockReturnValue(chatValue({ sendMessage }));
    render(<ChatPage />);
    const attachDoc = async (name: RegExp): Promise<void> => {
      await userEvent.click(q('ai.chat.attach') as Element);
      await userEvent.click(await screen.findByRole('button', { name }));
      await userEvent.click(q('ai.chat.attach-confirm') as Element);
    };

    await attachDoc(/Rent agreement\.pdf/);
    await userEvent.click(q('ai.chat.attachment-remove-doc-a') as Element);
    expect(q('ai.chat.attachment-doc-a')).toBeNull();
    expect(q('ai.chat.send')).toBeDisabled();

    await attachDoc(/Photo\.jpg/);
    expect(q('ai.chat.send')).not.toBeDisabled();
    await userEvent.click(q('ai.chat.send') as Element);
    expect(sendMessage).toHaveBeenCalledWith('', { attachments: [{ id: 'doc-c', name: 'Photo.jpg', fileType: 'jpg' }] });
  });

  it('says how many locked documents are hidden from the picker', async () => {
    attach.state = { documents: [], lockedCount: 2 };
    useChatMock.mockReturnValue(chatValue());
    render(<ChatPage />);
    await userEvent.click(q('ai.chat.attach') as Element);
    expect(await screen.findByText(/2 locked documents aren't shown/)).toBeInTheDocument();
  });

  it('shows a sent message with its attached documents, and a tool result as an openable card', async () => {
    const parts = (p: unknown): string => JSON.stringify(p);
    useChatMock.mockReturnValue(
      chatValue({
        messages: [
          { id: 'm1', conversationId: 'c', role: 'user', content: 'merge these', createdAt: '', partsJson: parts([{ type: 'attachments', documents: [{ id: 'doc-a', name: 'Rent agreement.pdf', fileType: 'pdf' }] }]) },
          { id: 'm2', conversationId: 'c', role: 'tool', content: 'Merged.pdf', createdAt: '', partsJson: parts([{ type: 'documents', documents: [{ id: 'new-1', name: 'Merged.pdf', fileType: 'pdf' }] }]) },
        ] as never,
      })
    );
    render(<ChatPage />);

    expect(q('ai.chat.message-m1')).toHaveTextContent('Rent agreement.pdf');
    expect(q('ai.chat.message-m1')).toHaveTextContent('merge these');
    expect(q('ai.chat.result-card')).toHaveTextContent('Merged.pdf');

    await userEvent.click(q('ai.chat.result-open-new-1') as Element);
    expect(routerPush).toHaveBeenCalledWith('/doc/new-1', 'forward', 'push');
  });

  it('a plain tool message without a documents part renders nothing', () => {
    useChatMock.mockReturnValue(
      chatValue({ messages: [{ id: 'm3', conversationId: 'c', role: 'tool', content: 'x', createdAt: '' }] as never })
    );
    render(<ChatPage />);
    expect(q('ai.chat.message-m3')).toBeNull();
  });
});

describe('ChatPage forms from the assistant (GenUI)', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);
  const spec = {
    question: 'How should I resize it?',
    fields: [{ id: 'width', label: 'Width', type: 'number', required: true, min: 16, max: 8000, unit: 'px', default: 200 }],
  };
  const formMessage = { id: 'f1', conversationId: 'c', role: 'assistant', content: spec.question, createdAt: '', partsJson: JSON.stringify([{ type: 'form', formId: 'form-1', spec }]) };
  const answerMessage = { id: 'a1', conversationId: 'c', role: 'user', content: 'Width: 200 px', createdAt: '', partsJson: JSON.stringify([{ type: 'answer', formId: 'form-1' }]) };

  beforeEach(() => {
    useAiMock.mockReturnValue(aiValue());
    attach.state = { documents: [], lockedCount: 0 };
  });

  it('shows the question with its form, and submitting sends the readable answer tagged with the form id', async () => {
    const sendMessage = vi.fn();
    useChatMock.mockReturnValue(chatValue({ messages: [formMessage] as never, sendMessage }));
    render(<ChatPage />);

    expect(q('ai.chat.message-f1')).toHaveTextContent('How should I resize it?');
    await userEvent.click(q('ai.chat.form-submit') as Element);

    expect(sendMessage).toHaveBeenCalledWith('Width: 200 px', { parts: [{ type: 'answer', formId: 'form-1' }] });
  });

  it('an answered form shows only its question and the answer — it cannot be submitted twice', () => {
    useChatMock.mockReturnValue(chatValue({ messages: [formMessage, answerMessage] as never }));
    render(<ChatPage />);
    expect(q('ai.chat.message-f1')).toHaveTextContent('How should I resize it?');
    expect(q('ai.chat.form')).toBeNull();
    expect(q('ai.chat.message-a1')).toHaveTextContent('Width: 200 px');
  });

  it('a form is inert while the assistant is answering', () => {
    useChatMock.mockReturnValue(chatValue({ messages: [formMessage] as never, isStreaming: true }));
    render(<ChatPage />);
    expect(q('ai.chat.form-submit')).toBeDisabled();
  });

  it('a form with a corrupt spec degrades to a plain message (no crash, no form)', () => {
    const corrupt = { ...formMessage, partsJson: JSON.stringify([{ type: 'form', formId: 'x', spec: { question: 'q', fields: 'nope' } }]) };
    useChatMock.mockReturnValue(chatValue({ messages: [corrupt] as never }));
    render(<ChatPage />);
    expect(q('ai.chat.message-f1')).toHaveTextContent('How should I resize it?');
    expect(q('ai.chat.form')).toBeNull();
  });
});

describe('ChatPage markdown in messages', () => {
  const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);

  it('renders assistant markdown (bold, lists) and the user\'s own markdown, as elements not symbols', () => {
    useAiMock.mockReturnValue(aiValue());
    useChatMock.mockReturnValue(
      chatValue({
        messages: [
          { id: 'u1', conversationId: 'c', role: 'user', content: 'make **this** bold', createdAt: '' },
          { id: 'a1', conversationId: 'c', role: 'assistant', content: 'Found **Rent agreement.pdf**:\n- 120 KB\n- 2 pages', createdAt: '' },
        ] as never,
      })
    );
    render(<ChatPage />);

    expect(q('ai.chat.message-a1')?.querySelector('strong')?.textContent).toBe('Rent agreement.pdf');
    expect([...(q('ai.chat.message-a1')?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual(['120 KB', '2 pages']);
    expect(q('ai.chat.message-a1')?.textContent).not.toContain('**');
    expect(q('ai.chat.message-u1')?.querySelector('strong')?.textContent).toBe('this');
  });

  it('renders the in-progress streamed reply as markdown too, and never executes injected markup', () => {
    useAiMock.mockReturnValue(aiValue());
    useChatMock.mockReturnValue(chatValue({ isStreaming: true, streamingText: 'Working on **it** <img src=x onerror=alert(1)>' }));
    render(<ChatPage />);
    expect(q('ai.chat.streaming')?.querySelector('strong')?.textContent).toBe('it');
    expect(q('ai.chat.streaming')?.querySelector('img')).toBeNull();
  });
});
