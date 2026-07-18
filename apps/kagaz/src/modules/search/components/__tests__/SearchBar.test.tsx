import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { SearchBar } from '../SearchBar';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('SearchBar (F-11)', () => {
  it('exposes the agent surface and reports input', async () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('data-agent-id', 'vault.home.search');
    expect(input).toHaveAttribute('data-agent-action', 'vault.searchDocuments');
    expect(input).toHaveAttribute('data-agent-state', 'pristine');

    await userEvent.type(input, 'p');
    expect(onChange).toHaveBeenCalledWith('p');
  });

  it('reflects a dirty state when it has a value', () => {
    render(<SearchBar value="pan" onChange={() => undefined} />);
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'data-agent-state',
      'dirty'
    );
  });
});
