/**
 * The Kagazzz Docs mark (tick-K on a page, brand concept `tick-k-doc`,
 * docs/brand/logo-concepts). One component so the onboarding hero and the
 * drawer header show the same mark (audit OB-3, DR-1). Decorative: the
 * product name always sits next to it as text.
 */
import type { ReactNode } from 'react';
import markUrl from './app-mark.svg';

/** Props for {@link AppMark}. */
export interface AppMarkProps {
  /** Rendered size in px (square). */
  size: number;
  className?: string;
}

/** The app mark as a decorative image. */
export function AppMark({ size, className }: AppMarkProps): ReactNode {
  return <img src={markUrl} width={size} height={size} alt="" aria-hidden="true" className={className} />;
}
