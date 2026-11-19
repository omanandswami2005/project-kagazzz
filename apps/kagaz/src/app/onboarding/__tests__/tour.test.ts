import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { presentSteps, runTour, WELCOME_TOUR } from '../tour';

const drive = vi.fn();
const destroy = vi.fn();
const driverMock = vi.hoisted(() => vi.fn());
vi.mock('driver.js', () => ({ driver: driverMock }));
vi.mock('driver.js/dist/driver.css', () => ({}));
vi.mock('../tour.css', () => ({}));

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

/** Adds an element with the agent id; `shown` decides whether it is laid out. */
function target(agentId: string, shown = true): void {
  const el = document.createElement('button');
  el.dataset.agentId = agentId;
  el.getClientRects = (): DOMRectList => ({ length: shown ? 1 : 0 }) as DOMRectList;
  document.body.appendChild(el);
}

describe('spotlight tour', () => {
  it('only visits steps whose element is on screen (no AI tab on unsupported devices)', () => {
    target('vault.home.upload-fab');
    target('vault.home.search');
    target('app.tab.ai', false);
    target('app.menu-button');
    expect(presentSteps(WELCOME_TOUR).map((s) => s.key)).toEqual(['add', 'search', 'menu']);
  });

  it('runs nothing when no target is present', async () => {
    expect(await runTour(WELCOME_TOUR, i18n.t, vi.fn())).toBeNull();
    expect(driverMock).not.toHaveBeenCalled();
  });

  it('drives translated steps, tags its buttons with agent ids, and reports the end', async () => {
    driverMock.mockReturnValue({ drive, destroy });
    target('vault.home.upload-fab');
    target('app.menu-button');
    const onDone = vi.fn();

    const handle = await runTour(WELCOME_TOUR, i18n.t, onDone);

    expect(drive).toHaveBeenCalledOnce();
    const config = driverMock.mock.calls[0]?.[0] as {
      steps: { popover: { title: string } }[];
      onPopoverRender: (p: Record<string, HTMLElement>) => void;
      onDestroyed: () => void;
    };
    expect(config.steps.map((s) => s.popover.title)).toEqual(['Add your documents', 'Everything else']);

    const dom = Object.fromEntries(
      ['nextButton', 'previousButton', 'closeButton', 'wrapper'].map((k) => [k, document.createElement('button')])
    );
    config.onPopoverRender(dom);
    expect(dom.nextButton?.dataset.agentId).toBe('app.tour.next');
    expect(dom.closeButton?.getAttribute('aria-label')).toBe('Close the tour');

    config.onDestroyed();
    expect(onDone).toHaveBeenCalledOnce();
    handle?.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
