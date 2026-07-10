import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOnboarding } from '../useOnboarding';

afterEach(() => localStorage.clear());

describe('useOnboarding (F-27)', () => {
  it('shows onboarding on first launch (nothing stored)', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.showOnboarding).toBe(true);
  });

  it('complete() hides onboarding and persists the flag', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.complete());
    expect(result.current.showOnboarding).toBe(false);
    expect(localStorage.getItem('kagaz:onboarding-seen')).toBe('true');
  });

  it('stays hidden on a later launch once seen', () => {
    localStorage.setItem('kagaz:onboarding-seen', 'true');
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.showOnboarding).toBe(false);
  });
});
