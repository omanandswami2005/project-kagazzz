import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/logging', () => ({ log: () => ({ info: vi.fn() }) }));

import { useViewMode } from '../useViewMode';

beforeEach(() => {
  localStorage.clear();
});

describe('useViewMode (UX-7)', () => {
  it('defaults to list when nothing is stored', () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('list');
  });

  it('persists the chosen mode to localStorage', () => {
    const { result } = renderHook(() => useViewMode());
    act(() => result.current.setMode('grid'));
    expect(result.current.mode).toBe('grid');
    expect(localStorage.getItem('kagaz:view-mode')).toBe('grid');
  });

  it('restores a previously stored mode', () => {
    localStorage.setItem('kagaz:view-mode', 'compact');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('compact');
  });

  it('falls back to list for an unknown stored value', () => {
    localStorage.setItem('kagaz:view-mode', 'nonsense');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('list');
  });
});
