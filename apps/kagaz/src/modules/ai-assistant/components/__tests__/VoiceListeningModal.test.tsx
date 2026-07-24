import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VoiceListeningModal } from '../VoiceListeningModal';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('VoiceListeningModal (F-15 voice orb)', () => {
  it('is closed and reports collapsed state when isOpen is false', () => {
    const { container } = render(
      <VoiceListeningModal isOpen={false} partial="" onCancel={() => undefined} />
    );
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toHaveAttribute('open');
    expect(dialog).toHaveAttribute('data-agent-state', 'collapsed');
  });

  it('opens and reports expanded state while listening', () => {
    const { container } = render(
      <VoiceListeningModal isOpen partial="" onCancel={() => undefined} />
    );
    expect(container.querySelector('dialog')).toHaveAttribute(
      'data-agent-state',
      'expanded'
    );
    expect(screen.getByText('listening')).toBeInTheDocument();
  });

  it('shows a hint placeholder with no partial transcript yet', () => {
    render(<VoiceListeningModal isOpen partial="" onCancel={() => undefined} />);
    expect(screen.getByText('voice_modal.hint')).toBeInTheDocument();
  });

  it('shows the streaming partial transcript in place of the hint', () => {
    render(
      <VoiceListeningModal isOpen partial="aadhaar card" onCancel={() => undefined} />
    );
    expect(screen.getByText('aadhaar card')).toBeInTheDocument();
    expect(screen.queryByText('voice_modal.hint')).not.toBeInTheDocument();
  });

  it('calls onCancel when the stop button is tapped', async () => {
    const onCancel = vi.fn();
    render(<VoiceListeningModal isOpen partial="" onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'voice_modal.stop' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not throw when toggled closed after being open', () => {
    const { rerender } = render(
      <VoiceListeningModal isOpen partial="" onCancel={() => undefined} />
    );
    expect(() =>
      rerender(<VoiceListeningModal isOpen={false} partial="" onCancel={() => undefined} />)
    ).not.toThrow();
  });
});
