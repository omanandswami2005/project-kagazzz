/**
 * Side drawer (smart UI plan §3): the second-level destinations, each with an
 * icon AND a label, grouped by purpose. Daily destinations stay in the tab
 * bar (progressive disclosure); the drawer replaces the row of unlabeled
 * header icons. Swipe from the left edge or tap ☰ ({@link MenuButton}).
 * Hardware back closes it first (Ionic's menu back handler, priority 99).
 */
import { IonContent, IonHeader, IonMenu, IonMenuToggle, IonTitle, IonToolbar, useIonRouter } from '@ionic/react';
import type { ReactNode } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@kagaz/ui';
import { useAi } from '@/app/providers/AIProvider';
import { useLocale } from '@/core/i18n';
import { usePreferencesStore } from '@/core/preferences';
import { AppMark } from './AppMark';
import './shell.css';

/** The id of the element the drawer overlays (IonRouterOutlet). */
export const MAIN_CONTENT_ID = 'kg-main';

/** Namespaces the drawer reads labels from (it reuses each screen's own title). */
const NAMESPACES = ['common', 'documents', 'settings'] as const;
type MenuKey = ParseKeys<typeof NAMESPACES>;

interface MenuItem {
  id: string;
  icon: IconName;
  /** i18n key, namespaced when it reuses another screen's title. */
  labelKey: MenuKey;
  route: string;
  /** Action Registry id this item performs, when one exists. */
  action?: string;
}

const SECTIONS: { titleKey: MenuKey; items: MenuItem[] }[] = [
  {
    titleKey: 'menu.quick_access',
    items: [
      { id: 'quick-reference', icon: 'KeyRound', labelKey: 'documents:quick_reference.title', route: '/quick-reference', action: 'vault.openQuickReference' },
      { id: 'quick-notes', icon: 'StickyNote', labelKey: 'documents:quick_notes.title', route: '/quick-notes', action: 'vault.openQuickNotes' },
    ],
  },
  {
    titleKey: 'menu.library',
    items: [
      { id: 'archived', icon: 'Archive', labelKey: 'documents:archived.title', route: '/archived' },
      { id: 'trash', icon: 'Trash2', labelKey: 'documents:trash.title', route: '/trash' },
      // DR-4/DR-6 (Hook · investment): the safety action, with its status.
      { id: 'backup', icon: 'DatabaseBackup', labelKey: 'menu.backup', route: '/settings' },
    ],
  },
  {
    titleKey: 'menu.app',
    items: [
      { id: 'ai-model', icon: 'Cpu', labelKey: 'menu.ai_model', route: '/ai-assistant' },
      { id: 'settings', icon: 'Settings', labelKey: 'settings:title', route: '/settings', action: 'settings.open' },
      { id: 'privacy', icon: 'ShieldCheck', labelKey: 'settings:about.privacy_policy', route: '/legal/privacy' },
    ],
  },
];

/** The app's side drawer. Render once, beside the tabs. */
export function AppMenu(): ReactNode {
  const { t } = useTranslation(NAMESPACES);
  const router = useIonRouter();
  const ai = useAi();
  const { pathname } = useLocation();
  const { formatShortDate } = useLocale();
  const lastBackupAt = usePreferencesStore((s) => s.lastBackupAt);
  const hintFor = (id: string): string | undefined =>
    id === 'backup'
      ? lastBackupAt
        ? t('settings:data.backup_last', { date: formatShortDate(lastBackupAt) })
        : t('menu.backup_never')
      : undefined;
  return (
    <IonMenu contentId={MAIN_CONTENT_ID} side="start" type="overlay" data-agent-id="app.menu">
      <IonHeader>
        <IonToolbar>
          {/* DR-1: the mark, the name, and the promise in one line. */}
          <div className="kg-menu__brand">
            <AppMark size={32} />
            <div>
              <IonTitle className="kg-menu__name">{t('app_name')}</IonTitle>
              <p className="kg-menu__tagline">{t('menu.tagline')}</p>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <nav className="kg-menu" aria-label={t('menu.title')}>
          {SECTIONS.map((section) => (
            <section key={section.titleKey} className="kg-menu__section">
              <h2 className="kg-menu__heading">{t(section.titleKey)}</h2>
              <ul className="kg-menu__list">
                {section.items
                  .filter((item) => item.id !== 'ai-model' || ai.status !== 'unsupported')
                  .map((item) => {
                    // DR-2: the page you're on is marked (not the Backup shortcut).
                    const current = item.id !== 'backup' && pathname === item.route;
                    const hint = hintFor(item.id);
                    return (
                      <li key={item.id}>
                        <IonMenuToggle autoHide={false}>
                          <button
                            type="button"
                            className={`kg-menu__item${current ? ' kg-menu__item--current' : ''}`}
                            aria-current={current ? 'page' : undefined}
                            onClick={() => router.push(item.route, 'forward', 'push')}
                            data-agent-id={`app.menu.${item.id}`}
                            data-agent-action={item.action}
                            data-agent-state={current ? 'selected' : 'idle'}
                          >
                            <Icon name={item.icon} size={24} aria-hidden />
                            <span className="kg-menu__text">
                              <span>{t(item.labelKey)}</span>
                              {hint && <span className="kg-menu__hint">{hint}</span>}
                            </span>
                          </button>
                        </IonMenuToggle>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </nav>
      </IonContent>
    </IonMenu>
  );
}
