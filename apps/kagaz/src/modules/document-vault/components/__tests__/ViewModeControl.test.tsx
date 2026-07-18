import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewModeControl } from '../ViewModeControl';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const q = (id: string): HTMLElement | null =>
  document.querySelector(`[data-agent-id="${id}"]`);

afterEach(cleanup);

describe('ViewModeControl (UX-7)', () => {
  it('marks the active mode as pressed', () => {
    render(<ViewModeControl mode="grid" onChange={vi.fn()} />);
    expect(q('vault.home.view-mode.grid')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('vault.home.view-mode.list')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onChange with the picked mode', () => {
    const onChange = vi.fn();
    render(<ViewModeControl mode="list" onChange={onChange} />);
    fireEvent.click(q('vault.home.view-mode.compact')!);
    expect(onChange).toHaveBeenCalledWith('compact');
  });
});
