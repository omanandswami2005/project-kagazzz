import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { i18n, initI18n } from '@/core/i18n';
import {
  ALL_TOUR_TIPS,
  DOCUMENTS_TOUR,
  FOLDER_TOUR,
  MENU_TOUR,
  presentSteps,
  runTour,
  TOOLS_TOUR,
  VIEWER_TOUR,
  WELCOME_TOUR,
} from '../tour';

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
/** The `common` translator, as the app passes it. */
const tCommon = (): TFunction<'common'> => i18n.getFixedT(null, 'common');

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
    expect(await runTour(WELCOME_TOUR, tCommon(), vi.fn())).toBeNull();
    expect(driverMock).not.toHaveBeenCalled();
  });

  it('drives translated steps, tags its buttons with agent ids, and reports the end', async () => {
    driverMock.mockReturnValue({ drive, destroy });
    target('vault.home.upload-fab');
    target('app.menu-button');
    const onDone = vi.fn();

    const handle = await runTour(WELCOME_TOUR, tCommon(), onDone);

    expect(drive).toHaveBeenCalledOnce();
    const config = driverMock.mock.calls[0]?.[0] as {
      steps: { popover: { title: string } }[];
      onPopoverRender: (p: Record<string, HTMLElement>) => void;
      onDestroyed: () => void;
    };
    expect(config.steps.map((s) => s.popover.title)).toEqual([
      'Add your documents',
      'Everything else',
    ]);

    const dom = Object.fromEntries(
      ['nextButton', 'previousButton', 'closeButton', 'wrapper'].map((k) => [
        k,
        document.createElement('button'),
      ])
    );
    config.onPopoverRender(dom);
    expect(dom.nextButton?.dataset.agentId).toBe('app.tour.next');
    expect(dom.closeButton?.getAttribute('aria-label')).toBe('Close the tour');

    config.onDestroyed();
    expect(onDone).toHaveBeenCalledOnce();
    handle?.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('uses a step body override and closes on hardware Back', async () => {
    driverMock.mockReturnValue({ drive, destroy });
    target('vault.home.upload-fab');
    await runTour(
      [
        {
          selector: '[data-agent-id="vault.home.upload-fab"]',
          key: 'swipe',
          body: 'Swipe right: Favorite.',
        },
      ],
      tCommon(),
      vi.fn()
    );
    const config = driverMock.mock.calls[0]?.[0] as {
      steps: { popover: { title: string; description: string } }[];
      onDestroyed: () => void;
    };
    expect(config.steps[0]?.popover).toMatchObject({
      title: 'Swipe a document',
      description: 'Swipe right: Favorite.',
    });

    const register = vi.fn((_priority: number, handler: () => void) => handler());
    document.dispatchEvent(new CustomEvent('ionBackButton', { detail: { register } }));
    expect(register.mock.calls[0]?.[0]).toBeGreaterThan(100);
    expect(destroy).toHaveBeenCalledOnce();

    // Once the tour is gone, Back is no longer intercepted.
    config.onDestroyed();
    register.mockClear();
    document.dispatchEvent(new CustomEvent('ionBackButton', { detail: { register } }));
    expect(register).not.toHaveBeenCalled();
  });

  it('has copy for every drawer step, and replay covers every tour', () => {
    const t = tCommon();
    for (const step of [...MENU_TOUR, ...DOCUMENTS_TOUR, ...FOLDER_TOUR, ...TOOLS_TOUR, ...VIEWER_TOUR]) {
      expect(t(`tour.${step.key}.title`)).not.toContain('tour.');
      expect(t(`tour.${step.key}.body`)).not.toContain('tour.');
    }
    expect(t('tour.favorites_star.title')).toBe('Star it here');
    expect(ALL_TOUR_TIPS).toEqual([
      'welcome-tour',
      'documents-tour',
      'menu-tour',
      'folder-tour',
      'tools-tour',
      'viewer-tour',
    ]);
  });
});
