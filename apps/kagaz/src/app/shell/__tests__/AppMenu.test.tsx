import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';

const { push, status } = vi.hoisted(() => ({ push: vi.fn(), status: { value: 'ready' } }));
vi.mock('@ionic/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push }),
}));
const route = vi.hoisted(() => ({ pathname: '/vault' }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useLocation: () => ({ pathname: route.pathname, search: '' }),
}));
vi.mock('@/app/providers/AIProvider', () => ({ useAi: () => ({ status: status.value }) }));

import { AppMenu } from '../AppMenu';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

const q = (id: string): Element | null => document.querySelector(`[data-agent-id="${id}"]`);

describe('AppMenu (smart UI §3 drawer)', () => {
  it('lists labelled destinations and navigates on tap', async () => {
    render(<AppMenu />);
    expect(q('app.menu.quick-reference')?.textContent).toContain('Quick Reference');
    expect(q('app.menu.settings')).toHaveAttribute('data-agent-action', 'settings.open');
    await userEvent.click(q('app.menu.trash') as Element);
    expect(push).toHaveBeenCalledWith('/trash', 'forward', 'push');
  });

  it('hides the AI model entry where on-device AI is unsupported', () => {
    status.value = 'unsupported';
    render(<AppMenu />);
    expect(q('app.menu.ai-model')).toBeNull();
    status.value = 'ready';
  });

  it('marks the current page and shows the backup status (DR-2, DR-4)', () => {
    route.pathname = '/trash';
    render(<AppMenu />);
    expect(q('app.menu.trash')).toHaveAttribute('aria-current', 'page');
    expect(q('app.menu.archived')).not.toHaveAttribute('aria-current');
    expect(q('app.menu.backup')?.textContent).toContain('Last backup: never');
    route.pathname = '/vault';
  });
});
