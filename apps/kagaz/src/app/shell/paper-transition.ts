/**
 * "Paper" page transition (device feedback 2026-11-19): a new page slides in
 * from the edge like a sheet laid on top of the stack, casting a shadow on
 * the page beneath, which drifts back a little and dims; Back lifts the sheet
 * off the same way. Timing and curve come from the motion tokens, so Simple
 * mode and the OS "reduce motion" setting (both zero `--duration-*`) make it
 * an instant swap.
 */
import { createAnimation, type Animation } from '@ionic/react';

/** The part of Ionic's TransitionOptions this builder reads. */
interface PaperTransitionOptions {
  enteringEl: HTMLElement;
  leavingEl?: HTMLElement;
  direction?: 'forward' | 'back';
  duration?: number;
}

/** How far the page underneath drifts while the top sheet moves. */
const UNDER_OFFSET = '-24%';

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function tokenMs(name: string, fallback: number): number {
  const raw = token(name, `${fallback}ms`);
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return fallback;
  return raw.endsWith('ms') ? value : value * 1000;
}

/** Ionic `navAnimation` builder: paper sheets sliding over each other. */
export function paperTransition(_baseEl: HTMLElement, opts: PaperTransitionOptions): Animation {
  const back = opts.direction === 'back';
  const rtl = document.documentElement.dir === 'rtl';
  const off = rtl ? '-100%' : '100%';
  const under = rtl ? UNDER_OFFSET.replace('-', '') : UNDER_OFFSET;
  const duration = opts.duration ?? tokenMs('--duration-normal', 300);

  const root = createAnimation()
    .duration(duration)
    .easing(token('--ease-emphasized', 'cubic-bezier(0.2, 0, 0, 1)'));

  // The sheet on top is the entering page going forward, the leaving one going back.
  const top = back ? opts.leavingEl : opts.enteringEl;
  const bottom = back ? opts.enteringEl : opts.leavingEl;

  const entering = createAnimation()
    .addElement(opts.enteringEl)
    .beforeRemoveClass('ion-page-invisible');
  root.addAnimation(entering);

  if (top) {
    const sheet = (top === opts.enteringEl ? entering : createAnimation().addElement(top))
      .beforeStyles({ 'z-index': '2', 'box-shadow': token('--shadow-xl', 'none') })
      .afterClearStyles(['z-index', 'box-shadow']);
    sheet.fromTo('transform', back ? 'translateX(0)' : `translateX(${off})`, back ? `translateX(${off})` : 'translateX(0)');
    if (top !== opts.enteringEl) root.addAnimation(sheet);
  }

  if (bottom) {
    const page = bottom === opts.enteringEl ? entering : createAnimation().addElement(bottom);
    page
      .beforeStyles({ 'z-index': '1' })
      .afterClearStyles(['z-index', 'filter'])
      .fromTo('transform', back ? `translateX(${under})` : 'translateX(0)', back ? 'translateX(0)' : `translateX(${under})`)
      .fromTo('filter', back ? 'brightness(0.9)' : 'brightness(1)', back ? 'brightness(1)' : 'brightness(0.9)');
    if (bottom !== opts.enteringEl) root.addAnimation(page);
  }

  return root;
}
