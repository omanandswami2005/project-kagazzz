import { fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { SearchBar } from '../SearchBar';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('SearchBar (F-11)', () => {
  it('exposes the agent surface and reports input', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const bar = document.querySelector('[data-agent-id="vault.home.search"]');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('data-agent-action', 'vault.searchDocuments');
    expect(bar).toHaveAttribute('data-agent-state', 'pristine');

    // IonSearchbar emits onIonInput; userEvent.type can't reach the inner
    // shadow input in jsdom, so dispatch the Ionic event directly.
    fireEvent(bar as Element, new CustomEvent('ionInput', { detail: { value: 'pan' } }));
    expect(onChange).toHaveBeenCalledWith('pan');
  });

  it('reflects a dirty state when it has a value', () => {
    render(<SearchBar value="pan" onChange={() => undefined} />);
    expect(
      document.querySelector('[data-agent-id="vault.home.search"]')
    ).toHaveAttribute('data-agent-state', 'dirty');
  });
});
