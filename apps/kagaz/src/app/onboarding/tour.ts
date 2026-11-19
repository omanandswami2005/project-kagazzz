/**
 * Spotlight tours (first-run journey, 2026-11-19), built on driver.js — MIT,
 * zero dependencies, no network or storage of its own (checked: its bundle
 * has no fetch/XHR/eval and never touches localStorage). Loaded lazily, only
 * when a tour actually runs, so it costs nothing on a normal launch.
 *
 * Copy comes from i18n, colours from the design tokens (tour.css), and motion
 * from the duration tokens: Simple mode and "reduce motion" get no animation.
 */
import type { TFunction } from 'i18next';

/** Copy keys under `common:tour`. */
export type TourKey = 'add' | 'search' | 'ai' | 'menu' | 'star' | 'lock' | 'backup';

/** One stop of a tour: the element to light up and its i18n copy key. */
export interface TourStep {
  /** CSS selector of the element, by agent id. */
  selector: string;
  /** `common:tour.<key>.title` / `.body`. */
  key: TourKey;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/** The first-run tour of the Documents screen. */
export const WELCOME_TOUR: readonly TourStep[] = [
  { selector: '[data-agent-id="vault.home.upload-fab"]', key: 'add', side: 'top' },
  { selector: '[data-agent-id="vault.home.search"]', key: 'search', side: 'bottom' },
  { selector: '[data-agent-id="app.tab.ai"]', key: 'ai', side: 'top' },
  { selector: '[data-agent-id="app.menu-button"]', key: 'menu', side: 'bottom' },
];

/** `seenTips` id that marks the welcome tour as done. */
export const WELCOME_TOUR_TIP = 'welcome-tour';

/** A running tour; `destroy` closes it (Back button, leaving the page). */
export interface TourHandle {
  destroy: () => void;
}

/** True if the element is in the DOM and laid out (not display:none / hidden). */
function isShown(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.getClientRects().length > 0;
}

/**
 * The steps whose element is on screen right now, in order. The AI tab is
 * absent on devices that can't run the model; an empty vault lays out
 * differently — a tour must never point at nothing.
 */
export function presentSteps(steps: readonly TourStep[], root: ParentNode = document): TourStep[] {
  return steps.filter((step) => isShown(root.querySelector(step.selector)));
}

/** Whether motion is on (Simple mode and reduced motion zero the tokens). */
function motionAllowed(): boolean {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--duration-normal').trim();
  return raw !== '' && parseFloat(raw) > 0;
}

/**
 * Runs a tour over the steps that are present. Resolves null (and runs
 * nothing) when none are; `onDone` fires once, however it ends.
 */
export async function runTour(
  steps: readonly TourStep[],
  t: TFunction<'common'>,
  onDone: () => void
): Promise<TourHandle | null> {
  const present = presentSteps(steps);
  if (present.length === 0) return null;
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css'), import('./tour.css')]);
  const tour = driver({
    animate: motionAllowed(),
    smoothScroll: false,
    allowClose: true,
    disableActiveInteraction: true,
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'kg-tour',
    showProgress: present.length > 1,
    progressText: t('tour.progress', { current: '{{current}}', total: '{{total}}' }),
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.back'),
    doneBtnText: t('tour.done'),
    showButtons: present.length > 1 ? ['next', 'previous', 'close'] : ['next', 'close'],
    steps: present.map((step) => ({
      element: step.selector,
      popover: {
        title: t(`tour.${step.key}.title`),
        description: t(`tour.${step.key}.body`),
        side: step.side,
        align: 'center' as const,
      },
    })),
    // Agent-interface contract: every interactive element carries an id.
    onPopoverRender: (popover) => {
      popover.nextButton.dataset.agentId = 'app.tour.next';
      popover.previousButton.dataset.agentId = 'app.tour.back';
      popover.closeButton.dataset.agentId = 'app.tour.close';
      popover.closeButton.setAttribute('aria-label', t('tour.close'));
      popover.wrapper.dataset.agentId = 'app.tour';
    },
    onDestroyed: onDone,
  });
  tour.drive();
  return { destroy: () => tour.destroy() };
}
