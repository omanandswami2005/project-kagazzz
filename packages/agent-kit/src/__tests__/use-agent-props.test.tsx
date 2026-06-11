import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAgentProps } from '../use-agent-props';

describe('useAgentProps', () => {
  it('returns the data-agent-* bag', () => {
    const { result } = renderHook(() =>
      useAgentProps({
        id: 'vault.upload-fab',
        action: 'vault.uploadDocument',
        role: 'primary-action',
        state: 'idle',
      })
    );
    expect(result.current).toEqual({
      'data-agent-id': 'vault.upload-fab',
      'data-agent-action': 'vault.uploadDocument',
      'data-agent-role': 'primary-action',
      'data-agent-state': 'idle',
      'data-agent-value': undefined,
    });
  });

  it('emits agent:render in dev for the AgentInspector', () => {
    const listener = vi.fn();
    window.addEventListener('agent:render', listener);
    renderHook(() => useAgentProps({ id: 'ai.chat-input', state: 'idle' }));
    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toMatchObject({ id: 'ai.chat-input', state: 'idle' });
    window.removeEventListener('agent:render', listener);
  });

  it('re-emits when the state changes', () => {
    const listener = vi.fn();
    window.addEventListener('agent:render', listener);
    const { rerender } = renderHook(
      ({ state }: { state: 'idle' | 'loading' }) =>
        useAgentProps({ id: 'vault.upload-fab', state }),
      { initialProps: { state: 'idle' as 'idle' | 'loading' } }
    );
    rerender({ state: 'loading' });
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('agent:render', listener);
  });
});
