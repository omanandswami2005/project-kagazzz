import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRootWarning } from '../useRootWarning';

const { isRooted } = vi.hoisted(() => ({ isRooted: vi.fn() }));
vi.mock('../../services/root-check', () => ({ RootCheck: { isRooted } }));

beforeEach(() => isRooted.mockReset());

describe('useRootWarning (SEC-V1 #10)', () => {
  it('shows the warning on a rooted device, then hides on dismiss', async () => {
    isRooted.mockResolvedValue({ rooted: true });
    const { result } = renderHook(() => useRootWarning());

    await waitFor(() => expect(result.current.show).toBe(true));
    act(() => result.current.dismiss());
    expect(result.current.show).toBe(false);
  });

  it('stays hidden on a normal device', async () => {
    isRooted.mockResolvedValue({ rooted: false });
    const { result } = renderHook(() => useRootWarning());

    await waitFor(() => expect(isRooted).toHaveBeenCalled());
    expect(result.current.show).toBe(false);
  });
});
