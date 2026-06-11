/**
 * Icon atom (component-library.md §Icon).
 * Lucide icons, 1.5px stroke, currentColor, paired with aria-label or
 * marked decorative.
 */
import { icons } from 'lucide-react';
import type { ReactNode } from 'react';

/** Name of any Lucide icon (PascalCase, e.g. "FileText"). */
export type IconName = keyof typeof icons;

/** Props for {@link Icon}. */
export interface IconProps {
  /** Icon identifier from the Lucide set. */
  name: IconName;
  /** Icon size in pixels (token sizes: 16/20/24/32/48). */
  size?: 16 | 20 | 24 | 32 | 48;
  /** Icon color — defaults to the surrounding text color. */
  color?: string;
  /** Stroke width (Lucide default per design system). */
  strokeWidth?: number;
  /** Accessible name — required when the icon stands alone. */
  'aria-label'?: string;
}

/** Lucide icon wrapper enforcing the design-system defaults. */
export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.5,
  'aria-label': ariaLabel,
}: IconProps): ReactNode {
  const LucideIcon = icons[name];
  return (
    <LucideIcon
      className="kg-icon"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
    />
  );
}
