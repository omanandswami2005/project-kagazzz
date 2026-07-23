import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseVoiceInput } from '../../hooks/useVoiceInput';
import { MicButton } from '../MicButton';

const voice: UseVoiceInput & { _reset: () => void } = {
  supported: true,
  listening: false,
  partial: '',
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
  _reset() {
    this.supported = true;
    this.listening = false;
    this.partial = '';
    this.error = null;
  },
};

vi.mock('../../hooks/useVoiceInput', () => ({ useVoiceInput: () => voice }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

beforeEach(() => {
  voice._reset();
  vi.clearAllMocks();
});
afterEach(cleanup);

const mic = (): HTMLElement | null =>
  document.querySelector('[data-agent-id="vault.home.voice-search"]');

describe('MicButton (F-15)', () => {
  it('renders nothing when the device has no speech recognition', () => {
    voice.supported = false;
    render(<MicButton onResult={vi.fn()} />);
    expect(mic()).toBeNull();
  });

  it('renders an idle mic with the "start" label', () => {
    render(<MicButton onResult={vi.fn()} />);
    expect(mic()).not.toBeNull();
    expect(mic()?.getAttribute('data-agent-state')).toBe('idle');
    expect(mic()?.getAttribute('aria-label')).toBe('search.voice.start');
    expect(mic()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('hold-to-speak: pointer down starts, pointer up stops', () => {
    render(<MicButton onResult={vi.fn()} />);
    fireEvent.pointerDown(mic()!);
    expect(voice.start).toHaveBeenCalledOnce();
    fireEvent.pointerUp(mic()!);
    expect(voice.stop).toHaveBeenCalledOnce();
  });

  it('captures the pointer on press (bug-audit fix: finger drift must not cut dictation short)', () => {
    render(<MicButton onResult={vi.fn()} />);
    const setPointerCapture = vi.fn();
    Object.defineProperty(mic()!, 'setPointerCapture', { value: setPointerCapture });
    fireEvent.pointerDown(mic()!);
    expect(setPointerCapture).toHaveBeenCalledOnce();
    // No onPointerLeave handler — with the pointer captured, up/cancel are
    // the only events that end a hold, so a leave (e.g. a jsdom event with
    // no real capture support) must not stop listening.
    fireEvent.pointerLeave(mic()!);
    expect(voice.stop).not.toHaveBeenCalled();
  });

  it('keyboard activation (detail 0) toggles listening', () => {
    render(<MicButton onResult={vi.fn()} />);
    fireEvent.click(mic()!, { detail: 0 });
    expect(voice.start).toHaveBeenCalledOnce();
    expect(voice.stop).not.toHaveBeenCalled();
  });

  it('does not double-fire on the click that follows a pointer release', () => {
    render(<MicButton onResult={vi.fn()} />);
    fireEvent.click(mic()!, { detail: 1 }); // pointer-driven click
    expect(voice.start).not.toHaveBeenCalled();
    expect(voice.stop).not.toHaveBeenCalled();
  });

  it('reflects the listening state', () => {
    voice.listening = true;
    render(<MicButton onResult={vi.fn()} />);
    expect(mic()?.getAttribute('data-agent-state')).toBe('listening');
    expect(mic()?.getAttribute('aria-pressed')).toBe('true');
    expect(mic()?.getAttribute('aria-label')).toBe('search.voice.stop');
  });

  it('shows a permission hint when mic access is denied', () => {
    voice.error = 'permission';
    render(<MicButton onResult={vi.fn()} />);
    expect(mic()?.getAttribute('data-agent-state')).toBe('error');
    expect(screen.getByRole('alert').textContent).toBe('search.voice.permission_denied');
  });

  it('streams partial transcripts to onPartial while listening', () => {
    voice.listening = true;
    voice.partial = 'aadhaar card';
    const onPartial = vi.fn();
    render(<MicButton onResult={vi.fn()} onPartial={onPartial} />);
    expect(onPartial).toHaveBeenCalledWith('aadhaar card');
  });
});
