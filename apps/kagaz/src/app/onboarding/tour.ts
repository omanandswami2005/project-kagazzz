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
export type TourKey =
  | 'add'
  | 'search'
  | 'ai'
  | 'menu'
  | 'star'
  | 'lock'
  | 'backup'
  | 'swipe'
  | 'select'
  | 'more'
  | 'quick_reference'
  | 'quick_notes'
  | 'archive_trash'
  | 'backup_menu'
  | 'folder_more'
  | 'tools_search'
  | 'tools_categories'
  | 'tools_op'
  | 'viewer_swipe'
  | 'viewer_more'
  | 'favorites_star';

/** One stop of a tour: the element to light up and its i18n copy key. */
export interface TourStep {
  /** CSS selector of the element, by agent id. */
  selector: string;
  /** `common:tour.<key>.title` / `.body`. */
  key: TourKey;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Replaces `common:tour.<key>.body` when the copy depends on settings. */
  body?: string;
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

/** The first document row (virtualised list: the first one rendered). */
const FIRST_ROW = '[data-agent-id="vault.home.list"] [data-doc-id]';

/**
 * The gestures tour, once the vault has documents to act on: swipe and
 * long-press are invisible until someone shows them. The swipe step's copy
 * names the user's own swipe actions, so it's passed in as `body` (and the
 * step is left out when both directions are off).
 */
export const DOCUMENTS_TOUR: readonly TourStep[] = [
  // The <li> holds the swipe row, so the spotlit row also wiggles (tour.css).
  { selector: FIRST_ROW, key: 'swipe', side: 'bottom' },
  { selector: `${FIRST_ROW} .kg-doc-item--button`, key: 'select', side: 'bottom' },
  { selector: `${FIRST_ROW} [data-agent-id$=".more"]`, key: 'more', side: 'left' },
];

/** `seenTips` id that marks the gestures tour as done. */
export const DOCUMENTS_TOUR_TIP = 'documents-tour';

/** The side drawer's tour, the first time it opens. */
export const MENU_TOUR: readonly TourStep[] = [
  {
    selector: '[data-agent-id="app.menu.quick-reference"]',
    key: 'quick_reference',
    side: 'bottom',
  },
  { selector: '[data-agent-id="app.menu.quick-notes"]', key: 'quick_notes', side: 'bottom' },
  { selector: '[data-agent-id="app.menu.archived"]', key: 'archive_trash', side: 'bottom' },
  { selector: '[data-agent-id="app.menu.backup"]', key: 'backup_menu', side: 'top' },
];

/** `seenTips` id that marks the drawer tour as done. */
export const MENU_TOUR_TIP = 'menu-tour';

/** The first folder's ⋮, once there is a folder: rename, colour, order, delete. */
export const FOLDER_TOUR: readonly TourStep[] = [
  { selector: '[data-agent-id="vault.home.folders"] [data-agent-id$=".more"]', key: 'folder_more', side: 'bottom' },
];

/** `seenTips` id that marks the folder tip as done. */
export const FOLDER_TOUR_TIP = 'folder-tour';

/** PDF Tools, the first time it opens: find a tool, browse by kind, pick one. */
export const TOOLS_TOUR: readonly TourStep[] = [
  { selector: '[data-agent-id="pdf-tools.search"]', key: 'tools_search', side: 'bottom' },
  { selector: '[data-agent-id="pdf-tools.categories"]', key: 'tools_categories', side: 'bottom' },
  { selector: '[data-agent-id="pdf-tools.ops"] [data-agent-id^="pdf-tools.op-"]', key: 'tools_op', side: 'bottom' },
];

/** `seenTips` id that marks the PDF Tools tour as done. */
export const TOOLS_TOUR_TIP = 'tools-tour';

/** The document viewer, the first time a document opens. */
export const VIEWER_TOUR: readonly TourStep[] = [
  { selector: '[data-agent-id="vault.viewer.content"]', key: 'viewer_swipe', side: 'top' },
  { selector: '[data-agent-id="vault.viewer.more"]', key: 'viewer_more', side: 'bottom' },
];

/** `seenTips` id that marks the viewer tour as done. */
export const VIEWER_TOUR_TIP = 'viewer-tour';

/** Every one-time tour, so "Show the tour again" can bring them all back. */
export const ALL_TOUR_TIPS = [
  WELCOME_TOUR_TIP,
  DOCUMENTS_TOUR_TIP,
  MENU_TOUR_TIP,
  FOLDER_TOUR_TIP,
  TOOLS_TOUR_TIP,
  VIEWER_TOUR_TIP,
] as const;

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
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--duration-normal')
    .trim();
  return raw !== '' && parseFloat(raw) > 0;
}

/** Hardware Back while a tour runs closes the tour, before any page handler. */
const BACK_PRIORITY = 200;
type BackEvent = CustomEvent<{ register: (priority: number, handler: () => void) => void }>;

/**
 * Runs a tour over the steps that are present. Resolves null (and runs
 * nothing) when none are; `onDone` fires once, however it ends. Back closes
 * it (above the drawer's own Back handler at 99 and every page's).
 */
export async function runTour(
  steps: readonly TourStep[],
  t: TFunction<'common'>,
  onDone: () => void
): Promise<TourHandle | null> {
  const present = presentSteps(steps);
  if (present.length === 0) return null;
  const [{ driver }] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
    import('./tour.css'),
  ]);
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
        description: step.body ?? t(`tour.${step.key}.body`),
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
    onDestroyed: () => {
      document.removeEventListener('ionBackButton', onBack);
      onDone();
    },
  });
  const onBack = (event: Event): void => {
    (event as BackEvent).detail.register(BACK_PRIORITY, () => tour.destroy());
  };
  document.addEventListener('ionBackButton', onBack);
  tour.drive();
  return { destroy: () => tour.destroy() };
}
