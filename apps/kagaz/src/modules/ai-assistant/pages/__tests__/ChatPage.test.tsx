import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { useAi } from '@/app/providers/AIProvider';
import { useChat } from '../../hooks/useChat';
import { ChatPage } from '../ChatPage';

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
    ...overrides,
  };
}

function aiValue(overrides: Partial<ReturnType<typeof useAi>> = {}): ReturnType<typeof useAi> {
  return {
    status: 'ready',
    downloadProgress: 0,
    errorMessage: null,
    capabilities: null,
    modelSizeBytes: 497_664_000,
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

    expect(sendMessage).toHaveBeenCalledWith('How many documents do I have?');
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
});
