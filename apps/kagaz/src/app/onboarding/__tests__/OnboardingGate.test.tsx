import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingGate } from '../OnboardingGate';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const q = (id: string): HTMLElement | null =>
  document.querySelector(`[data-agent-id="${id}"]`);

describe('OnboardingGate (F-27)', () => {
  it('renders the first slide on first launch', () => {
    render(<OnboardingGate />);
    expect(q('app.onboarding')).not.toBeNull();
    expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-1');
    expect(q('app.onboarding.skip')).not.toBeNull();
    expect(q('app.onboarding.next')).not.toBeNull();
    // Back is disabled on the first slide.
    expect(q('app.onboarding.back')).toHaveProperty('disabled', true);
  });

  it('advances through slides and shows Get Started on the last', () => {
    render(<OnboardingGate />);
    // 4 slides → click Next 3 times.
    fireEvent.click(q('app.onboarding.next')!);
    expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-2');
    fireEvent.click(q('app.onboarding.next')!);
    fireEvent.click(q('app.onboarding.next')!);
    expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-4');
    expect(q('app.onboarding.next')).toBeNull();
    expect(q('app.onboarding.get-started')).not.toBeNull();
  });

  it('Back steps to the previous slide', () => {
    render(<OnboardingGate />);
    fireEvent.click(q('app.onboarding.next')!);
    fireEvent.click(q('app.onboarding.back')!);
    expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-1');
  });

  it('Skip completes onboarding (overlay disappears + persisted)', () => {
    render(<OnboardingGate />);
    fireEvent.click(q('app.onboarding.skip')!);
    expect(q('app.onboarding')).toBeNull();
    expect(localStorage.getItem('kagaz:onboarding-seen')).toBe('true');
  });

  it('Get Started completes onboarding', () => {
    render(<OnboardingGate />);
    fireEvent.click(q('app.onboarding.next')!);
    fireEvent.click(q('app.onboarding.next')!);
    fireEvent.click(q('app.onboarding.next')!);
    fireEvent.click(q('app.onboarding.get-started')!);
    expect(q('app.onboarding')).toBeNull();
    expect(localStorage.getItem('kagaz:onboarding-seen')).toBe('true');
  });

  it('renders nothing when already seen', () => {
    localStorage.setItem('kagaz:onboarding-seen', 'true');
    render(<OnboardingGate />);
    expect(q('app.onboarding')).toBeNull();
  });
});
