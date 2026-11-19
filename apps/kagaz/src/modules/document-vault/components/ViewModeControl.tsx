/**
 * View-mode control (UX-7) — a three-way segment that switches the vault
 * list between List, Grid, and Compact. Presentation-only; it drives the
 * persisted {@link useViewMode} preference.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl, type IconName } from '@kagaz/ui';
import type { ViewMode } from '../hooks/useViewMode';

const OPTIONS = [
  { mode: 'list', icon: 'List', labelKey: 'view.list' },
  { mode: 'grid', icon: 'LayoutGrid', labelKey: 'view.grid' },
  { mode: 'compact', icon: 'Rows3', labelKey: 'view.compact' },
] as const satisfies readonly { mode: ViewMode; icon: IconName; labelKey: string }[];

/** Props for {@link ViewModeControl}. */
export interface ViewModeControlProps {
  /** The active layout. */
  mode: ViewMode;
  /** Selects a layout. */
  onChange: (mode: ViewMode) => void;
}

/** Segmented List/Grid/Compact switch for the vault list (UX-7). */
export function ViewModeControl({ mode, onChange }: ViewModeControlProps): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <SegmentedControl
      aria-label={t('view.label')}
      agentId="vault.home.view-mode"
      optionAgentId={(m) => `vault.home.view-mode.${m}`}
      value={mode}
      onChange={onChange}
      options={OPTIONS.map((opt) => ({
        value: opt.mode,
        icon: opt.icon,
        ariaLabel: t(opt.labelKey),
      }))}
    />
  );
}
