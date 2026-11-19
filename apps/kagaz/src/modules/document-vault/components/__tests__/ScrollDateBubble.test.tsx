import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { entityFromNew } from '../../__tests__/fixtures/vault-fixtures';
import { ScrollDateBubble } from '../ScrollDateBubble';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.useRealTimers());

const base = { filePath: 'documents/a.pdf', fileType: 'pdf', fileSize: 1, isFavorite: false, isLocked: false, isArchived: false, language: 'en', sourceType: 'file_picker' } as const;

/** A scroller 600px tall holding two rows; the first row has scrolled above the top. */
function makeScroller(height: number): HTMLElement {
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'clientHeight', { value: 600 });
  Object.defineProperty(scroller, 'scrollHeight', { value: height });
  scroller.getBoundingClientRect = (): DOMRect => ({ top: 0 }) as DOMRect;
  for (const [id, bottom] of [['a', -10], ['b', 80]] as const) {
    const row = document.createElement('li');
    row.dataset.docId = id;
    row.getBoundingClientRect = (): DOMRect => ({ bottom }) as DOMRect;
    scroller.appendChild(row);
  }
  document.body.appendChild(scroller);
  return scroller;
}

const docs = [
  { ...entityFromNew({ ...base, name: 'A' }, 'a'), createdAt: '2026-01-05T10:00:00.000Z' },
  { ...entityFromNew({ ...base, name: 'B' }, 'b'), createdAt: '2026-03-09T10:00:00.000Z' },
];

async function scroll(scroller: HTMLElement): Promise<void> {
  fireEvent.scroll(scroller);
  await act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
}

describe('ScrollDateBubble', () => {
  it('shows the date of the top visible document while scrolling, then hides', async () => {
    const scroller = makeScroller(3000);
    const { container } = render(<ScrollDateBubble scrollElement={scroller} documents={docs} />);
    const pill = container.querySelector('[data-agent-id="vault.home.scroll-date"]')!;
    expect(pill).toHaveAttribute('data-agent-state', 'collapsed');

    await scroll(scroller);
    expect(pill).toHaveAttribute('data-agent-state', 'expanded');
    expect(pill.textContent).toMatch(/Mar/);

    await act(() => new Promise<void>((r) => setTimeout(r, 1000)));
    expect(pill).toHaveAttribute('data-agent-state', 'collapsed');
  });

  it('stays hidden on a list too short to need it', async () => {
    const scroller = makeScroller(700);
    const { container } = render(<ScrollDateBubble scrollElement={scroller} documents={docs} />);
    await scroll(scroller);
    expect(container.querySelector('[data-agent-id="vault.home.scroll-date"]')).toHaveAttribute('data-agent-state', 'collapsed');
  });
});
