import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { useVaultStore } from '../../store/vault.store';
import { SortControl } from '../SortControl';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  useVaultStore.setState({
    sortBy: 'createdAt',
    sortDirection: 'desc',
    documents: [],
  });
});

// F-34 + the G1-4 IonSelect → Select swap: a native <select>, not an Ionic
// popover, so — unlike before — this is now testable without an overlay
// controller.
describe('SortControl (F-34)', () => {
  it('reflects the current sort key and updates the store on change', async () => {
    render(<SortControl />);
    const select = screen.getByLabelText<HTMLSelectElement>('Sort by');
    expect(select.value).toBe('createdAt');

    await userEvent.selectOptions(select, 'name');
    expect(useVaultStore.getState().sortBy).toBe('name');
  });

  it('toggles sort direction and reflects it in the button label', async () => {
    render(<SortControl />);
    const toggle = screen.getByRole('button', { name: /descending/i });
    await userEvent.click(toggle);
    expect(useVaultStore.getState().sortDirection).toBe('asc');
  });

  it('renders every sort key as a real, selectable option', () => {
    render(<SortControl />);
    const select = screen.getByLabelText<HTMLSelectElement>('Sort by');
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([
      'createdAt',
      'updatedAt',
      'lastAccessedAt',
      'name',
      'fileSize',
      'fileType',
    ]);
  });
});
