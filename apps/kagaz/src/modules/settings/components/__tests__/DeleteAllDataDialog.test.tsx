import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { DeleteDataConfirm } from '../DeleteAllDataDialog';

// Stub the real eraser (the module imports native SQLite/secure-storage plugins).
vi.mock('../../services/data-erasure.service', () => ({
  createDataEraser: () => vi.fn(),
}));

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function confirmButton(): HTMLButtonElement {
  return screen.getByText('Delete everything').closest('button') as HTMLButtonElement;
}
function keywordInput(): HTMLElement {
  return document.querySelector(
    '[data-agent-id="settings.erase-confirm-input"]'
  ) as HTMLElement;
}

describe('DeleteDataConfirm (SEC-V1 #12)', () => {
  it('arms the destructive button only when the keyword is typed', async () => {
    render(<DeleteDataConfirm onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(confirmButton()).toBeDisabled();

    await userEvent.type(keywordInput(), 'nope');
    expect(confirmButton()).toBeDisabled();

    await userEvent.clear(keywordInput());
    await userEvent.type(keywordInput(), 'delete'); // case-insensitive
    expect(confirmButton()).toBeEnabled();
  });

  it('confirms only after the keyword is typed', async () => {
    const onConfirm = vi.fn();
    render(<DeleteDataConfirm onCancel={() => undefined} onConfirm={onConfirm} />);

    await userEvent.type(keywordInput(), 'DELETE');
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
