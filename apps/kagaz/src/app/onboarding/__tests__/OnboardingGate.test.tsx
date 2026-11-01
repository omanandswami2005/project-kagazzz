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

const slideEl = (): HTMLElement =>
  q('app.onboarding')!.querySelector<HTMLElement>('.kg-onboarding__slide')!;

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

  describe('swipe gestures', () => {
    const swipe = (el: HTMLElement, fromX: number, toX: number): void => {
      fireEvent.pointerDown(el, { clientX: fromX, clientY: 0 });
      fireEvent.pointerUp(el, { clientX: toX, clientY: 0 });
    };

    it('swiping left advances to the next slide', () => {
      render(<OnboardingGate />);
      swipe(slideEl(), 300, 200);
      expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-2');
    });

    it('swiping right on the first slide is a no-op (already at the start)', () => {
      render(<OnboardingGate />);
      swipe(slideEl(), 200, 300);
      expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-1');
    });

    it('swiping right steps back after advancing', () => {
      render(<OnboardingGate />);
      const slide = slideEl();
      swipe(slide, 300, 200); // → slide 2
      swipe(slide, 200, 300); // → back to slide 1
      expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-1');
    });

    it('swiping left on the last slide completes onboarding, like Get Started', () => {
      render(<OnboardingGate />);
      const slide = slideEl();
      swipe(slide, 300, 200);
      swipe(slide, 300, 200);
      swipe(slide, 300, 200); // now on slide 4 (last)
      swipe(slide, 300, 200); // swipe left again → completes
      expect(q('app.onboarding')).toBeNull();
      expect(localStorage.getItem('kagaz:onboarding-seen')).toBe('true');
    });

    it('a short drag under the threshold does not change slides (tap tolerance)', () => {
      render(<OnboardingGate />);
      const slide = slideEl();
      swipe(slide, 300, 280); // 20px, under the 50px threshold
      expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-1');
    });

    it('a mostly-vertical drag does not change slides', () => {
      render(<OnboardingGate />);
      const slide = slideEl();
      fireEvent.pointerDown(slide, { clientX: 200, clientY: 100 });
      fireEvent.pointerUp(slide, { clientX: 260, clientY: 400 }); // dy > dx
      expect(q('app.onboarding')?.getAttribute('data-agent-state')).toBe('slide-1');
    });
  });
});
