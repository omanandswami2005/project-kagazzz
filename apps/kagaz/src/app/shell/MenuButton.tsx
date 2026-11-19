/**
 * ☰ in a tab root's header: opens the side drawer ({@link AppMenu}). Both sit
 * on the right (device feedback 2026-11-19) — the thumb's side on a phone.
 * It takes the toolbar's `end` slot, so a page's own header actions go in
 * `primary`, which Ionic lays out just before it.
 */
import { IonButtons, IonMenuButton } from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Header end slot with the drawer toggle. */
export function MenuButton(): ReactNode {
  const { t } = useTranslation('common');
  return (
    <IonButtons slot="end">
      <IonMenuButton aria-label={t('menu.open')} data-agent-id="app.menu-button" />
    </IonButtons>
  );
}
