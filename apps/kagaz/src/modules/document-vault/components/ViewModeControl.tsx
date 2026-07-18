/**
 * View-mode control (UX-7) — a three-way segment that switches the vault
 * list between List, Grid, and Compact. Presentation-only; it drives the
 * persisted {@link useViewMode} preference.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@kagaz/ui';
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
    <div
      className="kg-vault__view-mode"
      role="group"
      aria-label={t('view.label')}
      data-agent-id="vault.home.view-mode"
    >
      {OPTIONS.map((opt) => {
        const active = opt.mode === mode;
        return (
          <button
            key={opt.mode}
            type="button"
            className={`kg-vault__view-btn${active ? ' kg-vault__view-btn--active' : ''}`}
            aria-pressed={active}
            aria-label={t(opt.labelKey)}
            data-agent-id={`vault.home.view-mode.${opt.mode}`}
            data-agent-state={active ? 'selected' : 'idle'}
            onClick={() => onChange(opt.mode)}
          >
            <Icon
              name={opt.icon}
              size={20}
              color={active ? 'var(--color-primary)' : 'var(--text-muted)'}
            />
          </button>
        );
      })}
    </div>
  );
}
